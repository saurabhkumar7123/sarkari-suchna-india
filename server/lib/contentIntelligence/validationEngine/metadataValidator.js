"use strict";

/**
 * CIP Stage 1E — metadata validation.
 * Validates Stage 1B metadata on the structured document; never modifies it.
 */

const {
  SOURCE_TYPES,
  DOCUMENT_LANGUAGES
} = require("../metadataIntelligence/metadataFields");
const { isUrlLike } = require("../../../../generator/lib/parseLinkLineParts");
const { SEVERITIES, VALIDATION_CATEGORIES, createFinding } = require("./validationTypes");
const {
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  DATE_ORDER_PAIRS,
  ISO_DATE_RE,
  getRequiredMetadata
} = require("./validationRules");

function resolveMetadataBundle(structuredDocument) {
  const extensions = (structuredDocument && structuredDocument.extensions) || {};
  const metadataResult = extensions.metadataResult || null;
  const normalized =
    (structuredDocument && structuredDocument.metadata) ||
    (metadataResult && metadataResult.normalizedMetadata) ||
    null;
  const confidence = (metadataResult && metadataResult.confidence) || null;
  const raw = (metadataResult && metadataResult.metadata) || null;
  const warnings = (metadataResult && metadataResult.warnings) || [];
  return { normalized, confidence, raw, warnings, metadataResult };
}

function isPresent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") {
    return Object.values(value).some((v) => isPresent(v));
  }
  return true;
}

/**
 * @param {object} structuredDocument
 * @returns {Array<object>}
 */
