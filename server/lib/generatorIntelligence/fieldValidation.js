"use strict";

/**
 * Field validation + confidence scoring for extracted sections.
 */

const { extractStrictDateFromText } = require("../../utils/extractDateValue");
const { evaluatePublisherTable } = require("../../utils/tableDetect");
const { BLOCK_TYPES, SECTION_TYPES } = require("./types");

/**
 * @param {string} url
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateUrl(url) {
  const u = String(url || "").trim();
  if (!u) return { ok: false, reason: "empty_url" };
  if (u === "—" || u === "-") return { ok: false, reason: "placeholder_url" };
  if (/^https?:\/\/\s*$/i.test(u)) return { ok: false, reason: "broken_url" };
  if (/^https?:\/\//i.test(u)) {
    try {
      // eslint-disable-next-line no-new
      new URL(u);
      return { ok: true };
    } catch {
      return { ok: false, reason: "invalid_url" };
    }
  }
  if (/^www\./i.test(u)) return { ok: true };
  if (/^\//.test(u)) return { ok: true };
  return { ok: false, reason: "unsupported_url_scheme" };
}

/**
 * @param {string} value
 * @returns {{ ok: boolean, normalized?: string|null, reason?: string }}
 */
function validateDateValue(value) {
  const v = String(value || "").trim();
  if (!v || v === "—") return { ok: false, reason: "empty_date" };
  if (/\b(notify\s*soon|to\s*be\s*announced|t\.?\s*b\.?\s*a\.?)\b/i.test(v)) {
    return { ok: true, normalized: "Notify Soon" };
  }
  const strict = extractStrictDateFromText(v);
  if (strict) return { ok: true, normalized: strict };
  // Accept label:value lines where value portion parses
  if (v.includes(":")) {
    const tail = v.split(":").slice(1).join(":").trim();
    const fromTail = extractStrictDateFromText(tail);
    if (fromTail) return { ok: true, normalized: fromTail };
  }
  return { ok: false, reason: "unrecognized_date_format", normalized: null };
}

/**
 * @param {string[][]} rows
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validateTableRows(rows) {
  const issues = [];
  if (!Array.isArray(rows) || rows.length < 2) {
    return { ok: false, issues: ["empty_or_single_row_table"] };
  }
  const widths = rows.map((r) => (Array.isArray(r) ? r.length : 0));
  const expected = widths[0];
  if (expected < 2) issues.push("few_columns");
  for (let i = 1; i < widths.length; i++) {
    if (widths[i] !== expected) issues.push(`col_mismatch_row_${i}`);
  }
  const seen = new Set();
  let dupes = 0;
  for (let i = 1; i < rows.length; i++) {
    const key = (rows[i] || []).join("|").toLowerCase();
    if (seen.has(key)) dupes += 1;
    else seen.add(key);
  }
  if (dupes) issues.push(`duplicate_rows:${dupes}`);
  const emptyRows = rows.filter((r) => !(r || []).some((c) => String(c || "").trim())).length;
  if (emptyRows) issues.push(`empty_rows:${emptyRows}`);
  return { ok: issues.filter((x) => !x.startsWith("duplicate_rows")).length === 0, issues };
}

/**
 * @param {object} section
 * @returns {{
 *   sectionType: string,
 *   title: string,
 *   ok: boolean,
 *   confidence: number,
 *   issues: string[]
 * }}
 */
function validateSection(section) {
  const issues = [];
  const title = String(section?.title || "").trim();
  if (!title) issues.push("missing_title");

  const content = String(section?.originalContent || "").trim();
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  if (!content && !blocks.length) issues.push("empty_section");

  let confidence = typeof section?.confidence === "number" ? section.confidence : 0.5;

  for (const block of blocks) {
    if (block.type === BLOCK_TYPES.DATE_LIST) {
      for (const item of block.items || []) {
        const check = validateDateValue(item.value || item.label);
        if (!check.ok && item.value !== "Notify Soon") {
          issues.push(`bad_date:${item.label || item.value}`);
          confidence -= 0.05;
        }
      }
    }
    if (block.type === BLOCK_TYPES.LINK_LIST) {
      for (const item of block.items || []) {
        const check = validateUrl(item.url);
        if (!check.ok) {
          issues.push(`broken_url:${item.url || item.label}`);
          confidence -= 0.08;
        }
      }
    }
    if (block.type === BLOCK_TYPES.TABLE) {
      const tableCheck = validateTableRows(block.rows);
      if (!tableCheck.ok) {
        issues.push(...tableCheck.issues.map((i) => `table_${i}`));
        confidence -= 0.1;
      } else if (tableCheck.issues.length) {
        issues.push(...tableCheck.issues.map((i) => `table_${i}`));
        confidence -= 0.03;
      }
      if (block.csvBody) {
        const pub = evaluatePublisherTable(block.csvBody);
        if (!pub.eligible) {
          issues.push("invalid_table");
          confidence -= 0.08;
        }
      }
    }
    if (block.type === BLOCK_TYPES.FAQ) {
      const pairs = block.pairs || [];
      if (!pairs.length) issues.push("empty_faq");
      for (const p of pairs) {
        if (!p.q || !p.a) issues.push("incomplete_faq_pair");
      }
    }
  }

  // Deduplicate identical consecutive lines in content
  if (content) {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    const seen = new Set();
    let dupes = 0;
    for (const l of lines) {
      const k = l.toLowerCase();
      if (seen.has(k)) dupes += 1;
      else seen.add(k);
    }
    if (dupes) {
      issues.push(`duplicate_lines:${dupes}`);
      confidence -= Math.min(0.1, dupes * 0.02);
    }
  }

  confidence = Math.max(0.05, Math.min(0.99, confidence));
  const ok = !issues.some(
    (i) =>
      i === "missing_title" ||
      i === "empty_section" ||
      i === "invalid_table" ||
      i.startsWith("broken_url")
  );

  return {
    sectionType: section?.sectionType || SECTION_TYPES.UNKNOWN,
    title,
    ok,
    confidence: Number(confidence.toFixed(3)),
    issues
  };
}

/**
 * @param {object} structured
 * @returns {{
 *   ok: boolean,
 *   overallConfidence: number,
 *   sections: ReturnType<typeof validateSection>[],
 *   issues: string[],
 *   summary: object
 * }}
 */
function validateStructuredDocument(structured) {
  const sections = Array.isArray(structured?.sections) ? structured.sections : [];
  const results = sections.map(validateSection);
  const issues = [];

  if (!structured?.metadata?.title && !sections.length) {
    issues.push("missing_document_title");
  }
  if (!sections.length) issues.push("no_sections");

  const emptyCount = results.filter((r) => r.issues.includes("empty_section")).length;
  if (emptyCount) issues.push(`empty_sections:${emptyCount}`);

  const confidences = results.map((r) => r.confidence);
  const overallConfidence = confidences.length
    ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3))
    : 0;

  const ok =
    results.length > 0 &&
    results.some((r) => r.ok) &&
    !issues.includes("no_sections");

  return {
    ok,
    overallConfidence,
    sections: results,
    issues,
    summary: {
      sectionCount: results.length,
      okSections: results.filter((r) => r.ok).length,
      knownSections: sections.filter((s) => s.isKnownSection).length,
      unknownSections: sections.filter((s) => !s.isKnownSection).length,
      avgConfidence: overallConfidence
    }
  };
}

module.exports = {
  validateUrl,
  validateDateValue,
  validateTableRows,
  validateSection,
  validateStructuredDocument
};
