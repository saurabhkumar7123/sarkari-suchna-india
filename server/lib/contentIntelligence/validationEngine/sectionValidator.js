"use strict";

/**
 * CIP Stage 1E — section + ordering validation.
 * Reuses Stage 1C taxonomy and preferred order rules.
 */

const {
  isKnownSectionType,
  UNKNOWN_SECTION_TYPE,
  SECTION_CANONICAL_TITLES
} = require("../structureIntelligence/structureTypes");
const { SEVERITIES, VALIDATION_CATEGORIES, createFinding } = require("./validationTypes");
const {
  getRequiredSections,
  getUnexpectedSections,
  preferredOrderIndex,
  GENERATOR_KNOWN_TITLES
} = require("./validationRules");

/**
 * @param {object} structuredDocument
 * @returns {Array<object>}
 */
function validateSections(structuredDocument) {
  const findings = [];
  const sections = (structuredDocument && structuredDocument.sections) || [];
  const documentType = (structuredDocument && structuredDocument.documentType) || "unknown";

  const typeCounts = Object.create(null);
  for (const section of sections) {
    const type = section.sectionType || UNKNOWN_SECTION_TYPE;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  // Required sections
  const required = getRequiredSections(documentType);
  for (const sectionType of required) {
    if (!typeCounts[sectionType]) {
      findings.push(
        createFinding(
          "SEC_REQUIRED_MISSING",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.SECTION,
          `Required section "${sectionType}" is missing for document type "${documentType}".`,
          { sectionType }
        )
      );
    }
  }

  // Duplicate known sections
  for (const [sectionType, count] of Object.entries(typeCounts)) {
    if (sectionType === UNKNOWN_SECTION_TYPE) continue;
    if (count > 1) {
      findings.push(
        createFinding(
          "SEC_DUPLICATE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.SECTION,
          `Section type "${sectionType}" appears ${count} times.`,
          { sectionType, details: { count } }
        )
      );
    }
  }

  // Unexpected sections for document type
  const unexpected = getUnexpectedSections(documentType);
  for (const sectionType of unexpected) {
    if (typeCounts[sectionType]) {
      findings.push(
        createFinding(
          "SEC_UNEXPECTED",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.SECTION,
          `Section "${sectionType}" is unexpected for document type "${documentType}".`,
          { sectionType }
        )
      );
    }
  }

  // Per-section checks + ordering
  const knownOrderIndexes = [];
  for (const section of sections) {
    const order = section.order;
    const sectionType = section.sectionType || UNKNOWN_SECTION_TYPE;
    const path = `sections[${order}]`;

    if (sectionType === UNKNOWN_SECTION_TYPE || !isKnownSectionType(sectionType)) {
      findings.push(
        createFinding(
          "SEC_UNKNOWN",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.SECTION,
          `Unknown section "${section.originalTitle || section.normalizedTitle || "untitled"}".`,
          {
            path,
            sectionOrder: order,
            sectionType: UNKNOWN_SECTION_TYPE,
            details: { originalTitle: section.originalTitle }
          }
        )
      );
    }

    if (!String(section.originalContent || "").trim() || section.blockCount === 0) {
      findings.push(
        createFinding(
          "SEC_EMPTY",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.SECTION,
          `Section "${section.normalizedTitle || sectionType}" is empty.`,
          { path, sectionOrder: order, sectionType }
        )
      );
    }

    if (section.confidence === "low" || section.confidence === "none") {
      findings.push(
        createFinding(
          "SEC_LOW_CONFIDENCE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.SECTION,
          `Section "${section.normalizedTitle || sectionType}" has ${section.confidence} confidence.`,
          {
            path,
            sectionOrder: order,
            sectionType,
            details: { confidence: section.confidence }
          }
        )
      );
    }

    // Generator title compatibility
    if (section.generatorTitle != null) {
      const title = String(section.generatorTitle).replace(/\s*\|\s*table\s*$/i, "").trim();
      const known =
        GENERATOR_KNOWN_TITLES.includes(title) ||
        (isKnownSectionType(sectionType) &&
          SECTION_CANONICAL_TITLES[sectionType] &&
          title === SECTION_CANONICAL_TITLES[sectionType]);
      if (!known && sectionType !== UNKNOWN_SECTION_TYPE) {
        findings.push(
          createFinding(
            "SEC_GENERATOR_TITLE",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.GENERATOR,
            `Section generator title "${section.generatorTitle}" may not map to a known Generator title.`,
            { path, sectionOrder: order, sectionType, details: { generatorTitle: section.generatorTitle } }
          )
        );
      }
    } else if (section.originalTitle != null && isKnownSectionType(sectionType)) {
      findings.push(
        createFinding(
          "SEC_GENERATOR_TITLE_MISSING",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.GENERATOR,
          `Known section "${sectionType}" is missing generatorTitle.`,
          { path, sectionOrder: order, sectionType }
        )
      );
    }

    if (isKnownSectionType(sectionType)) {
      knownOrderIndexes.push({ order, sectionType, preferred: preferredOrderIndex(sectionType) });
    }
  }

  // Ordering: known sections should follow preferred relative order
  for (let i = 1; i < knownOrderIndexes.length; i += 1) {
    const prev = knownOrderIndexes[i - 1];
    const curr = knownOrderIndexes[i];
    if (
      prev.preferred !== Number.MAX_SAFE_INTEGER &&
      curr.preferred !== Number.MAX_SAFE_INTEGER &&
      prev.preferred > curr.preferred
    ) {
      findings.push(
        createFinding(
          "SEC_ORDERING",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.ORDERING,
          `Section order problem: "${curr.sectionType}" appears after "${prev.sectionType}" but should precede it.`,
          {
            sectionOrder: curr.order,
            sectionType: curr.sectionType,
            details: { previousSectionType: prev.sectionType, previousOrder: prev.order }
          }
        )
      );
    }
  }

  // Declared order property consistency
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].order != null && sections[i].order !== i) {
      findings.push(
        createFinding(
          "SEC_ORDER_INDEX",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.ORDERING,
          `Section order property (${sections[i].order}) does not match array index (${i}).`,
          { sectionOrder: sections[i].order, path: `sections[${i}]` }
        )
      );
    }
  }

  return findings;
}

module.exports = {
  validateSections
};
