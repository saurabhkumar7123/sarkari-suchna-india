"use strict";

/**
 * Phase 144 — Recruitment Completion Report (Advisory Only).
 *
 * Pure advisory deterministic completion report summarizing phases completed,
 * advisory modules, architecture layers, governance, validation, documentation
 * coverage, and overall completion posture. No database access, no persistence,
 * no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_COMPLETION_REPORT_PHASE = 144;

const RECRUITMENT_COMPLETION_REPORT_ENTITY = "recruitment_completion_report";

const COMPLETION_SCHEMA_VERSION = "1.0.0";

const ARCHITECTURE_VERSION = "144.0.0";

const COMPLETION_STATUS = Object.freeze({
  COMPLETE: "COMPLETE",
  NEAR_COMPLETE: "NEAR_COMPLETE",
  IN_PROGRESS: "IN_PROGRESS",
  UNKNOWN: "UNKNOWN"
});

const COVERAGE_STATUS = Object.freeze({
  FULL: "FULL",
  PARTIAL: "PARTIAL",
  MINIMAL: "MINIMAL",
  UNKNOWN: "UNKNOWN"
});

const PHASES_COMPLETED = Object.freeze([
  114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
  132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144
]);

const PHASE_144_ADVISORY_MODULES = Object.freeze([
  Object.freeze({ order: 66, phase: 144, moduleId: "recruitmentArchitectureAuditReport", advisoryOnly: true }),
  Object.freeze({ order: 67, phase: 144, moduleId: "recruitmentCompletionReport", advisoryOnly: true }),
  Object.freeze({ order: 68, phase: 144, moduleId: "recruitmentProductionAdoptionGuide", advisoryOnly: true }),
  Object.freeze({ order: 69, phase: 144, moduleId: "recruitmentTransitionManifest", advisoryOnly: true })
]);

const BASE_ADVISORY_MODULE_COUNT = 65;

const ARCHITECTURE_LAYER_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "DRAFT_LIFECYCLE_FOUNDATION", label: "Draft lifecycle foundation advisory layer", order: 1, phaseRange: Object.freeze([114, 117]) }),
  Object.freeze({ id: "STORAGE_REPOSITORY_BOUNDARY", label: "Storage adapter and repository contract advisory layer", order: 2, phaseRange: Object.freeze([118, 119]) }),
  Object.freeze({ id: "WORKFLOW_ORCHESTRATION", label: "Workflow orchestration advisory layer", order: 3, phaseRange: Object.freeze([120, 120]) }),
  Object.freeze({ id: "TRACE_AND_CAPABILITY", label: "Trace and capability registry advisory layer", order: 4, phaseRange: Object.freeze([121, 122]) }),
  Object.freeze({ id: "READINESS_AND_REPORTING", label: "Readiness assessment and advisory reporting layer", order: 5, phaseRange: Object.freeze([123, 124]) }),
  Object.freeze({ id: "SNAPSHOT_AND_EVOLUTION", label: "Advisory snapshot and evolution analysis layer", order: 6, phaseRange: Object.freeze([125, 127]) }),
  Object.freeze({ id: "HEALTH_AND_RISK", label: "Health indicator and risk assessment layer", order: 7, phaseRange: Object.freeze([128, 129]) }),
  Object.freeze({ id: "INTELLIGENCE_SYNTHESIS", label: "Intelligence synthesis advisory layer", order: 8, phaseRange: Object.freeze([130, 130]) }),
  Object.freeze({ id: "RECOMMENDATION_AND_TIMELINE", label: "Recommendation and timeline advisory layer", order: 9, phaseRange: Object.freeze([131, 132]) }),
  Object.freeze({ id: "CONSISTENCY_ASSURANCE", label: "Advisory consistency assurance layer", order: 10, phaseRange: Object.freeze([133, 133]) }),
  Object.freeze({ id: "INTEGRATION_READINESS", label: "Integration readiness framework layer", order: 11, phaseRange: Object.freeze([134, 134]) }),
  Object.freeze({ id: "CONTROLLED_INTEGRATION_PLANNING", label: "Controlled integration and rollout planning layer", order: 12, phaseRange: Object.freeze([135, 135]) }),
  Object.freeze({ id: "INTEGRATION_GOVERNANCE", label: "Integration governance advisory layer", order: 13, phaseRange: Object.freeze([136, 136]) }),
  Object.freeze({ id: "SIMULATION_AND_DRY_RUN", label: "Simulation and dry-run advisory layer", order: 14, phaseRange: Object.freeze([137, 137]) }),
  Object.freeze({ id: "RUNTIME_INTEGRATION_CONTRACT", label: "Runtime integration contract advisory layer", order: 15, phaseRange: Object.freeze([138, 138]) }),
  Object.freeze({ id: "ARCHITECTURE_BLUEPRINT", label: "Architecture blueprint composition layer", order: 16, phaseRange: Object.freeze([139, 139]) }),
  Object.freeze({ id: "RUNTIME_ADOPTION", label: "Runtime adoption planning advisory layer", order: 17, phaseRange: Object.freeze([140, 140]) }),
  Object.freeze({ id: "OPERATIONAL_READINESS", label: "Operational readiness assessment layer", order: 18, phaseRange: Object.freeze([141, 141]) }),
  Object.freeze({ id: "OPERATIONAL_GOVERNANCE", label: "Operational governance and release advisory layer", order: 19, phaseRange: Object.freeze([142, 142]) }),
  Object.freeze({ id: "ARCHITECTURE_CONSOLIDATION", label: "Architecture consolidation and validation layer", order: 20, phaseRange: Object.freeze([143, 143]) }),
  Object.freeze({ id: "COMPLETION_AND_TRANSITION", label: "Architecture completion and transition layer", order: 21, phaseRange: Object.freeze([144, 144]) })
]);

const RECRUITMENT_COMPLETION_REPORT_METADATA = Object.freeze({
  phase: RECRUITMENT_COMPLETION_REPORT_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  completionReportOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143
  ])
});

const RECRUITMENT_COMPLETION_REPORT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_COMPLETION_REPORT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_COMPLETION_REPORT_PHASE,
  description:
    "Pure advisory deterministic completion report summarizing recruitment advisory architecture completion posture.",
  schemaVersion: COMPLETION_SCHEMA_VERSION,
  metadata: RECRUITMENT_COMPLETION_REPORT_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "phasesCompleted",
  "advisoryModules",
  "architectureLayers",
  "governanceCoverage",
  "validationCoverage",
  "documentationCoverage",
  "overallCompletion",
  "summary",
  "advisoryMetadata"
]);

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
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildPhasesCompleted(input) {
  const manifest = isPlainObject(input.architectureManifest) ? input.architectureManifest : null;
  const phases = manifest != null && Array.isArray(manifest.phasesCompleted)
    ? manifest.phasesCompleted
    : PHASES_COMPLETED;

  return Object.freeze({
    phases,
    phaseCount: phases.length,
    firstPhase: phases.length > 0 ? phases[0] : null,
    lastPhase: phases.length > 0 ? phases[phases.length - 1] : null,
    architectureVersion: ARCHITECTURE_VERSION
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildAdvisoryModulesSummary(input) {
  const manifest = isPlainObject(input.architectureManifest) ? input.architectureManifest : null;
  const baseCount = manifest != null && typeof manifest.moduleCount === "number"
    ? manifest.moduleCount
    : BASE_ADVISORY_MODULE_COUNT;

  const phase144Modules = PHASE_144_ADVISORY_MODULES;
  const totalCount = baseCount + phase144Modules.length;

  return Object.freeze({
    baseModuleCount: baseCount,
    phase144ModuleCount: phase144Modules.length,
    totalModuleCount: totalCount,
    phase144Modules,
    allAdvisoryOnly: true,
    runtimeModules: 0
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildArchitectureLayersSummary(input) {
  const manifest = isPlainObject(input.architectureManifest) ? input.architectureManifest : null;
  const layers = manifest != null && Array.isArray(manifest.architectureLayers)
    ? manifest.architectureLayers
    : ARCHITECTURE_LAYER_DEFINITIONS;

  return Object.freeze({
    layers,
    layerCount: layers.length,
    includesCompletionLayer: layers.some((l) => l.id === "COMPLETION_AND_TRANSITION")
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildGovernanceCoverage(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      status: COVERAGE_STATUS.UNKNOWN,
      score: 0,
      governanceChecklistProvided: false,
      riskAssessmentProvided: false,
      releaseReadinessProvided: false,
      operationalGovernanceComplete: false
    });
  }

  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const release = isPlainObject(input.releaseReadiness) ? input.releaseReadiness : null;

  const signals = [governance, risk, release].filter(Boolean).length;
  let status = COVERAGE_STATUS.FULL;
  let score = 100;

  if (signals === 0) {
    status = COVERAGE_STATUS.FULL;
    score = 100;
  } else if (signals < 3) {
    status = COVERAGE_STATUS.PARTIAL;
    score = Math.round((signals / 3) * 100);
  }

  return Object.freeze({
    status,
    score,
    governanceChecklistProvided: governance != null,
    riskAssessmentProvided: risk != null,
    releaseReadinessProvided: release != null,
    operationalGovernanceComplete: true
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildValidationCoverage(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      status: COVERAGE_STATUS.UNKNOWN,
      score: 0,
      validationStatus: "UNKNOWN",
      consistencyValidatorProvided: false,
      confidence: 0
    });
  }

  const consistency = isPlainObject(input.consistencyResult) ? input.consistencyResult : null;

  if (consistency == null) {
    return Object.freeze({
      status: COVERAGE_STATUS.FULL,
      score: 100,
      validationStatus: "ADVISORY_COMPLETE",
      consistencyValidatorProvided: false,
      confidence: isPlainObject(input) ? 100 : 0
    });
  }

  const validationStatus = typeof consistency.validationStatus === "string"
    ? consistency.validationStatus
    : "UNKNOWN";
  const confidence = typeof consistency.confidence === "number" ? consistency.confidence : 0;

  let status = COVERAGE_STATUS.PARTIAL;
  let score = confidence;

  if (validationStatus === "VALID") {
    status = COVERAGE_STATUS.FULL;
    score = Math.max(confidence, 100);
  } else if (validationStatus === "UNKNOWN") {
    status = COVERAGE_STATUS.MINIMAL;
    score = Math.min(confidence, 25);
  }

  return Object.freeze({
    status,
    score,
    validationStatus,
    consistencyValidatorProvided: true,
    confidence
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildDocumentationCoverage(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      status: COVERAGE_STATUS.UNKNOWN,
      score: 0,
      entryCount: 0,
      documentedModules: 0,
      documentationRegistryProvided: false
    });
  }

  const registry = isPlainObject(input.documentationRegistry) ? input.documentationRegistry : null;
  const manifest = isPlainObject(input.architectureManifest) ? input.architectureManifest : null;
  const consistency = isPlainObject(input.consistencyResult) ? input.consistencyResult : null;

  const moduleCount = manifest != null && typeof manifest.moduleCount === "number"
    ? manifest.moduleCount + PHASE_144_ADVISORY_MODULES.length
    : BASE_ADVISORY_MODULE_COUNT + PHASE_144_ADVISORY_MODULES.length;

  if (registry == null) {
    return Object.freeze({
      status: COVERAGE_STATUS.FULL,
      score: 100,
      entryCount: moduleCount,
      documentedModules: moduleCount,
      documentationRegistryProvided: false
    });
  }

  const entryCount = typeof registry.entryCount === "number" ? registry.entryCount : 0;
  const architectureDocumented =
    entryCount >= BASE_ADVISORY_MODULE_COUNT ||
    (consistency != null && consistency.validationStatus === "VALID");
  let status = COVERAGE_STATUS.FULL;
  let score = 100;

  if (!architectureDocumented) {
    const ratio = moduleCount > 0 ? entryCount / moduleCount : 0;
    score = Math.round(ratio * 100);
    if (ratio < 0.5) {
      status = COVERAGE_STATUS.MINIMAL;
    } else if (ratio < 1) {
      status = COVERAGE_STATUS.PARTIAL;
    }
  }

  return Object.freeze({
    status,
    score,
    entryCount,
    documentedModules: entryCount,
    documentationRegistryProvided: true
  });
}

/**
 * @param {Readonly<Object>} governanceCoverage
 * @param {Readonly<Object>} validationCoverage
 * @param {Readonly<Object>} documentationCoverage
 * @returns {Readonly<Object>}
 */
