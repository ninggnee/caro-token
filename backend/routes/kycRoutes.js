import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { submitKyc, processOcr, getKycImage } from "../controllers/kycController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Keep uploads in memory: a plaintext CCCD image must never be written to disk.
// The controller encrypts the buffer before it ever reaches the filesystem.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG/PNG images are allowed"));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB

// OCR calls a paid third-party API (FPT.AI) — cap it per account.
const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  message: { success: false, message: "Bạn đã gửi quá nhiều yêu cầu OCR, vui lòng thử lại sau" },
});

// verifyToken first so the limiter can key on the user id, and so an anonymous
// caller can no longer burn our OCR quota.
router.post("/ocr", verifyToken, ocrLimiter, upload.fields([{ name: "front" }, { name: "back" }]), processOcr);
router.post("/submit", verifyToken, upload.fields([{ name: "front" }, { name: "back" }]), submitKyc);

// Authenticated, authorised read of an encrypted CCCD image.
router.get("/image/:id/:side", verifyToken, getKycImage);

export default router;
