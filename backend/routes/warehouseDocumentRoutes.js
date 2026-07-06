import express  from 'express';
import multer   from 'multer';
import path     from 'path';
import fs       from 'fs';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  getDocumentTypes,
} from '../controllers/warehouseDocumentController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

// ── Multer: disk storage for warehouse docs ────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'warehouse-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const stamp = Date.now();
    const safe  = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${stamp}-${safe}`);
  },
});

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: PDF, JPG, PNG`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Attach buffer after multer saves to disk (so IpfsService can read it)
function attachBuffer(req, _res, next) {
  if (!req.file) return next();
  try {
    if (req.file.path && !req.file.buffer) {
      req.file.buffer = fs.readFileSync(req.file.path);
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Multer error handler (file type / size errors)
function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 20 MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}

const router = express.Router();

// ── Public helper ─────────────────────────────────────────────────────────
router.get('/types', getDocumentTypes);

// ── Farmer + Admin: upload ────────────────────────────────────────────────
router.post(
  '/upload',
  verifyToken,
  requireRole('farmer', 'admin'),
  upload.single('file'),
  handleMulterError,
  attachBuffer,
  uploadDocument
);

// ── Farmer + Admin + Trader: list & view ────────────────────────────────────
// Trader access is scoped to their own L/C contracts inside the controller.
router.get('/',    verifyToken, requireRole('farmer', 'admin', 'trader'), listDocuments);
router.get('/:id', verifyToken, requireRole('farmer', 'admin', 'trader'), getDocument);

// ── Admin only: delete ─────────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireRole('admin'), deleteDocument);

export default router;
