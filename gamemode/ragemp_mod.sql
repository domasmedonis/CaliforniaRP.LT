-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 03, 2026 at 07:27 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ragemp_mod`
--

-- --------------------------------------------------------

--
-- Table structure for table `bank_accounts`
--

CREATE TABLE `bank_accounts` (
  `id` int(11) NOT NULL,
  `char_name` varchar(255) NOT NULL,
  `balance` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bank_accounts`
--

INSERT INTO `bank_accounts` (`id`, `char_name`, `balance`) VALUES
(1, 'Test Test', 3100),
(2, 'Bandom Bandom', 0);

-- --------------------------------------------------------

--
-- Table structure for table `bank_transactions`
--

CREATE TABLE `bank_transactions` (
  `id` int(11) NOT NULL,
  `char_name` varchar(255) NOT NULL,
  `transaction_type` varchar(50) NOT NULL,
  `amount` int(11) NOT NULL,
  `date` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bank_transactions`
--

INSERT INTO `bank_transactions` (`id`, `char_name`, `transaction_type`, `amount`, `date`) VALUES
(1, 'Test Test', 'withdraw', 1000, '2026-04-01 19:30:56'),
(2, 'Test Test', 'deposit', 100, '2026-04-01 19:37:15');

-- --------------------------------------------------------

--
-- Table structure for table `bans`
--

CREATE TABLE `bans` (
  `id` int(11) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `banned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reason` varchar(255) NOT NULL,
  `admin` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `characters`
--

CREATE TABLE `characters` (
  `id` int(11) NOT NULL,
  `ucp_username` varchar(255) NOT NULL,
  `char_name` varchar(255) NOT NULL,
  `money` int(11) DEFAULT 0,
  `bank_balance` int(11) DEFAULT 0,
  `playtime` int(11) DEFAULT 0,
  `health` int(11) DEFAULT 100,
  `position_x` float DEFAULT 0,
  `position_y` float DEFAULT 0,
  `position_z` float DEFAULT 0,
  `admin_level` int(11) DEFAULT 0,
  `is_pm_enabled` tinyint(1) DEFAULT 1,
  `admin_name` varchar(255) DEFAULT NULL,
  `phone_number` varchar(6) DEFAULT NULL,
  `twitter_handle` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `characters`
--

INSERT INTO `characters` (`id`, `ucp_username`, `char_name`, `money`, `bank_balance`, `playtime`, `health`, `position_x`, `position_y`, `position_z`, `admin_level`, `is_pm_enabled`, `admin_name`, `phone_number`, `twitter_handle`) VALUES
(1, 'imu_pertrauka', 'Test Test', 900, 3100, 141, 100, -62.7989, -93.8614, 57.7663, 2, 1, NULL, '123456', NULL),
(2, 'imu_pertrauka', 'Bandom Bandom', 0, 0, 7, 100, -29.8705, 45.4782, 72.0717, 2, 1, 'imu_pertrauka', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
--

CREATE TABLE `contacts` (
  `id` int(11) NOT NULL,
  `char_id` int(11) NOT NULL,
  `contact_name` varchar(50) NOT NULL,
  `contact_number` varchar(6) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `char_id` int(11) NOT NULL COMMENT 'Character ID who owns this message record',
  `sender_number` varchar(20) NOT NULL COMMENT 'Phone number of the sender',
  `recipient_number` varchar(20) NOT NULL COMMENT 'Phone number of the recipient',
  `message_text` text NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_read` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = unread, 1 = read (for recipient)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `char_id`, `sender_number`, `recipient_number`, `message_text`, `timestamp`, `is_read`) VALUES
(1, 1, '123456', '123456', 'help', '2026-04-01 16:47:17', 0),
(2, 1, '123456', '112', 'help', '2026-04-01 16:47:17', 0),
(3, 1, '123456', '112', 'help', '2026-04-01 16:49:49', 0),
(4, 1, '123456', '112', 'help', '2026-04-01 16:49:49', 0),
(5, 1, '123456', '112', 'test', '2026-04-01 16:51:30', 0),
(6, 1, '123456', '123456', 'zz', '2026-04-01 17:03:42', 0),
(7, 1, '123456', '112', 'zz', '2026-04-01 17:03:52', 0),
(8, 1, '123456', '415', 'nu zdarowa', '2026-04-01 18:20:43', 0),
(9, 1, '123456', '123456', 'ww', '2026-04-01 18:20:58', 0);

