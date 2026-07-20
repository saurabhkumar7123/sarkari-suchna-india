"use strict";

/**
 * Phase 69 — Recruitment Compatibility Layer.
 *
 * First runtime integration point bridging the existing update processing
 * pipeline with the Recruitment Context (Phase 68). Normalizes update metadata,
 * builds immutable compatibility contexts, and exposes advisory summaries
 * without altering update decisions, matching, lifecycle execution, or persistence.
 *
 * Phase 93 — delegates workflow integration to the compatibility integration hook
 * (advisory-only, feature-flagged; coordinator is never invoked directly here).
 *
 * No Express. No database. No filesystem. No network access.
 * Matching execution: false. Lifecycle execution: false. Persistence: false.
 */

const {
  RECRUITMENT_CONTEXT_PHASE,
  DEFAULT_RECRUITMENT_CONTEXT,
  createRecruitmentContext,
  isRecruitmentContext,
  summarizeRecruitmentContext
} = require("./recruitmentContext");

const {
  resolveRecruitmentIdentity,
  summarizeIdentityResolution
} = require("./recruitmentIdentityResolutionEngine");

const {
  createMatchingResult,
  summarizeMatchingResult
} = require("./recruitmentMatchingEngine");

const {
  createRecruitmentActionPlan,
  summarizeRecruitmentActionPlan
} = require("./recruitmentActionPlanner");

const {
  createPersistencePlan,
  summarizePersistencePlan
} = require("./recruitmentPersistenceCoordinator");

const {
  createExecutionDecision,
  summarizeExecutionDecision
} = require("./recruitmentExecutionGateway");

const {
  executeRecruitmentPersistence,
  summarizePersistenceExecutionResult
} = require("./recruitmentPersistenceEngine");

const {
  executePersistenceAdapter,
  summarizePersistenceAdapterResult
} = require("./recruitmentPersistenceAdapter");

const COMPATIBILITY_LAYER_PHASE = 69;

const INTEGRATION_TARGET_ID = "worker";

const ADOPTION_ORDER_ENTRY = Object.freeze({
  order: 2,
  targetId: INTEGRATION_TARGET_ID,
  futureImplementationPhase: COMPATIBILITY_LAYER_PHASE,
  label: "Worker second"
});

const UPDATE_NOTICE_KEYS = Object.freeze(["title", "content", "url"]);

const FOUNDATION_BRIDGE_DESCRIPTORS = Object.freeze([
  Object.freeze({
    updateField: "notice.title",
    foundationSignal: "recruitment_title",
    advisoryOnly: true
  }),
  Object.freeze({
    updateField: "notice.content",
    foundationSignal: "recruitment_title",
    advisoryOnly: true
  }),
  Object.freeze({
    updateField: "notice.url",
    foundationSignal: "source_url",
    advisoryOnly: true
  }),
  Object.freeze({
    updateField: "normalizedUpdate.sourceUrl",
    foundationSignal: "source_url",
    advisoryOnly: true
  }),
  Object.freeze({
    updateField: "normalizedUpdate.updateId",
    foundationSignal: "official_identifier",
    advisoryOnly: true
  })
]);

const RECRUITMENT_COMPATIBILITY_METADATA = Object.freeze({
  phase: COMPATIBILITY_LAYER_PHASE,
  compatibilityOnly: true,
  additiveOnly: true,
  descriptiveOnly: true,
  matchingExecution: false,
  lifecycleExecution: false,
  persistenceEnabled: false,
  sideEffects: false,
  runtimeIntegration: true,
  recruitmentContextPhase: RECRUITMENT_CONTEXT_PHASE,
  integrationTargetId: INTEGRATION_TARGET_ID,
  adoptionOrder: ADOPTION_ORDER_ENTRY.order
});

