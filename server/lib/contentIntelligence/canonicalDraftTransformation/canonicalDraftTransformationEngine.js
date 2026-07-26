"use strict";

/**
 * CIP Stage 2D — Canonical Draft Transformation Engine.
 *
 * Transforms a Stage 2C governed AI draft into a Generator-ready native
 * document. Shared by manual PDF and automation workflows.
 *
 * Boundaries:
 *   - Transformation only (no AI / network / SDK)
 *   - No HTML, rendering, publishing, Generator, Foundation, or 2A–2C edits
 *   - Deterministic; never invents, rewrites, or summarizes content
 */

const { deepClone } = require("../aiDraftGeneration/responseNormalizer");
const { GOVERNED_DRAFT_FORMAT_ID } = require("../aiResponseGovernance/governanceTypes");
const { mapSection } = require("./sectionMapper");
const {
  buildGeneratorMetadata,
  buildGeneratorText,
  buildTraceability,
  reverseMappedSections,
  summarizeParseability
} = require("./generatorDocumentBuilder");
const { buildCompatibilityReport } = require("./compatibilityReport");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  TRANSFORMATION_VERSION,
  GENERATOR_READY_FORMAT_ID,
  SUPPORTED_GENERATOR_MAPPINGS,
  warning
} = require("./transformationTypes");

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

function resolveGovernedDraft(input) {
  const value = input && typeof input === "object" ? input : {};

  if (value.governedDraft && typeof value.governedDraft === "object") {
    return {
      governedDraft: value.governedDraft,
      governanceResult: value.governanceResult || value,
      pipeline: value.pipeline || null
    };
  }

  if (value.governanceResult && value.governanceResult.governedDraft) {
    return {
      governedDraft: value.governanceResult.governedDraft,
      governanceResult: value.governanceResult,
      pipeline: value.pipeline || value.governanceResult.pipeline || null
    };
  }

  // Accept a bare governed draft (formatId or sections present).
  if (
    value.formatId === GOVERNED_DRAFT_FORMAT_ID ||
    value.formatId === "cip_normalized_ai_response_v1" ||
    Array.isArray(value.sections)
  ) {
    return {
      governedDraft: value,
      governanceResult: null,
      pipeline: value.pipeline || null
    };
  }

  return {
    governedDraft: value.draft || {},
    governanceResult: null,
    pipeline: value.pipeline || null
  };
}

function buildTransformationSummary(mappedSections, warnings, compatibility) {
  const sectionTypeCounts = Object.create(null);
  const blockTypeCounts = Object.create(null);
  let knownSectionCount = 0;
  let unknownSectionCount = 0;
  let knownBlockCount = 0;
  let unknownBlockCount = 0;

  mappedSections.forEach((section) => {
    sectionTypeCounts[section.sectionType] =
      (sectionTypeCounts[section.sectionType] || 0) + 1;
    if (section.knownSection) knownSectionCount += 1;
    else unknownSectionCount += 1;
    section.blocks.forEach((block) => {
      blockTypeCounts[block.blockType] = (blockTypeCounts[block.blockType] || 0) + 1;
      if (block.knownBlock) knownBlockCount += 1;
      else unknownBlockCount += 1;
    });
  });

  return {
    transformationVersion: TRANSFORMATION_VERSION,
    mappedSectionCount: mappedSections.length,
    mappedBlockCount: mappedSections.reduce((sum, section) => sum + section.blockCount, 0),
    knownSectionCount,
    unknownSectionCount,
    knownBlockCount,
    unknownBlockCount,
    sectionTypeCounts,
    blockTypeCounts,
    warningCount: warnings.length,
    compatibilityStatus: compatibility.status,
    compatible: compatibility.compatible,
    contentPreserved: true,
    orderingPreserved: true,
    unknownPreserved: true
  };
}

