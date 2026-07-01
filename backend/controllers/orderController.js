/**
 * orderController — limit/market order placement with price-time priority matching.
 *
 * Valid pairs: CR1/VND, CR2/VND, CR3/VND.
 * Cross-grade matching is NOT allowed (enforced via pair validation).
 *
 * Order lifecycle:
 *   PENDING → OPEN → PARTIALLY_FILLED → FILLED
 *          ↘ (market order unfilled)  → CANCELLED
 *          ↘ (user action)            → CANCELLED
 *
 * Execution price rule:
 *   Trades execute at the MAKER (resting) order's price, not the taker's price.
 *   A BUY limit price is the buyer's maximum — if a seller rests at a lower ask,
 *   the buyer executes at the lower price and the VND savings are released immediately.
 *
 * VND lock rule for BUY orders:
 *   Lock = order.price × amount  (worst-case reservation)
 *   On each fill: release order.price × filledQty from locked,
 *                 deduct trade.price × filledQty from balance.
 *   Net effect: price-improvement savings become available immediately.
 */

import db                    from '../config/db.js';
import { lockBalance, unlockBalance, creditMint, deductAvailable } from '../services/BalanceService.js';
import { matchOrder }        from '../services/MatchingEngineService.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { getTradingBand }   from '../services/MockMarketEngine.js';

const VALID_PAIRS  = ['CR1/VND', 'CR2/VND', 'CR3/VND'];
const TOKEN_OF     = { 'CR1/VND': 'CR1', 'CR2/VND': 'CR2', 'CR3/VND': 'CR3' };
const TICK_SIZE    = 100;

// ── Helpers ─────────────────────────────────────────────────────────────────

// Active orders that can participate in matching or be cancelled
// Accept both old ('partial') and new ('partially_filled') values for backward compat
const ACTIVE_STATUSES = `('open','partial','partially_filled')`;

// ── Place order ─────────────────────────────────────────────────────────────

