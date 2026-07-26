"use strict";

/**
 * CIP Stage 3A — Deterministic source relationship detection.
 *
 * Only infers Notification → {Corrigendum|Admit Card|Result|Answer Key|Notice}
 * from explicit indicators. Never invents relationships.
 */

const {
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES
} = require("./sourceTypes");

const SOURCE_TYPE_TO_ROLE = Object.freeze({
  corrigendum_pdf: RELATIONSHIP_ROLES.CORRIGENDUM,
  admit_card_pdf: RELATIONSHIP_ROLES.ADMIT_CARD,
  result_pdf: RELATIONSHIP_ROLES.RESULT,
  answer_key_pdf: RELATIONSHIP_ROLES.ANSWER_KEY,
  notice_pdf: RELATIONSHIP_ROLES.NOTICE,
  official_pdf: RELATIONSHIP_ROLES.NOTIFICATION,
  official_html_page: RELATIONSHIP_ROLES.NOTIFICATION,
  linked_pdf: RELATIONSHIP_ROLES.UNKNOWN,
  unknown_source: RELATIONSHIP_ROLES.UNKNOWN
});

const ROLE_TO_RELATIONSHIP = Object.freeze({
  [RELATIONSHIP_ROLES.CORRIGENDUM]: RELATIONSHIP_TYPES.NOTIFICATION_TO_CORRIGENDUM,
  [RELATIONSHIP_ROLES.ADMIT_CARD]: RELATIONSHIP_TYPES.NOTIFICATION_TO_ADMIT_CARD,
  [RELATIONSHIP_ROLES.RESULT]: RELATIONSHIP_TYPES.NOTIFICATION_TO_RESULT,
  [RELATIONSHIP_ROLES.ANSWER_KEY]: RELATIONSHIP_TYPES.NOTIFICATION_TO_ANSWER_KEY,
  [RELATIONSHIP_ROLES.NOTICE]: RELATIONSHIP_TYPES.NOTIFICATION_TO_NOTICE
});

const CHILD_ROLE_PATTERNS = Object.freeze([
  {
    role: RELATIONSHIP_ROLES.CORRIGENDUM,
    patterns: [/\bcorrigendum\b/, /\bcorrection\s+notice\b/, /\berrata\b/]
  },
  {
    role: RELATIONSHIP_ROLES.ADMIT_CARD,
    patterns: [/\badmit[\s_-]*card\b/, /\bhall[\s_-]*ticket\b/]
  },
  {
    role: RELATIONSHIP_ROLES.ANSWER_KEY,
    patterns: [/\banswer[\s_-]*key\b/]
  },
  {
    role: RELATIONSHIP_ROLES.RESULT,
    patterns: [/\bresult\b/, /\bmerit[\s_-]*list\b/]
  },
  {
    role: RELATIONSHIP_ROLES.NOTICE,
    patterns: [/\bimportant\s+notice\b/, /\bpublic\s+notice\b/, /\bnotice\b/]
  }
]);

function hasParentNotificationHint(input = {}) {
  return Boolean(
    input.parentNotificationUrl ||
      input.relatedNotificationUrl ||
      input.notificationUrl ||
      input.parentSourceUrl ||
      input.linkedFromNotification === true
  );
}

/**
 * @param {object} input
 * @param {string} sourceType
 * @param {object} blobs
 */
function detectRelationships(input = {}, sourceType = "unknown_source", blobs = {}) {
  const reasons = [];
  const parentIndicators = [];
  const combined = String((blobs && blobs.combined) || "").toLowerCase();

  let role = SOURCE_TYPE_TO_ROLE[sourceType] || RELATIONSHIP_ROLES.UNKNOWN;

  // Explicit role hint (deterministic enum only)
  const declaredRole = String(input.relationshipRole || input.sourceRole || "")
    .trim()
    .toLowerCase();
  if (Object.values(RELATIONSHIP_ROLES).includes(declaredRole)) {
    role = declaredRole;
    reasons.push(`declared_relationship_role:${declaredRole}`);
  } else if (role === RELATIONSHIP_ROLES.UNKNOWN || role === RELATIONSHIP_ROLES.NOTIFICATION) {
    for (const entry of CHILD_ROLE_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(combined)) {
          role = entry.role;
          reasons.push(`role_pattern:${entry.role}`);
          break;
        }
      }
      if (role !== RELATIONSHIP_ROLES.UNKNOWN && role !== RELATIONSHIP_ROLES.NOTIFICATION) {
        break;
      }
    }
  } else {
    reasons.push(`role_from_source_type:${sourceType}`);
  }

  const hasParent = hasParentNotificationHint(input);
  if (input.parentNotificationUrl) {
    parentIndicators.push({ kind: "parentNotificationUrl", value: String(input.parentNotificationUrl) });
  }
  if (input.relatedNotificationUrl) {
    parentIndicators.push({ kind: "relatedNotificationUrl", value: String(input.relatedNotificationUrl) });
  }
  if (input.notificationUrl) {
    parentIndicators.push({ kind: "notificationUrl", value: String(input.notificationUrl) });
  }
  if (input.parentSourceUrl) {
    parentIndicators.push({ kind: "parentSourceUrl", value: String(input.parentSourceUrl) });
  }
  if (input.linkedFromNotification === true) {
    parentIndicators.push({ kind: "linkedFromNotification", value: "true" });
  }

  const relationshipType = ROLE_TO_RELATIONSHIP[role] || null;
  const isChildRole = Boolean(relationshipType);

  // Only assert a relationship when we have a child role AND
  // (parent hint OR specialty source type that inherently relates to a notification).
  const specialtyChild =
    sourceType === "corrigendum_pdf" ||
    sourceType === "admit_card_pdf" ||
    sourceType === "result_pdf" ||
    sourceType === "answer_key_pdf" ||
    sourceType === "notice_pdf";

  let relatedTo = null;
  let confidence = "none";

  if (isChildRole && (hasParent || specialtyChild)) {
    relatedTo = RELATIONSHIP_ROLES.NOTIFICATION;
    confidence = hasParent ? "high" : "medium";
    if (hasParent) reasons.push("parent_notification_indicator_present");
    if (specialtyChild) reasons.push("specialty_source_type_implies_notification_parent");
  } else if (role === RELATIONSHIP_ROLES.NOTIFICATION) {
    relatedTo = null;
    confidence = "medium";
    reasons.push("source_role_is_notification_root");
  } else {
    relatedTo = null;
    confidence = "low";
    if (!isChildRole) reasons.push("no_deterministic_child_role");
  }

  return {
    role,
    relatedTo,
    relationshipType: relatedTo ? relationshipType : null,
    parentIndicators,
    confidence,
    reasons
  };
}

module.exports = {
  SOURCE_TYPE_TO_ROLE,
  ROLE_TO_RELATIONSHIP,
  detectRelationships,
  hasParentNotificationHint
};
