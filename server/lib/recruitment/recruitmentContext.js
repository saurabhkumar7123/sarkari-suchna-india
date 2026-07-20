"use strict";

/**
 * Phase 68 — Recruitment Context (runtime foundation).
 *
 * Pure descriptive library aggregating the completed Recruitment Business
 * Foundation (Phases 63–67) into a reusable immutable context object.
 * Organizes domain, lifecycle, identity, matching, and integration vocabulary
 * without import coupling and without executing runtime logic.
 *
 * No worker integration. No generator integration. No runtime integration.
 * No Express. No database. No filesystem. No environment variables.
 * No imports from other recruitment modules — foundation module paths
 * and vocabulary are documented inline without coupling.
 */

const RECRUITMENT_CONTEXT_PHASE = 68;

/**
 * Foundation phase references — descriptive only, no import coupling.
 */
const FOUNDATION_PHASES = Object.freeze({
  DOMAIN_MODEL: 63,
  LIFECYCLE_CONTRACTS: 64,
  IDENTITY_MODEL: 65,
  MATCHING_CONTRACTS: 66,
  INTEGRATION_MAP: 67,
  RECRUITMENT_CONTEXT: 68
});

const CONTEXT_SECTION_KEYS = Object.freeze([
  "domain",
  "lifecycle",
  "identity",
  "matching",
  "integration"
]);

const SUPPORTED_CONTEXT_SECTION_KEYS = Object.freeze(
  new Set(CONTEXT_SECTION_KEYS)
);

/**
 * Domain section — aligned with recruitmentDomainModel (Phase 63, no import).
 */
const DOMAIN_CONTEXT_SECTION = Object.freeze({
  section: "domain",
  phase: FOUNDATION_PHASES.DOMAIN_MODEL,
  module: "recruitmentDomainModel",
  modulePath: "server/lib/recruitment/recruitmentDomainModel.js",
  entities: Object.freeze(["recruitment", "recruitment_event"]),
  recruitmentLifecycleStates: Object.freeze([
    "announced",
    "open",
    "exam_scheduled",
    "post_exam",
    "results",
    "closed"
  ]),
  lifecycleEventTypes: Object.freeze([
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
  ]),
  publicationStates: Object.freeze([
    "draft",
    "pending_review",
    "published",
    "unpublished",
    "archived"
  ]),
  recruitmentEventStatuses: Object.freeze([
    "pending",
    "active",
    "superseded",
    "cancelled"
  ]),
  lifecycleStageGroups: Object.freeze([
    "announcement",
    "application",
    "correction",
    "examination",
    "post_examination",
    "results",
    "verification",
    "completion"
  ]),
  lifecycleEventCount: 14,
  lifecycleEventTypeCount: 13,
  publicationStateCount: 5,
  lifecycleStageGroupCount: 8,
  primaryEventType: "notification",
  terminalEventTypes: Object.freeze(["final_result", "joining"]),
  defaultLifecycleState: "announced",
  defaultPublicationState: "draft"
});

/**
 * Lifecycle section — aligned with recruitmentLifecycleContracts (Phase 64).
 */
const LIFECYCLE_CONTEXT_SECTION = Object.freeze({
  section: "lifecycle",
  phase: FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
  module: "recruitmentLifecycleContracts",
  modulePath: "server/lib/recruitment/recruitmentLifecycleContracts.js",
  contractCount: 14,
  primaryContractIds: Object.freeze(["notification", "short_notification"]),
  terminalContractIds: Object.freeze(["final_result", "joining"]),
  stageGroups: Object.freeze([
    "announcement",
    "application",
    "correction",
    "examination",
    "post_examination",
    "results",
    "verification",
    "completion"
  ]),
  stageGroupCount: 8,
  transitionAdvisoryOnly: true
});

/**
 * Identity section — aligned with recruitmentIdentityModel (Phase 65).
 */