function transformCanonicalDraft(input = {}) {
  const freeze = input.freeze !== false;
  const resolved = resolveGovernedDraft(input);
  const governedDraft = deepClone(resolved.governedDraft || {});
  const warnings = [];

  if (!governedDraft || typeof governedDraft !== "object") {
    warnings.push(
      warning("transform.input_invalid", "error", "Governed draft input is missing or invalid.")
    );
  }

  const sourceSections = Array.isArray(governedDraft.sections) ? governedDraft.sections : [];
  if (!sourceSections.length) {
    warnings.push(
      warning(
        "transform.sections_empty",
        "warning",
        "Governed draft has no sections; Generator document will be empty."
      )
    );
  }

  const mappedSections = sourceSections
    .slice()
    .sort((a, b) => (Number(a && a.order) || 0) - (Number(b && b.order) || 0))
    .map((section, index) => mapSection(section, index, warnings));

  const mappedBlocks = mappedSections.flatMap((section) =>
    section.blocks.map((block) => ({
      ...block,
      sectionId: section.id,
      sectionOrder: section.order,
      generatorTitle: section.generatorTitle
    }))
  );

  const generatorMetadata = buildGeneratorMetadata(governedDraft);
  const generatorText = buildGeneratorText(mappedSections);
  const generatorSections = mappedSections.map((section) => deepClone(section.editorSection));
  const parseability = summarizeParseability(generatorText);
  const generatorCompatibility = buildCompatibilityReport(
    governedDraft,
    mappedSections,
    parseability
  );
  const traceability = buildTraceability(mappedSections, governedDraft);
  const transformationSummary = buildTransformationSummary(
    mappedSections,
    warnings,
    generatorCompatibility
  );

  const generatorReadyDocument = {
    formatId: GENERATOR_READY_FORMAT_ID,
    transformationVersion: TRANSFORMATION_VERSION,
    metadata: generatorMetadata,
    sections: mappedSections.map((section) => ({
      id: section.id,
      order: section.order,
      sectionType: section.sectionType,
      generatorTitle: section.generatorTitle,
      forceTable: section.forceTable,
      contentType: section.contentType,
      body: section.body,
      payload: section.payload,
      blocks: section.blocks,
      sourceRef: section.sourceRef
    })),
    generatorSections,
    generatorText,
    mappedSections,
    mappedBlocks,
    generatorMetadata,
    generatorCompatibility,
    transformationWarnings: warnings,
    transformationSummary,
    traceability,
    reverse: {
      sections: reverseMappedSections(mappedSections)
    }
  };

  const result = {
    formatId: GENERATOR_READY_FORMAT_ID,
    version: TRANSFORMATION_VERSION,
    transformationVersion: TRANSFORMATION_VERSION,
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    pipeline: resolved.pipeline || input.pipeline || null,
    sourceGovernedDraft: governedDraft,
    generatorReadyDocument,
    mappedSections,
    mappedBlocks,
    generatorMetadata,
    generatorCompatibility,
    transformationWarnings: warnings,
    transformationSummary,
    traceability,
    supportedMappings: SUPPORTED_GENERATOR_MAPPINGS.slice(),
    extensions: {
      deterministic: true,
      executedModel: false,
      providerAgnostic: true,
      contentPreserved: true,
      orderingPreserved: true,
      unknownPreserved: true,
      reversible: true,
      htmlGenerated: false,
      published: false,
      upstreamStageIds: [
        "CIP_1A",
        "CIP_1B",
        "CIP_1C_1D",
        "CIP_1E",
        "CIP_2A",
        "CIP_2B",
        "CIP_2C"
      ]
    }
  };

  const cloned = deepClone(result);
  return freeze ? deepFreeze(cloned) : cloned;
}

function transformFromGovernedDraft(governedDraft, extra = {}) {
  return transformCanonicalDraft({ ...extra, governedDraft });
}

function transformFromGovernanceResult(governanceResult, extra = {}) {
  return transformCanonicalDraft({ ...extra, governanceResult });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  TRANSFORMATION_VERSION,
  transformCanonicalDraft,
  transformFromGovernedDraft,
  transformFromGovernanceResult,
  reverseMappedSections,
  deepFreeze
};
