import db from '../config/db.js';
import { getBalances } from '../services/BalanceService.js';
import { getOnChainBalance } from '../services/BlockchainService.js';

// How long to wait for on-chain reads before falling back to DB values.
const ON_CHAIN_TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('on-chain read timeout')), ms)
    ),
  ]);
}

// GET /api/farmer/dashboard
export const getDashboard = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // All DB reads in parallel for speed
    const [tokenBalances, batchRows, walletRow, userRow] = await Promise.all([
      getBalances(userId),

      db.execute(
        `SELECT status, COUNT(*) AS count FROM asset_batches WHERE farmer_id = ? GROUP BY status`,
        [userId]
      ).then(([rows]) => rows),

      db.execute(
        `INSERT IGNORE INTO wallets (user_id, vnd_balance, vnd_locked, pending_withdraw) VALUES (?, 0, 0, 0)`,
        [userId]
      ).then(() =>
        db.execute(
          `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? LIMIT 1`,
          [userId]
        )
      ).then(([[row]]) => row || { vnd_balance: 0, vnd_locked: 0 })
       .catch(() => ({ vnd_balance: 0, vnd_locked: 0 })),

      db.execute(
        `SELECT wallet_address FROM users WHERE id = ? LIMIT 1`,
        [userId]
      ).then(([[row]]) => row),
    ]);

    const batchStats = { PENDING_MINT_APPROVAL: 0, APPROVED: 0, MINTED: 0, REJECTED: 0 };
    for (const row of batchRows) batchStats[row.status] = Number(row.count);

    // On-chain balances from new contracts — parallel reads with timeout.
    // Non-fatal: if RPC is unavailable we fall back to DB values.
    let onChainBalances = null;
    const walletAddr = userRow?.wallet_address;

    if (walletAddr && /^0x[0-9a-fA-F]{40}$/.test(walletAddr)) {
      try {
        const [c1, c2, c3] = await withTimeout(
          Promise.all([
            getOnChainBalance('CR1', walletAddr).catch(() => null),
            getOnChainBalance('CR2', walletAddr).catch(() => null),
            getOnChainBalance('CR3', walletAddr).catch(() => null),
          ]),
          ON_CHAIN_TIMEOUT_MS
        );

        if (c1 !== null || c2 !== null || c3 !== null) {
          onChainBalances = {
            caro1: c1 !== null ? Number(c1) : null,
            caro2: c2 !== null ? Number(c2) : null,
            caro3: c3 !== null ? Number(c3) : null,
          };
        }
      } catch (_) {
        // Timeout or RPC down — onChainBalances stays null, frontend uses DB
      }
    }

    res.json({
      success: true,
      // DB exchange balances (used for locked/available breakdown + trading)
      tokenBalances: {
        caro1: Number(tokenBalances.CR1?.total ?? 0),
        caro2: Number(tokenBalances.CR2?.total ?? 0),
        caro3: Number(tokenBalances.CR3?.total ?? 0),
      },
      // On-chain balances from NEW contracts — authoritative display value.
      // null when farmer has no registered wallet or RPC unavailable.
      onChainBalances,
      tokenDetails: tokenBalances,
      batchStats,
      vndWallet: {
        balance:   Number(walletRow.vnd_balance),
        locked:    Number(walletRow.vnd_locked),
        available: Number(walletRow.vnd_balance) - Number(walletRow.vnd_locked),
      },
      dataSource: onChainBalances ? 'on-chain' : 'db',
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
