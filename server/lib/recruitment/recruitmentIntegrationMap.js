"use strict";

/**
 * Phase 67 — Recruitment Integration Mapping (foundation).
 *
 * Pure descriptive library bridging the Recruitment Business Foundation
 * (Phases 63–66) with existing production architecture areas. Defines
 * immutable integration targets, adoption order, and advisory metadata
 * without coupling to runtime modules.
 *
 * No runtime integration. No Express. No database. No filesystem. No environment
 * variables. No imports from other recruitment modules — production paths and
 * foundation vocabulary are documented inline without coupling.
 */

const INTEGRATION_MAP_PHASE = 67;

/**
 * Foundation phase references — descriptive only, no import coupling.
 */
const FOUNDATION_PHASES = Object.freeze({
  DOMAIN_MODEL: 63,
  LIFECYCLE_CONTRACTS: 64,
  IDENTITY_MODEL: 65,
  MATCHING_CONTRACTS: 66,
  INTEGRATION_MAP: 67
});

/**
 * Production area keys aligned with existing architecture (no import coupling).
 */
const PRODUCTION_AREAS = Object.freeze({
  WORKER: "worker",
  GENERATOR: "generator",
  PREVIEW: "preview",
  PAGES: "pages",
  UPDATES: "updates",
  PERSISTENCE: "persistence",
  DIAGNOSTICS: "diagnostics"
});

const SUPPORTED_PRODUCTION_AREAS = Object.freeze(
  new Set(Object.values(PRODUCTION_AREAS))
);

/**
 * Immutable integration target catalog.
 * Each entry describes advisory wiring metadata — not executable integration.
 */
