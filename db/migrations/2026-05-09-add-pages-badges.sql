-- =====================================================================
-- Migration: add `badges` column to `pages`
-- Date: 2026-05-09
-- Purpose: Manual, backend-controlled badge field for homepage rendering.
--          Phase 1 of badge system simplification migration.
--
-- Safety:
--   * Column is NULLABLE with DEFAULT NULL.
--   * All existing rows keep working (NULL is treated as "no badges").
--   * Existing INSERT statements that do not mention `badges` keep working.
--   * No code reads or writes this column yet (Phase 2 onwards).
--
-- Pre-flight checklist (run before this migration):
--   1. Take a database backup (scripts/backup-db.ps1 or scripts/backup-db.sh).
--   2. Confirm MySQL version: SELECT VERSION();
--      * 5.7.8+ or 8.x  -> JSON column variant (preferred, used below).
--      * older          -> use the TEXT fallback (commented at the bottom).
--   3. Run during low-traffic window (3-5 AM IST recommended).
--
-- Expected behavior on MySQL 8.0:
--   * ALGORITHM=INSTANT -> sub-second, no table lock, online.
-- Expected behavior on MySQL 5.7:
--   * ALGORITHM=INPLACE -> table reads/writes continue, brief metadata lock.
--
-- Rollback (instant, no data loss because nothing writes here yet):
--   ALTER TABLE `pages` DROP COLUMN `badges`;
-- =====================================================================

-- Preferred (MySQL 5.7.8+ / 8.x with JSON support):
ALTER TABLE `pages`
  ADD COLUMN `badges` JSON NULL DEFAULT NULL
  AFTER `status`;

-- Verify column exists and is nullable:
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
--   FROM INFORMATION_SCHEMA.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND TABLE_NAME   = 'pages'
--    AND COLUMN_NAME  = 'badges';

-- =====================================================================
-- TEXT fallback (only if MySQL < 5.7.8 — JSON not supported):
--
-- ALTER TABLE `pages`
--   ADD COLUMN `badges` TEXT NULL DEFAULT NULL
--   AFTER `status`;
--
-- Backend will JSON.parse / JSON.stringify either way; no code change
-- needed between JSON and TEXT variants.
-- =====================================================================

-- =====================================================================
-- Notes for downstream phases:
--   * Stored format: JSON array of uppercase string codes.
--     Examples: ["NEW"], ["OUT"], ["NEW","OUT"], []
--   * NULL is acceptable; backend treats NULL the same as [].
--   * Initial allowed codes (Phase 3 whitelist): "NEW", "OUT".
--     Future codes (UPDATE, HOT, LIVE, CORRECTION) can be added by
--     extending the validation whitelist only — no schema change required.
--   * Max 2 badges per page (enforced at validation layer, not DB).
-- =====================================================================
