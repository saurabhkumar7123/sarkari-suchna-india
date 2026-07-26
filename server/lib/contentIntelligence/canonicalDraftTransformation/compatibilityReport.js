"use strict";

/**
 * CIP Stage 2D — Generator compatibility report for the transformed document.
 *
 * Reuses Stage 2C generatorCompatibility + Foundation title/type lists.
 * Does not modify Generator or Stage 2C.
 */

const {
  validateGeneratorCompatibility,
  grammarValid
} = require("../aiResponseGovernance/generatorCompatibility");
const {
  SECTION_TYPE_LIST,
  BLOCK_TYPE_LIST
} = require("../structureIntelligence/structureTypes");
const { GENERATOR_KNOWN_TITLES } = require("../validationEngine/validationRules");
const { parsePipeLinkLine } = require("../../../../generator/lib/parseLinkLineParts");
const { COMPATIBILITY_STATUSES, warning } = require("./transformationTypes");

function isGeneratorGrammarAcceptable(block) {
  if (!block) return false;
  if (block.blockType === "multi_link") {
    const parsed = parsePipeLinkLine(String(block.originalContent || "").trim());
    if (parsed && parsed.actions && parsed.actions.length >= 2) return true;
  }
  return grammarValid(block);
}

function buildCompatibilityReport(governedDraft, mappedSections, parseability) {
  const upstream = validateGeneratorCompatibility(governedDraft || {});
  const findings = [];
  const warnings = [];

  const reclassifiedUpstream = (upstream.findings || []).map((item) => {
    if (
      item.code === "generator.unsupported_section" ||
      item.code === "generator.unsupported_block"
    ) {
      return {
        ...item,
        severity: "warning",
        message: `${item.message} Preserved in Generator document as-is.`,
        preserved: true
      };
    }
    if (item.code === "generator.invalid_grammar" && item.blockType === "multi_link") {
      // Stage 2C's split('|') check is stricter than Generator pipe-link grammar.
      return {
        ...item,
        severity: "warning",
        message: `${item.message} Accepted via Generator pipe-link grammar.`,
        reclassified: true
      };
    }
    return item;
  });

  mappedSections.forEach((section, sectionIndex) => {
    const path = `mappedSections[${sectionIndex}]`;
    const cleanTitle = String(section.generatorTitle || "")
      .replace(/\|\s*table\s*$/i, "")
      .trim();

    if (!cleanTitle) {
      findings.push(
        warning("generator.title_missing", "error", "Mapped section is missing a Generator title.", {
          path,
          sectionOrder: section.order
        })
      );
    } else if (
      section.knownSection &&
      !GENERATOR_KNOWN_TITLES.includes(cleanTitle) &&
      cleanTitle !== "Untitled"
    ) {
      findings.push(
        warning(
          "generator.title_unsupported",
          "warning",
          `Unsupported Generator title: ${cleanTitle}.`,
          { path, generatorTitle: cleanTitle }
        )
      );
    }

    if (!section.knownSection) {
      warnings.push(
        warning(
          "compat.unknown_section",
          "info",
          `Unknown section preserved for Generator as "${cleanTitle}".`,
          { path, sectionType: section.sectionType }
        )
      );
    }

    (section.blocks || []).forEach((block, blockIndex) => {
      const blockPath = `${path}.blocks[${blockIndex}]`;
      if (!block.knownBlock) {
        warnings.push(
          warning(
            "compat.unknown_block",
            "info",
            `Unknown block preserved at ${blockPath}.`,
            { blockType: block.blockType, path: blockPath }
          )
        );
        return;
      }
      if (
        !isGeneratorGrammarAcceptable({
          blockType: block.blockType,
          originalContent: block.originalContent
        })
      ) {
        findings.push(
          warning(
            "generator.invalid_grammar",
            "error",
            `Block does not match ${block.blockType} Generator grammar.`,
            { path: blockPath, blockType: block.blockType }
          )
        );
      }
    });
  });

  if (parseability && !parseability.hasSectionMarkers && mappedSections.length > 0) {
    findings.push(
      warning(
        "generator.section_markers_missing",
        "error",
        "Generator text is missing [Section:] markers.",
        {}
      )
    );
  }

  if (
    parseability &&
    mappedSections.length > 0 &&
    parseability.generatorSectionCount !== mappedSections.length
  ) {
    findings.push(
      warning(
        "generator.section_count_mismatch",
        "warning",
        "Parsed Generator section count differs from mapped section count.",
        {
          expected: mappedSections.length,
          actual: parseability.generatorSectionCount
        }
      )
    );
  }

  const allFindings = reclassifiedUpstream.concat(findings);
  const errors = allFindings.filter((item) => item.severity === "error").length;
  const warningCount = allFindings.filter((item) => item.severity === "warning").length;

  let status = COMPATIBILITY_STATUSES.COMPATIBLE;
  if (errors) status = COMPATIBILITY_STATUSES.INCOMPATIBLE;
  else if (warningCount) status = COMPATIBILITY_STATUSES.PARTIAL;

  return {
    status,
    compatible: errors === 0,
    upstreamStatus: upstream.status,
    supportedSectionTypes: SECTION_TYPE_LIST.slice(),
    supportedBlockTypes: BLOCK_TYPE_LIST.slice(),
    supportedGeneratorTitles: GENERATOR_KNOWN_TITLES.slice(),
    findings: allFindings,
    preservationWarnings: warnings,
    parseability: parseability || null,
    summary: {
      errorCount: errors,
      warningCount,
      mappedSectionCount: mappedSections.length,
      mappedBlockCount: mappedSections.reduce((sum, section) => sum + section.blockCount, 0)
    }
  };
}

module.exports = { buildCompatibilityReport };