const INTEGRATION_TARGETS = Object.freeze([
  Object.freeze({
    id: PRODUCTION_AREAS.UPDATES,
    label: "Updates",
    order: 10,
    productionArea: "site update detection and ingestion",
    productionPaths: Object.freeze([
      "server/services/updates/updates.repository.js",
      "server/services/updates/siteChecker.js",
      "server/services/updates/telegramNotifier.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.lifecycle_event_types",
      "recruitmentDomainModel.recruitment_event_statuses",
      "recruitmentLifecycleContracts.lifecycle_event_contracts",
      "recruitmentIdentityModel.identity_signals",
      "recruitmentIdentityModel.identity_source_kinds"
    ]),
    produces: Object.freeze([
      "detected_update.notice_payload",
      "detected_update.source_url",
      "detected_update.lifecycle_event_hint",
      "detected_update.identity_signal_candidates"
    ]),
    optional: false,
    futureImplementationPhase: 68,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL
    ]),
    advisoryNotes: Object.freeze([
      "Entry point for recruitment notices — update detection must surface foundation vocabulary before worker orchestration.",
      "Aligns with insertDetectedUpdate and siteChecker output without changing current persistence shape.",
      "Identity signal candidates are advisory descriptors only until matching contracts are wired in a later phase."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.WORKER,
    label: "Worker",
    order: 20,
    productionArea: "BullMQ site worker and recruitment pipeline orchestration",
    productionPaths: Object.freeze([
      "server/services/workers/siteWorker.js",
      "server/lib/recruitment/runRecruitmentPipeline.js",
      "server/lib/recruitment/recruitmentEligibility.js",
      "server/lib/recruitment/detectionProcessor.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.recruitment_lifecycle_states",
      "recruitmentDomainModel.publication_states",
      "recruitmentLifecycleContracts.transition_contracts",
      "recruitmentIdentityModel.identity_anchors",
      "recruitmentMatchingContracts.match_categories",
      "recruitmentMatchingContracts.matching_profiles",
      "recruitmentMatchingContracts.manual_review_scenarios",
      "integration_map.updates.notice_payload"
    ]),
    produces: Object.freeze([
      "pipeline_result.detection_outcome",
      "pipeline_result.eligibility_assessment",
      "pipeline_result.match_category_hint",
      "pipeline_result.review_scenario_hint",
      "pipeline_result.runtime_preview_input"
    ]),
    optional: false,
    futureImplementationPhase: 69,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL,
      FOUNDATION_PHASES.MATCHING_CONTRACTS
    ]),
    advisoryNotes: Object.freeze([
      "Central orchestration point — siteWorker already invokes runRecruitmentPipeline behind a feature flag.",
      "Foundation vocabulary should enrich detection and eligibility without altering queue semantics.",
      "Match category and review scenario hints remain advisory until review workflow adopts matching contracts."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.DIAGNOSTICS,
    label: "Diagnostics",
    order: 30,
    productionArea: "execution diagnostics and capability observation",
    productionPaths: Object.freeze([
      "server/lib/recruitment/executionDiagnostics.js",
      "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js",
      "server/lib/recruitment/runtimeCapabilityObservation.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.entity_shapes",
      "recruitmentLifecycleContracts.stage_groups",
      "recruitmentIdentityModel.identity_confidence_levels",
      "recruitmentMatchingContracts.match_signal_keys",
      "integration_map.worker.pipeline_result"
    ]),
    produces: Object.freeze([
      "execution_trace.stage_records",
      "execution_trace.foundation_vocabulary_refs",
      "execution_trace.advisory_observations",
      "capability_observation.normalized_preview_contract"
    ]),
    optional: true,
    futureImplementationPhase: 70,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL,
      FOUNDATION_PHASES.MATCHING_CONTRACTS
    ]),
    advisoryNotes: Object.freeze([
      "Observability layer — traces should reference foundation vocabulary without projecting into runtime outputs.",
      "Phase 46 diagnostics remain architecture-only; foundation labels enrich trace metadata only.",
      "Capability observations stay in internal WeakMap per existing architecture boundaries."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.PREVIEW,
    label: "Preview",
    order: 40,
    productionArea: "runtime preview buffer and admin preview services",
    productionPaths: Object.freeze([
      "server/lib/recruitment/runtimePreviewBuffer.js",
      "server/lib/recruitment/previewRuntimeWiring.js",
      "server/lib/recruitment/previewIntegrationContract.js",
      "server/services/recruitmentRuntimePreview.service.js",
      "server/controllers/admin/recruitmentRuntimePreview.controller.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.lifecycle_events",
      "recruitmentDomainModel.publication_states",
      "recruitmentLifecycleContracts.lifecycle_event_contracts",
      "recruitmentIdentityModel.identity_resolution_metadata",
      "recruitmentMatchingContracts.matching_metadata",
      "integration_map.worker.runtime_preview_input"
    ]),
    produces: Object.freeze([
      "preview.lifecycle_architecture",
      "preview.identity_resolution_summary",
      "preview.match_assessment_summary",
      "preview.publication_state_hint"
    ]),
    optional: true,
    futureImplementationPhase: 71,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL,
      FOUNDATION_PHASES.MATCHING_CONTRACTS
    ]),
    advisoryNotes: Object.freeze([
      "Preview is the first human-facing advisory surface for foundation-enriched recruitment data.",
      "previewRuntimeWiring already builds lifecycle architecture — foundation contracts should align descriptors only.",
      "Publication state hints are descriptive; preview must not persist or mutate production records."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.PERSISTENCE,
    label: "Persistence",
    order: 50,
    productionArea: "runtime persistence policy, execution pipeline, and repository adapters",
    productionPaths: Object.freeze([
      "server/lib/recruitment/runtimePersistencePolicy.js",
      "server/lib/recruitment/runtimePersistenceService.js",
      "server/lib/recruitment/persistenceExecutionPipeline.js",
      "server/lib/recruitment/persistenceRepositoryContracts.js",
      "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
      "server/lib/recruitment/persistenceEnablement.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.recruitment_shape",
      "recruitmentDomainModel.recruitment_event_shape",
      "recruitmentLifecycleContracts.allowed_successors",
      "recruitmentIdentityModel.identity_anchors",
      "recruitmentMatchingContracts.match_categories",
      "integration_map.preview.publication_state_hint"
    ]),
    produces: Object.freeze([
      "persistence.recruitment_record",
      "persistence.recruitment_event_record",
      "persistence.audit_trail_entry",
      "persistence.transaction_plan"
    ]),
    optional: false,
    futureImplementationPhase: 72,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL,
      FOUNDATION_PHASES.MATCHING_CONTRACTS
    ]),
    advisoryNotes: Object.freeze([
      "Persistence remains gated by runtimePersistencePolicy — foundation shapes inform contract validation only.",
      "Entity shapes from Phase 63 align with recruitments and recruitment_events tables without schema migration.",
      "Matching categories should inform review routing metadata, not automatic linkage without human confirmation."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.PAGES,
    label: "Pages",
    order: 60,
    productionArea: "public and admin page services with recruitment linkage",
    productionPaths: Object.freeze([
      "server/services/page.service.js",
      "server/services/recruitmentPageLink.service.js",
      "server/repositories/recruitmentPageLink.repository.js",
      "server/controllers/admin/recruitmentPageLink.controller.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.publication_states",
      "recruitmentIdentityModel.identity_signals",
      "recruitmentLifecycleContracts.primary_event_concepts",
      "integration_map.persistence.recruitment_record"
    ]),
    produces: Object.freeze([
      "page.recruitment_linkage",
      "page.lifecycle_stage_display",
      "page.publication_state_display"
    ]),
    optional: true,
    futureImplementationPhase: 73,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
      FOUNDATION_PHASES.IDENTITY_MODEL
    ]),
    advisoryNotes: Object.freeze([
      "Pages expose persisted recruitment context to end users — linkage is read-mostly from foundation vocabulary.",
      "recruitmentPageLink.service already bridges pages and recruitments; foundation descriptors enrich display metadata.",
      "Publication state display should reflect Phase 63 vocabulary when a dedicated column is introduced later."
    ])
  }),
  Object.freeze({
    id: PRODUCTION_AREAS.GENERATOR,
    label: "Generator",
    order: 70,
    productionArea: "admin generator drafts and recruitment draft linkage",
    productionPaths: Object.freeze([
      "server/services/generatorDraft.service.js",
      "server/repositories/generatorDraft.repository.js",
      "server/controllers/admin/generatorDraft.controller.js",
      "server/controllers/admin/generator.controller.js"
    ]),
    consumes: Object.freeze([
      "recruitmentDomainModel.lifecycle_event_types",
      "recruitmentIdentityModel.identity_signals",
      "recruitmentMatchingContracts.match_signal_keys",
      "integration_map.persistence.recruitment_record",
      "integration_map.pages.recruitment_linkage"
    ]),
    produces: Object.freeze([
      "generator_draft.recruitment_linkage_hint",
      "generator_draft.identity_prefill_candidates",
      "generator_draft.lifecycle_event_context"
    ]),
    optional: true,
    futureImplementationPhase: 74,
    foundationPhases: Object.freeze([
      FOUNDATION_PHASES.DOMAIN_MODEL,
      FOUNDATION_PHASES.IDENTITY_MODEL,
      FOUNDATION_PHASES.MATCHING_CONTRACTS
    ]),
    advisoryNotes: Object.freeze([
      "Generator drafts may pre-fill identity signals from matched recruitment records — advisory only.",
      "generatorDraft.repository already supports recruitment linkage migration — foundation enriches draft metadata.",
      "Lifecycle event context helps authors select correct event type without auto-publishing content."
    ])
  })
]);

