"use strict";

/**
 * CIP Stage 3E — per-document extraction/structure validators.
 * Advisory only. Never modifies documents. No network link checks.
 */

const {
  SEVERITIES,
  VALIDATION_CATEGORIES,
  QUALITY_DIMENSIONS,
  createFinding
} = require("./extractionQualityTypes");
const {
  TITLE_METADATA_FIELDS,
  CORE_RECRUITMENT_SECTIONS,
  PREFERRED_RECRUITMENT_SECTIONS,
  CONTENT_BLOCK_TYPES,
  READINESS_THRESHOLDS
} = require("./extractionQualityRules");
const { asArray, hasText } = require("./extractionQualityUtils");

function findTitle(metadata) {
  for (const field of TITLE_METADATA_FIELDS) {
    if (hasText(metadata[field])) return { field, value: String(metadata[field]).trim() };
  }
  return null;
}

function validateMetadata(view) {
  const findings = [];
  const metadata = view.metadata || {};
  const documentId = view.documentId;

  if (!view.isNormalized) {
    findings.push(
      createFinding({
        rule: "META_NOT_NORMALIZED",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.METADATA,
        dimension: QUALITY_DIMENSIONS.METADATA_COMPLETENESS,
        message: "Document is not a Stage 3B/3C normalized extraction; metadata completeness is limited.",
        documentId
      })
    );
  }

  const title = findTitle(metadata) || (hasText(view.title) ? { field: "title", value: view.title } : null);
  if (!title) {
    findings.push(
      createFinding({
        rule: "META_TITLE_MISSING",
        severity: SEVERITIES.ERROR,
        category: VALIDATION_CATEGORIES.METADATA,
        dimension: QUALITY_DIMENSIONS.METADATA_COMPLETENESS,
        message: "Required metadata field missing: title.",
        documentId,
        details: { field: "title" }
      })
    );
  }

  if (!hasText(view.sourceUrl) && !hasText(metadata.sourceUrl)) {
    findings.push(
      createFinding({
        rule: "META_SOURCE_URL_MISSING",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.METADATA,
        dimension: QUALITY_DIMENSIONS.METADATA_COMPLETENESS,
        message: "Source URL metadata is missing.",
        documentId,
        details: { field: "sourceUrl" }
      })
    );
  }

  if (view.kind === "pdf" && metadata.pageCount != null && Number(metadata.pageCount) <= 0) {
    findings.push(
      createFinding({
        rule: "META_PAGE_COUNT_INVALID",
        severity: SEVERITIES.ERROR,
        category: VALIDATION_CATEGORIES.METADATA,
        dimension: QUALITY_DIMENSIONS.METADATA_COMPLETENESS,
        message: "PDF metadata pageCount is invalid.",
        documentId,
        details: { field: "pageCount", value: metadata.pageCount }
      })
    );
  }

  return findings;
}

