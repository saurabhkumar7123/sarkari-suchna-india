"use strict";

/**
 * PWP Phase 2 — Deterministic page / recruitment matching.
 * Reuses CIP Stage 3D identity key helpers. Never uses fuzzy AI matching.
 */

const {
  identityKey,
  identifierKey,
  collapseWhitespace
} = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const { CONFIDENCE_LEVELS } = require("./resolutionTypes");

const MATCH_EVIDENCE = Object.freeze({
  ADVERTISEMENT_NUMBER: "advertisement_number",
  NOTIFICATION_NUMBER: "notification_number",
  ORGANIZATION: "organization",
  RECRUITMENT_NAME: "recruitment_name",
  POST_NAME: "post_name",
  DEPARTMENT: "department",
  RECRUITMENT_KEY: "recruitment_key",
  RECRUITMENT_ID: "recruitment_id",
  PAGE_ID: "page_id",
  OFFICIAL_IDENTIFIER: "official_identifier"
});

function pickString(...values) {
  for (const value of values) {
    const text = collapseWhitespace(value);
    if (text) return text;
  }
  return null;
}

function extractIdentityFromCorrelation(correlation) {
  const identity =
    (correlation && correlation.recruitmentIdentity) ||
    (correlation && correlation.relationshipGraph && correlation.relationshipGraph.root) ||
    {};
  return {
    recruitmentKey: identity.recruitmentKey || null,
    organization: identity.organization || null,
    advertisementNumber: identity.advertisementNumber || null,
    notificationNumber:
      identity.notificationNumber || identity.advertisementNumber || null,
    recruitmentName: identity.recruitmentName || null,
    postName: identity.postName || null,
    department: identity.department || null,
    examName: identity.examName || null,
    confidence: identity.confidence || CONFIDENCE_LEVELS.NONE,
    hasNotification: Boolean(identity.hasNotification)
  };
}

function extractIdentityFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  return {
    recruitmentId: record.recruitmentId || record.id || null,
    pageId: record.pageId || record.id || null,
    recruitmentKey: record.recruitmentKey || null,
    organization: pickString(record.organization, record.org, record.department),
    advertisementNumber: pickString(
      record.advertisementNumber,
      record.advertisementNo,
      record.advtNo,
      record.advt_no
    ),
    notificationNumber: pickString(
      record.notificationNumber,
      record.notificationNo,
      record.advertisementNumber,
      record.advertisementNo
    ),
    recruitmentName: pickString(
      record.recruitmentName,
      record.title,
      record.name,
      record.examName
    ),
    postName: pickString(record.postName, record.post),
    department: pickString(record.department, record.dept),
    examName: pickString(record.examName, record.exam),
    officialIdentifiers: Array.isArray(record.officialIdentifiers)
      ? record.officialIdentifiers.slice()
      : [],
    sections: Array.isArray(record.sections)
      ? record.sections.slice()
      : Array.isArray(record.pageSections)
        ? record.pageSections.slice()
        : [],
    exists: record.exists !== false
  };
}

function strongIdentifierMatch(incoming, candidate) {
  const evidence = [];
  const advIn = identifierKey(incoming.advertisementNumber);
  const advCand = identifierKey(candidate.advertisementNumber);
  if (advIn && advCand && advIn === advCand) {
    evidence.push(MATCH_EVIDENCE.ADVERTISEMENT_NUMBER);
  }

  const notifIn = identifierKey(incoming.notificationNumber);
  const notifCand = identifierKey(candidate.notificationNumber);
  if (notifIn && notifCand && notifIn === notifCand) {
    evidence.push(MATCH_EVIDENCE.NOTIFICATION_NUMBER);
  }

  const keyIn = identityKey(incoming.recruitmentKey);
  const keyCand = identityKey(candidate.recruitmentKey);
  if (keyIn && keyCand && keyIn === keyCand) {
    evidence.push(MATCH_EVIDENCE.RECRUITMENT_KEY);
  }

  if (Array.isArray(candidate.officialIdentifiers)) {
    for (const id of candidate.officialIdentifiers) {
      const candId = identifierKey(id);
      if (!candId) continue;
      if (
        candId === advIn ||
        candId === notifIn ||
        candId === identifierKey(incoming.recruitmentKey)
      ) {
        evidence.push(MATCH_EVIDENCE.OFFICIAL_IDENTIFIER);
        break;
      }
    }
  }

  return evidence;
}

function softIdentityEvidence(incoming, candidate) {
  const evidence = [];
  if (
    identityKey(incoming.organization) &&
    identityKey(incoming.organization) === identityKey(candidate.organization)
  ) {
    evidence.push(MATCH_EVIDENCE.ORGANIZATION);
  }
  if (
    identityKey(incoming.department) &&
    identityKey(incoming.department) === identityKey(candidate.department)
  ) {
    evidence.push(MATCH_EVIDENCE.DEPARTMENT);
  }
  if (
    identityKey(incoming.recruitmentName) &&
    identityKey(incoming.recruitmentName) === identityKey(candidate.recruitmentName)
  ) {
    evidence.push(MATCH_EVIDENCE.RECRUITMENT_NAME);
  }
  if (
    identityKey(incoming.postName) &&
    identityKey(incoming.postName) === identityKey(candidate.postName)
  ) {
    evidence.push(MATCH_EVIDENCE.POST_NAME);
  }
  return evidence;
}

