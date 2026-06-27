-- Generator parked drafts (unpublished work-in-progress pages).
-- Run once: mysql ... < db/migrations/2026-06-27-generator-drafts.sql

CREATE TABLE IF NOT EXISTS `generator_drafts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(500) NOT NULL DEFAULT '',
  `slug_hint` VARCHAR(255) NULL,
  `payload` LONGTEXT NOT NULL,
  `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  `published_slug` VARCHAR(255) NULL,
  `published_page_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `published_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_generator_drafts_status_updated` (`status`, `updated_at` DESC),
  KEY `idx_generator_drafts_published_slug` (`published_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
