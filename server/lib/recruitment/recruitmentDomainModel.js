"use strict";

/**
 * Phase 63 — Recruitment Domain Model (foundation).
 *
 * Pure descriptive library defining immutable recruitment business-domain
 * metadata: entity shapes, lifecycle events, primary/terminal event concepts,
 * and publication states.
 *
 * No runtime integration. No Express. No database. No filesystem. No environment
 * variables. No imports from other recruitment modules — alignment with existing
 * enums is documented inline without coupling.
 */

const DOMAIN_MODEL_PHASE = 63;

/**
 * Parent recruitment lifecycle states.
 * Aligned with recruitments.lifecycle_state ENUM (no import coupling).
 */
const RECRUITMENT_LIFECYCLE_STATES = Object.freeze([
  "announced",
  "open",
  "exam_scheduled",
  "post_exam",
  "results",
  "closed"
]);

const DEFAULT_RECRUITMENT_LIFECYCLE_STATE = "announced";

/**
 * Publication states describe how recruitment content is exposed.
 * Descriptive metadata only — not yet persisted as a database column.
 */
const PUBLICATION_STATES = Object.freeze({
  DRAFT: "draft",
  PENDING_REVIEW: "pending_review",
  PUBLISHED: "published",
  UNPUBLISHED: "unpublished",
  ARCHIVED: "archived"
});

const SUPPORTED_PUBLICATION_STATES = Object.freeze(
  new Set(Object.values(PUBLICATION_STATES))
);

const DEFAULT_PUBLICATION_STATE = PUBLICATION_STATES.DRAFT;

/**
 * Lifecycle event type keys.
 * Aligned with recruitmentEvent.service.EVENT_TYPES and
 * eventTypeClassifier.LIFECYCLE_EVENT_TYPES (no import coupling).
 */
const LIFECYCLE_EVENT_TYPES = Object.freeze([
  "notification",
  "short_notification",
  "correction",
  "exam_date",
  "city_intimation",
  "admit_card",
  "answer_key",
  "objection",
  "result",
  "final_result",
  "dv",
  "medical",
  "joining"
]);

const SUPPORTED_LIFECYCLE_EVENT_TYPES = Object.freeze(
  new Set(LIFECYCLE_EVENT_TYPES)
);

/**
 * Recruitment event row statuses.
 * Aligned with recruitmentEvent.service.EVENT_STATUSES (no import coupling).
 */
const RECRUITMENT_EVENT_STATUSES = Object.freeze([
  "pending",
  "active",
  "superseded",
  "cancelled"
]);

const DEFAULT_RECRUITMENT_EVENT_STATUS = "pending";

const LIFECYCLE_STAGE_GROUPS = Object.freeze({
  ANNOUNCEMENT: "announcement",
  APPLICATION: "application",
  CORRECTION: "correction",
  EXAMINATION: "examination",
  POST_EXAMINATION: "post_examination",
  RESULTS: "results",
  VERIFICATION: "verification",
  COMPLETION: "completion"
});

const SUPPORTED_LIFECYCLE_STAGE_GROUPS = Object.freeze(
  new Set(Object.values(LIFECYCLE_STAGE_GROUPS))
);

/**
 * Ordered descriptive lifecycle catalog covering common recruitment stages.
 * Metadata only — not executable business logic.
 */