export const placeOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pair, side, price, amount, type = 'limit' } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!VALID_PAIRS.includes(pair)) {
      return res.status(400).json({ message: `Invalid pair. Valid: ${VALID_PAIRS.join(', ')}` });
    }
    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ message: 'side must be buy or sell' });
    }
    if (!['limit', 'market'].includes(type)) {
      return res.status(400).json({ message: 'type must be limit or market' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be > 0' });
    }

    const tokenType = TOKEN_OF[pair];
    const numAmount = Number(amount);

    // ── Limit order: price rules ─────────────────────────────────────────────
    let numPrice;
    if (type === 'limit') {
      if (!price || Number(price) <= 0) {
        return res.status(400).json({ message: 'price must be > 0 for limit orders' });
      }
      numPrice = Number(price);

      // Tick size: 100 VND
      if (numPrice % TICK_SIZE !== 0) {
        return res.status(422).json({
          message: `Giá phải là bội số của ${TICK_SIZE} VND (Tick Size). Ví dụ: 88.000, 88.100, 88.200`,
        });
      }

      // Daily trading band: reference price ±7%
      const band = getTradingBand(tokenType);
      if (numPrice < band.floor || numPrice > band.ceiling) {
        return res.status(422).json({
          message: `Giá vượt ngoài biên độ giao dịch hôm nay [${band.floor.toLocaleString()} – ${band.ceiling.toLocaleString()} VND/kg]. Giá tham chiếu: ${band.ref.toLocaleString()} VND/kg`,
          band,
        });
      }
    }

    // ── Market order: resolve price from order book ──────────────────────────
    if (type === 'market') {
      const oppSide    = side === 'buy' ? 'sell' : 'buy';
      const priceOrder = side === 'buy' ? 'ASC'  : 'DESC';
      const [[bestRow]] = await db.execute(
        `SELECT price FROM orders WHERE pair = ? AND side = ? AND status IN ${ACTIVE_STATUSES}
         ORDER BY price ${priceOrder}, created_at ASC LIMIT 1`,
        [pair, oppSide]
      );
      if (!bestRow) {
        return res.status(422).json({
          message: 'Sổ lệnh đang trống, không thể đặt lệnh thị trường. Vui lòng thử lại sau.',
        });
      }
      // Sweep all asks (BUY) or all bids (SELL) using a price that beats everything
      numPrice = side === 'buy' ? 999_999_999 : 0;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ── Pre-trade locks ──────────────────────────────────────────────────────
      let vndLockPrice = 0; // price per unit used for VND locking
      let vndLocked    = 0;

      if (side === 'sell') {
        await lockBalance(userId, tokenType, numAmount, conn);
      } else {
        // BUY: lock VND at order price (worst-case reservation for limit; best ask for market)
        if (type === 'market') {
          const [[best]] = await conn.execute(
            `SELECT price FROM orders WHERE pair = ? AND side = 'sell' AND status IN ${ACTIVE_STATUSES}
             ORDER BY price ASC, created_at ASC LIMIT 1`,
            [pair]
          );
          if (!best) {
            await conn.rollback();
            return res.status(422).json({ message: 'Sổ lệnh đang trống, không thể đặt lệnh thị trường.' });
          }
          vndLockPrice = Number(best.price);
        } else {
          vndLockPrice = numPrice;
        }

        vndLocked = vndLockPrice * numAmount;
        const [[wallet]] = await conn.execute(
          `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? FOR UPDATE`,
          [userId]
        );
        if (!wallet || Number(wallet.vnd_balance) - Number(wallet.vnd_locked) < vndLocked) {
          await conn.rollback();
          return res.status(422).json({
            message: `Số dư VND không đủ. Cần tối thiểu ${vndLocked.toLocaleString()} VND`,
          });
        }
        await conn.execute(
          `UPDATE wallets SET vnd_locked = vnd_locked + ? WHERE user_id = ?`,
          [vndLocked, userId]
        );
      }

      // ── Insert order — starts as 'open' so it works with existing DB ENUM ──────
      const [r] = await conn.execute(
        `INSERT INTO orders (user_id, pair, side, type, price, amount, filled, remaining, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'open', NOW())`,
        [userId, pair, side, type, numPrice, numAmount, numAmount]
      );

      const orderId = r.insertId;

      const newOrder = {
        id: orderId, user_id: userId, pair, side, type,
        price: numPrice, amount: numAmount, filled: 0, remaining: numAmount,
      };

      // ── Run matching engine ──────────────────────────────────────────────────
      const { trades, filledAmount, remainingAmount } = await matchOrder(conn, newOrder);

      // ── Settle each trade ────────────────────────────────────────────────────
      // Execution price rule: trade executes at the MAKER's price.
      // For a BUY taker: maker price ≤ order price, so we deduct vndCost from balance
      // but release vndReserved (= order.price × qty) from locked — freeing the savings.
      for (const trade of trades) {
        // Credit tokens to buyer
        await creditMint(trade.buyerId, tokenType, trade.amount, conn);

        // Deduct tokens from seller's locked balance
        await conn.execute(
          `UPDATE user_balances
           SET locked_balance = locked_balance - ?, balance = balance - ?
           WHERE user_id = ? AND token_type = ?`,
          [trade.amount, trade.amount, trade.sellerId, tokenType]
        );

        const vndCost = trade.price * trade.amount;

        // Buyer's VND settlement:
        // - Release the reserved amount (at lock price) from vnd_locked
        // - Deduct the actual cost (at trade price) from vnd_balance
        // When trade.price < lockPrice (buyer got a better price), the difference
        // is immediately freed into the buyer's available VND balance.
        const buyerLockPrice = (side === 'buy' && trade.buyerId === userId)
          ? vndLockPrice           // taker buy: locked at order/market price
          : trade.price;           // maker buy: locked exactly at their own price
        const vndReservedForTrade = buyerLockPrice * trade.amount;

        await conn.execute(
          `UPDATE wallets
           SET vnd_balance = vnd_balance - ?,
               vnd_locked  = vnd_locked  - ?
           WHERE user_id = ?`,
          [vndCost, vndReservedForTrade, trade.buyerId]
        );

        // Credit VND to seller
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [vndCost, trade.sellerId]
        );
      }

      // ── Determine final order status ─────────────────────────────────────────
      // PENDING → OPEN            (no fills, sits in book)
      // PENDING → PARTIALLY_FILLED (some fills, remainder sits in book)
      // PENDING → FILLED           (fully matched immediately)
      // PENDING → CANCELLED        (market order — unfilled remainder discarded)
      let newStatus;
      if (remainingAmount <= 0) {
        newStatus = 'filled';
      } else if (type === 'market') {
        // Market orders: cancel unfilled portion, release remaining VND/token lock
        newStatus = 'cancelled';
        if (side === 'buy' && remainingAmount > 0) {
          // Release VND lock for unfilled portion (at lock price)
          const vndReleaseForUnfilled = vndLockPrice * remainingAmount;
          // Also refund any price-improvement savings already released above
          // vndLocked remaining = vndLocked - sum(vndReservedForTrade)
          // We just release the lock for unfilled qty; the rest was released per-trade above
          await conn.execute(
            `UPDATE wallets SET vnd_locked = vnd_locked - ? WHERE user_id = ?`,
            [vndReleaseForUnfilled, userId]
          );
        } else if (side === 'sell' && remainingAmount > 0) {
          await unlockBalance(userId, tokenType, remainingAmount, conn);
        }
      } else {
        newStatus = filledAmount > 0 ? 'partial' : 'open';
      }

      await conn.execute(
        `UPDATE orders SET filled = ?, remaining = ?, status = ?, updated_at = NOW() WHERE id = ?`,
        [filledAmount, remainingAmount, newStatus, orderId]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: `order:place:${side}:${type}`,
        entityType: 'order', entityId: orderId,
        newData: { pair, side, type, price: numPrice, amount: numAmount, trades: trades.length },
        ...auditMeta(req),
      });

      res.status(201).json({
        success:   true,
        id:        orderId,
        status:    newStatus,
        filled:    filledAmount,
        remaining: remainingAmount,
        trades:    trades.length,
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

// ── Cancel order ─────────────────────────────────────────────────────────────

export const cancelOrder = async (req, res) => {
  try {
    const userId  = req.user?.id;
    const orderId = req.params.id;

    const [[order]] = await db.execute(
      `SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1`,
      [orderId, userId]
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['open', 'partial', 'partially_filled'].includes(order.status)) {
      return res.status(409).json({ message: `Cannot cancel an order with status: ${order.status}` });
    }

    const tokenType   = TOKEN_OF[order.pair];
    const unfilledAmt = Number(order.remaining);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (order.side === 'sell') {
        await unlockBalance(userId, tokenType, unfilledAmt, conn);
      } else {
        // Release VND locked for the unfilled portion at order price
        const vndToRelease = Number(order.price) * unfilledAmt;
        await conn.execute(
          `UPDATE wallets SET vnd_locked = vnd_locked - ? WHERE user_id = ?`,
          [vndToRelease, userId]
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

// ── Read ──────────────────────────────────────────────────────────────────────

export const getOpenOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pair } = req.query;
    const where  = pair ? `AND pair = ?` : '';
    const params = pair ? [userId, pair] : [userId];
    const [rows] = await db.execute(
      `SELECT * FROM orders WHERE user_id = ? ${where} AND status IN ${ACTIVE_STATUSES}
       ORDER BY created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// All open BUY orders from any trader — visible to farmers so they can sell into them
export const getAllBuyOrders = async (req, res) => {
  try {
    const { pair } = req.query;
    const whereClause = pair ? `AND o.pair = ?` : '';
    const params = pair ? [pair] : [];
    const [rows] = await db.execute(
      `SELECT o.id, o.pair, o.price, o.amount, o.filled, o.remaining,
              o.status, o.created_at,
              u.full_name AS trader_name, u.email AS trader_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.side = 'buy' ${whereClause} AND o.status IN ${ACTIVE_STATUSES}
       ORDER BY o.price DESC, o.created_at ASC`,
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
       WHERE pair = ? AND status IN ${ACTIVE_STATUSES}
       GROUP BY side, price
       ORDER BY side, price`,
      [pair]
    );
    const bids = rows.filter(r => r.side === 'buy')
                     .map(r => ({ price: Number(r.price), amount: Number(r.total_remaining) }))
                     .sort((a, b) => b.price - a.price);
    const asks = rows.filter(r => r.side === 'sell')
                     .map(r => ({ price: Number(r.price), amount: Number(r.total_remaining) }))
                     .sort((a, b) => a.price - b.price);
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
      `SELECT
         t.pair,
         MAX(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN t.price END) AS high,
         MIN(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN t.price END) AS low,
         COALESCE(SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN t.amount ELSE 0 END), 0) AS volume,
         (SELECT t2.price FROM trades t2 WHERE t2.pair = t.pair ORDER BY t2.created_at DESC LIMIT 1) AS last_price,
         (SELECT t2.price FROM trades t2 WHERE t2.pair = t.pair AND t2.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY t2.created_at DESC LIMIT 1) AS price_24h_ago
       FROM trades t
       GROUP BY t.pair`
    );
    const data = rows.map(r => {
      const last      = Number(r.last_price   || 0);
      const old       = Number(r.price_24h_ago || 0);
      const change24h = old > 0 ? ((last - old) / old) * 100 : 0;
      return {
        pair:       r.pair,
        last_price: last,
        high:       Number(r.high   || last),
        low:        Number(r.low    || last),
        volume:     Number(r.volume || 0),
        change_24h: Number(change24h.toFixed(2)),
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPublicMarketChart = async (req, res) => {
  try {
    const { token = 'all', time = '24h' } = req.query;

    const TIME_CFG = {
      '1h':  { ms: 1   * 3600 * 1000,      secs: 60          },
      '24h': { ms: 24  * 3600 * 1000,      secs: 30 * 60     },
      '7d':  { ms: 7   * 24 * 3600 * 1000, secs: 4  * 3600   },
      '30d': { ms: 30  * 24 * 3600 * 1000, secs: 86400       },
      '90d': { ms: 90  * 24 * 3600 * 1000, secs: 3  * 86400  },
      '1y':  { ms: 365 * 24 * 3600 * 1000, secs: 7  * 86400  },
    };

    const cfg   = TIME_CFG[time] || TIME_CFG['24h'];
    const since = new Date(Date.now() - cfg.ms);

    const ALL_PAIRS = ['CR1/VND', 'CR2/VND', 'CR3/VND'];
    const pairs     = token === 'all' ? ALL_PAIRS : [`${token.toUpperCase()}/VND`];
    const result    = {};

    for (const pair of pairs) {
      const key = pair.split('/')[0];
      const [tradeRows] = await db.execute(
        `SELECT price, amount, created_at FROM trades
         WHERE pair = ? AND created_at >= ?
         ORDER BY created_at ASC LIMIT 5000`,
        [pair, since]
      );

      if (!tradeRows.length) { result[key] = []; continue; }

      const buckets = {};
      for (const t of tradeRows) {
        const ts  = Math.floor(new Date(t.created_at).getTime() / 1000);
        const bkt = Math.floor(ts / cfg.secs) * cfg.secs;
        const p = Number(t.price), v = Number(t.amount);
        if (!buckets[bkt]) {
          buckets[bkt] = { open: p, high: p, low: p, close: p, volume: v };
        } else {
          buckets[bkt].high   = Math.max(buckets[bkt].high, p);
          buckets[bkt].low    = Math.min(buckets[bkt].low, p);
          buckets[bkt].close  = p;
          buckets[bkt].volume += v;
        }
      }

      result[key] = Object.entries(buckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, c]) => c);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('getPublicMarketChart error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMyTokenBalances = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT token_type, available_balance, locked_balance, balance
       FROM user_balances WHERE user_id = ?`,
      [userId]
    );
    const data = {};
    rows.forEach(r => {
      data[r.token_type] = {
        available: Number(r.available_balance || 0),
        locked:    Number(r.locked_balance    || 0),
        total:     Number(r.balance           || 0),
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('getMyTokenBalances error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
