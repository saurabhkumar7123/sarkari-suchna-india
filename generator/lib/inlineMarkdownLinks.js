"use strict";

const { sanitizeUrl, resolveUrl, escapeHtml } = require("../../server/utils/escapeHtml");
const { escapeBodyDisplayText } = require("./displayTextNormalize");

/** Markdown inline link: [label](href) — href is non-greedy up to closing paren. */
const MARKDOWN_INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Same URL detection as lineRenderer.js / tableCellLink.js */
function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasMarkdownInlineLinks(text) {
  MARKDOWN_INLINE_LINK_RE.lastIndex = 0;
  return MARKDOWN_INLINE_LINK_RE.test(String(text ?? ""));
}

/**
 * @param {string} hrefRaw
 * @returns {string | null} Safe href for attribute, or null when blocked.
 */
function resolveSafeInlineHref(hrefRaw) {
  const trimmed = String(hrefRaw ?? "").trim();
  if (!trimmed || !isUrlLike(trimmed)) return null;
  const safeHref = sanitizeUrl(resolveUrl(trimmed));
  if (!safeHref || safeHref === "#") return null;
  return safeHref;
}

/**
 * Render paragraph body: optional [text](url) segments + escaped plain text.
 * Only used for lines that already fall through to <p> rendering (additive).
 * @param {string} text
 * @param {{ mode?: "title"|"sentence" }} [options]
 * @returns {string}
 */
function renderParagraphWithInlineMarkdownLinks(text, options = {}) {
  const raw = String(text ?? "");
  if (!hasMarkdownInlineLinks(raw)) {
    return escapeBodyDisplayText(raw, options);
  }

  let html = "";
  let lastIndex = 0;
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      html += escapeBodyDisplayText(raw.slice(lastIndex, match.index), options);
    }

    const label = match[1];
    const hrefRaw = match[2];
    const safeHref = resolveSafeInlineHref(hrefRaw);

    if (safeHref) {
      const labelHtml = escapeBodyDisplayText(label, options);
      const hrefAttr = escapeHtml(safeHref);
      html += `<a class="inline-markdown-link" href="${hrefAttr}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;
    } else {
      html += escapeBodyDisplayText(match[0], options);
    }

    lastIndex = re.lastIndex;
  }

  if (lastIndex < raw.length) {
    html += escapeBodyDisplayText(raw.slice(lastIndex), options);
  }

  return html;
}

module.exports = {
  MARKDOWN_INLINE_LINK_RE,
  isUrlLike,
  hasMarkdownInlineLinks,
  resolveSafeInlineHref,
  renderParagraphWithInlineMarkdownLinks
};
