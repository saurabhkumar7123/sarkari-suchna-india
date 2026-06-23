-- Migration: extend homepage small-box slots to 1–8 (slots 7–8 desktop only)
-- Safe on live: column type unchanged (TINYINT UNSIGNED already supports 1–8).
-- Apply when deploying this feature:
--   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < db/migrations/2026-06-21-small-box-slots-1-8.sql
--
-- Rollback (comment only): revert COMMENT to 'Homepage small box slot 1-4; NULL = not shown'

ALTER TABLE `pages`
  MODIFY COLUMN `small_box_slot` TINYINT UNSIGNED NULL DEFAULT NULL
  COMMENT 'Homepage small box slot 1-8; NULL = not shown; slots 7-8 desktop only';
