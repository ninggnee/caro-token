import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import * as C from '../controllers/custodianController.js';

const router = express.Router();

// ── Warehouses (admin) ──────────────────────────────────────────────────────
router.get   ('/warehouses',          verifyToken,                       C.listWarehouses);
router.post  ('/warehouses',          verifyToken, requireRole('admin'),  C.createWarehouse);

// ── Coffee Lots ─────────────────────────────────────────────────────────────
router.post  ('/lots',                verifyToken, requireRole('farmer'), C.createLot);
router.get   ('/lots/my',             verifyToken, requireRole('farmer'), C.listLotsForFarmer);
router.get   ('/lots',                verifyToken, requireRole('admin'),  C.listAllLots);
router.get   ('/lots/:id',            verifyToken,                        C.getLotDetail);

// ── Warehouse confirmation (admin / warehouse manager) ──────────────────────
router.post  ('/lots/:id/confirm-warehouse', verifyToken, requireRole('admin'), C.confirmWarehouseReceipt);

// ── Inspection (admin acts as inspector in this MVP) ────────────────────────
router.post  ('/lots/:id/inspect',    verifyToken, requireRole('admin'),  C.submitInspection);

// ── Lot splitting (admin) ───────────────────────────────────────────────────
router.post  ('/lots/:id/split',      verifyToken, requireRole('admin'),  C.splitLot);

// ── Warehouse Receipt (admin) ───────────────────────────────────────────────
router.post  ('/lots/:id/receipt',    verifyToken, requireRole('admin'),  C.issueWarehouseReceipt);

export default router;
