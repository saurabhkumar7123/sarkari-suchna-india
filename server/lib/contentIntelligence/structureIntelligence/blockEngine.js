"use strict";

/**
 * CIP Stage 1D — Shared Block Intelligence.
 *
 * Parses a section body into ordered, typed blocks following the existing
 * Generator grammar (date rows, Label=url links, pipe multi-links, Q:/A: FAQ,
 * bullet/numbered lists, CSV tables, ---table--- markers, rich inline tags).
 *
 * Deterministic, no AI calls, never drops content: every non-empty input line
 * is preserved in exactly one block's originalContent.
 */

const {
  parsePipeLinkLine,
  parseLinkLineParts,
  isUrlLike
} = require("../../../../generator/lib/parseLinkLineParts");

const { normalizeTableGrid } = require("../../../utils/sectionEditorModel");

const {
  normalizeDateValue
} = require("../metadataIntelligence/metadataNormalizers");

const { BLOCK_TYPES, UNKNOWN_BLOCK_TYPE } = require("./structureTypes");

const TABLE_START_RE = /^---table---$/i;
const TABLE_END_RE = /^---endtable---$/i;
const RICH_TAG_RE = /\[\/?(?:b|highlight|color(?:=[a-z]+)?)\]/i;
const RICH_TAG_STRIP_RE = /\[\/?(?:b|highlight|color(?:=[a-z]+)?)\]/gi;
const DATE_VALUE_RE =
  /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})|([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/;
const DATE_LABEL_HINT_RE = /\b(?:date|dates|schedule)\b|तिथि|तारीख/i;

function stripRichTags(value) {
  return String(value || "").replace(RICH_TAG_STRIP_RE, "");
}

/**
 * Classify a single line following the Generator content grammar.
 * @param {string} raw
 * @returns {string} one of: empty, table_start, table_end, faq_q, faq_a,
 *   link, multi_link, list, kv, table_row, rich, paragraph
 */
function classifyLineKind(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "empty";
  if (TABLE_START_RE.test(trimmed)) return "table_start";
  if (TABLE_END_RE.test(trimmed)) return "table_end";

  const hasRich = RICH_TAG_RE.test(trimmed);
  const probe = (hasRich ? stripRichTags(trimmed).trim() : trimmed) || trimmed;

  if (probe.startsWith("Q:")) return "faq_q";
  if (probe.startsWith("A:")) return "faq_a";

  const eqIdx = probe.indexOf("=");
  if (eqIdx > 0 && isUrlLike(probe.slice(eqIdx + 1).trim())) {
    const piped = parsePipeLinkLine(probe);
    if (piped && piped.actions.length >= 2) return "multi_link";
    return "link";
  }
  if (/^(https?:\/\/|www\.)/i.test(probe)) return "link";

  if (/^[-*•]\s+/.test(probe) || /^\d+[.)]\s+/.test(probe)) return "list";

  const colonIdx = probe.indexOf(":");
  if (colonIdx > 0 && !/^https?:/i.test(probe)) {
    const label = probe.slice(0, colonIdx).trim();
    if (label && label.length <= 80) return "kv";
  }

  if (probe.split(",").length >= 3) return "table_row";
  if (hasRich) return "rich";
  return "paragraph";
}

function makeBlock(blockType, records, normalizedContent, confidence, warnings, extra = {}) {
  return {
    blockType,
    originalContent: records.map((r) => r.raw).join("\n"),
    normalizedContent,
    confidence,
    warnings,
    hasRichMarkup: records.some((r) => RICH_TAG_RE.test(r.raw)),
    ...extra
  };
}

function buildParagraphBlock(records) {
  const text = records.map((r) => r.trimmed).join("\n");
  return makeBlock(BLOCK_TYPES.PARAGRAPH, records, { text }, "high", []);
}

function buildRichTextBlock(records) {
  const text = records.map((r) => r.trimmed).join("\n");
  const plainText = records.map((r) => stripRichTags(r.trimmed).trim()).join("\n");
  return makeBlock(BLOCK_TYPES.RICH_TEXT, records, { text, plainText }, "high", []);
}

function buildListBlock(records) {
  const items = records.map((r) => {
    const s = stripRichTags(r.trimmed).trim();
    const ordered = /^\d+[.)]\s+/.test(s);
    const text = ordered
      ? s.replace(/^\d+[.)]\s+/, "").trim()
      : s.replace(/^[-*•]\s+/, "").trim();
    return { text, ordered };
  });
  return makeBlock(
    BLOCK_TYPES.LIST,
    records,
    { items, ordered: items.every((i) => i.ordered) },
    "high",
    []
  );
}

