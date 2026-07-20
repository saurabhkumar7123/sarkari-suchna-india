"use strict";

/**
 * Phase 95 — Recruitment Lifecycle Event Resolution (Advisory).
 *
 * Pure library that resolves a single advisory recruitment lifecycle event
 * from workflow-available context. Descriptive only — no database access,
 * no state transitions, no production mutations, and no external calls.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE = 95;

const RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY = "recruitment_lifecycle_event_resolution";

const ADVISORY_LIFECYCLE_EVENTS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  APPLICATION_CORRECTION: "APPLICATION_CORRECTION",
  EXAM_CITY: "EXAM_CITY",
  ADMIT_CARD: "ADMIT_CARD",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT",
  COUNSELLING: "COUNSELLING",
  DOCUMENT_VERIFICATION: "DOCUMENT_VERIFICATION",
  JOINING: "JOINING",
  COMPLETED: "COMPLETED"
});

const ADVISORY_LIFECYCLE_EVENT_LIST = Object.freeze(Object.values(ADVISORY_LIFECYCLE_EVENTS));

const SUPPORTED_ADVISORY_LIFECYCLE_EVENTS = Object.freeze(
  new Set(ADVISORY_LIFECYCLE_EVENT_LIST)
);

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none"
});

const SUPPORTED_CONFIDENCE_LEVELS = Object.freeze(new Set(Object.values(CONFIDENCE_LEVELS)));

const RESOLUTION_REASONS = Object.freeze({
  EXPLICIT_ADVISORY_EVENT: "EXPLICIT_ADVISORY_EVENT",
  DOMAIN_EVENT_TYPE_MAPPED: "DOMAIN_EVENT_TYPE_MAPPED",
  ELIGIBILITY_EVENT_TYPE: "ELIGIBILITY_EVENT_TYPE",
  PAGE_METADATA_SIGNAL: "PAGE_METADATA_SIGNAL",
  RECRUITMENT_METADATA_SIGNAL: "RECRUITMENT_METADATA_SIGNAL",
  WORKFLOW_CONTEXT_SIGNAL: "WORKFLOW_CONTEXT_SIGNAL",
  PIPELINE_CONTEXT_SIGNAL: "PIPELINE_CONTEXT_SIGNAL",
  NO_RESOLUTION_SIGNALS: "NO_RESOLUTION_SIGNALS",
  INVALID_INPUT: "INVALID_INPUT"
});

const SUPPORTED_RESOLUTION_REASONS = Object.freeze(new Set(Object.values(RESOLUTION_REASONS)));

/**
 * Domain event types aligned with eventTypeClassifier / recruitmentDomainModel (no import).
 */
const DOMAIN_EVENT_TYPE_MAP = Object.freeze({
  notification: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
  short_notification: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
  application: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_start: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_end: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_window: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  correction: ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
  city_intimation: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  exam_date: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  exam_city: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  admit_card: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
  answer_key: ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
  objection: ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
  result: ADVISORY_LIFECYCLE_EVENTS.RESULT,
  final_result: ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT,
  counselling: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
  counseling: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
  dv: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  document_verification: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  medical: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  joining: ADVISORY_LIFECYCLE_EVENTS.JOINING,
  completed: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
  unknown: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN
});

const METADATA_SIGNAL_RULES = Object.freeze([
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\brecruitment\s+completed\b/,
      /\bcycle\s+completed\b/,
      /\ball\s+stages\s+completed\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bcounsell(?:ing|ing)\b/,
      /\bcounsel(?:ing|ling)\b/,
      /\bseat\s+allotment\b/,
      /\ballotment\s+list\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bdocument\s+verification\b/,
      /\bdoc(?:ument)?\s+verif(?:ication)?\b/,
      /\bmedical\s+examination\b/,
      /\bmedical\s+fitness\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [/\bjoining\s+instructions\b/, /\bappointment\s+letter\b/, /\bjoining\s+letter\b/]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [/\bfinal\s+result\b/, /\bfinal\s+merit\b/, /\bfinal\s+selection\b/]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.RESULT,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [/\bresult\b/, /\bmerit\s+list\b/, /\bscore\s+card\b/]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [/\banswer\s+key\b/, /\bprovisional\s+key\b/, /\bobjection\s+window\b/]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [/\badmit\s+card\b/, /\bhall\s+ticket\b/, /\badmission\s+certificate\b/]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bcity\s+intimation\b/,
      /\bexam\s+city\b/,
      /\bcentre\s+allotment\b/,
      /\bexam\s+date\b/,
      /\bexam\s+schedule\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bcorrigendum\b/,
      /\bcorrig\b/,
      /\bapplication\s+correction\b/,
      /\bform\s+correction\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bapply\s+online\b/,
      /\bonline\s+application\b/,
      /\bapplication\s+form\b/,
      /\bapplication\s+start\b/,
      /\bapplication\s+end\b/,
      /\blast\s+date\s+to\s+apply\b/
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    patterns: [
      /\bnotification\b/,
      /\badvertisement\b/,
      /\bshort\s+notification\b/,
      /\bemployment\s+notice\b/
    ]
  }
]);

