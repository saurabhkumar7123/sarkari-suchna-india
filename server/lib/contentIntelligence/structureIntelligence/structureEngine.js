"use strict";

/**
 * CIP Combined Stage 1C + 1D — Shared Structure Intelligence Engine.
 *
 * Pipeline position:
 *   Stage 1A (document type) → Stage 1B (metadata) → Stage 1C + 1D (this)
 *
 * Transforms raw document text into one structured document object with
 * ordered sections (Stage 1C) each containing ordered typed blocks
 * (Stage 1D). Reuses Stage 1A/1B results when provided; never modifies them.
 *
 * Deterministic, no AI calls, no external dependencies, never invents content.
 */

const { classifyDocument } = require("../documentClassification");
const { extractMetadata } = require("../metadataIntelligence");

const {
  splitIntoRawSections,
  normalizeSectionTitle,
  toGeneratorTitle
} = require("./sectionEngine");

const { parseBlocks } = require("./blockEngine");

const {
  UNKNOWN_SECTION_TYPE,
  UNKNOWN_BLOCK_TYPE
} = require("./structureTypes");

const ENGINE_ID = "CIP_STRUCTURE_INTELLIGENCE_ENGINE";
const STAGE_ID = "CIP_1C_1D";
const ENGINE_VERSION = "1.0.0";

/**
 * @typedef {Object} StructureDocumentInput
 * @property {string} [title]
 * @property {string|string[]} [headings]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [filename]
 * @property {string} [url]
 * @property {Object} [metadata] Optional known field hints for Stage 1B
 * @property {Object} [classification] Optional Stage 1A result to reuse
 * @property {Object} [metadataResult] Optional Stage 1B result to reuse
 * @property {boolean} [skipClassification]
 * @property {boolean} [skipMetadata]
 */

function resolveClassification(input) {
  if (input.classification && typeof input.classification === "object") {
    return { result: input.classification, reused: true };
  }
  if (input.skipClassification) {
    return { result: null, reused: false };
  }
  return {
    result: classifyDocument({
      title: input.title,
      headings: input.headings,
      text: input.text || input.content,
      filename: input.filename,
      url: input.url,
      metadata: input.metadata
    }),
    reused: false
  };
}

function resolveMetadata(input, classificationResult) {
  if (input.metadataResult && typeof input.metadataResult === "object") {
    return { result: input.metadataResult, reused: true };
  }
  if (input.skipMetadata) {
    return { result: null, reused: false };
  }
  return {
    result: extractMetadata({
      title: input.title,
      headings: input.headings,
      text: input.text || input.content,
      filename: input.filename,
      url: input.url,
      notificationUrl: input.notificationUrl,
      officialWebsite: input.officialWebsite,
      sourceType: input.sourceType,
      contentType: input.contentType,
      pipeline: input.pipeline,
      source: input.source,
      metadata: input.metadata,
      classification: classificationResult || undefined,
      skipClassification: !classificationResult
    }),
    reused: false
  };
}

function buildSection(rawSection, order) {
  const warnings = [];

  const titleInfo =
    rawSection.originalTitle == null
      ? {
          sectionType: UNKNOWN_SECTION_TYPE,
          normalizedTitle: rawSection.source === "preamble" ? "Preamble" : "Content",
          confidence: "none",
          ambiguous: false,
          forceTable: false,
          matchedIndicators: []
        }
      : normalizeSectionTitle(rawSection.originalTitle, {
          source: rawSection.source,
          custom: rawSection.custom,
          precomputedMatches: rawSection.matches
        });

  const forceTable = titleInfo.forceTable || Boolean(rawSection.forceTable);
  const blocks = parseBlocks(rawSection.content, { forceTable });

  if (titleInfo.sectionType === UNKNOWN_SECTION_TYPE && rawSection.originalTitle != null) {
    warnings.push(
      `Unrecognized section title "${rawSection.originalTitle}"; kept as custom section.`
    );
  }
  if (titleInfo.ambiguous) {
    warnings.push(`Ambiguous section title "${rawSection.originalTitle}"; first rule match kept.`);
  }
  if (!String(rawSection.content || "").trim()) {
    warnings.push("Section has no content.");
  }
  for (const block of blocks) {
    for (const blockWarning of block.warnings) {
      warnings.push(`Block ${block.order} (${block.blockType}): ${blockWarning}`);
    }
  }

  return {
    order,
    originalTitle: rawSection.originalTitle,
    normalizedTitle: titleInfo.normalizedTitle,
    sectionType: titleInfo.sectionType,
    isKnownSection: titleInfo.sectionType !== UNKNOWN_SECTION_TYPE,
    confidence: titleInfo.confidence,
    matchedIndicators: titleInfo.matchedIndicators,
    source: rawSection.source,
    forceTable,
    generatorTitle: toGeneratorTitle(rawSection.originalTitle),
    originalContent: String(rawSection.content || ""),
    blocks,
    blockCount: blocks.length,
    warnings
  };
}

