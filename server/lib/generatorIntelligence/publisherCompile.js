"use strict";

/**
 * Compile structured Generator Intelligence document → existing [Section: …] publisher text.
 * No Generator UI changes required — output matches what sectionEditor / sectionBuilder already consume.
 */

const { SECTION_TYPES, BLOCK_TYPES } = require("./types");
const { formatLinksForPublisher } = require("./linkClassification");
const { pushPublisherSection, joinPublisherParts } = require("../../utils/publisherSections");
const { resolveVacancySectionHeader } = require("../../utils/tableDetect");
const { normalizeSectionFormatting } = require("../../utils/normalizeSectionFormatting");
const { applyCanonicalPublisherFormat } = require("../../utils/canonicalPublisherFormat");
const { detectSmartTables } = require("./smartTableDetection");

/**
 * @param {object} block
 * @returns {string}
 */
function blockToText(block) {
  if (!block) return "";
  switch (block.type) {
    case BLOCK_TYPES.PARAGRAPH:
    case BLOCK_TYPES.NOTICE:
    case BLOCK_TYPES.RAW:
      return String(block.text || "").trim();
    case BLOCK_TYPES.DATE_LIST:
      return (block.items || [])
        .map((it) => {
          if (it.label && it.value && it.label !== it.value) return `${it.label} : ${it.value}`;
          return it.value || it.label || "";
        })
        .filter(Boolean)
        .join("\n");
    case BLOCK_TYPES.BULLET_LIST:
      return (block.items || []).map((x) => `- ${x}`).join("\n");
    case BLOCK_TYPES.LINK_LIST:
      return formatLinksForPublisher(block.items || []);
    case BLOCK_TYPES.FAQ:
      return (block.pairs || [])
        .map((p) => `Q: ${p.q}\nA: ${p.a}`)
        .join("\n");
    case BLOCK_TYPES.TABLE:
      return String(block.csvBody || "").trim();
    case BLOCK_TYPES.KEY_VALUE:
      return (block.items || [])
        .map((it) => `${it.label} : ${it.value}`)
        .join("\n");
    default:
      return String(block.text || block.csvBody || "").trim();
  }
}

/**
 * @param {object} section
 * @returns {string}
 */
function sectionBodyText(section) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  if (blocks.length) {
    const hasTable = blocks.some((b) => b.type === BLOCK_TYPES.TABLE);
    const hasOther = blocks.some((b) => b.type !== BLOCK_TYPES.TABLE);
    if (hasTable && hasOther) {
      return blocks
        .map((block) => {
          const text = blockToText(block);
          if (!text) return "";
          if (block.type === BLOCK_TYPES.TABLE) {
            return `---table---\n${text}\n---endtable---`;
          }
          return text;
        })
        .filter(Boolean)
        .join("\n");
    }
    return blocks.map(blockToText).filter(Boolean).join("\n");
  }
  const raw = String(section?.originalContent || "").trim();
  // Convert a full-section pipe/tab grid to CSV. Do not replace mixed/ambiguous
  // vacancy bodies with a partial table — that drops source grid lines.
  if (
    section?.sectionType === SECTION_TYPES.VACANCY_DETAILS ||
    /^vacancy/i.test(String(section?.title || ""))
  ) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const tables = detectSmartTables(lines);
    if (
      tables.length === 1 &&
      tables[0].csvBody &&
      tables[0].startIndex === 0 &&
      tables[0].endIndex >= lines.length
    ) {
      return tables[0].csvBody;
    }
  }
  return raw;
}

/**
 * Choose publisher section title (Vacancy | table when applicable).
 * @param {object} section
 * @param {string} body
 */
function resolvePublisherTitle(section, body) {
  const base =
    section.generatorTitle ||
    section.title ||
    "Other";

  if (
    section.sectionType === SECTION_TYPES.VACANCY_DETAILS ||
    /^vacancy/i.test(base)
  ) {
    if (/(^|\n)---table---(\n|$)/i.test(String(body || ""))) {
      return "Vacancy";
    }
    const resolved = resolveVacancySectionHeader(body);
    return resolved.title;
  }

  if (section.forceTable && !/\|\s*table\s*$/i.test(base)) {
    return `${base} | table`;
  }
  return base;
}

/**
 * @param {object} structured
 * @returns {string}
 */
function compileToPublisherText(structured) {
  const sections = Array.isArray(structured?.sections) ? structured.sections : [];
  const parts = [];

  // Merge Age Limit into Eligibility when both exist and Eligibility has no age line
  const ageSec = sections.find((s) => s.sectionType === SECTION_TYPES.AGE_LIMIT);
  const eligSec = sections.find((s) => s.sectionType === SECTION_TYPES.ELIGIBILITY);

  for (const section of sections) {
    if (section.sectionType === SECTION_TYPES.AGE_LIMIT && eligSec) {
      // Prefer embedding age under Eligibility for Generator default skeleton
      continue;
    }

    let body = sectionBodyText(section);
    if (section.sectionType === SECTION_TYPES.ELIGIBILITY && ageSec) {
      const ageBody = sectionBodyText(ageSec);
      if (ageBody && !/age\s*limit/i.test(body)) {
        body = [body, `Age Limit: ${ageBody}`].filter(Boolean).join("\n");
      }
    }

    if (!body || body === "—") continue;
    const title = resolvePublisherTitle(section, body);
    pushPublisherSection(parts, title, body);
  }

  return applyCanonicalPublisherFormat(normalizeSectionFormatting(joinPublisherParts(parts)));
}

module.exports = {
  blockToText,
  sectionBodyText,
  resolvePublisherTitle,
  compileToPublisherText
};
