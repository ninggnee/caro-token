import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { listPending, reviewKyc } from "../controllers/kycAdminController.js";

const router = express.Router();

router.get("/pending", verifyToken, requireRole('admin'), listPending);
router.post("/:id/review", verifyToken, requireRole('admin'), reviewKyc);

export default router;
