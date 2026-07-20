-- Optional lifecycle linkage columns for monitoring detections (Phase 5).
-- Prerequisites:
--   * db/migrations/2026-07-13-recruitments.sql
--   * db/migrations/2026-07-13-recruitment-events.sql
--
-- Run once: mysql ... < db/migrations/2026-07-13-add-updates-recruitment-linkage.sql
--
-- Safety:
--   * Additive only — nullable columns with DEFAULT NULL.
--   * Existing INSERT statements (site_id, title, link) keep working unchanged.
--   * All existing detection rows remain valid with NULL linkage.
--   * Detection history is never deleted when a recruitment or event is removed.
--   * No runtime reads or writes these columns until a later rollout phase.
--
-- Rollback (only while no linkage data is in use):
--   ALTER TABLE `updates` DROP FOREIGN KEY `fk_updates_recruitment_event`;
--   ALTER TABLE `updates` DROP FOREIGN KEY `fk_updates_recruitment`;
--   ALTER TABLE `updates` DROP INDEX `idx_updates_recruitment_event_id`;
--   ALTER TABLE `updates` DROP INDEX `idx_updates_recruitment_id`;
--   ALTER TABLE `updates` DROP COLUMN `recruitment_event_id`, DROP COLUMN `recruitment_id`;

ALTER TABLE `updates`
  ADD COLUMN `recruitment_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `created_at`,
  ADD COLUMN `recruitment_event_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `recruitment_id`,
  ADD KEY `idx_updates_recruitment_id` (`recruitment_id`),
  ADD KEY `idx_updates_recruitment_event_id` (`recruitment_event_id`),
  ADD CONSTRAINT `fk_updates_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_updates_recruitment_event`
    FOREIGN KEY (`recruitment_event_id`) REFERENCES `recruitment_events` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
