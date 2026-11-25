import db from "../config/db.js";
import fs from "fs";
import path from "path";

// Authenticated access to uploaded files that used to be served publicly by
// express.static('/uploads'). Filenames in these directories are predictable
// (`dep-<timestamp>.jpg`, etc.), so public serving meant anyone could enumerate
// bank-transfer receipts and batch paperwork.
//
// GET /api/files/:category/:filename
//
// KYC is deliberately NOT handled here — it has its own encrypted pipeline in
// kycController.getKycImage.

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

// Each category says who, besides an admin, may read one of its files.
// `owners` returns the set of user ids allowed to see this specific file.
const CATEGORIES = {
  deposits: {
    dir: "deposits",
    // A deposit proof is a bank receipt — only its depositor and staff see it.
    staffRoles: ["admin"],
    owners: async (fileName) => {
      const [rows] = await db.execute(
        `SELECT user_id FROM deposit_requests WHERE proof_image LIKE ?`,
        [`%${fileName}`]
      );
      return rows.map(r => r.user_id);
    },
  },
  batches: {
    dir: "batches",
    staffRoles: ["admin", "custodian"],
    owners: async (fileName) => {
      const [rows] = await db.execute(
        `SELECT b.farmer_id AS user_id
           FROM batch_documents d
           JOIN asset_batches b ON b.batch_id = d.batch_id
          WHERE d.file_path LIKE ?`,
        [`%${fileName}`]
      );
      return rows.map(r => r.user_id);
    },
  },
  "warehouse-docs": {
    dir: "warehouse-docs",
    staffRoles: ["admin", "custodian"],
    owners: async (fileName) => {
      const [rows] = await db.execute(
        `SELECT uploaded_by AS user_id FROM warehouse_documents WHERE document_name LIKE ?`,
        [`%${fileName}`]
      );
      return rows.map(r => r.user_id);
    },
  },
};

export const getUploadedFile = async (req, res) => {
  try {
    const { category } = req.params;
    const config = CATEGORIES[category];
    if (!config) return res.status(404).json({ success: false, message: "Not found" });

    // basename() strips any ../ — a request can never escape the category dir.
    const fileName = path.basename(String(req.params.filename || ""));
    if (!fileName || fileName === "." || fileName === "..") {
      return res.status(400).json({ success: false, message: "Invalid file name" });
    }

    const isStaff = config.staffRoles.includes(req.user?.role);
    if (!isStaff) {
      let owners = [];
      try {
        owners = await config.owners(fileName);
      } catch (e) {
        console.error(`Ownership lookup failed for ${category}/${fileName}:`, e.message);
        return res.status(500).json({ success: false, message: "Server error" });
      }
      const isOwner = owners.some(id => String(id) === String(req.user?.id));
      if (!isOwner) return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const filePath = path.join(UPLOADS_ROOT, config.dir, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const mime = MIME_BY_EXT[path.extname(fileName).toLowerCase()] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Never let an uploaded file be interpreted as a page in our origin.
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Content-Disposition", "inline");
    return res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
