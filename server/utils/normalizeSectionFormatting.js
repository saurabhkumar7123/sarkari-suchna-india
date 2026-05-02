"use strict";

/**
 * Force each [Section: …] onto its own line; never join sections with commas or inline headers.
 * @param {string} text
 * @returns {string}
 */
function normalizeSectionFormatting(text) {
  let s = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u200b/g, "")
    .trim();
  if (!s) return "";

  s = s.replace(/,\s*\[Section:/g, "\n[Section:");
  s = s.replace(/([^\n])\[Section:/g, "$1\n[Section:");
  s = s.replace(/\]\s*\[Section:/g, "]\n[Section:");

  const headerRe = /\[Section:\s*([^\]\r\n]+)\]\s*/gi;
  const hits = [];
  let m;
  while ((m = headerRe.exec(s)) !== null) {
    hits.push({ name: m[1].trim(), headerEnd: m.index + m[0].length, start: m.index });
  }
  if (!hits.length) return s;

  const parts = [];
  for (let i = 0; i < hits.length; i++) {
    const { name, headerEnd } = hits[i];
    const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : s.length;
    let body = s.slice(headerEnd, bodyEnd).trim();
    body = body
      .split("\n")
      .map((ln) => ln.trim())
      .filter((ln) => ln.length > 0)
      .join("\n");
    parts.push(`[Section: ${name}]`);
    if (body) parts.push(body);
  }
  return `${parts.join("\n")}\n`;
}

module.exports = { normalizeSectionFormatting };
