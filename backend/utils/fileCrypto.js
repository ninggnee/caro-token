import crypto from "crypto";

// AES-256-GCM at-rest encryption for KYC documents (ảnh CCCD).
//
// On-disk layout of a .enc file:
//   [ 12 bytes IV ][ 16 bytes auth tag ][ ciphertext ]
//
// The key comes from KYC_ENCRYPTION_KEY in .env — 64 hex chars (32 bytes).
// Generate one with:  openssl rand -hex 32
// It must NEVER be committed; losing it makes every stored document unreadable.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;

export const getKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.KYC_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "KYC_ENCRYPTION_KEY chưa được cấu hình trong .env — không thể mã hoá/giải mã hồ sơ KYC. " +
      "Tạo khoá bằng: openssl rand -hex 32"
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    throw new Error("KYC_ENCRYPTION_KEY phải là chuỗi hex 64 ký tự (32 byte).");
  }

  cachedKey = Buffer.from(raw.trim(), "hex");
  return cachedKey;
};

export const encryptBuffer = (plain) => {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
};

export const decryptBuffer = (blob) => {
  if (blob.length < IV_LEN + TAG_LEN) {
    throw new Error("Tệp mã hoá không hợp lệ (quá ngắn).");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const body = blob.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
};

// True when the configured key is usable — lets callers fail fast at startup
// instead of at the first upload.
export const isConfigured = () => {
  try { getKey(); return true; } catch { return false; }
};
