-- Optional future UNIQUE support via url_norm_key.
-- NOT applied automatically.
-- Application-level duplicate rejection is authoritative today.
-- See scripts/audit-monitored-sites-duplicates.js before enabling.

-- ALTER TABLE monitored_sites
--   ADD COLUMN url_norm_key VARCHAR(64) NULL AFTER url;

-- Backfill must use application-normalized keys (not raw SHA2 of stored URL).

-- ALTER TABLE monitored_sites
--   ADD UNIQUE KEY uq_monitored_sites_url_norm_key (url_norm_key);