const IDENTITY_CONTEXT_SECTION = Object.freeze({
  section: "identity",
  phase: FOUNDATION_PHASES.IDENTITY_MODEL,
  module: "recruitmentIdentityModel",
  modulePath: "server/lib/recruitment/recruitmentIdentityModel.js",
  entity: "recruitment_identity",
  signalKeys: Object.freeze([
    "recruitment_title",
    "organization",
    "advertisement_number",
    "recruitment_year",
    "post_name",
    "department",
    "examination_name",
    "official_identifier",
    "source_url"
  ]),
  signalCount: 9,
  anchorCount: 2,
  primaryAnchorIds: Object.freeze(["notification"]),
  alternateAnchorIds: Object.freeze(["short_notification"]),
  confidenceLevels: Object.freeze(["high", "medium", "low", "unknown"]),
  sourceKinds: Object.freeze([
    "official_notification",
    "short_notification",
    "correction_notice",
    "examination_notice",
    "result_notice",
    "manual_entry",
    "aggregated_feed",
    "unknown"
  ]),
  slugDomainField: "slug"
});

/**
 * Matching section — aligned with recruitmentMatchingContracts (Phase 66).
 */
const MATCHING_CONTEXT_SECTION = Object.freeze({
  section: "matching",
  phase: FOUNDATION_PHASES.MATCHING_CONTRACTS,
  module: "recruitmentMatchingContracts",
  modulePath: "server/lib/recruitment/recruitmentMatchingContracts.js",
  entity: "recruitment_matching",
  matchSignalKeys: Object.freeze([
    "recruitment_title",
    "organization",
    "advertisement_number",
    "recruitment_year",
    "post_name",
    "department",
    "examination_name",
    "official_identifier",
    "source_url"
  ]),
  matchSignalCount: 9,
  matchingProfileCount: 7,
  manualReviewScenarioCount: 4,
  matchCategoryCount: 6,
  matchCategories: Object.freeze([
    "exact_match",
    "strong_match",
    "probable_match",
    "weak_match",
    "no_match",
    "manual_review"
  ]),
  primarySignalKeys: Object.freeze([
    "advertisement_number",
    "official_identifier",
    "organization"
  ]),
  scoreCalculation: false,
  matchingExecution: false
});

/**
 * Integration section — aligned with recruitmentIntegrationMap (Phase 67).
 */
const INTEGRATION_CONTEXT_SECTION = Object.freeze({
  section: "integration",
  phase: FOUNDATION_PHASES.INTEGRATION_MAP,
  module: "recruitmentIntegrationMap",
  modulePath: "server/lib/recruitment/recruitmentIntegrationMap.js",
  entity: "recruitment_integration_map",
  integrationTargetCount: 7,
  adoptionStepCount: 7,
  productionAreaCount: 7,
  integrationTargetIds: Object.freeze([
    "updates",
    "worker",
    "diagnostics",
    "preview",
    "persistence",
    "pages",
    "generator"
  ]),
  requiredTargets: Object.freeze(["updates", "worker", "persistence"]),
  optionalTargets: Object.freeze([
    "diagnostics",
    "preview",
    "pages",
    "generator"
  ]),
  firstAdoptionTarget: "updates",
  lastAdoptionTarget: "generator",
  firstImplementationPhase: 68
});

const RECRUITMENT_CONTEXT_METADATA = Object.freeze({
  phase: RECRUITMENT_CONTEXT_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  contextOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false,
  workerIntegration: false,
  generatorIntegration: false,
  scoreCalculation: false,
  matchingExecution: false,
  buildsOnDomainModelPhase: FOUNDATION_PHASES.DOMAIN_MODEL,
  buildsOnLifecycleContractsPhase: FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
  buildsOnIdentityModelPhase: FOUNDATION_PHASES.IDENTITY_MODEL,
  buildsOnMatchingContractsPhase: FOUNDATION_PHASES.MATCHING_CONTRACTS,
  buildsOnIntegrationMapPhase: FOUNDATION_PHASES.INTEGRATION_MAP,
  sectionCount: CONTEXT_SECTION_KEYS.length
});

