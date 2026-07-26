"use strict";

/**
 * CIP Stage 3E — deterministic input adapter.
 *
 * Accepts Normalized HTML (3B), Normalized PDF (3C), Canonical Recruitment
 * Correlation (3D), single/multiple documents, or unknown descriptors.
 * Never mutates inputs. Never calls AI/OCR/network.
 */

const { INPUT_KINDS } = require("./extractionQualityTypes");
const { KNOWN_FORMAT_IDS } = require("./extractionQualityRules");
const { asArray, hasText, safeString } = require("./extractionQualityUtils");
const { matchSectionTitle, buildHeadingKey } = require("../structureIntelligence/sectionRules");
const { UNKNOWN_SECTION_TYPE } = require("../structureIntelligence/structureTypes");

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNormalizedHtmlDocument(value) {
  return (
    isPlainObject(value) &&
    (value.formatId === KNOWN_FORMAT_IDS.html ||
      value.stageId === "CIP_3B" ||
      value.engineId === "CIP_HTML_EXTRACTION_ENGINE")
  );
}

function isNormalizedPdfDocument(value) {
  return (
    isPlainObject(value) &&
    (value.formatId === KNOWN_FORMAT_IDS.pdf ||
      value.stageId === "CIP_3C" ||
      value.engineId === "CIP_PDF_EXTRACTION_ENGINE")
  );
}

function isRecruitmentCorrelation(value) {
  return (
    isPlainObject(value) &&
    (value.formatId === KNOWN_FORMAT_IDS.correlation ||
      value.stageId === "CIP_3D" ||
      value.engineId === "CIP_MULTI_SOURCE_CORRELATION_ENGINE")
  );
}

function resolveDocumentTitle(document) {
  const metadata = (document && document.metadata) || {};
  if (hasText(metadata.pageTitle)) return String(metadata.pageTitle).trim();
  if (hasText(metadata.title)) return String(metadata.title).trim();
  if (hasText(document && document.title)) return String(document.title).trim();
  return null;
}

function collectHeadingBlocks(document) {
  const blocks = asArray(document && document.contentBlocks);
  return blocks.filter(
    (block) =>
      block &&
      (block.type === "heading" || block.type === "section_title") &&
      hasText(block.text)
  );
}

function classifyHeading(text) {
  const key = buildHeadingKey(text);
  const matches = matchSectionTitle(key);
  if (!matches.length) {
    return {
      sectionType: UNKNOWN_SECTION_TYPE,
      isKnown: false,
      confidence: "none",
      matchedPattern: null
    };
  }
  const primary = matches[0];
  return {
    sectionType: primary.sectionType,
    isKnown: primary.sectionType !== UNKNOWN_SECTION_TYPE,
    confidence: primary.confidence,
    matchedPattern: primary.matchedPattern
  };
}

function buildSectionsFromDocument(document, documentId) {
  const headings = collectHeadingBlocks(document);
  const treeSections = asArray(document && document.structuralTree && document.structuralTree.sections);

  const sections = headings.map((heading, index) => {
    const classification = classifyHeading(heading.text);
    const treeMatch = treeSections.find((section) => section.headingBlockId === heading.id) || null;
    return {
      sectionId: (treeMatch && treeMatch.id) || `section-${documentId}-${index + 1}`,
      documentId,
      headingBlockId: heading.id || null,
      headingText: String(heading.text).trim(),
      actualLevel: heading.level != null ? heading.level : heading.actualHeadingLevel || null,
      normalizedLevel:
        heading.normalizedLevel != null
          ? heading.normalizedLevel
          : (treeMatch && treeMatch.normalizedHeadingLevel) || null,
      order: heading.order != null ? heading.order : index,
      sectionType: classification.sectionType,
      isKnownSection: classification.isKnown,
      confidence: classification.confidence,
      matchedPattern: classification.matchedPattern,
      blockIds: treeMatch ? asArray(treeMatch.blocks).map((b) => b.blockId).filter(Boolean) : []
    };
  });

  return sections;
}

