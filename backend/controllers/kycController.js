import db from "../config/db.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encryptBuffer, decryptBuffer } from "../utils/fileCrypto.js";

const KYC_DIR = path.join(process.cwd(), "uploads", "kyc");

// Uploads are held in memory (multer memoryStorage) so a plaintext CCCD image
// never touches the disk — only the AES-256-GCM encrypted .enc file is written.

// Client-supplied mimetype cannot be trusted; check the real file signature.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const sniffImageType = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  return null;
};

const extFor = (mime) => (mime === "image/png" ? "png" : "jpg");

// Opaque filename — no user-supplied text, nothing guessable from the outside.
const makeStoredName = (mime) =>
  `${Date.now()}-${crypto.randomBytes(12).toString("hex")}.${extFor(mime)}.enc`;

const writeEncrypted = (buffer, mime) => {
  if (!fs.existsSync(KYC_DIR)) fs.mkdirSync(KYC_DIR, { recursive: true });
  const name = makeStoredName(mime);
  fs.writeFileSync(path.join(KYC_DIR, name), encryptBuffer(buffer), { mode: 0o600 });
  return name;
};

export const processOcr = async (req, res) => {
  const frontFile = req.files?.front?.[0];
  const backFile = req.files?.back?.[0];

  try {
    if (!frontFile || !backFile) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp đầy đủ cả mặt trước và mặt sau CCCD" });
    }

    const mime = sniffImageType(frontFile.buffer);
    if (!mime) {
      return res.status(400).json({ success: false, message: "Tệp tải lên không phải ảnh JPG/PNG hợp lệ" });
    }

    const apiKey = process.env.OCR_API_KEY;
    if (!apiKey) {
      console.error("OCR_API_KEY chưa được cấu hình trong .env");
      return res.status(503).json({ success: false, message: "Dịch vụ OCR chưa được cấu hình" });
    }

    const blob = new Blob([frontFile.buffer], { type: mime });
    const formData = new FormData();
    formData.append("image", blob, `front.${extFor(mime)}`);

    const fptAiUrl = "https://api.fpt.ai/vision/idr/vnm";

    const response = await fetch(fptAiUrl, {
      method: "POST",
      headers: {
        "api-key": apiKey
      },
      body: formData
    });

    if (!response.ok) {
      // Never echo the upstream body back to the client — it can leak key/quota details.
      const upstreamError = await response.text();
      console.error(`FPT.AI Vision API error ${response.status}: ${upstreamError}`);
      return res.status(502).json({
        success: false,
        message: "Không gọi được dịch vụ OCR, vui lòng thử lại sau"
      });
    }

    const result = await response.json();
    if (result.errorCode === 0 && result.data && result.data.length > 0) {
      res.json({
        success: true,
        data: result.data[0]
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.errorMessage || "OCR processing failed"
      });
    }
  } catch (err) {
    console.error("OCR Error:", err);
    res.status(500).json({ success: false, message: "Lỗi xử lý OCR" });
  }
};

export const submitKyc = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // files: front, back — both still in memory at this point
    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];

    if (!front || !back) {
      return res.status(400).json({ message: "Front and back images are required" });
    }

    const frontMime = sniffImageType(front.buffer);
    const backMime = sniffImageType(back.buffer);
    if (!frontMime || !backMime) {
      return res.status(400).json({ message: "Tệp tải lên không phải ảnh JPG/PNG hợp lệ" });
    }

    const frontPath = `/uploads/kyc/${writeEncrypted(front.buffer, frontMime)}`;
    const backPath = `/uploads/kyc/${writeEncrypted(back.buffer, backMime)}`;

    const { id_number, full_name } = req.body;

    // Insert into kyc_requests using schema-compatible columns
    try {
      await db.execute(
        `INSERT INTO kyc_requests (user_id, id_number, front_path, back_path, status, created_at) VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [userId, id_number || null, frontPath, backPath]
      );
    } catch (e) {
      // fallback to alternative column names
      await db.execute(
        `INSERT INTO kyc_requests (user_id, id_number, document_front, document_back, status, created_at) VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [userId, id_number || null, frontPath, backPath]
      );
    }

    // update users kyc_status and optionally full_name
    if (full_name) {
      await db.execute(`UPDATE users SET kyc_status = 'pending', full_name = ? WHERE id = ?`, [full_name, userId]);
    } else {
      await db.execute(`UPDATE users SET kyc_status = 'pending' WHERE id = ?`, [userId]);
    }

    res.json({ success: true, message: "KYC submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/kyc/image/:id/:side — the ONLY way to view a CCCD image.
// Requires a valid token, and only the owner of the request or an admin may read it.
// Replaces the old public `express.static('/uploads')` exposure.
export const getKycImage = async (req, res) => {
  try {
    const { id, side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "Invalid side" });
    }

    let row;
    try {
      [[row]] = await db.execute(
        `SELECT user_id, front_path, back_path FROM kyc_requests WHERE id = ?`,
        [id]
      );
    } catch (e) {
      [[row]] = await db.execute(
        `SELECT user_id, document_front AS front_path, document_back AS back_path FROM kyc_requests WHERE id = ?`,
        [id]
      );
    }
    if (!row) return res.status(404).json({ success: false, message: "Not found" });

    const isOwner = String(row.user_id) === String(req.user?.id);
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const stored = side === "front" ? row.front_path : row.back_path;
    if (!stored) return res.status(404).json({ success: false, message: "Not found" });

    // Only ever read the basename out of the KYC directory — no path traversal.
    const fileName = path.basename(String(stored));
    const filePath = path.join(KYC_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File missing" });
    }

    const raw = fs.readFileSync(filePath);
    let data;
    if (fileName.endsWith(".enc")) {
      try {
        data = decryptBuffer(raw);
      } catch (e) {
        console.error(`KYC decrypt failed for ${fileName}:`, e.message);
        return res.status(500).json({ success: false, message: "Không giải mã được hồ sơ" });
      }
    } else {
      // Legacy plaintext file uploaded before encryption was introduced.
      // Run `node scripts/encryptExistingKyc.js` to migrate these.
      data = raw;
    }

    const mime = sniffImageType(data) || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
