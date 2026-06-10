"use strict";

const { sanitizeUrl, resolveUrl, escapeHtml } = require("../../server/utils/escapeHtml");
const { escapeBodyDisplayText } = require("./displayTextNormalize");
const { cellHasExplicitListBlock, renderCellBlocksToHtml } = require("./listBlocks");

/** Same URL detection as lineRenderer.js */
function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

/**
 * Parse `Label=https://example.com` table cell syntax (first `=` only).
 * @param {string} cell
 * @returns {{ label: string, safeHref: string } | null}
 */
function parseTableCellLink(cell) {
  const raw = String(cell ?? "").trim();
  const eqIdx = raw.indexOf("=");
  if (eqIdx <= 0) return null;

  const label = raw.slice(0, eqIdx).trim();
  const hrefRaw = raw.slice(eqIdx + 1).trim();
  if (!label || !hrefRaw) return null;
  if (!isUrlLike(hrefRaw)) return null;

  const safeHref = sanitizeUrl(resolveUrl(hrefRaw));
  if (safeHref === "#") return null;

  return { label, safeHref };
}

/**
 * Render table cell inner HTML: link when Label=url matches, else escaped text.
 * @param {string} cell
 * @param {{ mode?: "title"|"sentence" }} [options]
 * @returns {string}
 */
function renderTableCellContent(cell, options = {}) {
  const mode = options.mode || "title";
  const link = parseTableCellLink(cell);
  if (link) {
    const labelHtml = escapeBodyDisplayText(link.label, { mode });
    const hrefAttr = escapeHtml(link.safeHref);
    return `<a class="table-cell-link" href="${hrefAttr}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;
  }
  if (cellHasExplicitListBlock(cell)) {
    return renderCellBlocksToHtml(cell, { mode });
  }
  return escapeBodyDisplayText(cell, { mode });
}

module.exports = {
  isUrlLike,
  parseTableCellLink,
  renderTableCellContent
};
