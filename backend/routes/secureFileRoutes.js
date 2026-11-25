import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { getUploadedFile } from "../controllers/secureFileController.js";

const router = express.Router();

// Replaces the public express.static('/uploads') mount for these categories.
router.get("/:category/:filename", verifyToken, getUploadedFile);

export default router;
