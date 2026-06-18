import express from 'express';
import { getSummary } from '../controllers/adminSummaryController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.get('/summary', verifyToken, requireRole('admin'), getSummary);
export default router;
