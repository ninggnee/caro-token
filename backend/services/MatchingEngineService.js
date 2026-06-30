/**
 * MatchingEngineService — order matching for CaRo token exchange.
 *
 * Supported order types: LIMIT only (Part 4).
 * Separate markets: CR1/VND, CR2/VND, CR3/VND.
 * Cross-grade matching is explicitly prevented (CR1 never matches CR2 or CR3).
 *
 * Algorithm: Price-Time Priority (FIFO within same price level).
 *   BUY  side: highest bid matched first
 *   SELL side: lowest ask matched first
 *
 * This service is called inside a MySQL transaction that covers both
 * the order table and the balance table to prevent double-spend.
 */

/**
 * Match a new order against existing open opposite-side orders.
 *
 * @param {object}     conn      Active MySQL connection (inside transaction)
 * @param {object}     order     Newly inserted order row
 * @returns {Array<object>}      List of trade objects that were created
 */
export async function matchOrder(conn, order) {
  const { id: orderId, user_id, pair, side, price, remaining, type } = order;
  const trades = [];

  // Only limit and market orders are matched
  if (type !== 'limit' && type !== 'market') return { trades, filledAmount: 0, remainingAmount: Number(remaining) };

  // Opposite side to match against
  const oppSide = side === 'buy' ? 'sell' : 'buy';

  // Price condition:
  //   BUY  order: we want asks  ≤ our bid  (cheapest asks first)
  //   SELL order: we want bids  ≥ our ask  (highest bids first)
  const priceCondition = side === 'buy' ? 'price <= ?' : 'price >= ?';
  const priceOrder     = side === 'buy' ? 'ASC'       : 'DESC';

  // Fetch open opposite orders for same pair, price-priority then time-priority
  const [candidates] = await conn.execute(
    `SELECT * FROM orders
     WHERE pair = ? AND side = ? AND status IN ('open','partial') AND ${priceCondition}
     ORDER BY price ${priceOrder}, created_at ASC
     FOR UPDATE`,
    [pair, oppSide, price]
  );

  let myRemaining = Number(remaining);

  for (const opp of candidates) {
    if (myRemaining <= 0) break;

    const oppRemaining = Number(opp.remaining);
    const tradeAmount  = Math.min(myRemaining, oppRemaining);
    const tradePrice   = Number(opp.price); // maker price

    // Determine buyer / seller
    const buyerId  = side === 'buy'  ? user_id    : opp.user_id;
    const sellerId = side === 'sell' ? user_id    : opp.user_id;
    const buyOrdId = side === 'buy'  ? orderId    : opp.id;
    const sellOrdId= side === 'sell' ? orderId    : opp.id;

    // Insert trade record
    const [tr] = await conn.execute(
      `INSERT INTO trades (pair, side, price, amount, buyer_id, seller_id, created_at)
       VALUES (?, 'buy', ?, ?, ?, ?, NOW())`,
      [pair, tradePrice, tradeAmount, buyerId, sellerId]
    );

    trades.push({
      id: tr.insertId, pair, price: tradePrice, amount: tradeAmount, buyerId, sellerId,
    });

    // Update opposing order
    const oppNewFilled    = Number(opp.filled) + tradeAmount;
    const oppNewRemaining = Number(opp.remaining) - tradeAmount;
    const oppNewStatus    = oppNewRemaining <= 0 ? 'filled' : 'partial';
    await conn.execute(
      `UPDATE orders SET filled = ?, remaining = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [oppNewFilled, oppNewRemaining, oppNewStatus, opp.id]
    );

    myRemaining -= tradeAmount;
  }

  return { trades, filledAmount: Number(remaining) - myRemaining, remainingAmount: myRemaining };
}

export default { matchOrder };
