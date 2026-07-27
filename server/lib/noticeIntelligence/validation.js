"use strict";

/**
 * Phase AI-2 — Validation.
 *
 * Reports what is missing or suspicious about a normalized event. Validation is
 * advisory: it flags events for human review and never blocks the Production
 * Workflow.
 */

const { CONFIDENCE_THRESHOLDS, EVENT_TYPES, VALIDATION_CODES, VALIDATION_SEVERITY } = require("./types");
const { collapse } = require("./textUtils");

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} field
 * @param {string} message
 * @returns {object}
 */
function issue(code, severity, field, message) {
  return { code, severity, field, message };
}

/**
 * Validate a normalized event and its supporting intelligence.
 *
 * @param {{
 *   classification?: object,
 *   department?: object,
 *   references?: object,
 *   confidence?: object,
 *   analysis?: object,
 *   headingResult?: object
 * }} input
 * @returns {{
 *   ok: boolean,
 *   issues: Array<object>,
 *   errorCount: number,
 *   warningCount: number,
 *   infoCount: number,
 *   requiresManualReview: boolean,
 *   summary: object
 * }}
 */
function validateNormalizedEvent(input = {}) {
  const classification = input.classification || {};
  const department = input.department || {};
  const references = input.references || {};
  const confidence = input.confidence || {};
  const analysis = input.analysis || {};
  const headingResult = input.headingResult || {};
  const issues = [];

  if (analysis.isEmpty) {
    issues.push(
      issue(
        VALIDATION_CODES.EMPTY_CONTENT,
        VALIDATION_SEVERITY.ERROR,
        "content",
        "The source produced no readable content to analyse."
      )
    );
  }

  const title = collapse(classification.normalizedTitle);
  if (!title) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_TITLE,
        VALIDATION_SEVERITY.ERROR,
        "normalizedTitle",
        "No notice title could be resolved."
      )
    );
  } else if (title.split(/\s+/).length < 3) {
    issues.push(
      issue(
        VALIDATION_CODES.WEAK_TITLE,
        VALIDATION_SEVERITY.WARNING,
        "normalizedTitle",
        `Title "${title}" is too short to identify the notice reliably.`
      )
    );
  }

  if (!department.department) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_DEPARTMENT,
        VALIDATION_SEVERITY.ERROR,
        "sourceDepartment",
        "No department or recruiting body could be identified."
      )
    );
  } else if (!department.isKnownOrganization) {
    issues.push(
      issue(
        VALIDATION_CODES.UNVERIFIED_DEPARTMENT,
        VALIDATION_SEVERITY.WARNING,
        "sourceDepartment",
        `Organization "${department.department}" is not in the known registry; detected text preserved.`
      )
    );
  }

  if (!references.publicationDate) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_PUBLICATION_DATE,
        VALIDATION_SEVERITY.WARNING,
        "publicationDate",
        "No labelled publication date was found in the notice."
      )
    );
  }
  if (!Number(references.dateCount)) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_DATES,
        VALIDATION_SEVERITY.WARNING,
        "dates",
        "No parseable dates were found in the notice."
      )
    );
  }

  for (const referenceIssue of references.issues || []) {
    issues.push(
      issue(
        VALIDATION_CODES.BROKEN_REFERENCE,
        VALIDATION_SEVERITY.WARNING,
        referenceIssue.field,
        `Value "${referenceIssue.value}" failed the ${referenceIssue.reason} check.`
      )
    );
  }
  if (!references.advertisementNumber && !references.referenceNumber) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_REFERENCE,
        VALIDATION_SEVERITY.INFO,
        "referenceNumber",
        "Notice has no advertisement or reference number to key future matching on."
      )
    );
  }

  if (classification.eventType === EVENT_TYPES.UNKNOWN) {
    issues.push(
      issue(
        VALIDATION_CODES.UNKNOWN_CLASSIFICATION,
        VALIDATION_SEVERITY.WARNING,
        "eventType",
        `Event type could not be classified; original wording "${classification.rawEventLabel || "n/a"}" preserved.`
      )
    );
  }
  if (classification.ambiguity && classification.ambiguity.isAmbiguous) {
    issues.push(
      issue(
        VALIDATION_CODES.AMBIGUOUS_CLASSIFICATION,
        VALIDATION_SEVERITY.WARNING,
        "eventType",
        `"${classification.eventType}" and "${classification.ambiguity.runnerUpEventType}" scored within ${classification.ambiguity.margin}.`
      )
    );
  }

  const overallScore = Number(confidence.overallScore);
  if (Number.isFinite(overallScore) && overallScore < CONFIDENCE_THRESHOLDS.MEDIUM) {
    issues.push(
      issue(
        VALIDATION_CODES.LOW_CONFIDENCE,
        VALIDATION_SEVERITY.WARNING,
        "confidence",
        `Overall confidence ${overallScore} is below the ${CONFIDENCE_THRESHOLDS.MEDIUM} review threshold.`
      )
    );
  }

  if (!Number(headingResult.knownHeadingCount) && !analysis.isEmpty) {
    issues.push(
      issue(
        VALIDATION_CODES.NO_HEADINGS_DETECTED,
        VALIDATION_SEVERITY.INFO,
        "headings",
        "No canonical sections were recognised in the notice."
      )
    );
  }

  const errorCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.ERROR).length;
  const warningCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.WARNING).length;
  const infoCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.INFO).length;

  return {
    ok: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
    requiresManualReview: errorCount > 0 || warningCount > 0,
    summary: {
      hasTitle: Boolean(title),
      hasDepartment: Boolean(department.department),
      hasPublicationDate: Boolean(references.publicationDate),
      hasIdentifier: Boolean(references.advertisementNumber || references.referenceNumber),
      isClassified: classification.eventType !== EVENT_TYPES.UNKNOWN,
      overallConfidence: Number.isFinite(overallScore) ? overallScore : null
    }
  };
}

module.exports = {
  validateNormalizedEvent
};
