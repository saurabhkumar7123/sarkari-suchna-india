"use strict";

/**
 * Phase 64 — Recruitment Lifecycle Contracts (foundation).
 *
 * Pure descriptive library defining immutable lifecycle transition contracts
 * for recruitment events. Builds conceptually on Phase 63 domain model
 * vocabulary without import coupling.
 *
 * No runtime integration. No Express. No database. No filesystem. No environment
 * variables. No imports from other recruitment modules.
 */

const LIFECYCLE_CONTRACTS_PHASE = 64;

/**
 * Stage groups aligned with recruitmentDomainModel.LIFECYCLE_STAGE_GROUPS (no import).
 */
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

/**
 * Lifecycle event contract catalog.
 * Each entry describes advisory transition metadata — not executable routing.
 */
const LIFECYCLE_EVENT_CONTRACTS = Object.freeze([
  Object.freeze({
    id: "notification",
    eventType: "notification",
    order: 10,
    label: "Notification",
    stageGroup: LIFECYCLE_STAGE_GROUPS.ANNOUNCEMENT,
    previousEvents: Object.freeze([]),
    nextEvents: Object.freeze([
      "application_window",
      "correction",
      "exam_date"
    ]),
    optionalPredecessors: Object.freeze(["short_notification"]),
    allowedSuccessors: Object.freeze([
      "application_window",
      "correction",
      "exam_date"
    ]),
    repeatable: false,
    primary: true,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Primary identity-anchor event establishing recruitment advertisement context.",
      "Typically the first persisted lifecycle event for a recruitment cycle."
    ])
  }),
  Object.freeze({
    id: "short_notification",
    eventType: "short_notification",
    order: 12,
    label: "Short Notification",
    stageGroup: LIFECYCLE_STAGE_GROUPS.ANNOUNCEMENT,
    previousEvents: Object.freeze([]),
    nextEvents: Object.freeze(["notification", "correction", "exam_date"]),
    optionalPredecessors: Object.freeze([]),
    allowedSuccessors: Object.freeze([
      "notification",
      "application_window",
      "correction",
      "exam_date"
    ]),
    repeatable: false,
    primary: true,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Alternate primary event; may precede or substitute for a full notification.",
      "May transition to a full notification before examination stages."
    ])
  }),
  Object.freeze({
    id: "application_window",
    eventType: null,
    order: 15,
    label: "Application Period",
    stageGroup: LIFECYCLE_STAGE_GROUPS.APPLICATION,
    previousEvents: Object.freeze(["notification", "short_notification"]),
    nextEvents: Object.freeze(["correction", "exam_date"]),
    optionalPredecessors: Object.freeze(["correction"]),
    allowedSuccessors: Object.freeze(["correction", "exam_date"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: true,
    advisoryNotes: Object.freeze([
      "Conceptual stage — not a persisted event type.",
      "Describes the application window between announcement and examination scheduling."
    ])
  }),
  Object.freeze({
    id: "correction",
    eventType: "correction",
    order: 20,
    label: "Correction / Corrigendum",
    stageGroup: LIFECYCLE_STAGE_GROUPS.CORRECTION,
    previousEvents: Object.freeze(["notification", "short_notification"]),
    nextEvents: Object.freeze(["exam_date", "admit_card", "result"]),
    optionalPredecessors: Object.freeze([
      "correction",
      "notification",
      "short_notification",
      "application_window",
      "exam_date",
      "city_intimation",
      "admit_card",
      "answer_key",
      "objection",
      "result",
      "dv"
    ]),
    allowedSuccessors: Object.freeze([
      "correction",
      "exam_date",
      "city_intimation",
      "admit_card",
      "answer_key",
      "objection",
      "result",
      "final_result"
    ]),
    repeatable: true,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "May amend any prior stage; repeatable when multiple corrigenda are issued.",
      "Allowed successors depend on which stage is being corrected."
    ])
  }),
  Object.freeze({
    id: "exam_date",
    eventType: "exam_date",
    order: 30,
    label: "Exam Date",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    previousEvents: Object.freeze(["notification", "short_notification", "correction"]),
    nextEvents: Object.freeze(["city_intimation", "admit_card"]),
    optionalPredecessors: Object.freeze(["application_window", "exam_date"]),
    allowedSuccessors: Object.freeze([
      "correction",
      "exam_date",
      "city_intimation",
      "admit_card"
    ]),
    repeatable: true,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Schedule publication or revision; repeatable when dates are rescheduled.",
      "May skip city intimation and proceed directly to admit card."
    ])
  }),
  Object.freeze({
    id: "city_intimation",
    eventType: "city_intimation",
    order: 35,
    label: "City Intimation",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    previousEvents: Object.freeze(["exam_date"]),
    nextEvents: Object.freeze(["admit_card"]),
    optionalPredecessors: Object.freeze(["correction"]),
    allowedSuccessors: Object.freeze(["correction", "admit_card"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Optional examination sub-stage between exam date and admit card release."
    ])
  }),
  Object.freeze({
    id: "admit_card",
    eventType: "admit_card",
    order: 40,
    label: "Admit Card",
    stageGroup: LIFECYCLE_STAGE_GROUPS.EXAMINATION,
    previousEvents: Object.freeze(["exam_date", "city_intimation"]),
    nextEvents: Object.freeze(["answer_key"]),
    optionalPredecessors: Object.freeze(["correction"]),
    allowedSuccessors: Object.freeze(["correction", "answer_key"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Hall ticket release; precedes post-examination stages."
    ])
  }),
  Object.freeze({
    id: "answer_key",
    eventType: "answer_key",
    order: 50,
    label: "Answer Key",
    stageGroup: LIFECYCLE_STAGE_GROUPS.POST_EXAMINATION,
    previousEvents: Object.freeze(["admit_card"]),
    nextEvents: Object.freeze(["objection", "result"]),
    optionalPredecessors: Object.freeze(["exam_date", "correction"]),
    allowedSuccessors: Object.freeze(["correction", "objection", "result"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Published after examination; may be followed by objection window or direct result."
    ])
  }),
  Object.freeze({
    id: "objection",
    eventType: "objection",
    order: 55,
    label: "Objection Window",
    stageGroup: LIFECYCLE_STAGE_GROUPS.POST_EXAMINATION,
    previousEvents: Object.freeze(["answer_key"]),
    nextEvents: Object.freeze(["result"]),
    optionalPredecessors: Object.freeze(["correction"]),
    allowedSuccessors: Object.freeze(["correction", "result"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Optional candidate objection period against provisional answer key."
    ])
  }),
  Object.freeze({
    id: "result",
    eventType: "result",
    order: 60,
    label: "Result",
    stageGroup: LIFECYCLE_STAGE_GROUPS.RESULTS,
    previousEvents: Object.freeze(["answer_key", "objection"]),
    nextEvents: Object.freeze(["final_result", "dv", "medical"]),
    optionalPredecessors: Object.freeze(["correction", "admit_card", "result"]),
    allowedSuccessors: Object.freeze([
      "correction",
      "result",
      "final_result",
      "dv",
      "medical"
    ]),
    repeatable: true,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Preliminary or stage-wise result; may branch to verification or final result.",
      "Repeatable when revised results are published."
    ])
  }),
  Object.freeze({
    id: "final_result",
    eventType: "final_result",
    order: 70,
    label: "Final Result",
    stageGroup: LIFECYCLE_STAGE_GROUPS.RESULTS,
    previousEvents: Object.freeze(["result", "dv"]),
    nextEvents: Object.freeze(["joining", "medical"]),
    optionalPredecessors: Object.freeze(["medical", "correction"]),
    allowedSuccessors: Object.freeze(["medical", "joining"]),
    repeatable: false,
    primary: false,
    terminal: true,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Terminal merit outcome; may precede joining or medical examination.",
      "Marks recruitment results stage completion in many cycles."
    ])
  }),
  Object.freeze({
    id: "dv",
    eventType: "dv",
    order: 80,
    label: "Document Verification",
    stageGroup: LIFECYCLE_STAGE_GROUPS.VERIFICATION,
    previousEvents: Object.freeze(["result"]),
    nextEvents: Object.freeze(["medical", "final_result", "joining"]),
    optionalPredecessors: Object.freeze(["answer_key", "correction"]),
    allowedSuccessors: Object.freeze([
      "correction",
      "medical",
      "final_result",
      "joining"
    ]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Verification stage; ordering relative to final result varies by recruitment."
    ])
  }),
  Object.freeze({
    id: "medical",
    eventType: "medical",
    order: 85,
    label: "Medical Examination",
    stageGroup: LIFECYCLE_STAGE_GROUPS.VERIFICATION,
    previousEvents: Object.freeze(["dv", "result"]),
    nextEvents: Object.freeze(["joining", "final_result"]),
    optionalPredecessors: Object.freeze(["result", "final_result", "correction"]),
    allowedSuccessors: Object.freeze(["joining", "final_result"]),
    repeatable: false,
    primary: false,
    terminal: false,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Medical fitness stage; may follow DV or parallel result pathways."
    ])
  }),
  Object.freeze({
    id: "joining",
    eventType: "joining",
    order: 90,
    label: "Joining / Appointment",
    stageGroup: LIFECYCLE_STAGE_GROUPS.COMPLETION,
    previousEvents: Object.freeze(["final_result", "medical", "dv"]),
    nextEvents: Object.freeze([]),
    optionalPredecessors: Object.freeze(["correction", "result"]),
    allowedSuccessors: Object.freeze([]),
    repeatable: false,
    primary: false,
    terminal: true,
    conceptual: false,
    advisoryNotes: Object.freeze([
      "Terminal completion event — appointment or joining instructions.",
      "No further lifecycle successors in the standard contract graph."
    ])
  })
]);

