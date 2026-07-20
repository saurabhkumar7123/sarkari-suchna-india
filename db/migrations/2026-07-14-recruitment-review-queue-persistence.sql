-- Recruitment review queue persistence columns (Phase 27).
-- Prerequisites:
--   * db/migrations/2026-07-13-recruitment-review-queue.sql
--
-- Prefer the idempotent helper:
--   node scripts/apply-recruitment-review-queue-persistence-migration.js
--
-- Safety:
--   * Additive ALTER only — expands the existing dormant table.
--   * Preserves Phase 7 columns.
--   * No runtime writes until the testing dashboard Save action.

ALTER TABLE `recruitment_review_queue`
  MODIFY COLUMN `review_status` ENUM(
    'pending',
    'resolved',
    'dismissed',
    'under_review',
    'approved',
    'rejected',
    'frozen'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE `recruitment_review_queue`
  ADD COLUMN `event_type` VARCHAR(64) NULL DEFAULT NULL AFTER `recruitment_event_id`,
  ADD COLUMN `match_result_json` JSON NULL DEFAULT NULL AFTER `event_type`,
  ADD COLUMN `confidence` VARCHAR(16) NULL DEFAULT NULL AFTER `match_result_json`,
  ADD COLUMN `source_url` VARCHAR(2000) NULL DEFAULT NULL AFTER `confidence`,
  ADD COLUMN `title` VARCHAR(500) NULL DEFAULT NULL AFTER `source_url`,
  ADD COLUMN `raw_notice_json` JSON NULL DEFAULT NULL AFTER `title`,
  ADD COLUMN `normalized_notice_json` JSON NULL DEFAULT NULL AFTER `raw_notice_json`,
  ADD COLUMN `processor_output_json` JSON NULL DEFAULT NULL AFTER `normalized_notice_json`,
  ADD COLUMN `decision` VARCHAR(32) NULL DEFAULT 'none' AFTER `review_status`,
  ADD COLUMN `notes` TEXT NULL DEFAULT NULL AFTER `decision`;
