"use strict";

/**
 * Phase 132 — Recruitment Workflow Advisory Timeline Model (Advisory Only).
 *
 * Pure advisory timeline model that describes recruitment workflow progression
 * from supplied lifecycle signals. No database access, no persistence,
 * no runtime imports, no side effects. No event tracking. No history storage.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE = 132;

const RECRUITMENT_WORKFLOW_TIMELINE_MODEL_ENTITY =
  "recruitment_workflow_timeline_model";

const WORKFLOW_STAGES = Object.freeze([
  "NOTIFICATION",
  "APPLICATION",
  "CORRECTION",
  "ADMIT_CARD",
  "EXAM",
  "ANSWER_KEY",
  "RESULT",
  "FINAL_RESULT"
]);

const SUPPORTED_WORKFLOW_STAGES = Object.freeze(new Set(WORKFLOW_STAGES));

const STAGE_INDEX = Object.freeze(
  WORKFLOW_STAGES.reduce((map, stage, index) => {
    map[stage] = index;
    return map;
  }, {})
);

const TIMELINE_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  EMPTY: "EMPTY",
  UNKNOWN: "UNKNOWN"
});

const EVENT_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  CURRENT: "CURRENT",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_132",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  timelinePersistence: false,
  eventTracking: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131])
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  if (typeof recruitmentId === "string" || typeof recruitmentId === "number") {
    const normalized = String(recruitmentId).trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedTimelineInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  if (
    input.recruitmentId != null &&
    typeof input.recruitmentId !== "string" &&
    typeof input.recruitmentId !== "number"
  ) {
    return false;
  }

  if (input.events == null) {
    return true;
  }

  if (!Array.isArray(input.events)) {
    return false;
  }

  for (let i = 0; i < input.events.length; i += 1) {
    const event = input.events[i];
    if (!isPlainObject(event)) {
      return false;
    }
    if (typeof event.eventType !== "string" || typeof event.status !== "string") {
      return false;
    }
    if (typeof event.order !== "number" || !Number.isFinite(event.order)) {
      return false;
    }
    if (
      event.timestamp != null &&
      typeof event.timestamp !== "string" &&
      typeof event.timestamp !== "number"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string} eventType
 * @returns {boolean}
 */
function isSupportedStage(eventType) {
  return typeof eventType === "string" && SUPPORTED_WORKFLOW_STAGES.has(eventType);
}

/**
 * @param {ReadonlyArray<Object>} events
 * @returns {ReadonlyArray<Object>}
 */
function normalizeTimelineEvents(events) {
  const normalized = [];

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const eventType = event.eventType.trim();
    const status = event.status.trim();

    if (eventType.length === 0 || status.length === 0) {
      continue;
    }

    const entry = {
      eventType,
      status,
      order: event.order,
      stageIndex: isSupportedStage(eventType) ? STAGE_INDEX[eventType] : -1,
      recognized: isSupportedStage(eventType)
    };

    if (event.timestamp != null) {
      entry.timestamp = event.timestamp;
    }

    normalized.push(entry);
  }

  normalized.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    if (left.stageIndex !== right.stageIndex) {
      return left.stageIndex - right.stageIndex;
    }
    return left.eventType.localeCompare(right.eventType);
  });

  return normalized;
}

/**
 * @param {ReadonlyArray<Object>} timelineEvents
 * @returns {string[]}
 */
function collectCompletedStages(timelineEvents) {
  const completed = [];

  for (let i = 0; i < WORKFLOW_STAGES.length; i += 1) {
    const stage = WORKFLOW_STAGES[i];
    let isCompleted = false;

    for (let j = 0; j < timelineEvents.length; j += 1) {
      const event = timelineEvents[j];
      if (
        event.recognized &&
        event.eventType === stage &&
        event.status === EVENT_STATUS.COMPLETED
      ) {
        isCompleted = true;
        break;
      }
    }

    if (isCompleted) {
      completed.push(stage);
    }
  }

  return completed;
}

/**
 * @param {ReadonlyArray<Object>} timelineEvents
 * @returns {string|null}
 */
function detectBlockedStage(timelineEvents) {
  let blockedStage = null;
  let blockedIndex = -1;

  for (let i = 0; i < timelineEvents.length; i += 1) {
    const event = timelineEvents[i];
    if (!event.recognized || event.status !== EVENT_STATUS.BLOCKED) {
      continue;
    }

    if (event.stageIndex > blockedIndex) {
      blockedStage = event.eventType;
      blockedIndex = event.stageIndex;
    }
  }

  return blockedStage;
}