function validateStructure(view) {
  const findings = [];
  const documentId = view.documentId;
  const blocks = asArray(view.contentBlocks);
  const sections = asArray(view.sections);

  if (!blocks.length) {
    findings.push(
      createFinding({
        rule: "STRUCT_NO_CONTENT_BLOCKS",
        severity: SEVERITIES.ERROR,
        category: VALIDATION_CATEGORIES.STRUCTURE,
        dimension: QUALITY_DIMENSIONS.STRUCTURE_COMPLETENESS,
        message: "Document has no content blocks.",
        documentId
      })
    );
  }

  if (!sections.length) {
    findings.push(
      createFinding({
        rule: "STRUCT_NO_SECTIONS",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.STRUCTURE,
        dimension: QUALITY_DIMENSIONS.STRUCTURE_COMPLETENESS,
        message: "Document has no heading sections.",
        documentId
      })
    );
  }

  if (!view.structuralTree || typeof view.structuralTree !== "object") {
    findings.push(
      createFinding({
        rule: "STRUCT_TREE_MISSING",
        severity: view.isNormalized ? SEVERITIES.WARNING : SEVERITIES.INFO,
        category: VALIDATION_CATEGORIES.STRUCTURE,
        dimension: QUALITY_DIMENSIONS.STRUCTURE_COMPLETENESS,
        message: "Structural tree is missing.",
        documentId
      })
    );
  }

  // Empty sections: heading with no following content blocks before next heading.
  const ordered = blocks
    .slice()
    .sort((a, b) => (a.order != null ? a.order : 0) - (b.order != null ? b.order : 0));
  for (let i = 0; i < ordered.length; i += 1) {
    const block = ordered[i];
    if (!block || (block.type !== "heading" && block.type !== "section_title")) continue;
    let hasContent = false;
    for (let j = i + 1; j < ordered.length; j += 1) {
      const next = ordered[j];
      if (next.type === "heading" || next.type === "section_title") break;
      if (CONTENT_BLOCK_TYPES.includes(next.type) && hasText(next.text)) {
        hasContent = true;
        break;
      }
      if (next.type === "table" && (asArray(next.rows).length || hasText(next.text))) {
        hasContent = true;
        break;
      }
      if (next.type === "list" && (asArray(next.items).length || hasText(next.text))) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) {
      const section = sections.find((s) => s.headingBlockId === block.id);
      findings.push(
        createFinding({
          rule: "STRUCT_EMPTY_SECTION",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.SECTION,
          dimension: QUALITY_DIMENSIONS.STRUCTURE_COMPLETENESS,
          message: `Empty section under heading "${block.text || block.id}".`,
          documentId,
          sectionId: section ? section.sectionId : null,
          blockId: block.id || null
        })
      );
    }
  }

  // Duplicate structural blocks (same type + text + nearby order signature).
  const signatures = new Map();
  for (const block of blocks) {
    if (!block) continue;
    const sig = `${block.type}|${String(block.text || "").trim().toLowerCase()}`;
    if (!hasText(block.text)) continue;
    if (!signatures.has(sig)) signatures.set(sig, []);
    signatures.get(sig).push(block);
  }
  for (const [, group] of signatures) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i += 1) {
      findings.push(
        createFinding({
          rule: "STRUCT_DUPLICATE_BLOCK",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.STRUCTURE,
          dimension: QUALITY_DIMENSIONS.DOCUMENT_CONSISTENCY,
          message: `Duplicate structural block detected (${group[i].type}).`,
          documentId,
          blockId: group[i].id || null,
          details: { firstBlockId: group[0].id || null, type: group[i].type }
        })
      );
    }
  }

  return findings;
}

function validateSectionCoverage(view) {
  const findings = [];
  const documentId = view.documentId;
  const sections = asArray(view.sections);
  if (!sections.length) return findings;

  const knownTypes = new Set(sections.filter((s) => s.isKnownSection).map((s) => s.sectionType));
  const unknownCount = sections.filter((s) => !s.isKnownSection).length;
  const unknownRatio = sections.length ? unknownCount / sections.length : 0;

  for (const required of CORE_RECRUITMENT_SECTIONS) {
    if (!knownTypes.has(required)) {
      findings.push(
        createFinding({
          rule: "SEC_REQUIRED_MISSING",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.SECTION,
          dimension: QUALITY_DIMENSIONS.SECTION_COVERAGE,
          message: `Preferred core section missing: ${required}.`,
          documentId,
          details: { sectionType: required }
        })
      );
    }
  }

  for (const preferred of PREFERRED_RECRUITMENT_SECTIONS) {
    if (!knownTypes.has(preferred) && !CORE_RECRUITMENT_SECTIONS.includes(preferred)) {
      findings.push(
        createFinding({
          rule: "SEC_PREFERRED_MISSING",
          severity: SEVERITIES.INFO,
          category: VALIDATION_CATEGORIES.SECTION,
          dimension: QUALITY_DIMENSIONS.SECTION_COVERAGE,
          message: `Preferred recruitment section not detected: ${preferred}.`,
          documentId,
          details: { sectionType: preferred }
        })
      );
    }
  }

  if (unknownRatio > READINESS_THRESHOLDS.maxUnknownSectionRatio) {
    findings.push(
      createFinding({
        rule: "SEC_UNKNOWN_RATIO_HIGH",
        severity:
          unknownRatio >= READINESS_THRESHOLDS.maxUnknownSectionRatioBlocked
            ? SEVERITIES.ERROR
            : SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.SECTION,
        dimension: QUALITY_DIMENSIONS.SECTION_COVERAGE,
        message: `Unknown section ratio is high (${Math.round(unknownRatio * 100)}%).`,
        documentId,
        details: { unknownCount, totalSections: sections.length, unknownRatio }
      })
    );
  } else if (unknownCount > 0) {
    findings.push(
      createFinding({
        rule: "SEC_UNKNOWN_PRESENT",
        severity: SEVERITIES.INFO,
        category: VALIDATION_CATEGORIES.SECTION,
        dimension: QUALITY_DIMENSIONS.SECTION_COVERAGE,
        message: `${unknownCount} unknown section(s) present.`,
        documentId,
        details: { unknownCount, totalSections: sections.length, unknownRatio }
      })
    );
  }

  return findings;
}

