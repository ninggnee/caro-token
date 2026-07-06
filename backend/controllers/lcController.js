/**
 * lcController — Digital L/C ("Nhận nông sản thực tế") simulation.
 *
 * Replaces the old single-Batch "Đổi hàng hóa" (redeem) flow. Like
 * Collateral Loan / Token Discounting, an L/C contract is never tied to
 * one fixed Batch — the Trader never selects a Batch, and the bank gathers
 * circulating Token from whichever holders currently have it (see
 * LCEscrowService.gatherAndLockTokens).
 *
 * Admin plays the Bank's back-office role here (same Prototype convention
 * as financeController.js's collateral-loan/discounting review endpoints)
 * — this is not a CaRo administrative function, and no new "bank" role is
 * introduced (still exactly trader/farmer/admin).
 */

import db from '../config/db.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { ensureWallet } from './walletController.js';
import { generateDepositRate } from '../services/LCRiskService.js';
import { gatherAndLockTokens, burnEscrowTokens } from '../services/LCEscrowService.js';
import { getStats } from '../services/MockMarketEngine.js';
import { listPartnerBanks, getPlan } from '../services/LCPartnerBankService.js';
import {
  LC_STATUS,
  LC_PAYMENT_METHOD,
  LC_PAYMENT_STATUS,
  LC_DELIVERY_STATUS,
  LC_ORACLE_COMPLETION_STATUS,
  LC_ORACLE_CATEGORY,
  LC_ONBOARD_CODE,
  LC_REQUIRED_DOCUMENT_TYPES,
  LC_SYSTEM_MILESTONES,
  findOracleEvent,
} from '../constants/lcStatus.js';

const TOKEN_TYPES = ['CR1', 'CR2', 'CR3'];

function blendedUnitPrice() {
  const stats = getStats();
  const prices = TOKEN_TYPES
    .map(t => Number(stats.find(s => s.token === t)?.last_price || 0))
    .filter(p => p > 0);
  if (!prices.length) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/** Insert a system-generated Timeline milestone (category='system') — see LC_SYSTEM_MILESTONES. */
async function insertMilestone(conn, contractId, milestone, note, actorId) {
  await conn.execute(
    `INSERT INTO lc_oracle_events (contract_id, category, status_code, status_label, note, created_by)
     VALUES (?, 'system', ?, ?, ?, ?)`,
    [contractId, milestone.code, milestone.label, note || null, actorId]
  );
}

/**
 * Whether the full Oracle attestation bundle is done: at least one
 * Warehouse event, at least one Quality event, Logistics reaching
 * On-board, AND every required document type uploaded.
 */
async function computeOracleCompletion(contractId, conn) {
  const c = conn || db;
  const [[wh]] = await c.execute(`SELECT COUNT(*) n FROM lc_oracle_events WHERE contract_id = ? AND category = 'warehouse'`, [contractId]);
  const [[ql]] = await c.execute(`SELECT COUNT(*) n FROM lc_oracle_events WHERE contract_id = ? AND category = 'quality'`, [contractId]);
  const [[lg]] = await c.execute(
    `SELECT status_code FROM lc_oracle_events WHERE contract_id = ? AND category = 'logistics' ORDER BY created_at DESC, id DESC LIMIT 1`,
    [contractId]
  );
  const [docs] = await c.execute(
    `SELECT DISTINCT document_type FROM warehouse_documents WHERE lc_contract_id = ? AND status = 'active'`,
    [contractId]
  );
  const uploaded = new Set(docs.map(d => d.document_type));
  const docsComplete = LC_REQUIRED_DOCUMENT_TYPES.every(t => uploaded.has(t));
  const onboardDone = lg?.status_code === LC_ONBOARD_CODE;
  return (Number(wh.n) > 0 && Number(ql.n) > 0 && onboardDone && docsComplete)
    ? LC_ORACLE_COMPLETION_STATUS.COMPLETED
    : LC_ORACLE_COMPLETION_STATUS.IN_PROGRESS;
}

/**
 * Recomputes `oracle_completion_status` for a contract and, if Oracle +
 * payment + delivery are now ALL satisfied, auto-advances the contract
 * from ACTIVE → READY_TO_CLOSE (recording a Timeline milestone). This does
 * NOT burn Token or close the contract — that only happens when the Admin
 * explicitly confirms via completeLCContract.
 *
 * Called after every Oracle event, every relevant document upload, and
 * every payment-completing action, from whichever of those three arrives
 * last (Oracle events, documents, and payment settlement can happen in
 * any order).
 */
export async function recomputeLCReadiness(contractId, actorId, conn) {
  const c = conn || db;
  const [[contract]] = await c.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [contractId]);
  if (!contract || contract.status !== LC_STATUS.ACTIVE) return;

  const newOracleStatus = await computeOracleCompletion(contractId, c);
  if (newOracleStatus !== contract.oracle_completion_status) {
    await c.execute(`UPDATE lc_contracts SET oracle_completion_status = ? WHERE id = ?`, [newOracleStatus, contractId]);
    contract.oracle_completion_status = newOracleStatus;
  }

  const ready = contract.oracle_completion_status === LC_ORACLE_COMPLETION_STATUS.COMPLETED
             && contract.payment_status === LC_PAYMENT_STATUS.COMPLETED
             && contract.delivery_status === LC_DELIVERY_STATUS.DELIVERED;

  if (ready) {
    await insertMilestone(c, contractId, LC_SYSTEM_MILESTONES.READY_TO_CLOSE, null, actorId);
    await c.execute(`UPDATE lc_contracts SET status = ?, ready_to_close_at = NOW() WHERE id = ?`, [LC_STATUS.READY_TO_CLOSE, contractId]);
  }
}

