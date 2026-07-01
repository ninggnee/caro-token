import db from '../config/db.js';
import { getOnChainBalance } from '../services/BlockchainService.js';

const TOKEN_TYPES = ['CR1', 'CR2', 'CR3'];

/**
 * GET /api/admin/sync/status
 * Compares on-chain balances vs DB balances for all farmers with registered wallets.
 * Non-destructive read-only check.
 */
export const getSyncStatus = async (req, res) => {
  try {
    const [farmers] = await db.execute(
      `SELECT id, email, full_name, wallet_address FROM users
       WHERE role = 'farmer' AND wallet_address IS NOT NULL AND wallet_address != ''`
    );

    const rows = [];

    for (const farmer of farmers) {
      for (const tokenType of TOKEN_TYPES) {
        let onChainStr = '0';
        let fetchError = null;

        try {
          onChainStr = await getOnChainBalance(tokenType, farmer.wallet_address);
        } catch (err) {
          fetchError = err.message;
        }

        const [[dbRow]] = await db.execute(
          `SELECT balance, available_balance, locked_balance
           FROM user_balances WHERE user_id = ? AND token_type = ?`,
          [farmer.id, tokenType]
        );

        const onChainNum = parseFloat(onChainStr);
        const dbBal      = dbRow ? parseFloat(dbRow.balance)            : 0;
        const dbAvail    = dbRow ? parseFloat(dbRow.available_balance)  : 0;
        const dbLocked   = dbRow ? parseFloat(dbRow.locked_balance)     : 0;

        rows.push({
          userId:      farmer.id,
          email:       farmer.email,
          name:        farmer.full_name,
          wallet:      farmer.wallet_address,
          tokenType,
          onChain:     onChainNum,
          dbBalance:   dbBal,
          dbAvailable: dbAvail,
          dbLocked,
          mismatch:    !fetchError && Math.abs(onChainNum - dbBal) > 0.000001,
          error:       fetchError,
        });
      }
    }

    res.json({
      farmerCount: farmers.length,
      mismatches:  rows.filter(r => r.mismatch).length,
      errors:      rows.filter(r => r.error).length,
      rows,
    });
  } catch (err) {
    console.error('[adminSync] getSyncStatus error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/admin/sync/apply
 * Overwrites user_balances for farmers to match on-chain balances from the new contracts.
 * Caps locked_balance to on-chain amount to preserve open order locks.
 */
export const applySyncBalances = async (req, res) => {
  try {
    const [farmers] = await db.execute(
      `SELECT id, email, full_name, wallet_address FROM users
       WHERE role = 'farmer' AND wallet_address IS NOT NULL AND wallet_address != ''`
    );

    const report  = [];
    let updated   = 0;
    let unchanged = 0;
    let errors    = 0;

    for (const farmer of farmers) {
      for (const tokenType of TOKEN_TYPES) {
        let onChainStr = '0';

        try {
          onChainStr = await getOnChainBalance(tokenType, farmer.wallet_address);
        } catch (err) {
          report.push({ email: farmer.email, tokenType, status: 'error', error: err.message });
          errors++;
          continue;
        }

        const onChainNum = parseFloat(onChainStr);

        const [[dbRow]] = await db.execute(
          `SELECT balance, locked_balance
           FROM user_balances WHERE user_id = ? AND token_type = ?`,
          [farmer.id, tokenType]
        );

        const dbBal    = dbRow ? parseFloat(dbRow.balance)        : 0;
        const dbLocked = dbRow ? parseFloat(dbRow.locked_balance) : 0;

        // Locked can't exceed on-chain amount; available = on-chain - locked
        const newLocked    = Math.min(dbLocked, onChainNum);
        const newAvailable = Math.max(0, onChainNum - newLocked);
        const changed      = Math.abs(onChainNum - dbBal) > 0.000001 || Math.abs(newLocked - dbLocked) > 0.000001;

        await db.execute(
          `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             balance           = VALUES(balance),
             available_balance = VALUES(available_balance),
             locked_balance    = VALUES(locked_balance)`,
          [farmer.id, tokenType, onChainNum, newAvailable, newLocked]
        );

        if (changed) {
          report.push({ email: farmer.email, tokenType, status: 'updated', before: dbBal, after: onChainNum });
          updated++;
        } else {
          report.push({ email: farmer.email, tokenType, status: 'ok', balance: onChainNum });
          unchanged++;
        }
      }
    }

    res.json({
      message:      `Đồng bộ hoàn tất: ${updated} cập nhật, ${unchanged} giữ nguyên, ${errors} lỗi.`,
      farmerCount:  farmers.length,
      updated,
      unchanged,
      errors,
      report,
    });
  } catch (err) {
    console.error('[adminSync] applySyncBalances error:', err);
    res.status(500).json({ message: err.message });
  }
};