/**
 * @param {ReadonlyArray<Object>} timelineEvents
 * @returns {string|null}
 */
function detectCurrentStage(timelineEvents) {
  let currentStage = null;
  let currentIndex = -1;

  for (let i = 0; i < timelineEvents.length; i += 1) {
    const event = timelineEvents[i];
    if (!event.recognized || event.status !== EVENT_STATUS.CURRENT) {
      continue;
    }

    if (event.stageIndex > currentIndex) {
      currentStage = event.eventType;
      currentIndex = event.stageIndex;
    }
  }

  return currentStage;
}

/**
 * @param {string|null} stage
 * @returns {string|null}
 */
function resolveNextExpectedStage(stage) {
  if (stage == null || !isSupportedStage(stage)) {
    return null;
  }

  const nextIndex = STAGE_INDEX[stage] + 1;
  if (nextIndex >= WORKFLOW_STAGES.length) {
    return null;
  }

  return WORKFLOW_STAGES[nextIndex];
}

/**
 * @param {ReadonlyArray<string>} completedStages
 * @returns {string|null}
 */
function inferCurrentStageFromCompleted(completedStages) {
  if (completedStages.length === 0) {
    return null;
  }

  return completedStages[completedStages.length - 1];
}

/**
 * @param {ReadonlyArray<string>} completedStages
 * @returns {string|null}
 */
function inferNextExpectedStageFromCompleted(completedStages) {
  if (completedStages.length === 0) {
    return WORKFLOW_STAGES[0];
  }

  const lastCompleted = completedStages[completedStages.length - 1];
  return resolveNextExpectedStage(lastCompleted);
}

/**
 * @param {ReadonlyArray<Object>} timelineEvents
 * @returns {boolean}
 */
function hasRecognizedStageEvents(timelineEvents) {
  for (let i = 0; i < timelineEvents.length; i += 1) {
    if (timelineEvents[i].recognized) {
      return true;
    }
  }
  return false;
}

/**
 * @param {ReadonlyArray<Object>} timelineEvents
 * @returns {boolean}
 */
