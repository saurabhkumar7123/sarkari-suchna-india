-- Recruitment Lifecycle parent storage (Phase 2).
-- Run once: mysql ... < db/migrations/2026-07-13-recruitments.sql
--
-- Safety:
--   * Additive only — creates a new dormant table.
--   * No existing table is altered.
--   * No runtime reads or writes this table until a later rollout phase.
--
-- Rollback (safe while table is empty / unused):
--   DROP TABLE IF EXISTS `recruitments`;

CREATE TABLE IF NOT EXISTS `recruitments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(500) NOT NULL DEFAULT '',
  `slug` VARCHAR(255) NOT NULL,
  `department` VARCHAR(128) NULL DEFAULT NULL,
  `post_name` VARCHAR(512) NULL DEFAULT NULL,
  `advertisement_no` VARCHAR(128) NULL DEFAULT NULL,
  `cycle_year` SMALLINT UNSIGNED NULL DEFAULT NULL,
  `lifecycle_state` ENUM(
    'announced',
    'open',
    'exam_scheduled',
    'post_exam',
    'results',
    'closed'
  ) NOT NULL DEFAULT 'announced',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_recruitments_slug` (`slug`),
  KEY `idx_recruitments_advertisement_no` (`advertisement_no`),
  KEY `idx_recruitments_identity` (`department`, `post_name`, `cycle_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
