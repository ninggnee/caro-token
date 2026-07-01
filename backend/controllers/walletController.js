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
import { transferToken }   from '../services/BlockchainService.js';

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

export const createTokenDeposit = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { token_type, amount, tx_hash } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }
    if (!token_type || !tx_hash) {
      return res.status(400).json({ message: 'token_type and tx_hash are required' });
    }

    // Check if tx_hash already exists to prevent replay attacks
    const [exist] = await db.execute(
      `SELECT id FROM deposit_requests WHERE tx_hash = ? LIMIT 1`,
      [tx_hash]
    );
    if (exist.length > 0) {
      return res.status(409).json({ message: 'Giao dịch này đã được đăng ký trước đó' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Ensure user balance row exists
      const [balRows] = await conn.execute(
        `SELECT id FROM user_balances WHERE user_id = ? AND token_type = ?`,
        [userId, token_type]
      );
      if (balRows.length === 0) {
        await conn.execute(
          `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
           VALUES (?, ?, 0, 0, 0)`,
          [userId, token_type]
        );
      }

      // Add to balance
      await conn.execute(
        `UPDATE user_balances 
         SET balance = balance + ?, available_balance = available_balance + ?
         WHERE user_id = ? AND token_type = ?`,
        [amount, amount, userId, token_type]
      );

      // Record in deposit_requests
      const [r] = await conn.execute(
        `INSERT INTO deposit_requests (user_id, amount, token_type, tx_hash, status, created_at)
         VALUES (?, ?, ?, ?, 'approved', NOW())`,
        [userId, amount, token_type, tx_hash]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'deposit:token',
        entityType: 'deposit', entityId: r.insertId,
        newData: { amount: Number(amount), token_type, tx_hash }, ...auditMeta(req),
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

// ── Direct deposit (immediately credits vnd_balance) ────────────────────────

export const directDeposit = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ensureWallet(userId, conn);

      await conn.execute(
        `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
        [Number(amount), userId]
      );

      const [r] = await conn.execute(
        `INSERT INTO deposit_requests (user_id, amount, status, note, created_at, reviewed_at)
         VALUES (?, ?, 'approved', 'Nạp trực tiếp', NOW(), NOW())`,
        [userId, Number(amount)]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'deposit:direct',
        entityType: 'deposit', entityId: r.insertId,
        newData: { amount: Number(amount) }, ...auditMeta(req),
      });

      res.status(200).json({ success: true, id: r.insertId });
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

// ── Combined transaction history ─────────────────────────────────────────────

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit  = Math.min(Number(req.query.limit) || 20, 100);

    const [deposits] = await db.execute(
      `SELECT id, 'deposit' AS type, amount, token_type, NULL AS destination_address, tx_hash, status, note, created_at
       FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );

    const [withdraws] = await db.execute(
      `SELECT id, 'withdraw' AS type, amount, token_type, destination_address, tx_hash, status, note, created_at
       FROM withdraw_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );

    const combined = [...deposits, ...withdraws]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json({ success: true, data: combined });
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
    const { amount, bank_name, account_number, account_name, token_type, destination_address } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (token_type) {
        // --- TOKEN WITHDRAWAL ---
        if (!/^0x[0-9a-fA-F]{40}$/.test(destination_address)) {
          await conn.rollback();
          return res.status(400).json({ message: 'Địa chỉ ví MetaMask không hợp lệ' });
        }
        if (!['CR1', 'CR2', 'CR3'].includes(token_type)) {
          await conn.rollback();
          return res.status(400).json({ message: 'Loại token không hợp lệ' });
        }

        // Get user token balance
        const [[balanceRow]] = await conn.execute(
          `SELECT available_balance, balance, locked_balance FROM user_balances WHERE user_id = ? AND token_type = ? FOR UPDATE`,
          [userId, token_type]
        );
        const available = Number(balanceRow?.available_balance || 0);
        if (available < Number(amount)) {
          await conn.rollback();
          return res.status(422).json({ message: `Số dư token ${token_type} không đủ. Khả dụng: ${available}` });
        }

        // Abnormal behavior check: >= 3 withdrawals in the last 5 minutes
        const [recentRequests] = await conn.execute(
          `SELECT COUNT(*) AS count FROM withdraw_requests 
           WHERE user_id = ? AND token_type IS NOT NULL AND created_at >= NOW() - INTERVAL 5 MINUTE`,
          [userId]
        );
        const count = recentRequests[0]?.count || 0;
        if (count >= 2) {
          // Log alert
          await conn.execute(
            `INSERT INTO abnormal_activities (user_id, activity_type, description, created_at)
             VALUES (?, 'high_frequency_withdrawal', ?, NOW())`,
            [userId, `Người dùng rút token ${count + 1} lần trong vòng 5 phút (Số lượng: ${amount} ${token_type}, Ví nhận: ${destination_address})`]
          );
        }

        // Lock the balance in DB first to prevent double-spending
        await conn.execute(
          `UPDATE user_balances 
           SET available_balance = available_balance - ?, locked_balance = locked_balance + ?
           WHERE user_id = ? AND token_type = ?`,
          [amount, amount, userId, token_type]
        );

        // Insert pending transaction record
        const [r] = await conn.execute(
          `INSERT INTO withdraw_requests (user_id, amount, token_type, destination_address, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', NOW())`,
          [userId, amount, token_type, destination_address]
        );
        const requestId = r.insertId;

        // Commit DB lock transaction before making slow blockchain call
        await conn.commit();

        // Call Blockchain transfer from Treasury Wallet to user's wallet
        let txHash;
        try {
          const withdrawFee = Number(amount) * 0.001; // 0.1% fee
          const netAmount = Number(amount) - withdrawFee;

          const result = await transferToken({
            tokenType: token_type,
            toAddress: destination_address,
            amount: netAmount,
          });
          txHash = result.txHash;
        } catch (chainErr) {
          console.error('[walletController] Blockchain transfer token failed:', chainErr);
          
          // Revert DB lock
          const revertConn = await db.getConnection();
          try {
            await revertConn.beginTransaction();
            await revertConn.execute(
              `UPDATE user_balances 
               SET available_balance = available_balance + ?, locked_balance = locked_balance - ?
               WHERE user_id = ? AND token_type = ?`,
              [amount, amount, userId, token_type]
            );
            await revertConn.execute(
              `UPDATE withdraw_requests SET status = 'rejected', note = ? WHERE id = ?`,
              [`Blockchain error: ${chainErr.message}`, requestId]
            );
            await revertConn.commit();
          } catch (revertDbErr) {
            await revertConn.rollback();
            console.error('CRITICAL: Failed to revert locked token balance after blockchain failure:', revertDbErr);
          } finally {
            revertConn.release();
          }

          return res.status(502).json({ success: false, message: `Rút token thất bại: ${chainErr.message}` });
        }

        // Complete the transaction in DB
        const completeConn = await db.getConnection();
        try {
          await completeConn.beginTransaction();
          await completeConn.execute(
            `UPDATE user_balances 
             SET balance = balance - ?, locked_balance = locked_balance - ?
             WHERE user_id = ? AND token_type = ?`,
            [amount, amount, userId, token_type]
          );
          await completeConn.execute(
            `UPDATE withdraw_requests SET status = 'approved', tx_hash = ?, reviewed_at = NOW() WHERE id = ?`,
            [txHash, requestId]
          );
          await completeConn.commit();
        } catch (completeDbErr) {
          await completeConn.rollback();
          console.error(`CRITICAL: Blockchain transfer succeeded (txHash: ${txHash}) but DB completion failed:`, completeDbErr);
        } finally {
          completeConn.release();
        }

        await logAction({
          actorId: userId, action: 'withdraw:token',
          entityType: 'withdraw', entityId: requestId,
          newData: { amount: Number(amount), token_type, destination_address, txHash }, ...auditMeta(req),
        });

        return res.status(201).json({ success: true, id: requestId, txHash });

      } else {
        // --- VND WITHDRAWAL (unchanged) ---
        if (!bank_name || !account_number || !account_name) {
          await conn.rollback();
          return res.status(400).json({ message: 'bank_name, account_number, account_name are required' });
        }

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

        return res.status(201).json({ success: true, id: r.insertId });
      }
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

      if (wd.token_type) {
        // --- REVIEW TOKEN WITHDRAWAL ---
        if (action === 'approve') {
          // Call blockchain to transfer
          let txHash;
          try {
            const withdrawFee = Number(wd.amount) * 0.001; // 0.1% fee
            const netAmount = Number(wd.amount) - withdrawFee;

            const result = await transferToken({
              tokenType: wd.token_type,
              toAddress: wd.destination_address,
              amount: netAmount,
            });
            txHash = result.txHash;
          } catch (chainErr) {
            console.error('[walletController] Blockchain review approve token failed:', chainErr);
            await conn.rollback();
            return res.status(502).json({ success: false, message: `Duyệt rút token thất bại: ${chainErr.message}` });
          }

          // Deduct from balance
          await conn.execute(
            `UPDATE user_balances
             SET balance = balance - ?, locked_balance = locked_balance - ?
             WHERE user_id = ? AND token_type = ?`,
            [wd.amount, wd.amount, wd.user_id, wd.token_type]
          );

          await conn.execute(
            `UPDATE withdraw_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), tx_hash = ?, note = ?
             WHERE id = ?`,
            [adminId, txHash, note || null, id]
          );
        } else {
          // Reject - unlock balance
          await conn.execute(
            `UPDATE user_balances
             SET available_balance = available_balance + ?, locked_balance = locked_balance - ?
             WHERE user_id = ? AND token_type = ?`,
            [wd.amount, wd.amount, wd.user_id, wd.token_type]
          );

          await conn.execute(
            `UPDATE withdraw_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), note = ?
             WHERE id = ?`,
            [adminId, note || null, id]
          );
        }
      } else {
        // --- REVIEW VND WITHDRAWAL (unchanged) ---
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
      }

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
