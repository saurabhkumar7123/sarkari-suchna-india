"use strict";

/**
 * Event-type publish policy. Advisory only — never publishes.
 * Human retains final target choice at generatePage time.
 */

const { normalizeEventType, isAnnouncementEvent, isDownstreamEvent } = require("./lifecycleSafety");

const PUBLISH_TARGETS = Object.freeze({
  NEW_VACANCY_PAGE: "new_vacancy_page",
  UPDATE_EXISTING_VACANCY_PAGE: "update_existing_vacancy_page",
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
      note: "New vacancy/public recruitment page after explicit manual publish."
    });
  }

  if (type === "correction" || type === "exam_date") {
    return Object.freeze({
      eventType: type,
      target: PUBLISH_TARGETS.UPDATE_EXISTING_VACANCY_PAGE,
      suggestedStatus: STATUS_BY_EVENT[type],
      alsoUpdateParentLinks: false,
      autoPublish: false,
      humanChoosesTarget: true,
      note: "Default is an explicit human update of the existing vacancy page."
    });
  }

  if (
    type === "admit_card" ||
    type === "answer_key" ||
    type === "result" ||
    type === "final_result" ||
    type === "city_intimation" ||
    type === "objection"
  ) {
    return Object.freeze({
      eventType: type,
      target: PUBLISH_TARGETS.DEDICATED_STATUS_PAGE,
      suggestedStatus: STATUS_BY_EVENT[type],
      alsoUpdateParentLinks: true,
      autoPublish: false,
      humanChoosesTarget: true,
      note: "Dedicated status page plus optional human-approved parent link/date update."
    });
  }

  if (isDownstreamEvent(type)) {
    return Object.freeze({
      eventType: type,
      target: PUBLISH_TARGETS.DEDICATED_STATUS_PAGE,
      suggestedStatus: STATUS_BY_EVENT[type] || "document",
      alsoUpdateParentLinks: true,
      autoPublish: false,
      humanChoosesTarget: true,
      note: "Dedicated status page or human-selected page."
    });
  }

  return Object.freeze({
    eventType: type,
    target: PUBLISH_TARGETS.HUMAN_DECISION,
    suggestedStatus: null,
    alsoUpdateParentLinks: false,
    autoPublish: false,
    humanChoosesTarget: true,
    note: "Unknown event — human decides page target."
  });
}

module.exports = {
  PUBLISH_TARGETS,
  STATUS_BY_EVENT,
  resolvePublishPolicy
};
