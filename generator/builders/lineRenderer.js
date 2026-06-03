"use strict";

const { sanitizeUrl, resolveUrl } = require("../../server/utils/escapeHtml");
const { escapeBodyDisplayText } = require("../lib/displayTextNormalize");
const {
  hasMarkdownInlineLinks,
  renderParagraphWithInlineMarkdownLinks
} = require("../lib/inlineMarkdownLinks");
const { hasRichInlineTags, renderRichBodyDisplayHtml } = require("../lib/richInlineText");

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

function renderLinkBoxAnchor(label, href) {
  const left = escapeBodyDisplayText(label, { mode: "title" });
  const safeHref = sanitizeUrl(resolveUrl(href));
  return renderLinkBox(
    left,
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">Click Here</a>`
  );
}

function renderLinkBoxStatus(label, statusText) {
  const left = escapeBodyDisplayText(label, { mode: "title" });
  const status = escapeBodyDisplayText(statusText, { mode: "title" });
  return renderLinkBox(left, `<span class="link-box-status">${status}</span>`);
}

/**
 * Render section lines as HTML (paragraphs, FAQ, links, key-value rows).
 * @param {string[]} lines — non-empty trimmed lines
 * @param {{ sectionName?: string }} [options]
 * @returns {string}
 */
function renderLinesToHtml(lines, options = {}) {
  if (!Array.isArray(lines) || !lines.length) {
    return "";
  }

  const linksSection = isImportantLinksSection(options.sectionName);

  return lines
    .map((line) => {
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
        return renderLinkBoxAnchor("Link", rawLine);
      }

      if (hasEq && eqLooksLikeLink && (!hasColon || leftOfEq.length > 0)) {
        return renderLinkBoxAnchor(leftOfEq || "Link", rightOfEq);
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

        return `
            <div class="date-row">
              <span class="date-label">${escapeBodyDisplayText(label, { mode: "title" })} :</span>
              <span class="date-value">${escapeBodyDisplayText(value, { mode: "title" })}</span>
            </div>
          `;
      }

      if (hasRichInlineTags(rawLine)) {
        return `<p>${renderRichBodyDisplayHtml(rawLine, { mode: paraMode })}</p>`;
      }

      return `<p>${escapeBodyDisplayText(rawLine, { mode: paraMode })}</p>`;
    })
    .join("");
}

module.exports = {
  renderLinesToHtml,
  isUrlLike,
  isImportantLinksSection
};
