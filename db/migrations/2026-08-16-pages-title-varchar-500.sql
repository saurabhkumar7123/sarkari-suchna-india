-- Align pages.title with generator_drafts / recruitments (VARCHAR(500)).
-- Official notice titles can exceed the previous VARCHAR(150) limit.
-- Additive capacity only. Does not rewrite existing page titles.

ALTER TABLE `pages`
  MODIFY COLUMN `title` VARCHAR(500) NOT NULL;
