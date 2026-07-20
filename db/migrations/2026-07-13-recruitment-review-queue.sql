-- Recruitment review queue storage (Phase 7).
-- Prerequisites:
--   * db/migrations/2026-07-13-recruitments.sql
--   * db/migrations/2026-07-13-recruitment-events.sql
--   * updates table (monitoring)
--
-- Run once: mysql ... < db/migrations/2026-07-13-recruitment-review-queue.sql
--
-- Safety:
--   * Additive only — creates a new dormant table.
--   * No existing table is altered.
--   * No runtime reads or writes this table until a later rollout phase.
--
-- Rollback (safe while table is empty / unused):
--   DROP TABLE IF EXISTS `recruitment_review_queue`;

CREATE TABLE IF NOT EXISTS `recruitment_review_queue` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `update_id` INT NULL DEFAULT NULL,
  `recruitment_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `recruitment_event_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `review_status` ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
  `confidence_level` TINYINT UNSIGNED NULL DEFAULT NULL,
  `payload_json` JSON NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recruitment_review_queue_review_status` (`review_status`),
  KEY `idx_recruitment_review_queue_update_id` (`update_id`),
  KEY `idx_recruitment_review_queue_recruitment_id` (`recruitment_id`),
  KEY `idx_recruitment_review_queue_recruitment_event_id` (`recruitment_event_id`),
  CONSTRAINT `fk_recruitment_review_queue_update`
    FOREIGN KEY (`update_id`) REFERENCES `updates` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recruitment_review_queue_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recruitment_review_queue_recruitment_event`
    FOREIGN KEY (`recruitment_event_id`) REFERENCES `recruitment_events` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