const INTEGRATION_TARGET_IDS = Object.freeze(
  INTEGRATION_TARGETS.map((target) => target.id)
);

const SUPPORTED_INTEGRATION_TARGET_IDS = Object.freeze(
  new Set(INTEGRATION_TARGET_IDS)
);

const INTEGRATION_TARGET_BY_ID = Object.freeze(
  INTEGRATION_TARGETS.reduce((acc, target) => {
    acc[target.id] = target;
    return acc;
  }, Object.create(null))
);

/**
 * Recommended adoption sequence for wiring foundation vocabulary into production.
 * Ordered by dependency — earlier targets feed later ones.
 */
const ADOPTION_ORDER = Object.freeze([
  Object.freeze({
    order: 1,
    targetId: PRODUCTION_AREAS.UPDATES,
    futureImplementationPhase: 68,
    label: "Updates first",
    rationale:
      "Establish foundation vocabulary at the detection ingress before downstream orchestration consumes notice payloads."
  }),
  Object.freeze({
    order: 2,
    targetId: PRODUCTION_AREAS.WORKER,
    futureImplementationPhase: 69,
    label: "Worker second",
    rationale:
      "Enrich pipeline orchestration with domain, lifecycle, identity, and matching descriptors after updates emit structured hints."
  }),
  Object.freeze({
    order: 3,
    targetId: PRODUCTION_AREAS.DIAGNOSTICS,
    futureImplementationPhase: 70,
    label: "Diagnostics third",
    rationale:
      "Attach foundation vocabulary references to execution traces once worker produces enriched pipeline results."
  }),
  Object.freeze({
    order: 4,
    targetId: PRODUCTION_AREAS.PREVIEW,
    futureImplementationPhase: 71,
    label: "Preview fourth",
    rationale:
      "Surface human-readable foundation summaries in preview after diagnostics can observe enriched pipeline stages."
  }),
  Object.freeze({
    order: 5,
    targetId: PRODUCTION_AREAS.PERSISTENCE,
    futureImplementationPhase: 72,
    label: "Persistence fifth",
    rationale:
      "Validate and persist foundation-aligned records only after preview confirms advisory assessments."
  }),
  Object.freeze({
    order: 6,
    targetId: PRODUCTION_AREAS.PAGES,
    futureImplementationPhase: 73,
    label: "Pages sixth",
    rationale:
      "Expose persisted recruitment linkage on public and admin pages after persistence adopts foundation shapes."
  }),
  Object.freeze({
    order: 7,
    targetId: PRODUCTION_AREAS.GENERATOR,
    futureImplementationPhase: 74,
    label: "Generator last",
    rationale:
      "Enable draft pre-fill and lifecycle context after pages and persistence provide stable recruitment linkage."
  })
]);

