/**
 * tokenController — token request lifecycle + mint.
 *
 * PART 1 design rule:
 *   Blockchain is called FIRST.
 *   DB is updated ONLY after tx.wait() succeeds.
 *   If the transaction fails → throw, do NOT update DB status.
 *
 * PART 8 / 11 custodian gate:
 *   A mint is only allowed when the linked coffee_lot has:
 *     warehouse_confirmed = 1  AND
 *     inspection_passed   = 1  AND
 *     a warehouse_receipt issued (status = 'receipt_issued')
 */

import db                from '../config/db.js';
import { mintToken as mintTokenOnChain, getOnChainBalance } from '../services/BlockchainService.js';
import { creditMint }    from '../services/BalanceService.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import chain             from '../config/chain.js';

// ── Farmer: create tokenisation request ────────────────────────────────────

export const createTokenRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { lot_id, lot_code, grade } = req.body;
    if (!lot_id) {
      return res.status(400).json({ message: 'lot_id is required — token amount is derived from the warehouse-confirmed lot weight' });
    }

    // Token amount MUST come from the lot's own warehouse-confirmed weight,
    // never from client input, so 1 token always represents 1 kg actually in custody.
    const [[lot]] = await db.execute(
      `SELECT id, status, grade, weight_kg FROM coffee_lots WHERE id = ? AND farmer_id = ? LIMIT 1`,
      [lot_id, userId]
    );
    if (!lot) return res.status(404).json({ message: 'Coffee lot not found or not yours' });
    if (!['receipt_issued'].includes(lot.status)) {
      return res.status(422).json({
        message: `Lot status is '${lot.status}'. Warehouse receipt must be issued before requesting tokenisation.`
      });
    }

    const kg_amount    = Number(lot.weight_kg);
    const token_amount = kg_amount; // 1 kg custodied = 1 token

    const [result] = await db.execute(
      `INSERT INTO token_requests (user_id, role, lot_id, lot_id_ref, kg_amount, token_amount, grade, status, created_at)
       VALUES (?, 'farmer', ?, ?, ?, ?, ?, 'pending', NOW())`,
      [userId, lot_code || null, lot_id, kg_amount, token_amount, grade || lot.grade || null]
    );

    await logAction({
      actorId: userId, action: 'token_request:create',
      entityType: 'token_request', entityId: result.insertId,
      newData: { kg_amount, grade, lot_id },
      ...auditMeta(req),
    });

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('createTokenRequest error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Farmer: list own requests ────────────────────────────────────────────────

export const listTokenRequestsForUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT tr.*, cl.lot_code, cl.warehouse_confirmed, cl.inspection_passed
       FROM token_requests tr
       LEFT JOIN coffee_lots cl ON tr.lot_id_ref = cl.id
       WHERE tr.user_id = ?
       ORDER BY tr.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: list all requests ─────────────────────────────────────────────────

export const listTokenRequests = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT tr.*, u.email, u.full_name,
              cl.lot_code, cl.warehouse_confirmed, cl.inspection_passed, cl.grade AS lot_grade,
              wr.receipt_code, wr.status AS receipt_status
       FROM token_requests tr
       JOIN users u ON tr.user_id = u.id
       LEFT JOIN coffee_lots cl ON tr.lot_id_ref = cl.id
       LEFT JOIN warehouse_receipts wr ON wr.lot_id = cl.id
       ORDER BY tr.created_at DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTokenRequest = async (req, res) => {
  try {
    const [[row]] = await db.execute(
      `SELECT tr.*, u.email, u.full_name,
              cl.lot_code, cl.warehouse_confirmed, cl.inspection_passed, cl.grade AS lot_grade,
              wr.receipt_code
       FROM token_requests tr
       JOIN users u ON tr.user_id = u.id
       LEFT JOIN coffee_lots cl ON tr.lot_id_ref = cl.id
       LEFT JOIN warehouse_receipts wr ON wr.lot_id = cl.id
       WHERE tr.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: review (approve / reject) ────────────────────────────────────────

export const reviewTokenRequest = async (req, res) => {
  try {
    const id      = req.params.id;
    const adminId = req.user?.id;
    const { action, token_type } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const [[row]] = await db.execute(
      `SELECT tr.*, cl.warehouse_confirmed, cl.inspection_passed, wr.id AS receipt_id
       FROM token_requests tr
       LEFT JOIN coffee_lots cl ON tr.lot_id_ref = cl.id
       LEFT JOIN warehouse_receipts wr ON wr.lot_id = cl.id
       WHERE tr.id = ? LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.status !== 'pending') {
      return res.status(409).json({ message: `Request already ${row.status}` });
    }

    // Custodian gate — enforce for lots that were linked
    if (action === 'approve' && row.lot_id_ref) {
      if (!row.warehouse_confirmed) {
        return res.status(422).json({ message: 'Lot not yet warehouse-confirmed' });
      }
      if (!row.inspection_passed) {
        return res.status(422).json({ message: 'Lot has not passed inspection' });
      }
      if (!row.receipt_id) {
        return res.status(422).json({ message: 'Warehouse receipt not yet issued for this lot' });
      }
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const type   = token_type || row.token_type || 'CR1';

    await db.execute(
      `UPDATE token_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), token_type = ?
       WHERE id = ?`,
      [status, adminId, type, id]
    );

    await logAction({
      actorId: adminId, action: `token_request:${action}`,
      entityType: 'token_request', entityId: Number(id),
      oldData: { status: row.status }, newData: { status, token_type: type },
      ...auditMeta(req),
    });

    res.json({ success: true, message: `Token request ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: mint (blockchain-first) ──────────────────────────────────────────

export const mintToken = async (req, res) => {
  try {
    const id      = req.params.id;
    const adminId = req.user?.id;

    // Load request with farmer wallet — prefer user_wallets, fall back to users.wallet_address
    const [[row]] = await db.execute(
      `SELECT tr.*, COALESCE(uw.wallet_address, u.wallet_address) AS farmer_wallet,
              cl.lot_code, cl.weight_kg AS lot_weight_kg
       FROM token_requests tr
       LEFT JOIN users u ON u.id = tr.user_id
       LEFT JOIN user_wallets uw ON uw.user_id = tr.user_id AND uw.role = 'farmer'
       LEFT JOIN coffee_lots cl ON tr.lot_id_ref = cl.id
       WHERE tr.id = ? LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.status !== 'approved') {
      return res.status(409).json({ message: `Request must be approved before minting (current: ${row.status})` });
    }

    const tokenType = row.token_type || req.body.token_type || 'CR1';
    // Re-derive from the lot's current warehouse-confirmed weight (not the
    // possibly-stale token_amount snapshotted at request time) so the minted
    // amount always matches the final custodied weight.
    const tokenAmount = row.lot_id_ref && row.lot_weight_kg != null
      ? Number(row.lot_weight_kg)
      : Number(row.token_amount || 0);
    const userId      = row.user_id;
    const lotCode     = row.lot_code || `TR-${id}`;
    const farmerWallet = row.farmer_wallet;

    if (!farmerWallet) {
      return res.status(422).json({ message: 'Farmer has no registered wallet address' });
    }

    // ── STEP 1: Call blockchain (MUST succeed before any DB write) ──────
    let txHash, blockNumber;
    try {
      ({ txHash, blockNumber } = await mintTokenOnChain({
        tokenType,
        toAddress: farmerWallet,
        amount:    tokenAmount,
        lotCode,
        requestId: String(id),
      }));
    } catch (chainErr) {
      console.error('Blockchain mint failed:', chainErr);
      return res.status(502).json({
        success: false,
        message: `Blockchain mint failed: ${chainErr.message}`,
      });
    }

    // ── STEP 2: Update DB only after successful on-chain mint ───────────
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Credit balance
      await creditMint(userId, tokenType, tokenAmount, conn);

      // Record mint history
      await conn.execute(
        `INSERT INTO mint_history (token_request_id, minted_by, minted_amount, tx_hash, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [id, adminId, tokenAmount, txHash]
      );

      // Mark request as minted
      await conn.execute(
        `UPDATE token_requests SET status = 'minted' WHERE id = ?`, [id]
      );

      // Update coffee_lot status if linked
      if (row.lot_id_ref) {
        await conn.execute(
          `UPDATE coffee_lots SET status = 'minted' WHERE id = ?`, [row.lot_id_ref]
        );
      }

      await conn.commit();
    } catch (dbErr) {
      await conn.rollback();
      // Blockchain already succeeded — log the discrepancy for manual reconciliation
      console.error(`CRITICAL: On-chain mint succeeded (txHash: ${txHash}) but DB update failed:`, dbErr);
      return res.status(500).json({
        success: false,
        message: 'On-chain mint succeeded but database update failed. Contact support with txHash.',
        txHash,
      });
    } finally {
      conn.release();
    }

    await logAction({
      actorId: adminId, action: 'token_request:mint',
      entityType: 'token_request', entityId: Number(id),
      newData: { txHash, blockNumber, tokenType, tokenAmount },
      ...auditMeta(req),
    });

    res.json({ success: true, txHash, blockNumber, token_type: tokenType, credited: tokenAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── User: get balances ───────────────────────────────────────────────────────

export const getUserBalances = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { getBalances } = await import('../services/BalanceService.js');
    const balances = await getBalances(userId);

    let wallet = null;
    try {
      const [w] = await db.execute(
        `SELECT wallet_address FROM user_wallets WHERE user_id = ? AND role = ? LIMIT 1`,
        [userId, req.user.role]
      );
      if (w.length > 0) wallet = w[0].wallet_address;
    } catch (_) { /* wallet table may not exist yet */ }

    res.json({ success: true, balances, wallet_address: wallet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── User: get on-chain balances ──────────────────────────────────────────────

export const getOnChainBalances = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let wallet = null;
    try {
      const [w] = await db.execute(
        `SELECT wallet_address FROM user_wallets WHERE user_id = ? AND role = ? LIMIT 1`,
        [userId, req.user.role]
      );
      if (w.length > 0) wallet = w[0].wallet_address;
    } catch (_) { /* ignore */ }

    // Fallback to user table
    if (!wallet) {
      try {
        const [[user]] = await db.execute(
          `SELECT wallet_address FROM users WHERE id = ? LIMIT 1`,
          [userId]
        );
        if (user) wallet = user.wallet_address;
      } catch (_) { /* ignore */ }
    }

    const balances = { CR1: '0.0', CR2: '0.0', CR3: '0.0' };
    if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      const { getOnChainBalance } = await import('../services/BlockchainService.js');
      for (const t of ['CR1', 'CR2', 'CR3']) {
        try {
          const bal = await getOnChainBalance(t, wallet);
          balances[t] = bal;
        } catch (err) {
          console.error(`Error fetching on-chain balance for ${t} for wallet ${wallet}:`, err);
          balances[t] = '0.0';
        }
      }
    }

    res.json({
      success: true,
      balances,
      wallet_address: wallet,
      contracts: chain.CONTRACT_ADDRESSES
    });
  } catch (err) {
    console.error('getOnChainBalances error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
