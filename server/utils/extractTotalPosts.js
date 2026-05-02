"use strict";

/**
 * Best-effort total post count from vacancy / notification text.
 * @param {string} text
 * @returns {string|null} digits only, or null if not found
 */
function extractTotalPosts(text) {
  if (!text || typeof text !== "string") return null;
  const flat = text.replace(/\s+/g, " ");
  const patterns = [
    /(?:कुल|टोटल|total)\s*:?\s*(?:no\.?|number|पद|posts?)?\s*[:\s]*([\d,]+)\s*(?:posts?|पद)?/i,
    /total\s*:?\s*([\d,]+)\s*posts?/i,
    /total\s+posts?\s*[:\s]*([\d,]+)/i,
    /total\s+post\s*[:\s]*([\d,]+)/i,
    /(?:vacancies|vacancy)\s*[:\s]*([\d,]+)/i,
    /\b([\d,]{1,7})\s*\+?\s*posts?\b/i,
    /\bposts?\s*[:\s]*([\d,]{1,7})\b/i,
    /पद\s*[:\s]*([\d,]+)/i
  ];
  for (const re of patterns) {
    const m = flat.match(re);
    if (m && m[1]) {
      const n = String(m[1]).replace(/,/g, "").trim();
      if (/^\d+$/.test(n)) return n;
    }
  }
  return null;
}

module.exports = { extractTotalPosts };
