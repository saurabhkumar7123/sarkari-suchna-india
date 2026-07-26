"use strict";

/**
 * CIP Stage 2D — section + block mappers.
 *
 * Deterministic CIP → Generator mapping. Never invents, rewrites, or
 * summarizes content. Unknown sections/blocks are preserved.
 */

const {
  SECTION_CANONICAL_TITLES,
  isKnownSectionType,
  isKnownBlockType
} = require("../structureIntelligence/structureTypes");
const { toGeneratorTitle } = require("../structureIntelligence/sectionEngine");
const { canonicalSectionTitle } = require("../../../utils/publisherSections");
const { CONTENT_TYPES, detectContentType } = require("../../../utils/sectionEditorModel");
const {
  SECTION_TYPE_TO_GENERATOR_TITLE,
  BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE,
  warning
} = require("./transformationTypes");

function stableSectionId(order) {
  return `cip2d_sec_${Number(order)}`;
}

function stableBlockId(sectionOrder, blockOrder) {
  return `cip2d_blk_${Number(sectionOrder)}_${Number(blockOrder)}`;
}

function resolveGeneratorTitle(section, warnings) {
  const sectionType =
    section && section.sectionType != null ? String(section.sectionType) : "unknown";
  const known = isKnownSectionType(sectionType);

  if (section && section.generatorTitle) {
    return {
      generatorTitle: canonicalSectionTitle(section.generatorTitle),
      titleSource: "generatorTitle",
      forceTable: /\|\s*table\s*$/i.test(String(section.generatorTitle)),
      knownSection: known
    };
  }

  const canonical =
    SECTION_TYPE_TO_GENERATOR_TITLE[sectionType] || SECTION_CANONICAL_TITLES[sectionType];
  if (canonical) {
    return {
      generatorTitle: canonical,
      titleSource: "sectionType",
      forceTable: false,
      knownSection: known
    };
  }

  const fallback =
    (section && (section.title || section.normalizedTitle || section.originalTitle)) || null;
  if (fallback) {
    const viaPublisher = toGeneratorTitle(fallback) || String(fallback).trim();
    if (!known) {
      warnings.push(
        warning(
          "transform.unknown_section_preserved",
          "info",
          `Unknown section type "${sectionType}" preserved with title "${viaPublisher}".`,
          { sectionOrder: section.order, sectionType }
        )
      );
    }
    return {
      generatorTitle: viaPublisher,
      titleSource: "fallback_title",
      forceTable: /\|\s*table\s*$/i.test(String(fallback)),
      knownSection: known
    };
  }

  warnings.push(
    warning(
      "transform.section_title_missing",
      "warning",
      "Section has no Generator title; using Untitled.",
      { sectionOrder: section && section.order, sectionType }
    )
  );
  return {
    generatorTitle: "Untitled",
    titleSource: "default",
    forceTable: false,
    knownSection: known
  };
}

function joinBlockContent(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return "";
  return blocks
    .map((block) => (block && block.originalContent != null ? String(block.originalContent) : ""))
    .join("\n");
}

function mapBlock(block, sectionOrder, warnings) {
  const blockOrder =
    block && block.order != null && Number.isFinite(Number(block.order))
      ? Number(block.order)
      : 0;
  const blockType = block && block.blockType != null ? String(block.blockType) : "unknown";
  const known = isKnownBlockType(blockType);
  const generatorContentType =
    BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE[blockType] || CONTENT_TYPES.MIXED;
  const originalContent =
    block && block.originalContent != null ? String(block.originalContent) : "";

  if (!known) {
    warnings.push(
      warning(
        "transform.unknown_block_preserved",
        "info",
        `Unknown block type "${blockType}" preserved as mixed/raw.`,
        { sectionOrder, blockOrder, blockType }
      )
    );
  }

  return {
    id: stableBlockId(sectionOrder, blockOrder),
    order: blockOrder,
    blockType,
    generatorContentType,
    generatorBlockType: known ? blockType : "unknown",
    originalContent,
    normalizedContent:
      block && block.normalizedContent !== undefined ? block.normalizedContent : null,
    knownBlock: known,
    preserved: true,
    sourceRef: {
      governedSectionOrder: sectionOrder,
      governedBlockOrder: blockOrder,
      governedBlockType: blockType
    }
  };
}

function resolveSectionContentType(mappedBlocks, body, forceTable) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (forceTable) return CONTENT_TYPES.TABLE;
  if (!mappedBlocks.length) return CONTENT_TYPES.MIXED;

  if (mappedBlocks.length === 1) {
    const preferred = mappedBlocks[0].generatorContentType || CONTENT_TYPES.MIXED;
    if (preferred === CONTENT_TYPES.MIXED) {
      return detectContentType(lines, false, body) || CONTENT_TYPES.MIXED;
    }
    return preferred;
  }

  return detectContentType(lines, false, body) || CONTENT_TYPES.MIXED;
}

function mapSection(section, index, warnings) {
  const sectionOrder =
    section && section.order != null && Number.isFinite(Number(section.order))
      ? Number(section.order)
      : index;
  const sectionType =
    section && section.sectionType != null ? String(section.sectionType) : "unknown";
  const titleInfo = resolveGeneratorTitle(section || {}, warnings);
  const sourceBlocks = Array.isArray(section && section.blocks) ? section.blocks : [];
  const mappedBlocks = sourceBlocks
    .slice()
    .sort((a, b) => (Number(a && a.order) || 0) - (Number(b && b.order) || 0))
    .map((block, blockIndex) => {
      const withOrder =
        block && block.order != null ? block : { ...(block || {}), order: blockIndex };
      return mapBlock(withOrder, sectionOrder, warnings);
    });

  const body = joinBlockContent(mappedBlocks);
  const forceTable = Boolean(titleInfo.forceTable) || Boolean(section && section.forceTable);
  const detectedContentType = resolveSectionContentType(mappedBlocks, body, forceTable);

  // Lossless Generator payload: always keep original body as raw MIXED so
  // compile/parse never mutates dates, links, FAQ, rich tags, or unknown text.
  // detectedContentType is retained for mapping metadata / compatibility.
  const cleanName = String(titleInfo.generatorTitle || "Untitled")
    .replace(/\|\s*table\s*$/i, "")
    .trim();

  const editorSection = {
    id: stableSectionId(sectionOrder),
    name: cleanName,
    forceTable,
    contentType: CONTENT_TYPES.MIXED,
    payload: { raw: body }
  };

  return {
    id: editorSection.id,
    order: sectionOrder,
    sectionType,
    knownSection: titleInfo.knownSection,
    title: section && section.title != null ? section.title : null,
    originalTitle: section && section.originalTitle != null ? section.originalTitle : null,
    normalizedTitle: section && section.normalizedTitle != null ? section.normalizedTitle : null,
    generatorTitle: titleInfo.generatorTitle,
    titleSource: titleInfo.titleSource,
    forceTable,
    contentType: detectedContentType,
    editorContentType: CONTENT_TYPES.MIXED,
    body,
    payload: editorSection.payload,
    blocks: mappedBlocks,
    blockCount: mappedBlocks.length,
    editorSection,
    sourceRef: {
      governedSectionOrder: sectionOrder,
      governedSectionType: sectionType
    }
  };
}

module.exports = {
  mapSection,
  mapBlock,
  joinBlockContent,
  resolveGeneratorTitle,
  stableSectionId,
  stableBlockId
};
