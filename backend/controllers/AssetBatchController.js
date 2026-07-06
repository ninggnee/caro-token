import path      from 'path';
import db          from '../config/db.js';
import { mintToken }    from '../services/BlockchainService.js';
import { uploadToIPFS } from '../services/IpfsService.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { classifyDocumentType, countVisibleDocuments, effectiveLogisticsStage } from '../services/DocumentTypeService.js';

// Decorate a raw document row with a display label/group/requiredStage so
// consumers never need their own hardcoded document_type → label/group table.
// requiredStage is the earliest batch.logistics_status at which this document's
// group is allowed to be shown to the farmer (see DocumentTypeService).
function decorateDoc(doc) {
  const { label, group, requiredStage } = classifyDocumentType(doc.document_type);
  return { ...doc, label, group, requiredStage, status: doc.status || 'uploaded' };
}

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

    // Attach document counts per batch — doc_count must reflect exactly what
    // the farmer sees in the "Giấy tờ" detail panel, i.e. only documents whose
    // group has reached its required logistics stage for that batch (same
    // countVisibleDocuments() the detail panel's gating is built from), not a
    // raw row count.
    if (rows.length > 0) {
      const batchIds = rows.map(r => r.batch_id);
      const [batchDocRows] = await db.execute(
        `SELECT batch_id, document_type FROM batch_documents
         WHERE batch_id IN (${batchIds.map(() => '?').join(',')})`,
        batchIds
      );
      const [whDocRows] = await db.execute(
        `SELECT b.batch_id, w.document_type
         FROM asset_batches b
         JOIN warehouse_documents w ON w.uploaded_by = b.farmer_id
           AND w.status = 'active'
           AND w.document_name LIKE CONCAT('%', b.batch_id COLLATE utf8mb4_unicode_ci, '%')
         WHERE b.batch_id IN (${batchIds.map(() => '?').join(',')})`,
        batchIds
      );
      const typesByBatch = {};
      for (const d of [...batchDocRows, ...whDocRows]) {
        (typesByBatch[d.batch_id] ||= []).push(d.document_type);
      }
      for (const r of rows) {
        r.effective_logistics_stage = effectiveLogisticsStage(r.status, r.logistics_status);
        r.doc_count = countVisibleDocuments(typesByBatch[r.batch_id] || [], r.effective_logistics_stage);
      }
    }

    res.json({ success: true, batches: rows, total, page: pg, pages: Math.ceil(total / lim) });
  } catch (err) {
    console.error('getFarmerBatches error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Farmer: list all batches with full document arrays (for Giấy tờ page) ──
export const getFarmerBatchesWithDocs = async (req, res) => {
  try {
    const farmerId = req.user?.id;

    // Fetch all batches (no status filter, newest first)
    const [batches] = await db.execute(
      `SELECT b.id, b.batch_id, b.quantity, b.coffee_type, b.status,
              b.logistics_status, b.created_at, b.minted_amount, b.tx_hash
       FROM asset_batches b
       WHERE b.farmer_id = ?
       ORDER BY b.created_at DESC`,
      [farmerId]
    );

    if (batches.length === 0) {
      return res.json({ success: true, batches: [] });
    }

    const batchIds   = batches.map(b => b.batch_id);
    const batchIdSet = batchIds.map(() => '?').join(',');

    // Fetch all batch_documents in one query
    const [batchDocs] = await db.execute(
      `SELECT batch_id, id, document_type, file_name, ipfs_cid as cid,
              uploaded_at as created_at, file_path
       FROM batch_documents
       WHERE batch_id IN (${batchIdSet})
       ORDER BY document_type, uploaded_at`,
      batchIds
    );

    // Fetch all warehouse_documents linked by document_name containing batch_id
    const [whDocs] = await db.execute(
      `SELECT wd.id, wd.document_type, wd.document_name, wd.cid,
              wd.file_size, wd.mime_type, wd.created_at,
              b.batch_id
       FROM warehouse_documents wd
       JOIN asset_batches b ON b.farmer_id = wd.uploaded_by
         AND wd.document_name LIKE CONCAT('%', b.batch_id COLLATE utf8mb4_unicode_ci, '%')
       WHERE b.farmer_id = ? AND wd.status = 'active'
         AND b.batch_id IN (${batchIdSet})
       ORDER BY wd.document_type, wd.created_at DESC`,
      [farmerId, ...batchIds]
    );

    // Group documents by batch_id
    const batchDocsMap = {};
    const whDocsMap    = {};
    for (const d of batchDocs) {
      if (!batchDocsMap[d.batch_id]) batchDocsMap[d.batch_id] = [];
      batchDocsMap[d.batch_id].push(d);
    }
    for (const d of whDocs) {
      if (!whDocsMap[d.batch_id]) whDocsMap[d.batch_id] = [];
      whDocsMap[d.batch_id].push(d);
    }

    // Attach to each batch
    for (const b of batches) {
      b.documents           = batchDocsMap[b.batch_id]  || [];
      b.warehouse_documents = whDocsMap[b.batch_id]     || [];
      b.doc_count           = b.documents.length + b.warehouse_documents.length;
    }

    res.json({ success: true, batches });
  } catch (err) {
    console.error('getFarmerBatchesWithDocs error:', err);
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
              u.wallet_address as farmer_wallet,
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

    // Compensates for legacy rows whose logistics_status was never backfilled
    // when that column was introduced — see DocumentTypeService for details.
    batch.effective_logistics_stage = effectiveLogisticsStage(batch.status, batch.logistics_status);

    // Attach batch documents
    const [docs] = await db.execute(
      `SELECT * FROM batch_documents WHERE batch_id = ? ORDER BY document_type, uploaded_at`,
      [batch.batch_id]
    );
    batch.documents = docs.map(decorateDoc);

    // Attach farmer's warehouse documents
    try {
      const [warehouseDocs] = await db.execute(
        `SELECT id, document_type, document_name, cid, file_size, mime_type, status, created_at
         FROM warehouse_documents
         WHERE uploaded_by = ? AND status = 'active' AND document_name LIKE CONCAT('%', ? COLLATE utf8mb4_unicode_ci, '%')
         ORDER BY document_type, created_at DESC`,
        [batch.farmer_id, batch.batch_id]
      );
      batch.warehouse_documents = warehouseDocs.map(decorateDoc);
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
      const [whCounts] = await db.execute(
        `SELECT b.batch_id, COUNT(w.id) as wh_count
         FROM asset_batches b
         LEFT JOIN warehouse_documents w ON w.uploaded_by = b.farmer_id 
           AND w.status = 'active'
           AND w.document_name LIKE CONCAT('%', b.batch_id COLLATE utf8mb4_unicode_ci, '%')
         WHERE b.batch_id IN (${batchIds.map(() => '?').join(',')})
         GROUP BY b.batch_id`,
        batchIds
      );
      const countMap = Object.fromEntries(docCounts.map(d => [d.batch_id, d.doc_count]));
      const whMap = Object.fromEntries(whCounts.map(d => [d.batch_id, d.wh_count]));
      for (const r of rows) {
        r.doc_count = (countMap[r.batch_id] || 0) + (whMap[r.batch_id] || 0);
      }
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

    let whMapped = [];
    try {
      const [warehouseDocs] = await db.execute(
        `SELECT id, document_type, document_name, cid, file_size, mime_type, status, created_at
         FROM warehouse_documents
         WHERE uploaded_by = ? AND status = 'active' AND document_name LIKE CONCAT('%', ? COLLATE utf8mb4_unicode_ci, '%')
         ORDER BY document_type, created_at DESC`,
        [batch.farmer_id, batch.batch_id]
      );
      whMapped = warehouseDocs.map(d => ({
        id: `wh-${d.id}`,
        batch_id: batch.batch_id,
        document_type: d.document_type,
        file_name: d.document_name,
        file_path: null,
        ipfs_cid: d.cid,
        status: d.status,
        uploaded_at: d.created_at
      }));
    } catch (_) {}

    res.json({ success: true, documents: [...docs, ...whMapped].map(decorateDoc) });
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

    // Mint amount = standardized weight after processing loss (net_quantity),
    // NOT the raw pre-processing weight. defect_rate from inspection only
    // determines tokenType/grade above — it never reduces the minted amount.
    const mintQty = batch.net_quantity != null ? Number(batch.net_quantity) : Number(batch.quantity);

    let txHash = null;
    let blockNumber = null;

    try {
      const result = await mintToken({
        tokenType,
        toAddress: farmerWallet,
        amount:    mintQty,
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
        [batch.farmer_id, tokenType, mintQty, mintQty]
      );

      // Update batch to MINTED
      await conn.execute(
        `UPDATE asset_batches
         SET status='MINTED', minted_amount=?, tx_hash=?, block_number=?, logistics_status='MINTED', minted_at=NOW()
         WHERE id=?`,
        [mintQty, txHash, blockNumber, id]
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
      newData: { txHash, blockNumber, mintedAmount: mintQty, tokenType, farmerWallet },
      ...auditMeta(req),
    });

    res.json({
      success:       true,
      message:       `Đã mint ${mintQty.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${tokenType} trực tiếp vào ví của farmer (${farmerWallet})`,
      tx_hash:       txHash,
      block_number:  blockNumber,
      minted_amount: mintQty,
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

      // Simulate mass balance loss on STANDARDIZED.
      // NOTE: quantity (original farmer-submitted weight) is NEVER overwritten.
      // The net weight after processing loss is stored in net_quantity.
      if (next_status === 'STANDARDIZED') {
        const originalQty = Number(batch.quantity);
        const lossPct = Number((Math.random() * 2).toFixed(2)); // random 0-2% cleaning/drying loss
        const netQty = Number((originalQty * (1 - lossPct / 100)).toFixed(2));
        updates.push('net_quantity = ?');
        params.push(netQty);
        updates.push('processing_loss_pct = ?');
        params.push(lossPct);
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
