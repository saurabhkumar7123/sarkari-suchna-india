"use strict";

/**
 * CIP Stage 2B — AI Response Normalizer.
 * Converts any provider-shaped (or partial) AI draft response into one
 * shared internal format. Unknown fields never break parsing.
 * No network / provider SDKs.
 */

const { NORMALIZED_RESPONSE_FORMAT_ID, CONTRACT_VERSION } = require("./generationTypes");

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeWhitespace(text) {
  if (text == null) return "";
  return String(text).replace(/[ \t\f\v]+/g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function preserveLanguage(value) {
  if (value == null || value === "") return null;
  return String(value);
}

/**
 * Coerce confidence to number|null. Accepts 0–1 or 0–100.
 * @param {*} value
 * @returns {number|null}
 */
function normalizeConfidence(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null) {
    if (value.overall != null) return normalizeConfidence(value.overall);
    if (value.score != null) return normalizeConfidence(value.score);
    if (value.value != null) return normalizeConfidence(value.value);
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Normalize a list of warning / note strings.
 * @param {*} items
 * @returns {string[]}
 */
function normalizeStringList(items) {
  if (items == null) return [];
  if (typeof items === "string") {
    const t = normalizeWhitespace(items).trim();
    return t ? [t] : [];
  }
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = Object.create(null);
  for (const item of items) {
    let text = null;
    if (typeof item === "string") text = item;
    else if (item && typeof item === "object") {
      text = item.message || item.text || item.warning || item.note || item.code || null;
    }
    if (text == null) continue;
    const cleaned = normalizeWhitespace(String(text)).trim();
    if (!cleaned || seen[cleaned]) continue;
    seen[cleaned] = true;
    out.push(cleaned);
  }
  return out;
}

/**
 * Unwrap common accidental provider envelopes without depending on any SDK.
 * @param {*} raw
 */
function unwrapRawResponse(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      return unwrapRawResponse(JSON.parse(trimmed));
    } catch {
      return { notes: [trimmed] };
    }
  }
  if (typeof raw !== "object") return {};

  // Common accidental nests — ignore unknown provider keys later
  if (raw.draft && typeof raw.draft === "object") return unwrapRawResponse(raw.draft);
  if (raw.result && typeof raw.result === "object" && (raw.result.sections || raw.result.document)) {
    return unwrapRawResponse(raw.result);
  }
  if (raw.data && typeof raw.data === "object" && (raw.data.sections || raw.data.document)) {
    return unwrapRawResponse(raw.data);
  }
  if (raw.output && typeof raw.output === "object" && (raw.output.sections || raw.output.document)) {
    return unwrapRawResponse(raw.output);
  }
  return raw;
}

/**
 * Collect unknown top-level keys for transparency (does not break parsing).
 * @param {object} source
 * @param {string[]} known
 */
function collectUnknownFields(source, known) {
  if (!source || typeof source !== "object") return [];
  const knownSet = Object.create(null);
  for (const k of known) knownSet[k] = true;
  return Object.keys(source)
    .filter((k) => !knownSet[k])
    .sort();
}

function normalizeBlock(block, index) {
  const src = block && typeof block === "object" ? block : {};
  const original =
    src.originalContent != null
      ? src.originalContent
      : src.content != null
        ? src.content
        : src.text != null
          ? src.text
          : "";
  return {
    order: src.order != null && Number.isFinite(Number(src.order)) ? Number(src.order) : index,
    blockType: src.blockType || src.type || "unknown",
    originalContent: normalizeWhitespace(String(original)),
    normalizedContent:
      src.normalizedContent !== undefined ? deepClone(src.normalizedContent) : null
  };
}

function normalizeSection(section, index) {
  const src = section && typeof section === "object" ? section : {};
  const blocksRaw = Array.isArray(src.blocks) ? src.blocks.slice() : [];
  const blocks = blocksRaw
    .map((b, i) => normalizeBlock(b, i))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b, i) => ({
      ...b,
      order: b.order != null ? b.order : i
    }));

  return {
    order: src.order != null && Number.isFinite(Number(src.order)) ? Number(src.order) : index,
    sectionType: src.sectionType || src.type || "unknown",
    title:
      src.title != null
        ? normalizeWhitespace(String(src.title)).trim() || null
        : src.normalizedTitle != null
          ? normalizeWhitespace(String(src.normalizedTitle)).trim() || null
          : null,
    generatorTitle:
      src.generatorTitle != null
        ? normalizeWhitespace(String(src.generatorTitle)).trim() || null
        : null,
    normalizedTitle:
      src.normalizedTitle != null
        ? normalizeWhitespace(String(src.normalizedTitle)).trim() || null
        : null,
    originalTitle:
      src.originalTitle != null
        ? normalizeWhitespace(String(src.originalTitle)).trim() || null
        : null,
    blocks,
    blockCount: blocks.length
  };
}

