import db from '../config/db.js';

export const getTickers = async (req, res) => {
  try {
    // For MVP, return static tickers based on minted tokens and simple last trade
    const [rows] = await db.execute(`SELECT pair, price, amount, created_at FROM trades ORDER BY created_at DESC LIMIT 10`);
    // group by pair -> take last
    const map = {};
    for (const r of rows) {
      if (!map[r.pair]) map[r.pair] = { lastPrice: r.price, volume: 0 };
      map[r.pair].volume += Number(r.amount);
    }
    const data = Object.keys(map).map(k => ({ pair: k, price: map[k].lastPrice, volume: map[k].volume }));
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrderbook = async (req, res) => {
  try {
    const pair = req.query.pair || 'CaRo1/VND';
    // Simple mock: aggregate trades to produce bids/asks
    const [rows] = await db.execute(`SELECT side, price, amount FROM trades WHERE pair = ? ORDER BY created_at DESC LIMIT 200`, [pair]);
    const bids = {};
    const asks = {};
    for (const r of rows) {
      const p = r.price.toString();
      if (r.side === 'buy') bids[p] = (bids[p] || 0) + Number(r.amount);
      else asks[p] = (asks[p] || 0) + Number(r.amount);
    }
    const bidsArr = Object.entries(bids).map(([price, amount]) => ({ price: Number(price), amount }));
    const asksArr = Object.entries(asks).map(([price, amount]) => ({ price: Number(price), amount }));
    bidsArr.sort((a,b)=>b.price-a.price);
    asksArr.sort((a,b)=>a.price-b.price);
    res.json({ success: true, data: { pair, bids: bidsArr, asks: asksArr } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listTrades = async (req, res) => {
  try {
    const pair = req.query.pair || null;
    const q = pair ? `WHERE pair = ?` : '';
    const params = pair ? [pair] : [];
    const [rows] = await db.execute(`SELECT * FROM trades ${q} ORDER BY created_at DESC LIMIT 200`, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