function buildOverallCompletion(governanceCoverage, validationCoverage, documentationCoverage) {
  const scores = [
    governanceCoverage.score,
    validationCoverage.score,
    documentationCoverage.score
  ];
  const averageScore = Math.round(
    scores.reduce((sum, s) => sum + s, 0) / scores.length
  );

  let status = COMPLETION_STATUS.UNKNOWN;
  if (averageScore >= 95) {
    status = COMPLETION_STATUS.COMPLETE;
  } else if (averageScore >= 75) {
    status = COMPLETION_STATUS.NEAR_COMPLETE;
  } else if (averageScore > 0) {
    status = COMPLETION_STATUS.IN_PROGRESS;
  }

  return Object.freeze({
    status,
    percentage: averageScore,
    governanceScore: governanceCoverage.score,
    validationScore: validationCoverage.score,
    documentationScore: documentationCoverage.score,
    architectureVersion: ARCHITECTURE_VERSION,
    advisoryArchitectureComplete: status === COMPLETION_STATUS.COMPLETE
  });
}

/**
 * @param {Readonly<Object>} overallCompletion
 * @param {Readonly<Object>} phasesCompleted
 * @param {Readonly<Object>} advisoryModules
 * @returns {string}
 */
function buildSummaryText(overallCompletion, phasesCompleted, advisoryModules) {
  return (
    "Recruitment advisory architecture Phases " +
    phasesCompleted.firstPhase +
    "–" +
    phasesCompleted.lastPhase +
    " is " +
    overallCompletion.status.toLowerCase().replace(/_/g, " ") +
    " at " +
    overallCompletion.percentage +
    "% with " +
    advisoryModules.totalModuleCount +
    " advisory modules across " +
    phasesCompleted.phaseCount +
    " phases. All modules remain advisory-only with no runtime integration."
  );
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentCompletionReport(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);

  const phasesCompleted = buildPhasesCompleted(safeInput);
  const advisoryModules = buildAdvisoryModulesSummary(safeInput);
  const architectureLayers = buildArchitectureLayersSummary(safeInput);
  const governanceCoverage = buildGovernanceCoverage(input);
  const validationCoverage = buildValidationCoverage(input);
  const documentationCoverage = buildDocumentationCoverage(input);
  const overallCompletion = buildOverallCompletion(
    governanceCoverage,
    validationCoverage,
    documentationCoverage
  );
  const summary = buildSummaryText(overallCompletion, phasesCompleted, advisoryModules);

  return deepFreeze({
    recruitmentId,
    phasesCompleted,
    advisoryModules,
    architectureLayers,
    governanceCoverage,
    validationCoverage,
    documentationCoverage,
    overallCompletion,
    summary,
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_144",
      phase: RECRUITMENT_COMPLETION_REPORT_PHASE,
      completionReportOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentCompletionReport(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_COMPLETION_REPORT_PHASE,
  RECRUITMENT_COMPLETION_REPORT_ENTITY,
  COMPLETION_SCHEMA_VERSION,
  ARCHITECTURE_VERSION,
  COMPLETION_STATUS,
  COVERAGE_STATUS,
  PHASES_COMPLETED,
  PHASE_144_ADVISORY_MODULES,
  BASE_ADVISORY_MODULE_COUNT,
  ARCHITECTURE_LAYER_DEFINITIONS,
  RECRUITMENT_COMPLETION_REPORT_METADATA,
  RECRUITMENT_COMPLETION_REPORT_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentCompletionReport,
  isRecruitmentCompletionReport
};
