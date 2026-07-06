/**
 * BalanceService — atomic available/locked token balance operations.
 *
 * user_balances columns:
 *   balance           — legacy total (kept for backward compat)
 *   available_balance — tokens free to trade / redeem
 *   locked_balance    — tokens reserved for open orders or pending redeems
 *
 * Every write uses a MySQL transaction so concurrent requests cannot
 * produce double-spend or negative balances.
 */

import db from '../config/db.js';

// ── Internal helpers ────────────────────────────────────────────────────────

async function getBalanceRow(conn, userId, tokenType) {
  const [[row]] = await conn.execute(
    `SELECT id, available_balance, locked_balance, balance
     FROM user_balances
     WHERE user_id = ? AND token_type = ?
     FOR UPDATE`,
    [userId, tokenType]
  );
  return row || null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Credit available_balance after a successful on-chain mint.
 * Also keeps legacy `balance` column in sync.
 */
export async function creditMint(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    await c.execute(
      `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         balance           = balance           + VALUES(balance),
         available_balance = available_balance + VALUES(available_balance)`,
      [userId, tokenType, amount, amount]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Credit `locked_balance` directly (and the legacy `balance` total) without
 * ever touching `available_balance`. Used when tokens enter a balance
 * already LOCKED from the moment they arrive — e.g. an escrow account that
 * receives Token gathered from other holders for an L/C contract, which
 * must show as locked immediately, never as spendable/available.
 */
export async function creditLocked(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    await c.execute(
      `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
       VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE
         balance        = balance        + VALUES(balance),
         locked_balance = locked_balance + VALUES(locked_balance)`,
      [userId, tokenType, amount, amount]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Lock `amount` tokens (available → locked).
 * Used when: placing a sell order, creating a redeem request.
 *
 * @throws if available_balance < amount
 */
export async function lockBalance(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    const row = await getBalanceRow(c, userId, tokenType);
    if (!row) throw new Error(`No balance record for user ${userId} / ${tokenType}`);

    const available = Number(row.available_balance);
    if (available < Number(amount)) {
      throw new Error(`Insufficient available balance: have ${available}, need ${amount}`);
    }

    await c.execute(
      `UPDATE user_balances
       SET available_balance = available_balance - ?,
           locked_balance    = locked_balance    + ?
       WHERE user_id = ? AND token_type = ?`,
      [amount, amount, userId, tokenType]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Unlock `amount` tokens (locked → available).
 * Used when: cancelling an order, rejecting a redeem.
 */
export async function unlockBalance(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    const row = await getBalanceRow(c, userId, tokenType);
    if (!row) throw new Error(`No balance record for user ${userId} / ${tokenType}`);

    const locked = Number(row.locked_balance);
    if (locked < Number(amount)) {
      throw new Error(`Cannot unlock more than locked: have ${locked}, requested ${amount}`);
    }

    await c.execute(
      `UPDATE user_balances
       SET locked_balance    = locked_balance    - ?,
           available_balance = available_balance + ?
       WHERE user_id = ? AND token_type = ?`,
      [amount, amount, userId, tokenType]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Deduct locked balance after a successful on-chain burn.
 * Also keeps legacy `balance` column in sync.
 */
export async function deductLocked(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    const row = await getBalanceRow(c, userId, tokenType);
    if (!row) throw new Error(`No balance record for user ${userId} / ${tokenType}`);

    const locked = Number(row.locked_balance);
    if (locked < Number(amount)) {
      throw new Error(`Cannot deduct more than locked: have ${locked}, need ${amount}`);
    }

    await c.execute(
      `UPDATE user_balances
       SET locked_balance = locked_balance - ?,
           balance        = balance        - ?
       WHERE user_id = ? AND token_type = ?`,
      [amount, amount, userId, tokenType]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Deduct available balance directly (e.g. after a trade fill on buy side).
 */
export async function deductAvailable(userId, tokenType, amount, conn = null) {
  const ownConn = !conn;
  const c = conn || (await db.getConnection());

  try {
    if (ownConn) await c.beginTransaction();

    const row = await getBalanceRow(c, userId, tokenType);
    if (!row) throw new Error(`No balance record for user ${userId} / ${tokenType}`);

    const avail = Number(row.available_balance);
    if (avail < Number(amount)) {
      throw new Error(`Insufficient available balance: have ${avail}, need ${amount}`);
    }

    await c.execute(
      `UPDATE user_balances
       SET available_balance = available_balance - ?,
           balance           = balance           - ?
       WHERE user_id = ? AND token_type = ?`,
      [amount, amount, userId, tokenType]
    );

    if (ownConn) await c.commit();
  } catch (err) {
    if (ownConn) await c.rollback();
    throw err;
  } finally {
    if (ownConn) c.release();
  }
}

/**
 * Read balances for a user (all token types).
 */
export async function getBalances(userId) {
  const [rows] = await db.execute(
    `SELECT token_type, balance, available_balance, locked_balance
     FROM user_balances WHERE user_id = ?`,
    [userId]
  );
  const result = {
    CR1: { total: '0', available: '0', locked: '0' },
    CR2: { total: '0', available: '0', locked: '0' },
    CR3: { total: '0', available: '0', locked: '0' },
  };
  for (const r of rows) {
    result[r.token_type] = {
      total:     String(r.balance),
      available: String(r.available_balance),
      locked:    String(r.locked_balance),
    };
  }
  return result;
}

export default { creditMint, creditLocked, lockBalance, unlockBalance, deductLocked, deductAvailable, getBalances };
