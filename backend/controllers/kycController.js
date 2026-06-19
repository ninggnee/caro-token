import db from "../config/db.js";
import fs from "fs";
import path from "path";

export const processOcr = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append("image", blob, req.file.originalname);

    const fptAiUrl = "https://api.fpt.ai/vision/idr/vnm";
    const apiKey = process.env.OCR_API_KEY || "***REMOVED-OCR-KEY***";

    const response = await fetch(fptAiUrl, {
      method: "POST",
      headers: {
        "api-key": apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        message: `FPT.AI Vision API returned status ${response.status}: ${errorText}`
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
    res.status(500).json({ success: false, message: err.message || "OCR processing server error" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Failed to delete temp OCR file:", e);
      }
    }
  }
};

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
