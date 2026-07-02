/**
 * MatchingEngineService — Price-Time Priority matching for CaRo token exchange.
 *
 * Supported order types: LIMIT, MARKET.
 * Separate markets: CR1/VND, CR2/VND, CR3/VND.
 * Cross-grade matching is explicitly prevented (CR1 never matches CR2 or CR3).
 *
 * Algorithm: Price-Time Priority (FIFO within same price level).
 *   BUY  side: lowest ask matched first  (best price for buyer)
 *   SELL side: highest bid matched first (best price for seller)
 *
 * Execution price rule: trades execute at the MAKER (resting) order's price,
 * not the taker's price. A buyer's limit price is only a maximum — if a seller
 * is resting at a lower price, the buyer gets the better price.
 *
 * This service runs inside a MySQL transaction covering both the orders and
 * balances tables to prevent double-spend or race conditions.
 */

/**
 * Match a newly inserted order against existing open opposite-side orders.
 *
 * @param {object} conn   Active MySQL connection (inside a transaction)
 * @param {object} order  The newly inserted order row (status = 'pending')
 * @returns {{ trades, filledAmount, remainingAmount }}
 */
export async function matchOrder(conn, order) {
  const { id: orderId, user_id, pair, side, price, remaining, type } = order;
  const trades = [];

  if (type !== 'limit' && type !== 'market') {
    return { trades, filledAmount: 0, remainingAmount: Number(remaining) };
  }

  const oppSide = side === 'buy' ? 'sell' : 'buy';

  // Price-priority:
  //   BUY  taker → match SELL makers with ask  ≤ bid,  lowest ask  first (best for buyer)
  //   SELL taker → match BUY  makers with bid  ≥ ask,  highest bid first (best for seller)
  const priceCondition = side === 'buy' ? 'price <= ?' : 'price >= ?';
  const priceOrder     = side === 'buy' ? 'ASC'        : 'DESC';

  // Fetch resting opposite-side orders: price priority then time priority (FIFO).
  // FOR UPDATE locks the rows so concurrent transactions cannot touch them.
  const [candidates] = await conn.execute(
    `SELECT * FROM orders
     WHERE pair = ? AND side = ? AND status IN ('open','partial','partially_filled') AND ${priceCondition}
     ORDER BY price ${priceOrder}, created_at ASC
     FOR UPDATE`,
    [pair, oppSide, price]
  );

  let myRemaining = Number(remaining);

  for (const opp of candidates) {
    if (myRemaining <= 0) break;

    const oppRemaining = Number(opp.remaining);
    const tradeAmount  = Math.min(myRemaining, oppRemaining);
    const tradePrice   = Number(opp.price); // execution at MAKER price (resting order)

    const buyerId   = side === 'buy'  ? user_id : opp.user_id;
    const sellerId  = side === 'sell' ? user_id : opp.user_id;
    const buyOrdId  = side === 'buy'  ? orderId : opp.id;
    const sellOrdId = side === 'sell' ? orderId : opp.id;

    const [tr] = await conn.execute(
      `INSERT INTO trades (pair, side, price, amount, buyer_id, seller_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [pair, side, tradePrice, tradeAmount, buyerId, sellerId]
    );

    trades.push({
      id: tr.insertId, pair, price: tradePrice, amount: tradeAmount,
      buyerId, sellerId,
    });

    // Update the resting (maker) order's filled/remaining/status
    const oppNewFilled    = Number(opp.filled) + tradeAmount;
    const oppNewRemaining = oppRemaining - tradeAmount;
    const oppNewStatus    = oppNewRemaining <= 0 ? 'filled' : 'partial';

    await conn.execute(
      `UPDATE orders SET filled = ?, remaining = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [oppNewFilled, oppNewRemaining, oppNewStatus, opp.id]
    );

    myRemaining -= tradeAmount;
  }

  const filledAmount = Number(remaining) - myRemaining;
  return { trades, filledAmount, remainingAmount: myRemaining };
}

export default { matchOrder };
