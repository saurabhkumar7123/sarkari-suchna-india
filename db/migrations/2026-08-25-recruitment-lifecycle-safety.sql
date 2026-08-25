-- Recruitment lifecycle safety (Needs Matching + document revision).
-- Prerequisites:
--   * recruitment_review_queue
--   * updates
--
-- Prefer the idempotent helper:
--   node scripts/apply-recruitment-lifecycle-safety-migration.js
--
-- Safety:
--   * Additive only.
--   * Does not rewrite historical recruitment_id NULL rows.
--   * Does not publish or enable automation.
--
-- Rollback (practical):
--   ALTER TABLE updates DROP COLUMN document_hash;
--   ALTER TABLE updates DROP COLUMN supersedes_update_id;
--   (ENUM shrink is not required; needs_matching rows map to pending on lean schemas.)

ALTER TABLE `recruitment_review_queue`
  MODIFY COLUMN `review_status` ENUM(
    'pending',
    'resolved',
    'dismissed',
    'under_review',
    'approved',
    'rejected',
    'frozen',
    'needs_matching'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE `updates`
  ADD COLUMN `document_hash` VARCHAR(64) NULL DEFAULT NULL AFTER `link`;

ALTER TABLE `updates`
  ADD COLUMN `supersedes_update_id` INT NULL DEFAULT NULL AFTER `document_hash`;
