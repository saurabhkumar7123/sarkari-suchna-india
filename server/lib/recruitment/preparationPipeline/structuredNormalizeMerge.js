"use strict";

/**
 * Structured normalize + field-level merge for Generator publisher documents.
 *
 * Raw PDF/extracted text is NEVER treated as publish content.
 * Existing published page is the merge base. Blind whole-page replace is forbidden.
 * REMOVE is never automatic — only when explicitly opted in (human-approved).
 *
 * Shared by AI (productionRuntime.persistDraft) and Manual
 * (createManualRecruitmentUpdate) paths via mergePublisherSectionText.
 */

const {
  applyCanonicalPublisherFormat,
  canonicalSectionTitle,
  normalizeKeyValueLine,
  normalizeLinksBody,
  normalizeFaqBody,
  normalizePublisherSection
} = require("../../../utils/canonicalPublisherFormat");
const {
  parseLinkLine,
  formatLinksForPublisher
} = require("../../generatorIntelligence/linkClassification");
const { isDownstreamEvent } = require("../lifecycleSafety");
const { assessExtractionConfidence, ADVISORY_STATUS } = require("./extractionQualityGate");

const FIELD_ACTIONS = Object.freeze({
  ADD: "ADD",
  UPDATE: "UPDATE",
  KEEP: "KEEP",
  REMOVE: "REMOVE",
  NO_CHANGE: "NO_CHANGE"
});

