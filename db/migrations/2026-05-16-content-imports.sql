-- Safe CSV content import queue (separate from pages).
-- Run once on production: mysql ... < db/migrations/2026-05-16-content-imports.sql

CREATE TABLE IF NOT EXISTS `content_imports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content` LONGTEXT NOT NULL,
  `source_file` VARCHAR(255) NULL,
  `row_index` INT UNSIGNED NULL,
  `status` ENUM('pending', 'opened', 'published', 'discarded') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `opened_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_content_imports_status_created` (`status`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
