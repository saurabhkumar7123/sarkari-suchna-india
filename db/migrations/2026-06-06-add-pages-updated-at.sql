-- Track page modifications for homepage freshness sorting (Dynamic Sections).
ALTER TABLE `pages`
  ADD COLUMN `updated_at` DATETIME NULL DEFAULT NULL AFTER `created_at`;

UPDATE `pages` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
