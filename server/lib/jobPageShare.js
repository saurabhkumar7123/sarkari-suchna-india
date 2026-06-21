"use strict";

const { SOCIAL_JOIN_LINKS } = require("./socialJoinLinks");

const JOB_PAGE_SHARE_SCRIPT = "/js/job-page-share.js?v=3";

function fixJoinAnchorHref(html, className, joinUrl) {
  const re = new RegExp(
    `<a\\b(?=[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*")(?=[^>]*\\bhref=")([^>]*?)\\bhref="([^"]*)"`,
    "gi"
  );
  return String(html || "").replace(re, (match, attrs, href) => {
    const value = String(href || "").trim();
    const lower = value.toLowerCase();
    const isBroken =
      !value ||
      value === "#" ||
      lower.includes("wa.me/?text=") ||
      lower.includes("t.me/share/url") ||
      lower.includes("facebook.com/sharer/");
    if (!isBroken) return match;
    return `<a${attrs}href="${joinUrl}"`;
  });
}

/**
 * Ensure job pages load share script and social buttons point to join channels.
 * @param {string} html
 * @returns {string}
 */
function normalizeJobPageShareInHtml(html) {
  let out = String(html || "");
  if (!out.includes("social-share-bar")) return out;

  out = out.replace(/<script src="\/js\/tools\.js"><\/script>\s*/gi, "");

  out = fixJoinAnchorHref(out, "whatsapp", SOCIAL_JOIN_LINKS.whatsapp);
  out = fixJoinAnchorHref(out, "telegram", SOCIAL_JOIN_LINKS.telegram);
  out = fixJoinAnchorHref(out, "facebook", SOCIAL_JOIN_LINKS.facebook);

  out = out.replace(
    /(<a[^>]*class="[^"]*\bwhatsapp\b[^"]*"[^>]*)aria-label="Share on WhatsApp"/gi,
    '$1aria-label="Join WhatsApp Channel"'
  );
  out = out.replace(
    /(<a[^>]*class="[^"]*\btelegram\b[^"]*"[^>]*)aria-label="Share on Telegram"/gi,
    '$1aria-label="Join Telegram Channel"'
  );
  out = out.replace(
    /(<a[^>]*class="[^"]*\bfacebook\b[^"]*"[^>]*)aria-label="Share on Facebook"/gi,
    '$1aria-label="Join Facebook Page"'
  );

  if (!out.includes("job-page-share.js")) {
    out = out.replace(/<\/body>/i, `<script src="${JOB_PAGE_SHARE_SCRIPT}" defer></script>\n</body>`);
  } else {
    out = out.replace(/\/js\/job-page-share\.js\?v=\d+/g, JOB_PAGE_SHARE_SCRIPT);
  }

  return out;
}

module.exports = {
  JOB_PAGE_SHARE_SCRIPT,
  SOCIAL_JOIN_LINKS,
  normalizeJobPageShareInHtml
};
