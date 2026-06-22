"use strict";

const { sanitizeUrl, resolveUrl } = require("../../server/utils/escapeHtml");
const { escapeBodyDisplayText } = require("../lib/displayTextNormalize");
const {
  hasMarkdownInlineLinks,
  renderParagraphWithInlineMarkdownLinks
} = require("../lib/inlineMarkdownLinks");
const { hasRichInlineTags, renderRichBodyDisplayHtml } = require("../lib/richInlineText");
const { parseLineBlocks, renderContentListHtml } = require("../lib/listBlocks");
const { parseLinkLineParts, parsePipeLinkLine } = require("../lib/parseLinkLineParts");

function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

function normalizeSectionKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isImportantLinksSection(sectionName) {
  const key = normalizeSectionKey(sectionName);
  return key === "importantlinks" || key === "importantlink";
}

function blockHasLinkLines(lines) {
  if (!Array.isArray(lines)) return false;
  return lines.some((line) => {
    const raw = String(line || "").trim();
    const eqIdx = raw.indexOf("=");
    if (eqIdx <= 0) return false;
    return isUrlLike(raw.slice(eqIdx + 1).trim());
  });
}

function renderLinkBox(left, rightHtml) {
  return `
            <div class="link-box">
              <div class="left-text">${left}</div>
              <div class="right-link">
                ${rightHtml}
              </div>
            </div>
          `;
}

function renderLinkBoxAnchor(leftOfEq, href) {
  const { displayLabel, buttonText } = parseLinkLineParts(leftOfEq, { fallbackLabel: "Link" });
  const left = escapeBodyDisplayText(displayLabel, { mode: "title" });
  const button = escapeBodyDisplayText(buttonText, { mode: "title" });
  const safeHref = sanitizeUrl(resolveUrl(href));
  return renderLinkBox(
    left,
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${button}</a>`
  );
}

function renderLinkBoxAnchors(displayLabel, actions) {
  const left = escapeBodyDisplayText(displayLabel, { mode: "title" });
  const multi = actions.length > 1;
  const buttonsHtml = actions
    .map((action) => {
      const button = escapeBodyDisplayText(action.buttonText, { mode: "title" });
      const safeHref = sanitizeUrl(resolveUrl(action.href));
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${button}</a>`;
    })
    .join("");
  const rightClass = multi ? "right-link link-box-actions" : "right-link";
  return `
            <div class="link-box">
              <div class="left-text">${left}</div>
              <div class="${rightClass}">
                ${buttonsHtml}
              </div>
            </div>
          `;
}

function renderLinkBoxStatus(label, statusText) {
  const left = escapeBodyDisplayText(label, { mode: "title" });
  const status = escapeBodyDisplayText(statusText, { mode: "title" });
  return renderLinkBox(left, `<span class="link-box-status">${status}</span>`);
}

function isPlaceholderDateValue(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return false;
  return (
    /will\s+be\s+update(d)?(\s+here)?\s+soon/i.test(v) ||
    /will\s+be\s+updated\s+soon/i.test(v) ||
    /available\s+soon/i.test(v) ||
    /to\s+be\s+announced/i.test(v) ||
    /^tba$/i.test(v) ||
    /^n\/a$/i.test(v) ||
    /not\s+yet\s+(released|announced|available)/i.test(v) ||
    /coming\s+soon/i.test(v)
  );
}

function dateValueClassName(value) {
  return isPlaceholderDateValue(value) ? "date-value date-value--placeholder" : "date-value";
}

/**
 * Render a single content line (paragraph, FAQ, links, key-value rows).
 * @param {string} line
 * @param {{ sectionName?: string }} [options]
 * @returns {string}
 */
function renderOneLine(line, options = {}) {
  const linksSection =
    isImportantLinksSection(options.sectionName) || options.linkStyleColonRows === true;
  const rawLine = String(line || "").trim();
  const eqIdx = rawLine.indexOf("=");
  const hasEq = eqIdx > -1;
  const hasColon = rawLine.includes(":");
  const leftOfEq = hasEq ? rawLine.slice(0, eqIdx).trim() : "";
  const rightOfEq = hasEq ? rawLine.slice(eqIdx + 1).trim() : "";
  const eqLooksLikeLink = hasEq && isUrlLike(rightOfEq);
  const isUrlOnlyLine = isUrlLike(rawLine);

  if (rawLine.startsWith("Q:")) {
    return `<div class="faq-item"><p><strong>${escapeBodyDisplayText(rawLine, { mode: "title" })}</strong></p>`;
  }

  if (rawLine.startsWith("A:")) {
    return `<p>${escapeBodyDisplayText(rawLine, { mode: "title" })}</p></div>`;
  }

  if (isUrlOnlyLine) {
    return renderLinkBoxAnchor("", rawLine);
  }

  if (hasEq && eqLooksLikeLink && (!hasColon || leftOfEq.length > 0)) {
    const pipeParsed = parsePipeLinkLine(rawLine);
    if (pipeParsed) {
      return renderLinkBoxAnchors(pipeParsed.displayLabel, pipeParsed.actions);
    }
    return renderLinkBoxAnchor(leftOfEq, rightOfEq);
  }

  const paraMode =
    rawLine.length > 160 && /[.!?]\s/.test(rawLine) ? "sentence" : "title";

  if (hasMarkdownInlineLinks(rawLine)) {
    return `<p>${renderParagraphWithInlineMarkdownLinks(rawLine, { mode: paraMode })}</p>`;
  }

  if (hasColon && !rawLine.startsWith("Q:") && !rawLine.startsWith("A:")) {
    const parts = rawLine.split(":");
    const label = parts[0].trim();
    const value = parts.slice(1).join(":").trim();

    if (linksSection && label && value) {
      return renderLinkBoxStatus(label, value);
    }

    const valueClass = dateValueClassName(value);
    return `
            <div class="date-row">
              <span class="date-label">${escapeBodyDisplayText(label, { mode: "title" })} :</span>
              <span class="${valueClass}">${escapeBodyDisplayText(value, { mode: "title" })}</span>
            </div>
          `;
  }

  if (hasRichInlineTags(rawLine)) {
    return `<p>${renderRichBodyDisplayHtml(rawLine, { mode: paraMode })}</p>`;
  }

  return `<p>${escapeBodyDisplayText(rawLine, { mode: paraMode })}</p>`;
}

/**
 * Render section lines as HTML (paragraphs, lists, FAQ, links, key-value rows).
 * @param {string[]} lines — non-empty trimmed lines
 * @param {{ sectionName?: string }} [options]
 * @returns {string}
 */
function renderLinesToHtml(lines, options = {}) {
  if (!Array.isArray(lines) || !lines.length) {
    return "";
  }

  const lineOptions = {
    ...options,
    linkStyleColonRows:
      isImportantLinksSection(options.sectionName) || blockHasLinkLines(lines)
  };

  const blocks = parseLineBlocks(lines);
  return blocks
    .map((block) => {
      if (block.type === "list") {
        return renderContentListHtml(block.items, lineOptions);
      }
      return renderOneLine(block.line, lineOptions);
    })
    .join("");
}

module.exports = {
  renderLinesToHtml,
  renderOneLine,
  isUrlLike,
  isImportantLinksSection,
  blockHasLinkLines,
  isPlaceholderDateValue,
  dateValueClassName
};