const LIFECYCLE_EVENT_CONTRACT_BY_ID = Object.freeze(
  LIFECYCLE_EVENT_CONTRACTS.reduce((acc, contract) => {
    acc[contract.id] = contract;
    return acc;
  }, {})
);

const SUPPORTED_LIFECYCLE_CONTRACT_IDS = Object.freeze(
  new Set(LIFECYCLE_EVENT_CONTRACTS.map((contract) => contract.id))
);

const PRIMARY_LIFECYCLE_CONTRACT_IDS = Object.freeze(
  LIFECYCLE_EVENT_CONTRACTS.filter((contract) => contract.primary).map(
    (contract) => contract.id
  )
);

const TERMINAL_LIFECYCLE_CONTRACT_IDS = Object.freeze(
  LIFECYCLE_EVENT_CONTRACTS.filter((contract) => contract.terminal).map(
    (contract) => contract.id
  )
);

const LIFECYCLE_CONTRACT_METADATA = Object.freeze({
  phase: LIFECYCLE_CONTRACTS_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false,
  buildsOnDomainModelPhase: 63,
  contractCount: LIFECYCLE_EVENT_CONTRACTS.length,
  primaryContractIds: PRIMARY_LIFECYCLE_CONTRACT_IDS,
  terminalContractIds: TERMINAL_LIFECYCLE_CONTRACT_IDS
});