function buildKeyValueBlock(records) {
  const warnings = [];
  const rows = records.map((r) => {
    const s = stripRichTags(r.trimmed).trim();
    const colonIdx = s.indexOf(":");
    const label = s.slice(0, colonIdx).trim();
    const value = s.slice(colonIdx + 1).trim();
    const isDate = value
      ? DATE_VALUE_RE.test(value) || DATE_LABEL_HINT_RE.test(label)
      : DATE_LABEL_HINT_RE.test(label);
    return {
      label,
      value: value || null,
      normalizedValue: isDate && value ? normalizeDateValue(value) : value || null,
      isDate
    };
  });

  const missing = rows.filter((row) => !row.value).length;
  if (missing) warnings.push(`${missing} row(s) have a label but no value.`);

  const blockType = rows.some((row) => row.isDate)
    ? BLOCK_TYPES.DATE_ROW
    : BLOCK_TYPES.KEY_VALUE;
  return makeBlock(blockType, records, { rows }, missing ? "medium" : "high", warnings);
}

function parseLinkRecord(text) {
  const piped = parsePipeLinkLine(text);
  if (piped) {
    const actions = piped.actions.map((a) => ({ buttonText: a.buttonText, url: a.href }));
    if (actions.length >= 2) {
      return { label: piped.displayLabel, buttonText: null, url: null, actions, multi: true };
    }
    return {
      label: piped.displayLabel,
      buttonText: actions[0].buttonText,
      url: actions[0].url,
      actions: [],
      multi: false
    };
  }

  const eqIdx = text.indexOf("=");
  if (eqIdx > 0) {
    const url = text.slice(eqIdx + 1).trim();
    const { displayLabel, buttonText } = parseLinkLineParts(text.slice(0, eqIdx));
    return { label: displayLabel, buttonText, url, actions: [], multi: false };
  }

  // Bare URL line.
  return { label: null, buttonText: null, url: text, actions: [], multi: false, bare: true };
}

function buildLinkBlock(records) {
  const warnings = [];
  const links = records.map((r) => parseLinkRecord(stripRichTags(r.trimmed).trim()));
  const hasMulti = links.some((link) => link.multi);
  const bareCount = links.filter((link) => link.bare).length;
  if (bareCount) warnings.push(`${bareCount} unlabeled bare URL line(s).`);

  const allValid = links.every((link) =>
    link.multi ? link.actions.every((a) => isUrlLike(a.url)) : isUrlLike(link.url)
  );
  if (!allValid) warnings.push("Some link rows have a non URL-like target.");

  const confidence = allValid && !bareCount ? "high" : "medium";
  const blockType = hasMulti ? BLOCK_TYPES.MULTI_LINK : BLOCK_TYPES.LINK;
  return makeBlock(blockType, records, { links }, confidence, warnings);
}

function buildFaqBlock(records) {
  const warnings = [];
  const pairs = [];
  let current = null;

  for (const record of records) {
    const s = stripRichTags(record.trimmed).trim();
    if (s.startsWith("Q:")) {
      if (current) {
        pairs.push(current);
        if (!current.answer) warnings.push(`Unanswered question: "${current.question}"`);
      }
      current = { question: s.replace(/^Q:\s*/, "").trim(), answer: "" };
      continue;
    }
    if (s.startsWith("A:")) {
      const answer = s.replace(/^A:\s*/, "").trim();
      if (current) {
        current.answer = current.answer ? `${current.answer}\n${answer}` : answer;
        pairs.push(current);
        current = null;
      } else {
        pairs.push({ question: "", answer });
        warnings.push("Answer found without a preceding question.");
      }
      continue;
    }
    // Continuation line right after a question acts as its answer.
    if (current) {
      current.answer = current.answer ? `${current.answer}\n${s}` : s;
    }
  }
  if (current) {
    pairs.push(current);
    if (!current.answer) warnings.push(`Unanswered question: "${current.question}"`);
  }

  const complete = pairs.length > 0 && pairs.every((p) => p.question && p.answer);
  return makeBlock(BLOCK_TYPES.FAQ, records, { pairs }, complete ? "high" : "medium", warnings);
}

function buildTableBlock(records, contentRecords, source) {
  const warnings = [];
  const rowRecords = contentRecords.filter((r) => r.trimmed);
  const rawRows = rowRecords.map((r) =>
    stripRichTags(r.trimmed)
      .trim()
      .split(",")
      .map((cell) => cell.trim())
  );
  const cellCounts = new Set(rawRows.map((row) => row.length));
  const grid = rawRows.length ? normalizeTableGrid(rawRows) : [];

  let confidence = "high";
  if (source === "csv") {
    if (rawRows.length < 2 || cellCounts.size > 1) confidence = "medium";
    if (cellCounts.size > 1) warnings.push("Table rows have inconsistent column counts.");
  } else if (cellCounts.size > 1) {
    warnings.push("Table rows have inconsistent column counts.");
  }
  if (!rawRows.length) {
    confidence = "low";
    warnings.push("Table block has no rows.");
  }

  return makeBlock(
    BLOCK_TYPES.TABLE,
    records,
    {
      grid,
      rowCount: grid.length,
      columnCount: grid.length ? grid[0].length : 0,
      source
    },
    confidence,
    warnings
  );
}

