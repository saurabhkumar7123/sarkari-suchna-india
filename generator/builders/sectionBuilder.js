const { escapeDisplayText } = require("../lib/displayTextNormalize");
const { buildTable } = require("./tableBuilder");
const { renderLinesToHtml } = require("./lineRenderer");
const { buildMixedSectionHtml } = require("./mixedSectionBuilder");
const {
  parseSectionsFromText,
  resolveSectionRenderMode
} = require("../parse/sectionParse");
const { shouldUseMixedSectionBlocks } = require("../parse/sectionBlocks");
const { isImportantLinksSection } = require("./lineRenderer");
const { resolveSectionHeaderTone } = require("../lib/sectionHeaderTone");

function resolveCardLayoutClass(sectionContent) {
  const html = String(sectionContent || "");
  if (
    html.includes('class="table-responsive') ||
    html.includes('class="link-box"') ||
    html.includes('class="faq-item"')
  ) {
    return "card--wide";
  }
  return "card--compact";
}

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
  let htmlBeforeBanner = "";
  let htmlAfterBanner = "";
  let passedImportantLinks = false;
  const sections = parseSectionsFromText(text);

  for (const sec of sections) {
    const forceTable = sec.forceTable;
    const title = escapeDisplayText(sec.cleanHeaderTitle, { mode: "title" });
    const content = sec.content;
    const lines = sec.lines;

    let sectionContent = "";

    if (shouldUseMixedSectionBlocks(sec)) {
      sectionContent = buildMixedSectionHtml(content, sec.cleanHeaderTitle);
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
        sectionContent = renderLinesToHtml(lines, { sectionName: sec.cleanHeaderTitle });
      }
    }

    const cardLayoutClass = resolveCardLayoutClass(sectionContent);
    const headerToneClass = resolveSectionHeaderTone(sec);

    const cardHtml = `
      <div class="card ${cardLayoutClass}">
        <div class="card-header ${headerToneClass}">
          <h2 class="section-title">
            ${title} <span class="section-icon">➜</span>
          </h2>
        </div>
        <div class="card-content">
          ${sectionContent}
        </div>
      </div>
    `;

    html += cardHtml;

    if (passedImportantLinks) {
      htmlAfterBanner += cardHtml;
    } else {
      htmlBeforeBanner += cardHtml;
      if (isImportantLinksSection(sec.cleanHeaderTitle)) {
        passedImportantLinks = true;
      }
    }
  }

  if (!passedImportantLinks) {
    htmlBeforeBanner = html;
    htmlAfterBanner = "";
  }

  return {
    html,
    htmlBeforeBanner,
    htmlAfterBanner,
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
  resolveCardLayoutClass,
  resolveSectionHeaderTone,
  isSafeCsvTable: require("../parse/sectionParse").isSafeCsvTable,
  isNumberedRowsTable: require("../parse/sectionParse").isNumberedRowsTable
};
