-- Optional lifecycle linkage columns for pages (Phase 4).
-- Prerequisites:
--   * db/migrations/2026-07-13-recruitments.sql
--   * db/migrations/2026-07-13-recruitment-events.sql
--   * pages.content_updated_at column (homepage Phase 3)
--
-- Run once: mysql ... < db/migrations/2026-07-13-add-pages-recruitment-linkage.sql
--
-- Safety:
--   * Additive only — nullable columns with DEFAULT NULL.
--   * Existing INSERT/UPDATE statements that omit these columns keep working.
--   * All existing rows remain valid with NULL linkage.
--   * No runtime reads or writes these columns until a later rollout phase.
--
-- Rollback (only while no linkage data is in use):
--   ALTER TABLE `pages` DROP FOREIGN KEY `fk_pages_recruitment_event`;
--   ALTER TABLE `pages` DROP FOREIGN KEY `fk_pages_recruitment`;
--   ALTER TABLE `pages` DROP INDEX `idx_pages_recruitment_event_id`;
--   ALTER TABLE `pages` DROP INDEX `idx_pages_recruitment_id`;
--   ALTER TABLE `pages` DROP COLUMN `recruitment_event_id`, DROP COLUMN `recruitment_id`;

ALTER TABLE `pages`
  ADD COLUMN `recruitment_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `content_updated_at`,
  ADD COLUMN `recruitment_event_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `recruitment_id`,
  ADD KEY `idx_pages_recruitment_id` (`recruitment_id`),
  ADD KEY `idx_pages_recruitment_event_id` (`recruitment_event_id`),
  ADD CONSTRAINT `fk_pages_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pages_recruitment_event`
    FOREIGN KEY (`recruitment_event_id`) REFERENCES `recruitment_events` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
