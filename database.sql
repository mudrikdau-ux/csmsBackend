-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: csms
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `analytics_cache`
--

DROP TABLE IF EXISTS `analytics_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `analytics_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(100) NOT NULL,
  `cache_data` json NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cache_key` (`cache_key`),
  KEY `idx_cache_key` (`cache_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `analytics_cache`
--

LOCK TABLES `analytics_cache` WRITE;
/*!40000 ALTER TABLE `analytics_cache` DISABLE KEYS */;
INSERT INTO `analytics_cache` VALUES (1,'dashboard_summary_2026-05-05','{\"period\": {\"to\": \"2026-05-05\", \"from\": \"2026-04-05\"}, \"revenue\": {\"gross\": \"217500.00\", \"earned\": \"0.00\", \"avg_order\": 43500, \"cancelled\": \"0\", \"completed\": \"0\", \"total_bookings\": 5}, \"top_staff\": [{\"completed\": \"0\", \"total_jobs\": 1, \"completion_rate\": \"0.0\", \"assigned_staff_id\": 20, \"revenue_generated\": \"43500.00\", \"assigned_staff_name\": \"MO 11\"}], \"expiring_contracts\": 0, \"status_distribution\": [{\"count\": 1, \"status\": \"confirmed\", \"total_value\": \"43500.00\"}, {\"count\": 4, \"status\": \"pending\", \"total_value\": \"174000.00\"}]}','2026-05-05 15:33:23','2026-05-05 12:18:22');
/*!40000 ALTER TABLE `analytics_cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `service_id` int NOT NULL,
  `cleaners` int DEFAULT NULL,
  `hours` int DEFAULT NULL,
  `frequency` enum('one-time','weekly') DEFAULT NULL,
  `materials` tinyint(1) DEFAULT NULL,
  `property_type` varchar(100) DEFAULT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `landmark` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `service_date` date DEFAULT NULL,
  `service_time` time DEFAULT NULL,
  `completed_date` datetime DEFAULT NULL,
  `instructions` text,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_status` enum('unpaid','partial','paid') DEFAULT 'unpaid',
  `base_price` decimal(10,2) DEFAULT NULL,
  `extras` decimal(10,2) DEFAULT NULL,
  `discount` decimal(10,2) DEFAULT NULL,
  `total_price` decimal(10,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `assigned_staff_id` int DEFAULT NULL,
  `assigned_staff_name` varchar(200) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assigned_staff` (`assigned_staff_id`),
  CONSTRAINT `fk_booking_staff` FOREIGN KEY (`assigned_staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
INSERT INTO `bookings` VALUES (1,NULL,1,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near school',-6.79240000,39.20830000,'2026-05-01','10:00:00',NULL,'Be careful with glass','Mudrik','Dau','test@gmail.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'confirmed',20,'MO 11','2026-04-29 09:49:07'),(2,NULL,1,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near school',-6.79240000,39.20830000,'2026-05-01','10:00:00',NULL,'Be careful with glass','Mudrik','Dau','test@gmail.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'pending',NULL,NULL,'2026-04-29 09:52:53'),(3,NULL,1,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near School',-6.79240000,39.20830000,'2026-05-15','10:00:00',NULL,'Please be careful with glass items','John','Doe','john@example.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'pending',NULL,NULL,'2026-04-29 12:03:39'),(4,NULL,3,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near School',-6.79240000,39.20830000,'2026-05-15','10:00:00',NULL,'Please be careful with glass items','John','Doe','john@example.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'pending',NULL,NULL,'2026-04-29 12:03:59'),(5,22,2,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near School',-6.79240000,39.20830000,'2026-05-15','10:00:00',NULL,'Please be careful with glass items','John','Doe','molittle1011@gmail.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'pending',NULL,NULL,'2026-05-05 08:42:39'),(6,25,4,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near School',-6.79240000,39.20830000,'2026-05-15','10:00:00',NULL,'Please be careful with glass items','John','Doe','molittle1011@gmail.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'pending',NULL,NULL,'2026-05-14 09:56:14'),(7,25,2,2,3,'weekly',1,'apartment','Kijitonyama Street','Dar es Salaam','Near School',-6.79240000,39.20830000,'2026-05-15','10:00:00',NULL,'Please be careful with glass items','John','Doe','molittle1011@gmail.com','0777000000','cash','unpaid',30000.00,15000.00,1500.00,43500.00,'in_progress',20,'MO 11','2026-05-14 10:40:30');
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contractor_invoices`
--

DROP TABLE IF EXISTS `contractor_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contractor_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `contractor_id` int NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `work_description` text,
  `work_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `equipment_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `notes` text,
  `status` enum('draft','generated','sent','paid','overdue','cancelled') DEFAULT 'generated',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_contractor_id` (`contractor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_invoice_date` (`invoice_date`),
  KEY `idx_invoice_number` (`invoice_number`),
  CONSTRAINT `contractor_invoices_ibfk_1` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contractor_invoices_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contractor_invoices`
--

LOCK TABLES `contractor_invoices` WRITE;
/*!40000 ALTER TABLE `contractor_invoices` DISABLE KEYS */;
INSERT INTO `contractor_invoices` VALUES (1,1,'INV-CON-202605-0001','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','paid',NULL,'2026-05-05 14:11:37','2026-05-05 14:25:46'),(2,1,'INV-CON-202605-0002','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:15:14','2026-05-05 14:15:14'),(3,1,'INV-CON-202605-0003','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:15:58','2026-05-05 14:15:58'),(4,1,'INV-CON-202605-0004','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:18:07','2026-05-05 14:18:07'),(5,1,'INV-CON-202605-0005','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:18:33','2026-05-05 14:18:33'),(6,1,'INV-CON-202605-0006','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:19:26','2026-05-05 14:19:26'),(7,1,'INV-CON-202605-0007','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:20:00','2026-05-05 14:20:00'),(8,1,'INV-CON-202605-0008','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 14:22:04','2026-05-05 14:22:04'),(9,1,'INV-CON-202605-0009','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 19:29:48','2026-05-05 19:29:48'),(10,1,'INV-CON-202605-0010','2026-05-05','2026-06-05','Monthly office cleaning services for May 2026 - ZSSF Head Office. Includes deep cleaning of all 5 floors, window washing, restroom sanitation, and waste management.',2500000.00,150000.00,2650000.00,18.00,477000.00,3127000.00,'Payment via bank transfer to CleanSpark Co. Ltd, Account: 0123456789, CRDB Bank. Reference: INV-CON-202605-0001','generated',NULL,'2026-05-05 19:30:50','2026-05-05 19:30:50');
/*!40000 ALTER TABLE `contractor_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contractors`
--

DROP TABLE IF EXISTS `contractors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contractors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) NOT NULL,
  `contractor_type` enum('government','private') NOT NULL,
  `location` varchar(255) NOT NULL,
  `workers_count` int NOT NULL DEFAULT '0',
  `workers_names` text,
  `contract_start_date` date NOT NULL,
  `contract_end_date` date NOT NULL,
  `contract_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `contact_person` varchar(255) NOT NULL,
  `contact_email` varchar(150) NOT NULL,
  `contact_phone` varchar(20) NOT NULL,
  `services_provided` text,
  `status` enum('active','expired','terminated','completed') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contractor_type` (`contractor_type`),
  KEY `idx_status` (`status`),
  KEY `idx_location` (`location`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contractors`
--

LOCK TABLES `contractors` WRITE;
/*!40000 ALTER TABLE `contractors` DISABLE KEYS */;
INSERT INTO `contractors` VALUES (1,'ZSSF - Zanzibar Social Security Fund','government','Mkunazini, Stone Town',15,'Ali Hassan, Fatma Omar, Juma Khamis, Maryam Saleh, Abdul Shakur, Zainab Ali, Hassan Juma, Khadija Mohammed, Said Hamad, Asha Bakari, Yusuf Mwinyi, Mwanajuma Ali, Rashid Khamis, Salma Abdallah, Mohammed Juma','2026-01-01','2026-12-31',25000000.00,'Ahmed Salim','ahmed.salim@zssf.go.tz','+255777123456','Office Cleaning, Window Washing, Floor Maintenance, Waste Management, Restroom Sanitation','active','2026-05-05 09:37:38','2026-05-05 09:37:38'),(2,'ZSSF - Zanzibar Social Security Fund','government','Mkunazini, Stone Town',15,'Ali Hassan, Fatma Omar, Juma Khamis, Maryam Saleh, Abdul Shakur, Zainab Ali, Hassan Juma, Khadija Mohammed, Said Hamad, Asha Bakari, Yusuf Mwinyi, Mwanajuma Ali, Rashid Khamis, Salma Abdallah, Mohammed Juma','2026-01-01','2026-12-31',25000000.00,'Ahmed Salim','ahmed.salim@zssf.go.tz','+255777123456','Office Cleaning, Window Washing, Floor Maintenance, Waste Management, Restroom Sanitation','active','2026-05-05 19:29:15','2026-05-05 19:29:15');
/*!40000 ALTER TABLE `contractors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deleted_users`
--

DROP TABLE IF EXISTS `deleted_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deleted_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `provider` varchar(10) DEFAULT NULL,
  `deleted_reason` text,
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deleted_users`
--

LOCK TABLES `deleted_users` WRITE;
/*!40000 ALTER TABLE `deleted_users` DISABLE KEYS */;
INSERT INTO `deleted_users` VALUES (1,19,'Mudrik','Dau','mudrikdau@gmail.com','admin','local','User requested account deletion','2026-05-14 09:07:54'),(2,22,'John','Doe','molittle1011@gmail.com','user','local','User requested account deletion','2026-05-14 09:13:48');
/*!40000 ALTER TABLE `deleted_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedbacks`
--

DROP TABLE IF EXISTS `feedbacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedbacks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `booking_id` int DEFAULT NULL,
  `rating` enum('very_sad','sad','neutral','happy','very_happy') NOT NULL,
  `rating_value` int NOT NULL,
  `feedback_text` text NOT NULL,
  `is_public` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_booking_id` (`booking_id`),
  KEY `idx_rating` (`rating`),
  KEY `idx_is_public` (`is_public`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `feedbacks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedbacks_ibfk_2` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedbacks`
--

LOCK TABLES `feedbacks` WRITE;
/*!40000 ALTER TABLE `feedbacks` DISABLE KEYS */;
/*!40000 ALTER TABLE `feedbacks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_logs`
--

DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `notification_type` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `sent_to` varchar(150) NOT NULL,
  `status` varchar(20) DEFAULT 'sent',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`notification_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `notification_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_logs`
--

LOCK TABLES `notification_logs` WRITE;
/*!40000 ALTER TABLE `notification_logs` DISABLE KEYS */;
INSERT INTO `notification_logs` VALUES (1,25,'booking_confirmation','Booking Confirmed - #7','\n        \n            \n                ✅ Booking Confirmed\n            \n            \n                Hello John Doe,\n                Your booking has been confirmed. Here are the details:\n                \n                \n                    Booking ID: #7\n                    Service: Deep House Cleaning\n                    Date: 2026-05-15\n                    Time: 10:00\n                    Address: Kijitonyama Street, Dar es Salaam\n                    Total: TZS 43,500\n                    \n   ','molittle1011@gmail.com','sent','2026-05-14 10:40:32'),(2,25,'booking_status_update','Booking #7 - Confirmed ✅','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    Confirmed ✅\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 CleanSpa','molittle1011@gmail.com','sent','2026-05-14 10:51:33'),(3,25,'booking_status_update','Booking #7 - In Progress ?','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    In Progress ?\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 Clean','molittle1011@gmail.com','sent','2026-05-14 10:55:18'),(4,25,'booking_status_update','Booking #7 - Cancelled ❌','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    Cancelled ❌\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 CleanSpa','molittle1011@gmail.com','sent','2026-05-14 10:56:01'),(5,25,'booking_status_update','Booking #7 - In Progress ?','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    In Progress ?\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 Clean','molittle1011@gmail.com','sent','2026-05-14 11:00:27'),(6,25,'booking_status_update','Booking #7 - Cancelled ❌','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    Cancelled ❌\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 CleanSpa','molittle1011@gmail.com','sent','2026-05-14 11:09:14'),(7,25,'booking_status_update','Booking #7 - In Progress ?','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    In Progress ?\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 Clean','molittle1011@gmail.com','sent','2026-05-14 11:10:26'),(8,25,'booking_status_update','Booking #7 - Cancelled ❌','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    Cancelled ❌\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 CleanSpa','molittle1011@gmail.com','sent','2026-05-14 11:12:47'),(9,25,'booking_status_update','Booking #7 - Cancelled ❌','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    Cancelled ❌\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 CleanSpa','molittle1011@gmail.com','skipped','2026-05-14 11:22:09'),(10,25,'booking_status_update','Booking #7 - In Progress ?','\n        \n            \n                Booking Status Update\n            \n            \n                Hello,\n                Your booking status has been updated:\n                \n                \n                    In Progress ?\n                    Booking #7 - Cleaning Service\n                    Fri May 15 2026 00:00:00 GMT+0300 (East Africa Time) at 10:00:00\n                \n\n                Login to your account to view full details.\n            \n            \n                © 2026 Clean','molittle1011@gmail.com','sent','2026-05-14 11:23:49');
/*!40000 ALTER TABLE `notification_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_type` enum('comprehensive','booking','revenue','staff_performance','contractors') NOT NULL,
  `report_format` enum('detailed','summary') NOT NULL,
  `date_from` date NOT NULL,
  `date_to` date NOT NULL,
  `generated_by` int NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `report_data` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `generated_by` (`generated_by`),
  KEY `idx_report_type` (`report_type`),
  KEY `idx_date_range` (`date_from`,`date_to`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration` int NOT NULL,
  `location` enum('Unguja Island','Pemba Island','Both Islands') NOT NULL,
  `description` text,
  `includes` json DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES (2,'Deep House Cleaning',25000.00,3,'Pemba Island','Testing Service','[\"Living Room\", \"Bedrooms\", \"Kitchen\", \"Bathrooms\", \"Windows\", \"Balcony\"]','1777471251222-623736848.png','2026-04-29 14:00:51'),(3,'Partial House Cleaning 2',25000.00,3,'Pemba Island','Testing Service','[\"Living Room\", \"Bedrooms\", \"Kitchen\", \"Bathrooms\", \"Windows\", \"Balcony\"]','1777471267284-391074952.png','2026-04-29 14:01:07'),(4,'Bedroom Cleaning ',25000.00,3,'Unguja Island','Testing Service','[\"Living Room\", \"Bedrooms\", \"Kitchen\", \"Bathrooms\", \"Windows\", \"Balcony\"]','1777471286405-219945045.png','2026-04-29 14:01:26');
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_service_assignments`
--

DROP TABLE IF EXISTS `staff_service_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_service_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `service_id` int NOT NULL,
  `status` enum('assigned','in_progress','completed','cancelled') DEFAULT 'assigned',
  `assigned_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_date` timestamp NULL DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `staff_id` (`staff_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `staff_service_assignments_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `staff_service_assignments_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_service_assignments`
--

LOCK TABLES `staff_service_assignments` WRITE;
/*!40000 ALTER TABLE `staff_service_assignments` DISABLE KEYS */;
INSERT INTO `staff_service_assignments` VALUES (1,20,2,'assigned','2026-04-29 14:19:40',NULL,NULL);
/*!40000 ALTER TABLE `staff_service_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_blacklist`
--

DROP TABLE IF EXISTS `token_blacklist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_blacklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(500) NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token`(255)),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_blacklist`
--

LOCK TABLES `token_blacklist` WRITE;
/*!40000 ALTER TABLE `token_blacklist` DISABLE KEYS */;
/*!40000 ALTER TABLE `token_blacklist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `address` text,
  `gender` enum('Male','Female') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `otp` varchar(10) DEFAULT NULL,
  `otp_expiry` datetime DEFAULT NULL,
  `role` varchar(20) DEFAULT 'user',
  `provider` varchar(10) DEFAULT 'local',
  `phone` varchar(20) DEFAULT NULL,
  `email_notifications` tinyint(1) DEFAULT '1',
  `photo` varchar(255) DEFAULT NULL,
  `staff_type` enum('normal','supervisor') DEFAULT 'normal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (18,'Abdul','Shehe','fourbrothers10112627@gmail.com','$2b$10$iImtupDfwPb.ZQz8zIA.puEvtKkwNlCO9A4Ur1yvOXYTFXmh3Jhiy','Fuoni','Male','2026-04-29 12:00:09',NULL,NULL,'user','local',NULL,1,NULL,'normal'),(20,'MO','11','msuasauasus@gmail.com','$2b$10$iOdZ1Batbn72vH2NAy0W9.5o8r7ZcUVQsFyEr1BKQgUX9mifxInSS',NULL,NULL,'2026-04-29 12:48:55','636923','2026-05-05 11:43:51','staff','local','0677532140',1,'1777466934993.png','normal'),(21,'Dau','','fourbrothers@gmail.com','$2b$10$.KVnJBfuPQi6iS/QN2wXzuceLtoem/g4hQVlKaogot24P.yVL45Si',NULL,NULL,'2026-04-29 12:49:27',NULL,NULL,'staff','local','0677532140',1,'1777466967528.png','supervisor'),(23,'Mudrik','Dau','mudrikdau@gmail.com','$2b$10$fYdzQ02XIACxinG7svIZz.sR5Q3.xNmVyeBH0ZQ0DlQDnMA5cJP3i',NULL,NULL,'2026-05-14 09:17:28',NULL,NULL,'admin','local',NULL,0,NULL,'normal'),(24,'John','Doe','mudydau@icloud.com','$2b$10$1X3Y7rSZRjYppzx3JcJz0O8Uy/GKJAY2Z5eZJSRzx1iTIxvr9n13q','Kijitonyama Street','Male','2026-05-14 09:20:50',NULL,NULL,'user','local',NULL,1,NULL,'normal'),(25,'John','Doe','molittle1011@gmail.com','$2b$10$xWt.8O5eXex3Y.3kBhC/4uHihQLyKUkdrWhrgrVBfqNWLt5hbTC9a','Kijitonyama Street','Male','2026-05-14 09:49:16',NULL,NULL,'user','local',NULL,1,NULL,'normal');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-14 14:38:25