function validateHeadingHierarchy(view) {
  const findings = [];
  const documentId = view.documentId;
  const headings = asArray(view.contentBlocks).filter(
    (block) => block && (block.type === "heading" || block.type === "section_title")
  );

  let previousLevel = null;
  for (const heading of headings) {
    const level = heading.level != null ? Number(heading.level) : null;
    if (level == null || Number.isNaN(level)) {
      findings.push(
        createFinding({
          rule: "HIER_LEVEL_MISSING",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.HIERARCHY,
          dimension: QUALITY_DIMENSIONS.HEADING_HIERARCHY,
          message: "Heading is missing a numeric level.",
          documentId,
          blockId: heading.id || null,
          sectionId: null
        })
      );
      continue;
    }
    if (previousLevel != null && level > previousLevel + 1) {
      findings.push(
        createFinding({
          rule: "HIER_SKIPPED_LEVEL",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.HIERARCHY,
          dimension: QUALITY_DIMENSIONS.HEADING_HIERARCHY,
          message: `Broken heading hierarchy: skipped from h${previousLevel} to h${level}.`,
          documentId,
          blockId: heading.id || null,
          details: { previousLevel, level }
        })
      );
    }
    previousLevel = level;
  }

  // normalizedLevel vs actualLevel inconsistency across sibling jumps is advisory via tree
  const sections = asArray(view.sections);
  for (const section of sections) {
    if (
      section.actualLevel != null &&
      section.normalizedLevel != null &&
      section.actualLevel < section.normalizedLevel
    ) {
      findings.push(
        createFinding({
          rule: "HIER_NORMALIZATION_ANOMALY",
          severity: SEVERITIES.INFO,
          category: VALIDATION_CATEGORIES.HIERARCHY,
          dimension: QUALITY_DIMENSIONS.HEADING_HIERARCHY,
          message: "Heading normalization produced a higher normalized level than source level.",
          documentId,
          sectionId: section.sectionId,
          blockId: section.headingBlockId,
          details: {
            actualLevel: section.actualLevel,
            normalizedLevel: section.normalizedLevel
          }
        })
      );
    }
  }

  return findings;
}

function validateReadingOrder(view) {
  const findings = [];
  const documentId = view.documentId;
  const blocks = asArray(view.contentBlocks);
  if (blocks.length < 2) return findings;

  let previousOrder = null;
  const seenOrders = new Set();
  for (const block of blocks) {
    if (block.order == null) {
      findings.push(
        createFinding({
          rule: "ORDER_MISSING",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.READING_ORDER,
          dimension: QUALITY_DIMENSIONS.READING_ORDER,
          message: "Content block is missing reading order.",
          documentId,
          blockId: block.id || null
        })
      );
      continue;
    }
    if (seenOrders.has(block.order)) {
      findings.push(
        createFinding({
          rule: "ORDER_DUPLICATE",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.READING_ORDER,
          dimension: QUALITY_DIMENSIONS.READING_ORDER,
          message: `Duplicate reading order value: ${block.order}.`,
          documentId,
          blockId: block.id || null,
          details: { order: block.order }
        })
      );
    }
    seenOrders.add(block.order);
    if (previousOrder != null && block.order < previousOrder) {
      findings.push(
        createFinding({
          rule: "ORDER_OUT_OF_SEQUENCE",
          severity: SEVERITIES.ERROR,
          category: VALIDATION_CATEGORIES.READING_ORDER,
          dimension: QUALITY_DIMENSIONS.READING_ORDER,
          message: "Content blocks are not in ascending reading order.",
          documentId,
          blockId: block.id || null,
          details: { previousOrder, order: block.order }
        })
      );
    }
    previousOrder = block.order;
  }

  return findings;
}

