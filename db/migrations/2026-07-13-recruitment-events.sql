-- Recruitment Lifecycle child event storage (Phase 3).
-- Prerequisite: db/migrations/2026-07-13-recruitments.sql
-- Run once: mysql ... < db/migrations/2026-07-13-recruitment-events.sql
--
-- Safety:
--   * Additive only — creates a new dormant table.
--   * No existing table is altered.
--   * No runtime reads or writes this table until a later rollout phase.
--
-- Rollback (safe while table is empty / unused):
--   DROP TABLE IF EXISTS `recruitment_events`;

CREATE TABLE IF NOT EXISTS `recruitment_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recruitment_id` BIGINT UNSIGNED NOT NULL,
  `event_type` ENUM(
    'notification',
    'short_notification',
    'correction',
    'exam_date',
    'city_intimation',
    'admit_card',
    'answer_key',
    'objection',
    'result',
    'final_result',
    'dv',
    'medical',
    'joining'
  ) NOT NULL,
  `sequence_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('pending', 'active', 'superseded', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recruitment_events_recruitment_sequence` (`recruitment_id`, `sequence_order`),
  CONSTRAINT `fk_recruitment_events_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
