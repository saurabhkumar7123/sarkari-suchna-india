"use strict";

/**
 * CIP Stage 1B — Shared Metadata Intelligence Engine.
 *
 * Pure reusable service for both:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Uses Stage 1A for detectedDocumentType. Does not modify Stage 1A.
 * Never invents metadata — returns null when unavailable.
 */

const {
  classifyDocument
} = require("../documentClassification");

const {
  extractAdvertisementNo
} = require("../../project/recruitmentIntelligence/recruitmentMatchingEngine");

const {
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES,
  CONFIDENCE_LEVELS,
  createEmptyMetadata,
  createEmptyConfidence,
  createEmptyImportantDates
} = require("./metadataFields");

const {
  NEXT_FIELD_BOUNDARY,
  FIELD_RULES,
  DATE_FIELD_RULES
} = require("./metadataRules");

const {
  collapseWhitespace,
  asStringOrNull,
  normalizeMetadata,
  normalizeDateValue,
  normalizeTotalPosts,
  detectDocumentLanguage,
  dedupeStringList,
  normalizeAdvertisementNo
} = require("./metadataNormalizers");

const ENGINE_ID = "CIP_METADATA_INTELLIGENCE_ENGINE";
const STAGE_ID = "CIP_1B";
const ENGINE_VERSION = "1.0.0";

/**
 * @typedef {Object} ExtractMetadataInput
 * @property {string} [title]
 * @property {string|string[]} [headings]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [filename]
 * @property {string} [url]
 * @property {string} [notificationUrl]
 * @property {string} [officialWebsite]
 * @property {string} [sourceType]
 * @property {string} [contentType]
 * @property {string} [pipeline]
 * @property {string} [source]
 * @property {Object} [metadata] Optional known field hints (not invented)
 * @property {Object} [classification] Optional Stage 1A result to reuse
 * @property {boolean} [skipClassification]
 */

/**
 * @typedef {Object} MatchedMetadataIndicator
 * @property {string} field
 * @property {string} [dateField]
 * @property {string} source
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} [matchedPattern]
 * @property {string} [rawValue]
 */

function headingsToString(headings) {
  if (!headings) return "";
  if (Array.isArray(headings)) {
    return headings.map((h) => collapseWhitespace(h)).filter(Boolean).join("\n");
  }
  return collapseWhitespace(headings);
}

function buildCorpus(input = {}) {
  const title = asStringOrNull(input.title) || "";
  const headings = headingsToString(input.headings);
  const body = asStringOrNull(input.text || input.content) || "";
  const filename = asStringOrNull(input.filename) || "";
  const url = asStringOrNull(input.url) || "";
  const hintMeta = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const combined = collapseWhitespace(
    [title, headings, body, filename, url].filter(Boolean).join("\n")
  );

  // Preserve newlines for label-near extraction; also provide flat text.
  const plain = [title, headings, body]
    .filter(Boolean)
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ");

  return { title, headings, body, filename, url, plain, combined, hintMeta };
}

function extractFieldNearLabel(plain, labels) {
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const re = new RegExp(
      `${label}\\s*[:\\-–]?\\s*([^\\n|;]{1,120}?)${NEXT_FIELD_BOUNDARY}`,
      "i"
    );
    const match = plain.match(re);
    if (match && match[1]) {
      return {
        value: collapseWhitespace(match[1]),
        matchedPattern: match[0].slice(0, 80)
      };
    }
  }
  return null;
}

function extractDateNearLabel(plain, labels) {
  const hit = extractFieldNearLabel(plain, labels);
  if (!hit) return null;
  const isoish = hit.value.match(
    /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})|([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/
  );
  return {
    value: isoish ? isoish[0] : hit.value,
    fullValue: hit.value,
    matchedPattern: hit.matchedPattern
  };
}

function extractUrlNearLabel(plain, labels) {
  const hit = extractFieldNearLabel(plain, labels);
  if (!hit) return null;
  const urlMatch = hit.value.match(
    /(https?:\/\/[^\s<>"']+)|((?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/i
  );
  if (urlMatch) {
    return { value: urlMatch[0].replace(/[),.;]+$/, ""), matchedPattern: hit.matchedPattern };
  }
  return hit;
}

function firstUrlInText(text) {
  const match = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;]+$/, "") : null;
}

function pushIndicator(indicators, entry) {
  indicators.push({
    field: entry.field,
    dateField: entry.dateField || undefined,
    source: entry.source,
    confidence: entry.confidence,
    matchedPattern: entry.matchedPattern || undefined,
    rawValue: entry.rawValue || undefined
  });
}

