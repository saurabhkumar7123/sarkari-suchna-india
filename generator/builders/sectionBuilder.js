const { escapeDisplayText } = require("../lib/displayTextNormalize");
const { buildTable } = require("./tableBuilder");
const { renderLinesToHtml } = require("./lineRenderer");
const { buildMixedSectionHtml } = require("./mixedSectionBuilder");
const {
  parseSectionsFromText,
  resolveSectionRenderMode
} = require("../parse/sectionParse");
const { shouldUseMixedSectionBlocks } = require("../parse/sectionBlocks");

function collectParsingWarnings(text) {
  const { analyzeJobContent } = require("../analysis/contentAnalysis");
  return analyzeJobContent(text).legacyWarnings;
}

function buildDynamicSectionsWithWarnings(text) {
  if (!text) {
    return {
      html: "",
      warnings: collectParsingWarnings(text)
    };
  }

  let html = "";
  const sections = parseSectionsFromText(text);

  for (const sec of sections) {
    const forceTable = sec.forceTable;
    const title = escapeDisplayText(sec.cleanHeaderTitle, { mode: "title" });
    const content = sec.content;
    const lines = sec.lines;

    let sectionContent = "";

    if (shouldUseMixedSectionBlocks(sec)) {
      sectionContent = buildMixedSectionHtml(content);
    } else {
      const renderMode = resolveSectionRenderMode(lines, forceTable, content);
      const isTable =
        renderMode === "table_forced" ||
        renderMode === "table_auto_safe" ||
        renderMode === "table_auto_numbered";

      if (isTable) {
        sectionContent = buildTable(content);
      }

      if (!sectionContent && !forceTable) {
        sectionContent = renderLinesToHtml(lines);
      }
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

module.exports = {
  buildDynamicSections,
  buildDynamicSectionsWithWarnings,
  collectParsingWarnings,
  parseSectionsFromText,
  resolveSectionRenderMode,
  isSafeCsvTable: require("../parse/sectionParse").isSafeCsvTable,
  isNumberedRowsTable: require("../parse/sectionParse").isNumberedRowsTable
};
