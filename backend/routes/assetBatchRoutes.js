import express  from 'express';
import multer   from 'multer';
import path     from 'path';
import fs       from 'fs';
import {
  createBatch,
  getFarmerBatches,
  getBatchById,
  getBatchDocuments,
  getAllBatches,
  approveBatch,
  rejectBatch,
  updateGrade,
  supplementBatch,
  getAvailableBatchesForTrader,
} from '../controllers/AssetBatchController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

// ── Multer: store files in uploads/batches/, keep in memory buffer too ────
const uploadDir = path.join(process.cwd(), 'uploads', 'batches');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const stamp = Date.now();
    const safe  = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${stamp}-${safe}`);
  },
});

// Allow common document and image MIME types
const fileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
});

// Keep file buffer for IPFS upload (re-read from disk after multer saves)
// We use diskStorage but also need the buffer — attach it after save.
const batchDocFields = upload.fields([
  { name: 'harvest_certificate',maxCount: 3 },
  { name: 'quality_inspection', maxCount: 3 },
  { name: 'coffee_photos',      maxCount: 10 },
  { name: 'additional_docs',    maxCount: 10 },
]);

// Middleware: attach buffer from saved file path so IpfsService can use it
function attachBuffers(req, _res, next) {
  if (!req.files) return next();
  try {
    for (const files of Object.values(req.files)) {
      for (const f of files) {
        if (f.path && !f.buffer) {
          f.buffer = fs.readFileSync(f.path);
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

const router = express.Router();

// ── Farmer ────────────────────────────────────────────────────────────────
router.post('/',
  verifyToken, requireRole('farmer'),
  batchDocFields, attachBuffers,
  createBatch
);
router.get('/mine', verifyToken, requireRole('farmer'), getFarmerBatches);
router.post('/:id/supplement',
  verifyToken, requireRole('farmer'),
  batchDocFields, attachBuffers,
  supplementBatch
);

// ── Admin ─────────────────────────────────────────────────────────────────
router.get('/',               verifyToken, requireRole('admin'), getAllBatches);
router.get('/:id/documents',  verifyToken, requireRole('admin'), getBatchDocuments);
router.put('/:id/grade',      verifyToken, requireRole('admin'), updateGrade);
router.post('/:id/approve',   verifyToken, requireRole('admin'), approveBatch);
router.post('/:id/reject',    verifyToken, requireRole('admin'), rejectBatch);

// ── Trader: list available (MINTED) batches for redeem page ───────────────────
router.get('/available', verifyToken, getAvailableBatchesForTrader);

// ── Shared (farmer own or admin) ──────────────────────────────────────────
router.get('/:id', verifyToken, getBatchById);

export default router;
