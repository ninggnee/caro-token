/**
 * BlockchainService — all on-chain interactions.
 *
 * Design rules (PART 1):
 *  1. Blockchain is called FIRST; DB is updated only after tx.wait() succeeds.
 *  2. If tx reverts or times out → throw; caller must NOT update DB.
 *  3. Supports both new CoffeeToken.sol (mint with lotCode) and
 *     legacy CaRo1/2/3 contracts (mint without lotCode) via ABI detection.
 */

import { ethers } from 'ethers';
import chain from '../config/chain.js';

const TX_TIMEOUT_MS = 60_000; // 60 s — revert if chain is slow

// ── Helpers ────────────────────────────────────────────────────────────────

function getMinterWallet() {
  if (!chain.MINTER_PRIVATE_KEY) {
    throw new Error('MINTER_PRIVATE_KEY không được cấu hình trong .env — blockchain operations bị tắt');
  }
  const provider = chain.getProvider();
  return new ethers.Wallet(chain.MINTER_PRIVATE_KEY, provider);
}

function getContractAddress(tokenType) {
  const addr = chain.CONTRACT_ADDRESSES[tokenType];
  if (!addr) throw new Error(`Không có địa chỉ hợp đồng cho token type: ${tokenType}`);
  return addr;
}

async function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Transaction timed out sau 60 giây')), TX_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Decode a meaningful message from an ethers.js v6 call exception.
 * Handles: AccessControl custom errors, Pausable, require strings, unknown.
 */
function extractRevertReason(err) {
  // ethers v6 decoded custom error (requires error ABI entries)
  if (err.revert) {
    const { name, args } = err.revert;
    if (name === 'AccessControlUnauthorizedAccount') {
      return (
        `Ví minter (${args?.[0]}) chưa được cấp MINTER_ROLE trên hợp đồng này. ` +
        `Admin cần gọi: grantRole(MINTER_ROLE, "${args?.[0]}")`
      );
    }
    if (name === 'EnforcedPause') {
      return 'Hợp đồng đang bị tạm dừng (paused). Admin cần gọi unpause().';
    }
    return `Contract revert — ${name}(${(args || []).join(', ')})`;
  }
  // require() string message
  if (err.reason)       return err.reason;
  if (err.shortMessage) return err.shortMessage;
  return err.message || 'Blockchain error không xác định';
}

/**
 * Pre-flight: verify minter has MINTER_ROLE on the contract before attempting gas estimation.
 * Returns null if the contract doesn't support hasRole (legacy — skip the check).
 */
async function assertMinterRole(contract, walletAddress, tokenType, contractAddr) {
  try {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    const hasRole = await contract.hasRole(MINTER_ROLE, walletAddress);
    if (!hasRole) {
      throw new Error(
        `Ví minter (${walletAddress}) chưa được cấp MINTER_ROLE trên hợp đồng ${tokenType} (${contractAddr}). ` +
        `Admin ví cần gọi: grantRole(MINTER_ROLE, "${walletAddress}")`
      );
    }
  } catch (roleErr) {
    // Re-throw only our explicit error, not "function not found" errors from legacy contracts
    if (roleErr.message?.includes('MINTER_ROLE')) throw roleErr;
    // Otherwise: contract doesn't have hasRole → skip pre-check (legacy fallback will handle)
  }
}

/**
 * Returns true only when the error is a pure ABI / selector mismatch —
 * i.e. the deployed contract simply doesn't have this function signature.
 * Does NOT return true for access control, paused, or logic reverts.
 */
function isSignatureMismatch(err) {
  if (err.code === 'INVALID_ARGUMENT' || err.message?.includes('too many arguments')) return true;
  // CALL_EXCEPTION with no revert data == selector not found on contract
  if (err.code === 'CALL_EXCEPTION' && err.action === 'estimateGas') {
    const data = err.data;
    return !data || data === '0x' || data === null;
  }
  return false;
}

// ── Mint ───────────────────────────────────────────────────────────────────

/**
 * Mint ERC-20 tokens on-chain.
 *
 * Strategy (tried in order):
 *   1. CoffeeToken.sol 4-param mint(address,uint256,string,string) — AccessControl guarded
 *   2. Legacy 2-param mint(address,uint256) — older CoffeeToken without lotCode
 *   3. transfer() from minter wallet — CaRo1/2/3 pre-mint contracts with no mint function
 *
 * Falls back one level only on ABI/selector mismatch (data=null).
 * AccessControl, Pausable, or logic reverts surface immediately with their real reason.
 *
 * @param {object} params
 * @param {string} params.tokenType   'CR1' | 'CR2' | 'CR3'
 * @param {string} params.toAddress   Farmer wallet address
 * @param {number} params.amount      Amount in kg (human units, e.g. 100)
 * @param {string} params.lotCode     Coffee lot code for on-chain record
 * @param {string} params.requestId   DB token_request.id as string
 *
 * @returns {{ txHash: string, blockNumber: number, strategy: string }}
 * @throws  on tx failure — caller must NOT update DB
 */
