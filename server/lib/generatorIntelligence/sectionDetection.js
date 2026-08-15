"use strict";

/**
 * Advanced section detection for recruitment notifications.
 * Detects known headings; preserves unknown sections instead of discarding them.
 */

const {
  SECTION_TYPES,
  SECTION_TYPE_TO_TITLE,
  SECTION_HEADING_MAP,
  BLOCK_TYPES
} = require("./types");
const { detectSmartTables, pickPrimaryVacancyTable } = require("./smartTableDetection");
const { detectAndClassifyLinks } = require("./linkClassification");
const { softCleanForStructuring } = require("./textNormalization");
const { classifyLine, isFeeLine } = require("../../utils/sectionDetector");
const { extractDateValueForDisplay } = require("../../utils/extractDateValue");

/**
 * @param {string} line
 * @returns {{ sectionType: string, title: string, confidence: number } | null}
 */
function matchSectionHeading(line) {
  const raw = String(line || "").trim();
  if (!raw || raw.length > 90) return null;
  if (/https?:\/\//i.test(raw)) return null;
  // Date/fee value rows are not headings
  if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(raw) && /:/.test(raw)) return null;
  if (/(₹|rs\.?)\s*[\d,]/i.test(raw)) return null;
  if (/^(Q|A|Question|Answer)\s*[:：]/i.test(raw)) return null;

  let t = raw
    .replace(/^\[\s*section\s*:\s*/i, "")
    .replace(/\]\s*$/, "")
    .replace(/[:：\-|–—]+$/g, "")
    .replace(/\|\s*table\s*$/i, "")
    .trim();
  // Drop leading enumeration: "3. Important Dates"
  t = t.replace(/^\d{1,2}[.)]\s+/, "").trim();
  // Bilingual heading: take left side of slash
  const bilingualLeft = t.split(/\s*\/\s*/)[0].trim();
  const key = bilingualLeft.toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;

  if (SECTION_HEADING_MAP[key]) {
    const sectionType = SECTION_HEADING_MAP[key];
    return {
      sectionType,
      title: SECTION_TYPE_TO_TITLE[sectionType] || bilingualLeft,
      confidence: 0.92
    };
  }

  // Exact full bilingual key
  const fullKey = t.toLowerCase().replace(/\s+/g, " ");
  if (SECTION_HEADING_MAP[fullKey]) {
    const sectionType = SECTION_HEADING_MAP[fullKey];
    return {
      sectionType,
      title: SECTION_TYPE_TO_TITLE[sectionType] || t,
      confidence: 0.9
    };
  }

  // Numbered / ALL-CAPS short headings treated as unknown section (preserved)
  if (/^\d{1,2}[.)]\s+[A-Za-z\u0900-\u097F].{2,60}$/.test(raw) && !/:/.test(raw) && !/\d{4}/.test(raw)) {
    const title = raw.replace(/^\d{1,2}[.)]\s+/, "").trim();
    return { sectionType: SECTION_TYPES.UNKNOWN, title, confidence: 0.55 };
  }
  if (/^[A-Z][A-Z\s/&-]{6,60}$/.test(raw) && !/\d{4}/.test(raw) && !/:/.test(raw)) {
    const title = raw.replace(/\s+/g, " ").trim().replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
    return { sectionType: SECTION_TYPES.UNKNOWN, title, confidence: 0.5 };
  }

  return null;
}

/**
 * Split text into heading-bounded sections; unknown headings kept.
 * @param {string} text
 * @returns {Array<{
 *   sectionType: string,
 *   title: string,
 *   isKnownSection: boolean,
 *   confidence: number,
 *   lines: string[],
 *   source: string
 * }>}
 */
