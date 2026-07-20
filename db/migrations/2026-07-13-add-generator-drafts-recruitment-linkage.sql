-- Optional lifecycle linkage columns for generator drafts (Phase 6).
-- Prerequisites:
--   * db/migrations/2026-07-13-recruitments.sql
--   * db/migrations/2026-07-13-recruitment-events.sql
--   * db/migrations/2026-06-27-generator-drafts.sql
--
-- Run once: mysql ... < db/migrations/2026-07-13-add-generator-drafts-recruitment-linkage.sql
--
-- Safety:
--   * Additive only — nullable columns with DEFAULT NULL.
--   * Existing INSERT statements (title, slug_hint, payload, status) keep working unchanged.
--   * All existing draft rows remain valid with NULL linkage.
--   * Deleting a recruitment or event clears linkage only; drafts are never deleted.
--   * No runtime reads or writes these columns until a later rollout phase.
--
-- Rollback (only while no linkage data is in use):
--   ALTER TABLE `generator_drafts` DROP FOREIGN KEY `fk_generator_drafts_recruitment_event`;
--   ALTER TABLE `generator_drafts` DROP FOREIGN KEY `fk_generator_drafts_recruitment`;
--   ALTER TABLE `generator_drafts` DROP INDEX `idx_generator_drafts_recruitment_event_id`;
--   ALTER TABLE `generator_drafts` DROP INDEX `idx_generator_drafts_recruitment_id`;
--   ALTER TABLE `generator_drafts` DROP COLUMN `recruitment_event_id`, DROP COLUMN `recruitment_id`;

ALTER TABLE `generator_drafts`
  ADD COLUMN `recruitment_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `published_at`,
  ADD COLUMN `recruitment_event_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `recruitment_id`,
  ADD KEY `idx_generator_drafts_recruitment_id` (`recruitment_id`),
  ADD KEY `idx_generator_drafts_recruitment_event_id` (`recruitment_event_id`),
  ADD CONSTRAINT `fk_generator_drafts_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_generator_drafts_recruitment_event`
    FOREIGN KEY (`recruitment_event_id`) REFERENCES `recruitment_events` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
