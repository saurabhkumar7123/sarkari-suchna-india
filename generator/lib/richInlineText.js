"use strict";

const { escapeHtml } = require("../../server/utils/escapeHtml");
const {
  BODY_LINE_BREAK_TOKEN,
  protectBodyLineBreakTokens,
  restoreBodyLineBreakTokens,
  normalizeDisplayText
} = require("./displayTextNormalize");
const { resolveSafeInlineHref } = require("./inlineMarkdownLinks");

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

/** Whitelisted [color=name] values only. */
const ALLOWED_COLORS = ["red", "green", "blue", "orange", "purple", "gray", "yellow"];

const COLOR_OPEN_RE = new RegExp(`^\\[color=(${ALLOWED_COLORS.join("|")})\\]`, "i");
const COLOR_CLOSE_RE = /^\[\/color\]/i;

const TAG_DEFS = {
  b: { openRe: /^\[b\]/i, closeRe: /^\[\/b\]/i, wrap: (inner) => `<strong class="rt-bold">${inner}</strong>` },
  highlight: {
    openRe: /^\[highlight\]/i,
    closeRe: /^\[\/highlight\]/i,
    wrap: (inner) => `<mark class="rt-highlight">${inner}</mark>`
  }
};

const OPEN_ORDER = ["highlight", "b"];

/**
 * @param {string} inner
 * @param {string} colorName
 */
function wrapColor(inner, colorName) {
  const name = String(colorName || "").toLowerCase();
  if (!ALLOWED_COLORS.includes(name)) {
    return inner;
  }
  return `<span class="rt-color rt-color--${name}">${inner}</span>`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasRichInlineTags(text) {
  const s = String(text ?? "");
  return (
    /\[b\]/i.test(s) ||
    /\[\/b\]/i.test(s) ||
    /\[highlight\]/i.test(s) ||
    /\[\/highlight\]/i.test(s) ||
    /\[color=(?:red|green|blue|orange|purple|gray|yellow)\]/i.test(s) ||
    /\[\/color\]/i.test(s)
  );
}

/**
 * @param {string} text
 * @param {{ mode?: "title"|"sentence" }} options
 */
function escapePlainSegment(text, options = {}) {
  const normalized = normalizeDisplayText(String(text ?? ""), options);
  return escapeHtml(normalized);
}

/**
 * @param {string} tail
 * @returns {{ type: string, tag?: string, len: number, label?: string, href?: string } | null}
 */
function matchToken(tail) {
  if (!tail.startsWith("[")) return null;

  if (/^\[br\]/i.test(tail)) {
    return { type: "br", len: 4 };
  }

  const colorOpen = COLOR_OPEN_RE.exec(tail);
  if (colorOpen) {
    return {
      type: "open",
      tag: "color",
      colorName: colorOpen[1].toLowerCase(),
      len: colorOpen[0].length
    };
  }

  const colorClose = COLOR_CLOSE_RE.exec(tail);
  if (colorClose) {
    return { type: "close", tag: "color", len: colorClose[0].length };
  }

  for (const tag of OPEN_ORDER) {
    const def = TAG_DEFS[tag];
    const m = def.openRe.exec(tail);
    if (m) return { type: "open", tag, len: m[0].length };
  }

  for (const tag of OPEN_ORDER) {
    const def = TAG_DEFS[tag];
    const m = def.closeRe.exec(tail);
    if (m) return { type: "close", tag, len: m[0].length };
  }

  const linkMatch = MARKDOWN_LINK_RE.exec(tail);
  if (linkMatch) {
    const safeHref = resolveSafeInlineHref(linkMatch[2]);
    if (safeHref) {
      return {
        type: "link",
        len: linkMatch[0].length,
        label: linkMatch[1],
        href: safeHref
      };
    }
  }

  return null;
}

/**
 * @param {string} work
 * @param {number} start
 * @param {{ mode?: "title"|"sentence" }} options
 * @param {string | null} closeTag — when inside a tag, stop at matching close
 * @returns {{ html: string, pos: number }}
 */
function parseRange(work, start, options, closeTag = null) {
  let html = "";
  let i = start;

  while (i < work.length) {
    const tail = work.slice(i);
    const token = matchToken(tail);

    if (token && token.type === "close" && closeTag && token.tag === closeTag) {
      return { html, pos: i + token.len };
    }

    if (!token) {
      const next = work.indexOf("[", i);
      if (next === -1) {
        html += escapePlainSegment(work.slice(i), options);
        i = work.length;
      } else if (next > i) {
        html += escapePlainSegment(work.slice(i, next), options);
        i = next;
      } else {
        html += escapePlainSegment(work.slice(i, i + 1), options);
        i += 1;
      }
      continue;
    }

    if (token.type === "close" && !closeTag) {
      html += escapePlainSegment(work.slice(i, i + token.len), options);
      i += token.len;
      continue;
    }

    if (token.type === "close" && closeTag && token.tag !== closeTag) {
      html += escapePlainSegment(work.slice(i, i + token.len), options);
      i += token.len;
      continue;
    }

    if (token.type === "br") {
      html += escapePlainSegment(work.slice(i, i), options);
      html += "<br>";
      i += token.len;
      continue;
    }

    if (token.type === "link") {
      const labelHtml = parseRange(String(token.label ?? ""), 0, options, null).html;
      html += `<a class="inline-markdown-link" href="${escapeHtml(token.href)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;
      i += token.len;
      continue;
    }

    if (token.type === "open") {
      i += token.len;
      const inner = parseRange(work, i, options, token.tag);
      if (token.tag === "color") {
        html += wrapColor(inner.html, token.colorName);
      } else {
        html += TAG_DEFS[token.tag].wrap(inner.html);
      }
      i = inner.pos;
      continue;
    }

    html += escapePlainSegment(work.slice(i, i + token.len), options);
    i += token.len;
  }

  if (closeTag) {
    return { html, pos: work.length };
  }

  return { html, pos: i };
}

/**
 * @param {string} text
 * @param {{ mode?: "title"|"sentence", allowLineBreaks?: boolean }} [options]
 * @returns {string}
 */
function renderRichBodyDisplayHtml(text, options = {}) {
  let src = String(text ?? "");
  let brPlaceholders = [];

  const allowLineBreaks = options.allowLineBreaks !== false;
  if (allowLineBreaks && src.includes(BODY_LINE_BREAK_TOKEN)) {
    const protected_ = protectBodyLineBreakTokens(src);
    src = protected_.work;
    brPlaceholders = protected_.placeholders;
  }

  let html = parseRange(src, 0, options, null).html;

  if (brPlaceholders.length > 0) {
    html = restoreBodyLineBreakTokens(html, brPlaceholders);
    if (html.includes(BODY_LINE_BREAK_TOKEN)) {
      html = html.split(BODY_LINE_BREAK_TOKEN).join("<br>");
    }
  }

  return html;
}

module.exports = {
  ALLOWED_COLORS,
  hasRichInlineTags,
  renderRichBodyDisplayHtml,
  escapePlainSegment,
  parseRange,
  wrapColor
};