function splitByHeadings(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sections = [];
  let current = {
    sectionType: SECTION_TYPES.SHORT_INFORMATION,
    title: SECTION_TYPE_TO_TITLE[SECTION_TYPES.SHORT_INFORMATION],
    isKnownSection: true,
    confidence: 0.4,
    lines: [],
    source: "preamble"
  };

  for (const line of lines) {
    const hit = matchSectionHeading(line);
    if (hit && (current.lines.length > 0 || sections.length === 0)) {
      if (current.lines.length || current.source === "preamble") {
        // Only push preamble if it gathered content
        if (current.lines.length) sections.push(current);
      }
      current = {
        sectionType: hit.sectionType,
        title: hit.title,
        isKnownSection: hit.sectionType !== SECTION_TYPES.UNKNOWN,
        confidence: hit.confidence,
        lines: [],
        source: "heading"
      };
      continue;
    }
    if (hit && current.lines.length === 0 && current.source === "preamble") {
      current = {
        sectionType: hit.sectionType,
        title: hit.title,
        isKnownSection: hit.sectionType !== SECTION_TYPES.UNKNOWN,
        confidence: hit.confidence,
        lines: [],
        source: "heading"
      };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);

  // Pull trailing FAQ pairs out of whatever section they landed in (often Helpline).
  return extractEmbeddedFaqSections(sections);
}

/**
 * If Q:/A: pairs appear inside another section, split them into a FAQ section.
 * @param {Array<object>} sections
 */
function extractEmbeddedFaqSections(sections) {
  const out = [];
  const faqLines = [];
  for (const sec of sections) {
    if (sec.sectionType === SECTION_TYPES.FAQ) {
      out.push(sec);
      continue;
    }
    const kept = [];
    let inFaq = false;
    for (const line of sec.lines || []) {
      if (/^(Q|Question)\s*[:：]/i.test(line) || (inFaq && /^(A|Answer)\s*[:：]/i.test(line))) {
        inFaq = true;
        faqLines.push(line);
        if (/^(A|Answer)\s*[:：]/i.test(line)) inFaq = false;
        continue;
      }
      kept.push(line);
    }
    if (kept.length) {
      out.push({ ...sec, lines: kept });
    } else if ((sec.lines || []).length && kept.length === 0 && faqLines.length) {
      // section became empty because it was only FAQ — skip
    } else if ((sec.lines || []).length === 0) {
      out.push(sec);
    }
  }
  if (faqLines.length) {
    out.push({
      sectionType: SECTION_TYPES.FAQ,
      title: SECTION_TYPE_TO_TITLE[SECTION_TYPES.FAQ],
      isKnownSection: true,
      confidence: 0.85,
      lines: faqLines,
      source: "faq-extract"
    });
  }
  return out;
}

/**
 * Flattened pay-level vacancy cell (delimiter-less PDF extraction).
 * Example: Level-71100020000YES
 * @param {string} line
 */
function isFlattenedVacancyGridCell(line) {
  const t = String(line || "").trim();
  if (!t || t.length > 80) return false;
  if (!/^Level-/i.test(t)) return false;
  if (/\s/.test(t)) return false;
  return /(YES|NO)$/i.test(t) || /^Level-\d{5,}\S*$/i.test(t);
}

/**
 * Vacancy-grid source line that cannot be safely structured — keep verbatim.
 * Does not reconstruct columns or invent values.
 * @param {string} line
 */
function isVacancyGridRetainLine(line) {
  const t = String(line || "").trim();
  if (!t || t.length > 160) return false;
  if (/https?:\/\/|www\./i.test(t)) return false;
  if (isFeeLine(t)) return false;
  if (/^(post\s*name|postname|name of post|पद)$/i.test(t)) return true;
  if (/URSCST|SCSTOBC/i.test(t)) return true;
  const catHits = t.match(/\b(UR|GEN|OBC|SC|ST|EWS|Total|OH|HH|VH|PWD)\b/gi) || [];
  if (catHits.length >= 4 && !/[|,]/.test(t)) return true;
  return isFlattenedVacancyGridCell(t);
}

/**
 * Short post-title immediately above a flattened vacancy cell.
 * @param {string} line
 */
function isAdjacentVacancyPostTitle(line) {
  const t = String(line || "").trim();
  if (t.length < 4 || t.length > 70) return false;
  if (/\d/.test(t)) return false;
  if (/\b(ministry|department|office|whether|candidate|colour|blind|s\.?\s*no)\b/i.test(t)) {
    return false;
  }
  return /\btranslator\b/i.test(t) || /^translator\(/i.test(t);
}

/**
 * Line indexes that belong to an ambiguous vacancy grid and must not be dropped.
 * @param {string[]} lines
 * @returns {Set<number>}
 */
function vacancyGridRetainIndexes(lines) {
  const retain = new Set();
  (lines || []).forEach((line, idx) => {
    if (isVacancyGridRetainLine(line)) retain.add(idx);
  });
  (lines || []).forEach((line, idx) => {
    if (retain.has(idx + 1) && isFlattenedVacancyGridCell(lines[idx + 1]) && isAdjacentVacancyPostTitle(line)) {
      retain.add(idx);
    }
  });
  return retain;
}

/**
 * Fallback line-bucket detection when headings are weak / missing.
 * @param {string} text
 */
function detectByLineClassification(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tables = detectSmartTables(lines);
  const covered = new Set();
  for (const t of tables) {
    for (let i = t.startIndex; i < t.endIndex; i++) covered.add(i);
  }

  const buckets = {
    dates: [],
    fee: [],
    age: [],
    vacancy: [],
    qualification: [],
    selection: [],
    links: [],
    faq: [],
    salary: [],
    howToApply: [],
    helpline: [],
    other: []
  };

  const gridRetain = vacancyGridRetainIndexes(lines);

  lines.forEach((line, idx) => {
    if (covered.has(idx)) return;
    const l = line.toLowerCase();
    if (/^(Q|Question)\s*[:：]/i.test(line) || /^(A|Answer)\s*[:：]/i.test(line)) {
      buckets.faq.push(line);
      return;
    }
    if (/https?:\/\/|www\./i.test(line)) {
      buckets.links.push(line);
      return;
    }
    if (isFeeLine(line)) {
      buckets.fee.push(line);
      return;
    }
    if (gridRetain.has(idx) || isVacancyGridRetainLine(line)) {
      buckets.vacancy.push(line);
      return;
    }
    if (/\b(helpline|help\s*desk|toll[\s-]*free|contact\s*(no|number|us)|phone|email\s*:)\b/i.test(l)) {
      buckets.helpline.push(line);
      return;
    }
    if (/\b(pay\s*scale|salary|वेतन|level[\s-]*\d+|7th\s*cpc|remuneration)\b/i.test(l)) {
      buckets.salary.push(line);
      return;
    }
    if (/\b(how\s*to\s*apply|steps?\s*to\s*apply|आवेदन\s*कैसे|register\s*on\s*the\s*portal)\b/i.test(l)) {
      buckets.howToApply.push(line);
      return;
    }
    const kind = classifyLine(line);
    if (kind === "dates") buckets.dates.push(line);
    else if (kind === "age") buckets.age.push(line);
    else if (kind === "qualification") buckets.qualification.push(line);
    else if (kind === "vacancy") buckets.vacancy.push(line);
    else if (kind === "selection") buckets.selection.push(line);
    else if (kind === "fee") buckets.fee.push(line);
    else if (kind === "links") buckets.links.push(line);
    else if (kind === "faq") buckets.faq.push(line);
    else buckets.other.push(line);
  });

  const vacancyTable = pickPrimaryVacancyTable(tables);
  if (vacancyTable) buckets.vacancy.unshift(vacancyTable.csvBody);

  for (const t of tables) {
    if (t === vacancyTable) continue;
    if (t.kind === "fee") buckets.fee.push(t.csvBody);
    else if (t.kind === "age") buckets.age.push(t.csvBody);
    else if (t.kind === "important_dates") buckets.dates.push(t.csvBody);
    else if (t.kind === "qualification") buckets.qualification.push(t.csvBody);
    else if (t.kind === "vacancy" || t.kind === "reservation") buckets.vacancy.push(t.csvBody);
  }

  return { buckets, tables, links: detectAndClassifyLinks(buckets.links) };
}

/**
 * Build block objects for a section body.
 * @param {string} sectionType
 * @param {string[]} lines
 * @param {object} [extras]
 */
function buildBlocks(sectionType, lines, extras = {}) {
  const bodyLines = (lines || []).map((l) => String(l).trim()).filter(Boolean);
  if (!bodyLines.length) return [];

  if (sectionType === SECTION_TYPES.IMPORTANT_LINKS || extras.links) {
    const links = extras.links || detectAndClassifyLinks(bodyLines);
    if (links.length) {
      return [
        {
          type: BLOCK_TYPES.LINK_LIST,
          items: links
        }
      ];
    }
  }

  if (sectionType === SECTION_TYPES.FAQ) {
    const pairs = [];
    let q = null;
    for (const line of bodyLines) {
      if (/^(Q|Question)\s*[:：]/i.test(line)) {
        q = line.replace(/^(Q|Question)\s*[:：]\s*/i, "").trim();
      } else if (/^(A|Answer)\s*[:：]/i.test(line) && q != null) {
        pairs.push({ q, a: line.replace(/^(A|Answer)\s*[:：]\s*/i, "").trim() });
        q = null;
      }
    }
    if (pairs.length) return [{ type: BLOCK_TYPES.FAQ, pairs }];
  }

  if (sectionType === SECTION_TYPES.IMPORTANT_DATES) {
    const items = bodyLines.map((line) => {
      const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
      if (m) {
        return { label: m[1].trim(), value: m[2].trim() };
      }
      const val = extractDateValueForDisplay(line);
      return { label: line, value: val !== "—" ? val : line };
    });
    return [{ type: BLOCK_TYPES.DATE_LIST, items }];
  }

  const tables = detectSmartTables(bodyLines);
  if (tables.length === 1 && tables[0].startIndex === 0 && tables[0].endIndex >= bodyLines.length) {
    return [
      {
        type: BLOCK_TYPES.TABLE,
        kind: tables[0].kind,
        rows: tables[0].rows,
        csvBody: tables[0].csvBody,
        confidence: tables[0].confidence
      }
    ];
  }

  if (bodyLines.every((l) => /^[-*•]\s+/.test(l) || /^\d+[.)]\s+/.test(l))) {
    return [
      {
        type: BLOCK_TYPES.BULLET_LIST,
        items: bodyLines.map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
      }
    ];
  }

  if (sectionType === SECTION_TYPES.IMPORTANT_INSTRUCTIONS || /note\s*:/i.test(bodyLines[0] || "")) {
    return [{ type: BLOCK_TYPES.NOTICE, text: bodyLines.join("\n") }];
  }

  return [{ type: BLOCK_TYPES.PARAGRAPH, text: bodyLines.join("\n") }];
}

/**
 * Primary section detection entry.
 * Prefer heading split when ≥2 known headings; else line classification.
 * @param {string} rawText
 */
function detectDocumentSections(rawText) {
  const cleaned = softCleanForStructuring(rawText);
  const headingSections = splitByHeadings(cleaned);
  const knownHeadingCount = headingSections.filter((s) => s.isKnownSection && s.source === "heading").length;

  if (knownHeadingCount >= 2) {
    const sections = headingSections.map((sec, order) => {
      const blocks = buildBlocks(sec.sectionType, sec.lines);
      return {
        order,
        sectionType: sec.sectionType,
        title: sec.title,
        isKnownSection: sec.isKnownSection,
        confidence: sec.confidence,
        lines: sec.lines,
        blocks,
        originalContent: sec.lines.join("\n")
      };
    });
    return {
      mode: "heading",
      cleaned,
      sections,
      tables: detectSmartTables(cleaned.split("\n")),
      links: detectAndClassifyLinks(
        cleaned
          .split("\n")
          .filter((l) => /https?:\/\/|www\./i.test(l) || /=https?:\/\//i.test(l))
      )
    };
  }

  const { buckets, tables, links } = detectByLineClassification(cleaned);
  const sections = [];
  let order = 0;

  const push = (sectionType, lines, confidence) => {
    const body = (lines || []).filter(Boolean);
    if (!body.length) return;
    const title = SECTION_TYPE_TO_TITLE[sectionType] || "Other";
    sections.push({
      order: order++,
      sectionType,
      title,
      isKnownSection: sectionType !== SECTION_TYPES.UNKNOWN,
      confidence,
      lines: body,
      blocks: buildBlocks(sectionType, body, {
        links: sectionType === SECTION_TYPES.IMPORTANT_LINKS ? links : undefined
      }),
      originalContent: body.join("\n")
    });
  };

  if (buckets.other.length) push(SECTION_TYPES.SHORT_INFORMATION, buckets.other, 0.55);
  const elig = [];
  if (buckets.qualification.length) elig.push(...buckets.qualification.map((x) => `Qualification: ${x}`));
  if (buckets.age.length) elig.push(...buckets.age.map((x) => `Age Limit: ${x}`));
  if (elig.length) push(SECTION_TYPES.ELIGIBILITY, elig, 0.7);
  push(SECTION_TYPES.IMPORTANT_DATES, buckets.dates, 0.75);
  push(SECTION_TYPES.APPLICATION_FEE, buckets.fee, 0.8);
  push(SECTION_TYPES.AGE_LIMIT, buckets.age.length && !elig.length ? buckets.age : [], 0.7);
  push(SECTION_TYPES.VACANCY_DETAILS, buckets.vacancy, 0.8);
  push(SECTION_TYPES.SELECTION_PROCESS, buckets.selection, 0.7);
  push(SECTION_TYPES.SALARY, buckets.salary, 0.7);
  push(SECTION_TYPES.HOW_TO_APPLY, buckets.howToApply, 0.7);
  if (links.length) {
    push(
      SECTION_TYPES.IMPORTANT_LINKS,
      links.map((l) => `${l.label}=${l.url}`),
      0.85
    );
  }
  push(SECTION_TYPES.FAQ, buckets.faq, 0.8);
  push(SECTION_TYPES.HELPLINE, buckets.helpline, 0.7);

  // Preserve leftover unclassified lines as unknown section rather than discard
  const used = new Set(
    sections.flatMap((s) => s.lines.map((l) => l.toLowerCase().replace(/\s+/g, " ")))
  );
  const leftover = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !used.has(l.toLowerCase().replace(/\s+/g, " ")))
    .filter((l) => !/https?:\/\//i.test(l))
    .slice(0, 20);
  if (leftover.length >= 3 && knownHeadingCount === 0) {
    // Already partially covered by short info; only add if clearly distinct
    const short = sections.find((s) => s.sectionType === SECTION_TYPES.SHORT_INFORMATION);
    if (!short) push(SECTION_TYPES.UNKNOWN, leftover, 0.4);
  }

  return { mode: "classification", cleaned, sections, tables, links };
}

module.exports = {
  matchSectionHeading,
  splitByHeadings,
  detectByLineClassification,
  buildBlocks,
  detectDocumentSections,
  isVacancyGridRetainLine,
  isFlattenedVacancyGridCell
};