const LIFECYCLE_EVENTS = Object.freeze([
  Object.freeze({
    id: "notification",
    eventType: "notification",
    order: 10,
    label: "Notification",
    description:
      "Primary advertisement or detailed notification announcing the recruitment.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.ANNOUNCEMENT,
    typicalRecruitmentStates: Object.freeze(["announced", "open"]),
    conceptual: false
  }),
  Object.freeze({
    id: "short_notification",
    eventType: "short_notification",
    order: 12,
    label: "Short Notification",
    description:
      "Condensed notification or employment notice preceding or supplementing the full advertisement.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.ANNOUNCEMENT,
    typicalRecruitmentStates: Object.freeze(["announced", "open"]),
    conceptual: false
  }),
  Object.freeze({
    id: "application_window",
    eventType: null,
    order: 15,
    label: "Application Period",
    description:
      "Conceptual stage covering the window during which candidates may apply after notification.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.APPLICATION,
    typicalRecruitmentStates: Object.freeze(["open"]),
    relatedEventTypes: Object.freeze([
      "notification",
      "short_notification",
      "correction"
    ]),
    conceptual: true
  }),
  Object.freeze({
    id: "correction",
    eventType: "correction",
    order: 20,
    label: "Correction / Corrigendum",
    description:
      "Amendment, corrigendum, or clarification to an earlier notification or schedule.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.CORRECTION,
    typicalRecruitmentStates: Object.freeze(["announced", "open", "exam_scheduled"]),
    conceptual: false
  }),
  Object.freeze({
    id: "exam_date",
    eventType: "exam_date",
    order: 30,
    label: "Exam Date",
    description: "Scheduled examination date or revised exam schedule notice.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    typicalRecruitmentStates: Object.freeze(["exam_scheduled"]),
    conceptual: false
  }),
  Object.freeze({
    id: "city_intimation",
    eventType: "city_intimation",
    order: 35,
    label: "City Intimation",
    description: "Exam city or centre intimation prior to admit card release.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    typicalRecruitmentStates: Object.freeze(["exam_scheduled"]),
    conceptual: false
  }),
  Object.freeze({
    id: "admit_card",
    eventType: "admit_card",
    order: 40,
    label: "Admit Card",
    description: "Hall ticket or admit card release for eligible candidates.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    typicalRecruitmentStates: Object.freeze(["exam_scheduled"]),
    conceptual: false
  }),
  Object.freeze({
    id: "answer_key",
    eventType: "answer_key",
    order: 50,
    label: "Answer Key",
    description: "Provisional or final answer key publication after the examination.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.POST_EXAMINATION,
    typicalRecruitmentStates: Object.freeze(["post_exam"]),
    conceptual: false
  }),
  Object.freeze({
    id: "objection",
    eventType: "objection",
    order: 55,
    label: "Objection Window",
    description: "Window for candidates to raise objections against the answer key.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.POST_EXAMINATION,
    typicalRecruitmentStates: Object.freeze(["post_exam"]),
    conceptual: false
  }),
  Object.freeze({
    id: "result",
    eventType: "result",
    order: 60,
    label: "Result",
    description: "Written or preliminary examination result publication.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.RESULTS,
    typicalRecruitmentStates: Object.freeze(["results", "post_exam"]),
    conceptual: false
  }),
  Object.freeze({
    id: "final_result",
    eventType: "final_result",
    order: 70,
    label: "Final Result",
    description: "Final merit list or consolidated final result after all stages.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.RESULTS,
    typicalRecruitmentStates: Object.freeze(["results", "closed"]),
    conceptual: false
  }),
  Object.freeze({
    id: "dv",
    eventType: "dv",
    order: 80,
    label: "Document Verification",
    description: "Document verification schedule, call letter, or outcome.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.VERIFICATION,
    typicalRecruitmentStates: Object.freeze(["results", "post_exam"]),
    conceptual: false
  }),
  Object.freeze({
    id: "medical",
    eventType: "medical",
    order: 85,
    label: "Medical Examination",
    description: "Medical fitness examination schedule or outcome.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.VERIFICATION,
    typicalRecruitmentStates: Object.freeze(["results", "closed"]),
    conceptual: false
  }),
  Object.freeze({
    id: "joining",
    eventType: "joining",
    order: 90,
    label: "Joining / Appointment",
    description: "Appointment letter, joining instructions, or joining schedule.",
    stageGroup: LIFECYCLE_STAGE_GROUPS.COMPLETION,
    typicalRecruitmentStates: Object.freeze(["closed"]),
    conceptual: false
  })
]);