function isFinalResultCompleted(timelineEvents) {
  for (let i = 0; i < timelineEvents.length; i += 1) {
    const event = timelineEvents[i];
    if (
      event.recognized &&
      event.eventType === "FINAL_RESULT" &&
      event.status === EVENT_STATUS.COMPLETED
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @param {Readonly<Object>} params
 * @returns {string}
 */
function buildTimelineSummary(params) {
  const {
    timelineStatus,
    currentStage,
    blockedStage,
    completedStages,
    nextExpectedStage
  } = params;

  switch (timelineStatus) {
    case TIMELINE_STATUS.EMPTY:
      return "No recruitment workflow timeline events supplied";
    case TIMELINE_STATUS.UNKNOWN:
      return "Recruitment workflow timeline could not be determined from supplied signals";
    case TIMELINE_STATUS.BLOCKED:
      if (blockedStage != null) {
        return `Recruitment workflow timeline is blocked at ${blockedStage} stage`;
      }
      return "Recruitment workflow timeline is blocked";
    case TIMELINE_STATUS.COMPLETED:
      return "Recruitment workflow timeline has reached completion at FINAL_RESULT";
    case TIMELINE_STATUS.IN_PROGRESS:
      if (currentStage != null && nextExpectedStage != null) {
        return `Recruitment workflow timeline is in progress at ${currentStage} stage with ${nextExpectedStage} expected next`;
      }
      if (currentStage != null) {
        return `Recruitment workflow timeline is in progress at ${currentStage} stage`;
      }
      if (completedStages.length > 0 && nextExpectedStage != null) {
        return `Recruitment workflow timeline has completed ${completedStages[completedStages.length - 1]} with ${nextExpectedStage} expected next`;
      }
      return "Recruitment workflow timeline is in progress";
    default:
      return "Recruitment workflow timeline advisory summary unavailable";
  }
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildTimelineResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    timelineStatus: params.timelineStatus,
    timelineEvents: Object.freeze(params.timelineEvents.slice()),
    completedStages: Object.freeze(params.completedStages.slice()),
    currentStage: params.currentStage,
    nextExpectedStage: params.nextExpectedStage,
    timelineSummary: params.timelineSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      generatedBy: "phase_132",
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      timelinePersistence: false,
      eventTracking: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryTimelineOnly: true
    })
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildEmptyTimelineResult(params) {
  return buildTimelineResult({
    recruitmentId: params.recruitmentId,
    timelineStatus: TIMELINE_STATUS.EMPTY,
    timelineEvents: [],
    completedStages: [],
    currentStage: null,
    nextExpectedStage: null,
    timelineSummary: buildTimelineSummary({
      timelineStatus: TIMELINE_STATUS.EMPTY,
      currentStage: null,
      blockedStage: null,
      completedStages: [],
      nextExpectedStage: null
    })
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildUnknownTimelineResult(params) {
  return buildTimelineResult({
    recruitmentId: params.recruitmentId,
    timelineStatus: TIMELINE_STATUS.UNKNOWN,
    timelineEvents: [],
    completedStages: [],
    currentStage: null,
    nextExpectedStage: null,
    timelineSummary: buildTimelineSummary({
      timelineStatus: TIMELINE_STATUS.UNKNOWN,
      currentStage: null,
      blockedStage: null,
      completedStages: [],
      nextExpectedStage: null
    })
  });
}

/**
 * Create a recruitment workflow advisory timeline from supplied lifecycle signals.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowTimeline(input) {
  if (!isRecognizedTimelineInput(input)) {
    return buildUnknownTimelineResult({
      recruitmentId: null
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const rawEvents = Array.isArray(input.events) ? input.events : [];

  if (rawEvents.length === 0) {
    return buildEmptyTimelineResult({ recruitmentId });
  }

  const timelineEvents = normalizeTimelineEvents(rawEvents);

  if (timelineEvents.length === 0 || !hasRecognizedStageEvents(timelineEvents)) {
    return buildUnknownTimelineResult({ recruitmentId });
  }

  const completedStages = collectCompletedStages(timelineEvents);
  const blockedStage = detectBlockedStage(timelineEvents);
  const explicitCurrentStage = detectCurrentStage(timelineEvents);

  if (blockedStage != null) {
    return buildTimelineResult({
      recruitmentId,
      timelineStatus: TIMELINE_STATUS.BLOCKED,
      timelineEvents,
      completedStages,
      currentStage: blockedStage,
      nextExpectedStage: resolveNextExpectedStage(blockedStage),
      timelineSummary: buildTimelineSummary({
        timelineStatus: TIMELINE_STATUS.BLOCKED,
        currentStage: blockedStage,
        blockedStage,
        completedStages,
        nextExpectedStage: resolveNextExpectedStage(blockedStage)
      })
    });
  }

  if (isFinalResultCompleted(timelineEvents)) {
    return buildTimelineResult({
      recruitmentId,
      timelineStatus: TIMELINE_STATUS.COMPLETED,
      timelineEvents,
      completedStages,
      currentStage: null,
      nextExpectedStage: null,
      timelineSummary: buildTimelineSummary({
        timelineStatus: TIMELINE_STATUS.COMPLETED,
        currentStage: null,
        blockedStage: null,
        completedStages,
        nextExpectedStage: null
      })
    });
  }

  const currentStage =
    explicitCurrentStage != null
      ? explicitCurrentStage
      : inferCurrentStageFromCompleted(completedStages);
  const nextExpectedStage =
    explicitCurrentStage != null
      ? resolveNextExpectedStage(explicitCurrentStage)
      : inferNextExpectedStageFromCompleted(completedStages);

  return buildTimelineResult({
    recruitmentId,
    timelineStatus: TIMELINE_STATUS.IN_PROGRESS,
    timelineEvents,
    completedStages,
    currentStage,
    nextExpectedStage,
    timelineSummary: buildTimelineSummary({
      timelineStatus: TIMELINE_STATUS.IN_PROGRESS,
      currentStage,
      blockedStage: null,
      completedStages,
      nextExpectedStage
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_ENTITY,
  WORKFLOW_STAGES,
  SUPPORTED_WORKFLOW_STAGES,
  TIMELINE_STATUS,
  EVENT_STATUS,
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA,
  createRecruitmentWorkflowTimeline
};