function buildMixedBlock(records, reason) {
  const text = records.map((r) => r.trimmed).join("\n");
  return makeBlock(
    BLOCK_TYPES.MIXED,
    records,
    {
      text,
      cells: records.length === 1 ? records[0].trimmed.split(",").map((c) => c.trim()) : null
    },
    "low",
    [reason]
  );
}

function buildUnknownBlock(records, reason) {
  const raw = records.map((r) => r.trimmed).join("\n");
  return makeBlock(UNKNOWN_BLOCK_TYPE, records, { raw }, "none", [reason]);
}

/**
 * Parse a section body into ordered typed blocks.
 *
 * @param {string} content — raw section body text
 * @param {{ forceTable?: boolean }} [options] — forceTable follows the
 *   Generator "[Section: Title | table]" grammar (whole body is a table)
 * @returns {Array<object>} ordered blocks
 */
function parseBlocks(content, options = {}) {
  const src = String(content || "").replace(/\r\n/g, "\n");
  if (!src.trim()) return [];

  const records = src.split("\n").map((raw) => ({
    raw,
    trimmed: raw.trim(),
    kind: classifyLineKind(raw)
  }));

  const hasMarkers = records.some((r) => r.kind === "table_start");
  const blocks = [];

  if (options.forceTable && !hasMarkers) {
    const rows = records.filter((r) => r.kind !== "empty");
    if (rows.length) blocks.push(buildTableBlock(rows, rows, "forced"));
    return assignOrder(blocks);
  }

  const n = records.length;
  let i = 0;

  const consumeRun = (kinds) => {
    const group = [];
    while (i < n && kinds.includes(records[i].kind)) {
      group.push(records[i]);
      i += 1;
    }
    return group;
  };

  while (i < n) {
    const record = records[i];
    const kind = record.kind;

    if (kind === "empty") {
      i += 1;
      continue;
    }

    if (kind === "table_start") {
      const group = [record];
      i += 1;
      const inner = [];
      while (i < n && records[i].kind !== "table_end") {
        group.push(records[i]);
        inner.push(records[i]);
        i += 1;
      }
      let terminated = false;
      if (i < n) {
        group.push(records[i]);
        terminated = true;
        i += 1;
      }
      const block = buildTableBlock(group, inner, "markers");
      if (!terminated) block.warnings.push("Unterminated ---table--- block.");
      blocks.push(block);
      continue;
    }

    if (kind === "table_end") {
      blocks.push(buildUnknownBlock([record], "Stray ---endtable--- marker without opening marker."));
      i += 1;
      continue;
    }

    if (kind === "faq_q" || kind === "faq_a") {
      const group = [record];
      let last = kind;
      i += 1;
      while (i < n) {
        const k = records[i].kind;
        if (k === "faq_q" || k === "faq_a") {
          group.push(records[i]);
          last = k;
          i += 1;
          continue;
        }
        // A plain line directly after a question is its answer.
        if ((k === "paragraph" || k === "rich") && last === "faq_q") {
          group.push(records[i]);
          last = "faq_cont";
          i += 1;
          continue;
        }
        break;
      }
      blocks.push(buildFaqBlock(group));
      continue;
    }

    if (kind === "link" || kind === "multi_link") {
      blocks.push(buildLinkBlock(consumeRun(["link", "multi_link"])));
      continue;
    }

    if (kind === "list") {
      blocks.push(buildListBlock(consumeRun(["list"])));
      continue;
    }

    if (kind === "kv") {
      blocks.push(buildKeyValueBlock(consumeRun(["kv"])));
      continue;
    }

    if (kind === "table_row") {
      const group = consumeRun(["table_row"]);
      if (group.length >= 2) {
        blocks.push(buildTableBlock(group, group, "csv"));
      } else {
        blocks.push(
          buildMixedBlock(group, "Single comma-separated line: ambiguous between table row and sentence.")
        );
      }
      continue;
    }

    if (kind === "rich") {
      blocks.push(buildRichTextBlock(consumeRun(["rich"])));
      continue;
    }

    blocks.push(buildParagraphBlock(consumeRun(["paragraph"])));
  }

  return assignOrder(blocks);
}

function assignOrder(blocks) {
  return blocks.map((block, index) => ({ order: index, ...block }));
}

module.exports = {
  parseBlocks,
  classifyLineKind,
  stripRichTags,
  BLOCK_TYPES,
  UNKNOWN_BLOCK_TYPE
};
