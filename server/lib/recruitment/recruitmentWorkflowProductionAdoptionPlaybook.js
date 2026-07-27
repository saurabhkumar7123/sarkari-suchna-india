"use strict";

/**
 * Phase 140 — Recruitment Workflow Production Adoption Playbook (Advisory Only).
 *
 * Pure documentation-oriented playbook describing recommended steps for future
 * controlled production adoption of the recruitment workflow architecture.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_PHASE = 140;

const RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_ENTITY =
  "recruitment_workflow_production_adoption_playbook";

const PLAYBOOK_SCHEMA_VERSION = "1.0.0";

const PLAYBOOK_POSTURE = Object.freeze({
  PLAYBOOK_COMPLETE: "PLAYBOOK_COMPLETE",
  PLAYBOOK_PARTIAL: "PLAYBOOK_PARTIAL",
  PLAYBOOK_BLOCKED: "PLAYBOOK_BLOCKED",
  PLAYBOOK_UNKNOWN: "PLAYBOOK_UNKNOWN"
});

const PLAYBOOK_SECTION_STATUS = Object.freeze({
  DOCUMENTED: "DOCUMENTED",
  PARTIALLY_DOCUMENTED: "PARTIALLY_DOCUMENTED",
  PENDING_REVIEW: "PENDING_REVIEW",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const PLAYBOOK_SECTION_IDS = Object.freeze({
  PRE_ADOPTION_REVIEW: "PRE_ADOPTION_REVIEW",
  ARCHITECTURE_VALIDATION: "ARCHITECTURE_VALIDATION",
  FEATURE_FLAG_ROLLOUT: "FEATURE_FLAG_ROLLOUT",
  SHADOW_OBSERVATION: "SHADOW_OBSERVATION",
  READINESS_GATE_CHECK: "READINESS_GATE_CHECK",
  CONTROLLED_COUPLING: "CONTROLLED_COUPLING",
  GOVERNANCE_SIGN_OFF: "GOVERNANCE_SIGN_OFF",
  POST_ADOPTION_MONITORING: "POST_ADOPTION_MONITORING"
});

const PLAYBOOK_SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.PRE_ADOPTION_REVIEW,
    order: 1,
    title: "Pre-Adoption Advisory Review",
    documentationPurpose: "Review all Phases 114–139 advisory outputs before adoption planning",
    recommendedActions: Object.freeze([
      "Collect architecture blueprint summary from Phase 139",
      "Verify future runtime mapping advisory posture",
      "Confirm no production mutation in advisory outputs"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.ARCHITECTURE_VALIDATION,
    order: 2,
    title: "Architecture Validation",
    documentationPurpose: "Validate composition, execution order, and dependency advisory signals",
    recommendedActions: Object.freeze([
      "Review composition blueprint layer coverage",
      "Validate execution order against dependency edges",
      "Resolve composition validation advisory findings"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.FEATURE_FLAG_ROLLOUT,
    order: 3,
    title: "Feature Flag Rollout Planning",
    documentationPurpose: "Document descriptive feature flag strategy without flag execution",
    recommendedActions: Object.freeze([
      "Define rollout phases from disabled to controlled rollout",
      "Ensure all flags remain descriptive-only",
      "Document flag dependencies and rollback descriptions"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.SHADOW_OBSERVATION,
    order: 4,
    title: "Shadow Mode Observation",
    documentationPurpose: "Plan read-only shadow observation without write execution",
    recommendedActions: Object.freeze([
      "Define shadow observation phases for each architecture layer",
      "Confirm writeExecutionPermitted remains false",
      "Document shadow comparison criteria"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.READINESS_GATE_CHECK,
    order: 5,
    title: "Runtime Readiness Gate Check",
    documentationPurpose: "Evaluate advisory readiness gate signals before coupling",
    recommendedActions: Object.freeze([
      "Verify all readiness checkpoints against advisory signals",
      "Resolve gate closed or conditional statuses",
      "Document gate evaluation rationale"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.CONTROLLED_COUPLING,
    order: 6,
    title: "Controlled Runtime Coupling",
    documentationPurpose: "Document controlled advisory-to-runtime coupling boundaries",
    recommendedActions: Object.freeze([
      "Review integration contract advisory boundaries",
      "Plan controlled activation sequence from Phase 135",
      "Ensure runtime wiring remains disabled in advisory phase"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.GOVERNANCE_SIGN_OFF,
    order: 7,
    title: "Governance Sign-Off",
    documentationPurpose: "Obtain governance compliance advisory sign-off",
    recommendedActions: Object.freeze([
      "Review governance policy compliance advisory outputs",
      "Validate rollback plan documentation",
      "Confirm no automation without governance review"
    ])
  }),
  Object.freeze({
    id: PLAYBOOK_SECTION_IDS.POST_ADOPTION_MONITORING,
    order: 8,
    title: "Post-Adoption Monitoring Plan",
    documentationPurpose: "Document advisory monitoring plan after adoption decision",
    recommendedActions: Object.freeze([
      "Define health and risk observation checkpoints",
      "Plan snapshot comparison advisory reviews",
      "Document escalation paths for advisory anomalies"
    ])
  })
]);

const RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_140",
  descriptiveOnly: true,
  documentationOriented: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  productionAdoptionPlaybookOnly: true,
  runtimeWiringEnabled: false,
  schedulerEnabled: false,
  workerEnabled: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139
  ])
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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedPlaybookInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.includedSectionIds != null && !Array.isArray(input.includedSectionIds)) {
    return false;
  }
  return true;
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function resolveIncludedSections(input) {
  if (!Array.isArray(input.includedSectionIds) || input.includedSectionIds.length === 0) {
    return PLAYBOOK_SECTION_DEFINITIONS;
  }

  const requested = new Set(input.includedSectionIds);
  return PLAYBOOK_SECTION_DEFINITIONS.filter((section) => requested.has(section.id));
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} section
 * @returns {string}
 */
