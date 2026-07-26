"use strict";

/**
 * PWP Phase 1 — Publishing policy gate.
 * AUTO_PUBLISH_ENABLED must remain FALSE. Manual publish only.
 */

const { getAutomationFlags, isAutoPublishBlocked } = require("../../config/automationFlags");

const PUBLISHING_POLICY = Object.freeze({
  AUTO_PUBLISH_ENABLED: false,
  MANUAL_PUBLISH_ONLY: true
});

function assertAutoPublishDisabled() {
  const flags = getAutomationFlags();
  const blocked = isAutoPublishBlocked() && flags.AUTO_PUBLISH_ENABLED !== true;
  return {
    autoPublishEnabled: flags.AUTO_PUBLISH_ENABLED === true,
    autoPublishBlocked: blocked || PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED === false,
    manualPublishOnly: true,
    policy: PUBLISHING_POLICY
  };
}

/**
 * Manual publish is allowed only when explicitly confirmed after READY_FOR_REVIEW.
 * Never auto-publishes. Never calls the publishing engine.
 */
function evaluateManualPublishGate({ confirmManualPublish = false, readyForReview = false } = {}) {
  const policy = assertAutoPublishDisabled();

  if (policy.autoPublishEnabled) {
    return {
      allowed: false,
      published: false,
      state: "FAILED",
      reason: "AUTO_PUBLISH_ENABLED_must_remain_false",
      policy
    };
  }

  if (!readyForReview) {
    return {
      allowed: false,
      published: false,
      state: "READY_FOR_REVIEW",
      reason: "workflow_not_ready_for_manual_publish",
      policy
    };
  }

  if (confirmManualPublish !== true) {
    return {
      allowed: false,
      published: false,
      state: "READY_FOR_REVIEW",
      reason: "awaiting_manual_publish_confirmation",
      policy
    };
  }

  return {
    allowed: true,
    published: false,
    markedPublishedManually: true,
    state: "PUBLISHED_MANUALLY",
    reason: "manual_publish_confirmed_advisory_only",
    policy,
    note: "State marker only — publishing engine is not invoked by PWP Phase 1."
  };
}

module.exports = {
  PUBLISHING_POLICY,
  assertAutoPublishDisabled,
  evaluateManualPublishGate
};