function setField(raw, confidence, indicators, field, value, meta) {
  if (value === undefined || value === null || value === "") return false;
  if (raw[field] != null && raw[field] !== "") {
    // Prefer first high-confidence; allow upgrade from lower.
    const existingRank = confRank(confidence[field]);
    const nextRank = confRank(meta.confidence);
    if (nextRank <= existingRank) {
      pushIndicator(indicators, {
        field,
        source: meta.source,
        confidence: meta.confidence,
        matchedPattern: meta.matchedPattern,
        rawValue: String(value)
      });
      return false;
    }
  }
  raw[field] = typeof value === "string" ? collapseWhitespace(value) : value;
  confidence[field] = meta.confidence;
  pushIndicator(indicators, {
    field,
    source: meta.source,
    confidence: meta.confidence,
    matchedPattern: meta.matchedPattern,
    rawValue: String(value)
  });
  return true;
}

function confRank(level) {
  return { high: 3, medium: 2, low: 1, none: 0 }[level] || 0;
}

function setDateField(rawDates, dateConfidence, indicators, dateField, value, meta) {
  if (value === undefined || value === null || value === "") return false;
  if (rawDates[dateField] != null && rawDates[dateField] !== "") {
    const existingRank = confRank(dateConfidence[dateField]);
    const nextRank = confRank(meta.confidence);
    if (nextRank <= existingRank) {
      pushIndicator(indicators, {
        field: "importantDates",
        dateField,
        source: meta.source,
        confidence: meta.confidence,
        matchedPattern: meta.matchedPattern,
        rawValue: String(value)
      });
      return false;
    }
  }
  rawDates[dateField] = collapseWhitespace(value);
  dateConfidence[dateField] = meta.confidence;
  pushIndicator(indicators, {
    field: "importantDates",
    dateField,
    source: meta.source,
    confidence: meta.confidence,
    matchedPattern: meta.matchedPattern,
    rawValue: String(value)
  });
  return true;
}

function applyHintMetadata(raw, confidence, indicators, hintMeta) {
  if (!hintMeta || typeof hintMeta !== "object") return;

  const scalarHints = [
    "title",
    "organization",
    "department",
    "recruitmentBoard",
    "advertisementNumber",
    "postName",
    "qualification",
    "ageLimit",
    "applicationMode",
    "category",
    "state",
    "officialWebsite",
    "notificationUrl",
    "documentLanguage",
    "sourceType",
    "detectedDocumentType"
  ];

  for (const field of scalarHints) {
    const value = hintMeta[field];
    if (value == null || value === "") continue;
    setField(raw, confidence, indicators, field, value, {
      source: "metadata",
      confidence: "high",
      matchedPattern: `hint:${field}`
    });
  }

  if (hintMeta.totalPosts != null && hintMeta.totalPosts !== "") {
    setField(raw, confidence, indicators, "totalPosts", hintMeta.totalPosts, {
      source: "metadata",
      confidence: "high",
      matchedPattern: "hint:totalPosts"
    });
  }

  const dates = hintMeta.importantDates;
  if (dates && typeof dates === "object") {
    for (const dateField of IMPORTANT_DATE_FIELDS) {
      if (dates[dateField] == null || dates[dateField] === "") continue;
      setDateField(raw.importantDates, confidence.importantDates, indicators, dateField, dates[dateField], {
        source: "metadata",
        confidence: "high",
        matchedPattern: `hint:importantDates.${dateField}`
      });
    }
  }

  // Flat date aliases on hint object
  const flatDateAliases = {
    notificationDate: "notificationDate",
    startDate: "startDate",
    lastDate: "lastDate",
    examDate: "examDate",
    resultDate: "resultDate",
    admitCardDate: "admitCardDate",
    answerKeyDate: "answerKeyDate"
  };
  for (const [alias, dateField] of Object.entries(flatDateAliases)) {
    if (hintMeta[alias] == null || hintMeta[alias] === "") continue;
    setDateField(raw.importantDates, confidence.importantDates, indicators, dateField, hintMeta[alias], {
      source: "metadata",
      confidence: "high",
      matchedPattern: `hint:${alias}`
    });
  }
}

function extractFromPlain(raw, confidence, indicators, plain, ambiguityHints) {
  if (!plain) return;

  for (const rule of FIELD_RULES) {
    let hit = null;
    if (rule.valueKind === "url") {
      hit = extractUrlNearLabel(plain, rule.labels);
    } else {
      hit = extractFieldNearLabel(plain, rule.labels);
    }
    if (!hit) continue;

    let value = hit.value;
    if (rule.valueKind === "number") {
      value = normalizeTotalPosts(value);
      if (value == null) continue;
    }

    setField(raw, confidence, indicators, rule.field, value, {
      source: "text",
      confidence: rule.confidence,
      matchedPattern: hit.matchedPattern
    });
  }

  for (const dateField of IMPORTANT_DATE_FIELDS) {
    const rule = DATE_FIELD_RULES[dateField];
    if (!rule) continue;
    const hit = extractDateNearLabel(plain, rule.labels);
    if (!hit) continue;
    if (dateField === "lastDate" && hit.fullValue) {
      ambiguityHints.lastDateFull = hit.fullValue;
    }
    setDateField(raw.importantDates, confidence.importantDates, indicators, dateField, hit.value, {
      source: "text",
      confidence: rule.confidence,
      matchedPattern: hit.matchedPattern
    });
  }
}

