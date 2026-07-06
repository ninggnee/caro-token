-- v8: Separate original quantity from post-processing net quantity
-- quantity stays as the original farmer-submitted weight
-- net_quantity stores the weight after processing loss (used for token minting & storage)
--
-- NOTE: this file originally used "ADD COLUMN IF NOT EXISTS" (MySQL 8.0.29+
-- syntax). That syntax was found to fail with ER_PARSE_ERROR against this
-- project's actual database despite it reporting version 8.0.34, meaning this
-- migration never actually applied successfully through that path. Rewritten
-- to use a portable idempotency pattern (information_schema.COLUMNS check +
-- dynamic SQL) that was verified to work — see v9_asset_batch_gps_logistics.sql
-- for the same pattern and full run instructions (must be executed via the
-- text query protocol, e.g. mysql2 pool.query()/connection.query(), not
-- execute()/prepared-statement APIs).
--
-- Idempotent: safe to re-run any number of times. Does not modify existing data.

-- net_quantity
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'net_quantity');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN net_quantity DECIMAL(18,4) NULL COMMENT ''Khoi luong tinh sau chuan hoa (tru hao hut che bien)''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- processing_loss_pct
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_batches' AND COLUMN_NAME = 'processing_loss_pct');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE asset_batches ADD COLUMN processing_loss_pct DECIMAL(5,2) NULL COMMENT ''Ty le hao hut che bien (%)''', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
