/**
 * orderController — limit order placement and matching engine integration.
 *
 * Valid pairs: CR1/VND, CR2/VND, CR3/VND.
 * Cross-grade matching is NOT allowed (enforced via pair validation).
 *
 * Flow for SELL order:
 *   1. Lock seller's tokens (BalanceService.lockBalance)
 *   2. Insert order
 *   3. Run matching engine
 *   4. For each trade: transfer tokens to buyer, deduct VND from buyer
 *
 * Flow for BUY order:
 *   1. Lock buyer's VND balance (WalletService.lockVnd)
 *   2. Insert order
 *   3. Run matching engine
 *   4. For each trade: credit tokens to buyer, deduct VND from buyer wallet
 */

import db                    from '../config/db.js';
import { lockBalance, unlockBalance, creditMint, deductAvailable } from '../services/BalanceService.js';
import { matchOrder }        from '../services/MatchingEngineService.js';
import { logAction, auditMeta } from '../services/AuditService.js';

const VALID_PAIRS  = ['CR1/VND', 'CR2/VND', 'CR3/VND'];
const TOKEN_OF     = { 'CR1/VND': 'CR1', 'CR2/VND': 'CR2', 'CR3/VND': 'CR3' };

// ── Place order ─────────────────────────────────────────────────────────────

