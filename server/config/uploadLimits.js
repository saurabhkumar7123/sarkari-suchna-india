/**
 * Dashboard upload limits — POST /api/admin/pdf (see config/multer.js).
 * Align with nginx client_max_body_size for /api/.
 */
const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

module.exports = {
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES
};