const LIFECYCLE_EVENT_BY_ID = Object.freeze(
  LIFECYCLE_EVENTS.reduce((acc, descriptor) => {
    acc[descriptor.id] = descriptor;
    return acc;
  }, {})
);

const LIFECYCLE_EVENT_BY_TYPE = Object.freeze(
  LIFECYCLE_EVENTS.reduce((acc, descriptor) => {
    if (descriptor.eventType != null) {
      acc[descriptor.eventType] = descriptor;
    }
    return acc;
  }, {})
);

/**
 * Primary event concept — the event that establishes recruitment identity.
 */
const PRIMARY_EVENT_CONCEPT = Object.freeze({
  id: "primary_event",
  role: "identity_anchor",
  description:
    "The first authoritative lifecycle event that establishes a recruitment's identity and advertisement context.",
  primaryEventType: "notification",
  alternateEventTypes: Object.freeze(["short_notification"]),
  typicalOrder: 10,
  establishesRecruitment: true
});

/**
 * Terminal event concept — events that mark recruitment completion.
 */
const TERMINAL_EVENT_CONCEPT = Object.freeze({
  id: "terminal_event",
  role: "completion_marker",
  description:
    "Lifecycle events that typically mark the end of an active recruitment cycle.",
  terminalEventTypes: Object.freeze(["final_result", "joining"]),
  typicalRecruitmentState: "closed",
  closesRecruitment: true
});

/**
 * Publication state concept — how recruitment-facing content is exposed.
 */
const PUBLICATION_STATE_CONCEPT = Object.freeze({
  id: "publication_state",
  role: "content_exposure",
  description:
    "Describes whether recruitment-related content is visible to end users independent of lifecycle progression.",
  states: PUBLICATION_STATES,
  supportedStates: SUPPORTED_PUBLICATION_STATES,
  defaultState: DEFAULT_PUBLICATION_STATE,
  terminalStates: Object.freeze([
    PUBLICATION_STATES.UNPUBLISHED,
    PUBLICATION_STATES.ARCHIVED
  ])
});

const RECRUITMENT_FIELD_DESCRIPTORS = Object.freeze({
  id: Object.freeze({
    name: "id",
    type: "integer",
    required: false,
    persisted: true,
    description: "Surrogate primary key when persisted."
  }),
  title: Object.freeze({
    name: "title",
    type: "string",
    required: true,
    persisted: true,
    description: "Human-readable recruitment title."
  }),
  slug: Object.freeze({
    name: "slug",
    type: "string",
    required: true,
    persisted: true,
    description: "Unique URL-safe identifier."
  }),
  department: Object.freeze({
    name: "department",
    type: "string",
    required: false,
    persisted: true,
    description: "Issuing department or organization."
  }),
  post_name: Object.freeze({
    name: "post_name",
    type: "string",
    required: false,
    persisted: true,
    description: "Post or examination name."
  }),
  advertisement_no: Object.freeze({
    name: "advertisement_no",
    type: "string",
    required: false,
    persisted: true,
    description: "Official advertisement or notification number."
  }),
  cycle_year: Object.freeze({
    name: "cycle_year",
    type: "integer",
    required: false,
    persisted: true,
    description: "Recruitment cycle year."
  }),
  lifecycle_state: Object.freeze({
    name: "lifecycle_state",
    type: "enum",
    required: true,
    persisted: true,
    allowedValues: RECRUITMENT_LIFECYCLE_STATES,
    defaultValue: DEFAULT_RECRUITMENT_LIFECYCLE_STATE,
    description: "Current coarse-grained lifecycle position of the recruitment."
  }),
  publication_state: Object.freeze({
    name: "publication_state",
    type: "enum",
    required: false,
    persisted: false,
    allowedValues: SUPPORTED_PUBLICATION_STATES,
    defaultValue: DEFAULT_PUBLICATION_STATE,
    description: "Descriptive publication exposure state (domain model only)."
  }),
  created_at: Object.freeze({
    name: "created_at",
    type: "datetime",
    required: false,
    persisted: true,
    description: "Record creation timestamp when persisted."
  }),
  updated_at: Object.freeze({
    name: "updated_at",
    type: "datetime",
    required: false,
    persisted: true,
    description: "Record update timestamp when persisted."
  })
});

