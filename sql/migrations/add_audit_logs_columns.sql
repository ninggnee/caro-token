-- Migration: extend audit_logs to full schema expected by AuditService.js
-- Run once on any database that still has the old schema (id, actor_id, action, meta, created_at).

ALTER TABLE `audit_logs`
  ADD COLUMN IF NOT EXISTS `entity_type` varchar(64)  DEFAULT NULL AFTER `action`,
  ADD COLUMN IF NOT EXISTS `entity_id`   int          DEFAULT NULL AFTER `entity_type`,
  ADD COLUMN IF NOT EXISTS `old_data`    json         DEFAULT NULL AFTER `entity_id`,
  ADD COLUMN IF NOT EXISTS `new_data`    json         DEFAULT NULL AFTER `old_data`,
  ADD COLUMN IF NOT EXISTS `ip_address`  varchar(64)  DEFAULT NULL AFTER `new_data`,
  ADD COLUMN IF NOT EXISTS `user_agent`  varchar(512) DEFAULT NULL AFTER `ip_address`;

-- Useful index for the admin logs page filter (entity_type + action)
CREATE INDEX IF NOT EXISTS `idx_audit_entity` ON `audit_logs` (`entity_type`, `entity_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_actor`  ON `audit_logs` (`actor_id`);