function resolveSectionStatus(input, section) {
  const sectionSignals = isPlainObject(input.sectionSignals) ? input.sectionSignals : {};
  const signal = sectionSignals[section.id];

  if (signal === "BLOCKED") {
    return PLAYBOOK_SECTION_STATUS.BLOCKED;
  }
  if (signal === "PENDING_REVIEW") {
    return PLAYBOOK_SECTION_STATUS.PENDING_REVIEW;
  }
  if (signal === "PARTIALLY_DOCUMENTED") {
    return PLAYBOOK_SECTION_STATUS.PARTIALLY_DOCUMENTED;
  }
  if (signal === "DOCUMENTED") {
    return PLAYBOOK_SECTION_STATUS.DOCUMENTED;
  }

  return PLAYBOOK_SECTION_STATUS.DOCUMENTED;
}

/**
 * @param {Readonly<Array>} sectionEvaluations
 * @returns {string}
 */
function resolvePlaybookPosture(sectionEvaluations) {
  if (sectionEvaluations.length === 0) {
    return PLAYBOOK_POSTURE.PLAYBOOK_UNKNOWN;
  }

  const hasBlocked = sectionEvaluations.some(
    (section) => section.sectionStatus === PLAYBOOK_SECTION_STATUS.BLOCKED
  );
  if (hasBlocked) {
    return PLAYBOOK_POSTURE.PLAYBOOK_BLOCKED;
  }

  if (sectionEvaluations.length < PLAYBOOK_SECTION_DEFINITIONS.length) {
    return PLAYBOOK_POSTURE.PLAYBOOK_PARTIAL;
  }

  const hasPartial = sectionEvaluations.some(
    (section) =>
      section.sectionStatus === PLAYBOOK_SECTION_STATUS.PARTIALLY_DOCUMENTED ||
      section.sectionStatus === PLAYBOOK_SECTION_STATUS.PENDING_REVIEW
  );
  if (hasPartial) {
    return PLAYBOOK_POSTURE.PLAYBOOK_PARTIAL;
  }

  return PLAYBOOK_POSTURE.PLAYBOOK_COMPLETE;
}

/**
 * @param {string} posture
 * @returns {string}
 */
function buildPlaybookSummary(posture) {
  if (posture === PLAYBOOK_POSTURE.PLAYBOOK_COMPLETE) {
    return "Recruitment workflow production adoption playbook complete for documentation review";
  }
  if (posture === PLAYBOOK_POSTURE.PLAYBOOK_PARTIAL) {
    return "Recruitment workflow production adoption playbook partially documented";
  }
  if (posture === PLAYBOOK_POSTURE.PLAYBOOK_BLOCKED) {
    return "Recruitment workflow production adoption playbook blocked by advisory signals";
  }
  return "Recruitment workflow production adoption playbook could not be determined";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildPlaybookResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    schemaVersion: PLAYBOOK_SCHEMA_VERSION,
    playbookPosture: params.playbookPosture,
    playbookSummary: params.playbookSummary,
    sectionCount: params.sectionEvaluations.length,
    sectionEvaluations: Object.freeze(params.sectionEvaluations.slice()),
    documentationOriented: true,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_PHASE,
      productionAdoptionPlaybookOnly: true,
      documentationOriented: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowProductionAdoptionPlaybook(input) {
  if (input != null && typeof input === "object" && !isRecognizedPlaybookInput(input)) {
    return buildPlaybookResult({
      recruitmentId: null,
      playbookPosture: PLAYBOOK_POSTURE.PLAYBOOK_UNKNOWN,
      playbookSummary: buildPlaybookSummary(PLAYBOOK_POSTURE.PLAYBOOK_UNKNOWN),
      sectionEvaluations: []
    });
  }

  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const includedSections = resolveIncludedSections(safeInput);

  const sectionEvaluations = includedSections.map((section) =>
    deepFreeze({
      sectionId: section.id,
      order: section.order,
      title: section.title,
      sectionStatus: resolveSectionStatus(safeInput, section),
      documentationPurpose: section.documentationPurpose,
      recommendedActions: section.recommendedActions
    })
  );

  const playbookPosture = resolvePlaybookPosture(sectionEvaluations);
  const playbookSummary = buildPlaybookSummary(playbookPosture);

  return buildPlaybookResult({
    recruitmentId,
    playbookPosture,
    playbookSummary,
    sectionEvaluations
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_PHASE,
  RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_ENTITY,
  PLAYBOOK_SCHEMA_VERSION,
  PLAYBOOK_POSTURE,
  PLAYBOOK_SECTION_STATUS,
  PLAYBOOK_SECTION_IDS,
  PLAYBOOK_SECTION_DEFINITIONS,
  RECRUITMENT_WORKFLOW_PRODUCTION_ADOPTION_PLAYBOOK_METADATA,
  createRecruitmentWorkflowProductionAdoptionPlaybook
};
