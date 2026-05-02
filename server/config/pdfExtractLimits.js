/**
 * Generator-only: POST /api/admin/pdf/extract body size limit.
 * Align with nginx `client_max_body_size` (e.g. 100m).
 */
const MAX_EXTRACT_MB = 100;
const MAX_EXTRACT_BYTES = 100 * 1024 * 1024;

module.exports = {
  MAX_EXTRACT_MB,
  MAX_EXTRACT_BYTES
};
