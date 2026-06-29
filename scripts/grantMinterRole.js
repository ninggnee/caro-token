/**
 * Grant MINTER_ROLE to the backend minter wallet on all 3 CaRo contracts.
 *
 * Run:  npx hardhat run scripts/grantMinterRole.js --network sepolia
 *
 * Signer priority:
 *   - If ADMIN_PRIVATE_KEY is set in backend/.env → uses it as admin (index 0)
 *   - Otherwise falls back to MINTER_PRIVATE_KEY → assumes it IS the deployer/admin
 */

import pkg from "hardhat";
const { ethers } = pkg;
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const ACCESS_CONTROL_ABI = [
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function MINTER_ROLE() view returns (bytes32)",
];

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "Không tìm thấy signer. Kiểm tra ADMIN_PRIVATE_KEY hoặc MINTER_PRIVATE_KEY trong backend/.env"
    );
  }

  // signers[0] = ADMIN_PRIVATE_KEY (nếu có) hoặc MINTER_PRIVATE_KEY
  // signers[1] = MINTER_PRIVATE_KEY (nếu cả hai đều có)
  const adminSigner  = signers[0];
  const minterWallet = signers.length > 1 ? signers[1] : signers[0];

  console.log("=".repeat(55));
  console.log("Admin signer  :", adminSigner.address);
  console.log("Minter wallet :", minterWallet.address);
  console.log("=".repeat(55));

  const CONTRACTS = {
    CR1: process.env.CA_RO_CR1 || "0x1A28478Cf65eaE639c239aAA1D1c9ec0E6C0E4A2",
    CR2: process.env.CA_RO_CR2 || "0x14038Bb99EdE1113a15d233Df05E2B32134d2d28",
    CR3: process.env.CA_RO_CR3 || "0xDD4861C50D600B76F3fc0Ed5b247b8959b8A0d27",
  };

  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));

  let allOk = true;

  for (const [token, addr] of Object.entries(CONTRACTS)) {
    console.log(`\n[${token}] ${addr}`);
    const contract = new ethers.Contract(addr, ACCESS_CONTROL_ABI, adminSigner);

    // 1. Verify admin has DEFAULT_ADMIN_ROLE
    try {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, adminSigner.address);
      if (!isAdmin) {
        console.error(
          `  ✗ Ví ${adminSigner.address} KHÔNG có DEFAULT_ADMIN_ROLE.\n` +
          `    Cần dùng ví đã deploy hợp đồng ban đầu làm ADMIN_PRIVATE_KEY.`
        );
        allOk = false;
        continue;
      }
      console.log("  ✓ Admin role xác nhận");
    } catch (e) {
      console.warn("  ⚠ Không thể kiểm tra DEFAULT_ADMIN_ROLE — hợp đồng có thể không dùng AccessControl");
      console.warn("    Chi tiết:", e.message);
    }

    // 2. Check if already has MINTER_ROLE
    const alreadyHasRole = await contract.hasRole(MINTER_ROLE, minterWallet.address).catch(() => null);
    if (alreadyHasRole === true) {
      console.log(`  ✓ Đã có MINTER_ROLE — không cần cấp lại`);
      continue;
    }

    // 3. Grant MINTER_ROLE
    try {
      console.log(`  → Đang cấp MINTER_ROLE cho ${minterWallet.address}...`);
      const tx = await contract.grantRole(MINTER_ROLE, minterWallet.address);
      console.log(`  ⏳ TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✓ MINTER_ROLE đã cấp thành công`);
    } catch (e) {
      console.error(`  ✗ grantRole thất bại: ${e.message}`);
      allOk = false;
    }
  }

  console.log("\n" + "=".repeat(55));
  if (allOk) {
    console.log("✅ Hoàn tất! Backend có thể mint token.");
  } else {
    console.log("⚠ Một số token thất bại. Xem lỗi phía trên.");
    console.log("→ Nếu ví hiện tại không phải deployer, chạy lại với:");
    console.log("  ADMIN_PRIVATE_KEY=<private_key_deployer> npx hardhat run scripts/grantMinterRole.js --network sepolia");
    console.log("\n→ Hoặc deploy lại hoàn toàn:");
    console.log("  npx hardhat run scripts/deployCoffeeToken.js --network sepolia");
  }
}

main().catch((err) => {
  console.error("\n[FATAL]", err.message);
  process.exitCode = 1;
});
