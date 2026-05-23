"use strict";

const { sanitizeUrl, resolveUrl } = require("../../server/utils/escapeHtml");
const { escapeDisplayText } = require("../lib/displayTextNormalize");

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
        return `<div class="faq-item"><p><strong>${escapeDisplayText(rawLine, { mode: "title" })}</strong></p>`;
      }

      if (rawLine.startsWith("A:")) {
        return `<p>${escapeDisplayText(rawLine, { mode: "title" })}</p></div>`;
      }

      if (isUrlOnlyLine) {
        const left = escapeDisplayText("Link", { mode: "title" });
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
        const left = escapeDisplayText(leftOfEq || "Link", { mode: "title" });
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
        const label = parts[0].trim();
        const value = parts.slice(1).join(":").trim();
        return `
            <div class="date-row">
              <span class="date-label">${escapeDisplayText(label, { mode: "title" })} :</span>
              <span class="date-value">${escapeDisplayText(value, { mode: "title" })}</span>
            </div>
          `;
      }

      const paraMode = rawLine.length > 160 && /[.!?]\s/.test(rawLine) ? "sentence" : "title";
      return `<p>${escapeDisplayText(rawLine, { mode: paraMode })}</p>`;
    })
    .join("");
}

module.exports = { renderLinesToHtml, isUrlLike };
