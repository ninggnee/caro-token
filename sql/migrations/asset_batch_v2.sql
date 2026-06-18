USE caro_token;

-- ============================================================
-- Asset Batch v2 Migration
-- Adds: batch_documents table, batch_description, removes
-- hard dependency on coffee_type (now always ROBUSTA).
-- ============================================================

-- 1. Khởi tạo bảng asset_batches nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS asset_batches (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  batch_id          VARCHAR(64)    NOT NULL UNIQUE,
  farmer_id          INT            NOT NULL,
  farmer_wallet      VARCHAR(255)   DEFAULT NULL,
  coffee_type        VARCHAR(64)    DEFAULT 'ROBUSTA',
  quantity           DECIMAL(12,4)  NOT NULL,
  quality_grade      ENUM('CR1','CR2','CR3') NOT NULL DEFAULT 'CR1',
  harvest_date      DATE           DEFAULT NULL,
  storage_location  VARCHAR(256)   DEFAULT NULL,
  estimated_value    DECIMAL(20,2)  DEFAULT NULL,
  batch_description TEXT           DEFAULT NULL,
  status            VARCHAR(64)    DEFAULT 'PENDING_MINT_APPROVAL',
  rejection_reason  TEXT           DEFAULT NULL,
  rejected_at       DATETIME       DEFAULT NULL,
  reviewed_by        INT            DEFAULT NULL,
  approved_at       DATETIME       DEFAULT NULL,
  minted_amount      DECIMAL(18,4)  DEFAULT NULL,
  tx_hash            VARCHAR(255)   DEFAULT NULL,
  block_number       INT            DEFAULT NULL,
  minted_at          DATETIME       DEFAULT NULL,
  created_at         DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_farmer_id (farmer_id),
  INDEX idx_status    (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Cập nhật bổ sung cột cho bảng asset_batches cũ
-- Đã loại bỏ hoàn toàn "IF NOT EXISTS" để sửa lỗi 1064. 
-- (Lưu ý: Nếu một trong các cột này đã có từ trước, MySQL sẽ báo Duplicate - cậu có thể bỏ qua vì đích đến là cột đã có trong DB).
ALTER TABLE asset_batches
  ADD COLUMN batch_description TEXT          DEFAULT NULL,
  ADD COLUMN reviewed_by       INT           DEFAULT NULL,
  ADD COLUMN approved_at       DATETIME      DEFAULT NULL,
  ADD COLUMN rejected_at       DATETIME      DEFAULT NULL,
  ADD COLUMN rejection_reason  TEXT          DEFAULT NULL,
  ADD COLUMN minted_amount     DECIMAL(18,4) DEFAULT NULL,
  ADD COLUMN tx_hash           VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN block_number      INT           DEFAULT NULL,
  ADD COLUMN minted_at         DATETIME      DEFAULT NULL;

-- 2b. Thêm cột phone / address vào users nếu chưa có
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone   VARCHAR(20)  DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address  VARCHAR(512) DEFAULT NULL;

-- 3. Tạo bảng lưu trữ tài liệu minh chứng đi kèm mẻ hàng (6 categories bắt buộc)
CREATE TABLE IF NOT EXISTS batch_documents (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  batch_id      VARCHAR(64)  NOT NULL,
  document_type VARCHAR(64)  NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(512) DEFAULT NULL,
  ipfs_cid      VARCHAR(255) DEFAULT NULL,
  uploaded_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;