const RECRUITMENT_COMPATIBILITY_DESCRIPTOR = Object.freeze({
  entity: "recruitment_compatibility_context",
  domain: "recruitment",
  phase: COMPATIBILITY_LAYER_PHASE,
  description:
    "Immutable bridge context aligning normalized update metadata with recruitment foundation vocabulary.",
  integrationTargetId: INTEGRATION_TARGET_ID,
  recruitmentContextPhase: RECRUITMENT_CONTEXT_PHASE,
  metadata: RECRUITMENT_COMPATIBILITY_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

/**
 * Internal compatibility store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const compatibilityByPipelineOutcome = new WeakMap();

/**
 * Internal identity resolution store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const identityResolutionByPipelineOutcome = new WeakMap();

/**
 * Internal matching result store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const matchingResultByPipelineOutcome = new WeakMap();

/**
 * Internal action plan store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const actionPlanByPipelineOutcome = new WeakMap();

/**
 * Internal persistence plan store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const persistencePlanByPipelineOutcome = new WeakMap();

/**
 * Internal execution decision store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const executionDecisionByPipelineOutcome = new WeakMap();

/**
 * Internal persistence execution result store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const persistenceExecutionResultByPipelineOutcome = new WeakMap();

/**
 * Internal persistence adapter result store keyed by pipeline outcome objects.
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const persistenceAdapterResultByPipelineOutcome = new WeakMap();

/**
 * Guards against re-entrant coordinator invocation when Phase 91 observes compatibility.
 * @type {WeakSet<Object>}
 */
const compatibilityIntegrationAttachInProgress = new WeakSet();

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

function normalizePositiveId(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeIsoTimestamp(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? normalized : null;
}

function buildObservedSignalsFromNormalizedUpdate(normalizedUpdate) {
  if (!isPlainObject(normalizedUpdate)) {
    return Object.freeze({});
  }

  const observed = {};
  const notice = isPlainObject(normalizedUpdate.notice) ? normalizedUpdate.notice : null;

  if (notice != null) {
    const title = normalizeString(notice.title);
    if (title != null && title !== "New update") {
      observed.recruitment_title = title;
    }
    const url = normalizeString(notice.url);
    if (url != null) {
      observed.source_url = url;
    }
  }

  const sourceUrl = normalizeString(normalizedUpdate.sourceUrl);
  if (sourceUrl != null) {
    observed.source_url = sourceUrl;
  }

  if (normalizedUpdate.updateId != null) {
    observed.official_identifier = `update:${normalizedUpdate.updateId}`;
  }

  return deepFreeze(observed);
}

function buildIdentityResolutionContext(recruitmentContext, normalizedUpdate) {
  const observedSignals = buildObservedSignalsFromNormalizedUpdate(normalizedUpdate);
  const notice = isPlainObject(normalizedUpdate?.notice) ? normalizedUpdate.notice : null;
  const noticeContent = normalizeString(notice?.content);
  const baseMetadata = isRecruitmentContext(recruitmentContext)
    ? recruitmentContext.metadata
    : {};

  return createRecruitmentContext({
    metadata: deepFreeze({
      ...baseMetadata,
      observedSignals,
      noticeContent,
      resolutionSource: "compatibility_layer"
    })
  });
}

function attachRecruitmentPersistenceAdapterResult(
  pipelineOutcome,
  persistenceExecutionResult
) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const persistenceAdapterResult = executePersistenceAdapter(persistenceExecutionResult);
    if (persistenceAdapterResult != null) {
      persistenceAdapterResultByPipelineOutcome.set(
        pipelineOutcome,
        persistenceAdapterResult
      );
      return persistenceAdapterResult;
    }
  } catch {
    // Phase 77 — persistence adapter is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachRecruitmentPersistenceExecutionResult(pipelineOutcome, executionDecision) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const persistenceExecutionResult = executeRecruitmentPersistence(executionDecision);
    if (persistenceExecutionResult != null) {
      persistenceExecutionResultByPipelineOutcome.set(
        pipelineOutcome,
        persistenceExecutionResult
      );
      attachRecruitmentPersistenceAdapterResult(pipelineOutcome, persistenceExecutionResult);
      return persistenceExecutionResult;
    }
  } catch {
    // Phase 76 — persistence engine is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachRecruitmentExecutionDecision(pipelineOutcome, persistencePlan) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const executionDecision = createExecutionDecision(persistencePlan);
    if (executionDecision != null) {
      executionDecisionByPipelineOutcome.set(pipelineOutcome, executionDecision);
      attachRecruitmentPersistenceExecutionResult(pipelineOutcome, executionDecision);
      return executionDecision;
    }
  } catch {
    // Phase 75 — execution gateway is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachRecruitmentPersistencePlan(pipelineOutcome, actionPlan) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const persistencePlan = createPersistencePlan(actionPlan);
    if (persistencePlan != null) {
      persistencePlanByPipelineOutcome.set(pipelineOutcome, persistencePlan);
      attachRecruitmentExecutionDecision(pipelineOutcome, persistencePlan);
      return persistencePlan;
    }
  } catch {
    // Phase 74 — persistence planning is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachRecruitmentActionPlan(pipelineOutcome, matchingResult) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const actionPlan = createRecruitmentActionPlan(matchingResult);
    if (actionPlan != null) {
      actionPlanByPipelineOutcome.set(pipelineOutcome, actionPlan);
      attachRecruitmentPersistencePlan(pipelineOutcome, actionPlan);
      return actionPlan;
    }
  } catch {
    // Phase 72 — action planning is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachMatchingResult(pipelineOutcome, identityResolution) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const matchingResult = createMatchingResult(identityResolution);
    if (matchingResult != null) {
      matchingResultByPipelineOutcome.set(pipelineOutcome, matchingResult);
      attachRecruitmentActionPlan(pipelineOutcome, matchingResult);
      return matchingResult;
    }
  } catch {
    // Phase 71 — matching is additive only; never alter pipeline behavior.
  }

  return null;
}

function attachIdentityResolution(pipelineOutcome, recruitmentContext, normalizedUpdate) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  try {
    const resolutionContext = buildIdentityResolutionContext(
      recruitmentContext,
      normalizedUpdate
    );
    const resolution = resolveRecruitmentIdentity(resolutionContext);
    if (resolution != null) {
      identityResolutionByPipelineOutcome.set(pipelineOutcome, resolution);
      attachMatchingResult(pipelineOutcome, resolution);
      return resolution;
    }
  } catch {
    // Phase 70 — identity resolution is additive only; never alter pipeline behavior.
  }

  return null;
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

function normalizeNotice(input) {
  const source = isPlainObject(input) ? input : {};
  const title = normalizeString(source.title) ?? "New update";
  const content = normalizeString(source.content) ?? title;
  const url = normalizeString(source.url) ?? "";
  return deepFreeze({
    title,
    content,
    url
  });
}

/**
 * Normalize existing update metadata from pipeline/worker shapes.
 * Pure: no I/O, no mutation of input.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function normalizeUpdateMetadata(input) {
  const source = isPlainObject(input) ? input : {};
  const notice = normalizeNotice(source.notice);
  const sourceUrl = notice.url === "" ? null : notice.url;

  return deepFreeze({
    updateId: normalizePositiveId(source.updateId),
    notice,
    noticePayloadKeys: UPDATE_NOTICE_KEYS,
    sourceUrl,
    titlePresent: notice.title !== "New update" || source.notice != null,
    contentPresent: notice.content !== notice.title || source.notice != null,
    urlPresent: sourceUrl != null,
    createdAt: normalizeIsoTimestamp(source.createdAt),
    siteId: normalizePositiveId(source.siteId),
    siteName: normalizeString(source.siteName),
    siteUrl: normalizeString(source.siteUrl)
  });
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

/**
 * Validate a recruitment compatibility context.
 *
 * @param {*} context
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentCompatibility(context) {
  const reasons = [];

  if (!isPlainObject(context)) {
    return buildValidationResult(["INVALID_CONTEXT_SHAPE"]);
  }

  if (context.phase !== COMPATIBILITY_LAYER_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (context.entity !== RECRUITMENT_COMPATIBILITY_DESCRIPTOR.entity) {
    reasons.push("INVALID_ENTITY");
  }

  if (context.compatibilityOnly !== true || context.additiveOnly !== true) {
    reasons.push("INVALID_COMPATIBILITY_FLAGS");
  }

  if (context.matchingExecution !== false || context.lifecycleExecution !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (context.persistenceEnabled !== false || context.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (context.integrationTargetId !== INTEGRATION_TARGET_ID) {
    reasons.push("INVALID_INTEGRATION_TARGET");
  }

  if (!isPlainObject(context.normalizedUpdate)) {
    reasons.push("MISSING_NORMALIZED_UPDATE");
  } else if (!isPlainObject(context.normalizedUpdate.notice)) {
    reasons.push("MISSING_NOTICE_PAYLOAD");
  }

  if (!isRecruitmentContext(context.recruitmentContext)) {
    reasons.push("INVALID_RECRUITMENT_CONTEXT");
  }

  if (!isPlainObject(context.recruitmentContextSummary)) {
    reasons.push("MISSING_RECRUITMENT_CONTEXT_SUMMARY");
  }

  if (!Array.isArray(context.bridgeDescriptors) || context.bridgeDescriptors.length === 0) {
    reasons.push("MISSING_BRIDGE_DESCRIPTORS");
  }

  return buildValidationResult(reasons);
}

/**
 * Build an immutable recruitment compatibility context.
 * Pure: no matching, no lifecycle execution, no persistence.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>|null}
 */
function buildRecruitmentCompatibilityContext(input) {
  try {
    if (input != null && !isPlainObject(input)) {
      return null;
    }

    const source = isPlainObject(input) ? input : {};

    let recruitmentContext;
    if (source.recruitmentContext != null) {
      if (!isRecruitmentContext(source.recruitmentContext)) {
        return null;
      }
      recruitmentContext = source.recruitmentContext;
    } else {
      recruitmentContext = createRecruitmentContext(source.recruitmentContextInput);
    }

    const normalizedUpdate = normalizeUpdateMetadata(source);
    const recruitmentContextSummary = summarizeRecruitmentContext(recruitmentContext);

    const context = deepFreeze({
      phase: COMPATIBILITY_LAYER_PHASE,
      entity: RECRUITMENT_COMPATIBILITY_DESCRIPTOR.entity,
      compatibilityOnly: true,
      additiveOnly: true,
      descriptiveOnly: true,
      matchingExecution: false,
      lifecycleExecution: false,
      persistenceEnabled: false,
      sideEffects: false,
      integrationTargetId: INTEGRATION_TARGET_ID,
      adoptionOrder: ADOPTION_ORDER_ENTRY,
      normalizedUpdate,
      recruitmentContext,
      recruitmentContextSummary,
      bridgeDescriptors: FOUNDATION_BRIDGE_DESCRIPTORS,
      metadata: deepFreeze({
        ...RECRUITMENT_COMPATIBILITY_METADATA,
        createReason: isPlainObject(source.metadata) ? "customized" : "default",
        normalizedUpdateId: normalizedUpdate.updateId,
        noticeTitle: normalizedUpdate.notice.title,
        noticeUrlPresent: normalizedUpdate.urlPresent
      })
    });

    const validation = validateRecruitmentCompatibility(context);
    if (!validation.valid) {
      return null;
    }

    return context;
  } catch {
    return null;
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentCompatibilityContext(value) {
  return validateRecruitmentCompatibility(value).valid;
}

/**
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentCompatibility(context) {
  if (!isRecruitmentCompatibilityContext(context)) {
    return Object.freeze({
      phase: COMPATIBILITY_LAYER_PHASE,
      entity: RECRUITMENT_COMPATIBILITY_DESCRIPTOR.entity,
      valid: false,
      compatibilityOnly: true,
      additiveOnly: true,
      descriptiveOnly: true,
      matchingExecution: false,
      lifecycleExecution: false,
      persistenceEnabled: false,
      sideEffects: false,
      integrationTargetId: INTEGRATION_TARGET_ID,
      recruitmentContextPhase: RECRUITMENT_CONTEXT_PHASE,
      updateId: null,
      noticeTitle: null,
      noticeUrlPresent: false,
      bridgeDescriptorCount: FOUNDATION_BRIDGE_DESCRIPTORS.length,
      recruitmentContextEntity: DEFAULT_RECRUITMENT_CONTEXT.entity,
      foundationPhases: DEFAULT_RECRUITMENT_CONTEXT.foundationPhases
    });
  }

  const ctx = context;
  return Object.freeze({
    phase: ctx.phase,
    entity: ctx.entity,
    valid: true,
    compatibilityOnly: true,
    additiveOnly: true,
    descriptiveOnly: true,
    matchingExecution: false,
    lifecycleExecution: false,
    persistenceEnabled: false,
    sideEffects: false,
    integrationTargetId: ctx.integrationTargetId,
    recruitmentContextPhase: ctx.recruitmentContext.phase,
    updateId: ctx.normalizedUpdate.updateId,
    noticeTitle: ctx.normalizedUpdate.notice.title,
    noticeUrlPresent: ctx.normalizedUpdate.urlPresent,
    bridgeDescriptorCount: ctx.bridgeDescriptors.length,
    recruitmentContextEntity: ctx.recruitmentContext.entity,
    foundationPhases: ctx.recruitmentContext.foundationPhases,
    lifecycleEventCount: ctx.recruitmentContextSummary.lifecycleEventCount,
    contractCount: ctx.recruitmentContextSummary.contractCount,
    signalCount: ctx.recruitmentContextSummary.signalCount,
    matchSignalCount: ctx.recruitmentContextSummary.matchSignalCount,
    integrationTargetCount: ctx.recruitmentContextSummary.integrationTargetCount
  });
}

/**
 * Attach compatibility context to a pipeline outcome without mutating public fields.
 * Never throws. On failure, leaves the pipeline outcome unchanged.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentCompatibility(pipelineOutcome, input) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  if (compatibilityIntegrationAttachInProgress.has(pipelineOutcome)) {
    return peekRecruitmentCompatibility(pipelineOutcome);
  }

  try {
    const context = buildRecruitmentCompatibilityContext(input);
    if (context != null) {
      compatibilityByPipelineOutcome.set(pipelineOutcome, context);
      attachIdentityResolution(
        pipelineOutcome,
        context.recruitmentContext,
        context.normalizedUpdate
      );
      if (!compatibilityIntegrationAttachInProgress.has(pipelineOutcome)) {
        compatibilityIntegrationAttachInProgress.add(pipelineOutcome);
        try {
          const {
            attachRecruitmentCompatibilityIntegration
          } = require("./recruitmentCompatibilityIntegrationHook");
          attachRecruitmentCompatibilityIntegration(pipelineOutcome, input, context);
        } catch {
          // Phase 93 — advisory integration only; never alter compatibility behavior.
        } finally {
          compatibilityIntegrationAttachInProgress.delete(pipelineOutcome);
        }
      }
      return context;
    }
  } catch {
    // Optional / non-breaking: preserve existing pipeline behavior.
  }

  return null;
}

/**
 * Read attached compatibility for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentCompatibility(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const context = compatibilityByPipelineOutcome.get(pipelineOutcome);
  return context == null ? null : context;
}

/**
 * Read attached identity resolution for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentIdentityResolution(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const resolution = identityResolutionByPipelineOutcome.get(pipelineOutcome);
  return resolution == null ? null : resolution;
}

/**
 * Read attached matching result for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentMatchingResult(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const matchingResult = matchingResultByPipelineOutcome.get(pipelineOutcome);
  return matchingResult == null ? null : matchingResult;
}

/**
 * Read attached action plan for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentActionPlan(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const actionPlan = actionPlanByPipelineOutcome.get(pipelineOutcome);
  return actionPlan == null ? null : actionPlan;
}

/**
 * Read attached persistence plan for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentPersistencePlan(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const persistencePlan = persistencePlanByPipelineOutcome.get(pipelineOutcome);
  return persistencePlan == null ? null : persistencePlan;
}

/**
 * Read attached execution decision for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentExecutionDecision(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const executionDecision = executionDecisionByPipelineOutcome.get(pipelineOutcome);
  return executionDecision == null ? null : executionDecision;
}

/**
 * Read attached persistence execution result for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentPersistenceExecutionResult(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const persistenceExecutionResult = persistenceExecutionResultByPipelineOutcome.get(
    pipelineOutcome
  );
  return persistenceExecutionResult == null ? null : persistenceExecutionResult;
}

/**
 * Read attached persistence adapter result for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentPersistenceAdapterResult(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const persistenceAdapterResult = persistenceAdapterResultByPipelineOutcome.get(
    pipelineOutcome
  );
  return persistenceAdapterResult == null ? null : persistenceAdapterResult;
}

module.exports = {
  COMPATIBILITY_LAYER_PHASE,
  INTEGRATION_TARGET_ID,
  ADOPTION_ORDER_ENTRY,
  UPDATE_NOTICE_KEYS,
  FOUNDATION_BRIDGE_DESCRIPTORS,
  RECRUITMENT_COMPATIBILITY_DESCRIPTOR,
  RECRUITMENT_COMPATIBILITY_METADATA,
  VALIDATION_STATUS,
  normalizeUpdateMetadata,
  buildRecruitmentCompatibilityContext,
  isRecruitmentCompatibilityContext,
  summarizeRecruitmentCompatibility,
  validateRecruitmentCompatibility,
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility,
  peekRecruitmentIdentityResolution,
  peekRecruitmentMatchingResult,
  peekRecruitmentActionPlan,
  peekRecruitmentPersistencePlan,
  peekRecruitmentExecutionDecision,
  peekRecruitmentPersistenceExecutionResult,
  peekRecruitmentPersistenceAdapterResult,
  buildObservedSignalsFromNormalizedUpdate,
  buildIdentityResolutionContext,
  summarizeIdentityResolution,
  summarizeMatchingResult,
  summarizeRecruitmentActionPlan,
  summarizePersistencePlan,
  summarizeExecutionDecision,
  summarizePersistenceExecutionResult,
  summarizePersistenceAdapterResult
};