function normalizeDocument(doc, fallbackLanguage) {
  const src = doc && typeof doc === "object" ? doc : {};
  return {
    documentType: src.documentType != null ? String(src.documentType) : null,
    documentTypeLabel: src.documentTypeLabel != null ? String(src.documentTypeLabel) : null,
    language: preserveLanguage(
      src.language != null ? src.language : fallbackLanguage != null ? fallbackLanguage : null
    ),
    title: src.title != null ? normalizeWhitespace(String(src.title)).trim() || null : null,
    pageStatusHint: src.pageStatusHint != null ? String(src.pageStatusHint) : null
  };
}

function normalizeMetadata(metadata) {
  if (metadata == null) return null;
  if (typeof metadata !== "object") return null;
  return deepClone(metadata);
}

/**
 * Normalize any AI response into the shared CIP internal format.
 *
 * Supports:
 * - Missing optional fields
 * - Extra unknown fields (recorded, ignored for structure)
 * - Ordering normalization (sections + blocks)
 * - Whitespace normalization
 * - Language preservation
 *
 * @param {*} rawResponse
 * @param {object} [options]
 * @param {string|null} [options.fallbackLanguage]
 * @returns {object}
 */
function normalizeAiResponse(rawResponse, options = {}) {
  const source = unwrapRawResponse(rawResponse);
  const knownRoots = [
    "document",
    "metadata",
    "sections",
    "blocks",
    "warnings",
    "notes",
    "confidence",
    // aliases sometimes seen in free-form JSON
    "documentType",
    "documentTypeLabel",
    "language",
    "title",
    "pageStatusHint",
    "draft",
    "result",
    "data",
    "output"
  ];

  const unknownFields = collectUnknownFields(source, knownRoots);

  // Document may be nested or flattened at root
  let documentSrc = source.document;
  if (!documentSrc || typeof documentSrc !== "object") {
    documentSrc = {
      documentType: source.documentType,
      documentTypeLabel: source.documentTypeLabel,
      language: source.language,
      title: source.title,
      pageStatusHint: source.pageStatusHint
    };
  }

  const sectionsRaw = Array.isArray(source.sections)
    ? source.sections.slice()
    : [];

  // Root-level blocks (unsupported placement) → wrap as unknown section if no sections
  if (sectionsRaw.length === 0 && Array.isArray(source.blocks) && source.blocks.length > 0) {
    sectionsRaw.push({
      order: 0,
      sectionType: "unknown",
      title: null,
      blocks: source.blocks
    });
  }

  const sections = sectionsRaw
    .map((s, i) => normalizeSection(s, i))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s, i) => ({
      ...s,
      order: s.order != null ? s.order : i
    }));

  const fallbackLanguage =
    options.fallbackLanguage != null
      ? options.fallbackLanguage
      : documentSrc && documentSrc.language != null
        ? documentSrc.language
        : null;

  const document = normalizeDocument(documentSrc, fallbackLanguage);
  // Explicit language preservation: if source had language, keep it even after whitespace ops
  if (source.language != null && document.language == null) {
    document.language = preserveLanguage(source.language);
  }

  const normalized = {
    formatId: NORMALIZED_RESPONSE_FORMAT_ID,
    version: CONTRACT_VERSION,
    document,
    metadata: normalizeMetadata(source.metadata),
    sections,
    sectionCount: sections.length,
    blockCount: sections.reduce((n, s) => n + s.blockCount, 0),
    warnings: normalizeStringList(source.warnings),
    notes: normalizeStringList(source.notes),
    confidence: normalizeConfidence(source.confidence),
    unknownFields,
    extensions: {
      hadDocumentObject: Boolean(source.document && typeof source.document === "object"),
      hadSectionsArray: Array.isArray(source.sections),
      missingOptional: {
        metadata: source.metadata == null,
        warnings: source.warnings == null,
        notes: source.notes == null,
        confidence: source.confidence == null
      }
    }
  };

  return normalized;
}

module.exports = {
  normalizeAiResponse,
  normalizeBlock,
  normalizeSection,
  normalizeDocument,
  normalizeMetadata,
  normalizeConfidence,
  normalizeStringList,
  normalizeWhitespace,
  unwrapRawResponse,
  deepClone
};