function validateTables(view) {
  const findings = [];
  const documentId = view.documentId;
  const tables = asArray(view.contentBlocks).filter((block) => block && block.type === "table");

  for (const table of tables) {
    const rows = asArray(table.rows);
    const headers = asArray(table.headers || table.header || table.columns);
    if (!rows.length && !hasText(table.text)) {
      findings.push(
        createFinding({
          rule: "TABLE_EMPTY",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.TABLE,
          dimension: QUALITY_DIMENSIONS.TABLE_INTEGRITY,
          message: "Table block has no rows or text.",
          documentId,
          blockId: table.id || null
        })
      );
      continue;
    }
    if (rows.length) {
      const widths = rows.map((row) => (Array.isArray(row) ? row.length : asArray(row.cells).length));
      const first = widths[0];
      if (widths.some((width) => width !== first)) {
        findings.push(
          createFinding({
            rule: "TABLE_IRREGULAR_ROWS",
            severity: SEVERITIES.WARNING,
            category: VALIDATION_CATEGORIES.TABLE,
            dimension: QUALITY_DIMENSIONS.TABLE_INTEGRITY,
            message: "Table has irregular row widths.",
            documentId,
            blockId: table.id || null,
            details: { widths }
          })
        );
      }
      if (headers.length && first && headers.length !== first) {
        findings.push(
          createFinding({
            rule: "TABLE_HEADER_MISMATCH",
            severity: SEVERITIES.INFO,
            category: VALIDATION_CATEGORIES.TABLE,
            dimension: QUALITY_DIMENSIONS.TABLE_INTEGRITY,
            message: "Table header column count does not match body row width.",
            documentId,
            blockId: table.id || null,
            details: { headerCount: headers.length, rowWidth: first }
          })
        );
      }
    }
  }

  return findings;
}

function isStructurallyBrokenUrl(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  if (value === "#" || value.toLowerCase() === "javascript:void(0)") return true;
  if (/^\s*$/u.test(value)) return true;
  // Structure-only: reject obviously malformed schemes / empty paths after scheme
  if (/^[a-z][a-z\d+.-]*:\s*$/iu.test(value)) return true;
  if (/\s/u.test(value) && !value.startsWith("mailto:")) return true;
  return false;
}

function validateLinks(view) {
  const findings = [];
  const documentId = view.documentId;
  const resources = asArray(view.resourceList);
  const linkBlocks = asArray(view.contentBlocks).filter(
    (block) => block && (block.type === "link" || block.href || block.url)
  );

  for (const resource of resources) {
    const href = resource.href || resource.url || resource.sourceUrl || null;
    if (
      resource.resourceType === "link" ||
      resource.resourceType === "hyperlink" ||
      resource.resourceType === "pdf" ||
      resource.resourceType === "download" ||
      resource.resourceType === "url"
    ) {
      if (isStructurallyBrokenUrl(href)) {
        findings.push(
          createFinding({
            rule: "LINK_STRUCTURALLY_INVALID",
            severity: SEVERITIES.WARNING,
            category: VALIDATION_CATEGORIES.LINK,
            dimension: QUALITY_DIMENSIONS.LINK_INTEGRITY,
            message: "Resource link is structurally invalid (no network validation performed).",
            documentId,
            blockId: resource.blockId || null,
            details: { resourceId: resource.id || null, href }
          })
        );
      }
    }
  }

  for (const block of linkBlocks) {
    const href = block.href || block.url || null;
    if (href != null && isStructurallyBrokenUrl(href)) {
      findings.push(
        createFinding({
          rule: "LINK_BLOCK_INVALID",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.LINK,
          dimension: QUALITY_DIMENSIONS.LINK_INTEGRITY,
          message: "Link block href is structurally invalid (no network validation performed).",
          documentId,
          blockId: block.id || null,
          details: { href }
        })
      );
    }
  }

  return findings;
}