/**
 * Immutable Recruitment Context descriptor.
 */
const RECRUITMENT_CONTEXT_DESCRIPTOR = Object.freeze({
  entity: "recruitment_context",
  domain: "recruitment",
  phase: RECRUITMENT_CONTEXT_PHASE,
  description:
    "Immutable aggregate context organizing recruitment foundation vocabulary from Phases 63–67 into reusable descriptive sections.",
  sectionKeys: CONTEXT_SECTION_KEYS,
  foundationPhases: Object.freeze([
    FOUNDATION_PHASES.DOMAIN_MODEL,
    FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
    FOUNDATION_PHASES.IDENTITY_MODEL,
    FOUNDATION_PHASES.MATCHING_CONTRACTS,
    FOUNDATION_PHASES.INTEGRATION_MAP
  ]),
  metadata: RECRUITMENT_CONTEXT_METADATA
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

function buildDefaultContextSections() {
  return deepFreeze({
    domain: DOMAIN_CONTEXT_SECTION,
    lifecycle: LIFECYCLE_CONTEXT_SECTION,
    identity: IDENTITY_CONTEXT_SECTION,
    matching: MATCHING_CONTEXT_SECTION,
    integration: INTEGRATION_CONTEXT_SECTION
  });
}

function buildContextShell(partial) {
  return deepFreeze({
    phase: RECRUITMENT_CONTEXT_PHASE,
    entity: RECRUITMENT_CONTEXT_DESCRIPTOR.entity,
    contextOnly: true,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    foundationPhases: RECRUITMENT_CONTEXT_DESCRIPTOR.foundationPhases,
    sectionKeys: CONTEXT_SECTION_KEYS,
    domain: partial.domain,
    lifecycle: partial.lifecycle,
    identity: partial.identity,
    matching: partial.matching,
    integration: partial.integration,
    metadata: partial.metadata
  });
}

const DEFAULT_RECRUITMENT_CONTEXT = buildContextShell({
  domain: DOMAIN_CONTEXT_SECTION,
  lifecycle: LIFECYCLE_CONTEXT_SECTION,
  identity: IDENTITY_CONTEXT_SECTION,
  matching: MATCHING_CONTEXT_SECTION,
  integration: INTEGRATION_CONTEXT_SECTION,
  metadata: deepFreeze({
    ...RECRUITMENT_CONTEXT_METADATA,
    createReason: "default"
  })
});

/**
 * Create an immutable recruitment context from optional structured input.
 * Pure: no I/O, no runtime logic, no foundation module execution.
 *
 * @param {Object|null|undefined} [input]
 * @returns {Readonly<Object>}
 */
function createRecruitmentContext(input) {
  if (!isPlainObject(input)) {
    return DEFAULT_RECRUITMENT_CONTEXT;
  }

  const label = normalizeString(input.label);
  const inputMetadata = isPlainObject(input.metadata) ? input.metadata : {};
  const hasSectionOverrides = CONTEXT_SECTION_KEYS.some(
    (key) => input[key] != null
  );

  if (!hasSectionOverrides && label == null && Object.keys(inputMetadata).length === 0) {
    return DEFAULT_RECRUITMENT_CONTEXT;
  }

  const sections = buildDefaultContextSections();
  const mergedSections = {};

  for (let i = 0; i < CONTEXT_SECTION_KEYS.length; i += 1) {
    const key = CONTEXT_SECTION_KEYS[i];
    const override = input[key];
    mergedSections[key] =
      isPlainObject(override) && Object.keys(override).length > 0
        ? deepFreeze({ ...sections[key], ...override })
        : sections[key];
  }

  return buildContextShell({
    ...mergedSections,
    metadata: deepFreeze({
      ...RECRUITMENT_CONTEXT_METADATA,
      createReason: "customized",
      customized: true,
      ...(label != null ? { label } : {}),
      ...inputMetadata
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentContext(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.phase !== RECRUITMENT_CONTEXT_PHASE ||
    value.entity !== RECRUITMENT_CONTEXT_DESCRIPTOR.entity ||
    value.contextOnly !== true ||
    value.descriptiveOnly !== true ||
    value.architectureOnly !== true ||
    value.runtimeIntegration !== false
  ) {
    return false;
  }

  if (!Array.isArray(value.foundationPhases) || value.foundationPhases.length !== 5) {
    return false;
  }

  if (!Array.isArray(value.sectionKeys) || value.sectionKeys.length !== 5) {
    return false;
  }

  for (let i = 0; i < CONTEXT_SECTION_KEYS.length; i += 1) {
    const key = CONTEXT_SECTION_KEYS[i];
    if (value.sectionKeys[i] !== key) {
      return false;
    }

    const section = value[key];
    if (!isPlainObject(section)) {
      return false;
    }

    if (section.section !== key || typeof section.phase !== "number") {
      return false;
    }

    if (typeof section.module !== "string" || section.module.trim() === "") {
      return false;
    }

    if (typeof section.modulePath !== "string" || section.modulePath.trim() === "") {
      return false;
    }
  }

  if (!isPlainObject(value.metadata)) {
    return false;
  }

  return (
    value.metadata.descriptiveOnly === true &&
    value.metadata.architectureOnly === true &&
    value.metadata.runtimeIntegration === false
  );
}

/**
 * @param {Object|null|undefined} [context]
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentContext(context) {
  const ctx = isRecruitmentContext(context) ? context : DEFAULT_RECRUITMENT_CONTEXT;

  return Object.freeze({
    phase: ctx.phase,
    entity: ctx.entity,
    foundationPhases: ctx.foundationPhases,
    sectionKeys: ctx.sectionKeys,
    domainPhase: ctx.domain.phase,
    lifecyclePhase: ctx.lifecycle.phase,
    identityPhase: ctx.identity.phase,
    matchingPhase: ctx.matching.phase,
    integrationPhase: ctx.integration.phase,
    lifecycleEventCount: ctx.domain.lifecycleEventCount,
    contractCount: ctx.lifecycle.contractCount,
    signalCount: ctx.identity.signalCount,
    matchSignalCount: ctx.matching.matchSignalCount,
    integrationTargetCount: ctx.integration.integrationTargetCount,
    adoptionStepCount: ctx.integration.adoptionStepCount,
    requiredIntegrationTargets: ctx.integration.requiredTargets,
    descriptiveOnly: true,
    architectureOnly: true,
    contextOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    workerIntegration: false,
    generatorIntegration: false,
    buildsOnDomainModelPhase: FOUNDATION_PHASES.DOMAIN_MODEL,
    buildsOnLifecycleContractsPhase: FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
    buildsOnIdentityModelPhase: FOUNDATION_PHASES.IDENTITY_MODEL,
    buildsOnMatchingContractsPhase: FOUNDATION_PHASES.MATCHING_CONTRACTS,
    buildsOnIntegrationMapPhase: FOUNDATION_PHASES.INTEGRATION_MAP
  });
}

module.exports = {
  RECRUITMENT_CONTEXT_PHASE,
  FOUNDATION_PHASES,
  CONTEXT_SECTION_KEYS,
  SUPPORTED_CONTEXT_SECTION_KEYS,
  DOMAIN_CONTEXT_SECTION,
  LIFECYCLE_CONTEXT_SECTION,
  IDENTITY_CONTEXT_SECTION,
  MATCHING_CONTEXT_SECTION,
  INTEGRATION_CONTEXT_SECTION,
  RECRUITMENT_CONTEXT_DESCRIPTOR,
  RECRUITMENT_CONTEXT_METADATA,
  DEFAULT_RECRUITMENT_CONTEXT,
  createRecruitmentContext,
  isRecruitmentContext,
  summarizeRecruitmentContext
};
