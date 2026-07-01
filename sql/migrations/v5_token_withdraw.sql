-- Create withdraw_requests table if it does not exist
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT           NOT NULL,
  amount         DECIMAL(20,2) NOT NULL,
  bank_name      VARCHAR(128)  DEFAULT NULL,
  account_number VARCHAR(64)   DEFAULT NULL,
  account_name   VARCHAR(128)  DEFAULT NULL,
  status         ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by    INT           DEFAULT NULL,
  reviewed_at    DATETIME      DEFAULT NULL,
  note           TEXT          DEFAULT NULL,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alter withdraw_requests to support token withdrawals
ALTER TABLE withdraw_requests ADD COLUMN token_type VARCHAR(64) DEFAULT NULL;
ALTER TABLE withdraw_requests ADD COLUMN destination_address VARCHAR(128) DEFAULT NULL;
ALTER TABLE withdraw_requests ADD COLUMN tx_hash VARCHAR(128) DEFAULT NULL;

-- Create abnormal_activities table to log security alerts
CREATE TABLE IF NOT EXISTS abnormal_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  activity_type VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
