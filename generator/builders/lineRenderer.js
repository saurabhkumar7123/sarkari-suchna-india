"use strict";

const { escapeHtml, sanitizeUrl, resolveUrl } = require("../../server/utils/escapeHtml");

function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

/**
 * Render section lines as HTML (paragraphs, FAQ, links, key-value rows).
 * @param {string[]} lines — non-empty trimmed lines
 * @returns {string}
 */
function renderLinesToHtml(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    return "";
  }

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
        return `<div class="faq-item"><p><strong>${escapeHtml(rawLine)}</strong></p>`;
      }

      if (rawLine.startsWith("A:")) {
        return `<p>${escapeHtml(rawLine)}</p></div>`;
      }

      if (isUrlOnlyLine) {
        const left = "Link";
        const href = sanitizeUrl(resolveUrl(rawLine));
        return `
            <div class="link-box">
              <div class="left-text">${left}</div>
              <div class="right-link">
                <a href="${href}" target="_blank" rel="noopener noreferrer">Click Here</a>
              </div>
            </div>
          `;
      }

      if (hasEq && eqLooksLikeLink && (!hasColon || leftOfEq.length > 0)) {
        const left = escapeHtml(leftOfEq || "Link");
        const href = sanitizeUrl(resolveUrl(rightOfEq));
        return `
            <div class="link-box">
              <div class="left-text">${left}</div>
              <div class="right-link">
                <a href="${href}" target="_blank" rel="noopener noreferrer">Click Here</a>
              </div>
            </div>
          `;
      }

      if (rawLine.includes(":") && !rawLine.startsWith("Q:") && !rawLine.startsWith("A:")) {
        const parts = rawLine.split(":");
        return `
            <div class="date-row">
              <span class="date-label">${escapeHtml(parts[0].trim())} :</span>
              <span class="date-value">${escapeHtml(parts.slice(1).join(":").trim())}</span>
            </div>
          `;
      }

      return `<p>${escapeHtml(rawLine)}</p>`;
    })
    .join("");
}

module.exports = { renderLinesToHtml, isUrlLike };
