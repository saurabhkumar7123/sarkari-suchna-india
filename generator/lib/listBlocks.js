"use strict";

const { escapeBodyDisplayText } = require("./displayTextNormalize");

const LIST_OPEN_RE = /^\[list\]\s*$/i;
const LIST_CLOSE_RE = /^\[\/list\]\s*$/i;
const BULLET_PREFIX_RE = /^[-*•]\s+(.+)$/;

/**
 * @param {string} line
 * @returns {string | null} Item body when line is a safe bullet prefix line.
 */
function parseBulletLineContent(line) {
  const raw = String(line || "").trim();
  const m = raw.match(BULLET_PREFIX_RE);
  if (!m) return null;
  const content = String(m[1] || "").trim();
  return content || null;
}

/**
 * Auto-group only when every line is a bullet line and none contain ':' (date-row risk).
 * @param {string[]} lines
 */
function canAutoGroupBulletLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return false;
  return lines.every((line) => {
    const raw = String(line || "").trim();
    if (!parseBulletLineContent(raw)) return false;
    if (raw.includes(":")) return false;
    return true;
  });
}

/**
 * Split section lines into render blocks (explicit [list] or safe auto bullet runs).
 * @param {string[]} lines
 * @returns {Array<{ type: "list", items: string[] } | { type: "line", line: string }>}
 */
function parseLineBlocks(lines) {
  const blocks = [];
  const src = Array.isArray(lines) ? lines : [];
  let i = 0;

  while (i < src.length) {
    const raw = String(src[i] || "").trim();

    if (LIST_OPEN_RE.test(raw)) {
      i += 1;
      const items = [];
      while (i < src.length && !LIST_CLOSE_RE.test(String(src[i] || "").trim())) {
        const itemLine = String(src[i] || "").trim();
        if (itemLine) items.push(itemLine);
        i += 1;
      }
      if (i < src.length && LIST_CLOSE_RE.test(String(src[i] || "").trim())) {
        i += 1;
      }
      if (items.length) {
        blocks.push({ type: "list", items });
      }
      continue;
    }

    const bulletContent = parseBulletLineContent(raw);
    if (bulletContent && !raw.includes(":")) {
      const group = [raw];
      let j = i + 1;
      while (j < src.length) {
        const nextRaw = String(src[j] || "").trim();
        const nextBullet = parseBulletLineContent(nextRaw);
        if (!nextBullet || nextRaw.includes(":")) break;
        group.push(nextRaw);
        j += 1;
      }
      if (canAutoGroupBulletLines(group)) {
        blocks.push({
          type: "list",
          items: group.map((line) => parseBulletLineContent(line))
        });
        i = j;
        continue;
      }
    }

    blocks.push({ type: "line", line: src[i] });
    i += 1;
  }

  return blocks;
}

/**
 * @param {string[]} items
 * @param {{ mode?: "title"|"sentence", sectionName?: string }} [options]
 * @returns {string}
 */
function renderContentListHtml(items, options = {}) {
  if (!Array.isArray(items) || !items.length) return "";

  const mode =
    options.mode ||
    (items.some((t) => String(t).length > 160) ? "sentence" : "title");

  const lis = items
    .map((item) => {
      const text = String(item || "").trim();
      if (!text) return "";
      const inner = escapeBodyDisplayText(text, { mode });
      return `<li>${inner}</li>`;
    })
    .filter(Boolean)
    .join("");

  if (!lis) return "";
  return `<ul class="content-list">${lis}</ul>`;
}

module.exports = {
  LIST_OPEN_RE,
  LIST_CLOSE_RE,
  BULLET_PREFIX_RE,
  parseBulletLineContent,
  canAutoGroupBulletLines,
  parseLineBlocks,
  renderContentListHtml
};
