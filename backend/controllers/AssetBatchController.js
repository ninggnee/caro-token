import path      from 'path';
import db          from '../config/db.js';
import { mintToken }    from '../services/BlockchainService.js';
import { uploadToIPFS } from '../services/IpfsService.js';
import { logAction, auditMeta } from '../services/AuditService.js';

// Document categories that are required before a batch can be submitted
const REQUIRED_DOC_TYPES = [
  'harvest_certificate',
  'coffee_photos',
];

function genBatchId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `BATCH-${ymd}-${rand}`;
}

// ── Farmer: submit a new batch with documents ─────────────────────────────
export const createBatch = async (req, res) => {
  try {
    const farmerId = req.user?.id;
    if (!farmerId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      quantity, harvest_date, storage_location, batch_description,
      farm_coords, estimated_yield, crop_year, farming_method,
      production_diary, traceability_info
    } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Khối lượng (quantity) phải lớn hơn 0' });
    }

    // Validate all required document types are present
    const uploadedFiles = req.files || {};
    for (const docType of REQUIRED_DOC_TYPES) {
      const files = uploadedFiles[docType];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: `Thiếu tài liệu bắt buộc: ${docType}` });
      }
    }

    const batchId = genBatchId();

    // ── Persist batch record ──────────────────────────────────────────────
    await db.execute(
      `INSERT INTO asset_batches
         (batch_id, farmer_id, coffee_type, quantity,
          harvest_date, storage_location, batch_description, status,
          farm_coords, estimated_yield, crop_year, farming_method,
          production_diary, traceability_info, logistics_status,
          moisture_content, defect_rate, temperature_sensor, humidity_sensor)
       VALUES (?, ?, 'ROBUSTA', ?,
               ?, ?, ?, 'PENDING_MINT_APPROVAL',
               ?, ?, ?, ?,
               ?, ?, 'PENDING_PICKUP',
               13.5, 2.5, 26.5, 68.0)`,
      [
        batchId, farmerId, quantity,
        harvest_date || null, storage_location || null, batch_description || null,
        farm_coords || null, estimated_yield ? Number(estimated_yield) : null,
        crop_year || null, farming_method || null,
        production_diary || null, traceability_info || null
      ]
    );

    // ── Upload each file to IPFS and store document records ───────────────
    const allFiles = [];
    for (const [docType, files] of Object.entries(uploadedFiles)) {
      for (const file of files) {
        allFiles.push({ docType, file });
      }
    }

    await Promise.all(
      allFiles.map(async ({ docType, file }) => {
        let cid = null;
        try {
          cid = await uploadToIPFS(file.buffer, file.originalname, file.mimetype);
        } catch (ipfsErr) {
          console.warn(`IPFS upload skipped for ${file.originalname}: ${ipfsErr.message}`);
        }

        const relPath = file.path ? path.relative(process.cwd(), file.path) : null;

        await db.execute(
          `INSERT INTO batch_documents
             (batch_id, document_type, file_name, file_path, ipfs_cid)
           VALUES (?, ?, ?, ?, ?)`,
          [batchId, docType, file.originalname, relPath, cid]
        );
      })
    );

    await logAction({
      actorId: farmerId, action: 'batch:create', entityType: 'asset_batch', entityId: null,
      newData: { batchId, quantity, docCount: allFiles.length },
      ...auditMeta(req),
    });

    res.status(201).json({ success: true, message: 'Batch đã được gửi thành công', batch_id: batchId });
  } catch (err) {
    console.error('createBatch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Farmer: list own batches ──────────────────────────────────────────────
export const getFarmerBatches = async (req, res) => {
  try {
    const farmerId = req.user?.id;
    const { status } = req.query;
    const lim = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const pg  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const off = (pg - 1) * lim;

    let where = 'WHERE b.farmer_id = ?';
    const params = [farmerId];
    if (status) { where += ' AND b.status = ?'; params.push(status); }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_batches b ${where}`, params
    );

    const [rows] = await db.execute(
      `SELECT b.*, u.full_name as farmer_name, u.email as farmer_email
       FROM asset_batches b
       LEFT JOIN users u ON u.id = b.farmer_id
       ${where} ORDER BY b.created_at DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );

    // Attach document counts per batch
    if (rows.length > 0) {
      const batchIds = rows.map(r => r.batch_id);
      const [docCounts] = await db.execute(
        `SELECT batch_id, COUNT(*) as doc_count FROM batch_documents
         WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
         GROUP BY batch_id`,
        batchIds
      );
      const countMap = Object.fromEntries(docCounts.map(d => [d.batch_id, d.doc_count]));
      for (const r of rows) r.doc_count = countMap[r.batch_id] || 0;
    }

    res.json({ success: true, batches: rows, total, page: pg, pages: Math.ceil(total / lim) });
  } catch (err) {
    console.error('getFarmerBatches error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Shared: get single batch with documents ───────────────────────────────
export const getBatchById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role   = req.user?.role;
    const { id } = req.params;

    const [[batch]] = await db.execute(
      `SELECT b.*, u.full_name as farmer_name, u.email as farmer_email,
              a.full_name as reviewer_name
       FROM asset_batches b
       LEFT JOIN users u ON u.id = b.farmer_id
       LEFT JOIN users a ON a.id = b.reviewed_by
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    if (role === 'farmer' && batch.farmer_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Attach batch documents
    const [docs] = await db.execute(
      `SELECT * FROM batch_documents WHERE batch_id = ? ORDER BY document_type, uploaded_at`,
      [batch.batch_id]
    );
    batch.documents = docs;

    // Attach farmer's warehouse documents
    try {
      const [warehouseDocs] = await db.execute(
        `SELECT id, document_type, document_name, cid, file_size, mime_type, created_at
         FROM warehouse_documents
         WHERE uploaded_by = ? AND status = 'active'
         ORDER BY document_type, created_at DESC`,
        [batch.farmer_id]
      );
      batch.warehouse_documents = warehouseDocs;
    } catch (_) {
      batch.warehouse_documents = [];
    }

    res.json({ success: true, batch });
  } catch (err) {
    console.error('getBatchById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: list all batches ───────────────────────────────────────────────
export const getAllBatches = async (req, res) => {
  try {
    const { status, search } = req.query;
    const lim = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const pg  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const off = (pg - 1) * lim;

    const conditions = [];
    const params = [];

    if (status) { conditions.push('b.status = ?'); params.push(status); }
    if (search) {
      conditions.push('(b.batch_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total
       FROM asset_batches b LEFT JOIN users u ON u.id = b.farmer_id ${where}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT b.*, u.full_name as farmer_name, u.email as farmer_email, u.wallet_address as farmer_wallet
       FROM asset_batches b
       LEFT JOIN users u ON u.id = b.farmer_id
       ${where} ORDER BY b.created_at DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );

    // Attach document counts
    if (rows.length > 0) {
      const batchIds = rows.map(r => r.batch_id);
      const [docCounts] = await db.execute(
        `SELECT batch_id, COUNT(*) as doc_count FROM batch_documents
         WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
         GROUP BY batch_id`,
        batchIds
      );
      const countMap = Object.fromEntries(docCounts.map(d => [d.batch_id, d.doc_count]));
      for (const r of rows) r.doc_count = countMap[r.batch_id] || 0;
    }

    res.json({ success: true, batches: rows, total, page: pg, pages: Math.ceil(total / lim) });
  } catch (err) {
    console.error('getAllBatches error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: get documents for a batch ─────────────────────────────────────
export const getBatchDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const [[batch]] = await db.execute(
      `SELECT id, batch_id, farmer_id FROM asset_batches WHERE id = ? LIMIT 1`, [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const [docs] = await db.execute(
      `SELECT * FROM batch_documents WHERE batch_id = ? ORDER BY document_type, uploaded_at`,
      [batch.batch_id]
    );

    res.json({ success: true, documents: docs });
  } catch (err) {
    console.error('getBatchDocuments error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: set grade (A→CR1, B→CR2, C→CR3) ──────────────────────────────
export const updateGrade = async (req, res) => {
  const { id } = req.params;
  const { grade } = req.body; // 'A' | 'B' | 'C'

  const GRADE_MAP = { A: 'CR1', B: 'CR2', C: 'CR3' };
  if (!GRADE_MAP[grade]) {
    return res.status(400).json({ message: 'grade must be A, B, or C' });
  }

  try {
    const [[batch]] = await db.execute(
      `SELECT id, status FROM asset_batches WHERE id = ? LIMIT 1`, [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (!['PENDING_MINT_APPROVAL', 'APPROVED'].includes(batch.status)) {
      return res.status(422).json({ message: 'Grade can only be changed on pending batches' });
    }

    await db.execute(
      `UPDATE asset_batches SET quality_grade = ? WHERE id = ?`,
      [GRADE_MAP[grade], id]
    );

    res.json({ success: true, grade, quality_grade: GRADE_MAP[grade] });
  } catch (err) {
    console.error('updateGrade error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: approve & mint to internal wallet ──────────────────────────────
export const approveBatch = async (req, res) => {
  const adminId = req.user?.id;
  const { id }  = req.params;
  const { grade } = req.body; // optional: 'A' | 'B' | 'C'

  // If grade provided in approve call, apply it first
  const GRADE_MAP = { A: 'CR1', B: 'CR2', C: 'CR3' };

  try {
    const [[batch]] = await db.execute(
      `SELECT b.*, u.wallet_address as farmer_ext_wallet
       FROM asset_batches b
       LEFT JOIN users u ON u.id = b.farmer_id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.status !== 'PENDING_MINT_APPROVAL') {
      return res.status(422).json({ message: `Không thể duyệt batch đang ở trạng thái: ${batch.status}` });
    }

    // Apply grade if provided in the approve call
    if (grade && GRADE_MAP[grade]) {
      await db.execute(`UPDATE asset_batches SET quality_grade = ? WHERE id = ?`, [GRADE_MAP[grade], id]);
      batch.quality_grade = GRADE_MAP[grade];
    }

    // Verify required documents are uploaded
    const [docs] = await db.execute(
      `SELECT DISTINCT document_type FROM batch_documents WHERE batch_id = ?`,
      [batch.batch_id]
    );
    const uploadedTypes = new Set(docs.map(d => d.document_type));
    const missingDocs = REQUIRED_DOC_TYPES.filter(t => !uploadedTypes.has(t));
    if (missingDocs.length > 0) {
      return res.status(422).json({ message: `Batch thiếu tài liệu: ${missingDocs.join(', ')}` });
    }

    // Guard: prevent double-mint
    const [[existing]] = await db.execute(
      `SELECT id FROM asset_batches WHERE id = ? AND status = 'MINTED' LIMIT 1`, [id]
    );
    if (existing) return res.status(422).json({ message: 'Batch này đã được mint rồi' });

    // Mark as APPROVED first (will roll back if mint fails)
    await db.execute(
      `UPDATE asset_batches SET status='APPROVED', reviewed_by=?, approved_at=NOW() WHERE id=?`,
      [adminId, id]
    );

    // ── Mint directly to farmer's blockchain wallet ───────────────────────
    const farmerWallet = batch.farmer_ext_wallet;
    if (!farmerWallet || !/^0x[0-9a-fA-F]{40}$/.test(farmerWallet)) {
      await db.execute(
        `UPDATE asset_batches SET status='PENDING_MINT_APPROVAL', reviewed_by=NULL, approved_at=NULL WHERE id=?`,
        [id]
      );
      return res.status(422).json({ success: false, message: 'Farmer chưa có ví blockchain hợp lệ. Vui lòng yêu cầu farmer cập nhật wallet address trước khi duyệt.' });
    }

    // Determine token type: use quality_grade if set, otherwise default to CR1
    const tokenType = batch.quality_grade || 'CR1';

    let txHash = null;
    let blockNumber = null;

    try {
      const result = await mintToken({
        tokenType,
        toAddress: farmerWallet,
        amount:    Number(batch.quantity),
        lotCode:   batch.batch_id,
        requestId: String(batch.id),
      });
      txHash      = result.txHash;
      blockNumber = result.blockNumber;
    } catch (chainErr) {
      // Rollback batch status
      await db.execute(
        `UPDATE asset_batches
         SET status='PENDING_MINT_APPROVAL', reviewed_by=NULL, approved_at=NULL
         WHERE id=?`,
        [id]
      );
      return res.status(500).json({ success: false, message: `Blockchain mint thất bại: ${chainErr.message}` });
    }

    // ── Credit farmer's internal exchange wallet ───────────────────────────
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Upsert user_balances for this token type (internal exchange record)
      await conn.execute(
        `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
           balance           = balance           + VALUES(balance),
           available_balance = available_balance + VALUES(available_balance)`,
        [batch.farmer_id, tokenType, batch.quantity, batch.quantity]
      );

      // Update batch to MINTED
      await conn.execute(
        `UPDATE asset_batches
         SET status='MINTED', minted_amount=?, tx_hash=?, block_number=?, logistics_status='MINTED', minted_at=NOW()
         WHERE id=?`,
        [batch.quantity, txHash, blockNumber, id]
      );

      await conn.commit();
    } catch (dbErr) {
      await conn.rollback();
      // If we already did a blockchain mint above, log it as a critical discrepancy
      if (txHash) {
        console.error(`CRITICAL: Blockchain mint succeeded (${txHash}) but DB update failed for batch ${batch.batch_id}. Manual reconciliation required.`);
      }
      throw dbErr;
    } finally {
      conn.release();
    }

    await logAction({
      actorId: adminId, action: 'batch:mint', entityType: 'asset_batch', entityId: batch.id,
      newData: { txHash, blockNumber, mintedAmount: batch.quantity, tokenType, farmerWallet },
      ...auditMeta(req),
    });

    res.json({
      success:       true,
      message:       `Đã mint ${Number(batch.quantity).toLocaleString()} ${tokenType} trực tiếp vào ví của farmer (${farmerWallet})`,
      tx_hash:       txHash,
      block_number:  blockNumber,
      minted_amount: batch.quantity,
      token_type:    tokenType,
      farmer_wallet: farmerWallet,
    });
  } catch (err) {
    console.error('approveBatch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Farmer: supplement rejected batch with additional documents ───────────
export const supplementBatch = async (req, res) => {
  try {
    const farmerId = req.user?.id;
    const { id }  = req.params;

    const [[batch]] = await db.execute(
      `SELECT id, batch_id, farmer_id, status FROM asset_batches WHERE id = ? LIMIT 1`, [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.farmer_id !== farmerId) return res.status(403).json({ message: 'Forbidden' });
    if (batch.status !== 'REJECTED') {
      return res.status(422).json({ message: 'Chỉ có thể bổ sung tài liệu cho batch bị từ chối' });
    }

    const uploadedFiles = req.files || {};
    const allFiles = [];
    for (const [docType, files] of Object.entries(uploadedFiles)) {
      for (const file of files) allFiles.push({ docType, file });
    }
    if (allFiles.length === 0) {
      return res.status(400).json({ message: 'Cần tải lên ít nhất một tài liệu' });
    }

    // Upload each supplementary file to IPFS and insert batch_documents records
    await Promise.all(
      allFiles.map(async ({ docType, file }) => {
        let cid = null;
        try {
          cid = await uploadToIPFS(file.buffer, file.originalname, file.mimetype);
        } catch (ipfsErr) {
          console.warn(`IPFS upload skipped for ${file.originalname}: ${ipfsErr.message}`);
        }
        const relPath = file.path ? path.relative(process.cwd(), file.path) : null;
        await db.execute(
          `INSERT INTO batch_documents (batch_id, document_type, file_name, file_path, ipfs_cid)
           VALUES (?, ?, ?, ?, ?)`,
          [batch.batch_id, docType, file.originalname, relPath, cid]
        );
      })
    );

    // Resubmit for review: clear rejection fields, reset status to pending
    await db.execute(
      `UPDATE asset_batches
       SET status='PENDING_MINT_APPROVAL', rejection_reason=NULL, reviewed_by=NULL, rejected_at=NULL
       WHERE id=?`,
      [id]
    );

    await logAction({
      actorId: farmerId, action: 'batch:supplement', entityType: 'asset_batch', entityId: batch.id,
      newData: { docCount: allFiles.length },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Đã bổ sung tài liệu và gửi lại để xét duyệt' });
  } catch (err) {
    console.error('supplementBatch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: reject batch ───────────────────────────────────────────────────
export const rejectBatch = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { id }  = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: 'Lý do từ chối là bắt buộc' });
    }

    const [[batch]] = await db.execute(
      `SELECT id, status FROM asset_batches WHERE id = ? LIMIT 1`, [id]
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.status !== 'PENDING_MINT_APPROVAL') {
      return res.status(422).json({ message: `Không thể từ chối batch đang ở trạng thái: ${batch.status}` });
    }

    await db.execute(
      `UPDATE asset_batches
       SET status='REJECTED', rejection_reason=?, reviewed_by=?, rejected_at=NOW()
       WHERE id=?`,
      [reason.trim(), adminId, id]
    );

    await logAction({
      actorId: adminId, action: 'batch:reject', entityType: 'asset_batch', entityId: batch.id,
      newData: { reason: reason.trim() },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Batch đã bị từ chối' });
  } catch (err) {
    console.error('rejectBatch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Trader: list all MINTED batches (for Redeem Goods page) ──────────────────
export const getAvailableBatchesForTrader = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT batch_id, coffee_type, quality_grade, quantity,
              COALESCE(minted_amount, quantity) AS minted_amount,
              storage_location, minted_at
       FROM asset_batches
       WHERE status = 'MINTED'
       ORDER BY minted_at DESC
       LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAvailableBatchesForTrader error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const simulateLogistics = async (req, res) => {
  try {
    const { id } = req.params;
    const { next_status } = req.body;

    const [[batch]] = await db.execute(
      `SELECT * FROM asset_batches WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!batch) {
      return res.status(404).json({ message: 'Không tìm thấy lô hàng' });
    }

    let updates = [];
    let params = [];

    if (next_status) {
      updates.push('logistics_status = ?');
      params.push(next_status);

      // Simulate mass balance loss on STANDARDIZED
      if (next_status === 'STANDARDIZED') {
        const originalQty = Number(batch.quantity);
        const netQty = Number((originalQty * 0.98).toFixed(2)); // 2% cleaning loss
        updates.push('quantity = ?');
        params.push(netQty);
        updates.push('batch_description = ?');
        params.push(`${batch.batch_description || ''}\n[Mass Balance] Đã sấy lọc & trừ 2% hao hụt. Khối lượng ròng sau chuẩn hóa: ${netQty} kg.`);
      }

      // Simulate Oracle inspection results on INSPECTED
      if (next_status === 'INSPECTED') {
        updates.push('moisture_content = ?');
        params.push(11.8); // 11.8% moisture (passed <12.5% standard)
        updates.push('defect_rate = ?');
        params.push(1.2); // 1.2% defect rate (excellent)
        updates.push('temperature_sensor = ?');
        params.push(22.5); // 22.5°C
        updates.push('humidity_sensor = ?');
        params.push(58.2); // 58.2% humidity
      }
    }

    if (updates.length > 0) {
      params.push(id);
      await db.execute(
        `UPDATE asset_batches SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    res.json({ success: true, message: `Chuyển trạng thái sang ${next_status} thành công` });
  } catch (err) {
    console.error('simulateLogistics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
