import path      from 'path';
import db          from '../config/db.js';
import { mintToken }    from '../services/BlockchainService.js';
import { uploadToIPFS } from '../services/IpfsService.js';
import { logAction, auditMeta } from '../services/AuditService.js';

// Document categories that are required before a batch can be submitted
const REQUIRED_DOC_TYPES = [
  'farmer_identity',
  'farm_ownership',
  'harvest_certificate',
  'warehouse_receipt',
  'quality_inspection',
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

    const { quantity, quality_grade, harvest_date, storage_location, estimated_value, batch_description } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Khối lượng (quantity) phải lớn hơn 0' });
    }
    if (!['CR1','CR2','CR3'].includes(quality_grade)) {
      return res.status(400).json({ message: 'quality_grade phải là CR1, CR2 hoặc CR3' });
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
         (batch_id, farmer_id, coffee_type, quantity, quality_grade,
          harvest_date, storage_location, estimated_value, batch_description, status)
       VALUES (?, ?, 'ROBUSTA', ?, ?, ?, ?, ?, ?, 'PENDING_MINT_APPROVAL')`,
      [batchId, farmerId, quantity, quality_grade,
       harvest_date || null, storage_location || null,
       estimated_value || null, batch_description || null]
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
      newData: { batchId, quantity, quality_grade, docCount: allFiles.length },
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

    // Attach documents
    const [docs] = await db.execute(
      `SELECT * FROM batch_documents WHERE batch_id = ? ORDER BY document_type, uploaded_at`,
      [batch.batch_id]
    );
    batch.documents = docs;

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
      `SELECT b.*, u.full_name as farmer_name, u.email as farmer_email
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

// ── Admin: approve & mint to internal wallet ──────────────────────────────
export const approveBatch = async (req, res) => {
  const adminId = req.user?.id;
  const { id }  = req.params;

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

    // ── Optional blockchain mint (to platform treasury) ───────────────────
    let txHash = null;
    let blockNumber = null;
    const treasuryAddr = process.env.PLATFORM_TREASURY_ADDRESS;
    const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(treasuryAddr || '');

    if (isValidAddr) {
      try {
        const result = await mintToken({
          tokenType: batch.quality_grade,
          toAddress:  treasuryAddr,
          amount:     Number(batch.quantity),
          lotCode:    batch.batch_id,
          requestId:  String(batch.id),
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
    }

    // ── Credit farmer's internal exchange wallet ───────────────────────────
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Upsert user_balances for this token type
      await conn.execute(
        `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
           balance           = balance           + VALUES(balance),
           available_balance = available_balance + VALUES(available_balance)`,
        [batch.farmer_id, batch.quality_grade, batch.quantity, batch.quantity]
      );

      // Update batch to MINTED
      await conn.execute(
        `UPDATE asset_batches
         SET status='MINTED', minted_amount=?, tx_hash=?, block_number=?, minted_at=NOW()
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
      newData: { txHash, blockNumber, mintedAmount: batch.quantity, tokenType: batch.quality_grade },
      ...auditMeta(req),
    });

    res.json({
      success:      true,
      message:      `Đã mint ${Number(batch.quantity).toLocaleString()} ${batch.quality_grade} vào ví nội bộ của farmer`,
      tx_hash:      txHash,
      block_number: blockNumber,
      minted_amount: batch.quantity,
      token_type:   batch.quality_grade,
    });
  } catch (err) {
    console.error('approveBatch error:', err);
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
