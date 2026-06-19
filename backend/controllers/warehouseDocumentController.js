/**
 * warehouseDocumentController — warehouse document IPFS storage.
 *
 * Flow:
 *   Client uploads file (multipart)
 *   → Multer writes to disk
 *   → uploadToIPFS() sends buffer to Infura IPFS
 *   → CID stored in warehouse_documents table
 *   → (optional) Compliance docs recorded on-chain via WarehouseDocumentRegistry
 *   → Response: { success, doc }
 */

import path   from 'path';
import fs     from 'fs';
import db     from '../config/db.js';
import { uploadToIPFS }           from '../services/IpfsService.js';
import { recordWarehouseDocument } from '../services/BlockchainService.js';
import { logAction, auditMeta }   from '../services/AuditService.js';

// Document types supported by the system
export const DOCUMENT_TYPES = [
  'warehouse_license',
  'inspection_report',
  'warehouse_certificate',
  'warehouse_insurance',
  'warehouse_ownership_proof',
  'warehouse_photos',
  'coffee_storage_report',
  'warehouse_receipt',
  'other',
];

// Compliance-critical types that get recorded on-chain when contract is deployed
const ONCHAIN_TYPES = new Set([
  'warehouse_license',
  'inspection_report',
  'warehouse_certificate',
]);

// ── Upload ────────────────────────────────────────────────────────────────────

export const uploadDocument = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const uploaderId = req.user?.id;
  const { warehouse_id, document_type, description } = req.body;

  if (!document_type || !DOCUMENT_TYPES.includes(document_type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid document_type. Must be one of: ${DOCUMENT_TYPES.join(', ')}`,
    });
  }

  // Sanitize file name for storage
  const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');

  let cid = null;
  try {
    const buffer = fs.readFileSync(file.path);
    cid = await uploadToIPFS(buffer, safeName, file.mimetype);
  } catch (ipfsErr) {
    console.warn(`IPFS upload warning for ${safeName}: ${ipfsErr.message}`);
    // Continue — store locally only if IPFS fails
  }

  // Check for duplicate CID (only when IPFS is enabled)
  if (cid) {
    const [[existing]] = await db.execute(
      `SELECT id FROM warehouse_documents WHERE cid = ? AND status = 'active' LIMIT 1`,
      [cid]
    );
    if (existing) {
      // Clean up the temp file
      fs.unlink(file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'This file has already been uploaded (duplicate CID detected).',
        existing_id: existing.id,
      });
    }
  }

  // Persist metadata
  const [result] = await db.execute(
    `INSERT INTO warehouse_documents
       (warehouse_id, document_type, document_name, description, cid, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      warehouse_id || null,
      document_type,
      safeName,
      description || null,
      cid,
      file.size,
      file.mimetype,
      uploaderId,
    ]
  );

  const docId = result.insertId;

  // Attempt optional on-chain recording for compliance docs
  let blockchainTx = null;
  if (cid && warehouse_id && ONCHAIN_TYPES.has(document_type)) {
    try {
      const txResult = await recordWarehouseDocument({
        warehouseId:  Number(warehouse_id),
        cid,
        documentType: document_type,
        documentName: safeName,
        dbRecordId:   docId,
      });
      blockchainTx = txResult?.txHash || null;

      if (blockchainTx) {
        await db.execute(
          `UPDATE warehouse_documents SET blockchain_tx = ?, blockchain_at = NOW() WHERE id = ?`,
          [blockchainTx, docId]
        );
      }
    } catch (chainErr) {
      console.warn(`On-chain recording skipped for doc #${docId}: ${chainErr.message}`);
    }
  }

  // Clean up temp file from disk after IPFS upload
  if (cid && file.path) {
    fs.unlink(file.path, () => {});
  }

  await logAction({
    actorId:    uploaderId,
    action:     'warehouse_doc:upload',
    entityType: 'warehouse_document',
    entityId:   docId,
    newData:    { cid, document_type, safeName, warehouse_id, blockchainTx },
    ...auditMeta(req),
  });

  // Fetch the full record to return
  const [[doc]] = await db.execute(
    `SELECT wd.*, u.full_name as uploader_name, u.email as uploader_email,
            w.name as warehouse_name
     FROM warehouse_documents wd
     LEFT JOIN users u ON u.id = wd.uploaded_by
     LEFT JOIN warehouses w ON w.id = wd.warehouse_id
     WHERE wd.id = ?`,
    [docId]
  );

  res.status(201).json({
    success:    true,
    message:    cid ? 'File uploaded to IPFS and metadata saved.' : 'File saved locally (IPFS not configured).',
    doc,
    gateway_url: cid ? `https://ipfs.io/ipfs/${cid}` : null,
    on_chain:    !!blockchainTx,
  });
};