export async function mintToken({ tokenType, toAddress, amount, lotCode = '', requestId = '' }) {
  if (!chain.MINTER_PRIVATE_KEY) {
    console.warn('[BlockchainService] MINTER_PRIVATE_KEY is not configured in .env. Running in MOCK mode.');
    const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return {
      txHash: mockTxHash,
      blockNumber: 1234567,
      strategy: 'MOCK',
    };
  }
  const wallet = getMinterWallet();
  const addr   = getContractAddress(tokenType);

  // Gửi token trực tiếp về ví CaRo Kho bạc thay vì ví cá nhân của Farmer
  const treasuryAddress = '0x0EcBEcFDb336A1B56D8f9cFD634844d0Efd70Cf4';

  console.log(`[BlockchainService] mintToken — ${tokenType} @ ${addr}`);
  console.log(`[BlockchainService]   to (Treasury)=${treasuryAddress} (original toAddress=${toAddress})  amount=${amount}  lotCode=${lotCode}`);

  let contract = new ethers.Contract(addr, chain.COFFEE_TOKEN_ABI, wallet);
  let tx;

  // ── Pre-flight: MINTER_ROLE check (only for AccessControl contracts) ────────
  await assertMinterRole(contract, wallet.address, tokenType, addr);

  // ── Attempt 1: CoffeeToken.sol 4-param mint ─────────────────────────────────
  try {
    const decimals  = await contract.decimals().catch(() => 18);
    const amountWei = ethers.parseUnits(String(amount), decimals);
    console.log(`[BlockchainService] Attempt 1: mint(address,uint256,string,string)`);
    tx = await withTimeout(contract.mint(treasuryAddress, amountWei, lotCode, requestId));
  } catch (err4) {
    if (!isSignatureMismatch(err4)) {
      const reason = extractRevertReason(err4);
      console.error(`[BlockchainService] Attempt 1 reverted: ${reason}`);
      throw new Error(reason);
    }

    // ── Attempt 2: legacy 2-param mint ──────────────────────────────────────────
    console.warn(`[BlockchainService] Attempt 1: selector not found — trying legacy 2-param mint`);
    contract = new ethers.Contract(addr, chain.LEGACY_TOKEN_ABI, wallet);
    await assertMinterRole(contract, wallet.address, tokenType, addr);

    try {
      const decimals  = await contract.decimals().catch(() => 18);
      const amountWei = ethers.parseUnits(String(amount), decimals);
      console.log(`[BlockchainService] Attempt 2: mint(address,uint256)`);
      tx = await withTimeout(contract.mint(treasuryAddress, amountWei));
    } catch (err2) {
      const reason = extractRevertReason(err2);
      console.error(`[BlockchainService] Attempt 2 failed: ${reason}`);
      throw new Error(
        `Blockchain mint thất bại: contract ${tokenType} (${addr}) không có hàm mint(). ` +
        `Cần deploy lại CoffeeToken.sol với địa chỉ mới. Chi tiết: ${reason}`
      );
    }
  }

  const receipt = await withTimeout(tx.wait());
  if (!receipt || receipt.status === 0) {
    throw new Error(`Mint transaction reverted on-chain. txHash: ${tx.hash}`);
  }

  console.log(`[BlockchainService] ✓ ${tokenType} mint OK (to Treasury) — txHash=${receipt.hash}  block=${receipt.blockNumber}`);
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ── Burn ───────────────────────────────────────────────────────────────────

/**
 * Burn ERC-20 tokens on-chain (called when redeem is approved).
 *
 * @param {object} params
 * @param {string} params.tokenType   'CR1' | 'CR2' | 'CR3'
 * @param {string} params.fromAddress Holder wallet address
 * @param {number} params.amount      Amount in kg (human units)
 * @param {string} params.lotCode     Coffee lot code
 * @param {string} params.redeemId   DB redeem_request.id as string
 *
 * @returns {{ txHash: string, blockNumber: number }}
 * @throws  on tx failure — caller must NOT update DB
 */
export async function burnToken({ tokenType, fromAddress, amount, lotCode = '', redeemId = '' }) {
  if (!chain.MINTER_PRIVATE_KEY) {
    console.warn('[BlockchainService] MINTER_PRIVATE_KEY is not configured. Mocking burn transaction.');
    const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return {
      txHash: mockTxHash,
      blockNumber: 1234567
    };
  }
  const wallet  = getMinterWallet();
  const addr    = getContractAddress(tokenType);
  const contract = new ethers.Contract(addr, chain.COFFEE_TOKEN_ABI, wallet);

  const decimals  = await contract.decimals().catch(() => 18);
  const amountWei = ethers.parseUnits(String(amount), decimals);

  const tx = await withTimeout(contract.burn(fromAddress, amountWei, lotCode, redeemId));
  const receipt = await withTimeout(tx.wait());

  if (!receipt || receipt.status === 0) {
    throw new Error(`Burn transaction reverted. txHash: ${tx.hash}`);
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Get on-chain balance for an address.
 *
 * @param {string} tokenType
 * @param {string} walletAddress
 * @returns {string} human-readable balance (e.g. "150.0")
 */
export async function getOnChainBalance(tokenType, walletAddress) {
  try {
    const provider = chain.getProvider();
    const addr     = getContractAddress(tokenType);
    const contract = new ethers.Contract(addr, chain.LEGACY_TOKEN_ABI, provider);

    const decimals = await contract.decimals().catch(() => 18);
    const raw      = await contract.balanceOf(walletAddress);
    return ethers.formatUnits(raw, decimals);
  } catch (err) {
    console.warn(`[BlockchainService] getOnChainBalance failed, returning "0.0": ${err.message}`);
    return "0.0";
  }
}

// ── Warehouse Document Registry ────────────────────────────────────────────

/**
 * Record a compliance document CID on-chain via WarehouseDocumentRegistry.
 *
 * Only called for compliance-critical document types:
 *   warehouse_license | inspection_report | warehouse_certificate
 *
 * Returns null (not throws) when the registry contract is not configured,
 * so callers can always skip on-chain recording gracefully.
 *
 * @param {object} params
 * @param {number} params.warehouseId   DB warehouse.id
 * @param {string} params.cid           IPFS CIDv0
 * @param {string} params.documentType  Document category
 * @param {string} params.documentName  Original file name
 * @param {number} params.dbRecordId    warehouse_documents.id
 * @returns {{ txHash: string, blockNumber: number } | null}
 */
export async function recordWarehouseDocument({ warehouseId, cid, documentType, documentName, dbRecordId }) {
  const registryAddr = chain.WAREHOUSE_DOC_REGISTRY_ADDRESS;
  if (!registryAddr || !/^0x[0-9a-fA-F]{40}$/.test(registryAddr)) {
    return null; // registry not deployed yet — skip silently
  }

  if (!chain.MINTER_PRIVATE_KEY) {
    console.warn('[BlockchainService] MINTER_PRIVATE_KEY is not configured. Mocking warehouse document recording.');
    const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return { txHash: mockTxHash, blockNumber: 1234567 };
  }
  const wallet   = getMinterWallet();
  const contract = new ethers.Contract(registryAddr, chain.WAREHOUSE_DOC_REGISTRY_ABI, wallet);

  const tx = await withTimeout(
    contract.addWarehouseDocument(
      BigInt(warehouseId),
      cid,
      documentType,
      documentName,
      BigInt(dbRecordId)
    )
  );

  const receipt = await withTimeout(tx.wait());
  if (!receipt || receipt.status === 0) {
    throw new Error(`WarehouseDocumentRegistry tx reverted. txHash: ${tx.hash}`);
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ── Transfer ───────────────────────────────────────────────────────────────

/**
 * Transfer ERC-20 tokens from CaRo Treasury wallet to user's wallet (on withdraw).
 *
 * @param {object} params
 * @param {string} params.tokenType   'CR1' | 'CR2' | 'CR3'
 * @param {string} params.toAddress   User MetaMask wallet address
 * @param {number} params.amount      Amount in kg (human units)
 *
 * @returns {{ txHash: string, blockNumber: number }}
 * @throws  on tx failure
 */
export async function transferToken({ tokenType, toAddress, amount }) {
  if (!chain.MINTER_PRIVATE_KEY) {
    console.warn('[BlockchainService] MINTER_PRIVATE_KEY is not configured. Mocking transfer transaction.');
    const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return {
      txHash: mockTxHash,
      blockNumber: 1234567
    };
  }
  const wallet  = getMinterWallet();
  const addr    = getContractAddress(tokenType);
  const contract = new ethers.Contract(addr, chain.TRANSFER_TOKEN_ABI, wallet);

  const decimals  = await contract.decimals().catch(() => 18);
  const amountWei = ethers.parseUnits(String(amount), decimals);

  console.log(`[BlockchainService] transferToken — ${tokenType} @ ${addr}`);
  console.log(`[BlockchainService]   from Treasury=${wallet.address}  to=${toAddress}  amount=${amount}`);

  const tx = await withTimeout(contract.transfer(toAddress, amountWei));
  const receipt = await withTimeout(tx.wait());

  if (!receipt || receipt.status === 0) {
    throw new Error(`Transfer transaction reverted on-chain. txHash: ${tx.hash}`);
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

export default { mintToken, burnToken, getOnChainBalance, recordWarehouseDocument, transferToken };