function extractAdvertisementFallback(raw, confidence, indicators, corpus) {
  if (raw.advertisementNumber) return;
  const blob = [corpus.title, corpus.plain].filter(Boolean).join("\n");
  const adv = extractAdvertisementNo(blob);
  if (!adv) return;
  setField(raw, confidence, indicators, "advertisementNumber", adv, {
    source: "text",
    confidence: "medium",
    matchedPattern: "advertisementNumberPattern"
  });
}

function extractTitleFallback(raw, confidence, indicators, corpus) {
  if (raw.title) return;
  if (corpus.title) {
    setField(raw, confidence, indicators, "title", corpus.title, {
      source: "title",
      confidence: "high",
      matchedPattern: "input.title"
    });
    return;
  }
  const firstLine = corpus.plain
    .split("\n")
    .map((l) => collapseWhitespace(l))
    .find((l) => l.length >= 8 && l.length <= 160);
  if (firstLine) {
    setField(raw, confidence, indicators, "title", firstLine, {
      source: "text",
      confidence: "low",
      matchedPattern: "firstLine"
    });
  }
}

function extractUrlFallbacks(raw, confidence, indicators, input, corpus) {
  if (!raw.notificationUrl) {
    const url = asStringOrNull(input.notificationUrl) || asStringOrNull(input.url);
    if (url) {
      setField(raw, confidence, indicators, "notificationUrl", url, {
        source: input.notificationUrl ? "metadata" : "url",
        confidence: "high",
        matchedPattern: "input.url"
      });
    }
  }

  if (!raw.officialWebsite) {
    const site = asStringOrNull(input.officialWebsite);
    if (site) {
      setField(raw, confidence, indicators, "officialWebsite", site, {
        source: "metadata",
        confidence: "high",
        matchedPattern: "input.officialWebsite"
      });
    } else {
      const found = firstUrlInText(corpus.plain);
      if (found && found !== raw.notificationUrl) {
        setField(raw, confidence, indicators, "officialWebsite", found, {
          source: "text",
          confidence: "low",
          matchedPattern: "urlInText"
        });
      }
    }
  }
}

function resolveClassification(input, corpus) {
  if (input.classification && typeof input.classification === "object") {
    return {
      documentType: input.classification.documentType || null,
      confidence: input.classification.confidence || "none",
      reused: true
    };
  }
  if (input.skipClassification) {
    const hinted =
      (input.metadata && input.metadata.detectedDocumentType) ||
      (input.metadata && input.metadata.documentType) ||
      null;
    return { documentType: hinted, confidence: hinted ? "medium" : "none", reused: false };
  }
  const result = classifyDocument({
    title: corpus.title || input.title,
    headings: input.headings,
    text: corpus.body || corpus.plain,
    filename: input.filename,
    url: input.url,
    metadata: input.metadata
  });
  return {
    documentType: result.documentType,
    confidence: result.confidence,
    reused: false,
    classification: result
  };
}

function detectAmbiguityWarnings(raw, plain, ambiguityHints = {}) {
  const warnings = [];
  if (raw.advertisementNumber && /[,;/|].*\d/.test(String(raw.advertisementNumber))) {
    warnings.push("Ambiguous advertisementNumber: multiple number-like tokens detected.");
  }
  const lastDateProbe =
    ambiguityHints.lastDateFull || raw.importantDates.lastDate || "";
  if (/(?:\bor\b|\/|\bto\b)\s+/i.test(String(lastDateProbe))) {
    warnings.push("Ambiguous lastDate: range or alternative dates detected.");
  } else if (
    /Last\s*Date\s*[:\-–]?\s*[^\n]*(?:\bor\b|\bto\b)\s+/i.test(plain)
  ) {
    warnings.push("Ambiguous lastDate: range or alternative dates detected.");
  }
  if (
    raw.totalPosts == null &&
    raw.qualification &&
    /\d+\s*(?:post|vacanc)/i.test(String(raw.qualification))
  ) {
    warnings.push("Possible vacancy count embedded in qualification; totalPosts left null.");
  }
  const lastDateHits = (plain.match(/Last\s*Date/gi) || []).length;
  if (lastDateHits > 1 && raw.importantDates.lastDate) {
    warnings.push("Multiple Last Date labels found; first high-confidence match kept.");
  }
  return warnings;
}