// ── List ──────────────────────────────────────────────────────────────────────

export const listDocuments = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role   = req.user?.role;

    const { warehouse_id, document_type, page = 1, limit = 20 } = req.query;
    const lim = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const off = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const conditions = [`wd.status = 'active'`];
    const params = [];

    // Farmers only see their own uploads
    if (role === 'farmer') {
      conditions.push('wd.uploaded_by = ?');
      params.push(userId);
    }

    if (warehouse_id) {
      conditions.push('wd.warehouse_id = ?');
      params.push(Number(warehouse_id));
    }
    if (document_type) {
      conditions.push('wd.document_type = ?');
      params.push(document_type);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM warehouse_documents wd ${where}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT wd.*,
              u.full_name as uploader_name, u.email as uploader_email,
              w.name as warehouse_name, w.warehouse_code
       FROM warehouse_documents wd
       LEFT JOIN users u ON u.id = wd.uploaded_by
       LEFT JOIN warehouses w ON w.id = wd.warehouse_id
       ${where}
       ORDER BY wd.created_at DESC
       LIMIT ${lim} OFFSET ${off}`,
      params
    );

    res.json({
      success: true,
      documents: rows,
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / lim),
    });
  } catch (err) {
    console.error('listDocuments error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get single ────────────────────────────────────────────────────────────────

export const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const role   = req.user?.role;

    const [[doc]] = await db.execute(
      `SELECT wd.*,
              u.full_name as uploader_name, u.email as uploader_email,
              w.name as warehouse_name, w.warehouse_code
       FROM warehouse_documents wd
       LEFT JOIN users u ON u.id = wd.uploaded_by
       LEFT JOIN warehouses w ON w.id = wd.warehouse_id
       WHERE wd.id = ? AND wd.status = 'active' LIMIT 1`,
      [id]
    );

    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Farmers can only see their own documents
    if (role === 'farmer' && doc.uploaded_by !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json({
      success:     true,
      doc,
      gateway_url: doc.cid ? `https://ipfs.io/ipfs/${doc.cid}` : null,
    });
  } catch (err) {
    console.error('getDocument error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete (admin only) ───────────────────────────────────────────────────────

export const deleteDocument = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { id }  = req.params;

    const [[doc]] = await db.execute(
      `SELECT id, document_name, cid FROM warehouse_documents
       WHERE id = ? AND status = 'active' LIMIT 1`,
      [id]
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Soft delete — IPFS content is immutable and cannot be removed
    await db.execute(
      `UPDATE warehouse_documents SET status = 'deleted' WHERE id = ?`,
      [id]
    );

    await logAction({
      actorId:    adminId,
      action:     'warehouse_doc:delete',
      entityType: 'warehouse_document',
      entityId:   id,
      oldData:    { cid: doc.cid, name: doc.document_name },
      ...auditMeta(req),
    });

    res.json({
      success: true,
      message: 'Document record deleted. Note: IPFS content is immutable and remains accessible via CID.',
    });
  } catch (err) {
    console.error('deleteDocument error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Document types list (public helper) ───────────────────────────────────────

export const getDocumentTypes = (_req, res) => {
  res.json({ success: true, types: DOCUMENT_TYPES });
};
