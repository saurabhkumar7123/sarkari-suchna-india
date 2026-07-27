"use strict";

/**
 * Phase AI-2 — Confidence engine.
 *
 * Produces a per-field confidence report. Every score carries the reasons that
 * moved it, so a reviewer can see why the system trusted (or distrusted) a
 * field instead of receiving a bare number.
 */

const { CONFIDENCE_LEVELS, CONFIDENCE_THRESHOLDS, EVENT_TYPES } = require("./types");
const { clamp, collapse, round2 } = require("./textUtils");

/** Contribution of each field to the overall classification confidence. */
const FIELD_WEIGHTS = Object.freeze({
  title: 0.2,
  department: 0.2,
  eventType: 0.35,
  dates: 0.1,
  referenceNumber: 0.15
});

/**
 * @param {number} score
 * @returns {string}
 */
function scoreToLevel(score) {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return CONFIDENCE_LEVELS.HIGH;
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return CONFIDENCE_LEVELS.MEDIUM;
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.VERY_LOW;
}

/**
 * Small builder so every field reports score, level and explanation the same way.
 * @param {string} field
 * @param {number} start
 * @returns {object}
 */
function createScorer(field, start = 0) {
  const reasons = [];
  let score = start;
  return {
    add(delta, code, detail) {
      score += delta;
      reasons.push({ code, impact: round2(delta), detail });
      return this;
    },
    note(code, detail) {
      reasons.push({ code, impact: 0, detail });
      return this;
    },
    build() {
      const finalScore = round2(clamp(score, 0, 1));
      return {
        field,
        score: finalScore,
        level: scoreToLevel(finalScore),
        reasons
      };
    }
  };
}

/**
 * @param {object} classification
 * @param {object} analysis
 * @returns {object}
 */
function scoreTitle(classification = {}, analysis = {}) {
  const scorer = createScorer("title");
  const title = collapse(classification.normalizedTitle);

  if (!title) {
    scorer.add(0, "TITLE_MISSING", "No usable title was found in the notice.");
    return scorer.build();
  }

  scorer.add(0.4, "TITLE_PRESENT", `Title resolved from "${classification.titleSource}".`);

  const wordCount = title.split(/\s+/).length;
  if (wordCount >= 4) {
    scorer.add(0.2, "TITLE_DESCRIPTIVE", `Title has ${wordCount} words, enough to be descriptive.`);
  } else {
    scorer.add(0.05, "TITLE_SHORT", `Title has only ${wordCount} word(s).`);
  }

  if (Number(classification.titleWeight) >= 0.85) {
    scorer.add(0.2, "TITLE_AUTHORITATIVE_SOURCE", "Title came from an authoritative source field.");
  } else {
    scorer.add(0.08, "TITLE_INFERRED_SOURCE", "Title was inferred from page content.");
  }

  if (/\b(20\d{2})\b/.test(title)) {
    scorer.add(0.1, "TITLE_HAS_YEAR", "Title contains a recruitment year.");
  }
  if (analysis.language && analysis.language !== "unknown") {
    scorer.add(0.05, "TITLE_LANGUAGE_KNOWN", `Content language detected as "${analysis.language}".`);
  }
  if (title.length > 180) {
    scorer.add(-0.1, "TITLE_TOO_LONG", "Title is unusually long and may include body text.");
  }

  return scorer.build();
}

/**
 * @param {object} department
 * @returns {object}
 */
function scoreDepartment(department = {}) {
  const scorer = createScorer("department");

  if (!department.department) {
    scorer.add(0, "DEPARTMENT_MISSING", "No department or recruiting body could be identified.");
    return scorer.build();
  }

  if (department.isKnownOrganization) {
    scorer.add(
      0.65,
      "DEPARTMENT_REGISTRY_MATCH",
      `Matched registry organization ${department.departmentCode}.`
    );
  } else {
    scorer.add(
      0.35,
      "DEPARTMENT_TEXT_ONLY",
      "Organization is not in the registry; detected text preserved as-is."
    );
  }

  const sources = Array.isArray(department.matchedSources) ? department.matchedSources : [];
  if (sources.includes("url")) {
    scorer.add(0.15, "DEPARTMENT_URL_MATCH", "Official domain confirms the organization.");
  }
  if (sources.includes("title")) {
    scorer.add(0.12, "DEPARTMENT_TITLE_MATCH", "Organization name appears in the notice title.");
  }
  if (sources.length >= 2) {
    scorer.add(
      0.1,
      "DEPARTMENT_MULTI_SOURCE",
      `Organization confirmed by ${sources.length} independent surfaces.`
    );
  }
  if (sources.length === 1 && sources[0] === "body") {
    scorer.add(-0.08, "DEPARTMENT_BODY_ONLY", "Organization only appeared deep in the body text.");
  }

  return scorer.build();
}

