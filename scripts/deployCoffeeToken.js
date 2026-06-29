/**
 * Deploy 3 fresh CoffeeToken.sol instances (CR1, CR2, CR3) to Sepolia.
 * The deployer wallet (MINTER_PRIVATE_KEY) is set as DEFAULT_ADMIN_ROLE + MINTER_ROLE automatically.
 *
 * Run:  npx hardhat run scripts/deployCoffeeToken.js --network sepolia
 *
 * After completion:
 *   - backend/.env          is updated with new CA_RO_CR1/2/3
 *   - frontend/src/config/config.js is updated with new CA_RO_CONTRACTS addresses
 *   - Restart backend server to pick up the new addresses.
 */

import pkg from "hardhat";
const { ethers } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log("=".repeat(55));
  console.log("Network  :", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer :", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Balance  :", ethers.utils.formatEther(balance), "ETH");
  console.log("=".repeat(55));

  if (balance.lt(ethers.utils.parseEther("0.02"))) {
    throw new Error(
      `Số dư không đủ để deploy (${ethers.utils.formatEther(balance)} ETH). Cần ít nhất 0.02 ETH.`
    );
  }

  const CoffeeToken = await ethers.getContractFactory("CoffeeToken");

  // Deploy CR1
  console.log("\n⏳ Deploying CR1 (CaRo Token 1)...");
  const cr1 = await CoffeeToken.deploy("CaRo Token 1", "CR1", deployer.address);
  await cr1.deployed();
  console.log(`✅ CR1 deployed: ${cr1.address}`);

  // Deploy CR2
  console.log("\n⏳ Deploying CR2 (CaRo Token 2)...");
  const cr2 = await CoffeeToken.deploy("CaRo Token 2", "CR2", deployer.address);
  await cr2.deployed();
  console.log(`✅ CR2 deployed: ${cr2.address}`);

  // Deploy CR3
  console.log("\n⏳ Deploying CR3 (CaRo Token 3)...");
  const cr3 = await CoffeeToken.deploy("CaRo Token 3", "CR3", deployer.address);
  await cr3.deployed();
  console.log(`✅ CR3 deployed: ${cr3.address}`);

  // ── Update backend/.env ────────────────────────────────────────────────────
  const envPath = path.join(ROOT, "backend/.env");
  let env = fs.readFileSync(envPath, "utf8");

  const setEnv = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    return regex.test(content)
      ? content.replace(regex, `${key}=${value}`)
      : content + `\n${key}=${value}`;
  };

  env = setEnv(env, "CA_RO_CR1", cr1.address);
  env = setEnv(env, "CA_RO_CR2", cr2.address);
  env = setEnv(env, "CA_RO_CR3", cr3.address);
  fs.writeFileSync(envPath, env);
  console.log("\n✅ Updated backend/.env");

  // ── Update frontend/src/config/config.js ──────────────────────────────────
  const frontendCfgPath = path.join(ROOT, "frontend/src/config/config.js");
  let cfg = fs.readFileSync(frontendCfgPath, "utf8");

  cfg = cfg
    .replace(/CR1:\s*"0x[0-9a-fA-F]+"/, `CR1: "${cr1.address}"`)
    .replace(/CR2:\s*"0x[0-9a-fA-F]+"/, `CR2: "${cr2.address}"`)
    .replace(/CR3:\s*"0x[0-9a-fA-F]+"/, `CR3: "${cr3.address}"`);
  fs.writeFileSync(frontendCfgPath, cfg);
  console.log("✅ Updated frontend/src/config/config.js");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(55));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(55));
  console.log(`CR1: ${cr1.address}`);
  console.log(`CR2: ${cr2.address}`);
  console.log(`CR3: ${cr3.address}`);
  console.log(`\nDeployer ${deployer.address} đã có:`);
  console.log("  - DEFAULT_ADMIN_ROLE ✓");
  console.log("  - MINTER_ROLE        ✓");
  console.log("  - PAUSER_ROLE        ✓");
  console.log("\n→ Khởi động lại backend server để nạp địa chỉ mới.");
  console.log("→ Verify trên Etherscan:");
  console.log(`  https://sepolia.etherscan.io/address/${cr1.address}`);
}

main().catch((err) => {
  console.error("\n[FATAL]", err.message);
  process.exitCode = 1;
});
