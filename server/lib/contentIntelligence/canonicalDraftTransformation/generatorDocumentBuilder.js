"use strict";

/**
 * CIP Stage 2D — Generator-ready document assembly + reverse mapping.
 *
 * Reuses Generator grammar ([Section: …] headers) and sectionEditorModel
 * compile helpers. Never generates HTML or publishes.
 */

const {
  compileEditorSectionsToText,
  normalizeEditorText,
  parseSectionsFromText
} = require("../../../utils/sectionEditorModel");
const { parseSectionsFromText: parseGeneratorSections } = require("../../../../generator/parse/sectionParse");

function buildGeneratorMetadata(governedDraft) {
  const document =
    governedDraft && governedDraft.document && typeof governedDraft.document === "object"
      ? governedDraft.document
      : {};
  const metadata =
    governedDraft && governedDraft.metadata && typeof governedDraft.metadata === "object"
      ? governedDraft.metadata
      : {};

  return {
    title: metadata.title || document.title || null,
    organization: metadata.organization != null ? metadata.organization : null,
    detectedDocumentType:
      metadata.detectedDocumentType || document.documentType || null,
    documentType: document.documentType || metadata.detectedDocumentType || null,
    documentTypeLabel: document.documentTypeLabel || null,
    language: document.language != null ? document.language : null,
    pageStatusHint: document.pageStatusHint != null ? document.pageStatusHint : null,
    importantDates:
      metadata.importantDates && typeof metadata.importantDates === "object"
        ? metadata.importantDates
        : null,
    sourceMetadata: metadata,
    sourceDocument: document
  };
}

function buildGeneratorText(mappedSections) {
  const editorSections = mappedSections.map((section) => ({
    name: section.forceTable
      ? /\|\s*table\s*$/i.test(String(section.generatorTitle || ""))
        ? section.generatorTitle
        : `${String(section.generatorTitle || section.editorSection.name).replace(
            /\|\s*table\s*$/i,
            ""
          ).trim()} | table`
      : section.editorSection.name,
    forceTable: section.forceTable,
    contentType: "mixed",
    payload: { raw: section.body }
  }));

  // Always emit from original body via MIXED so Generator text is lossless.
  return compileEditorSectionsToText(editorSections);
}

function buildTraceability(mappedSections, governedDraft) {
  return {
    sourceFormatId:
      (governedDraft && governedDraft.formatId) || "cip_governed_ai_draft_v1",
    sourceStageId: "CIP_2C",
    reversible: true,
    sections: mappedSections.map((section) => ({
      mappedSectionId: section.id,
      mappedOrder: section.order,
      generatorTitle: section.generatorTitle,
      source: section.sourceRef,
      blocks: section.blocks.map((block) => ({
        mappedBlockId: block.id,
        mappedOrder: block.order,
        generatorBlockType: block.generatorBlockType,
        source: block.sourceRef
      }))
    }))
  };
}

/**
 * Reverse mapped Generator-ready sections back to a governed-draft-like shape.
 * Practical reversibility: restores originalContent / types from mapped traces.
 */
function reverseMappedSections(mappedSections) {
  return (mappedSections || []).map((section) => ({
    order: section.order,
    sectionType: section.sectionType,
    title: section.title,
    generatorTitle: section.generatorTitle,
    normalizedTitle: section.normalizedTitle,
    originalTitle: section.originalTitle,
    forceTable: section.forceTable,
    blocks: (section.blocks || []).map((block) => ({
      order: block.order,
      blockType: block.blockType,
      originalContent: block.originalContent,
      normalizedContent: block.normalizedContent
    }))
  }));
}

function summarizeParseability(generatorText) {
  const viaEditor = parseSectionsFromText(generatorText);
  const viaGenerator = parseGeneratorSections(generatorText);
  return {
    editorSectionCount: viaEditor.length,
    generatorSectionCount: viaGenerator.length,
    normalizedLength: normalizeEditorText(generatorText).length,
    hasSectionMarkers: /\[\s*section\s*:/i.test(String(generatorText || ""))
  };
}

module.exports = {
  buildGeneratorMetadata,
  buildGeneratorText,
  buildTraceability,
  reverseMappedSections,
  summarizeParseability
};