const ADOPTION_ORDER_TARGET_IDS = Object.freeze(
  ADOPTION_ORDER.map((entry) => entry.targetId)
);

/**
 * Cross-cutting integration map concept.
 */
const RECRUITMENT_INTEGRATION = Object.freeze({
  entity: "recruitment_integration_map",
  phase: INTEGRATION_MAP_PHASE,
  productionAreaCount: SUPPORTED_PRODUCTION_AREAS.size,
  integrationTargetCount: INTEGRATION_TARGETS.length,
  adoptionStepCount: ADOPTION_ORDER.length,
  foundationPhases: Object.freeze([
    FOUNDATION_PHASES.DOMAIN_MODEL,
    FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
    FOUNDATION_PHASES.IDENTITY_MODEL,
    FOUNDATION_PHASES.MATCHING_CONTRACTS
  ]),
  requiredTargets: Object.freeze(
    INTEGRATION_TARGETS.filter((target) => target.optional === false).map(
      (target) => target.id
    )
  ),
  optionalTargets: Object.freeze(
    INTEGRATION_TARGETS.filter((target) => target.optional === true).map(
      (target) => target.id
    )
  ),
  firstAdoptionTarget: ADOPTION_ORDER[0].targetId,
  lastAdoptionTarget: ADOPTION_ORDER[ADOPTION_ORDER.length - 1].targetId
});

const INTEGRATION_MAP_METADATA = Object.freeze({
  phase: INTEGRATION_MAP_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false,
  buildsOnDomainModelPhase: FOUNDATION_PHASES.DOMAIN_MODEL,
  buildsOnLifecycleContractsPhase: FOUNDATION_PHASES.LIFECYCLE_CONTRACTS,
  buildsOnIdentityModelPhase: FOUNDATION_PHASES.IDENTITY_MODEL,
  buildsOnMatchingContractsPhase: FOUNDATION_PHASES.MATCHING_CONTRACTS,
  integrationTargetCount: INTEGRATION_TARGETS.length,
  adoptionStepCount: ADOPTION_ORDER.length,
  requiredTargetCount: RECRUITMENT_INTEGRATION.requiredTargets.length,
  optionalTargetCount: RECRUITMENT_INTEGRATION.optionalTargets.length
});

function normalizeKey(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @returns {readonly Object[]}
 */
function getIntegrationTargets() {
  return INTEGRATION_TARGETS;
}

/**
 * @param {string} targetId
 * @returns {Readonly<Object>|null}
 */
function getIntegrationTarget(targetId) {
  const normalized = normalizeKey(targetId);
  if (normalized == null) {
    return null;
  }
  return INTEGRATION_TARGET_BY_ID[normalized] ?? null;
}

/**
 * @returns {readonly Object[]}
 */
function listAdoptionOrder() {
  return ADOPTION_ORDER;
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentIntegrationMap() {
  return Object.freeze({
    phase: INTEGRATION_MAP_PHASE,
    entity: RECRUITMENT_INTEGRATION.entity,
    integrationTargetCount: INTEGRATION_TARGETS.length,
    adoptionStepCount: ADOPTION_ORDER.length,
    productionAreaCount: SUPPORTED_PRODUCTION_AREAS.size,
    requiredTargets: RECRUITMENT_INTEGRATION.requiredTargets,
    optionalTargets: RECRUITMENT_INTEGRATION.optionalTargets,
    firstAdoptionTarget: RECRUITMENT_INTEGRATION.firstAdoptionTarget,
    lastAdoptionTarget: RECRUITMENT_INTEGRATION.lastAdoptionTarget,
    foundationPhases: RECRUITMENT_INTEGRATION.foundationPhases,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    buildsOnDomainModelPhase: 63,
    buildsOnLifecycleContractsPhase: 64,
    buildsOnIdentityModelPhase: 65,
    buildsOnMatchingContractsPhase: 66
  });
}

module.exports = {
  INTEGRATION_MAP_PHASE,
  FOUNDATION_PHASES,
  PRODUCTION_AREAS,
  SUPPORTED_PRODUCTION_AREAS,
  INTEGRATION_TARGETS,
  INTEGRATION_TARGET_IDS,
  SUPPORTED_INTEGRATION_TARGET_IDS,
  INTEGRATION_TARGET_BY_ID,
  ADOPTION_ORDER,
  ADOPTION_ORDER_TARGET_IDS,
  RECRUITMENT_INTEGRATION,
  INTEGRATION_MAP_METADATA,
  getIntegrationTargets,
  getIntegrationTarget,
  listAdoptionOrder,
  summarizeRecruitmentIntegrationMap
};
