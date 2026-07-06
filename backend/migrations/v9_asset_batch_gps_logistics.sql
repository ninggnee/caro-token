-- v9: Track GPS / logistics / traceability columns on asset_batches that were
-- previously added to the live database out-of-band (ad-hoc ALTER TABLE during
-- development) and were never captured in any migration file. This migration
-- makes the tracked schema match what backend/controllers/AssetBatchController.js
-- and backend/services/SimulationDaemon.js already read/write in production:
--   farm_coords, estimated_yield, crop_year, farming_method, production_diary,
--   traceability_info, logistics_status, moisture_content, defect_rate,
--   temperature_sensor, humidity_sensor, ipfs_cid.
--
-- IMPORTANT — why this doesn't use "ADD COLUMN IF NOT EXISTS":
-- Despite this project's DB reporting itself as MySQL 8.0.34 (which should
-- support that MySQL 8.0.29+ syntax), it was verified NOT to work against the
-- actual running instance (ER_PARSE_ERROR). The same failure was confirmed on
-- the pre-existing v8_net_quantity.sql, meaning that migration never actually
-- applied successfully via this syntax either. This file instead uses a
-- portable, dialect-safe idempotency pattern (information_schema.COLUMNS
-- existence check + dynamic SQL via PREPARE/EXECUTE) that works on any
-- MySQL/MariaDB-compatible server, verified working on this database.
--
-- HOW TO RUN:
-- The SET/PREPARE/EXECUTE/DEALLOCATE sequence below requires the plain text
-- query protocol — it will fail with "This command is not supported in the
-- prepared statement protocol yet" if executed through mysql2's execute()
-- (prepared-statement) API. Run it with a client/driver call that uses the
-- text protocol, e.g. mysql2's pool.query()/connection.query(), the mysql CLI,
-- or any GUI client (Adminer/phpMyAdmin/Workbench). Each statement below must
-- be sent individually and in order (no DELIMITER directive is needed since
-- there is no stored routine body).
--
-- Idempotent: safe to re-run any number of times — each column is only added
-- if information_schema shows it doesn't already exist. Does not modify or
-- delete any existing data.

-- farm_coords
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'farm_coords');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN farm_coords TEXT NULL COMMENT ''GPS polygon snapshot (JSON array of lat,lng points) captured from the farmer profile at batch creation time''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- estimated_yield
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'estimated_yield');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN estimated_yield DECIMAL(12,4) NULL COMMENT ''Farmer-declared estimated yield captured at batch creation''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- crop_year
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'crop_year');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN crop_year VARCHAR(64) NULL COMMENT ''Crop or harvest year declared at batch creation''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- farming_method
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'farming_method');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN farming_method VARCHAR(128) NULL COMMENT ''Farming method declared at batch creation''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- production_diary
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'production_diary');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN production_diary TEXT NULL COMMENT ''Free-text production diary supplied at batch creation''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- traceability_info
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'traceability_info');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN traceability_info TEXT NULL COMMENT ''Free-text traceability info supplied at batch creation''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- logistics_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'logistics_status');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN logistics_status VARCHAR(64) NULL DEFAULT ''PENDING_PICKUP'' COMMENT ''Logistics pipeline stage, independent of the mint-approval status column''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- moisture_content
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'moisture_content');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN moisture_content DECIMAL(5,2) NULL DEFAULT 13.50 COMMENT ''Moisture content percent recorded at inspection''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- defect_rate
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'defect_rate');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN defect_rate DECIMAL(5,2) NULL DEFAULT 2.50 COMMENT ''Defect rate percent recorded at inspection - grading only, never deducted from minted quantity''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- temperature_sensor
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'temperature_sensor');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN temperature_sensor DECIMAL(5,2) NULL DEFAULT 26.50 COMMENT ''Warehouse temperature sensor reading in Celsius''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- humidity_sensor
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'humidity_sensor');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN humidity_sensor DECIMAL(5,2) NULL DEFAULT 68.00 COMMENT ''Warehouse humidity sensor reading percent''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ipfs_cid
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'ipfs_cid');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN ipfs_cid VARCHAR(256) NULL COMMENT ''Legacy column, not used by current asset_batches code path - IPFS CIDs now live on batch_documents.ipfs_cid''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
