-- =====================================================================
-- Migration: add `small_box_slot` to `pages`
-- Date: 2026-06-08
-- Purpose: Deterministic homepage small-box slots (1–4) with auto-displacement.
--
-- Data changes (backfill):
--   1. Among active rows (deleted=0) with position='small', ordered by
--      created_at DESC, id DESC:
--      * Top 4 receive small_box_slot = 1, 2, 3, 4 respectively.
--      * Remaining rows with position='small' are demoted to position='normal'
--        (small_box_slot stays NULL).
--   2. Rows already on homepage via legacy flag but outside top 4 lose visibility
--      without being deleted.
--
-- Pre-flight: backup database before running.
-- Rollback: ALTER TABLE `pages` DROP COLUMN `small_box_slot`;
--           DROP INDEX idx_pages_small_box_slot ON pages;  (if created)
-- =====================================================================

ALTER TABLE `pages`
  ADD COLUMN `small_box_slot` TINYINT UNSIGNED NULL DEFAULT NULL
  COMMENT 'Homepage small box slot 1-4; NULL = not shown'
  AFTER `position`;

CREATE INDEX `idx_pages_small_box_slot` ON `pages` (`deleted`, `small_box_slot`);

-- Backfill slots 1–4 for legacy position='small' pages (newest first).
SET @sb_rank := 0;

UPDATE `pages` AS p
INNER JOIN (
  SELECT
    `id`,
    (@sb_rank := @sb_rank + 1) AS `rn`
  FROM `pages`
  WHERE `deleted` = 0
    AND `position` = 'small'
  ORDER BY `created_at` DESC, `id` DESC
) AS ranked ON p.`id` = ranked.`id`
SET p.`small_box_slot` = ranked.`rn`
WHERE ranked.`rn` BETWEEN 1 AND 4;

-- Demote overflow legacy small-box pages (not deleted).
UPDATE `pages`
SET `position` = 'normal'
WHERE `deleted` = 0
  AND `position` = 'small'
  AND `small_box_slot` IS NULL;

-- Verify:
-- SELECT id, title, position, small_box_slot, created_at
--   FROM pages
--  WHERE deleted = 0 AND small_box_slot IS NOT NULL
--  ORDER BY small_box_slot;