/** Sections allowed on event-specific UPDATE packages (unrelated sections stripped). */
const EVENT_UPDATE_ALLOWLIST = Object.freeze({
  admit_card: Object.freeze([
    "short_information",
    "admit_card",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  city_intimation: Object.freeze([
    "short_information",
    "admit_card",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  exam_date: Object.freeze([
    "short_information",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  answer_key: Object.freeze([
    "short_information",
    "answer_key",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  objection: Object.freeze([
    "short_information",
    "answer_key",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  result: Object.freeze([
    "short_information",
    "result",
    "important_dates",
    "important_links",
    "important_instructions"
  ]),
  final_result: Object.freeze([
    "short_information",
    "result",
    "important_dates",
    "important_links",
    "important_instructions"
  ])
});

/** Preferred Generator titles when adding a section that did not exist. */
const IDENTITY_DISPLAY_TITLE = Object.freeze({
  short_information: "Short Information",
  important_dates: "Important Dates",
  application_fee: "Application Fee",
  age_limit: "Age Limit",
  vacancy: "Vacancy Details",
  eligibility: "Eligibility",
  physical_standard: "Physical Standard / PET",
  selection_process: "Selection Process",
  important_links: "Important Links",
  faq: "Important Questions",
  admit_card: "Admit Card Details",
  answer_key: "Answer Key Details",
  result: "Result Details",
  important_instructions: "Important Instructions",
  how_to_apply: "How To Apply",
  salary: "Salary",
  helpline: "Helpline",
  exam_pattern: "Exam Pattern",
  syllabus: "Syllabus"
});

const FIELD_MERGE_KINDS = new Set(["dates", "links", "fee", "age", "faq"]);

function normalizeEventType(eventType) {
  return String(eventType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function sectionIdentityKey(title) {
  const raw = canonicalSectionTitle(String(title || ""))
    .replace(/\|\s*table\s*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!raw) return "unknown";
  if (raw === "short information" || raw === "short info") return "short_information";
  if (raw === "important dates" || raw === "important date") return "important_dates";
  if (raw === "application fee" || raw === "application fees") return "application_fee";
  if (raw === "age limit" || raw === "age limits") return "age_limit";
  if (raw === "vacancy" || raw === "vacancy details") return "vacancy";
  if (raw === "eligibility" || raw === "eligibility criteria") return "eligibility";
  if (/physical standard|^\s*pet\s*$|pst|pmt|physical efficiency/i.test(raw)) {
    return "physical_standard";
  }
  if (raw === "selection process") return "selection_process";
  if (raw === "important links" || raw === "important link") return "important_links";
  if (raw === "important questions" || raw === "faq") return "faq";
  if (raw === "admit card" || raw === "admit card details") return "admit_card";
  if (raw === "answer key" || raw === "answer key details") return "answer_key";
  if (raw === "result" || raw === "result details" || raw === "final result") return "result";
  if (raw === "important instructions" || raw === "general instructions") {
    return "important_instructions";
  }
  if (raw === "how to apply") return "how_to_apply";
  if (raw === "salary" || raw === "pay scale") return "salary";
  if (raw === "helpline" || raw === "help line" || raw === "help desk") return "helpline";
  if (raw === "exam pattern") return "exam_pattern";
  if (raw === "syllabus") return "syllabus";
  return raw.replace(/\s+/g, "_");
}

function sectionKindFromIdentity(identity) {
  if (identity === "important_dates") return "dates";
  if (identity === "important_links") return "links";
  if (identity === "application_fee") return "fee";
  if (identity === "age_limit") return "age";
  if (identity === "faq") return "faq";
  if (identity === "vacancy") return "vacancy";
  if (identity === "short_information") return "short";
  return "other";
}

function preferDisplayTitle(identity, existingTitle, updateTitle) {
  if (existingTitle && String(existingTitle).trim()) {
    return String(existingTitle).trim();
  }
  if (IDENTITY_DISPLAY_TITLE[identity]) return IDENTITY_DISPLAY_TITLE[identity];
  if (updateTitle) return canonicalSectionTitle(updateTitle);
  return IDENTITY_DISPLAY_TITLE[identity] || "Short Information";
}

function labelKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePublisherDocument(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  const SECTION_RE = /\[Section:\s*([^\]]+)\]/gi;
  const indices = [];
  let match;
  const re = new RegExp(SECTION_RE.source, "gi");
  while ((match = re.exec(raw)) !== null) {
    indices.push({
      title: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length
    });
  }
  const order = [];
  const map = new Map();
  for (let i = 0; i < indices.length; i += 1) {
    const bodyStart = indices[i].end;
    const bodyEnd = i + 1 < indices.length ? indices[i + 1].start : raw.length;
    const title = indices[i].title;
    const body = raw.slice(bodyStart, bodyEnd).trim();
    const identity = sectionIdentityKey(title);
    if (!map.has(identity)) order.push(identity);
    const normalized = normalizePublisherSection(title, body);
    // Keep the page's original section title spelling (e.g. Vacancy Details vs Vacancy).
    const displayTitle = preferDisplayTitle(identity, title, normalized.title);
    map.set(identity, {
      identity,
      title: displayTitle,
      body: normalized.body,
      kind: sectionKindFromIdentity(identity)
    });
  }
  return { order, map, hasSections: order.length > 0 };
}

function serializePublisherDocument(order, map) {
  return order
    .map((identity) => {
      const row = map.get(identity);
      if (!row || !String(row.body || "").trim()) return null;
      return `[Section: ${row.title}]\n${String(row.body).trim()}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function parseKvRows(body) {
  const rows = [];
  for (const line of String(body || "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const normalized = normalizeKeyValueLine(t);
    const m =
      normalized.match(/^([^:=\n]{1,120}?)\s*:\s+(.+)$/) ||
      normalized.match(/^([^:=\n]{1,120}?)\s*:\s*(.+)$/);
    if (m && m[1].trim() && m[2].trim()) {
      rows.push({
        label: m[1].trim(),
        value: m[2].trim(),
        key: labelKey(m[1]),
        raw: `${m[1].trim()} : ${m[2].trim()}`
      });
    } else {
      rows.push({
        label: null,
        value: normalized,
        key: `anon:${labelKey(normalized)}`,
        raw: normalized
      });
    }
  }
  return rows;
}

function formatKvRows(rows) {
  return rows.map((r) => r.raw).join("\n");
}

function parseLinkRows(body) {
  const rows = [];
  for (const line of String(body || "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parsed = parseLinkLine(t);
    if (parsed && parsed.url) {
      rows.push({
        label: parsed.label,
        url: parsed.url,
        key: labelKey(parsed.label),
        raw: `${parsed.label}=${parsed.url}`
      });
    } else {
      rows.push({
        label: null,
        url: null,
        key: `anon:${labelKey(t)}`,
        raw: t
      });
    }
  }
  return rows;
}

function formatLinkRows(rows) {
  const structured = rows.filter((r) => r.url);
  const leftover = rows.filter((r) => !r.url).map((r) => r.raw);
  return [formatLinksForPublisher(structured), leftover.join("\n")].filter(Boolean).join("\n");
}

function parseFaqRows(body) {
  const normalized = normalizeFaqBody(body);
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let pendingQ = null;
  for (const line of lines) {
    if (/^Q:\s*/i.test(line)) {
      if (pendingQ) {
        rows.push({
          q: pendingQ,
          a: "",
          key: labelKey(pendingQ),
          raw: `Q: ${pendingQ}`
        });
      }
      pendingQ = line.replace(/^Q:\s*/i, "").trim();
    } else if (/^A:\s*/i.test(line)) {
      const a = line.replace(/^A:\s*/i, "").trim();
      if (pendingQ) {
        rows.push({
          q: pendingQ,
          a,
          key: labelKey(pendingQ),
          raw: `Q: ${pendingQ}\nA: ${a}`
        });
        pendingQ = null;
      } else {
        rows.push({ q: null, a, key: `a:${labelKey(a)}`, raw: `A: ${a}` });
      }
    } else if (pendingQ) {
      pendingQ = `${pendingQ} ${line}`.trim();
    } else {
      rows.push({ q: line, a: "", key: labelKey(line), raw: line });
    }
  }
  if (pendingQ) {
    rows.push({
      q: pendingQ,
      a: "",
      key: labelKey(pendingQ),
      raw: `Q: ${pendingQ}`
    });
  }
  return rows;
}

function formatFaqRows(rows) {
  return rows.map((r) => r.raw).join("\n");
}

/**
 * Field-level merge for keyed rows. Never deletes existing rows when missing from update.
 */
function mergeKeyedRows(existingRows, updateRows, options = {}) {
  const changes = [];
  const byKey = new Map();
  const order = [];

  for (const row of existingRows) {
    if (!byKey.has(row.key)) order.push(row.key);
    byKey.set(row.key, { ...row });
    changes.push({
      action: FIELD_ACTIONS.KEEP,
      key: row.key,
      label: row.label || row.q || null,
      value: row.value != null ? row.value : row.url || row.a || row.raw
    });
  }

  const keepIndex = new Map(changes.map((c, i) => [c.key, i]));

  for (const row of updateRows) {
    const prev = byKey.get(row.key);
    if (!prev) {
      order.push(row.key);
      byKey.set(row.key, { ...row });
      changes.push({
        action: FIELD_ACTIONS.ADD,
        key: row.key,
        label: row.label || row.q || null,
        value: row.value != null ? row.value : row.url || row.a || row.raw
      });
      continue;
    }
    const prevVal = String(
      prev.value != null ? prev.value : prev.url || prev.a || prev.raw || ""
    ).trim();
    const nextVal = String(
      row.value != null ? row.value : row.url || row.a || row.raw || ""
    ).trim();
    if (prevVal === nextVal) {
      const idx = keepIndex.get(row.key);
      if (idx != null) changes[idx].action = FIELD_ACTIONS.NO_CHANGE;
      continue;
    }
    // Prefer update label spelling when present
    const merged = {
      ...prev,
      ...row,
      label: row.label || prev.label,
      q: row.q || prev.q
    };
    if (options.kind === "links") {
      merged.raw = `${merged.label}=${merged.url}`;
    } else if (options.kind === "faq") {
      merged.raw =
        merged.q && merged.a
          ? `Q: ${merged.q}\nA: ${merged.a}`
          : merged.q
            ? `Q: ${merged.q}`
            : merged.raw;
    } else if (merged.label) {
      merged.raw = `${merged.label} : ${merged.value}`;
    }
    byKey.set(row.key, merged);
    const idx = keepIndex.get(row.key);
    if (idx != null) {
      changes[idx] = {
        action: FIELD_ACTIONS.UPDATE,
        key: row.key,
        label: merged.label || merged.q || null,
        value: nextVal,
        previousValue: prevVal
      };
    } else {
      changes.push({
        action: FIELD_ACTIONS.UPDATE,
        key: row.key,
        label: merged.label || merged.q || null,
        value: nextVal,
        previousValue: prevVal
      });
    }
  }

  // Explicit REMOVE only when opted in — never because update omitted a field.
  if (options.allowRemove === true && Array.isArray(options.removeKeys)) {
    for (const key of options.removeKeys) {
      if (!byKey.has(key)) continue;
      byKey.delete(key);
      const oi = order.indexOf(key);
      if (oi >= 0) order.splice(oi, 1);
      changes.push({ action: FIELD_ACTIONS.REMOVE, key });
    }
  }

  const rows = order.map((k) => byKey.get(k)).filter(Boolean);
  return { rows, changes };
}

function mergeFieldSection(existingBody, updateBody, kind, options = {}) {
  if (kind === "dates" || kind === "fee" || kind === "age") {
    const merged = mergeKeyedRows(parseKvRows(existingBody), parseKvRows(updateBody), {
      kind,
      allowRemove: options.allowRemove
    });
    return { body: formatKvRows(merged.rows), fieldChanges: merged.changes };
  }
  if (kind === "links") {
    const merged = mergeKeyedRows(parseLinkRows(existingBody), parseLinkRows(updateBody), {
      kind: "links",
      allowRemove: options.allowRemove
    });
    return { body: formatLinkRows(merged.rows), fieldChanges: merged.changes };
  }
  if (kind === "faq") {
    const merged = mergeKeyedRows(parseFaqRows(existingBody), parseFaqRows(updateBody), {
      kind: "faq",
      allowRemove: options.allowRemove
    });
    return { body: formatFaqRows(merged.rows), fieldChanges: merged.changes };
  }
  return { body: String(updateBody || existingBody || "").trim(), fieldChanges: [] };
}

function eventAllowlist(eventType) {
  const type = normalizeEventType(eventType);
  if (!type) return null;
  if (EVENT_UPDATE_ALLOWLIST[type]) return EVENT_UPDATE_ALLOWLIST[type];
  // Announcement / unknown → no strip (full package)
  if (!isDownstreamEvent(type)) return null;
  return EVENT_UPDATE_ALLOWLIST.admit_card
    ? Object.freeze(["short_information", "important_dates", "important_links", "important_instructions"])
    : null;
}

/**
 * Normalize publisher text into fixed Generator section format.
 * Optionally filter to event-relevant sections (UPDATE packages only).
 */
function normalizePublisherDocument(text, options = {}) {
  const input = String(text || "").trim();
  if (!input) {
    return {
      text: "",
      sectionCount: 0,
      identities: [],
      filteredOut: [],
      publishContent: false
    };
  }

  // Raw PDF without section markers is not publish content.
  const looksStructured = /\[Section:\s*[^\]]+\]/i.test(input);
  let working = input;
  if (!looksStructured) {
    return {
      text: "",
      sectionCount: 0,
      identities: [],
      filteredOut: [],
      publishContent: false,
      reason: "raw_text_not_structured",
      rawPreserved: true
    };
  }

  working = applyCanonicalPublisherFormat(working);
  const parsed = parsePublisherDocument(working);
  const allow = options.filterByEvent === true ? eventAllowlist(options.eventType) : null;
  const filteredOut = [];
  const order = [];
  const map = new Map();

  for (const identity of parsed.order) {
    const row = parsed.map.get(identity);
    if (!row || !String(row.body || "").trim()) continue;
    if (allow && !allow.includes(identity)) {
      filteredOut.push(identity);
      continue;
    }
    const title = preferDisplayTitle(identity, null, row.title);
    const normalized = normalizePublisherSection(title, row.body);
    order.push(identity);
    map.set(identity, {
      identity,
      title: IDENTITY_DISPLAY_TITLE[identity] || normalized.title,
      body: normalized.body,
      kind: sectionKindFromIdentity(identity)
    });
  }

  // Prefer existing-facing titles for vacancy/faq aliases already handled via IDENTITY_DISPLAY_TITLE
  const textOut = serializePublisherDocument(order, map);
  return {
    text: textOut,
    sectionCount: order.length,
    identities: order.slice(),
    filteredOut,
    publishContent: order.length > 0,
    eventType: normalizeEventType(options.eventType) || null
  };
}

/**
 * Merge existing published publisher text with a normalized update package.
 * @returns {{ text: string, classifications: object[], usedStructuredMerge: boolean, publishReadyHint: boolean }}
 */
function mergeStructuredPublisherDocuments(existingText, updateText, options = {}) {
  const classifications = [];
  const allowRemove = options.allowRemove === true;
  const eventType = normalizeEventType(options.eventType);
  const downstream = eventType ? isDownstreamEvent(eventType) : false;

  const existingParsed = parsePublisherDocument(String(existingText || ""));
  const updateNorm = normalizePublisherDocument(updateText, {
    eventType,
    filterByEvent: downstream
  });

  if (!updateNorm.publishContent) {
    // No structured update — keep existing untouched.
    const text = String(existingText || "").trim() || String(updateText || "").trim();
    return {
      text,
      classifications: [
        {
          scope: "document",
          action: existingText ? FIELD_ACTIONS.KEEP : FIELD_ACTIONS.NO_CHANGE,
          reason: updateNorm.reason || "empty_update"
        }
      ],
      usedStructuredMerge: true,
      publishReadyHint: false
    };
  }

  const updateParsed = parsePublisherDocument(updateNorm.text);
  if (!existingParsed.hasSections) {
    return {
      text: updateNorm.text,
      classifications: updateParsed.order.map((identity) => ({
        scope: "section",
        identity,
        title: updateParsed.map.get(identity).title,
        action: FIELD_ACTIONS.ADD
      })),
      usedStructuredMerge: true,
      publishReadyHint: true
    };
  }

  const order = existingParsed.order.slice();
  const map = new Map();
  for (const identity of existingParsed.order) {
    map.set(identity, { ...existingParsed.map.get(identity) });
  }

  for (const identity of updateParsed.order) {
    const upd = updateParsed.map.get(identity);
    if (!upd || !String(upd.body || "").trim()) continue;
    const prev = map.get(identity);

    if (!prev) {
      const title = preferDisplayTitle(identity, null, upd.title);
      map.set(identity, {
        identity,
        title,
        body: upd.body,
        kind: upd.kind
      });
      order.push(identity);
      classifications.push({
        scope: "section",
        identity,
        title,
        action: FIELD_ACTIONS.ADD
      });
      continue;
    }

    // Downstream: never overwrite rich Short Information with a sparse admit/result stub.
    if (identity === "short_information" && downstream && String(prev.body || "").trim()) {
      classifications.push({
        scope: "section",
        identity,
        title: prev.title,
        action: FIELD_ACTIONS.KEEP,
        reason: "preserve_existing_short_information_on_event_update"
      });
      continue;
    }

    const kind = prev.kind || upd.kind;
    if (FIELD_MERGE_KINDS.has(kind)) {
      const fieldMerged = mergeFieldSection(prev.body, upd.body, kind, { allowRemove });
      const bodyChanged = String(fieldMerged.body).trim() !== String(prev.body).trim();
      const title = preferDisplayTitle(identity, prev.title, upd.title);
      map.set(identity, {
        identity,
        title,
        body: fieldMerged.body,
        kind
      });
      classifications.push({
        scope: "section",
        identity,
        title,
        action: bodyChanged ? FIELD_ACTIONS.UPDATE : FIELD_ACTIONS.NO_CHANGE,
        fields: fieldMerged.fieldChanges
      });
      continue;
    }

    // Whole-body sections: UPDATE only when update has content (already filtered by event).
    if (String(upd.body).trim() === String(prev.body).trim()) {
      classifications.push({
        scope: "section",
        identity,
        title: prev.title,
        action: FIELD_ACTIONS.NO_CHANGE
      });
      continue;
    }
    const title = preferDisplayTitle(identity, prev.title, upd.title);
    map.set(identity, {
      identity,
      title,
      body: upd.body,
      kind
    });
    classifications.push({
      scope: "section",
      identity,
      title,
      action: FIELD_ACTIONS.UPDATE
    });
  }

  // Existing sections absent from update → KEEP (never auto-REMOVE).
  for (const identity of existingParsed.order) {
    if (updateParsed.map.has(identity)) continue;
    const prev = map.get(identity);
    classifications.push({
      scope: "section",
      identity,
      title: prev ? prev.title : identity,
      action: FIELD_ACTIONS.KEEP,
      reason: "missing_from_update_source"
    });
  }

  if (updateNorm.filteredOut && updateNorm.filteredOut.length) {
    for (const identity of updateNorm.filteredOut) {
      classifications.push({
        scope: "section",
        identity,
        action: FIELD_ACTIONS.KEEP,
        reason: "event_filter_ignored_unrelated_update_section"
      });
    }
  }

  return {
    text: serializePublisherDocument(order, map),
    classifications,
    usedStructuredMerge: true,
    publishReadyHint: true,
    filteredOut: updateNorm.filteredOut || []
  };
}

/**
 * Assess whether extraction/raw text is safe to treat as publish-prep input.
 * Does not publish. Raw text alone is never publish content.
 */
function assessPublishPrepReadiness({
  extractedText = null,
  publisherText = null,
  extractionQuality = null,
  conversionAccepted = null
} = {}) {
  const extraction =
    extractionQuality ||
    assessExtractionConfidence({
      text: extractedText || ""
    });
  const structured = normalizePublisherDocument(publisherText || "", { filterByEvent: false });
  const blocked =
    extraction.status === ADVISORY_STATUS.BLOCKED ||
    extraction.lowConfidence === true ||
    conversionAccepted === false ||
    !structured.publishContent;

  return Object.freeze({
    publishReady: !blocked && structured.publishContent && conversionAccepted !== false,
    extractionStatus: extraction.status,
    extractionCode: extraction.code || null,
    lowConfidence: Boolean(extraction.lowConfidence),
    structuredSectionCount: structured.sectionCount,
    rawIsNotPublishContent: true,
    reasons: Object.freeze(
      [
        blocked && extraction.status === ADVISORY_STATUS.BLOCKED
          ? "extraction_blocked"
          : null,
        extraction.lowConfidence ? "extraction_low_confidence" : null,
        conversionAccepted === false ? "conversion_not_accepted" : null,
        !structured.publishContent ? "publisher_text_not_structured" : null
      ].filter(Boolean)
    )
  });
}

/**
 * Build raw-source preservation envelope (never used as page body).
 */
function buildRawSourceEnvelope({
  url = null,
  documentHash = null,
  extractedText = null,
  maxChars = 200000
} = {}) {
  const full = extractedText != null ? String(extractedText) : "";
  const truncated = full.length > maxChars;
  return Object.freeze({
    url: url || null,
    documentHash: documentHash || null,
    extractedText: truncated ? full.slice(0, maxChars) : full || null,
    truncated,
    originalLength: full.length,
    notPublishContent: true
  });
}

module.exports = {
  FIELD_ACTIONS,
  EVENT_UPDATE_ALLOWLIST,
  IDENTITY_DISPLAY_TITLE,
  sectionIdentityKey,
  normalizeEventType,
  normalizePublisherDocument,
  mergeStructuredPublisherDocuments,
  mergeFieldSection,
  parsePublisherDocument,
  assessPublishPrepReadiness,
  buildRawSourceEnvelope,
  eventAllowlist
};
