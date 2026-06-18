/**
 * AuditService — centralised audit logging.
 *
 * Every significant action (mint, burn, redeem, KYC, login, etc.)
 * must be recorded here.  Call logAction() — do NOT write to
 * audit_logs directly from controllers.
 *
 * Schema (from migration):
 *   id, actor_id, action, entity_type, entity_id,
 *   old_data (JSON), new_data (JSON),
 *   ip_address, user_agent, created_at
 */

import db from '../config/db.js';

/**
 * @param {object} params
 * @param {number|null}  params.actorId      User performing the action
 * @param {string}       params.action       e.g. 'token_request:mint'
 * @param {string|null}  params.entityType   e.g. 'token_request', 'redeem', 'user'
 * @param {number|null}  params.entityId     DB row id of the affected entity
 * @param {object|null}  params.oldData      Snapshot before the change
 * @param {object|null}  params.newData      Snapshot after the change
 * @param {string|null}  params.ipAddress    Caller IP (from req.ip)
 * @param {string|null}  params.userAgent    User-Agent header
 */
export async function logAction({
  actorId    = null,
  action,
  entityType = null,
  entityId   = null,
  oldData    = null,
  newData    = null,
  ipAddress  = null,
  userAgent  = null,
}) {
  try {
    await db.execute(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        actorId,
        action,
        entityType,
        entityId,
        oldData   ? JSON.stringify(oldData)  : null,
        newData   ? JSON.stringify(newData)  : null,
        ipAddress,
        userAgent,
        // keep `meta` column populated for backward compat
        JSON.stringify({ entityType, entityId, ...newData }),
      ]
    );
  } catch (err) {
    // Audit log failure must never crash the main flow
    console.error('[AuditService] Failed to write audit log:', err.message);
  }
}

/**
 * Extract IP and UA from an Express request object.
 */
export function auditMeta(req) {
  return {
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
    userAgent: req?.headers?.['user-agent'] || null,
  };
}

export default { logAction, auditMeta };
