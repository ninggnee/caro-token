-- Migration v4: Warehouse Document Storage System
-- Stores IPFS CIDs and metadata for warehouse compliance documents.
-- Files are stored on IPFS (Infura); only CID + metadata live in DB.

CREATE TABLE IF NOT EXISTS warehouse_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  warehouse_id    INT          NULL,               -- NULL = not linked to a specific warehouse
  document_type   VARCHAR(64)  NOT NULL,           -- see DOCUMENT_TYPES below
  document_name   VARCHAR(255) NOT NULL,           -- original file name (sanitized)
  description     TEXT         NULL,
  cid             VARCHAR(255) NULL,               -- Infura IPFS CIDv0 (Qm...)
  file_size       BIGINT       NOT NULL DEFAULT 0, -- bytes
  mime_type       VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by     INT          NOT NULL,           -- users.id
  status          ENUM('active','deleted') NOT NULL DEFAULT 'active',
  blockchain_tx   VARCHAR(255) NULL,               -- tx_hash if CID recorded on-chain
  blockchain_at   DATETIME     NULL,               -- when it was recorded on-chain
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_warehouse_id (warehouse_id),
  INDEX idx_uploaded_by  (uploaded_by),
  INDEX idx_status       (status),
  INDEX idx_document_type(document_type),
  UNIQUE KEY uq_cid (cid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valid document_type values (enforced by backend, not DB ENUM so new types are easy to add):
-- warehouse_license
-- inspection_report
-- warehouse_certificate
-- warehouse_insurance
-- warehouse_ownership_proof
-- warehouse_photos
-- coffee_storage_report
-- warehouse_receipt
-- other

-- Foreign key notes:
-- warehouse_id references warehouses.id (add FK after confirming warehouses table exists)
-- uploaded_by references users.id (add FK after confirming users table exists)
-- ALTER TABLE warehouse_documents ADD CONSTRAINT fk_wd_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
-- ALTER TABLE warehouse_documents ADD CONSTRAINT fk_wd_user      FOREIGN KEY (uploaded_by)  REFERENCES users(id)      ON DELETE RESTRICT;