const RECRUITMENT_METADATA_SIGNAL_RULES = Object.freeze([
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
    confidence: CONFIDENCE_LEVELS.LOW,
    fieldMatchers: [
      { field: "lifecycleStage", patterns: [/^completed$/i] },
      { field: "status", patterns: [/^completed$/i, /^closed$/i] }
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
    confidence: CONFIDENCE_LEVELS.LOW,
    fieldMatchers: [
      { field: "lifecycleStage", patterns: [/^counsell(?:ing|ing)$/i, /^counsel(?:ing|ling)$/i] },
      { field: "stage", patterns: [/^counsell(?:ing|ing)$/i] }
    ]
  },
  {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.JOINING,
    confidence: CONFIDENCE_LEVELS.LOW,
    fieldMatchers: [{ field: "lifecycleStage", patterns: [/^joining$/i] }]
  }
]);

const RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA = Object.freeze({
  phase: RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false
});

const RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
  description:
    "Advisory recruitment lifecycle event resolution from workflow-available context.",
  lifecycleEvents: ADVISORY_LIFECYCLE_EVENT_LIST,
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  resolutionReasons: Object.freeze(Object.values(RESOLUTION_REASONS)),
  metadata: RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_LIFECYCLE_EVENT_RESOLUTION = Object.freeze({
  lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
  lifecycleConfidence: CONFIDENCE_LEVELS.NONE,
  resolutionReason: RESOLUTION_REASONS.NO_RESOLUTION_SIGNALS,
  sourceEventType: null,
  signals: Object.freeze([]),
  architectureOnly: true,
  advisory: true,
  executed: false
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function normalizeKey(value) {
  const normalized = normalizeString(value);
  return normalized == null ? null : normalized.toLowerCase();
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

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  let status = VALIDATION_STATUS.VALID;
  if (normalizedReasons.length > 0) {
    status =
      normalizedReasons.some((reason) => reason.startsWith("MISSING_")) ||
      normalizedReasons.some((reason) => reason.startsWith("INVALID_"))
        ? VALIDATION_STATUS.INCOMPLETE
        : VALIDATION_STATUS.INVALID;
  }

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

function normalizeAdvisoryLifecycleEvent(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const upper = normalized.toUpperCase();
  return SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(upper) ? upper : null;
}

function mapDomainEventType(value) {
  const normalized = normalizeKey(value);
  if (normalized == null) {
    return null;
  }
  return DOMAIN_EVENT_TYPE_MAP[normalized] ?? null;
}

function collectMetadataText(pageMetadata) {
  if (!isPlainObject(pageMetadata)) {
    return "";
  }

  const parts = [
    pageMetadata.title,
    pageMetadata.content,
    pageMetadata.url,
    pageMetadata.headline,
    pageMetadata.summary,
    pageMetadata.eventType,
    pageMetadata.lifecycleEvent
  ];

  return parts
    .filter((part) => part != null && String(part).trim() !== "")
    .map((part) => String(part))
    .join(" ")
    .toLowerCase();
}

function detectMetadataSignal(text) {
  if (text === "") {
    return null;
  }

  for (let i = 0; i < METADATA_SIGNAL_RULES.length; i += 1) {
    const rule = METADATA_SIGNAL_RULES[i];
    for (let j = 0; j < rule.patterns.length; j += 1) {
      if (rule.patterns[j].test(text)) {
        return {
          lifecycleEvent: rule.lifecycleEvent,
          lifecycleConfidence: rule.confidence,
          resolutionReason: RESOLUTION_REASONS.PAGE_METADATA_SIGNAL,
          signal: `metadata:${rule.lifecycleEvent}`
        };
      }
    }
  }

  return null;
}

function detectRecruitmentMetadataSignal(recruitmentMetadata) {
  if (!isPlainObject(recruitmentMetadata)) {
    return null;
  }

  for (let i = 0; i < RECRUITMENT_METADATA_SIGNAL_RULES.length; i += 1) {
    const rule = RECRUITMENT_METADATA_SIGNAL_RULES[i];
    for (let j = 0; j < rule.fieldMatchers.length; j += 1) {
      const matcher = rule.fieldMatchers[j];
      const fieldValue = normalizeString(recruitmentMetadata[matcher.field]);
      if (fieldValue == null) {
        continue;
      }
      for (let k = 0; k < matcher.patterns.length; k += 1) {
        if (matcher.patterns[k].test(fieldValue)) {
          return {
            lifecycleEvent: rule.lifecycleEvent,
            lifecycleConfidence: rule.confidence,
            resolutionReason: RESOLUTION_REASONS.RECRUITMENT_METADATA_SIGNAL,
            signal: `recruitment:${matcher.field}`
          };
        }
      }
    }
  }

  const metadataEventType = mapDomainEventType(
    recruitmentMetadata.eventType ?? recruitmentMetadata.lifecycleEvent
  );
  if (metadataEventType != null && metadataEventType !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return {
      lifecycleEvent: metadataEventType,
      lifecycleConfidence: CONFIDENCE_LEVELS.LOW,
      resolutionReason: RESOLUTION_REASONS.RECRUITMENT_METADATA_SIGNAL,
      signal: "recruitment:eventType"
    };
  }

  return null;
}

function extractExplicitAdvisoryEvent(context) {
  const candidates = [
    context.lifecycleEvent,
    context.advisoryLifecycleEvent,
    isPlainObject(context.workflowContext) ? context.workflowContext.lifecycleEvent : null,
    isPlainObject(context.workflowContext)
      ? context.workflowContext.advisoryLifecycleEvent
      : null,
    isPlainObject(context.pageMetadata) ? context.pageMetadata.lifecycleEvent : null,
    isPlainObject(context.pipelineContext) ? context.pipelineContext.lifecycleEvent : null
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const advisoryEvent = normalizeAdvisoryLifecycleEvent(candidates[i]);
    if (advisoryEvent != null) {
      return {
        lifecycleEvent: advisoryEvent,
        lifecycleConfidence: CONFIDENCE_LEVELS.HIGH,
        resolutionReason: RESOLUTION_REASONS.EXPLICIT_ADVISORY_EVENT,
        signal: "explicit:advisoryLifecycleEvent"
      };
    }
  }

  return null;
}

function extractDomainEventType(context) {
  const candidates = [
    { value: context.eventType, reason: RESOLUTION_REASONS.DOMAIN_EVENT_TYPE_MAPPED },
    {
      value: isPlainObject(context.eligibility) ? context.eligibility.eventType : null,
      reason: RESOLUTION_REASONS.ELIGIBILITY_EVENT_TYPE
    },
    {
      value: isPlainObject(context.workflowContext) ? context.workflowContext.eventType : null,
      reason: RESOLUTION_REASONS.WORKFLOW_CONTEXT_SIGNAL
    },
    {
      value: isPlainObject(context.pageMetadata) ? context.pageMetadata.eventType : null,
      reason: RESOLUTION_REASONS.PAGE_METADATA_SIGNAL
    },
    {
      value: isPlainObject(context.pipelineContext) ? context.pipelineContext.eventType : null,
      reason: RESOLUTION_REASONS.PIPELINE_CONTEXT_SIGNAL
    },
    {
      value: isPlainObject(context.processorResult) ? context.processorResult.eventType : null,
      reason: RESOLUTION_REASONS.WORKFLOW_CONTEXT_SIGNAL
    }
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const mapped = mapDomainEventType(candidates[i].value);
    if (mapped != null) {
      return {
        lifecycleEvent: mapped,
        lifecycleConfidence: CONFIDENCE_LEVELS.HIGH,
        resolutionReason: candidates[i].reason,
        signal: `domain:${normalizeKey(candidates[i].value)}`,
        sourceEventType: normalizeKey(candidates[i].value)
      };
    }
  }

  return null;
}

function extractPipelineCompletionSignal(pipelineContext) {
  if (!isPlainObject(pipelineContext)) {
    return null;
  }

  const completionFlag =
    pipelineContext.lifecycleCompleted === true ||
    pipelineContext.recruitmentCompleted === true ||
    normalizeKey(pipelineContext.lifecycleStage) === "completed";

  if (!completionFlag) {
    return null;
  }

  return {
    lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
    lifecycleConfidence: CONFIDENCE_LEVELS.MEDIUM,
    resolutionReason: RESOLUTION_REASONS.PIPELINE_CONTEXT_SIGNAL,
    signal: "pipeline:completed"
  };
}

function compareConfidenceRank(confidence) {
  switch (confidence) {
    case CONFIDENCE_LEVELS.HIGH:
      return 4;
    case CONFIDENCE_LEVELS.MEDIUM:
      return 3;
    case CONFIDENCE_LEVELS.LOW:
      return 2;
    case CONFIDENCE_LEVELS.NONE:
    default:
      return 1;
  }
}

function chooseBestCandidate(candidates) {
  let best = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (candidate == null) {
      continue;
    }

    if (best == null) {
      best = candidate;
      continue;
    }

    const candidateRank = compareConfidenceRank(candidate.lifecycleConfidence);
    const bestRank = compareConfidenceRank(best.lifecycleConfidence);
    if (candidateRank > bestRank) {
      best = candidate;
    }
  }

  return best;
}

function buildResolutionResult(candidate, signals) {
  if (candidate == null) {
    return EMPTY_LIFECYCLE_EVENT_RESOLUTION;
  }

  return deepFreeze({
    lifecycleEvent: candidate.lifecycleEvent,
    lifecycleConfidence: candidate.lifecycleConfidence,
    resolutionReason: candidate.resolutionReason,
    sourceEventType: candidate.sourceEventType ?? null,
    signals: Object.freeze(signals.slice()),
    architectureOnly: true,
    advisory: true,
    executed: false
  });
}

/**
 * Resolve an advisory recruitment lifecycle event from workflow-available context.
 * Pure: no I/O, no mutation of input, no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentLifecycleEvent(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({
      ...EMPTY_LIFECYCLE_EVENT_RESOLUTION,
      resolutionReason: RESOLUTION_REASONS.INVALID_INPUT,
      signals: Object.freeze(["invalid:input"])
    });
  }

  const signals = [];
  const candidates = [];

  const explicit = extractExplicitAdvisoryEvent(context);
  if (explicit != null) {
    candidates.push(explicit);
    signals.push(explicit.signal);
  }

  const domainMapped = extractDomainEventType(context);
  if (domainMapped != null) {
    candidates.push(domainMapped);
    signals.push(domainMapped.signal);
  }

  const pipelineCompletion = extractPipelineCompletionSignal(context.pipelineContext);
  if (pipelineCompletion != null) {
    candidates.push(pipelineCompletion);
    signals.push(pipelineCompletion.signal);
  }

  const metadataText = collectMetadataText(context.pageMetadata);
  const metadataSignal = detectMetadataSignal(metadataText);
  if (metadataSignal != null) {
    candidates.push(metadataSignal);
    signals.push(metadataSignal.signal);
  }

  const recruitmentSignal = detectRecruitmentMetadataSignal(context.recruitmentMetadata);
  if (recruitmentSignal != null) {
    candidates.push(recruitmentSignal);
    signals.push(recruitmentSignal.signal);
  }

  const best = chooseBestCandidate(candidates);
  return buildResolutionResult(best, signals);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isLifecycleEventResolutionResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.lifecycleEvent === "string" &&
    SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.lifecycleEvent) &&
    typeof value.lifecycleConfidence === "string" &&
    SUPPORTED_CONFIDENCE_LEVELS.has(value.lifecycleConfidence) &&
    typeof value.resolutionReason === "string" &&
    SUPPORTED_RESOLUTION_REASONS.has(value.resolutionReason) &&
    ("sourceEventType" in value ? value.sourceEventType == null || typeof value.sourceEventType === "string" : true) &&
    Array.isArray(value.signals) &&
    value.architectureOnly === true &&
    value.advisory === true &&
    value.executed === false
  );
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateLifecycleEventResolutionResult(result) {
  if (!isLifecycleEventResolutionResult(result)) {
    return buildValidationResult(["INVALID_RESOLUTION_SHAPE"]);
  }

  return buildValidationResult([]);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeLifecycleEventResolutionResult(result) {
  const validation = validateLifecycleEventResolutionResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
      entity: RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY,
      valid: false,
      lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
      lifecycleConfidence: CONFIDENCE_LEVELS.NONE,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
    entity: RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY,
    valid: true,
    lifecycleEvent: result.lifecycleEvent,
    lifecycleConfidence: result.lifecycleConfidence,
    resolutionReason: result.resolutionReason,
    sourceEventType: result.sourceEventType,
    signalCount: result.signals.length,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_PHASE,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLUTION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RESOLUTION_REASONS,
  SUPPORTED_RESOLUTION_REASONS,
  DOMAIN_EVENT_TYPE_MAP,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_EVENT_RESOLVER_METADATA,
  VALIDATION_STATUS,
  EMPTY_LIFECYCLE_EVENT_RESOLUTION,
  normalizeAdvisoryLifecycleEvent,
  mapDomainEventType,
  resolveRecruitmentLifecycleEvent,
  isLifecycleEventResolutionResult,
  validateLifecycleEventResolutionResult,
  summarizeLifecycleEventResolutionResult
};
