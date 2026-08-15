"use strict";

/**
 * AMP-4B — Map detection/brain event stages onto recruitments.lifecycle_state.
 *
 * Event stages (exam_date, admit_card, …) are not the same vocabulary as the
 * persisted parent recruitment ENUM. This helper reuses Phase 63
 * typicalRecruitmentStates and AMP-1 stage aliases. Unknown values are rejected.
 */

const {
  DEFAULT_RECRUITMENT_LIFECYCLE_STATE,
  getTypicalRecruitmentLifecycleState
} = require("../recruitmentDomainModel");
const { STAGE_BY_ID } = require("../../project/recruitmentIntelligence/lifecycleIntelligence");

function invalidLifecycleStateError(value) {
  const err = new Error("Invalid lifecycle_state");
  err.statusCode = 400;
  err.details = { received: value == null ? null : String(value) };
  return err;
}

function mapEventStageToRecruitmentLifecycleState(stage) {
  const mapped = getTypicalRecruitmentLifecycleState(stage);
  if (mapped != null) {
    return mapped;
  }

  const normalized = String(stage).trim().toLowerCase();
  const ampStage = STAGE_BY_ID[normalized];
  if (ampStage && ampStage.eventType) {
    const fromAmp = getTypicalRecruitmentLifecycleState(ampStage.eventType);
    if (fromAmp != null) {
      return fromAmp;
    }
  }

  throw invalidLifecycleStateError(stage);
}

module.exports = {
  mapEventStageToRecruitmentLifecycleState,
  DEFAULT_RECRUITMENT_LIFECYCLE_STATE
};
