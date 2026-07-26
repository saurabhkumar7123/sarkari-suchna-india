"use strict";

const {
  SECTION_TYPE_LIST,
  BLOCK_TYPE_LIST,
  SECTION_CANONICAL_TITLES
} = require("../structureIntelligence/structureTypes");
const {
  GENERATOR_KNOWN_TITLES,
  getRequiredMetadata,
  getRequiredSections
} = require("../validationEngine/validationRules");
const { finding } = require("./governanceTypes");

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function grammarValid(block) {
  const content = String(block.originalContent || "").trim();
  if (!content) return false;
  switch (block.blockType) {
    case "link":
      return /=https?:\/\/\S+/i.test(content) || /^https?:\/\/\S+/i.test(content);
    case "multi_link":
      return content.split("|").every((part) => /=https?:\/\/\S+/i.test(part.trim()));
    case "faq":
      return /(?:^|\n)\s*Q\s*:/i.test(content) && /(?:^|\n)\s*A\s*:/i.test(content);
    case "table":
      return (
        content.split(/\r?\n/).filter(Boolean).length >= 2 &&
        (content.includes(",") || /\|/.test(content) || /---table---/i.test(content))
      );
    case "list":
      return /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+\S/.test(content);
    case "key_value":
    case "date_row":
      return /[:=]\s*\S/.test(content);
    default:
      return true;
  }
}

function validateGeneratorCompatibility(draft) {
  const findings = [];
  const documentType = (draft && draft.document && draft.document.documentType) || "unknown";
  const sections = draft && Array.isArray(draft.sections) ? draft.sections : [];
  const presentTypes = new Set(sections.map((section) => section && section.sectionType));

  getRequiredSections(documentType).forEach((sectionType) => {
    if (!presentTypes.has(sectionType)) {
      findings.push(
        finding(
          "generator.required_section_missing",
          "error",
          "generator",
          `Generator-required section is missing: ${sectionType}.`,
          { sectionType }
        )
      );
    }
  });

  sections.forEach((section, sectionIndex) => {
    const path = `sections[${sectionIndex}]`;
    if (!SECTION_TYPE_LIST.includes(section.sectionType)) {
      findings.push(
        finding(
          "generator.unsupported_section",
          "error",
          "generator",
          `Unsupported section type: ${section.sectionType}.`,
          { path, sectionType: section.sectionType }
        )
      );
    }
    const expectedTitle = SECTION_CANONICAL_TITLES[section.sectionType] || null;
    if (!section.generatorTitle) {
      findings.push(
        finding(
          "generator.title_mapping_missing",
          "warning",
          "generator",
          "Generator title mapping is missing.",
          { path: `${path}.generatorTitle`, sectionType: section.sectionType }
        )
      );
    } else if (!GENERATOR_KNOWN_TITLES.includes(section.generatorTitle)) {
      findings.push(
        finding(
          "generator.title_unsupported",
          "warning",
          "generator",
          `Unsupported Generator title: ${section.generatorTitle}.`,
          {
            expected: expectedTitle,
            path: `${path}.generatorTitle`,
            sectionType: section.sectionType
          }
        )
      );
    }
    (Array.isArray(section.blocks) ? section.blocks : []).forEach((block, blockIndex) => {
      const blockPath = `${path}.blocks[${blockIndex}]`;
      if (!BLOCK_TYPE_LIST.includes(block.blockType)) {
        findings.push(
          finding(
            "generator.unsupported_block",
            "error",
            "generator",
            `Unsupported block type: ${block.blockType}.`,
            { blockType: block.blockType, path: blockPath }
          )
        );
      } else if (!grammarValid(block)) {
        findings.push(
          finding(
            "generator.invalid_grammar",
            "error",
            "generator",
            `Block does not match ${block.blockType} Generator grammar.`,
            { blockType: block.blockType, path: blockPath }
          )
        );
      }
    });
  });

  const metadata =
    draft && draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {};
  getRequiredMetadata(documentType).forEach((field) => {
    const value =
      field === "title"
        ? metadata.title || (draft.document && draft.document.title)
        : field === "detectedDocumentType"
          ? metadata.detectedDocumentType || (draft.document && draft.document.documentType)
          : metadata[field];
    if (!hasValue(value)) {
      findings.push(
        finding(
          "generator.required_metadata_missing",
          "error",
          "generator",
          `Required Generator metadata is missing: ${field}.`,
          { field, path: `metadata.${field}` }
        )
      );
    }
  });

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  return {
    status: errors ? "incompatible" : warnings ? "partial" : "compatible",
    compatible: errors === 0,
    supportedSectionTypes: SECTION_TYPE_LIST.slice(),
    supportedBlockTypes: BLOCK_TYPE_LIST.slice(),
    findings,
    summary: { errorCount: errors, warningCount: warnings }
  };
}

module.exports = { validateGeneratorCompatibility, grammarValid };
