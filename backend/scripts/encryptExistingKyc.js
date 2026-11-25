// One-off migration: encrypt KYC documents that were stored in plaintext
// before AES-256-GCM at-rest encryption was introduced.
//
// Usage (from the backend/ directory):
//   node scripts/encryptExistingKyc.js --dry-run    # xem trước, không ghi gì
//   node scripts/encryptExistingKyc.js              # thực hiện
//
// For each plaintext file in uploads/kyc it writes a <name>.enc sibling,
// rewrites the matching kyc_requests row to point at it, then deletes the
// plaintext original. Files already ending in .enc are skipped, so the script
// is safe to re-run.

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const { encryptBuffer, isConfigured } = await import("../utils/fileCrypto.js");
const { default: db } = await import("../config/db.js");

const DRY_RUN = process.argv.includes("--dry-run");
const KYC_DIR = path.join(process.cwd(), "uploads", "kyc");

const run = async () => {
  if (!isConfigured()) {
    console.error("❌ KYC_ENCRYPTION_KEY chưa cấu hình trong .env. Tạo khoá: openssl rand -hex 32");
    process.exit(1);
  }
  if (!fs.existsSync(KYC_DIR)) {
    console.log("Không có thư mục uploads/kyc — không có gì để mã hoá.");
    return;
  }

  const files = fs.readdirSync(KYC_DIR).filter(f => !f.endsWith(".enc"));
  if (files.length === 0) {
    console.log("✅ Tất cả hồ sơ KYC đã ở dạng mã hoá.");
    return;
  }

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Tìm thấy ${files.length} tệp plaintext cần mã hoá.\n`);

  let encrypted = 0;
  let rowsUpdated = 0;

  for (const file of files) {
    const src = path.join(KYC_DIR, file);
    if (!fs.statSync(src).isFile()) continue;

    const encName = `${file}.enc`;
    const dest = path.join(KYC_DIR, encName);
    const oldDbPath = `/uploads/kyc/${file}`;
    const newDbPath = `/uploads/kyc/${encName}`;

    console.log(`  ${file}`);
    console.log(`    → ${encName}`);

    if (DRY_RUN) { encrypted++; continue; }

    fs.writeFileSync(dest, encryptBuffer(fs.readFileSync(src)), { mode: 0o600 });

    // Point any referencing rows at the encrypted file. The schema varies
    // between deployments, so try both column-name conventions. Match on the
    // trailing filename rather than the whole path: some rows were written
    // with a different encoding of the same (non-ASCII) name.
    let matched = 0;
    for (const [frontCol, backCol] of [["front_path", "back_path"], ["document_front", "document_back"]]) {
      try {
        for (const col of [frontCol, backCol]) {
          const [exact] = await db.execute(
            `UPDATE kyc_requests SET ${col} = ? WHERE ${col} = ?`, [newDbPath, oldDbPath]
          );
          if (exact.affectedRows > 0) { matched += exact.affectedRows; continue; }

          const [loose] = await db.execute(
            `UPDATE kyc_requests SET ${col} = ? WHERE ${col} LIKE ?`, [newDbPath, `%${file}`]
          );
          matched += loose.affectedRows;
        }
        break; // this convention exists — no need to try the other
      } catch (e) {
        if (!/Unknown column/i.test(e.message)) throw e;
      }
    }
    rowsUpdated += matched;
    if (matched === 0) {
      console.log("    (không có bản ghi DB nào tham chiếu — tệp mồ côi)");
    }

    fs.unlinkSync(src);
    encrypted++;
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Đã mã hoá ${encrypted} tệp, cập nhật ${rowsUpdated} bản ghi DB.`);
  if (DRY_RUN) console.log("Chạy lại không có --dry-run để thực hiện.");
};

run()
  .then(() => process.exit(0))
  .catch(err => { console.error("❌ Migration thất bại:", err); process.exit(1); });