function validateResources(view) {
  const findings = [];
  const documentId = view.documentId;
  const resources = asArray(view.resourceList);
  const inventory = view.resourceInventory || {};

  if (view.isNormalized && !resources.length) {
    findings.push(
      createFinding({
        rule: "RES_INVENTORY_EMPTY",
        severity: SEVERITIES.INFO,
        category: VALIDATION_CATEGORIES.RESOURCE,
        dimension: QUALITY_DIMENSIONS.RESOURCE_INVENTORY,
        message: "Resource inventory is empty.",
        documentId
      })
    );
  }

  const inventoryArrays = [
    "pdfLinks",
    "downloads",
    "images",
    "attachments",
    "forms",
    "notificationDownloads",
    "resultDownloads",
    "admitCardDownloads",
    "answerKeyDownloads"
  ];
  let inventoried = 0;
  for (const key of inventoryArrays) {
    inventoried += asArray(inventory[key]).length;
  }

  if (resources.length && inventoried === 0 && Object.keys(inventory).length === 0) {
    findings.push(
      createFinding({
        rule: "RES_INVENTORY_MISSING",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.RESOURCE,
        dimension: QUALITY_DIMENSIONS.RESOURCE_INVENTORY,
        message: "Resources exist but resourceInventory is missing or empty.",
        documentId,
        details: { resourceCount: resources.length }
      })
    );
  }

  // Missing resources flagged by extraction summary duplicate/hidden pressure
  const summary = view.extractionSummary || {};
  if (summary.duplicateNodeCount > 0) {
    findings.push(
      createFinding({
        rule: "RES_DUPLICATE_NODES",
        severity: SEVERITIES.INFO,
        category: VALIDATION_CATEGORIES.EXTRACTION,
        dimension: QUALITY_DIMENSIONS.RESOURCE_INVENTORY,
        message: `Extraction summary reports ${summary.duplicateNodeCount} duplicate node(s).`,
        documentId,
        details: { duplicateNodeCount: summary.duplicateNodeCount }
      })
    );
  }

  return findings;
}

function validateDocumentConsistency(view) {
  const findings = [];
  const documentId = view.documentId;
  const title = findTitle(view.metadata || {}) || (hasText(view.title) ? { value: view.title } : null);
  const h1 = asArray(view.contentBlocks).find(
    (block) => block && block.type === "heading" && Number(block.level) === 1
  );

  if (title && h1 && hasText(h1.text)) {
    const a = String(title.value).trim().toLowerCase();
    const b = String(h1.text).trim().toLowerCase();
    if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
      findings.push(
        createFinding({
          rule: "CONS_TITLE_HEADING_MISMATCH",
          severity: SEVERITIES.INFO,
          category: VALIDATION_CATEGORIES.CONSISTENCY,
          dimension: QUALITY_DIMENSIONS.DOCUMENT_CONSISTENCY,
          message: "Document title and primary heading differ.",
          documentId,
          blockId: h1.id || null,
          details: { title: title.value, heading: h1.text }
        })
      );
    }
  }

  for (const warning of asArray(view.warnings)) {
    findings.push(
      createFinding({
        rule: "EXTRACT_WARNING",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.EXTRACTION,
        dimension: QUALITY_DIMENSIONS.WARNINGS,
        message: String(warning),
        documentId
      })
    );
  }

  return findings;
}

function validateTraceability(view) {
  const findings = [];
  const documentId = view.documentId;
  if (!view.trace || view.trace.inputIndex == null) {
    findings.push(
      createFinding({
        rule: "TRACE_MISSING",
        severity: SEVERITIES.ERROR,
        category: VALIDATION_CATEGORIES.TRACEABILITY,
        dimension: QUALITY_DIMENSIONS.DOCUMENT_CONSISTENCY,
        message: "Document traceability record is incomplete.",
        documentId
      })
    );
  }
  return findings;
}

/**
 * Run all per-document validators.
 * @param {object} view
 * @returns {object[]}
 */
function validateDocument(view) {
  return [
    ...validateMetadata(view),
    ...validateStructure(view),
    ...validateSectionCoverage(view),
    ...validateHeadingHierarchy(view),
    ...validateReadingOrder(view),
    ...validateTables(view),
    ...validateLinks(view),
    ...validateResources(view),
    ...validateDocumentConsistency(view),
    ...validateTraceability(view)
  ];
}

module.exports = {
  validateDocument,
  validateMetadata,
  validateStructure,
  validateSectionCoverage,
  validateHeadingHierarchy,
  validateReadingOrder,
  validateTables,
  validateLinks,
  validateResources,
  validateDocumentConsistency,
  validateTraceability,
  isStructurallyBrokenUrl
};