function normalizeEventId(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @param {string} lifecycleEventId
 * @returns {Readonly<Object>|null}
 */
function getLifecycleEventContract(lifecycleEventId) {
  const normalized = normalizeEventId(lifecycleEventId);
  if (normalized == null) {
    return null;
  }
  return LIFECYCLE_EVENT_CONTRACT_BY_ID[normalized] ?? null;
}

/**
 * @returns {readonly Object[]}
 */
function listLifecycleEventContractsInOrder() {
  return LIFECYCLE_EVENT_CONTRACTS;
}

/**
 * Advisory transition check — reads contract metadata only.
 * @param {string|null|undefined} fromEventId
 * @param {string|null|undefined} toEventId
 * @returns {boolean}
 */
function isValidLifecycleTransition(fromEventId, toEventId) {
  const from = normalizeEventId(fromEventId);
  const to = normalizeEventId(toEventId);

  if (to == null || !SUPPORTED_LIFECYCLE_CONTRACT_IDS.has(to)) {
    return false;
  }

  const toContract = LIFECYCLE_EVENT_CONTRACT_BY_ID[to];

  if (from == null) {
    return toContract.primary === true;
  }

  if (!SUPPORTED_LIFECYCLE_CONTRACT_IDS.has(from)) {
    return false;
  }

  if (from === to) {
    return toContract.repeatable === true;
  }

  const fromContract = LIFECYCLE_EVENT_CONTRACT_BY_ID[from];
  return fromContract.allowedSuccessors.includes(to);
}

/**
 * @param {string|null|undefined} lifecycleEventId
 * @returns {readonly string[]}
 */
function getNextLifecycleEvents(lifecycleEventId) {
  const normalized = normalizeEventId(lifecycleEventId);
  if (normalized == null) {
    return Object.freeze(
      LIFECYCLE_EVENT_CONTRACTS.filter((contract) => contract.primary).map(
        (contract) => contract.id
      )
    );
  }

  const contract = LIFECYCLE_EVENT_CONTRACT_BY_ID[normalized];
  if (contract == null) {
    return Object.freeze([]);
  }

  return contract.nextEvents;
}

/**
 * @param {string|null|undefined} lifecycleEventId
 * @returns {readonly string[]}
 */
function getPreviousLifecycleEvents(lifecycleEventId) {
  const normalized = normalizeEventId(lifecycleEventId);
  if (normalized == null) {
    return Object.freeze([]);
  }

  const contract = LIFECYCLE_EVENT_CONTRACT_BY_ID[normalized];
  if (contract == null) {
    return Object.freeze([]);
  }

  return contract.previousEvents;
}

/**
 * @param {string|null|undefined} fromEventId
 * @param {string|null|undefined} toEventId
 * @returns {boolean}
 */
function isTerminalTransition(fromEventId, toEventId) {
  const to = normalizeEventId(toEventId);
  if (to == null) {
    return false;
  }

  const toContract = LIFECYCLE_EVENT_CONTRACT_BY_ID[to];
  if (toContract == null || toContract.terminal !== true) {
    return false;
  }

  return isValidLifecycleTransition(fromEventId, to);
}

/**
 * @param {string|null|undefined} fromEventId
 * @param {string|null|undefined} toEventId
 * @returns {boolean}
 */
function isPrimaryTransition(fromEventId, toEventId) {
  const from = normalizeEventId(fromEventId);
  const to = normalizeEventId(toEventId);

  if (to == null) {
    return false;
  }

  const toContract = LIFECYCLE_EVENT_CONTRACT_BY_ID[to];
  if (toContract == null || toContract.primary !== true) {
    return false;
  }

  if (from != null) {
    return false;
  }

  return isValidLifecycleTransition(from, to);
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentLifecycleContracts() {
  return Object.freeze({
    phase: LIFECYCLE_CONTRACTS_PHASE,
    contractCount: LIFECYCLE_EVENT_CONTRACTS.length,
    primaryContractIds: PRIMARY_LIFECYCLE_CONTRACT_IDS,
    terminalContractIds: TERMINAL_LIFECYCLE_CONTRACT_IDS,
    stageGroupCount: Object.keys(LIFECYCLE_STAGE_GROUPS).length,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    buildsOnDomainModelPhase: 63
  });
}

module.exports = {
  LIFECYCLE_CONTRACTS_PHASE,
  LIFECYCLE_STAGE_GROUPS,
  LIFECYCLE_EVENT_CONTRACTS,
  LIFECYCLE_EVENT_CONTRACT_BY_ID,
  SUPPORTED_LIFECYCLE_CONTRACT_IDS,
  PRIMARY_LIFECYCLE_CONTRACT_IDS,
  TERMINAL_LIFECYCLE_CONTRACT_IDS,
  LIFECYCLE_CONTRACT_METADATA,
  getLifecycleEventContract,
  listLifecycleEventContractsInOrder,
  isValidLifecycleTransition,
  getNextLifecycleEvents,
  getPreviousLifecycleEvents,
  isTerminalTransition,
  isPrimaryTransition,
  summarizeRecruitmentLifecycleContracts
};
