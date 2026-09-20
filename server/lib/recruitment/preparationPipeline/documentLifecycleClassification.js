"use strict";

/**
 * Preparation Pipeline — lifecycle document classification bridge.
 *
 * Reuses authoritative eventTypeClassifier. Adds product-facing labels:
 * NOTIFICATION | ADMIT_CARD | ANSWER_KEY | RESULT | OTHER_UPDATE
 * with confidence + evidence. Never guesses when confidence is low.
 */

const {
  classifyRecruitmentEventType,
  LIFECYCLE_EVENT_TYPES
} = require("../eventTypeClassifier");

const PRODUCT_EVENT_TYPES = Object.freeze({
  NOTIFICATION: "NOTIFICATION",
  ADMIT_CARD: "ADMIT_CARD",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  OTHER_UPDATE: "OTHER_UPDATE"
});

const LIFECYCLE_TO_PRODUCT = Object.freeze({
  notification: PRODUCT_EVENT_TYPES.NOTIFICATION,
  short_notification: PRODUCT_EVENT_TYPES.NOTIFICATION,
  correction: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  exam_date: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  city_intimation: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  admit_card: PRODUCT_EVENT_TYPES.ADMIT_CARD,
  answer_key: PRODUCT_EVENT_TYPES.ANSWER_KEY,
  objection: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  result: PRODUCT_EVENT_TYPES.RESULT,
  final_result: PRODUCT_EVENT_TYPES.RESULT,
  dv: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  medical: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  joining: PRODUCT_EVENT_TYPES.OTHER_UPDATE,
  unknown: PRODUCT_EVENT_TYPES.OTHER_UPDATE
});

function collectContentSignals(text) {
  const t = String(text || "").toLowerCase();
  const signals = [];
  if (/notification|advertisement|vacancy|recruitment|application/.test(t)) {
    signals.push("notification_terms");
  }
  if (/admit\s*card|hall\s*ticket|call\s*letter/.test(t)) {
    signals.push("admit_card_terms");
  }
  if (/answer\s*key|response\s*sheet/.test(t)) {
    signals.push("answer_key_terms");
  }
  if (/\bresult\b|merit\s*list|selection\s*list|score\s*card/.test(t)) {
    signals.push("result_terms");
  }
  return signals;
}

/**
 * @param {{ title?: string, content?: string, url?: string, sourceDocumentRef?: string|null }} input
 */
function classifyLifecycleDocument(input = {}) {
  const classified = classifyRecruitmentEventType({
    title: input.title,
    content: input.content,
    url: input.url
  });
  const lifecycleType =
    classified && classified.eventType ? String(classified.eventType) : "unknown";
  const productType =
    LIFECYCLE_TO_PRODUCT[lifecycleType] || PRODUCT_EVENT_TYPES.OTHER_UPDATE;
  const confidence =
    classified && classified.confidence ? String(classified.confidence) : "none";
  const matchedRules =
    classified && Array.isArray(classified.matchedRules) ? classified.matchedRules : [];
  const contentSignals = collectContentSignals(
    `${input.title || ""}\n${input.content || ""}\n${input.url || ""}`
  );

  const needsHumanReview =
    confidence === "low" ||
    confidence === "none" ||
    lifecycleType === "unknown" ||
    matchedRules.length === 0;

  return Object.freeze({
    event_type: lifecycleType,
    product_event_type: productType,
    confidence,
    evidence: Object.freeze({
      matchedRules: Object.freeze([...matchedRules]),
      contentSignals: Object.freeze(contentSignals),
      normalizedText:
        classified && classified.normalizedText ? classified.normalizedText.slice(0, 500) : ""
    }),
    source_document_reference: input.sourceDocumentRef || input.url || null,
    needs_matching: needsHumanReview,
    never_guess: true,
    supportedLifecycleTypes: LIFECYCLE_EVENT_TYPES
  });
}

module.exports = {
  PRODUCT_EVENT_TYPES,
  LIFECYCLE_TO_PRODUCT,
  classifyLifecycleDocument,
  collectContentSignals
};
