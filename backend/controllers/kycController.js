import db from "../config/db.js";
import fs from "fs";
import path from "path";

export const submitKyc = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // files: front, back
    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];

    if (!front || !back) {
      return res.status(400).json({ message: "Front and back images are required" });
    }

    const uploadsDir = path.join(process.cwd(), "uploads", "kyc");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const frontPath = `/uploads/kyc/${front.filename}`;
    const backPath = `/uploads/kyc/${back.filename}`;

    // Insert into kyc_requests using schema-compatible columns
    try {
      await db.execute(`INSERT INTO kyc_requests (user_id, front_path, back_path, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`, [userId, frontPath, backPath]);
    } catch (e) {
      // fallback to alternative column names
      await db.execute(`INSERT INTO kyc_requests (user_id, document_front, document_back, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`, [userId, frontPath, backPath]);
    }

    // update users kyc_status
    await db.execute(`UPDATE users SET kyc_status = 'pending' WHERE id = ?`, [userId]);

    res.json({ success: true, message: "KYC submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
