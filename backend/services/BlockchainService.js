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
    throw new Error('MINTER_PRIVATE_KEY not set in .env — blockchain operations disabled');
  }
  const provider = chain.getProvider();
  return new ethers.Wallet(chain.MINTER_PRIVATE_KEY, provider);
}

function getContractAddress(tokenType) {
  const addr = chain.CONTRACT_ADDRESSES[tokenType];
  if (!addr) throw new Error(`No contract address for token type: ${tokenType}`);
  return addr;
}

async function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Transaction timed out after 60 s')), TX_TIMEOUT_MS)
    ),
  ]);
}

// ── Mint ───────────────────────────────────────────────────────────────────

/**
 * Mint ERC-20 tokens on-chain.
 *
 * @param {object} params
 * @param {string} params.tokenType   'CR1' | 'CR2' | 'CR3'
 * @param {string} params.toAddress   Farmer wallet address
 * @param {number} params.amount      Amount in kg (human units, e.g. 100)
 * @param {string} params.lotCode     Coffee lot code for on-chain record
 * @param {string} params.requestId   DB token_request.id as string
 *
 * @returns {{ txHash: string, blockNumber: number }}
 * @throws  on tx failure — caller must NOT update DB
 */
export async function mintToken({ tokenType, toAddress, amount, lotCode = '', requestId = '' }) {
  const wallet  = getMinterWallet();
  const addr    = getContractAddress(tokenType);

  // Try new CoffeeToken ABI first, fall back to legacy if contract doesn't have lotCode param
  let contract = new ethers.Contract(addr, chain.COFFEE_TOKEN_ABI, wallet);
  let tx;

  try {
    const decimals    = await contract.decimals().catch(() => 18);
    const amountWei   = ethers.parseUnits(String(amount), decimals);
    tx = await withTimeout(contract.mint(toAddress, amountWei, lotCode, requestId));
  } catch (newErr) {
    // Fall back to legacy 2-param ABI when:
    // - client-side: too many arguments / INVALID_ARGUMENT
    // - on-chain: function selector not found → CALL_EXCEPTION (execution reverted)
    const isArgMismatch =
      newErr.message?.includes('too many arguments') ||
      newErr.code === 'INVALID_ARGUMENT' ||
      (newErr.code === 'CALL_EXCEPTION' && newErr.action === 'estimateGas');

    if (isArgMismatch) {
      contract = new ethers.Contract(addr, chain.LEGACY_TOKEN_ABI, wallet);
      const decimals  = await contract.decimals().catch(() => 18);
      const amountWei = ethers.parseUnits(String(amount), decimals);
      tx = await withTimeout(contract.mint(toAddress, amountWei));
    } else {
      throw newErr;
    }
  }

  const receipt = await withTimeout(tx.wait());
  if (!receipt || receipt.status === 0) {
    throw new Error(`Mint transaction reverted. txHash: ${tx.hash}`);
  }

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
  const provider = chain.getProvider();
  const addr     = getContractAddress(tokenType);
  const contract = new ethers.Contract(addr, chain.LEGACY_TOKEN_ABI, provider);

  const decimals = await contract.decimals().catch(() => 18);
  const raw      = await contract.balanceOf(walletAddress);
  return ethers.formatUnits(raw, decimals);
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

export default { mintToken, burnToken, getOnChainBalance, recordWarehouseDocument };
