-- Optional: run only if `post_name` / `total_posts` are not already on `pages`.
-- MySQL will error if columns already exist (safe to ignore in that case).

ALTER TABLE `pages`
  ADD COLUMN `post_name` VARCHAR(512) NULL DEFAULT NULL AFTER `department`;

ALTER TABLE `pages`
  ADD COLUMN `total_posts` VARCHAR(64) NULL DEFAULT NULL AFTER `post_name`;