/** GET /api/lc/partner-banks — deferred-payment plan catalogue (Trader + Admin) */
export const listLCPartnerBanks = (req, res) => {
  res.json({ success: true, data: listPartnerBanks() });
};

// ══════════════════════════════════════════════════════════════
//  TRADER — request + own view
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/lc/contracts
 * Trader requests to receive a given weight of produce. Contract value and
 * deposit are computed from the live blended market price; the deposit
 * rate is generated once here (10–20%, weighted by contract size) and
 * persisted — never regenerated afterwards.
 */
export const createLCContract = async (req, res) => {
  try {
    const traderId = req.user?.id;
    if (!traderId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { requested_weight_kg } = req.body;
    if (!requested_weight_kg || Number(requested_weight_kg) <= 0) {
      return res.status(400).json({ success: false, message: 'requested_weight_kg must be > 0' });
    }
    const weightKg = Number(requested_weight_kg);

    const unitPrice = blendedUnitPrice();
    if (unitPrice <= 0) {
      return res.status(503).json({ success: false, message: 'Không lấy được giá thị trường' });
    }

    const contractValue = weightKg * unitPrice;
    const depositRate = generateDepositRate(weightKg);
    const depositAmount = contractValue * depositRate;
    const bankFundingAmount = contractValue - depositAmount;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await ensureWallet(traderId, conn);
      const [[wallet]] = await conn.execute(
        `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
        [traderId]
      );
      const available = Number(wallet?.vnd_balance || 0) - Number(wallet?.vnd_locked || 0);
      if (available < depositAmount) {
        await conn.rollback();
        return res.status(422).json({
          success: false,
          message: `Số dư ví VND không đủ để ký quỹ. Cần ${depositAmount.toLocaleString('vi-VN')} VND, hiện có ${available.toLocaleString('vi-VN')} VND`,
        });
      }

      await conn.execute(
        `UPDATE wallets SET vnd_balance = vnd_balance - ? WHERE user_id = ?`,
        [depositAmount, traderId]
      );

      const [result] = await conn.execute(
        `INSERT INTO lc_contracts
           (trader_id, requested_weight_kg, unit_price, contract_value, deposit_rate, deposit_amount, bank_funding_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [traderId, weightKg, unitPrice, contractValue, depositRate, depositAmount, bankFundingAmount, LC_STATUS.PENDING_BANK_APPROVAL]
      );

      await conn.commit();

      await logAction({
        actorId: traderId, action: 'lc:contract:create',
        entityType: 'lc_contract', entityId: result.insertId,
        newData: { requested_weight_kg: weightKg, contract_value: contractValue, deposit_rate: depositRate, deposit_amount: depositAmount, actor_role: req.user?.role },
        ...auditMeta(req),
      });

      res.status(201).json({
        success: true, id: result.insertId,
        unit_price: unitPrice, contract_value: contractValue,
        deposit_rate: depositRate, deposit_amount: depositAmount, bank_funding_amount: bankFundingAmount,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('createLCContract error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** GET /api/lc/contracts — Trader's own contracts */
export const listMyLCContracts = async (req, res) => {
  try {
    const traderId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT * FROM lc_contracts WHERE trader_id = ? ORDER BY created_at DESC`,
      [traderId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listMyLCContracts error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** GET /api/lc/contracts/:id — Trader's own contract detail + Oracle timeline */
export const getMyLCContractDetail = async (req, res) => {
  try {
    const traderId = req.user?.id;
    const id = Number(req.params.id);
    const [[contract]] = await db.execute(
      `SELECT * FROM lc_contracts WHERE id = ? AND trader_id = ? LIMIT 1`,
      [id, traderId]
    );
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });

    const [events] = await db.execute(
      `SELECT * FROM lc_oracle_events WHERE contract_id = ? ORDER BY created_at ASC, id ASC`,
      [id]
    );
    res.json({ success: true, data: contract, events });
  } catch (err) {
    console.error('getMyLCContractDetail error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PATCH /api/lc/contracts/:id/payment-method
 * BƯỚC 4 — once Token is locked, the Trader chooses how to settle the
 * bank's funding contribution:
 *   - 'immediate': Trader pays bank_funding_amount right now — obligation
 *     closes immediately (payment_status → COMPLETED).
 *   - 'deferred': Trader picks a partner-bank financing plan; due_date is
 *     computed from the plan, payment_status → AWAITING_PAYMENT until the
 *     bank later confirms settlement (see adminSettleCredit).
 * Either way the contract moves from TOKENS_LOCKED → ACTIVE, unlocking
 * Oracle updates (BƯỚC 5).
 */
export const selectPaymentMethod = async (req, res) => {
  try {
    const traderId = req.user?.id;
    const id = Number(req.params.id);
    const { method, partner_bank, plan_key } = req.body;

    const [[contract]] = await db.execute(
      `SELECT * FROM lc_contracts WHERE id = ? AND trader_id = ? LIMIT 1`,
      [id, traderId]
    );
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });
    if (contract.status !== LC_STATUS.TOKENS_LOCKED) {
      return res.status(409).json({ success: false, message: `Contract must have Token locked before choosing a payment method (current: '${contract.status}')` });
    }

    if (method === LC_PAYMENT_METHOD.IMMEDIATE) {
      const fundedAmount = Number(contract.bank_funding_amount);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await ensureWallet(traderId, conn);
        const [[wallet]] = await conn.execute(
          `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
          [traderId]
        );
        const available = Number(wallet?.vnd_balance || 0) - Number(wallet?.vnd_locked || 0);
        if (available < fundedAmount) {
          await conn.rollback();
          return res.status(422).json({
            success: false,
            message: `Số dư ví VND không đủ để thanh toán ngay. Cần ${fundedAmount.toLocaleString('vi-VN')} VND, hiện có ${available.toLocaleString('vi-VN')} VND`,
          });
        }
        await conn.execute(`UPDATE wallets SET vnd_balance = vnd_balance - ? WHERE user_id = ?`, [fundedAmount, traderId]);
        await conn.execute(
          `UPDATE lc_contracts
           SET status = ?, payment_method = ?, payment_status = ?,
               payment_method_selected_at = NOW(), payment_completed_at = NOW()
           WHERE id = ?`,
          [LC_STATUS.ACTIVE, LC_PAYMENT_METHOD.IMMEDIATE, LC_PAYMENT_STATUS.COMPLETED, id]
        );
        await insertMilestone(conn, id, LC_SYSTEM_MILESTONES.PAYMENT_COMPLETED, null, traderId);
        await recomputeLCReadiness(id, traderId, conn);
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: traderId, action: 'lc:contract:payment_method_immediate',
        entityType: 'lc_contract', entityId: id,
        newData: { payment_method: LC_PAYMENT_METHOD.IMMEDIATE, amount_paid: fundedAmount, actor_role: req.user?.role },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Đã thanh toán toàn bộ vốn ngân hàng tài trợ. Nghĩa vụ tài chính hoàn tất.' });
    }

    if (method === LC_PAYMENT_METHOD.DEFERRED) {
      const plan = getPlan(partner_bank, plan_key);
      if (!plan) {
        return res.status(400).json({ success: false, message: 'Ngân hàng đối tác hoặc gói trả chậm không hợp lệ' });
      }
      await db.execute(
        `UPDATE lc_contracts
         SET status = ?, payment_method = ?, partner_bank = ?, financing_plan = ?,
             due_date = DATE_ADD(CURDATE(), INTERVAL ? DAY), payment_status = ?,
             payment_method_selected_at = NOW()
         WHERE id = ?`,
        [LC_STATUS.ACTIVE, LC_PAYMENT_METHOD.DEFERRED, plan.bankName, plan.label, plan.days, LC_PAYMENT_STATUS.AWAITING_PAYMENT, id]
      );

      await logAction({
        actorId: traderId, action: 'lc:contract:payment_method_deferred',
        entityType: 'lc_contract', entityId: id,
        newData: { payment_method: LC_PAYMENT_METHOD.DEFERRED, partner_bank: plan.bankName, financing_plan: plan.label, days: plan.days, actor_role: req.user?.role },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: `Đã chọn mua trả chậm qua ${plan.bankName} (${plan.label}). Trader được nhận hàng ngay sau khi Oracle xác nhận On-board.` });
    }

    res.status(400).json({ success: false, message: 'method must be immediate | deferred' });
  } catch (err) {
    console.error('selectPaymentMethod error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════
//  ADMIN (Bank simulation) — approve/reject, gather+lock, Oracle, payment, delivery
// ══════════════════════════════════════════════════════════════

/** GET /api/lc/admin/contracts */
export const adminListLCContracts = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.*, u.full_name AS trader_name, u.email AS trader_email
       FROM lc_contracts c
       JOIN users u ON c.trader_id = u.id
       ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('adminListLCContracts error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** GET /api/lc/admin/contracts/:id — full detail: contract + timeline + token sources + audit history */
export const adminGetLCContractDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[contract]] = await db.execute(
      `SELECT c.*, u.full_name AS trader_name, u.email AS trader_email, u.phone AS trader_phone,
              p.full_name AS processed_by_name
       FROM lc_contracts c
       JOIN users u ON c.trader_id = u.id
       LEFT JOIN users p ON c.processed_by = p.id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });

    const [events] = await db.execute(
      `SELECT e.*, a.full_name AS created_by_name
       FROM lc_oracle_events e
       LEFT JOIN users a ON e.created_by = a.id
       WHERE e.contract_id = ? ORDER BY e.created_at ASC, e.id ASC`,
      [id]
    );
    const [tokenLocks] = await db.execute(
      `SELECT tl.*, u.full_name AS source_user_name, u.email AS source_user_email
       FROM lc_token_locks tl
       LEFT JOIN users u ON tl.source_user_id = u.id
       WHERE tl.contract_id = ? ORDER BY tl.id ASC`,
      [id]
    );
    const [history] = await db.execute(
      `SELECT a.id, a.actor_id, u.full_name AS actor_name, u.email AS actor_email,
              a.action, a.old_data, a.new_data, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type = 'lc_contract' AND a.entity_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
      [id]
    );

    res.json({ success: true, data: contract, events, tokenLocks, history });
  } catch (err) {
    console.error('adminGetLCContractDetail error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PATCH /api/lc/admin/contracts/:id/review
 * BƯỚC 2 — bank approve/reject. Approve just records the credit decision
 * (funding amount was already computed at creation); reject refunds the
 * Trader's deposit and ends the contract.
 */
export const reviewLCContract = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const actorRole = req.user?.role;
    const id = Number(req.params.id);
    const { action, note } = req.body;

    const [[contract]] = await db.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [id]);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });

    if (action === 'reject') {
      if (contract.status !== LC_STATUS.PENDING_BANK_APPROVAL) {
        return res.status(409).json({ success: false, message: `Cannot reject a contract in '${contract.status}' status` });
      }
      if (!note || !String(note).trim()) {
        return res.status(400).json({ success: false, message: 'rejection reason (note) is required' });
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        // Refund the deposit — the bank never took custody of anything.
        await ensureWallet(contract.trader_id, conn);
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [contract.deposit_amount, contract.trader_id]
        );
        await conn.execute(
          `UPDATE lc_contracts SET status = ?, admin_note = ?, rejection_reason = ?, processed_by = ? WHERE id = ?`,
          [LC_STATUS.REJECTED, note, note, adminId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: adminId, action: 'lc:contract:reject',
        entityType: 'lc_contract', entityId: id,
        oldData: { status: contract.status },
        newData: { status: LC_STATUS.REJECTED, rejection_reason: note, refunded_deposit: Number(contract.deposit_amount), actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Đã từ chối, hoàn lại tiền ký quỹ cho Trader' });
    }

    if (action === 'approve') {
      if (contract.status !== LC_STATUS.PENDING_BANK_APPROVAL) {
        return res.status(409).json({ success: false, message: `Cannot approve a contract in '${contract.status}' status` });
      }
      await db.execute(
        `UPDATE lc_contracts SET status = ?, admin_note = ?, processed_by = ?, approved_at = NOW() WHERE id = ?`,
        [LC_STATUS.BANK_APPROVED, note || null, adminId, id]
      );

      await logAction({
        actorId: adminId, action: 'lc:contract:approve',
        entityType: 'lc_contract', entityId: id,
        oldData: { status: contract.status },
        newData: { status: LC_STATUS.BANK_APPROVED, bank_funding_amount: Number(contract.bank_funding_amount), actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Đã phê duyệt, sẵn sàng gom Token' });
    }

    res.status(400).json({ success: false, message: 'action must be approve | reject' });
  } catch (err) {
    console.error('reviewLCContract error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/lc/admin/contracts/:id/gather-lock
 * BƯỚC 3–4 — bank buys circulating Token from whichever holders have it
 * (never the requesting Trader's own balance, never a fixed Batch) and
 * locks everything gathered into the escrow account.
 */
export const gatherAndLockLCContract = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const actorRole = req.user?.role;
    const id = Number(req.params.id);

    const [[contract]] = await db.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [id]);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });
    if (contract.status !== LC_STATUS.BANK_APPROVED) {
      return res.status(409).json({ success: false, message: `Contract must be 'bank_approved' before gathering Token (current: '${contract.status}')` });
    }

    const conn = await db.getConnection();
    let gatherResult;
    try {
      await conn.beginTransaction();
      gatherResult = await gatherAndLockTokens(
        { contractId: id, excludeUserId: contract.trader_id, weightKg: Number(contract.requested_weight_kg) },
        conn
      );
      await conn.execute(
        `UPDATE lc_contracts
         SET status = ?, total_token_locked = ?, total_weight_locked = ?, escrow_user_id = ?, locked_at = NOW()
         WHERE id = ?`,
        [LC_STATUS.TOKENS_LOCKED, gatherResult.totalLocked, gatherResult.totalLocked, gatherResult.escrowUserId, id]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      if (e.code === 'INSUFFICIENT_LIQUIDITY') {
        return res.status(422).json({ success: false, message: e.message });
      }
      throw e;
    } finally {
      conn.release();
    }

    await logAction({
      actorId: adminId, action: 'lc:contract:gather_tokens',
      entityType: 'lc_contract', entityId: id,
      newData: { sources: gatherResult.breakdown.length, total_locked: gatherResult.totalLocked, actor_role: actorRole },
      ...auditMeta(req),
    });
    await logAction({
      actorId: adminId, action: 'lc:contract:lock_tokens',
      entityType: 'lc_contract', entityId: id,
      newData: { status: LC_STATUS.TOKENS_LOCKED, escrow_user_id: gatherResult.escrowUserId, total_locked: gatherResult.totalLocked, actor_role: actorRole },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Đã gom và khóa Token vào ví ký quỹ', total_locked: gatherResult.totalLocked, sources: gatherResult.breakdown.length });
  } catch (err) {
    console.error('gatherAndLockLCContract error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/lc/admin/contracts/:id/oracle-events
 * BƯỚC 5 — Admin (as Oracle) logs a Warehouse/Quality/Logistics update,
 * optionally referencing a document already uploaded via
 * /api/warehouse-documents/upload (see that controller's `lc_contract_id`
 * field).
 */
export const addLCOracleEvent = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const id = Number(req.params.id);
    const { category, status_code, note, document_id, document_hash } = req.body;

    if (!Object.values(LC_ORACLE_CATEGORY).includes(category)) {
      return res.status(400).json({ success: false, message: 'category must be warehouse | quality | logistics' });
    }
    const eventDef = findOracleEvent(category, status_code);
    if (!eventDef) {
      return res.status(400).json({ success: false, message: `status_code '${status_code}' is not valid for category '${category}'` });
    }

    const [[contract]] = await db.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [id]);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });
    if (contract.status !== LC_STATUS.ACTIVE) {
      return res.status(409).json({ success: false, message: `Contract must be active (payment method already chosen) before Oracle updates (current: '${contract.status}')` });
    }

    const isOnboard = category === LC_ORACLE_CATEGORY.LOGISTICS && status_code === LC_ONBOARD_CODE;

    const conn = await db.getConnection();
    let result;
    try {
      await conn.beginTransaction();
      [result] = await conn.execute(
        `INSERT INTO lc_oracle_events (contract_id, category, status_code, status_label, note, document_id, document_hash, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, category, status_code, eventDef.label, note || null, document_id || null, document_hash || null, adminId]
      );
      if (isOnboard) {
        await conn.execute(
          `UPDATE lc_contracts SET oracle_status_code = ?, oracle_status_label = ?, delivery_status = ?, delivered_at = NOW() WHERE id = ?`,
          [status_code, eventDef.label, LC_DELIVERY_STATUS.DELIVERED, id]
        );
      } else {
        await conn.execute(
          `UPDATE lc_contracts SET oracle_status_code = ?, oracle_status_label = ? WHERE id = ?`,
          [status_code, eventDef.label, id]
        );
      }
      await recomputeLCReadiness(id, adminId, conn);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    await logAction({
      actorId: adminId, action: 'lc:oracle:event',
      entityType: 'lc_contract', entityId: id,
      newData: { category, status_code, status_label: eventDef.label, document_id: document_id || null, delivered: isOnboard, actor_role: req.user?.role },
      ...auditMeta(req),
    });

    res.status(201).json({ success: true, id: result.insertId, status_label: eventDef.label, delivered: isOnboard });
  } catch (err) {
    console.error('addLCOracleEvent error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/lc/admin/contracts/:id/settle-credit
 * BƯỚC 6 (trường hợp Mua trả chậm) — bank confirms the Trader's deferred
 * credit obligation has been settled. Debits the Trader's VND wallet by
 * the funded amount (same repay-on-confirm convention as
 * financeController.repayCollateralLoan) and marks payment_status
 * COMPLETED, which — together with delivery_status — is required before
 * the bank can perform the final "hoàn tất" step.
 */
export const adminSettleCredit = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const actorRole = req.user?.role;
    const id = Number(req.params.id);

    const [[contract]] = await db.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [id]);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });
    if (contract.status !== LC_STATUS.ACTIVE || contract.payment_method !== LC_PAYMENT_METHOD.DEFERRED || contract.payment_status !== LC_PAYMENT_STATUS.AWAITING_PAYMENT) {
      return res.status(409).json({ success: false, message: 'Hợp đồng không ở trạng thái chờ tất toán tín dụng trả chậm' });
    }

    const fundedAmount = Number(contract.bank_funding_amount);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ensureWallet(contract.trader_id, conn);
      const [[wallet]] = await conn.execute(
        `SELECT vnd_balance, vnd_locked FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
        [contract.trader_id]
      );
      const available = Number(wallet?.vnd_balance || 0) - Number(wallet?.vnd_locked || 0);
      if (available < fundedAmount) {
        await conn.rollback();
        return res.status(422).json({
          success: false,
          message: `Số dư ví VND của Trader không đủ để tất toán. Cần ${fundedAmount.toLocaleString('vi-VN')} VND, hiện có ${available.toLocaleString('vi-VN')} VND`,
        });
      }
      await conn.execute(`UPDATE wallets SET vnd_balance = vnd_balance - ? WHERE user_id = ?`, [fundedAmount, contract.trader_id]);
      await conn.execute(
        `UPDATE lc_contracts SET payment_status = ?, payment_completed_at = NOW() WHERE id = ?`,
        [LC_PAYMENT_STATUS.COMPLETED, id]
      );
      await insertMilestone(conn, id, LC_SYSTEM_MILESTONES.PAYMENT_COMPLETED, null, adminId);
      await recomputeLCReadiness(id, adminId, conn);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    await logAction({
      actorId: adminId, action: 'lc:contract:settle_credit',
      entityType: 'lc_contract', entityId: id,
      oldData: { payment_status: contract.payment_status },
      newData: { payment_status: LC_PAYMENT_STATUS.COMPLETED, amount_settled: fundedAmount, actor_role: actorRole },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Đã xác nhận tất toán khoản tín dụng trả chậm' });
  } catch (err) {
    console.error('adminSettleCredit error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/lc/admin/contracts/:id/complete
 * BƯỚC 7 — final step, only reachable once the contract has auto-advanced
 * to READY_TO_CLOSE (see recomputeLCReadiness): Oracle attestation bundle
 * complete (warehouse + quality + On-board + all documents), payment
 * obligation fully settled, and delivery confirmed. Re-verifies all three
 * conditions defensively before doing anything irreversible. Burns the
 * escrowed Token — never the Trader's own wallet — and closes the
 * contract. This is a deliberate, separate confirmation step from the
 * conditions becoming true — Token is NOT burned automatically.
 */
export const completeLCContract = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const actorRole = req.user?.role;
    const id = Number(req.params.id);

    const [[contract]] = await db.execute(`SELECT * FROM lc_contracts WHERE id = ? LIMIT 1`, [id]);
    if (!contract) return res.status(404).json({ success: false, message: 'Not found' });

    // Bước 1 — re-verify all three conditions before allowing Burn, even
    // though status === READY_TO_CLOSE should already imply all of them.
    const missing = [];
    if (contract.oracle_completion_status !== LC_ORACLE_COMPLETION_STATUS.COMPLETED) missing.push('Chưa hoàn tất Oracle');
    if (contract.payment_status !== LC_PAYMENT_STATUS.COMPLETED) missing.push('Chưa hoàn tất thanh toán');
    if (contract.delivery_status !== LC_DELIVERY_STATUS.DELIVERED) missing.push('Chưa xác nhận giao hàng');
    if (contract.status !== LC_STATUS.READY_TO_CLOSE || missing.length) {
      return res.status(409).json({
        success: false,
        message: missing.length ? missing.join('; ') : `Hợp đồng chưa sẵn sàng hoàn tất (trạng thái hiện tại: '${contract.status}')`,
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await insertMilestone(conn, id, LC_SYSTEM_MILESTONES.ADMIN_CONFIRMED, null, adminId);
      // Bước 2 — burn from the L/C escrow wallet, never the Trader's own wallet.
      await burnEscrowTokens(id, contract.escrow_user_id, conn);
      await insertMilestone(conn, id, LC_SYSTEM_MILESTONES.TOKENS_BURNED, `Đã đốt ${Number(contract.total_token_locked)} Token`, adminId);
      // Bước 3 — close.
      await conn.execute(`UPDATE lc_contracts SET status = ?, closed_at = NOW() WHERE id = ?`, [LC_STATUS.CLOSED, id]);
      await insertMilestone(conn, id, LC_SYSTEM_MILESTONES.CONTRACT_CLOSED, null, adminId);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    // Bước 4 — audit log (separate from the Timeline milestones above).
    await logAction({
      actorId: adminId, action: 'lc:contract:confirm_completion',
      entityType: 'lc_contract', entityId: id,
      newData: { actor_role: actorRole },
      ...auditMeta(req),
    });
    await logAction({
      actorId: adminId, action: 'lc:contract:burn_tokens',
      entityType: 'lc_contract', entityId: id,
      newData: { total_burned: Number(contract.total_token_locked), escrow_user_id: contract.escrow_user_id, actor_role: actorRole },
      ...auditMeta(req),
    });
    await logAction({
      actorId: adminId, action: 'lc:contract:closed',
      entityType: 'lc_contract', entityId: id,
      newData: { status: LC_STATUS.CLOSED, actor_role: actorRole },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Đã xác nhận hoàn tất. Token đã bị đốt khỏi ví ký quỹ. Hợp đồng đã đóng.' });
  } catch (err) {
    console.error('completeLCContract error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
