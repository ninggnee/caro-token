/**
 * Chẩn đoán trạng thái hợp đồng CaRo trên Sepolia.
 * Run:  node scripts/diagnose.js
 *
 * Kiểm tra:
 *   - Bytecode tồn tại
 *   - Thông tin ERC-20 (name, symbol, decimals, totalSupply)
 *   - Số dư ví minter trong từng contract (để quyết định mint vs transfer)
 *   - AccessControl: MINTER_ROLE
 *   - Các selector hàm mint / transfer
 *   - Khuyến nghị chiến lược cho BlockchainService
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const RPC_URL    = process.env.ETH_RPC_URL;
const MINTER_KEY = process.env.MINTER_PRIVATE_KEY;

// Addresses read from .env (frontend config.js has the same values after the CR3 fix)
const CONTRACTS = {
  CR1: process.env.CA_RO_CR1 || "0x1A28478Cf65eaE639c239aAA1D1c9ec0E6C0E4A2",
  CR2: process.env.CA_RO_CR2 || "0x14038Bb99EdE1113a15d233Df05E2B32134d2d28",
  CR3: process.env.CA_RO_CR3 || "0xDD4861C50D600B76F3fc0Ed5b247b8959b8A0d27",
};

// ethers v5 — utils prefix
const toUtf8Bytes = ethers.utils.toUtf8Bytes;
const keccak256   = ethers.utils.keccak256;
const formatUnits = ethers.utils.formatUnits;

function sel(sig) {
  return keccak256(toUtf8Bytes(sig)).slice(0, 10);
}

const SELECTORS = {
  "mint(address,uint256,string,string)": sel("mint(address,uint256,string,string)"),
  "mint(address,uint256)":               sel("mint(address,uint256)"),
  "transfer(address,uint256)":           sel("transfer(address,uint256)"),
  "burn(address,uint256,string,string)": sel("burn(address,uint256,string,string)"),
};

const READ_ABI = [
  "function name()        view returns (string)",
  "function symbol()      view returns (string)",
  "function decimals()    view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function owner()       view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function MINTER_ROLE() view returns (bytes32)",
  "function paused()      view returns (bool)",
];

async function probeSelector(provider, addr, selector, label) {
  try {
    await provider.call({ to: addr, data: selector + "0".repeat(128) });
    return `  [FOUND]  ${label}  (${selector})`;
  } catch (e) {
    const raw = e.data || (e.error && e.error.data);
    if (raw && raw !== "0x" && raw !== "0x0") {
      return `  [FOUND — reverts with data]  ${label}  (${selector})`;
    }
    return `  [NOT FOUND]  ${label}  (${selector})`;
  }
}

async function main() {
  if (!RPC_URL)    throw new Error("ETH_RPC_URL missing in backend/.env");
  if (!MINTER_KEY) throw new Error("MINTER_PRIVATE_KEY missing in backend/.env");

  const provider     = new ethers.providers.JsonRpcProvider(RPC_URL);
  const minterWallet = new ethers.Wallet(MINTER_KEY);
  const network      = await provider.getNetwork();

  const MINTER_ROLE_HASH = keccak256(toUtf8Bytes("MINTER_ROLE"));

  console.log("=".repeat(65));
  console.log("Network     :", network.name, `(chainId ${network.chainId})`);
  console.log("Minter addr :", minterWallet.address);
  console.log("=".repeat(65));

  // Addresses match between backend .env and frontend config.js
  console.log("\nAddress alignment check:");
  const frontendCR3 = "0xDD4861C50D600B76F3fc0Ed5b247b8959b8A0d27";
  console.log(`  frontend CR3 = ${frontendCR3}`);
  console.log(`  backend  CR3 = ${CONTRACTS.CR3}`);
  const cr3Match = frontendCR3.toLowerCase() === CONTRACTS.CR3.toLowerCase();
  console.log(`  Match?       : ${cr3Match ? "✓ YES" : "✗ NO — backend/.env needs fix"}`);

  const results = {};

  for (const [token, addr] of Object.entries(CONTRACTS)) {
    console.log(`\n${"─".repeat(65)}`);
    console.log(`[ ${token} ] ${addr}`);

    const code = await provider.getCode(addr);
    if (!code || code === "0x") {
      console.log("  ✗ NO BYTECODE — not deployed or wrong address/network");
      results[token] = { strategy: "NONE — no contract" };
      continue;
    }
    console.log(`  ✓ Bytecode present (${Math.floor((code.length - 2) / 2)} bytes)`);

    const c        = new ethers.Contract(addr, READ_ABI, provider);
    const name     = await c.name().catch(() => null);
    const symbol   = await c.symbol().catch(() => null);
    const decimals = await c.decimals().catch(() => null);
    const dec      = decimals ?? 18;
    const supply   = await c.totalSupply().catch(() => null);
    const owner    = await c.owner().catch(() => null);
    const paused   = await c.paused().catch(() => null);

    if (name)    console.log(`  name        : ${name}`);
    if (symbol)  console.log(`  symbol      : ${symbol}`);
    if (dec !== null) console.log(`  decimals    : ${dec}`);
    if (supply)  console.log(`  totalSupply : ${formatUnits(supply, dec)}`);
    if (owner)   console.log(`  owner       : ${owner}`);
    if (paused !== null) console.log(`  paused      : ${paused}`);

    // Minter wallet balance
    const minterBal = await c.balanceOf(minterWallet.address).catch(() => null);
    if (minterBal !== null) {
      const pct = supply && !supply.isZero()
        ? minterBal.mul(10000).div(supply).toNumber() / 100
        : "?";
      console.log(`  minterBal   : ${formatUnits(minterBal, dec)} (${pct}% of supply)`);
    }

    // AccessControl
    const hasMinter = await c.hasRole(MINTER_ROLE_HASH, minterWallet.address).catch(() => null);
    if (hasMinter !== null) {
      console.log(`  MINTER_ROLE : ${hasMinter ? "✓ GRANTED" : "✗ NOT GRANTED"}`);
    } else {
      console.log(`  MINTER_ROLE : N/A (no AccessControl)`);
    }

    // Ownership
    if (owner) {
      const isOwner = owner.toLowerCase() === minterWallet.address.toLowerCase();
      console.log(`  Is owner?   : ${isOwner ? "✓ YES" : `✗ NO — owner is ${owner}`}`);
    }

    // Function selectors — probe once, cache result strings
    console.log(`  Selectors:`);
    const probeResults = {};
    for (const [label, selector] of Object.entries(SELECTORS)) {
      const line = await probeSelector(provider, addr, selector, label);
      console.log(line);
      // "[FOUND]" or "[FOUND — reverts with data]" but NOT "[NOT FOUND]"
      probeResults[label] = line.includes("[FOUND]") && !line.includes("[NOT FOUND]");
    }

    const hasMint4 = probeResults["mint(address,uint256,string,string)"];
    const hasMint2 = probeResults["mint(address,uint256)"];
    const hasTxfer = probeResults["transfer(address,uint256)"];

    let strategy, note = "";
    if (hasMint4 && hasMinter === true) {
      strategy = "mint-4param (CoffeeToken.sol)";
    } else if (hasMint4 && hasMinter === false) {
      strategy = "mint-4param";
      note = " ← WILL FAIL: MINTER_ROLE not granted — run grantMinterRole.js";
    } else if (hasMint4 && hasMinter === null) {
      strategy = "mint-4param (no AccessControl check)";
    } else if (hasMint2) {
      strategy = "mint-2param (legacy with mint)";
    } else if (hasTxfer && minterBal !== null && minterBal.gt(0)) {
      strategy = `transfer() from minter wallet — bal=${formatUnits(minterBal, dec)} ${symbol ?? token}`;
    } else if (hasTxfer && minterBal !== null && minterBal.isZero()) {
      strategy = "transfer()";
      note = " ← WILL FAIL: minter wallet holds 0 tokens";
    } else {
      strategy = "NONE — no usable function found";
    }

    console.log(`\n  ★ Recommended strategy: ${strategy}${note}`);
    results[token] = { strategy, minterBal: minterBal ? formatUnits(minterBal, dec) : "N/A" };
  }

  console.log("\n" + "=".repeat(65));
  console.log("SUMMARY:");
  for (const [token, info] of Object.entries(results)) {
    console.log(`  ${token}: ${info.strategy}  (minterBal=${info.minterBal ?? "N/A"})`);
  }
  console.log("=".repeat(65));
  console.log("\nAction guide:");
  console.log("  mint-4param + MINTER_ROLE granted → nothing to do");
  console.log("  mint-4param + MINTER_ROLE NOT granted → run: npx hardhat run scripts/grantMinterRole.js --network sepolia");
  console.log("  transfer() with balance → BlockchainService will auto-use transfer fallback");
  console.log("  transfer() balance=0 → old supply is exhausted; must deploy new CoffeeToken.sol");
  console.log("  NONE → must deploy new CoffeeToken.sol");
}

main().catch(err => { console.error("[FATAL]", err.message); process.exitCode = 1; });
