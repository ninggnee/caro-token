/**
 * CustodianController — RWA full custody flow (Part 8 + 11).
 *
 * Full tokenisation flow:
 *   Farmer creates Coffee Lot
 *   → Warehouse confirms receipt
 *   → Inspector submits Inspection Report (GradeService determines grade)
 *   → If lot has multiple grades → split into sub-lots
 *   → Warehouse issues Warehouse Receipt
 *   → Admin reviews + approves → triggers BlockchainService.mintToken()
 */

import db           from '../config/db.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { determineGrade, validateLotSplit } from '../services/GradeService.js';

// ── Warehouses ──────────────────────────────────────────────────────────────

export const listWarehouses = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM warehouses WHERE status = 'active' ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createWarehouse = async (req, res) => {
  try {
    const { warehouse_code, name, address, capacity_kg, manager_name } = req.body;
    if (!warehouse_code || !name) {
      return res.status(400).json({ message: 'warehouse_code and name required' });
    }
    const [r] = await db.execute(
      `INSERT INTO warehouses (warehouse_code, name, address, capacity_kg, manager_name)
       VALUES (?, ?, ?, ?, ?)`,
      [warehouse_code, name, address || null, capacity_kg || 0, manager_name || null]
    );
    await logAction({ actorId: req.user.id, action: 'warehouse:create',
      entityType: 'warehouse', entityId: r.insertId, ...auditMeta(req) });
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Warehouse code already exists' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Coffee Lots ─────────────────────────────────────────────────────────────

export const createLot = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { warehouse_id, weight_kg, lot_code, parent_submission_id } = req.body;
    if (!weight_kg || Number(weight_kg) <= 0) {
      return res.status(400).json({ message: 'weight_kg must be > 0' });
    }
    // Generate lot_code if not provided
    const code = lot_code || `LOT-${Date.now()}-${farmerId}`;

    const [r] = await db.execute(
      `INSERT INTO coffee_lots
         (lot_code, farmer_id, warehouse_id, weight_kg, parent_submission_id, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [code, farmerId, warehouse_id || null, weight_kg, parent_submission_id || null]
    );
    await logAction({ actorId: farmerId, action: 'lot:create',
      entityType: 'coffee_lot', entityId: r.insertId, newData: { code, weight_kg }, ...auditMeta(req) });
    res.status(201).json({ success: true, id: r.insertId, lot_code: code });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Lot code already exists' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listLotsForFarmer = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT cl.*, w.name AS warehouse_name
       FROM coffee_lots cl
       LEFT JOIN warehouses w ON cl.warehouse_id = w.id
       WHERE cl.farmer_id = ?
       ORDER BY cl.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listAllLots = async (req, res) => {
  try {
    const { status } = req.query;
    const where  = status ? `WHERE cl.status = ?` : '';
    const params = status ? [status] : [];
    const [rows] = await db.execute(
      `SELECT cl.*, u.full_name AS farmer_name, u.email AS farmer_email,
              w.name AS warehouse_name
       FROM coffee_lots cl
       JOIN users u ON cl.farmer_id = u.id
       LEFT JOIN warehouses w ON cl.warehouse_id = w.id
       ${where}
       ORDER BY cl.created_at DESC LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Warehouse confirms receipt ───────────────────────────────────────────────

export const confirmWarehouseReceipt = async (req, res) => {
  try {
    const lotId  = req.params.id;
    const adminId = req.user.id;
    const [[lot]] = await db.execute(`SELECT * FROM coffee_lots WHERE id = ? LIMIT 1`, [lotId]);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (lot.warehouse_confirmed) return res.status(409).json({ message: 'Already confirmed' });

    await db.execute(
      `UPDATE coffee_lots
       SET warehouse_confirmed = 1, warehouse_confirmed_at = NOW(),
           warehouse_confirmed_by = ?, status = 'warehouse_confirmed'
       WHERE id = ?`,
      [adminId, lotId]
    );
    await logAction({ actorId: adminId, action: 'lot:warehouse_confirm',
      entityType: 'coffee_lot', entityId: Number(lotId), ...auditMeta(req) });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Inspection Report ────────────────────────────────────────────────────────

/**
 * Inspector submits inspection data.
 * GradeService auto-determines grade.
 * Returns grade result — frontend can then trigger lot-split if needed.
 */
export const submitInspection = async (req, res) => {
  try {
    const lotId       = req.params.id;
    const inspectorId = req.user.id;
    const {
      defect_count,
      moisture_pct,
      immature_beans   = 0,
      screen_size_ok   = true,
      has_primary_defect = false,
      sample_weight_g  = 300,
      notes,
    } = req.body;

    if (defect_count === undefined || moisture_pct === undefined) {
      return res.status(400).json({ message: 'defect_count and moisture_pct required' });
    }

    const [[lot]] = await db.execute(`SELECT * FROM coffee_lots WHERE id = ? LIMIT 1`, [lotId]);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (!lot.warehouse_confirmed) {
      return res.status(422).json({ message: 'Lot must be warehouse-confirmed before inspection' });
    }

    // Grade determination — SCAA / ICE EU Robusta
    const { grade, reasons } = determineGrade({
      defectCount:      Number(defect_count),
      moisturePct:      Number(moisture_pct),
      immatureBeans:    Number(immature_beans),
      screenSizeOk:     Boolean(screen_size_ok),
      hasPrimaryDefect: Boolean(has_primary_defect),
    });

    const passed = grade !== 'REJECTED';

    const [r] = await db.execute(
      `INSERT INTO inspection_reports
         (lot_id, inspector_id, defect_count, moisture_pct, immature_beans,
          screen_size_ok, sample_weight_g, grade_result, passed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lotId, inspectorId, defect_count, moisture_pct, immature_beans,
       screen_size_ok ? 1 : 0, sample_weight_g, grade, passed ? 1 : 0, notes || null]
    );

    // Update lot grade + status
    const newStatus = passed ? 'inspected' : 'rejected';
    await db.execute(
      `UPDATE coffee_lots SET grade = ?, inspection_passed = ?, inspection_passed_at = NOW(), status = ?
       WHERE id = ?`,
      [grade, passed ? 1 : 0, newStatus, lotId]
    );

    await logAction({ actorId: inspectorId, action: 'lot:inspection',
      entityType: 'coffee_lot', entityId: Number(lotId),
      newData: { grade, passed, reasons }, ...auditMeta(req) });

    res.json({ success: true, id: r.insertId, grade, passed, reasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Lot Splitting ────────────────────────────────────────────────────────────

/**
 * If a batch contains multiple grades, split into sub-lots.
 * POST /api/custodian/lots/:id/split
 * Body: { subLots: [{ weight_kg, grade, lot_code? }, ...] }
 *
 * Rules:
 * - Each sub-lot has exactly ONE grade.
 * - Sum of sub-lot weights ≤ parent weight.
 * - Parent lot marked 'rejected' (superseded by sub-lots).
 */
export const splitLot = async (req, res) => {
  try {
    const parentId = req.params.id;
    const { subLots } = req.body; // [{ weight_kg, grade, lot_code? }]
    if (!Array.isArray(subLots) || subLots.length < 2) {
      return res.status(400).json({ message: 'Provide at least 2 sub-lots to split' });
    }

    const [[parent]] = await db.execute(`SELECT * FROM coffee_lots WHERE id = ? LIMIT 1`, [parentId]);
    if (!parent) return res.status(404).json({ message: 'Parent lot not found' });

    const { ok, error } = validateLotSplit(parent.weight_kg, subLots);
    if (!ok) return res.status(422).json({ message: error });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const created = [];
      for (let i = 0; i < subLots.length; i++) {
        const sl = subLots[i];
        const suffix = String.fromCharCode(65 + i); // A, B, C …
        const code   = sl.lot_code || `${parent.lot_code}-${suffix}`;
        const [r] = await conn.execute(
          `INSERT INTO coffee_lots
             (lot_code, farmer_id, warehouse_id, weight_kg, grade,
              parent_submission_id, warehouse_confirmed, warehouse_confirmed_at,
              warehouse_confirmed_by, inspection_passed, inspection_passed_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            code, parent.farmer_id, parent.warehouse_id, sl.weight_kg, sl.grade,
            parentId,
            parent.warehouse_confirmed, parent.warehouse_confirmed_at, parent.warehouse_confirmed_by,
            sl.grade !== 'REJECTED' ? 1 : 0, new Date(),
            sl.grade !== 'REJECTED' ? 'inspected' : 'rejected',
          ]
        );
        created.push({ id: r.insertId, lot_code: code, grade: sl.grade, weight_kg: sl.weight_kg });
      }

      // Mark parent as split (use 'rejected' to prevent accidental minting)
      await conn.execute(
        `UPDATE coffee_lots SET status = 'rejected' WHERE id = ?`, [parentId]
      );

      await conn.commit();

      await logAction({ actorId: req.user.id, action: 'lot:split',
        entityType: 'coffee_lot', entityId: Number(parentId),
        newData: { subLots: created }, ...auditMeta(req) });

      res.json({ success: true, subLots: created });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Warehouse Receipt ────────────────────────────────────────────────────────

/**
 * Issue a Warehouse Receipt for a lot that passed inspection.
 * One receipt per lot (enforced by UNIQUE on lot_id).
 */
export const issueWarehouseReceipt = async (req, res) => {
  try {
    const lotId   = req.params.id;
    const issuerId = req.user.id;

    const [[lot]] = await db.execute(
      `SELECT * FROM coffee_lots WHERE id = ? LIMIT 1`, [lotId]
    );
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (!lot.inspection_passed) {
      return res.status(422).json({ message: 'Lot must pass inspection before receipt can be issued' });
    }
    if (!['CR1', 'CR2', 'CR3'].includes(lot.grade)) {
      return res.status(422).json({ message: `Grade ${lot.grade} cannot receive a warehouse receipt` });
    }

    // Check for duplicate receipt
    const [[existing]] = await db.execute(
      `SELECT id FROM warehouse_receipts WHERE lot_id = ? LIMIT 1`, [lotId]
    );
    if (existing) return res.status(409).json({ message: 'Receipt already issued for this lot' });

    const receiptCode = `WR-${Date.now()}-${lotId}`;
    const [r] = await db.execute(
      `INSERT INTO warehouse_receipts
         (receipt_code, lot_id, warehouse_id, grade, weight_kg, issued_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [receiptCode, lotId, lot.warehouse_id, lot.grade, lot.weight_kg, issuerId]
    );

    await db.execute(
      `UPDATE coffee_lots SET status = 'receipt_issued' WHERE id = ?`, [lotId]
    );

    await logAction({ actorId: issuerId, action: 'receipt:issue',
      entityType: 'warehouse_receipt', entityId: r.insertId,
      newData: { receiptCode, lotId, grade: lot.grade }, ...auditMeta(req) });

    res.status(201).json({ success: true, id: r.insertId, receipt_code: receiptCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getLotDetail = async (req, res) => {
  try {
    const [[lot]] = await db.execute(
      `SELECT cl.*, u.full_name AS farmer_name, w.name AS warehouse_name
       FROM coffee_lots cl
       JOIN users u ON cl.farmer_id = u.id
       LEFT JOIN warehouses w ON cl.warehouse_id = w.id
       WHERE cl.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!lot) return res.status(404).json({ message: 'Not found' });

    const [reports] = await db.execute(
      `SELECT * FROM inspection_reports WHERE lot_id = ? ORDER BY created_at DESC`, [lot.id]
    );
    const [[receipt]] = await db.execute(
      `SELECT * FROM warehouse_receipts WHERE lot_id = ? LIMIT 1`, [lot.id]
    );

    res.json({ success: true, data: { lot, reports, receipt: receipt || null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default {
  listWarehouses, createWarehouse,
  createLot, listLotsForFarmer, listAllLots,
  confirmWarehouseReceipt,
  submitInspection,
  splitLot,
  issueWarehouseReceipt,
  getLotDetail,
};
