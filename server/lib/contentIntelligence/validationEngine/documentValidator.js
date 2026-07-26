"use strict";

/**
 * CIP Stage 1E — document-level validation.
 * Validates Stage 1A classification signals on the structured document.
 */

const {
  isKnownDocumentType,
  UNKNOWN_DOCUMENT_TYPE,
  CONFIDENCE_LEVELS
} = require("../documentClassification/documentTypes");
const { SEVERITIES, VALIDATION_CATEGORIES, createFinding } = require("./validationTypes");

/**
 * @param {object} structuredDocument — Stage 1C+1D output (read-only)
 * @returns {Array<object>} findings
 */
function validateDocument(structuredDocument) {
  const findings = [];
  const classification = structuredDocument && structuredDocument.classification;
  const documentType =
    (structuredDocument && structuredDocument.documentType) ||
    (classification && classification.documentType) ||
    UNKNOWN_DOCUMENT_TYPE;

  if (!structuredDocument || typeof structuredDocument !== "object") {
    findings.push(
      createFinding(
        "DOC_MISSING_STRUCTURE",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.DOCUMENT,
        "No structured document provided for validation."
      )
    );
    return findings;
  }

  if (!isKnownDocumentType(documentType)) {
    findings.push(
      createFinding(
        "DOC_UNSUPPORTED_TYPE",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.DOCUMENT,
        `Unsupported document type "${documentType}".`,
        { details: { documentType } }
      )
    );
  } else if (documentType === UNKNOWN_DOCUMENT_TYPE) {
    findings.push(
      createFinding(
        "DOC_UNKNOWN_TYPE",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.DOCUMENT,
        "Document type is unknown; publish readiness blocked until classified.",
        { details: { documentType } }
      )
    );
  }

  if (!classification) {
    findings.push(
      createFinding(
        "DOC_MISSING_CLASSIFICATION",
        SEVERITIES.WARNING,
        VALIDATION_CATEGORIES.DOCUMENT,
        "Stage 1A classification result is missing from the structured document."
      )
    );
  } else {
    const confidence = classification.confidence || "none";
    if (!CONFIDENCE_LEVELS.includes(confidence) || confidence === "none") {
      findings.push(
        createFinding(
          "DOC_NO_CONFIDENCE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.DOCUMENT,
          "Document classification has no usable confidence.",
          { details: { confidence } }
        )
      );
    } else if (confidence === "low") {
      findings.push(
        createFinding(
          "DOC_LOW_CONFIDENCE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.DOCUMENT,
          "Document classification confidence is low.",
          { details: { confidence, documentType } }
        )
      );
    }

    if (Array.isArray(classification.warnings) && classification.warnings.length) {
      for (const warning of classification.warnings) {
        findings.push(
          createFinding(
            "DOC_CLASSIFICATION_WARNING",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.DOCUMENT,
            String(warning)
          )
        );
      }
    }

    const matched = classification.matchedIndicators || classification.matchedRules || [];
    if (Array.isArray(matched) && matched.length >= 2) {
      const types = new Set(
        matched
          .map((m) => m.documentType || m.type)
          .filter(Boolean)
      );
      if (types.size >= 2) {
        findings.push(
          createFinding(
            "DOC_CONFLICTING_SIGNALS",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.CONSISTENCY,
            "Conflicting document-type signals detected in classification indicators.",
            { details: { types: [...types].sort() } }
          )
        );
      }
    }

    if (
      classification.documentType &&
      structuredDocument.documentType &&
      classification.documentType !== structuredDocument.documentType
    ) {
      findings.push(
        createFinding(
          "DOC_TYPE_MISMATCH",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.CONSISTENCY,
          "Structured documentType does not match Stage 1A classification.documentType.",
          {
            details: {
              documentType: structuredDocument.documentType,
              classificationType: classification.documentType
            }
          }
        )
      );
    }
  }

  if (!Array.isArray(structuredDocument.sections) || structuredDocument.sections.length === 0) {
    findings.push(
      createFinding(
        "DOC_NO_SECTIONS",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.DOCUMENT,
        "Structured document has no sections."
      )
    );
  }

  if (Array.isArray(structuredDocument.warnings)) {
    for (const warning of structuredDocument.warnings) {
      findings.push(
        createFinding(
          "DOC_STRUCTURE_WARNING",
          SEVERITIES.INFO,
          VALIDATION_CATEGORIES.DOCUMENT,
          String(warning)
        )
      );
    }
  }

  return findings;
}

module.exports = {
  validateDocument
};
