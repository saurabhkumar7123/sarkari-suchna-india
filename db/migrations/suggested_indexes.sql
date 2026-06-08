-- Production MySQL indexing (run manually after backup). Compatible with MySQL 5.7+ / 8.x.
-- USE your_database_name;

-- Listing + pagination
CREATE INDEX idx_pages_deleted_created ON pages (deleted, created_at);

-- Status filter + listing
CREATE INDEX idx_pages_deleted_status_created ON pages (deleted, status, created_at);

-- Detail by slug
CREATE INDEX idx_pages_slug_deleted ON pages (slug, deleted);

-- Breaking news
CREATE INDEX idx_pages_breaking ON pages (deleted, breaking, breaking_order);

-- Homepage small boxes (legacy position flag)
CREATE INDEX idx_pages_position ON pages (deleted, position);

-- Homepage small-box slots 1–4 (preferred after 2026-06-08 migration)
CREATE INDEX idx_pages_small_box_slot ON pages (deleted, small_box_slot);

-- Tag / category listing
CREATE INDEX idx_pages_category ON pages (deleted, category);

-- Trending (top views)
CREATE INDEX idx_pages_views ON pages (deleted, views);

-- Optional: full-text for title search at large scale
-- ALTER TABLE pages ADD FULLTEXT INDEX ft_pages_title (title);