export const placeOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pair, side, price, amount } = req.body;

    if (!VALID_PAIRS.includes(pair)) {
      return res.status(400).json({ message: `Invalid pair. Valid: ${VALID_PAIRS.join(', ')}` });
    }
    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ message: 'side must be buy or sell' });
    }
    if (!price || Number(price) <= 0) {
      return res.status(400).json({ message: 'price must be > 0' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }

    const tokenType   = TOKEN_OF[pair];
    const numPrice    = Number(price);
    const numAmount   = Number(amount);
    const vndRequired = numPrice * numAmount; // VND needed for a buy

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Pre-trade locks
      if (side === 'sell') {
        // Lock seller tokens
        await lockBalance(userId, tokenType, numAmount, conn);
      } else {
        // Lock buyer VND — update wallets.vnd_locked
        const [[wallet]] = await conn.execute(
          `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? FOR UPDATE`,
          [userId]
        );
        if (!wallet || Number(wallet.vnd_balance) - Number(wallet.vnd_locked) < vndRequired) {
          await conn.rollback();
          return res.status(422).json({ message: `Insufficient VND. Need ${vndRequired.toLocaleString()}` });
        }
        await conn.execute(
          `UPDATE wallets SET vnd_locked = vnd_locked + ? WHERE user_id = ?`,
          [vndRequired, userId]
        );
      }

      // Insert order
      const [r] = await conn.execute(
        `INSERT INTO orders (user_id, pair, side, type, price, amount, filled, remaining, status, created_at)
         VALUES (?, ?, ?, 'limit', ?, ?, 0, ?, 'open', NOW())`,
        [userId, pair, side, numPrice, numAmount, numAmount]
      );

      const newOrder = {
        id: r.insertId, user_id: userId, pair, side, type: 'limit',
        price: numPrice, amount: numAmount, filled: 0, remaining: numAmount,
      };

      // Run matching engine
      const { trades, filledAmount, remainingAmount } = await matchOrder(conn, newOrder);

      // Settle each trade
      for (const trade of trades) {
        // Credit tokens to buyer
        await creditMint(trade.buyerId, tokenType, trade.amount, conn);
        // Deduct locked tokens from seller
        await conn.execute(
          `UPDATE user_balances
           SET locked_balance = locked_balance - ?, balance = balance - ?
           WHERE user_id = ? AND token_type = ?`,
          [trade.amount, trade.amount, trade.sellerId, tokenType]
        );
        // Deduct VND from buyer (locked → spent)
        const vndCost = trade.price * trade.amount;
        await conn.execute(
          `UPDATE wallets
           SET vnd_balance = vnd_balance - ?, vnd_locked = vnd_locked - ?
           WHERE user_id = ?`,
          [vndCost, vndCost, trade.buyerId]
        );
        // Credit VND to seller
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [vndCost, trade.sellerId]
        );
      }

      // Update new order status
      const newFilled = filledAmount;
      const newStatus = remainingAmount <= 0 ? 'filled' : (newFilled > 0 ? 'partial' : 'open');
      await conn.execute(
        `UPDATE orders SET filled = ?, remaining = ?, status = ?, updated_at = NOW() WHERE id = ?`,
        [newFilled, remainingAmount, newStatus, r.insertId]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: `order:place:${side}`,
        entityType: 'order', entityId: r.insertId,
        newData: { pair, side, price: numPrice, amount: numAmount, trades: trades.length },
        ...auditMeta(req),
      });

      res.status(201).json({
        success: true,
        id:       r.insertId,
        status:   newStatus,
        filled:   newFilled,
        remaining: remainingAmount,
        trades:   trades.length,
      });
    } catch (err) {
      await conn.rollback();
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({ success: false, message: err.message });
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('placeOrder error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Cancel order ────────────────────────────────────────────────────────────

export const cancelOrder = async (req, res) => {
  try {
    const userId  = req.user?.id;
    const orderId = req.params.id;

    const [[order]] = await db.execute(
      `SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1`,
      [orderId, userId]
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['open', 'partial'].includes(order.status)) {
      return res.status(409).json({ message: `Cannot cancel an order with status: ${order.status}` });
    }

    const tokenType    = TOKEN_OF[order.pair];
    const unfilledAmt  = Number(order.remaining);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (order.side === 'sell') {
        await unlockBalance(userId, tokenType, unfilledAmt, conn);
      } else {
        // Release VND lock
        const vndLocked = Number(order.price) * unfilledAmt;
        await conn.execute(
          `UPDATE wallets SET vnd_locked = vnd_locked - ? WHERE user_id = ?`,
          [vndLocked, userId]
        );
      }

      await conn.execute(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [orderId]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await logAction({
      actorId: userId, action: 'order:cancel',
      entityType: 'order', entityId: Number(orderId),
      ...auditMeta(req),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('cancelOrder error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Read ─────────────────────────────────────────────────────────────────────

export const getOpenOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pair } = req.query;
    const where  = pair ? `AND pair = ?` : '';
    const params = pair ? [userId, pair] : [userId];
    const [rows] = await db.execute(
      `SELECT * FROM orders WHERE user_id = ? ${where} AND status IN ('open','partial')
       ORDER BY created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrderbook = async (req, res) => {
  try {
    const pair = req.query.pair || 'CR1/VND';
    if (!VALID_PAIRS.includes(pair)) {
      return res.status(400).json({ message: 'Invalid pair' });
    }
    const [rows] = await db.execute(
      `SELECT side, price, SUM(remaining) AS total_remaining
       FROM orders
       WHERE pair = ? AND status IN ('open','partial')
       GROUP BY side, price
       ORDER BY side, price`,
      [pair]
    );
    const bids = rows.filter(r => r.side === 'buy')
                     .map(r => ({ price: Number(r.price), amount: Number(r.total_remaining) }))
                     .sort((a,b) => b.price - a.price);
    const asks = rows.filter(r => r.side === 'sell')
                     .map(r => ({ price: Number(r.price), amount: Number(r.total_remaining) }))
                     .sort((a,b) => a.price - b.price);
    res.json({ success: true, data: { pair, bids, asks } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTradeHistory = async (req, res) => {
  try {
    const pair  = req.query.pair || null;
    const where = pair ? `WHERE pair = ?` : '';
    const [rows] = await db.execute(
      `SELECT * FROM trades ${where} ORDER BY created_at DESC LIMIT 200`,
      pair ? [pair] : []
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTickers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pair,
              MAX(price) AS high,
              MIN(price) AS low,
              SUM(amount) AS volume,
              (SELECT price FROM trades t2 WHERE t2.pair = t.pair ORDER BY created_at DESC LIMIT 1) AS last_price
       FROM trades t
       GROUP BY pair`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