const RECRUITMENT_EVENT_FIELD_DESCRIPTORS = Object.freeze({
  id: Object.freeze({
    name: "id",
    type: "integer",
    required: false,
    persisted: true,
    description: "Surrogate primary key when persisted."
  }),
  recruitment_id: Object.freeze({
    name: "recruitment_id",
    type: "integer",
    required: true,
    persisted: true,
    description: "Foreign key to the parent recruitment."
  }),
  event_type: Object.freeze({
    name: "event_type",
    type: "enum",
    required: true,
    persisted: true,
    allowedValues: LIFECYCLE_EVENT_TYPES,
    description: "Lifecycle event type key."
  }),
  sequence_order: Object.freeze({
    name: "sequence_order",
    type: "integer",
    required: false,
    persisted: true,
    defaultValue: 0,
    description: "Ordering hint within a recruitment's event timeline."
  }),
  status: Object.freeze({
    name: "status",
    type: "enum",
    required: false,
    persisted: true,
    allowedValues: RECRUITMENT_EVENT_STATUSES,
    defaultValue: DEFAULT_RECRUITMENT_EVENT_STATUS,
    description: "Event row status."
  }),
  publication_state: Object.freeze({
    name: "publication_state",
    type: "enum",
    required: false,
    persisted: false,
    allowedValues: SUPPORTED_PUBLICATION_STATES,
    defaultValue: DEFAULT_PUBLICATION_STATE,
    description: "Descriptive publication exposure state (domain model only)."
  }),
  created_at: Object.freeze({
    name: "created_at",
    type: "datetime",
    required: false,
    persisted: true,
    description: "Record creation timestamp when persisted."
  }),
  updated_at: Object.freeze({
    name: "updated_at",
    type: "datetime",
    required: false,
    persisted: true,
    description: "Record update timestamp when persisted."
  })
});

/**
 * Immutable Recruitment entity descriptor.
 */
const RECRUITMENT = Object.freeze({
  entity: "recruitment",
  domain: "recruitment",
  phase: DOMAIN_MODEL_PHASE,
  description:
    "Parent recruitment aggregate representing a single government job or examination cycle.",
  fields: RECRUITMENT_FIELD_DESCRIPTORS,
  requiredFields: Object.freeze(["title", "slug", "lifecycle_state"]),
  optionalFields: Object.freeze([
    "id",
    "department",
    "post_name",
    "advertisement_no",
    "cycle_year",
    "publication_state",
    "created_at",
    "updated_at"
  ]),
  lifecycleStates: RECRUITMENT_LIFECYCLE_STATES,
  defaultLifecycleState: DEFAULT_RECRUITMENT_LIFECYCLE_STATE,
  publicationConcept: PUBLICATION_STATE_CONCEPT
});

/**
 * Immutable Recruitment Event entity descriptor.
 */
const RECRUITMENT_EVENT = Object.freeze({
  entity: "recruitment_event",
  domain: "recruitment",
  phase: DOMAIN_MODEL_PHASE,
  description:
    "Child lifecycle event bound to a parent recruitment, ordered within its timeline.",
  fields: RECRUITMENT_EVENT_FIELD_DESCRIPTORS,
  requiredFields: Object.freeze(["recruitment_id", "event_type"]),
  optionalFields: Object.freeze([
    "id",
    "sequence_order",
    "status",
    "publication_state",
    "created_at",
    "updated_at"
  ]),
  eventTypes: LIFECYCLE_EVENT_TYPES,
  eventStatuses: RECRUITMENT_EVENT_STATUSES,
  defaultEventStatus: DEFAULT_RECRUITMENT_EVENT_STATUS,
  primaryEventConcept: PRIMARY_EVENT_CONCEPT,
  terminalEventConcept: TERMINAL_EVENT_CONCEPT,
  publicationConcept: PUBLICATION_STATE_CONCEPT
});

