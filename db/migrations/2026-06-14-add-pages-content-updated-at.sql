-- Homepage dynamic-section freshness: content edits only (not placement metadata).
-- Safe additive migration — no column drops.
--
-- PREREQUISITES (verify before running):
--   SHOW COLUMNS FROM pages LIKE 'updated_at';        -- must exist
--   SHOW COLUMNS FROM pages LIKE 'small_box_slot';    -- required for Phase 2 small-box PATCH
--
-- Or run: node scripts/verify-phase3-schema.js
--
-- Re-run safety: ALTER fails if column already exists; UPDATE backfill is idempotent.
-- Recommended: node scripts/apply-phase3-migration.js (checks prerequisites, skips duplicate ALTER)

ALTER TABLE `pages`
  ADD COLUMN `content_updated_at` DATETIME NULL DEFAULT NULL AFTER `updated_at`;

UPDATE `pages`
SET `content_updated_at` = COALESCE(`updated_at`, `created_at`)
WHERE `content_updated_at` IS NULL;
