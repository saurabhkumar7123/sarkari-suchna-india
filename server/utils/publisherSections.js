"use strict";

const { parseSectionsFromText } = require("../../generator/parse/sectionParse");
const { normalizeSectionFormatting } = require("./normalizeSectionFormatting");

/** Plain-text line headers (no brackets) → [Section: …] for PDF paste */
const IMPLICIT_HEADER_LINES = {
  "short information": "Short Information",
  "short info": "Short Information",
  "shortinfo": "Short Information",
  "important dates": "Important Dates",
  "important date": "Important Dates",
  "application fee": "Application Fee",
  "application fees": "Application Fee",
  "important links": "Important Links",
  "important questions": "Important Questions",
  faq: "Important Questions",
  eligibility: "Eligibility",
  vacancy: "Vacancy",
  "selection process": "Selection Process"
};

const SECTION_ALIAS_MAP = {
  shortinfo: "Short Information",
  "short info": "Short Information",
  "short information": "Short Information",
  eligibility: "Eligibility",
  importantdates: "Important Dates",
  "important dates": "Important Dates",
  "important date": "Important Dates",
  applicationfee: "Application Fee",
  "application fee": "Application Fee",
  "application fees": "Application Fee",
  selectionprocess: "Selection Process",
  "selection process": "Selection Process",
  vacancy: "Vacancy",
  importantlinks: "Important Links",
  "important links": "Important Links",
  importantquestions: "Important Questions",
  "important questions": "Important Questions",
  faq: "Important Questions",
  "अक्सर पूछे जाने वाले प्रश्न": "Important Questions"
};

/**
 * @param {string} raw
 * @returns {string}
 */
function canonicalSectionTitle(raw) {
  let t = String(raw || "").trim();
  const forceTable = /\|\s*table\s*$/i.test(t);
  t = t.replace(/\|\s*table\s*$/i, "").trim();
  const key = t.toLowerCase().replace(/\s+/g, " ");
  const canonical = SECTION_ALIAS_MAP[key] || t;
  return forceTable ? `${canonical} | table` : canonical;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasExplicitSectionMarkers(text) {
  return /\[\s*section\s*:/i.test(String(text || ""));
}

/**
 * @param {string} text
 * @returns {string}
 */
function expandImplicitSectionHeaders(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    const key = t.replace(/[:：\s]+$/g, "").toLowerCase().replace(/\s+/g, " ");
    const canonical = IMPLICIT_HEADER_LINES[key];
    if (canonical && t.length < 80 && !/\d{4}/.test(t)) {
      out.push(`[Section: ${canonical}]`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/**
 * @param {string} body
 * @returns {boolean}
 */
function hasMeaningfulSectionBody(body) {
  return (
    String(body || "")
      .replace(/—/g, "")
      .replace(/\bQ:\s*—\s*\nA:\s*—/gi, "")
      .trim().length > 0
  );
}

/**
 * @param {string[]} parts
 * @param {string} title
 * @param {string} body
 */
function pushPublisherSection(parts, title, body) {
  const b = String(body || "").trim();
  if (!hasMeaningfulSectionBody(b)) return;
  parts.push(`[Section: ${title}]`);
  parts.push(b);
}

/**
 * @param {string[]} parts
 * @returns {string}
 */
function joinPublisherParts(parts) {
  return parts.length ? `${parts.join("\n")}\n` : "";
}

/**
 * Prepare pasted PDF/plain text before section detection.
 * @param {string} text
 * @returns {string}
 */
function prepareInputForStructuring(text) {
  const expanded = expandImplicitSectionHeaders(String(text || "").trim());
  return normalizeSectionFormatting(expanded);
}

/**
 * @param {Array<{ rawHeaderTitle?: string, cleanHeaderTitle?: string, forceTable?: boolean, content?: string }>} sections
 * @returns {string}
 */
function rebuildPublisherDocument(sections) {
  const parts = [];
  for (const sec of sections) {
    const rawTitle = sec.cleanHeaderTitle || sec.rawHeaderTitle || "";
    const forceTable = Boolean(sec.forceTable) || /\|\s*table\s*$/i.test(String(rawTitle));
    let title = canonicalSectionTitle(rawTitle);
    if (forceTable && !/\|\s*table\s*$/i.test(title)) {
      title = `${title} | table`;
    }
    const body = String(sec.content || "").trim();
    parts.push(`[Section: ${title}]`);
    if (body) parts.push(body);
  }
  return parts.length ? `${parts.join("\n")}\n` : "";
}

/**
 * When content already has [Section: …] blocks, normalize and preserve — do not re-extract.
 * @param {string} text
 * @returns {string | null}
 */
function tryPreserveStructuredInput(text) {
  const prepared = prepareInputForStructuring(text);
  if (!hasExplicitSectionMarkers(prepared) && !hasExplicitSectionMarkers(text)) {
    const implicitOnly = parseSectionsFromText(prepared);
    if (!implicitOnly.length) return null;
  } else if (!/\[\s*section\s*:/i.test(prepared)) {
    return null;
  }

  const sections = parseSectionsFromText(prepared);
  if (!sections.length) return null;

  const meaningful = sections.filter((s) => {
    const body = String(s.content || "").trim();
    return body.length > 0 && body !== "—";
  });

  if (meaningful.length >= 2) {
    return rebuildPublisherDocument(sections);
  }

  if (meaningful.length === 1 && sections.length === 1) {
    const body = meaningful[0].content.trim();
    if (body.length >= 40) return rebuildPublisherDocument(sections);
  }

  return null;
}

module.exports = {
  canonicalSectionTitle,
  rebuildPublisherDocument,
  tryPreserveStructuredInput,
  prepareInputForStructuring,
  expandImplicitSectionHeaders,
  hasExplicitSectionMarkers,
  hasMeaningfulSectionBody,
  pushPublisherSection,
  joinPublisherParts,
  SECTION_ALIAS_MAP
};
