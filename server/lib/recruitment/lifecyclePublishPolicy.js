"use strict";

/**
 * Event-type publish policy — advisory only; never publishes.
 *
 * PRODUCT FREEZE:
 * ONE RECRUITMENT → ONE CANONICAL PUBLIC PAGE (pages.slug).
 * Admit Card / Answer Key / Result / Other MUST update that page.
 * Dedicated status pages are NEVER the default target.
 */

const {
  normalizeEventType,
  isAnnouncementEvent,
  isDownstreamEvent
} = require("./lifecycleSafety");

const PUBLISH_TARGETS = Object.freeze({
  NEW_VACANCY_PAGE: "new_vacancy_page",
  UPDATE_EXISTING_VACANCY_PAGE: "update_existing_vacancy_page",
  /** @deprecated Kept for backward-compat reads only — never returned as default. */
  DEDICATED_STATUS_PAGE: "dedicated_status_page",
  HUMAN_DECISION: "human_decision"
});

const STATUS_BY_EVENT = Object.freeze({
  notification: "latest job",
  short_notification: "latest job",
  correction: "latest job",
  exam_date: "latest job",
  admit_card: "admit card",
  answer_key: "answer key",
  result: "result",
  final_result: "result",
  objection: "answer key",
  city_intimation: "admit card",
  dv: "document",
  medical: "document",
  joining: "document",
  unknown: null
});

function resolvePublishPolicy(eventType) {
  const type = normalizeEventType(eventType);

  if (isAnnouncementEvent(type)) {
    return Object.freeze({
      eventType: type,
      target: PUBLISH_TARGETS.NEW_VACANCY_PAGE,
      suggestedStatus: STATUS_BY_EVENT[type],
      alsoUpdateParentLinks: false,
      autoPublish: false,
      humanChoosesTarget: true,
      oneCanonicalPage: true,
      note:
        "First Notification/new-vacancy publish may CREATE the single canonical public page. Later stages must UPDATE it."
    });
  }

  if (isDownstreamEvent(type) || type === "correction" || type === "exam_date") {
    return Object.freeze({
      eventType: type,
      target: PUBLISH_TARGETS.UPDATE_EXISTING_VACANCY_PAGE,
      suggestedStatus: STATUS_BY_EVENT[type] || "document",
      alsoUpdateParentLinks: true,
      autoPublish: false,
      humanChoosesTarget: true,
      oneCanonicalPage: true,
      note:
        "Update the existing canonical vacancy page (same pages.slug). Do not create a dedicated Admit Card / Result / Answer Key page."
    });
  }

  return Object.freeze({
    eventType: type,
    target: PUBLISH_TARGETS.HUMAN_DECISION,
    suggestedStatus: null,
    alsoUpdateParentLinks: false,
    autoPublish: false,
    humanChoosesTarget: true,
    oneCanonicalPage: true,
    note: "Unknown event — human decides; still one Recruitment → one canonical page."
  });
}

module.exports = {
  PUBLISH_TARGETS,
  STATUS_BY_EVENT,
  resolvePublishPolicy
};
