"use strict";

/**
 * Phase AI-3 — Matching validation.
 *
 * Flags what a reviewer would want to know about a match attempt. Validation is
 * advisory: it never blocks a recommendation and never blocks the Production
 * Workflow. It only tells the truth about how solid the evidence was.
 */

const { round2 } = require("../noticeIntelligence/textUtils");
const { assessTitleAmbiguity } = require("./matchingUtils");
const {
  AMBIGUITY_MARGIN,
  CONFIDENCE_THRESHOLDS,
  MATCH_QUALITY,
  MATCH_THRESHOLDS,
  UPDATE_RELATIONSHIPS,
  VALIDATION_CODES,
  VALIDATION_SEVERITY
} = require("./types");

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
 * Validate a match attempt.
 *
 * @param {{
 *   identity: object,
 *   relationship: object,
 *   search: object,
 *   ranking: object,
 *   plausibility: object|null,
 *   duplicate: object|null,
 *   eventConfidence: number
 * }} input
 * @returns {{
 *   ok: boolean,
 *   issues: Array<object>,
 *   flags: string[],
 *   errorCount: number,
 *   warningCount: number,
 *   infoCount: number,
 *   requiresHumanReview: boolean,
 *   summary: object
 * }}
 */
function validateMatching(input = {}) {
  const identity = input.identity || {};
  const relationship = input.relationship || {};
  const search = input.search || {};
  const ranking = input.ranking || {};
  const plausibility = input.plausibility || null;
  const duplicate = input.duplicate || null;
  const best = ranking.best || null;
  const issues = [];

  // A conflict with a candidate that scored near zero still explains why it
  // scored near zero, so it is reported — but it should not push the whole
  // match attempt towards review, so it is reported as information.
  const conflictSeverity =
    best && best.score >= MATCH_THRESHOLDS.WEAK
      ? VALIDATION_SEVERITY.WARNING
      : VALIDATION_SEVERITY.INFO;

  // --- Repository and candidate coverage ---
  if (search.isEmptyRepository) {
    issues.push(
      issue(
        VALIDATION_CODES.EMPTY_RECRUITMENT_REPOSITORY,
        VALIDATION_SEVERITY.INFO,
        "recruitments",
        "No existing recruitment metadata was supplied, so every event looks new."
      )
    );
  } else if (!(ranking.ranked || []).length) {
    issues.push(
      issue(
        VALIDATION_CODES.NO_CANDIDATES_FOUND,
        VALIDATION_SEVERITY.INFO,
        "candidates",
        `No candidate recruitment was found among ${search.repositorySize} records.`
      )
    );
  }

  // --- Multiple strong matches ---
  const strongMatches = ranking.strongMatches || [];
  if (strongMatches.length > 1) {
    const margin =
      ranking.separation === null || ranking.separation === undefined ? "n/a" : ranking.separation;
    issues.push(
      issue(
        VALIDATION_CODES.MULTIPLE_STRONG_MATCHES,
        VALIDATION_SEVERITY.WARNING,
        "candidates",
        `${strongMatches.length} recruitments matched strongly (${strongMatches
          .map((match) => `${match.recruitmentId}@${match.score}`)
          .join(", ")}); separation ${margin}.`
      )
    );
  } else if (ranking.isAmbiguous) {
    issues.push(
      issue(
        VALIDATION_CODES.MULTIPLE_STRONG_MATCHES,
        VALIDATION_SEVERITY.WARNING,
        "candidates",
        `Top two candidates are within ${ranking.separation} of each other, below the ${AMBIGUITY_MARGIN} ambiguity margin.`
      )
    );
  }

  // --- Missing advertisement number ---
  if (!identity.advertisementNumber) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_ADVERTISEMENT_NUMBER,
        identity.referenceNumber ? VALIDATION_SEVERITY.INFO : VALIDATION_SEVERITY.WARNING,
        "advertisementNumber",
        identity.referenceNumber
          ? "The event carries no advertisement number; matching fell back to the reference number."
          : "The event carries no advertisement or reference number, so matching rests on prose and metadata."
      )
    );
  } else if (best && !best.similarity.identifierMatched && best.score >= MATCH_THRESHOLDS.PROBABLE) {
    issues.push(
      issue(
        VALIDATION_CODES.MISSING_ADVERTISEMENT_NUMBER,
        VALIDATION_SEVERITY.INFO,
        "advertisementNumber",
        `Recruitment ${best.recruitmentId} records no comparable identifier, so the advertisement number could not corroborate the match.`
      )
    );
  }

  // --- Identifier conflict ---
  if (best && best.similarity.conflicts.identifier) {
    const advertisement = best.similarity.factors.find(
      (factor) => factor.factor === "advertisement_number"
    );
    issues.push(
      issue(
        VALIDATION_CODES.IDENTIFIER_CONFLICT,
        conflictSeverity,
        "advertisementNumber",
        `Event identifier "${(advertisement && advertisement.detail.eventValue) || identity.advertisementNumber}" differs from recruitment ${best.recruitmentId}'s "${(advertisement && advertisement.detail.recordValue) || "n/a"}".`
      )
    );
  } else if (best && best.similarity.conflicts.identifierUnrecorded) {
    const unrecorded = best.similarity.factors.find(
      (factor) => factor.detail && factor.detail.crossFieldMismatch
    );
    issues.push(
      issue(
        VALIDATION_CODES.IDENTIFIER_CONFLICT,
        conflictSeverity,
        "advertisementNumber",
        `Event identifier "${unrecorded.detail.eventValue}" is not among the identifiers recorded for recruitment ${best.recruitmentId} (${unrecorded.detail.recordedIdentifiers.join(", ")}).`
      )
    );
  }

  // --- Conflicting departments ---
  if (best && best.similarity.conflicts.department) {
    issues.push(
      issue(
        VALIDATION_CODES.CONFLICTING_DEPARTMENTS,
        conflictSeverity,
        "sourceDepartment",
        `Event body "${identity.board || identity.department || "unknown"}" does not agree with recruitment ${best.recruitmentId}'s "${best.record.board || best.record.department || "unknown"}".`
      )
    );
  }

  // --- Year mismatch on an otherwise matching title ---
  if (best && best.similarity.conflicts.year && best.similarity.title.score >= 0.7) {
    issues.push(
      issue(
        VALIDATION_CODES.YEAR_MISMATCH_ON_MATCHING_TITLE,
        VALIDATION_SEVERITY.WARNING,
        "year",
        `Titles agree (${best.similarity.title.score}) but the event year ${identity.year} differs from recruitment year ${best.record.year}, which usually means a new recruitment cycle.`
      )
    );
  }

  // --- Ambiguous title ---
  const titleAmbiguity = assessTitleAmbiguity(identity.title);
  if (titleAmbiguity.ambiguous) {
    issues.push(
      issue(
        VALIDATION_CODES.AMBIGUOUS_TITLE,
        VALIDATION_SEVERITY.WARNING,
        "normalizedTitle",
        `Title "${identity.title || ""}" cannot identify a recruitment on its own (${titleAmbiguity.reason}).`
      )
    );
  }

  // --- Orphan update ---
  const noUsableMatch = !best || best.score < MATCH_THRESHOLDS.PROBABLE;
  if (relationship.requiresExistingRecruitment && noUsableMatch) {
    issues.push(
      issue(
        VALIDATION_CODES.ORPHAN_UPDATE_EVENT,
        VALIDATION_SEVERITY.WARNING,
        "updateRelationship",
        `A ${relationship.label} notice implies an existing recruitment, but the best candidate scored ${best ? best.score : 0}.`
      )
    );
  }

  // --- Lifecycle plausibility ---
  if (plausibility && plausibility.plausible === false) {
    issues.push(
      issue(
        VALIDATION_CODES.IMPLAUSIBLE_LIFECYCLE_TRANSITION,
        conflictSeverity,
        "updateRelationship",
        plausibility.reason
      )
    );
  }

  // --- Unresolved relationship ---
  if (relationship.relationship === UPDATE_RELATIONSHIPS.UNKNOWN) {
    issues.push(
      issue(
        VALIDATION_CODES.UNRESOLVED_UPDATE_RELATIONSHIP,
        VALIDATION_SEVERITY.WARNING,
        "updateRelationship",
        `Event type "${relationship.eventType}" could not be mapped to a known update relationship.`
      )
    );
  }
  if (relationship.relationship === UPDATE_RELATIONSHIPS.NONE) {
    issues.push(
      issue(
        VALIDATION_CODES.NON_RECRUITMENT_EVENT,
        VALIDATION_SEVERITY.INFO,
        "updateRelationship",
        `Event type "${relationship.eventType}" is not part of a recruitment lifecycle.`
      )
    );
  }

  // --- Duplicate ---
  if (duplicate && duplicate.isDuplicate) {
    issues.push(
      issue(
        VALIDATION_CODES.DUPLICATE_DOCUMENT_FINGERPRINT,
        VALIDATION_SEVERITY.INFO,
        "fingerprint",
        duplicate.reason
      )
    );
  }

  // --- Low confidence ---
  const eventConfidence = Number(input.eventConfidence);
  if (Number.isFinite(eventConfidence) && eventConfidence > 0 && eventConfidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
    issues.push(
      issue(
        VALIDATION_CODES.LOW_CONFIDENCE,
        VALIDATION_SEVERITY.WARNING,
        "confidence",
        `The upstream normalized event scored ${eventConfidence}, below the ${CONFIDENCE_THRESHOLDS.MEDIUM} review threshold.`
      )
    );
  }
  if (best && best.level === MATCH_QUALITY.WEAK) {
    issues.push(
      issue(
        VALIDATION_CODES.LOW_CONFIDENCE,
        VALIDATION_SEVERITY.INFO,
        "similarity",
        `Best candidate ${best.recruitmentId} only reached ${best.score}, a weak match.`
      )
    );
  }

  const errorCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.ERROR).length;
  const warningCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.WARNING).length;
  const infoCount = issues.filter((item) => item.severity === VALIDATION_SEVERITY.INFO).length;
  const flags = Array.from(new Set(issues.map((item) => item.code)));

  return {
    ok: errorCount === 0,
    issues,
    flags,
    errorCount,
    warningCount,
    infoCount,
    requiresHumanReview: warningCount > 0 || errorCount > 0,
    summary: {
      candidateCount: (ranking.ranked || []).length,
      strongMatchCount: strongMatches.length,
      bestScore: best ? round2(best.score) : 0,
      bestLevel: best ? best.level : MATCH_QUALITY.NONE,
      hasIdentifier: Boolean(identity.advertisementNumber || identity.referenceNumber),
      identifierMatched: Boolean(best && best.similarity.identifierMatched),
      titleAmbiguous: titleAmbiguity.ambiguous,
      relationship: relationship.relationship || UPDATE_RELATIONSHIPS.UNKNOWN
    }
  };
}

module.exports = {
  validateMatching
};