-- --------------------------------------------------------

--
-- Table structure for table `players`
--

CREATE TABLE `players` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `players`
--

INSERT INTO `players` (`id`, `name`, `password`) VALUES
(1, 'imu_pertrauka', '$2a$10$yTsOgm8CkPB/swCF8wyWZupq0d6Jp6J0gorAJl4kNh7rHY2IFKLRC');

-- --------------------------------------------------------

--
-- Table structure for table `tweets`
--

CREATE TABLE `tweets` (
  `id` int(11) NOT NULL,
  `handle` varchar(50) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `twitter_accounts`
--

CREATE TABLE `twitter_accounts` (
  `char_id` int(11) NOT NULL,
  `handle` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `twitter_accounts`
--

INSERT INTO `twitter_accounts` (`char_id`, `handle`) VALUES
(1, 'test');

-- --------------------------------------------------------

--
-- Table structure for table `twitter_posts`
--

CREATE TABLE `twitter_posts` (
  `id` int(11) NOT NULL,
  `char_id` int(11) NOT NULL,
  `handle` varchar(30) NOT NULL,
  `content` text NOT NULL,
  `timestamp` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `twitter_posts`
--

INSERT INTO `twitter_posts` (`id`, `char_id`, `handle`, `content`, `timestamp`) VALUES
(1, 1, 'test', 'test', '2026-04-02 00:09:11'),
(2, 1, 'test', 'test', '2026-04-02 00:19:16'),
(3, 1, 'test', 'test', '2026-04-03 15:16:05'),
(5, 1, 'test', 'asdasdasd', '2026-04-03 15:24:44'),
(6, 1, 'test', 'nu vel bandom siza suda karoce nes idomu kokio ilguma das dweed nx gal per ilgas gal per drumbas b', '2026-04-03 15:27:32'),
(7, 1, 'test', 'vienasilgaszodisbandomkarocepaziuresimkaipargeraiarblogaivienasilgaszodisbandomkarocepaziuresimkai', '2026-04-03 15:29:14'),
(8, 1, 'test', 'Parduodu naują Huntley - draudimas, apsauga 3 lygio, visi pribumbasai. 100.000$ - tel.nr 157414 tik SMS. Nu dar kaska cia parasyt taip tik paziuret.', '2026-04-03 15:32:25'),
(9, 1, 'test', 'asdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd aasdasd', '2026-04-03 16:08:56');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bank_accounts`
--
ALTER TABLE `bank_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `char_name` (`char_name`);

--
-- Indexes for table `bank_transactions`
--
ALTER TABLE `bank_transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bans`
--
ALTER TABLE `bans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ip` (`ip`);

--
-- Indexes for table `characters`
--
ALTER TABLE `characters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `char_name` (`char_name`),
  ADD UNIQUE KEY `phone_number` (`phone_number`),
  ADD UNIQUE KEY `twitter_handle` (`twitter_handle`);

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_char_id` (`char_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_char_id` (`char_id`),
  ADD KEY `idx_sender` (`sender_number`),
  ADD KEY `idx_recipient` (`recipient_number`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_conversation` (`sender_number`,`recipient_number`);

--
-- Indexes for table `players`
--
ALTER TABLE `players`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `tweets`
--
ALTER TABLE `tweets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `twitter_accounts`
--
ALTER TABLE `twitter_accounts`
  ADD PRIMARY KEY (`char_id`),
  ADD UNIQUE KEY `handle` (`handle`);

--
-- Indexes for table `twitter_posts`
--
ALTER TABLE `twitter_posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `char_id` (`char_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bank_accounts`
--
ALTER TABLE `bank_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `bank_transactions`
--
ALTER TABLE `bank_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `bans`
--
ALTER TABLE `bans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `characters`
--
ALTER TABLE `characters`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `players`
--
ALTER TABLE `players`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tweets`
--
ALTER TABLE `tweets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `twitter_posts`
--
ALTER TABLE `twitter_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `contacts`
--
ALTER TABLE `contacts`
  ADD CONSTRAINT `fk_contacts_char_id` FOREIGN KEY (`char_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `twitter_posts`
--
ALTER TABLE `twitter_posts`
  ADD CONSTRAINT `twitter_posts_ibfk_1` FOREIGN KEY (`char_id`) REFERENCES `characters` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