/**
 * @param {object} classification
 * @param {object} recruitmentCandidate
 * @returns {object}
 */
function scoreEventType(classification = {}, recruitmentCandidate = {}) {
  const scorer = createScorer("eventType");
  const eventType = classification.eventType || EVENT_TYPES.UNKNOWN;

  if (eventType === EVENT_TYPES.UNKNOWN) {
    scorer.add(
      0.1,
      "EVENT_TYPE_UNKNOWN",
      "No known event signal matched; the original wording was preserved instead."
    );
    return scorer.build();
  }

  const detectionScore = clamp(Number(classification.classificationScore) || 0, 0, 1);
  scorer.add(
    round2(detectionScore * 0.7),
    "EVENT_TYPE_SIGNAL_STRENGTH",
    `Detection evidence scored ${round2(detectionScore)}.`
  );

  const evidence = Array.isArray(classification.evidence) ? classification.evidence : [];
  const titleEvidence = evidence.find((item) => item.zone === "title");
  if (titleEvidence) {
    scorer.add(
      0.15,
      "EVENT_TYPE_TITLE_EVIDENCE",
      `Title contains the decisive phrase "${titleEvidence.matchedText}".`
    );
  }
  const zones = new Set(evidence.map((item) => item.zone));
  if (zones.size >= 3) {
    scorer.add(
      0.1,
      "EVENT_TYPE_MULTI_ZONE",
      `Supporting evidence found in ${zones.size} different parts of the page.`
    );
  }

  if (classification.ambiguity && classification.ambiguity.isAmbiguous) {
    scorer.add(
      -0.15,
      "EVENT_TYPE_AMBIGUOUS",
      `Runner-up "${classification.ambiguity.runnerUpEventType}" scored within ${classification.ambiguity.margin} of the winner.`
    );
  }

  if (eventType === EVENT_TYPES.NOTIFICATION) {
    scorer.add(
      -0.1,
      "EVENT_TYPE_GENERIC",
      "Only the generic notification signal matched; a more specific type may exist."
    );
  }

  if (classification.eventSubType) {
    scorer.add(
      0.05,
      "EVENT_SUB_TYPE_DETECTED",
      `Sub type "${classification.eventSubType}" adds lifecycle detail.`
    );
  }

  if (recruitmentCandidate.isRecruitmentCandidate) {
    scorer.add(
      0.05,
      "RECRUITMENT_CONTEXT",
      "Recruitment context supports the classification."
    );
  }

  return scorer.build();
}

/**
 * @param {object} references
 * @returns {object}
 */
function scoreDates(references = {}) {
  const scorer = createScorer("dates");
  const dateCount = Number(references.dateCount) || 0;

  if (references.publicationDate) {
    scorer.add(
      0.5,
      "PUBLICATION_DATE_FOUND",
      `Publication date parsed as ${references.publicationDate}.`
    );
  } else {
    scorer.add(0, "PUBLICATION_DATE_MISSING", "No labelled publication date was found.");
  }

  if (dateCount >= 3) {
    scorer.add(0.35, "DATE_SCHEDULE_FOUND", `${dateCount} labelled dates parsed from the notice.`);
  } else if (dateCount > 0) {
    scorer.add(0.2, "SOME_DATES_FOUND", `${dateCount} labelled date(s) parsed.`);
  } else {
    scorer.add(0, "NO_DATES_FOUND", "No parseable dates were present.");
  }

  if (references.year) {
    scorer.add(0.15, "YEAR_RESOLVED", `Recruitment year resolved as ${references.year}.`);
  }

  const dateIssue = (references.issues || []).find((issue) => issue.field === "publicationDate");
  if (dateIssue) {
    scorer.add(-0.2, "DATE_IMPLAUSIBLE", `Publication date rejected: ${dateIssue.reason}.`);
  }

  return scorer.build();
}

