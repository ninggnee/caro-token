import express from 'express';
import { listLogs } from '../controllers/adminLogsController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', verifyToken, requireRole('admin'), listLogs);

export default router;