/**
 * Deterministically match incoming identity against an existing recruitment record.
 * Strong official identifiers alone are sufficient. Soft fields require org+name.
 */
function matchExistingRecruitment(incomingIdentity, existingRecruitment) {
  const candidate = extractIdentityFromRecord(existingRecruitment);
  if (!candidate) {
    return {
      matched: false,
      confidence: CONFIDENCE_LEVELS.NONE,
      evidence: [],
      recruitmentId: null,
      reason: "no_existing_recruitment"
    };
  }

  if (existingRecruitment.recruitmentId || existingRecruitment.id) {
    // Explicit caller-provided recruitment record is authoritative for routing.
    // Conflicting advertisement numbers are reported as evidence but do not
    // override an explicit existingRecruitment linkage (never guess a different id).
    const strong = strongIdentifierMatch(incomingIdentity, candidate);
    const soft = softIdentityEvidence(incomingIdentity, candidate);
    const evidence = [...strong, ...soft, MATCH_EVIDENCE.RECRUITMENT_ID];

    const conflict =
      identifierKey(incomingIdentity.advertisementNumber) &&
      identifierKey(candidate.advertisementNumber) &&
      identifierKey(incomingIdentity.advertisementNumber) !==
        identifierKey(candidate.advertisementNumber);

    if (conflict && existingRecruitment.requireStrictIdentityMatch === true) {
      return {
        matched: false,
        confidence: CONFIDENCE_LEVELS.LOW,
        evidence,
        recruitmentId: candidate.recruitmentId,
        reason: "identifier_conflict",
        ambiguous: true,
        record: candidate
      };
    }

    let confidence = CONFIDENCE_LEVELS.MEDIUM;
    let reason = "explicit_existing_recruitment";
    if (strong.length > 0) {
      confidence = CONFIDENCE_LEVELS.HIGH;
      reason = "strong_identifier_match";
    } else if (
      soft.includes(MATCH_EVIDENCE.ORGANIZATION) &&
      (soft.includes(MATCH_EVIDENCE.RECRUITMENT_NAME) ||
        soft.includes(MATCH_EVIDENCE.POST_NAME))
    ) {
      reason = "organization_and_name_match";
    }

    return {
      matched: true,
      confidence,
      evidence: conflict ? [...evidence, "advertisement_number_mismatch_noted"] : evidence,
      recruitmentId: candidate.recruitmentId,
      reason,
      record: candidate,
      identifierMismatchNoted: Boolean(conflict)
    };
  }

  const strong = strongIdentifierMatch(incomingIdentity, candidate);
  const soft = softIdentityEvidence(incomingIdentity, candidate);
  const evidence = [...strong, ...soft];

  if (strong.length > 0) {
    return {
      matched: true,
      confidence: CONFIDENCE_LEVELS.HIGH,
      evidence,
      recruitmentId: candidate.recruitmentId,
      reason: "strong_identifier_match",
      record: candidate
    };
  }

  if (
    soft.includes(MATCH_EVIDENCE.ORGANIZATION) &&
    (soft.includes(MATCH_EVIDENCE.RECRUITMENT_NAME) || soft.includes(MATCH_EVIDENCE.POST_NAME))
  ) {
    return {
      matched: true,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      evidence,
      recruitmentId: candidate.recruitmentId,
      reason: "organization_and_name_match",
      record: candidate
    };
  }

  return {
    matched: false,
    confidence: evidence.length ? CONFIDENCE_LEVELS.LOW : CONFIDENCE_LEVELS.NONE,
    evidence,
    recruitmentId: null,
    reason: "no_deterministic_match",
    ambiguous: evidence.length > 0,
    record: candidate
  };
}

function matchExistingPage(incomingIdentity, existingPage, recruitmentMatch) {
  const page = extractIdentityFromRecord(existingPage);
  if (!page) {
    return {
      matched: false,
      confidence: CONFIDENCE_LEVELS.NONE,
      evidence: [],
      pageId: null,
      reason: "no_existing_page",
      sections: []
    };
  }

  if (!recruitmentMatch || !recruitmentMatch.matched) {
    return {
      matched: false,
      confidence: CONFIDENCE_LEVELS.NONE,
      evidence: [],
      pageId: page.pageId,
      reason: "recruitment_not_matched",
      sections: page.sections
    };
  }

  const evidence = [MATCH_EVIDENCE.PAGE_ID, ...recruitmentMatch.evidence];
  return {
    matched: true,
    confidence: recruitmentMatch.confidence,
    evidence,
    pageId: page.pageId,
    reason: "page_linked_to_matched_recruitment",
    sections: page.sections,
    record: page
  };
}

module.exports = {
  MATCH_EVIDENCE,
  extractIdentityFromCorrelation,
  extractIdentityFromRecord,
  matchExistingRecruitment,
  matchExistingPage,
  strongIdentifierMatch,
  softIdentityEvidence
};
