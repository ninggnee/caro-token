/**
 * LCEscrowService — the "bank gathers + locks Token" step (BƯỚC 3–4) of an
 * L/C contract.
 *
 * The Trader never selects a Batch and none of their own Token is touched
 * (LOAN/DISCOUNT-style locking of the requester's own balance does NOT
 * apply here). Instead the bank buys circulating Token from whichever
 * other holders on the platform currently have available balance — exactly
 * the same Token-fungibility model already used by Collateral Loan /
 * Discounting (no Batch attachment), just applied across MANY holders
 * instead of one.
 *
 * Money flow: each source holder is paid market price for the Token the
 * bank takes from them (their available_balance is debited, their VND
 * wallet is credited) — this happens here, at gather time. "Release
 * Payment" later in the contract lifecycle is a separate compliance
 * milestone (Oracle confirms on-board + documents complete) and does not
 * re-pay anyone — see lcController.js for that step's rationale.
 */

import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { deductAvailable, creditLocked, deductLocked } from './BalanceService.js';
import { ensureWallet } from '../controllers/walletController.js';
import { getStats } from './MockMarketEngine.js';

const TOKEN_TYPES = ['CR1', 'CR2', 'CR3'];
const ESCROW_EMAIL = 'lc-escrow@caro.internal';

/**
 * Find or create the system account that custodies LOCKED Token on behalf
 * of the bank for all L/C contracts. Not a real person — `is_active = 0`
 * so it can never log in; only ever referenced as a `user_id` for balance
 * bookkeeping and as `escrow_user_id` on `lc_contracts`.
 */
export async function getOrCreateEscrowUser(conn = db) {
  const [[existing]] = await conn.execute(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [ESCROW_EMAIL]
  );
  if (existing) return existing.id;

  // Random, unusable password hash — this account is never meant to log in.
  const randomHash = await bcrypt.hash(`${Date.now()}-${Math.random()}`, 10);

  const [result] = await conn.execute(
    `INSERT INTO users (email, password_hash, full_name, role, kyc_status, is_active)
     VALUES (?, ?, ?, 'admin', 'approved', 0)`,
    [ESCROW_EMAIL, randomHash, 'Ví Escrow L/C (hệ thống)']
  );
  return result.insertId;
}

function currentPrice(stats, tokenType) {
  return Number(stats.find(s => s.token === tokenType)?.last_price || 0);
}

/**
 * Gather `weightKg` worth of Token (1 kg = 1 Token) from circulating
 * supply — any holder except `excludeUserId` (the requesting Trader) —
 * paying each source holder market price, then lock everything gathered
 * into the escrow account.
 *
 * @returns {{ escrowUserId, totalLocked, breakdown: [{sourceUserId, tokenType, quantity, price, paymentAmount}] }}
 * @throws if the platform doesn't have enough circulating Token to fill the request
 */
export async function gatherAndLockTokens({ contractId, excludeUserId, weightKg }, conn) {
  const needed = Number(weightKg);
  const stats = getStats();

  const [holders] = await conn.execute(
    `SELECT user_id, token_type, available_balance
     FROM user_balances
     WHERE available_balance > 0 AND user_id != ? AND token_type IN (${TOKEN_TYPES.map(() => '?').join(',')})
     ORDER BY available_balance DESC`,
    [excludeUserId, ...TOKEN_TYPES]
  );

  let remaining = needed;
  const breakdown = [];

  for (const holder of holders) {
    if (remaining <= 0) break;
    const avail = Number(holder.available_balance);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    breakdown.push({
      sourceUserId: holder.user_id,
      tokenType: holder.token_type,
      quantity: take,
      price: currentPrice(stats, holder.token_type),
    });
    remaining -= take;
  }

  if (remaining > 0.0001) {
    const gathered = needed - remaining;
    const err = new Error(
      `Không đủ Token đang lưu hành trên nền tảng để gom đủ ${needed.toLocaleString('vi-VN')} kg ` +
      `(chỉ gom được ${gathered.toLocaleString('vi-VN')} kg từ các ví hiện có).`
    );
    err.code = 'INSUFFICIENT_LIQUIDITY';
    throw err;
  }

  const escrowUserId = await getOrCreateEscrowUser(conn);

  let totalLocked = 0;
  for (const item of breakdown) {
    const paymentAmount = item.quantity * item.price;

    // Buy the Token from its current holder: available_balance -= qty, paid in VND.
    await deductAvailable(item.sourceUserId, item.tokenType, item.quantity, conn);
    await ensureWallet(item.sourceUserId, conn);
    await conn.execute(
      `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
      [paymentAmount, item.sourceUserId]
    );

    // Move it straight into the escrow account's LOCKED balance.
    await creditLocked(escrowUserId, item.tokenType, item.quantity, conn);

    await conn.execute(
      `INSERT INTO lc_token_locks (contract_id, source_user_id, token_type, quantity, price_at_lock, payment_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contractId, item.sourceUserId, item.tokenType, item.quantity, item.price, paymentAmount]
    );

    item.paymentAmount = paymentAmount;
    totalLocked += item.quantity;
  }

  return { escrowUserId, totalLocked, breakdown };
}

/**
 * Burn (permanently remove) everything the escrow account holds LOCKED for
 * one contract — called on final delivery confirmation (BƯỚC 7).
 */
export async function burnEscrowTokens(contractId, escrowUserId, conn) {
  const [locks] = await conn.execute(
    `SELECT token_type, SUM(quantity) AS qty FROM lc_token_locks WHERE contract_id = ? GROUP BY token_type`,
    [contractId]
  );
  const { deductLocked } = await import('./BalanceService.js');
  for (const row of locks) {
    await deductLocked(escrowUserId, row.token_type, Number(row.qty), conn);
  }
}
