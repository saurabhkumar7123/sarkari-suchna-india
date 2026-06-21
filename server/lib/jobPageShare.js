"use strict";

const JOB_PAGE_SHARE_SCRIPT = "/js/job-page-share.js?v=2";

/**
 * Ensure job pages load share script (replaces legacy tools.js on vacancy pages).
 * @param {string} html
 * @returns {string}
 */
function normalizeJobPageShareInHtml(html) {
  let out = String(html || "");
  if (!out.includes("social-share-bar")) return out;

  out = out.replace(/<script src="\/js\/tools\.js"><\/script>\s*/gi, "");

  if (!out.includes("job-page-share.js")) {
    out = out.replace(/<\/body>/i, `<script src="${JOB_PAGE_SHARE_SCRIPT}" defer></script>\n</body>`);
  }

  return out;
}

module.exports = {
  JOB_PAGE_SHARE_SCRIPT,
  normalizeJobPageShareInHtml
};
