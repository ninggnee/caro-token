import db           from '../config/db.js';
import { getBalances } from '../services/BalanceService.js';

// GET /api/farmer/dashboard
export const getDashboard = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // 1. Token balances from user_balances table — reliable, updated atomically on every mint
    const tokenBalances = await getBalances(userId);

    // 2. Batch counts by status — single query instead of 3 separate frontend calls
    const [batchRows] = await db.execute(
      `SELECT status, COUNT(*) AS count FROM asset_batches WHERE farmer_id = ? GROUP BY status`,
      [userId]
    );
    const batchStats = { PENDING_MINT_APPROVAL: 0, APPROVED: 0, MINTED: 0, REJECTED: 0 };
    for (const row of batchRows) {
      batchStats[row.status] = Number(row.count);
    }

    // 3. VND wallet balance — ensure row exists then read it
    let vndBalance = 0;
    let vndLocked  = 0;
    try {
      await db.execute(
        `INSERT IGNORE INTO wallets (user_id, vnd_balance, vnd_locked, pending_withdraw)
         VALUES (?, 0, 0, 0)`,
        [userId]
      );
      const [[wallet]] = await db.execute(
        `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      if (wallet) {
        vndBalance = Number(wallet.vnd_balance);
        vndLocked  = Number(wallet.vnd_locked);
      }
    } catch (_) { /* wallets table may not exist in dev — safe to skip */ }

    res.json({
      success: true,
      // Flat format required by the spec: { caro1, caro2, caro3 }
      tokenBalances: {
        caro1: Number(tokenBalances.CR1?.total ?? 0),
        caro2: Number(tokenBalances.CR2?.total ?? 0),
        caro3: Number(tokenBalances.CR3?.total ?? 0),
      },
      // Full breakdown: available / locked per token type
      tokenDetails: tokenBalances,
      batchStats,
      vndWallet: {
        balance:   vndBalance,
        locked:    vndLocked,
        available: vndBalance - vndLocked,
      },
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/farmer/token-holdings
export const getTokenHoldings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const tokenBalances = await getBalances(userId);

    // Minted batch records for provenance/audit trail
    const [mintedBatches] = await db.execute(
      `SELECT batch_id, quality_grade, minted_amount, tx_hash, minted_at
       FROM asset_batches
       WHERE farmer_id = ? AND status = 'MINTED'
       ORDER BY minted_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      holdings: {
        caro1: Number(tokenBalances.CR1?.total ?? 0),
        caro2: Number(tokenBalances.CR2?.total ?? 0),
        caro3: Number(tokenBalances.CR3?.total ?? 0),
      },
      details: tokenBalances,
      mintedBatches,
    });
  } catch (err) {
    console.error('getTokenHoldings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
