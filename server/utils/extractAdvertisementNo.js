"use strict";

/**
 * Extract advertisement reference from row text (e.g. "Advt No: 12/2024 | Last Date: ...").
 * @param {string} [text]
 * @returns {string}
 */
function extractAdvertisementNo(text) {
  const s = String(text ?? "").trim();
  if (!s) return "-";

  const patterns = [
    /\bAdvertisement\s+(?:No|Number)\.?\s*[-–—:]\s*([^\n\r|]+)/i,
    /\bAdvt\.?\s+No\.?\s*[-–—:]\s*([^\n\r|]+)/i,
    /\bAdvt\s*:\s*([^\n\r|]+)/i
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) {
      const v = m[1].trim().replace(/\s+/g, " ");
      if (v) return v.slice(0, 80);
    }
  }

  return "-";
}

module.exports = { extractAdvertisementNo };