function buildDocumentView(entry, index) {
  let document = entry;
  let hints = {};

  if (isPlainObject(entry) && entry.document && isPlainObject(entry.document)) {
    document = entry.document;
    hints = entry;
  }

  const isHtml = isNormalizedHtmlDocument(document);
  const isPdf = isNormalizedPdfDocument(document);
  const isNormalized = isHtml || isPdf;

  const documentId =
    (isPlainObject(hints) && hints.documentId) ||
    (isPlainObject(document) && document.documentId) ||
    `doc-${index + 1}`;

  const kind = isHtml ? "html" : isPdf ? "pdf" : "unknown";
  const title =
    resolveDocumentTitle(isNormalized ? document : hints) ||
    (hasText(hints.title) ? String(hints.title).trim() : null);

  const contentBlocks = isNormalized ? asArray(document.contentBlocks) : [];
  const resourceList = isNormalized
    ? asArray(document.resourceList || document.resources)
    : asArray(hints.resourceList);
  const structuralTree = isNormalized ? document.structuralTree || null : null;
  const metadata = isNormalized
    ? document.metadata || {}
    : isPlainObject(hints.metadata)
      ? hints.metadata
      : {};
  const warnings = isNormalized
    ? asArray(document.warnings)
    : asArray(hints.warnings);
  const extractionSummary = isNormalized ? document.extractionSummary || {} : {};
  const pages = isNormalized ? asArray(document.pages) : [];
  const sections = isNormalized
    ? buildSectionsFromDocument(document, documentId)
    : asArray(hints.sections).map((section, sectionIndex) => ({
        sectionId: `section-${documentId}-${sectionIndex + 1}`,
        documentId,
        headingBlockId: null,
        headingText: typeof section === "string" ? section : safeString(section.headingText || section.title),
        actualLevel: null,
        normalizedLevel: null,
        order: sectionIndex,
        sectionType: UNKNOWN_SECTION_TYPE,
        isKnownSection: false,
        confidence: "none",
        matchedPattern: null,
        blockIds: []
      }));

  const sourceUrl =
    (metadata && metadata.sourceUrl) ||
    hints.sourceUrl ||
    hints.url ||
    null;

  return {
    documentId,
    inputIndex: index,
    kind,
    isNormalized,
    formatId: (document && document.formatId) || null,
    stageId: (document && document.stageId) || null,
    engineId: (document && document.engineId) || null,
    title,
    sourceUrl: hasText(sourceUrl) ? String(sourceUrl).trim() : null,
    metadata,
    contentBlocks,
    resourceList,
    resourceInventory: (document && document.resourceInventory) || {},
    structuralTree,
    sections,
    pages,
    warnings,
    extractionSummary,
    embeddedDocuments: asArray(document && document.embeddedDocuments),
    navigationReferences: asArray(document && document.navigationReferences),
    fingerprint: document && document.fingerprint ? document.fingerprint : null,
    raw: isNormalized ? document : hints,
    trace: {
      inputIndex: index,
      documentId,
      formatId: (document && document.formatId) || null,
      engineId: (document && document.engineId) || null,
      stageId: (document && document.stageId) || null,
      sourceUrl: hasText(sourceUrl) ? String(sourceUrl).trim() : null
    }
  };
}

/**
 * Normalize any supported Stage 3E input into a uniform assessment bundle.
 *
 * @param {*} input
 * @returns {{
 *   inputKind: string,
 *   documents: Array,
 *   correlation: object|null,
 *   warnings: string[]
 * }}
 */
function adaptInput(input) {
  const warnings = [];

  if (input == null) {
    return {
      inputKind: INPUT_KINDS.UNKNOWN,
      documents: [],
      correlation: null,
      warnings: ["No input provided for quality assessment."]
    };
  }

  if (isRecruitmentCorrelation(input)) {
    const correlatedDocs = asArray(input.documents).map((doc, index) => {
      // Correlation public docs are views, not full 3B/3C payloads.
      // Prefer original nested document when present; otherwise wrap the view.
      if (doc && doc.rawDocument) return buildDocumentView(doc.rawDocument, index);
      if (doc && (isNormalizedHtmlDocument(doc) || isNormalizedPdfDocument(doc))) {
        return buildDocumentView(doc, index);
      }
      return buildDocumentView(
        {
          documentId: doc.documentId || `doc-${index + 1}`,
          title: doc.title,
          sourceUrl: doc.sourceUrl,
          metadata: doc.metadata || {},
          sections: asArray(doc.sections),
          warnings: asArray(doc.warnings),
          kind: doc.kind,
          formatId: doc.formatId,
          stageId: doc.sourceStageId || doc.stageId,
          engineId: doc.sourceEngineId || doc.engineId
        },
        index
      );
    });

    return {
      inputKind: INPUT_KINDS.RECRUITMENT_CORRELATION,
      documents: correlatedDocs,
      correlation: input,
      warnings
    };
  }

  if (Array.isArray(input)) {
    const documents = input.map((entry, index) => buildDocumentView(entry, index));
    let inputKind = INPUT_KINDS.MULTIPLE_DOCUMENTS;
    if (documents.length === 1) {
      const only = documents[0];
      inputKind =
        only.kind === "html"
          ? INPUT_KINDS.NORMALIZED_HTML
          : only.kind === "pdf"
            ? INPUT_KINDS.NORMALIZED_PDF
            : INPUT_KINDS.UNKNOWN;
    } else if (documents.length === 0) {
      inputKind = INPUT_KINDS.UNKNOWN;
      warnings.push("Empty document list provided.");
    }
    return { inputKind, documents, correlation: null, warnings };
  }

  if (isPlainObject(input) && Array.isArray(input.documents)) {
    return adaptInput(input.documents);
  }

  if (isNormalizedHtmlDocument(input)) {
    return {
      inputKind: INPUT_KINDS.NORMALIZED_HTML,
      documents: [buildDocumentView(input, 0)],
      correlation: null,
      warnings
    };
  }

  if (isNormalizedPdfDocument(input)) {
    return {
      inputKind: INPUT_KINDS.NORMALIZED_PDF,
      documents: [buildDocumentView(input, 0)],
      correlation: null,
      warnings
    };
  }

  if (isPlainObject(input) || typeof input === "string") {
    warnings.push("Input is not a Stage 3B/3C/3D artifact; treated as unknown document.");
    return {
      inputKind: INPUT_KINDS.UNKNOWN,
      documents: [
        buildDocumentView(
          typeof input === "string" ? { title: null, text: input } : input,
          0
        )
      ],
      correlation: null,
      warnings
    };
  }

  warnings.push("Unsupported input type for extraction quality assessment.");
  return {
    inputKind: INPUT_KINDS.UNKNOWN,
    documents: [],
    correlation: null,
    warnings
  };
}

module.exports = {
  adaptInput,
  buildDocumentView,
  isNormalizedHtmlDocument,
  isNormalizedPdfDocument,
  isRecruitmentCorrelation,
  classifyHeading,
  resolveDocumentTitle
};