function buildWarnings(raw, corpus, classification, ambiguityHints) {
  const warnings = [];

  if (!corpus.combined) {
    warnings.push("Empty input: no title, headings, text, filename, or URL provided.");
  }

  const missingCore = [];
  if (!raw.title) missingCore.push("title");
  if (!raw.organization && !raw.recruitmentBoard) missingCore.push("organization");
  if (!raw.advertisementNumber) missingCore.push("advertisementNumber");
  if (missingCore.length) {
    warnings.push(`Missing core metadata: ${missingCore.join(", ")}.`);
  }

  if (classification && (classification.confidence === "low" || classification.confidence === "medium")) {
    warnings.push(
      `Detected document type confidence is ${classification.confidence}; review recommended.`
    );
  }

  warnings.push(...detectAmbiguityWarnings(raw, corpus.plain, ambiguityHints));
  return dedupeStringList(warnings);
}

/**
 * Extract and normalize document metadata.
 * Safe for both manual PDF and automatic website pipelines.
 *
 * @param {ExtractMetadataInput} input
 */
function extractMetadata(input = {}) {
  const corpus = buildCorpus(input);
  const raw = createEmptyMetadata();
  const confidence = createEmptyConfidence();
  /** @type {MatchedMetadataIndicator[]} */
  const indicators = [];

  const ambiguityHints = Object.create(null);
  applyHintMetadata(raw, confidence, indicators, corpus.hintMeta);
  extractFromPlain(raw, confidence, indicators, corpus.plain, ambiguityHints);
  extractAdvertisementFallback(raw, confidence, indicators, corpus);
  extractTitleFallback(raw, confidence, indicators, corpus);
  extractUrlFallbacks(raw, confidence, indicators, input, corpus);

  const classification = resolveClassification(input, corpus);
  if (classification.documentType) {
    setField(raw, confidence, indicators, "detectedDocumentType", classification.documentType, {
      source: classification.reused ? "classification" : "stage1a",
      confidence:
        classification.confidence === "none"
          ? "low"
          : classification.confidence || "medium",
      matchedPattern: "CIP_1A"
    });
  }

  if (!raw.documentLanguage) {
    const lang = detectDocumentLanguage(corpus.combined || corpus.plain);
    setField(raw, confidence, indicators, "documentLanguage", lang, {
      source: "text",
      confidence: lang === "unknown" ? "none" : "medium",
      matchedPattern: "scriptDetect"
    });
  }

  if (!raw.sourceType) {
    raw.sourceType = null;
  }

  const context = {
    text: corpus.combined,
    sourceType: input.sourceType,
    contentType: input.contentType,
    filename: input.filename,
    url: input.url,
    pipeline: input.pipeline,
    source: input.source
  };

  // Ensure sourceType hint flows into raw before normalize
  if (!raw.sourceType && (input.sourceType || input.contentType || input.filename || input.pipeline)) {
    raw.sourceType = input.sourceType || null;
  }

  const normalizedMetadata = normalizeMetadata(raw, context);

  // Align confidence for sourceType / language after normalization
  if (normalizedMetadata.sourceType) {
    if (confidence.sourceType === "none") confidence.sourceType = "medium";
  }
  if (normalizedMetadata.documentLanguage && confidence.documentLanguage === "none") {
    confidence.documentLanguage = "medium";
  }

  // Drop undefined keys from indicators for stable JSON
  const matchedIndicators = indicators.map((item) => {
    const out = {
      field: item.field,
      source: item.source,
      confidence: item.confidence
    };
    if (item.dateField) out.dateField = item.dateField;
    if (item.matchedPattern) out.matchedPattern = item.matchedPattern;
    if (item.rawValue != null) out.rawValue = item.rawValue;
    return out;
  });

  const warnings = buildWarnings(raw, corpus, classification, ambiguityHints);

  return {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    metadata: raw,
    normalizedMetadata,
    confidence,
    matchedIndicators,
    warnings,
    // Extensibility hooks for future CIP stages
    extensions: {
      classification: classification.classification || null,
      classificationReused: Boolean(classification.reused),
      corpusLength: corpus.combined.length
    }
  };
}

/**
 * Convenience: extract from plain text only.
 * @param {string} text
 * @param {ExtractMetadataInput} [extra]
 */
function extractMetadataFromText(text, extra = {}) {
  return extractMetadata({ ...extra, text });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  extractMetadata,
  extractMetadataFromText,
  buildCorpus,
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES,
  CONFIDENCE_LEVELS,
  createEmptyMetadata,
  createEmptyConfidence,
  createEmptyImportantDates,
  normalizeDateValue,
  normalizeAdvertisementNo
};
