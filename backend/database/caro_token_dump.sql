-- NOTE: data rows (INSERT INTO ...) da duoc go khoi file nay.
-- File nay chi con SCHEMA (DDL). Du lieu that chua PII (email, bcrypt hash,
-- so CCCD) khong duoc commit len git. Dump day du phai giu ngoai repo.

-- MySQL dump 10.13  Distrib 9.6.0, for Win64 (x86_64)
--
-- Host: localhost    Database: caro_token
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '7b68f691-11f9-11f1-8a6e-e8cf83d6a67c:1-126559';

--
-- Current Database: `caro_token`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `caro_token` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `caro_token`;

--
-- Table structure for table `asset_batches`
--

DROP TABLE IF EXISTS `asset_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(32) NOT NULL,
  `farmer_id` int NOT NULL,
  `farmer_wallet` varchar(64) DEFAULT NULL,
  `coffee_type` varchar(64) NOT NULL,
  `quantity` decimal(12,4) NOT NULL,
  `quality_grade` enum('CR1','CR2','CR3') NOT NULL DEFAULT 'CR1',
  `harvest_date` date DEFAULT NULL,
  `storage_location` varchar(256) DEFAULT NULL,
  `estimated_value` decimal(20,2) DEFAULT NULL,
  `ipfs_cid` varchar(256) DEFAULT NULL,
  `status` enum('PENDING_MINT_APPROVAL','APPROVED','MINTED','REJECTED') DEFAULT 'PENDING_MINT_APPROVAL',
  `minted_amount` decimal(36,8) DEFAULT NULL,
  `tx_hash` varchar(128) DEFAULT NULL,
  `block_number` int DEFAULT NULL,
  `rejection_reason` text,
  `reviewed_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `approved_at` datetime DEFAULT NULL,
  `minted_at` datetime DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `batch_description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batch_id` (`batch_id`),
  KEY `idx_farmer_id` (`farmer_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_batches`
--

LOCK TABLES `asset_batches` WRITE;
/*!40000 ALTER TABLE `asset_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_id` int DEFAULT NULL,
  `action` varchar(128) NOT NULL,
  `meta` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `entity_type` varchar(64) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=269 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch_documents`
--

DROP TABLE IF EXISTS `batch_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batch_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(64) NOT NULL,
  `document_type` varchar(64) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(512) DEFAULT NULL,
  `ipfs_cid` varchar(255) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch_documents`
--

LOCK TABLES `batch_documents` WRITE;
/*!40000 ALTER TABLE `batch_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `batch_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coffee_lots`
--

DROP TABLE IF EXISTS `coffee_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coffee_lots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lot_code` varchar(64) NOT NULL,
  `parent_submission_id` int DEFAULT NULL,
  `farmer_id` int NOT NULL,
  `warehouse_id` int DEFAULT NULL,
  `weight_kg` decimal(12,4) NOT NULL,
  `grade` enum('CR1','CR2','CR3','REJECTED') DEFAULT NULL,
  `warehouse_confirmed` tinyint(1) DEFAULT '0',
  `warehouse_confirmed_at` datetime DEFAULT NULL,
  `warehouse_confirmed_by` int DEFAULT NULL,
  `inspection_passed` tinyint(1) DEFAULT '0',
  `inspection_passed_at` datetime DEFAULT NULL,
  `status` enum('pending','warehouse_confirmed','inspected','receipt_issued','minted','redeemed','rejected') DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lot_code` (`lot_code`),
  KEY `idx_farmer_id` (`farmer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_parent_submission` (`parent_submission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coffee_lots`
--

LOCK TABLES `coffee_lots` WRITE;
/*!40000 ALTER TABLE `coffee_lots` DISABLE KEYS */;
/*!40000 ALTER TABLE `coffee_lots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `collateral_loans`
--

DROP TABLE IF EXISTS `collateral_loans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collateral_loans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `batch_id` varchar(50) DEFAULT NULL,
  `token_type` varchar(10) NOT NULL,
  `quantity` decimal(18,4) NOT NULL,
  `market_price` decimal(20,2) NOT NULL,
  `collateral_value` decimal(20,2) NOT NULL,
  `ltv` decimal(5,4) NOT NULL DEFAULT '0.7000',
  `max_loan_amount` decimal(20,2) NOT NULL,
  `requested_amount` decimal(20,2) NOT NULL,
  `interest_rate` decimal(5,4) NOT NULL DEFAULT '0.0800',
  `loan_term_months` tinyint NOT NULL DEFAULT '3',
  `status` enum('pending','admin_reviewing','bank_reviewing','approved','disbursed','active','repaid','defaulted','rejected') NOT NULL DEFAULT 'pending',
  `admin_note` text,
  `processed_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL DEFAULT NULL,
  `disbursed_at` timestamp NULL DEFAULT NULL,
  `repaid_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cl_user` (`user_id`),
  KEY `idx_cl_status` (`status`),
  KEY `idx_cl_token` (`token_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collateral_loans`
--

LOCK TABLES `collateral_loans` WRITE;
/*!40000 ALTER TABLE `collateral_loans` DISABLE KEYS */;
/*!40000 ALTER TABLE `collateral_loans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deposit_requests`
--

DROP TABLE IF EXISTS `deposit_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposit_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `proof_image` varchar(500) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `note` text,
  `payment_method` varchar(64) DEFAULT NULL,
  `transaction_code` varchar(32) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_dep_txcode` (`transaction_code`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deposit_requests`
--

LOCK TABLES `deposit_requests` WRITE;
/*!40000 ALTER TABLE `deposit_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `deposit_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inspection_reports`
--

DROP TABLE IF EXISTS `inspection_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inspection_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lot_id` int NOT NULL,
  `inspector_id` int DEFAULT NULL,
  `defect_count` int DEFAULT NULL,
  `moisture_pct` decimal(5,2) DEFAULT NULL,
  `immature_beans` int DEFAULT NULL,
  `sample_weight_g` decimal(8,2) DEFAULT '300.00',
  `screen_size_ok` tinyint(1) DEFAULT '0',
  `grade_result` enum('CR1','CR2','CR3','REJECTED') DEFAULT NULL,
  `passed` tinyint(1) DEFAULT '0',
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lot_id` (`lot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inspection_reports`
--

LOCK TABLES `inspection_reports` WRITE;
/*!40000 ALTER TABLE `inspection_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `inspection_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kyc_requests`
--

DROP TABLE IF EXISTS `kyc_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `id_number` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `document_front` text,
  `document_back` text,
  `selfie` text,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `kyc_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kyc_requests`
--

LOCK TABLES `kyc_requests` WRITE;
/*!40000 ALTER TABLE `kyc_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mint_history`
--

DROP TABLE IF EXISTS `mint_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mint_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token_request_id` int NOT NULL,
  `minted_by` int DEFAULT NULL,
  `minted_amount` decimal(18,4) NOT NULL,
  `tx_hash` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mint_history`
--

LOCK TABLES `mint_history` WRITE;
/*!40000 ALTER TABLE `mint_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `mint_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mock_candles`
--

DROP TABLE IF EXISTS `mock_candles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mock_candles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` varchar(10) NOT NULL,
  `interval_type` enum('1m','5m','15m','1h','1d') NOT NULL,
  `open_time` datetime NOT NULL,
  `close_time` datetime NOT NULL,
  `open_price` decimal(15,2) NOT NULL,
  `high_price` decimal(15,2) NOT NULL,
  `low_price` decimal(15,2) NOT NULL,
  `close_price` decimal(15,2) NOT NULL,
  `volume` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `trade_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_candle` (`token`,`interval_type`,`open_time`),
  KEY `idx_lookup` (`token`,`interval_type`,`open_time`)
) ENGINE=InnoDB AUTO_INCREMENT=36649 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mock_candles`
--

LOCK TABLES `mock_candles` WRITE;
/*!40000 ALTER TABLE `mock_candles` DISABLE KEYS */;
/*!40000 ALTER TABLE `mock_candles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mock_market_stats`
--

DROP TABLE IF EXISTS `mock_market_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mock_market_stats` (
  `token` varchar(10) NOT NULL,
  `last_price` decimal(15,2) NOT NULL,
  `open_price` decimal(15,2) NOT NULL,
  `high_24h` decimal(15,2) NOT NULL,
  `low_24h` decimal(15,2) NOT NULL,
  `volume_24h` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `change_24h` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `trade_count_24h` int NOT NULL DEFAULT '0',
  `market_cap` decimal(24,2) NOT NULL DEFAULT '0.00',
  `stats_date` date NOT NULL DEFAULT '2000-01-01',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mock_market_stats`
--

LOCK TABLES `mock_market_stats` WRITE;
/*!40000 ALTER TABLE `mock_market_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `mock_market_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mock_orders`
--

DROP TABLE IF EXISTS `mock_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mock_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(10) NOT NULL,
  `side` enum('buy','sell') NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `remaining` decimal(15,4) NOT NULL,
  `trader_id` int NOT NULL,
  `status` enum('open','partial','filled','cancelled') NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_book` (`token`,`side`,`status`,`price`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3767 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mock_orders`
--

LOCK TABLES `mock_orders` WRITE;
/*!40000 ALTER TABLE `mock_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `mock_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mock_traders`
--

DROP TABLE IF EXISTS `mock_traders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mock_traders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trader_code` varchar(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trader_code` (`trader_code`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mock_traders`
--

LOCK TABLES `mock_traders` WRITE;
/*!40000 ALTER TABLE `mock_traders` DISABLE KEYS */;
/*!40000 ALTER TABLE `mock_traders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mock_trades`
--

DROP TABLE IF EXISTS `mock_trades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mock_trades` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` varchar(10) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `value` decimal(24,2) NOT NULL,
  `side` enum('buy','sell') NOT NULL DEFAULT 'buy',
  `buyer_trader_id` int DEFAULT NULL,
  `seller_trader_id` int DEFAULT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_token_time` (`token`,`executed_at`)
) ENGINE=InnoDB AUTO_INCREMENT=220 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mock_trades`
--

LOCK TABLES `mock_trades` WRITE;
/*!40000 ALTER TABLE `mock_trades` DISABLE KEYS */;
/*!40000 ALTER TABLE `mock_trades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `pair` varchar(32) NOT NULL,
  `side` enum('buy','sell') NOT NULL,
  `type` enum('limit','market') NOT NULL DEFAULT 'limit',
  `price` decimal(20,4) NOT NULL,
  `amount` decimal(36,8) NOT NULL,
  `filled` decimal(36,8) NOT NULL DEFAULT '0.00000000',
  `remaining` decimal(36,8) NOT NULL,
  `status` enum('open','partial','filled','cancelled') DEFAULT 'open',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pair_status` (`pair`,`status`),
  KEY `idx_pair_side_price` (`pair`,`side`,`price`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `redeem_requests`
--

DROP TABLE IF EXISTS `redeem_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `redeem_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `kg_amount` decimal(18,4) NOT NULL,
  `token_amount` decimal(18,4) NOT NULL,
  `status` varchar(32) DEFAULT 'pending',
  `processed_by` int DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `redeem_requests`
--

LOCK TABLES `redeem_requests` WRITE;
/*!40000 ALTER TABLE `redeem_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `redeem_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `refresh_token` text,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_revoked` tinyint(1) DEFAULT '0',
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=524 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_discounting`
--

DROP TABLE IF EXISTS `token_discounting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_discounting` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bank_name` varchar(100) NOT NULL,
  `batch_id` varchar(50) DEFAULT NULL,
  `token_type` varchar(10) NOT NULL,
  `quantity` decimal(18,4) NOT NULL,
  `market_price` decimal(20,2) NOT NULL,
  `nominal_value` decimal(20,2) NOT NULL,
  `haircut` decimal(5,4) NOT NULL DEFAULT '0.2000',
  `discount_ratio` decimal(5,4) NOT NULL DEFAULT '0.8000',
  `payment_amount` decimal(20,2) NOT NULL,
  `risk_level` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `ownership_transfer_tx` varchar(100) DEFAULT NULL,
  `status` enum('pending','admin_reviewing','bank_valuation','approved','payment_pending','completed','rejected') NOT NULL DEFAULT 'pending',
  `admin_note` text,
  `processed_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_td_user` (`user_id`),
  KEY `idx_td_status` (`status`),
  KEY `idx_td_token` (`token_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_discounting`
--

LOCK TABLES `token_discounting` WRITE;
/*!40000 ALTER TABLE `token_discounting` DISABLE KEYS */;
/*!40000 ALTER TABLE `token_discounting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_requests`
--

DROP TABLE IF EXISTS `token_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` varchar(64) DEFAULT 'farmer',
  `lot_id` varchar(128) DEFAULT NULL,
  `kg_amount` decimal(18,4) NOT NULL,
  `token_amount` decimal(18,4) NOT NULL,
  `grade` varchar(64) DEFAULT NULL,
  `status` varchar(32) DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `lot_id_ref` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_requests`
--

LOCK TABLES `token_requests` WRITE;
/*!40000 ALTER TABLE `token_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `token_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trades`
--

DROP TABLE IF EXISTS `trades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pair` varchar(64) NOT NULL,
  `side` varchar(8) NOT NULL,
  `price` decimal(18,4) NOT NULL,
  `amount` decimal(18,4) NOT NULL,
  `buyer_id` int DEFAULT NULL,
  `seller_id` int DEFAULT NULL,
  `buy_order_id` int DEFAULT NULL,
  `sell_order_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trades`
--

LOCK TABLES `trades` WRITE;
/*!40000 ALTER TABLE `trades` DISABLE KEYS */;
/*!40000 ALTER TABLE `trades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_balances`
--

DROP TABLE IF EXISTS `user_balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_type` varchar(64) NOT NULL,
  `balance` decimal(36,8) DEFAULT '0.00000000',
  `available_balance` decimal(18,4) DEFAULT '0.0000',
  `locked_balance` decimal(18,4) DEFAULT '0.0000',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_token` (`user_id`,`token_type`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_balances`
--

LOCK TABLES `user_balances` WRITE;
/*!40000 ALTER TABLE `user_balances` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_balances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_wallets`
--

DROP TABLE IF EXISTS `user_wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` varchar(64) NOT NULL,
  `wallet_address` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_role` (`user_id`,`role`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_wallets`
--

LOCK TABLES `user_wallets` WRITE;
/*!40000 ALTER TABLE `user_wallets` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_wallets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `role` enum('trader','farmer','admin') NOT NULL DEFAULT 'trader',
  `wallet_address` varchar(255) DEFAULT NULL,
  `kyc_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wallets`
--

DROP TABLE IF EXISTS `wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `vnd_balance` decimal(18,2) DEFAULT '0.00',
  `vnd_locked` decimal(18,2) DEFAULT '0.00',
  `pending_withdraw` decimal(18,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `wallets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1550 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallets`
--

LOCK TABLES `wallets` WRITE;
/*!40000 ALTER TABLE `wallets` DISABLE KEYS */;
/*!40000 ALTER TABLE `wallets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_documents`
--

DROP TABLE IF EXISTS `warehouse_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `document_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `cid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint NOT NULL DEFAULT '0',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'application/octet-stream',
  `uploaded_by` int NOT NULL,
  `status` enum('active','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `blockchain_tx` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockchain_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cid` (`cid`),
  KEY `idx_warehouse_id` (`warehouse_id`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  KEY `idx_status` (`status`),
  KEY `idx_document_type` (`document_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_documents`
--

LOCK TABLES `warehouse_documents` WRITE;
/*!40000 ALTER TABLE `warehouse_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_receipts`
--

DROP TABLE IF EXISTS `warehouse_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_receipts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `receipt_code` varchar(32) NOT NULL,
  `lot_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `grade` enum('CR1','CR2','CR3') NOT NULL,
  `weight_kg` decimal(12,4) NOT NULL,
  `issued_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `issued_by` int DEFAULT NULL,
  `status` enum('active','used','cancelled') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `receipt_code` (`receipt_code`),
  UNIQUE KEY `lot_id` (`lot_id`),
  KEY `idx_lot_id` (`lot_id`),
  KEY `idx_warehouse` (`warehouse_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_receipts`
--

LOCK TABLES `warehouse_receipts` WRITE;
/*!40000 ALTER TABLE `warehouse_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `warehouse_code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `address` varchar(256) DEFAULT NULL,
  `capacity_kg` decimal(12,2) DEFAULT '0.00',
  `manager_name` varchar(128) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `warehouse_code` (`warehouse_code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdraw_requests`
--

DROP TABLE IF EXISTS `withdraw_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdraw_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `bank_name` varchar(128) DEFAULT NULL,
  `account_number` varchar(64) DEFAULT NULL,
  `account_name` varchar(128) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `note` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdraw_requests`
--

LOCK TABLES `withdraw_requests` WRITE;
/*!40000 ALTER TABLE `withdraw_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `withdraw_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'caro_token'
--
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-02 15:16:00
