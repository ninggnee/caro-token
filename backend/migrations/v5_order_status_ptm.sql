-- v5_order_status_ptm.sql
-- Implements price-time priority matching spec:
-- 1. Adds 'market' to orders.type ENUM
-- 2. Keeps status values compatible with existing code (partial stays)
-- 3. Adds buy_order_id / sell_order_id to trades table for auditability

ALTER TABLE orders
  MODIFY COLUMN type
    ENUM('limit','market') NOT NULL DEFAULT 'limit';

ALTER TABLE trades ADD COLUMN buy_order_id  INT NULL AFTER seller_id;
ALTER TABLE trades ADD COLUMN sell_order_id INT NULL AFTER buy_order_id;