function buildStats(sections) {
  const sectionTypeCounts = Object.create(null);
  const blockTypeCounts = Object.create(null);
  let knownSectionCount = 0;
  let unknownSectionCount = 0;
  let blockCount = 0;

  for (const section of sections) {
    sectionTypeCounts[section.sectionType] =
      (sectionTypeCounts[section.sectionType] || 0) + 1;
    if (section.isKnownSection) knownSectionCount += 1;
    else unknownSectionCount += 1;
    for (const block of section.blocks) {
      blockTypeCounts[block.blockType] = (blockTypeCounts[block.blockType] || 0) + 1;
      blockCount += 1;
    }
  }

  return {
    knownSectionCount,
    unknownSectionCount,
    blockCount,
    sectionTypeCounts,
    blockTypeCounts
  };
}

/**
 * Transform a raw document into one structured document object.
 * Safe for both manual PDF and automatic website pipelines.
 *
 * @param {StructureDocumentInput} input
 */
function structureDocument(input = {}) {
  const text = String(input.text || input.content || "");

  const classification = resolveClassification(input);
  const metadata = resolveMetadata(input, classification.result);

  const rawSections = splitIntoRawSections(text);
  const sections = rawSections.map((rawSection, index) => buildSection(rawSection, index));
  const stats = buildStats(sections);

  const warnings = [];
  if (!text.trim()) {
    warnings.push("Empty input: no document text provided.");
  } else if (!sections.length) {
    warnings.push("No sections detected in document text.");
  }
  if (stats.unknownSectionCount > 0) {
    warnings.push(`${stats.unknownSectionCount} section(s) could not be mapped to a known type.`);
  }
  if ((blockTypeCount(stats, UNKNOWN_BLOCK_TYPE)) > 0) {
    warnings.push(`${blockTypeCount(stats, UNKNOWN_BLOCK_TYPE)} unknown block(s) preserved as-is.`);
  }

  const documentType =
    (classification.result && classification.result.documentType) || "unknown";
  const documentTypeLabel =
    (classification.result && classification.result.documentTypeLabel) || "Unknown";

  return {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    documentType,
    documentTypeLabel,
    sections,
    sectionCount: sections.length,
    blockCount: stats.blockCount,
    metadata: metadata.result ? metadata.result.normalizedMetadata : null,
    classification: classification.result,
    stats,
    warnings,
    // Extensibility hooks for future CIP stages (e.g. Stage 1E validation)
    extensions: {
      metadataResult: metadata.result,
      classificationReused: classification.reused,
      metadataReused: metadata.reused,
      sourceLength: text.length
    }
  };
}

function blockTypeCount(stats, blockType) {
  return stats.blockTypeCounts[blockType] || 0;
}

/**
 * Convenience: structure from plain extracted PDF/parser text only.
 * @param {string} text
 * @param {StructureDocumentInput} [extra]
 */
function structureDocumentFromText(text, extra = {}) {
  return structureDocument({ ...extra, text });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  structureDocument,
  structureDocumentFromText,
  buildSection,
  buildStats
};