const DOMAIN_MODEL_METADATA = Object.freeze({
  phase: DOMAIN_MODEL_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false
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

function listRequiredFieldNames(descriptor) {
  return Object.values(descriptor.fields)
    .filter((field) => field.required)
    .map((field) => field.name)
    .sort((a, b) => a.localeCompare(b));
}

function hasOwnFields(value, fieldNames) {
  return fieldNames.every((name) =>
    Object.prototype.hasOwnProperty.call(value, name)
  );
}

function fieldValueMatchesDescriptor(value, fieldDescriptor) {
  if (value === undefined || value === null) {
    return !fieldDescriptor.required;
  }

  switch (fieldDescriptor.type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return Number.isInteger(value);
    case "datetime":
      return (
        typeof value === "string" ||
        value instanceof Date ||
        Number.isInteger(value)
      );
    case "enum": {
      const normalized = normalizeString(value);
      if (normalized == null) {
        return !fieldDescriptor.required;
      }
      const allowed = fieldDescriptor.allowedValues;
      if (allowed instanceof Set) {
        return allowed.has(normalized);
      }
      return Array.isArray(allowed) && allowed.includes(normalized);
    }
    default:
      return false;
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentShape(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOwnFields(value, RECRUITMENT.requiredFields)) {
    return false;
  }

  for (const fieldName of RECRUITMENT.requiredFields) {
    const descriptor = RECRUITMENT.fields[fieldName];
    if (!fieldValueMatchesDescriptor(value[fieldName], descriptor)) {
      return false;
    }
  }

  for (const fieldName of RECRUITMENT.optionalFields) {
    if (!Object.prototype.hasOwnProperty.call(value, fieldName)) {
      continue;
    }
    const descriptor = RECRUITMENT.fields[fieldName];
    if (descriptor == null) {
      return false;
    }
    if (!fieldValueMatchesDescriptor(value[fieldName], descriptor)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentEventShape(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOwnFields(value, RECRUITMENT_EVENT.requiredFields)) {
    return false;
  }

  for (const fieldName of RECRUITMENT_EVENT.requiredFields) {
    const descriptor = RECRUITMENT_EVENT.fields[fieldName];
    if (!fieldValueMatchesDescriptor(value[fieldName], descriptor)) {
      return false;
    }
  }

  for (const fieldName of RECRUITMENT_EVENT.optionalFields) {
    if (!Object.prototype.hasOwnProperty.call(value, fieldName)) {
      continue;
    }
    const descriptor = RECRUITMENT_EVENT.fields[fieldName];
    if (descriptor == null) {
      return false;
    }
    if (!fieldValueMatchesDescriptor(value[fieldName], descriptor)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isLifecycleEventType(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_LIFECYCLE_EVENT_TYPES.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPrimaryEventType(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return false;
  }
  return (
    normalized === PRIMARY_EVENT_CONCEPT.primaryEventType ||
    PRIMARY_EVENT_CONCEPT.alternateEventTypes.includes(normalized)
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isTerminalEventType(value) {
  const normalized = normalizeString(value);
  return (
    normalized != null &&
    TERMINAL_EVENT_CONCEPT.terminalEventTypes.includes(normalized)
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPublicationState(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_PUBLICATION_STATES.has(normalized);
}

/**
 * @param {string} lifecycleEventId
 * @returns {Readonly<Object>|null}
 */
function getLifecycleEventDescriptor(lifecycleEventId) {
  const normalized = normalizeString(lifecycleEventId);
  if (normalized == null) {
    return null;
  }
  return LIFECYCLE_EVENT_BY_ID[normalized] ?? null;
}

/**
 * @param {string} eventType
 * @returns {Readonly<Object>|null}
 */
function getLifecycleEventDescriptorByType(eventType) {
  const normalized = normalizeString(eventType);
  if (normalized == null) {
    return null;
  }
  return LIFECYCLE_EVENT_BY_TYPE[normalized] ?? null;
}

/**
 * Map a lifecycle event type (or conceptual lifecycle event id) to the
 * first typical parent recruitment.lifecycle_state. Returns null when the
 * value is not a known event type and not already a recruitment lifecycle state.
 * Does not invent states or fall back to announced for unknown inputs.
 *
 * @param {string|null|undefined} eventTypeOrStage
 * @returns {string|null}
 */
function getTypicalRecruitmentLifecycleState(eventTypeOrStage) {
  const normalized = normalizeString(eventTypeOrStage);
  if (normalized == null) {
    return DEFAULT_RECRUITMENT_LIFECYCLE_STATE;
  }

  if (RECRUITMENT_LIFECYCLE_STATES.includes(normalized)) {
    return normalized;
  }

  const descriptor =
    LIFECYCLE_EVENT_BY_TYPE[normalized] || LIFECYCLE_EVENT_BY_ID[normalized] || null;
  if (
    descriptor &&
    Array.isArray(descriptor.typicalRecruitmentStates) &&
    descriptor.typicalRecruitmentStates.length > 0
  ) {
    return descriptor.typicalRecruitmentStates[0];
  }

  return null;
}

/**
 * @returns {readonly Object[]}
 */
function listLifecycleEventsInOrder() {
  return LIFECYCLE_EVENTS;
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDomainModel() {
  return Object.freeze({
    phase: DOMAIN_MODEL_PHASE,
    recruitmentEntity: RECRUITMENT.entity,
    recruitmentEventEntity: RECRUITMENT_EVENT.entity,
    lifecycleEventCount: LIFECYCLE_EVENTS.length,
    lifecycleEventTypeCount: LIFECYCLE_EVENT_TYPES.length,
    lifecycleStageGroupCount: SUPPORTED_LIFECYCLE_STAGE_GROUPS.size,
    publicationStateCount: SUPPORTED_PUBLICATION_STATES.size,
    primaryEventType: PRIMARY_EVENT_CONCEPT.primaryEventType,
    terminalEventTypes: TERMINAL_EVENT_CONCEPT.terminalEventTypes,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false
  });
}

module.exports = {
  DOMAIN_MODEL_PHASE,
  RECRUITMENT,
  RECRUITMENT_EVENT,
  RECRUITMENT_LIFECYCLE_STATES,
  DEFAULT_RECRUITMENT_LIFECYCLE_STATE,
  PUBLICATION_STATES,
  SUPPORTED_PUBLICATION_STATES,
  DEFAULT_PUBLICATION_STATE,
  PUBLICATION_STATE_CONCEPT,
  LIFECYCLE_EVENT_TYPES,
  SUPPORTED_LIFECYCLE_EVENT_TYPES,
  LIFECYCLE_EVENTS,
  LIFECYCLE_EVENT_BY_ID,
  LIFECYCLE_EVENT_BY_TYPE,
  LIFECYCLE_STAGE_GROUPS,
  SUPPORTED_LIFECYCLE_STAGE_GROUPS,
  RECRUITMENT_EVENT_STATUSES,
  DEFAULT_RECRUITMENT_EVENT_STATUS,
  PRIMARY_EVENT_CONCEPT,
  TERMINAL_EVENT_CONCEPT,
  DOMAIN_MODEL_METADATA,
  isRecruitmentShape,
  isRecruitmentEventShape,
  isLifecycleEventType,
  isPrimaryEventType,
  isTerminalEventType,
  isPublicationState,
  getLifecycleEventDescriptor,
  getLifecycleEventDescriptorByType,
  getTypicalRecruitmentLifecycleState,
  listLifecycleEventsInOrder,
  summarizeRecruitmentDomainModel
};
