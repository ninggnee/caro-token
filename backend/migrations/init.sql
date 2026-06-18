-- Initial migrations for caro_token

CREATE TABLE IF NOT EXISTS kyc_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  front_path VARCHAR(512),
  back_path VARCHAR(512),
  status VARCHAR(32) DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS token_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role VARCHAR(64) DEFAULT 'farmer',
  lot_id VARCHAR(128) DEFAULT NULL,
  kg_amount DECIMAL(18,4) NOT NULL,
  token_amount DECIMAL(18,4) NOT NULL,
  grade VARCHAR(64) DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mint_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_request_id INT NOT NULL,
  minted_by INT NULL,
  minted_amount DECIMAL(18,4) NOT NULL,
  tx_hash VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pair VARCHAR(64) NOT NULL,
  side VARCHAR(8) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  amount DECIMAL(18,4) NOT NULL,
  buyer_id INT NULL,
  seller_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS redeem_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  kg_amount DECIMAL(18,4) NOT NULL,
  token_amount DECIMAL(18,4) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  processed_by INT NULL,
  processed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  action VARCHAR(128) NOT NULL,
  meta JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Ensure user_wallets (if not already created at runtime)
CREATE TABLE IF NOT EXISTS user_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role VARCHAR(64) NOT NULL,
  wallet_address VARCHAR(255),
  UNIQUE KEY ux_user_role (user_id, role)
) ENGINE=InnoDB;

-- Add indexes where helpful
ALTER TABLE token_requests ADD INDEX idx_user_id (user_id);
ALTER TABLE token_requests ADD INDEX idx_status (status);
ALTER TABLE kyc_requests ADD INDEX idx_status (status);
ALTER TABLE redeem_requests ADD INDEX idx_status (status);


-- End of migrations
