-- Optional: run only if `advertisement_no` is not already on `pages`.
-- MySQL will error if the column already exists (safe to ignore in that case).

ALTER TABLE `pages`
  ADD COLUMN `advertisement_no` VARCHAR(128) NULL DEFAULT NULL AFTER `total_posts`;