/**
 * @param {object} references
 * @returns {object}
 */
function scoreReferenceNumber(references = {}) {
  const scorer = createScorer("referenceNumber");
  const issues = Array.isArray(references.issues) ? references.issues : [];
  const broken = new Set(issues.map((issue) => issue.field));

  if (references.advertisementNumber) {
    scorer.add(
      0.6,
      "ADVERTISEMENT_NUMBER_FOUND",
      `Advertisement number "${references.advertisementNumber}" extracted.`
    );
  }
  if (references.referenceNumber) {
    scorer.add(
      0.3,
      "REFERENCE_NUMBER_FOUND",
      `Reference number "${references.referenceNumber}" extracted.`
    );
  }
  if (!references.advertisementNumber && !references.referenceNumber) {
    scorer.add(
      0,
      "NO_IDENTIFIER_FOUND",
      "Notice carries no advertisement, notification or file number."
    );
    return scorer.build();
  }

  if (broken.has("advertisementNumber")) {
    scorer.add(-0.3, "ADVERTISEMENT_NUMBER_MALFORMED", "Advertisement number looks truncated or invalid.");
  }
  if (broken.has("referenceNumber")) {
    scorer.add(-0.15, "REFERENCE_NUMBER_MALFORMED", "Reference number looks truncated or invalid.");
  }
  if (references.advertisementNumber && references.referenceNumber) {
    scorer.add(0.1, "IDENTIFIERS_CORROBORATE", "Both an advertisement and a reference number were found.");
  }

  return scorer.build();
}

/**
 * Build the full confidence report for a classified notice.
 *
 * @param {{
 *   classification: object,
 *   department?: object,
 *   references?: object,
 *   analysis?: object,
 *   recruitmentCandidate?: object,
 *   headingResult?: object
 * }} input
 * @returns {object}
 */
function buildConfidenceReport(input = {}) {
  const fields = {
    title: scoreTitle(input.classification, input.analysis),
    department: scoreDepartment(input.department),
    eventType: scoreEventType(input.classification, input.recruitmentCandidate),
    dates: scoreDates(input.references),
    referenceNumber: scoreReferenceNumber(input.references)
  };

  const weightedTotal = Object.entries(FIELD_WEIGHTS).reduce(
    (total, [field, weight]) => total + fields[field].score * weight,
    0
  );

  const overallScorer = createScorer("overall", weightedTotal);
  overallScorer.note(
    "WEIGHTED_FIELD_AVERAGE",
    `Weighted average of title, department, event type, dates and reference scores: ${round2(weightedTotal)}.`
  );

  const analysis = input.analysis || {};
  const headingResult = input.headingResult || {};

  if (Number(headingResult.knownHeadingCount) >= 3) {
    overallScorer.add(
      0.05,
      "STRUCTURED_DOCUMENT",
      `${headingResult.knownHeadingCount} canonical sections were recognised, indicating a well-structured notice.`
    );
  }
  if (analysis.isEmpty) {
    overallScorer.add(-0.3, "EMPTY_CONTENT", "The source produced no readable content.");
  } else if (Number(analysis.characterCount || 0) < 200) {
    overallScorer.add(
      -0.1,
      "THIN_CONTENT",
      `Only ${analysis.characterCount} characters of content were available.`
    );
  }
  if ((input.classification || {}).eventType === EVENT_TYPES.UNKNOWN) {
    overallScorer.add(-0.1, "UNCLASSIFIED_EVENT", "Event type is unknown, so the event needs manual review.");
  }

  const overall = overallScorer.build();

  return {
    fields,
    overall,
    overallScore: overall.score,
    overallLevel: overall.level,
    weights: FIELD_WEIGHTS
  };
}

module.exports = {
  FIELD_WEIGHTS,
  scoreToLevel,
  scoreTitle,
  scoreDepartment,
  scoreEventType,
  scoreDates,
  scoreReferenceNumber,
  buildConfidenceReport
};
