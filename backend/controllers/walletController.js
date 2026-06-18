/**
 * walletController — VND wallet simulation (Part 5).
 *
 * No real bank integration.  Flow:
 *
 * Deposit:
 *   User creates deposit request + uploads receipt image.
 *   Admin approves → vnd_balance += amount.
 *
 * Withdraw:
 *   User creates withdraw request with bank details.
 *   Admin approves → vnd_balance -= amount (checks balance first).
 *   Admin rejects → no change.
 */

import db                  from '../config/db.js';
import multer              from 'multer';
import path                from 'path';
import { logAction, auditMeta } from '../services/AuditService.js';

// ── Multer for deposit proof image ─────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/deposits/'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `dep-${Date.now()}${ext}`);
  },
});

export const uploadProof = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|png|jpg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG / PNG / WebP images allowed'));
  },
}).single('proof_image');

// ── Ensure wallet row exists ─────────────────────────────────────────────────

async function ensureWallet(userId, conn = db) {
  await conn.execute(
    `INSERT IGNORE INTO wallets (user_id, vnd_balance, vnd_locked, pending_withdraw)
     VALUES (?, 0, 0, 0)`,
    [userId]
  );
}

// ── Get wallet balance ────────────────────────────────────────────────────────

export const getWallet = async (req, res) => {
  try {
    const userId = req.user?.id;
    await ensureWallet(userId);
    const [[wallet]] = await db.execute(
      `SELECT vnd_balance, vnd_locked, pending_withdraw FROM wallets WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    res.json({
      success: true,
      vnd_balance:      Number(wallet?.vnd_balance      || 0),
      vnd_locked:       Number(wallet?.vnd_locked       || 0),
      vnd_available:    Number(wallet?.vnd_balance      || 0) - Number(wallet?.vnd_locked || 0),
      pending_withdraw: Number(wallet?.pending_withdraw || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Deposit ─────────────────────────────────────────────────────────────────

export const createDeposit = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }
    const proofPath = req.file ? req.file.path : null;

    const [r] = await db.execute(
      `INSERT INTO deposit_requests (user_id, amount, proof_image, status, created_at)
       VALUES (?, ?, ?, 'pending', NOW())`,
      [userId, Number(amount), proofPath]
    );

    await logAction({
      actorId: userId, action: 'deposit:create',
      entityType: 'deposit', entityId: r.insertId,
      newData: { amount: Number(amount) }, ...auditMeta(req),
    });

    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listDepositsForUser = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listAllDeposits = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT d.*, u.email, u.full_name
       FROM deposit_requests d JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const reviewDeposit = async (req, res) => {
  try {
    const id      = req.params.id;
    const adminId = req.user?.id;
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const [[dep]] = await db.execute(`SELECT * FROM deposit_requests WHERE id = ? LIMIT 1`, [id]);
    if (!dep) return res.status(404).json({ message: 'Not found' });
    if (dep.status !== 'pending') return res.status(409).json({ message: `Already ${dep.status}` });

    if (action === 'approve') {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await ensureWallet(dep.user_id, conn);
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [dep.amount, dep.user_id]
        );
        await conn.execute(
          `UPDATE deposit_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), note = ?
           WHERE id = ?`,
          [adminId, note || null, id]
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } else {
      await db.execute(
        `UPDATE deposit_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), note = ?
         WHERE id = ?`,
        [adminId, note || null, id]
      );
    }

    await logAction({
      actorId: adminId, action: `deposit:${action}`,
      entityType: 'deposit', entityId: Number(id),
      oldData: { status: 'pending' }, newData: { status: action === 'approve' ? 'approved' : 'rejected' },
      ...auditMeta(req),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Withdraw ────────────────────────────────────────────────────────────────

export const createWithdraw = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount, bank_name, account_number, account_name } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }
    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({ message: 'bank_name, account_number, account_name are required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ensureWallet(userId, conn);

      const [[wallet]] = await conn.execute(
        `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? FOR UPDATE`, [userId]
      );
      const available = Number(wallet.vnd_balance) - Number(wallet.vnd_locked);
      if (available < Number(amount)) {
        await conn.rollback();
        return res.status(422).json({ message: `Insufficient VND. Available: ${available.toLocaleString()}` });
      }

      // Lock withdrawal amount
      await conn.execute(
        `UPDATE wallets SET pending_withdraw = pending_withdraw + ?, vnd_locked = vnd_locked + ?
         WHERE user_id = ?`,
        [amount, amount, userId]
      );

      const [r] = await conn.execute(
        `INSERT INTO withdraw_requests (user_id, amount, bank_name, account_number, account_name, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
        [userId, amount, bank_name, account_number, account_name]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'withdraw:create',
        entityType: 'withdraw', entityId: r.insertId,
        newData: { amount: Number(amount), bank_name }, ...auditMeta(req),
      });

      res.status(201).json({ success: true, id: r.insertId });
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

export const listWithdrawsForUser = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM withdraw_requests WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listAllWithdraws = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT w.*, u.email, u.full_name
       FROM withdraw_requests w JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const reviewWithdraw = async (req, res) => {
  try {
    const id      = req.params.id;
    const adminId = req.user?.id;
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const [[wd]] = await db.execute(`SELECT * FROM withdraw_requests WHERE id = ? LIMIT 1`, [id]);
    if (!wd) return res.status(404).json({ message: 'Not found' });
    if (wd.status !== 'pending') return res.status(409).json({ message: `Already ${wd.status}` });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (action === 'approve') {
        // Deduct from balance + remove locks
        await conn.execute(
          `UPDATE wallets
           SET vnd_balance = vnd_balance - ?, vnd_locked = vnd_locked - ?,
               pending_withdraw = pending_withdraw - ?
           WHERE user_id = ?`,
          [wd.amount, wd.amount, wd.amount, wd.user_id]
        );
      } else {
        // Reject — release lock
        await conn.execute(
          `UPDATE wallets
           SET vnd_locked = vnd_locked - ?, pending_withdraw = pending_withdraw - ?
           WHERE user_id = ?`,
          [wd.amount, wd.amount, wd.user_id]
        );
      }

      await conn.execute(
        `UPDATE withdraw_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), note = ?
         WHERE id = ?`,
        [action === 'approve' ? 'approved' : 'rejected', adminId, note || null, id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await logAction({
      actorId: adminId, action: `withdraw:${action}`,
      entityType: 'withdraw', entityId: Number(id),
      ...auditMeta(req),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
