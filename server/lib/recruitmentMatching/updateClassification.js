"use strict";

/**
 * Phase AI-3 — Update classification.
 *
 * Decides what kind of update an event carries towards a recruitment
 * (Notification, Apply Online, Correction, Extension, Admit Card, Exam Date,
 * Exam City, Answer Key, Result, Final Result, DV, Joining), whether that
 * update needs an existing recruitment at all, and whether it is plausible for
 * the recruitment it was matched to.
 */

const { collapse, round2, toText } = require("../noticeIntelligence/textUtils");
const { EVENT_TYPES } = require("../noticeIntelligence/types");
const { toMatchKey } = require("./matchingUtils");
const {
  ANYTIME_RELATIONSHIPS,
  DOWNSTREAM_RELATIONSHIPS,
  EVENT_TYPE_TO_RELATIONSHIP,
  RELATIONSHIP_ORDER,
  SUB_TYPE_TO_RELATIONSHIP,
  UPDATE_RELATIONSHIP_LABELS,
  UPDATE_RELATIONSHIPS
} = require("./types");

/**
 * Bilingual title patterns, used only when the AI-2 event type is unknown or
 * generic. Ordered most specific first.
 */
const TITLE_RELATIONSHIP_PATTERNS = Object.freeze([
  {
    relationship: UPDATE_RELATIONSHIPS.FINAL_RESULT,
    patterns: [/\bfinal\s+result\b/i, /अंतिम\s+(परिणाम|चयन)/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.RESULT,
    patterns: [/\bresult\b/i, /\bmerit\s+list\b/i, /परिणाम/, /चयन\s*सूची/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.ANSWER_KEY,
    patterns: [/\banswer\s+key\b/i, /उत्तर\s*(कुंजी|माला)/, /\bobjection\b/i]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.ADMIT_CARD,
    patterns: [/\badmit\s+card\b/i, /\bhall\s+ticket\b/i, /\be-?admit\b/i, /प्रवेश\s*पत्र/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.EXAM_CITY,
    patterns: [/\bexam\s+city\b/i, /\bcity\s+intimation\b/i, /परीक्षा\s*(शहर|नगर|केंद्र)/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.EXAM_DATE,
    patterns: [/\bexam(ination)?\s+(date|schedule)\b/i, /परीक्षा\s*(तिथि|कार्यक्रम)/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.EXTENSION,
    patterns: [
      /\b(date\s+)?extension\b/i,
      /\blast\s+date\s+extended\b/i,
      /(तिथि|अवधि)\s*(विस्तार|बढ़ाई|बढ़ा)/
    ]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.CORRECTION,
    patterns: [/\bcorrigend/i, /\bcorrection\b/i, /\baddendum\b/i, /शुद्धि\s*पत्र/, /संशोधन/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.DV,
    patterns: [
      /\bdocument\s+verification\b/i,
      /\bDV\s+schedule\b/,
      /\bcounsell?ing\b/i,
      /दस्तावेज\s*सत्यापन/
    ]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.JOINING,
    patterns: [/\bjoining\b/i, /\bappointment\s+letter\b/i, /नियुक्ति\s*पत्र/, /कार्यभार/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.APPLY_ONLINE,
    patterns: [/\bapply\s+online\b/i, /\bonline\s+(application|form)\b/i, /ऑनलाइन\s*आवेदन/]
  },
  {
    relationship: UPDATE_RELATIONSHIPS.NOTIFICATION,
    patterns: [
      /\b(recruitment|vacancy)\s+(notification|advertisement)\b/i,
      /\badvertisement\s+no/i,
      /भर्ती\s*(विज्ञापन|अधिसूचना)/,
      /रिक्ति\s*अधिसूचना/
    ]
  }
]);

/**
 * Event types generic enough that a sub-type may override the primary mapping.
 *
 * Result pages are deliberately excluded: a result almost always mentions that
 * document verification will follow, and letting that mention override the
 * mapping would file every result as a DV schedule.
 */
const SUB_TYPE_OVERRIDABLE_TYPES = Object.freeze([
  EVENT_TYPES.RECRUITMENT_UPDATE,
  EVENT_TYPES.NOTIFICATION,
  EVENT_TYPES.EXAM_DATE,
  EVENT_TYPES.UNKNOWN
]);

/**
 * @param {string} relationship
 * @returns {object}
 */
function describeRelationship(relationship) {
  const value = relationship || UPDATE_RELATIONSHIPS.UNKNOWN;
  return {
    relationship: value,
    label: UPDATE_RELATIONSHIP_LABELS[value] || UPDATE_RELATIONSHIP_LABELS[UPDATE_RELATIONSHIPS.UNKNOWN],
    lifecycleOrder: RELATIONSHIP_ORDER[value] || 0,
    isAnnouncement: value === UPDATE_RELATIONSHIPS.NOTIFICATION,
    isUpdate: DOWNSTREAM_RELATIONSHIPS.includes(value),
    requiresExistingRecruitment: DOWNSTREAM_RELATIONSHIPS.includes(value),
    occursAnytime: ANYTIME_RELATIONSHIPS.includes(value),
    isRecruitmentRelated: value !== UPDATE_RELATIONSHIPS.NONE
  };
}

/**
 * @param {string} text
 * @returns {{ relationship: string, matchedText: string }|null}
 */
function relationshipFromTitle(text) {
  const haystack = toText(text);
  if (!haystack) return null;
  for (const entry of TITLE_RELATIONSHIP_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = haystack.match(pattern);
      if (match) {
        return { relationship: entry.relationship, matchedText: collapse(match[0]).slice(0, 80) };
      }
    }
  }
  return null;
}

/**
 * Classify the update relationship an event carries.
 *
 * @param {object} normalizedEvent Phase AI-2 normalized event
 * @returns {object} relationship descriptor with source and explanation
 */
function classifyUpdateRelationship(normalizedEvent = {}) {
  const event = normalizedEvent && typeof normalizedEvent === "object" ? normalizedEvent : {};
  const eventType = event.eventType || EVENT_TYPES.UNKNOWN;
  const eventSubType = event.eventSubType || null;

  const fromEventType = EVENT_TYPE_TO_RELATIONSHIP[eventType] || UPDATE_RELATIONSHIPS.UNKNOWN;
  const fromSubType = eventSubType ? SUB_TYPE_TO_RELATIONSHIP[eventSubType] : null;

  let relationship = fromEventType;
  let source = "event_type";
  let matchedText = null;

  if (fromSubType && SUB_TYPE_OVERRIDABLE_TYPES.includes(eventType)) {
    relationship = fromSubType;
    source = "event_sub_type";
  }

  if (relationship === UPDATE_RELATIONSHIPS.UNKNOWN) {
    const titleMatch = relationshipFromTitle(
      `${event.normalizedTitle || ""} ${event.sourceTitle || ""} ${event.rawEventLabel || ""}`
    );
    if (titleMatch) {
      relationship = titleMatch.relationship;
      source = "title_pattern";
      matchedText = titleMatch.matchedText;
    }
  }

  const descriptor = describeRelationship(relationship);
  const explanation =
    source === "event_type"
      ? `Event type "${eventType}" maps to the ${descriptor.label} relationship.`
      : source === "event_sub_type"
        ? `Sub-type "${eventSubType}" refines event type "${eventType}" into the ${descriptor.label} relationship.`
        : source === "title_pattern"
          ? `Event type was unresolved, so the title phrase "${matchedText}" was used to infer the ${descriptor.label} relationship.`
          : `No update relationship could be recognised for event type "${eventType}".`;

  return {
    ...descriptor,
    source,
    eventType,
    eventSubType,
    matchedText,
    resolved: relationship !== UPDATE_RELATIONSHIPS.UNKNOWN,
    explanation
  };
}

/**
 * Check that an update makes sense for how far a recruitment has progressed.
 *
 * Forward moves and repeats are always plausible. Large backward jumps are not:
 * a joining notice against a recruitment that has only been announced is far
 * more likely to be a mismatch than a real event.
 *
 * @param {object} relationshipInfo output of `classifyUpdateRelationship`
 * @param {object} record normalized recruitment record
 * @returns {{
 *   plausible: boolean,
 *   level: string,
 *   delta: number|null,
 *   candidateStage: string,
 *   candidateOrder: number,
 *   isNewStageForRecruitment: boolean,
 *   reason: string
 * }}
 */
function assessLifecyclePlausibility(relationshipInfo = {}, record = {}) {
  const candidateStage = record.lifecycleStage || UPDATE_RELATIONSHIPS.UNKNOWN;
  const candidateOrder = Number(record.lifecycleOrder) || 0;
  const eventOrder = Number(relationshipInfo.lifecycleOrder) || 0;
  const isNewStageForRecruitment = !(record.recordedRelationships || []).includes(
    relationshipInfo.relationship
  );

  if (!relationshipInfo.isRecruitmentRelated || !relationshipInfo.resolved) {
    return {
      plausible: true,
      level: "unknown",
      delta: null,
      candidateStage,
      candidateOrder,
      isNewStageForRecruitment,
      reason: "Relationship is unresolved, so no lifecycle check was applied."
    };
  }
  if (relationshipInfo.occursAnytime) {
    return {
      plausible: true,
      level: "plausible",
      delta: null,
      candidateStage,
      candidateOrder,
      isNewStageForRecruitment,
      reason: `${relationshipInfo.label} notices are issued at any point in a recruitment.`
    };
  }
  if (!candidateOrder) {
    return {
      plausible: true,
      level: "unverified",
      delta: null,
      candidateStage,
      candidateOrder,
      isNewStageForRecruitment,
      reason: "The recruitment records no lifecycle stage, so the update cannot be contradicted."
    };
  }

  const delta = eventOrder - candidateOrder;
  if (delta >= 0) {
    return {
      plausible: true,
      level: "plausible",
      delta,
      candidateStage,
      candidateOrder,
      isNewStageForRecruitment,
      reason: `${relationshipInfo.label} moves the recruitment forward from "${candidateStage}".`
    };
  }
  // A single step back is normal: multi-tier exams re-issue admit cards after a
  // first-stage result. Two or more steps back is treated as suspicious.
  if (delta >= -20) {
    return {
      plausible: true,
      level: "plausible_backward",
      delta,
      candidateStage,
      candidateOrder,
      isNewStageForRecruitment,
      reason: `${relationshipInfo.label} precedes "${candidateStage}" but multi-stage recruitments revisit earlier steps.`
    };
  }
  return {
    plausible: false,
    level: "implausible",
    delta,
    candidateStage,
    candidateOrder,
    isNewStageForRecruitment,
    reason: `${relationshipInfo.label} is far behind the recruitment's recorded stage "${candidateStage}".`
  };
}

/**
 * Decide whether this exact document is already recorded against a recruitment.
 *
 * @param {object} identity event identity
 * @param {object} record normalized recruitment record
 * @param {object} relationshipInfo
 * @returns {{
 *   isDuplicate: boolean,
 *   matchedOn: string|null,
 *   recordedDocument: object|null,
 *   reason: string|null
 * }}
 */
function findRecordedDuplicate(identity = {}, record = {}, relationshipInfo = {}) {
  const none = { isDuplicate: false, matchedOn: null, recordedDocument: null, reason: null };
  if (!record || typeof record !== "object") return none;

  const eventFingerprint = collapse(identity.fingerprint);
  if (eventFingerprint && (record.fingerprints || []).includes(eventFingerprint)) {
    return {
      isDuplicate: true,
      matchedOn: "recruitment_fingerprint",
      recordedDocument: null,
      reason: `The event fingerprint is already recorded on recruitment ${record.recruitmentId}.`
    };
  }

  const eventIdentifier = identity.advertisementKey || identity.referenceKey || "";
  for (const document of record.recordedDocuments || []) {
    if (eventFingerprint && document.fingerprint === eventFingerprint) {
      return {
        isDuplicate: true,
        matchedOn: "document_fingerprint",
        recordedDocument: document,
        reason: "An already recorded document carries the same fingerprint."
      };
    }
    if (document.relationship !== relationshipInfo.relationship) continue;

    const sameIdentifier = Boolean(
      eventIdentifier && document.identifier && document.identifier === eventIdentifier
    );
    const samePublicationDate = Boolean(
      identity.publicationDate &&
        document.publicationDate &&
        identity.publicationDate === document.publicationDate
    );
    if (sameIdentifier && samePublicationDate) {
      return {
        isDuplicate: true,
        matchedOn: "relationship_identifier_and_date",
        recordedDocument: document,
        reason: `A ${relationshipInfo.label} document with identifier ${document.identifier} dated ${document.publicationDate} is already recorded.`
      };
    }
    if (
      samePublicationDate &&
      document.title &&
      toMatchKey(document.title) === toMatchKey(identity.title)
    ) {
      return {
        isDuplicate: true,
        matchedOn: "relationship_title_and_date",
        recordedDocument: document,
        reason: `A ${relationshipInfo.label} document with the same title and date is already recorded.`
      };
    }
  }

  return none;
}

/**
 * Bind a classified update to the recruitment it should be applied against.
 *
 * @param {object} relationshipInfo
 * @param {object|null} bestMatch ranked candidate
 * @returns {object|null} mapping, or null when there is nothing to map to
 */
function mapUpdateToCandidate(relationshipInfo = {}, bestMatch = null) {
  if (!bestMatch || !bestMatch.record) {
    return {
      mapped: false,
      relationship: relationshipInfo.relationship || UPDATE_RELATIONSHIPS.UNKNOWN,
      recruitmentId: null,
      recruitmentKey: null,
      similarity: 0,
      plausibility: null,
      explanation: "No recruitment candidate was available to map this update to."
    };
  }

  const plausibility = assessLifecyclePlausibility(relationshipInfo, bestMatch.record);
  return {
    mapped: true,
    relationship: relationshipInfo.relationship || UPDATE_RELATIONSHIPS.UNKNOWN,
    relationshipLabel: relationshipInfo.label || null,
    recruitmentId: bestMatch.record.recruitmentId,
    recruitmentKey: bestMatch.record.recruitmentKey,
    recruitmentTitle: bestMatch.record.title,
    similarity: round2(bestMatch.score || 0),
    fromLifecycleStage: plausibility.candidateStage,
    toLifecycleStage: relationshipInfo.relationship || null,
    isNewStageForRecruitment: plausibility.isNewStageForRecruitment,
    plausibility,
    explanation: `${relationshipInfo.label || "Update"} maps to recruitment ${bestMatch.record.recruitmentId} at similarity ${round2(bestMatch.score || 0)}. ${plausibility.reason}`
  };
}

module.exports = {
  TITLE_RELATIONSHIP_PATTERNS,
  SUB_TYPE_OVERRIDABLE_TYPES,
  describeRelationship,
  relationshipFromTitle,
  classifyUpdateRelationship,
  assessLifecyclePlausibility,
  findRecordedDuplicate,
  mapUpdateToCandidate
};