function validateMetadata(structuredDocument) {
  const findings = [];
  const documentType =
    (structuredDocument && structuredDocument.documentType) ||
    (structuredDocument &&
      structuredDocument.classification &&
      structuredDocument.classification.documentType) ||
    "unknown";

  const { normalized, confidence, raw, warnings } = resolveMetadataBundle(structuredDocument);

  if (!normalized) {
    findings.push(
      createFinding(
        "META_MISSING_BUNDLE",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.METADATA,
        "Normalized metadata is missing from the structured document."
      )
    );
    return findings;
  }

  const required = getRequiredMetadata(documentType);
  for (const field of required) {
    if (!isPresent(normalized[field])) {
      findings.push(
        createFinding(
          "META_REQUIRED_MISSING",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.METADATA,
          `Required metadata field "${field}" is missing.`,
          { field }
        )
      );
    }
  }

  // Duplicate: same non-null value assigned to multiple organization-like fields
  // or identical date strings across different date keys.
  const orgFields = ["organization", "department", "recruitmentBoard"];
  const orgValues = Object.create(null);
  for (const field of orgFields) {
    const value = normalized[field];
    if (!isPresent(value)) continue;
    const key = String(value).trim().toLowerCase();
    if (orgValues[key] && orgValues[key] !== field) {
      findings.push(
        createFinding(
          "META_DUPLICATE_VALUE",
          SEVERITIES.INFO,
          VALIDATION_CATEGORIES.METADATA,
          `Metadata fields "${orgValues[key]}" and "${field}" share the same value.`,
          { field, details: { otherField: orgValues[key], value } }
        )
      );
    } else {
      orgValues[key] = field;
    }
  }

  const dates = normalized.importantDates || {};
  const dateValueMap = Object.create(null);
  for (const dateField of IMPORTANT_DATE_FIELDS) {
    const value = dates[dateField];
    if (!isPresent(value)) continue;
    const key = String(value).trim();
    if (dateValueMap[key] && dateValueMap[key] !== dateField) {
      findings.push(
        createFinding(
          "META_DUPLICATE_DATE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.METADATA,
          `Date fields "${dateValueMap[key]}" and "${dateField}" share the same value "${key}".`,
          { field: "importantDates", details: { dateField, otherField: dateValueMap[key] } }
        )
      );
    } else {
      dateValueMap[key] = dateField;
    }
  }

  // Invalid / unnormalized values
  for (const field of METADATA_FIELDS) {
    if (field === "importantDates") continue;
    const value = normalized[field];
    if (!isPresent(value)) {
      findings.push(
        createFinding(
          "META_FIELD_EMPTY",
          SEVERITIES.INFO,
          VALIDATION_CATEGORIES.COMPLETENESS,
          `Metadata field "${field}" is empty.`,
          { field }
        )
      );
      continue;
    }

    if (field === "sourceType" && !SOURCE_TYPES.includes(value)) {
      findings.push(
        createFinding(
          "META_INVALID_SOURCE_TYPE",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.METADATA,
          `Invalid sourceType "${value}".`,
          { field }
        )
      );
    }
    if (field === "documentLanguage" && !DOCUMENT_LANGUAGES.includes(value)) {
      findings.push(
        createFinding(
          "META_INVALID_LANGUAGE",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.METADATA,
          `Invalid documentLanguage "${value}".`,
          { field }
        )
      );
    }
    if ((field === "officialWebsite" || field === "notificationUrl") && !isUrlLike(value)) {
      findings.push(
        createFinding(
          "META_INVALID_URL",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.METADATA,
          `Metadata field "${field}" is not a valid URL-like value.`,
          { field, details: { value } }
        )
      );
    }
  }

  for (const dateField of IMPORTANT_DATE_FIELDS) {
    const value = dates[dateField];
    if (!isPresent(value)) continue;
    if (!ISO_DATE_RE.test(String(value))) {
      findings.push(
        createFinding(
          "META_INVALID_DATE",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.METADATA,
          `importantDates.${dateField} is not a normalized ISO date.`,
          { field: "importantDates", details: { dateField, value } }
        )
      );
    }
  }

  // Date chronological consistency
  for (const [earlier, later] of DATE_ORDER_PAIRS) {
    const a = dates[earlier];
    const b = dates[later];
    if (!ISO_DATE_RE.test(String(a || "")) || !ISO_DATE_RE.test(String(b || ""))) continue;
    if (String(a) > String(b)) {
      findings.push(
        createFinding(
          "META_DATE_ORDER",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.CONSISTENCY,
          `Date consistency: ${earlier} (${a}) is after ${later} (${b}).`,
          { field: "importantDates", details: { earlier, later, a, b } }
        )
      );
    }
  }

  // Conflicting: raw vs normalized disagreement for scalar strings
  if (raw) {
    for (const field of ["title", "organization", "advertisementNumber", "postName"]) {
      const rawValue = raw[field];
      const normValue = normalized[field];
      if (!isPresent(rawValue) || !isPresent(normValue)) continue;
      // Only flag if normalization emptied a previously non-empty incompatible type
      if (typeof rawValue === "string" && typeof normValue === "string") {
        const rawKey = rawValue.trim().toLowerCase();
        const normKey = normValue.trim().toLowerCase();
        if (rawKey && normKey && rawKey !== normKey && !normKey.includes(rawKey) && !rawKey.includes(normKey)) {
          findings.push(
            createFinding(
              "META_CONFLICTING_NORMALIZATION",
              SEVERITIES.WARNING,
              VALIDATION_CATEGORIES.CONSISTENCY,
              `Raw and normalized metadata for "${field}" differ substantially.`,
              { field, details: { rawValue, normalizedValue: normValue } }
            )
          );
        }
      }
    }
  }

  // Low-confidence required fields
  if (confidence) {
    for (const field of required) {
      const conf = confidence[field];
      if (conf === "low" || conf === "none") {
        findings.push(
          createFinding(
            "META_LOW_CONFIDENCE",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.METADATA,
            `Required metadata field "${field}" has ${conf} confidence.`,
            { field, details: { confidence: conf } }
          )
        );
      }
    }
  }

  // Detected type consistency with document
  if (
    isPresent(normalized.detectedDocumentType) &&
    structuredDocument.documentType &&
    normalized.detectedDocumentType !== structuredDocument.documentType &&
    normalized.detectedDocumentType !== "unknown"
  ) {
    findings.push(
      createFinding(
        "META_TYPE_CONFLICT",
        SEVERITIES.WARNING,
        VALIDATION_CATEGORIES.CONSISTENCY,
        "Metadata detectedDocumentType conflicts with structured documentType.",
        {
          field: "detectedDocumentType",
          details: {
            detectedDocumentType: normalized.detectedDocumentType,
            documentType: structuredDocument.documentType
          }
        }
      )
    );
  }

  for (const warning of warnings) {
    findings.push(
      createFinding(
        "META_STAGE1B_WARNING",
        SEVERITIES.INFO,
        VALIDATION_CATEGORIES.METADATA,
        String(warning)
      )
    );
  }

  return findings;
}

module.exports = {
  validateMetadata,
  resolveMetadataBundle,
  isPresent
};
