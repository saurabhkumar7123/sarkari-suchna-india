const { buildTable } = require("./tableBuilder");
const { escapeHtml, sanitizeUrl, resolveUrl } = require("../../server/utils/escapeHtml");

function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

function isSafeCsvTable(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return false;
  const trimmed = lines.map((x) => String(x || "").trim()).filter(Boolean);
  if (trimmed.length < 2) return false;

  if (trimmed.some((line) => line.length > 180)) return false;
  if (!trimmed.every((line) => line.includes(","))) return false;

  const rows = trimmed.map((line) => line.split(",").map((c) => c.trim()));
  const colCount = rows[0].length;
  if (colCount < 2) return false;
  if (!rows.every((row) => row.length === colCount)) return false;

  const hasNumericData = rows
    .slice(1)
    .some((row) => row.some((cell) => /\d/.test(cell)));
  if (!hasNumericData) return false;

  const avgCellLen =
    rows.reduce((sum, row) => sum + row.reduce((s, cell) => s + cell.length, 0), 0) /
    Math.max(1, rows.length * colCount);
  return avgCellLen <= 40;
}

function isNumberedRowsTable(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return false;
  const trimmed = lines.map((x) => String(x || "").trim()).filter(Boolean);
  if (trimmed.length < 2) return false;
  if (trimmed.some((line) => line.length > 180)) return false;
  return trimmed.every((line) => /^\d+\s*[.)]?\s*(,|\s|$)/.test(line));
}

function collectParsingWarnings(text) {
  const src = String(text || "");
  const warnings = [];
  const add = (msg) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };

  const hasStrictSection = /\[Section:[^\]\r\n]+\]/.test(src);
  if (!hasStrictSection) {
    add("No sections detected. Content may not render properly.");
  }

  const lines = src.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || "");
    const t = line.trim();
    if (!t) continue;

    if (/^\[\s*section\s*:.*\]$/i.test(t) && !/^\[Section:[^\]]+\]$/.test(t)) {
      add("Invalid section format. Use [Section: Name]");
    }
    if (/^\[Section\s+:/.test(t)) {
      add("Invalid section format. Use [Section: Name]");
    }
    if (/^\[(?:Section|section)\s*:[^\]]*$/.test(t)) {
      add("Invalid section format. Use [Section: Name]");
    }

    if (t.includes(":") && t.includes("=")) {
      add("Line contains both ':' and '=' — may be parsed incorrectly.");
    }

    if (/^https?:\/\/\S+/i.test(t)) {
      add("URL without label. Use Label=https://...");
    }
  }

  const sectionRegex = /\[\s*section\s*:\s*(.*?)\]([\s\S]*?)(?=\n\[\s*section\s*:|$)/gi;
  let match;
  while ((match = sectionRegex.exec(src)) !== null) {
    const content = String(match[2] || "").trim();
    if (!content) continue;
    const rowsWithComma = content
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length && x.includes(","));
    if (rowsWithComma.length >= 2) {
      const firstCount = rowsWithComma[0].split(",").length;
      const consistent = rowsWithComma.every((row) => row.split(",").length === firstCount);
      if (!consistent) {
        add("Table rows have inconsistent columns.");
      }
    }
  }

  return warnings;
}

function buildDynamicSectionsWithWarnings(text) {
  if (!text) {
    return {
      html: "",
      warnings: collectParsingWarnings(text)
    };
  }

  const sectionRegex = /\[\s*section\s*:\s*(.*?)\]([\s\S]*?)(?=\n\[\s*section\s*:|$)/gi;
  let match;
  let html = "";

  while ((match = sectionRegex.exec(text)) !== null) {

    const rawHeaderTitle = String(match[1] || "").trim();
    const forceTable = /\|\s*table\s*$/i.test(rawHeaderTitle);
    const cleanHeaderTitle = rawHeaderTitle.replace(/\|\s*table\s*$/i, "").trim();
    const title = escapeHtml(cleanHeaderTitle);
    const content = match[2].trim();

    let sectionContent = "";

    const lines = content.split("\n").filter(Boolean);

    const isTable = forceTable || isSafeCsvTable(lines) || isNumberedRowsTable(lines);

    if (isTable) {
      sectionContent = buildTable(content);
    }

    if (!sectionContent) {

      sectionContent = lines.map(line => {
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

      }).join("");
    }

    html += `
      <div class="card">
        <div class="card-header">
          <h2 class="section-title">
            ${title} <span class="section-icon">➜</span>
          </h2>
        </div>
        <div class="card-content">
          ${sectionContent}
        </div>
      </div>
    `;
  }

  return {
    html,
    warnings: collectParsingWarnings(text)
  };
}

function buildDynamicSections(text) {
  return buildDynamicSectionsWithWarnings(text).html;
}

module.exports = { buildDynamicSections, buildDynamicSectionsWithWarnings, collectParsingWarnings };