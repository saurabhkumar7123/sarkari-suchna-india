"use strict";

/**
 * Phase 146 — Recruitment Simulation Summary (Advisory Only).
 *
 * Pure advisory consolidator producing one dry-run report covering
 * implementation readiness, compliance, rollout simulation, dependency health,
 * risks, recommendations, and confidence. Accepts prior advisory outputs as
 * input data only. No database access, no persistence, no runtime imports,
 * no side effects. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_SIMULATION_SUMMARY_PHASE = 146;

const RECRUITMENT_SIMULATION_SUMMARY_ENTITY = "recruitment_simulation_summary";

const SIMULATION_SUMMARY_SCHEMA_VERSION = "1.0.0";

const SUMMARY_POSTURE = Object.freeze({
  READY: "SUMMARY_READY",
  PARTIAL: "SUMMARY_PARTIAL",
  BLOCKED: "SUMMARY_BLOCKED",
  REVIEW_REQUIRED: "SUMMARY_REVIEW_REQUIRED",
  EMPTY: "SUMMARY_EMPTY",
  UNKNOWN: "SUMMARY_UNKNOWN"
});

const DEPENDENCY_HEALTH = Object.freeze({
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN"
});

const RISK_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const RECRUITMENT_SIMULATION_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_SIMULATION_SUMMARY_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  summaryOnly: true,
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
  activatesAnything: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145
  ])
});

const RECRUITMENT_SIMULATION_SUMMARY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_SIMULATION_SUMMARY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_SIMULATION_SUMMARY_PHASE,
  description:
    "Pure consolidated dry-run simulation summary without execution or activation.",
  schemaVersion: SIMULATION_SUMMARY_SCHEMA_VERSION,
  metadata: RECRUITMENT_SIMULATION_SUMMARY_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "summaryPosture",
  "implementationReadiness",
  "compliance",
  "rolloutSimulation",
  "dependencyHealth",
  "risks",
  "recommendations",
  "confidence",
  "generatedMetadata",
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
function extractSummaryInputs(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      hasInput: false,
      dryRun: null,
      compliance: null,
      rollout: null,
      recruitmentId: "UNKNOWN"
    });
  }

  return Object.freeze({
    hasInput: true,
    dryRun: isPlainObject(input.dryRun)
      ? input.dryRun
      : isPlainObject(input.simulation)
        ? input.simulation
        : isPlainObject(input.implementationDryRun)
          ? input.implementationDryRun
          : null,
    compliance: isPlainObject(input.compliance)
      ? input.compliance
      : isPlainObject(input.complianceResult)
        ? input.complianceResult
        : null,
    rollout: isPlainObject(input.rollout)
      ? input.rollout
      : isPlainObject(input.rolloutSimulation)
        ? input.rolloutSimulation
        : null,
    recruitmentId: resolveRecruitmentId(
      input.recruitmentId ||
        (input.dryRun && input.dryRun.recruitmentId) ||
        (input.compliance && input.compliance.recruitmentId) ||
        (input.rollout && input.rollout.recruitmentId)
    )
  });
}

/**
 * @param {*|null} dryRun
 * @returns {Readonly<Object>}
 */
function buildImplementationReadinessSection(dryRun) {
  if (!isPlainObject(dryRun)) {
    return Object.freeze({
      available: false,
      simulationStatus: "SIMULATION_UNKNOWN",
      readinessStatus: "UNKNOWN",
      readinessScore: 0,
      conflictCount: 0,
      stagesSimulated: 0,
      capabilitiesSimulated: 0
    });
  }

  const readiness = isPlainObject(dryRun.simulatedReadiness)
    ? dryRun.simulatedReadiness
    : Object.freeze({});

  return Object.freeze({
    available: true,
    simulationStatus:
      typeof dryRun.simulationStatus === "string"
        ? dryRun.simulationStatus
        : "SIMULATION_UNKNOWN",
    readinessStatus:
      typeof readiness.status === "string" ? readiness.status : "UNKNOWN",
    readinessScore:
      typeof readiness.readinessScore === "number" ? readiness.readinessScore : 0,
    conflictCount:
      typeof readiness.conflictCount === "number"
        ? readiness.conflictCount
        : Array.isArray(dryRun.detectedConflicts)
          ? dryRun.detectedConflicts.length
          : 0,
    stagesSimulated:
      typeof readiness.stagesSimulated === "number" ? readiness.stagesSimulated : 0,
    capabilitiesSimulated:
      typeof readiness.capabilitiesSimulated === "number"
        ? readiness.capabilitiesSimulated
        : 0
  });
}

/**
 * @param {*|null} compliance
 * @returns {Readonly<Object>}
 */
function buildComplianceSection(compliance) {
  if (!isPlainObject(compliance)) {
    return Object.freeze({
      available: false,
      complianceStatus: "UNKNOWN",
      overallComplianceScore: 0,
      satisfiedCount: 0,
      missingCount: 0,
      warningCount: 0
    });
  }

  return Object.freeze({
    available: true,
    complianceStatus:
      typeof compliance.complianceStatus === "string"
        ? compliance.complianceStatus
        : "UNKNOWN",
    overallComplianceScore:
      typeof compliance.overallComplianceScore === "number"
        ? compliance.overallComplianceScore
        : 0,
    satisfiedCount: Array.isArray(compliance.satisfiedRequirements)
      ? compliance.satisfiedRequirements.length
      : 0,
    missingCount: Array.isArray(compliance.missingRequirements)
      ? compliance.missingRequirements.length
      : 0,
    warningCount: Array.isArray(compliance.warnings) ? compliance.warnings.length : 0
  });
}

/**
 * @param {*|null} rollout
 * @returns {Readonly<Object>}
 */
function buildRolloutSection(rollout) {
  if (!isPlainObject(rollout)) {
    return Object.freeze({
      available: false,
      rolloutSimulationStatus: "ROLLOUT_SEQUENCE_UNKNOWN",
      passedCheckpoints: 0,
      totalCheckpoints: 0,
      stopConditionCount: 0,
      rollbackPointCount: 0
    });
  }

  let passedCheckpoints = 0;
  const progression = Array.isArray(rollout.checkpointProgression)
    ? rollout.checkpointProgression
    : [];
  for (let i = 0; i < progression.length; i += 1) {
    if (progression[i] && progression[i].status === "PASSED") {
      passedCheckpoints += 1;
    }
  }

  return Object.freeze({
    available: true,
    rolloutSimulationStatus:
      typeof rollout.rolloutSimulationStatus === "string"
        ? rollout.rolloutSimulationStatus
        : "ROLLOUT_SEQUENCE_UNKNOWN",
    passedCheckpoints,
    totalCheckpoints: progression.length,
    stopConditionCount: Array.isArray(rollout.simulatedStopConditions)
      ? rollout.simulatedStopConditions.length
      : 0,
    rollbackPointCount: Array.isArray(rollout.simulatedRollbackPoints)
      ? rollout.simulatedRollbackPoints.length
      : 0
  });
}

/**
 * @param {*|null} dryRun
 * @param {*|null} rollout
 * @returns {Readonly<Object>}
 */
function resolveDependencyHealth(dryRun, rollout) {
  let failedDeps = 0;
  let totalDeps = 0;

  if (isPlainObject(dryRun) && Array.isArray(dryRun.dependencyChecks)) {
    for (let i = 0; i < dryRun.dependencyChecks.length; i += 1) {
      totalDeps += 1;
      if (dryRun.dependencyChecks[i].satisfied !== true) {
        failedDeps += 1;
      }
    }
  }

  if (isPlainObject(dryRun) && Array.isArray(dryRun.prerequisiteChecks)) {
    for (let i = 0; i < dryRun.prerequisiteChecks.length; i += 1) {
      totalDeps += 1;
      if (dryRun.prerequisiteChecks[i].satisfied !== true) {
        failedDeps += 1;
      }
    }
  }

  if (isPlainObject(rollout) && Array.isArray(rollout.dependencySatisfaction)) {
    for (let i = 0; i < rollout.dependencySatisfaction.length; i += 1) {
      totalDeps += 1;
      if (rollout.dependencySatisfaction[i].satisfied !== true) {
        failedDeps += 1;
      }
    }
  }

  if (totalDeps === 0) {
    return Object.freeze({
      status: DEPENDENCY_HEALTH.UNKNOWN,
      failedDependencies: 0,
      totalDependencies: 0,
      healthScore: 0
    });
  }

  const healthScore = Math.round(((totalDeps - failedDeps) / totalDeps) * 100);
  let status = DEPENDENCY_HEALTH.HEALTHY;
  if (failedDeps === 0) {
    status = DEPENDENCY_HEALTH.HEALTHY;
  } else if (healthScore >= 50) {
    status = DEPENDENCY_HEALTH.DEGRADED;
  } else {
    status = DEPENDENCY_HEALTH.FAILED;
  }

  return Object.freeze({
    status,
    failedDependencies: failedDeps,
    totalDependencies: totalDeps,
    healthScore
  });
}

/**
 * @param {Readonly<Object>} implementationReadiness
 * @param {Readonly<Object>} compliance
 * @param {Readonly<Object>} rolloutSimulation
 * @param {Readonly<Object>} dependencyHealth
 * @param {*|null} dryRun
 * @param {*|null} complianceResult
 * @param {*|null} rollout
 * @returns {ReadonlyArray<Object>}
 */
function buildRisks(
  implementationReadiness,
  compliance,
  rolloutSimulation,
  dependencyHealth,
  dryRun,
  complianceResult,
  rollout
) {
  const risks = [];

  if (!implementationReadiness.available && !compliance.available && !rolloutSimulation.available) {
    risks.push(
      Object.freeze({
        id: "RISK_NO_SIMULATION_INPUTS",
        severity: RISK_SEVERITY.HIGH,
        message: "No dry-run, compliance, or rollout simulation inputs were provided."
      })
    );
  }

  if (implementationReadiness.conflictCount > 0) {
    risks.push(
      Object.freeze({
        id: "RISK_DRY_RUN_CONFLICTS",
        severity: RISK_SEVERITY.HIGH,
        message:
          "Dry-run detected " +
          implementationReadiness.conflictCount +
          " conflict(s) that block safe implementation."
      })
    );
  }

  if (
    implementationReadiness.simulationStatus === "SIMULATION_BLOCKED" ||
    implementationReadiness.readinessStatus === "NOT_READY"
  ) {
    risks.push(
      Object.freeze({
        id: "RISK_IMPLEMENTATION_NOT_READY",
        severity: RISK_SEVERITY.CRITICAL,
        message: "Implementation dry-run indicates not ready / blocked status."
      })
    );
  }

  if (compliance.missingCount > 0) {
    risks.push(
      Object.freeze({
        id: "RISK_CONTRACT_GAPS",
        severity: RISK_SEVERITY.HIGH,
        message:
          "Contract compliance reports " +
          compliance.missingCount +
          " missing requirement(s)."
      })
    );
  }

  if (compliance.warningCount > 0) {
    risks.push(
      Object.freeze({
        id: "RISK_COMPLIANCE_WARNINGS",
        severity: RISK_SEVERITY.WARNING,
        message:
          "Contract compliance reports " + compliance.warningCount + " warning(s)."
      })
    );
  }

  if (
    rolloutSimulation.rolloutSimulationStatus === "ROLLOUT_SEQUENCE_STOPPED" ||
    rolloutSimulation.stopConditionCount > 0
  ) {
    risks.push(
      Object.freeze({
        id: "RISK_ROLLOUT_STOP_CONDITIONS",
        severity: RISK_SEVERITY.HIGH,
        message:
          "Rollout simulation encountered stop conditions (" +
          rolloutSimulation.stopConditionCount +
          ")."
      })
    );
  }

  if (
    dependencyHealth.status === DEPENDENCY_HEALTH.FAILED ||
    dependencyHealth.status === DEPENDENCY_HEALTH.DEGRADED
  ) {
    risks.push(
      Object.freeze({
        id: "RISK_DEPENDENCY_HEALTH",
        severity:
          dependencyHealth.status === DEPENDENCY_HEALTH.FAILED
            ? RISK_SEVERITY.CRITICAL
            : RISK_SEVERITY.WARNING,
        message:
          "Dependency health is " +
          dependencyHealth.status +
          " (" +
          dependencyHealth.failedDependencies +
          "/" +
          dependencyHealth.totalDependencies +
          " failed)."
      })
    );
  }

  if (isPlainObject(dryRun) && Array.isArray(dryRun.detectedConflicts)) {
    for (let i = 0; i < dryRun.detectedConflicts.length; i += 1) {
      const conflict = dryRun.detectedConflicts[i];
      if (isPlainObject(conflict) && typeof conflict.id === "string") {
        risks.push(
          Object.freeze({
            id: "RISK_" + conflict.id,
            severity:
              conflict.severity === "ERROR" ? RISK_SEVERITY.HIGH : RISK_SEVERITY.WARNING,
            message: typeof conflict.message === "string" ? conflict.message : conflict.id
          })
        );
      }
    }
  }

  if (isPlainObject(complianceResult) && Array.isArray(complianceResult.warnings)) {
    for (let i = 0; i < complianceResult.warnings.length; i += 1) {
      risks.push(
        Object.freeze({
          id: "RISK_COMPLIANCE_WARNING_" + String(i + 1).padStart(2, "0"),
          severity: RISK_SEVERITY.WARNING,
          message: String(complianceResult.warnings[i])
        })
      );
    }
  }

  if (isPlainObject(rollout) && Array.isArray(rollout.simulatedStopConditions)) {
    for (let i = 0; i < rollout.simulatedStopConditions.length; i += 1) {
      const stop = rollout.simulatedStopConditions[i];
      if (isPlainObject(stop) && stop.triggered === true) {
        risks.push(
          Object.freeze({
            id: "RISK_STOP_" + (stop.id || String(i + 1)),
            severity: RISK_SEVERITY.HIGH,
            message: typeof stop.message === "string" ? stop.message : String(stop.id)
          })
        );
      }
    }
  }

  risks.sort(function compareRisks(a, b) {
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });

  return Object.freeze(risks);
}

/**
 * @param {*|null} dryRun
 * @param {*|null} compliance
 * @param {*|null} rollout
 * @param {ReadonlyArray<Object>} risks
 * @returns {ReadonlyArray<string>}
 */
function buildRecommendations(dryRun, compliance, rollout, risks) {
  const recommendations = [];
  const seen = Object.create(null);

  function addRecommendation(text) {
    if (typeof text !== "string" || text === "" || seen[text] === true) {
      return;
    }
    seen[text] = true;
    recommendations.push(text);
  }

  if (isPlainObject(dryRun) && Array.isArray(dryRun.recommendations)) {
    for (let i = 0; i < dryRun.recommendations.length; i += 1) {
      addRecommendation(dryRun.recommendations[i]);
    }
  }

  if (isPlainObject(compliance) && Array.isArray(compliance.missingRequirements)) {
    for (let i = 0; i < compliance.missingRequirements.length; i += 1) {
      addRecommendation(
        "Address missing contract requirement: " + compliance.missingRequirements[i] + "."
      );
    }
  }

  if (isPlainObject(rollout) && Array.isArray(rollout.simulatedStopConditions)) {
    for (let i = 0; i < rollout.simulatedStopConditions.length; i += 1) {
      const stop = rollout.simulatedStopConditions[i];
      if (isPlainObject(stop) && stop.triggered === true && typeof stop.message === "string") {
        addRecommendation("Resolve rollout stop condition: " + stop.message);
      }
    }
  }

  for (let i = 0; i < risks.length; i += 1) {
    if (risks[i].severity === RISK_SEVERITY.CRITICAL || risks[i].severity === RISK_SEVERITY.HIGH) {
      addRecommendation("Mitigate risk " + risks[i].id + ": " + risks[i].message);
    }
  }

  if (recommendations.length === 0) {
    addRecommendation(
      "Simulation inputs are incomplete; provide dry-run, compliance, and rollout advisory outputs."
    );
  }

  recommendations.sort();
  return Object.freeze(recommendations);
}

/**
 * @param {Readonly<Object>} implementationReadiness
 * @param {Readonly<Object>} compliance
 * @param {Readonly<Object>} rolloutSimulation
 * @param {Readonly<Object>} dependencyHealth
 * @param {ReadonlyArray<Object>} risks
 * @returns {string}
 */
function resolveSummaryPosture(
  implementationReadiness,
  compliance,
  rolloutSimulation,
  dependencyHealth,
  risks
) {
  const anyAvailable =
    implementationReadiness.available ||
    compliance.available ||
    rolloutSimulation.available;

  if (!anyAvailable) {
    return SUMMARY_POSTURE.EMPTY;
  }

  let criticalCount = 0;
  let highCount = 0;
  for (let i = 0; i < risks.length; i += 1) {
    if (risks[i].severity === RISK_SEVERITY.CRITICAL) {
      criticalCount += 1;
    }
    if (risks[i].severity === RISK_SEVERITY.HIGH) {
      highCount += 1;
    }
  }

  if (criticalCount > 0 || dependencyHealth.status === DEPENDENCY_HEALTH.FAILED) {
    return SUMMARY_POSTURE.BLOCKED;
  }

  if (
    implementationReadiness.readinessStatus === "READY" &&
    compliance.complianceStatus === "COMPLIANT" &&
    rolloutSimulation.rolloutSimulationStatus === "ROLLOUT_SEQUENCE_COMPLETE" &&
    dependencyHealth.status === DEPENDENCY_HEALTH.HEALTHY &&
    highCount === 0
  ) {
    return SUMMARY_POSTURE.READY;
  }

  if (highCount > 0 || compliance.warningCount > 0) {
    return SUMMARY_POSTURE.REVIEW_REQUIRED;
  }

  if (
    implementationReadiness.readinessStatus === "PARTIALLY_READY" ||
    compliance.complianceStatus === "PARTIALLY_COMPLIANT" ||
    rolloutSimulation.rolloutSimulationStatus === "ROLLOUT_SEQUENCE_PARTIAL" ||
    dependencyHealth.status === DEPENDENCY_HEALTH.DEGRADED
  ) {
    return SUMMARY_POSTURE.PARTIAL;
  }

  if (
    implementationReadiness.simulationStatus === "SIMULATION_BLOCKED" ||
    rolloutSimulation.rolloutSimulationStatus === "ROLLOUT_SEQUENCE_STOPPED" ||
    compliance.complianceStatus === "NON_COMPLIANT"
  ) {
    return SUMMARY_POSTURE.BLOCKED;
  }

  return SUMMARY_POSTURE.UNKNOWN;
}

/**
 * @param {Readonly<Object>} implementationReadiness
 * @param {Readonly<Object>} compliance
 * @param {Readonly<Object>} rolloutSimulation
 * @param {Readonly<Object>} dependencyHealth
 * @param {*|null} dryRun
 * @param {*|null} complianceResult
 * @param {*|null} rollout
 * @returns {number}
 */
function calculateSummaryConfidence(
  implementationReadiness,
  compliance,
  rolloutSimulation,
  dependencyHealth,
  dryRun,
  complianceResult,
  rollout
) {
  const scores = [];

  if (implementationReadiness.available) {
    scores.push(implementationReadiness.readinessScore);
    if (isPlainObject(dryRun) && typeof dryRun.confidence === "number") {
      scores.push(dryRun.confidence);
    }
  }
  if (compliance.available) {
    scores.push(compliance.overallComplianceScore);
    if (isPlainObject(complianceResult) && typeof complianceResult.confidence === "number") {
      scores.push(complianceResult.confidence);
    }
  }
  if (rolloutSimulation.available) {
    if (rolloutSimulation.totalCheckpoints > 0) {
      scores.push(
        Math.round(
          (rolloutSimulation.passedCheckpoints / rolloutSimulation.totalCheckpoints) * 100
        )
      );
    }
    if (isPlainObject(rollout) && typeof rollout.confidence === "number") {
      scores.push(rollout.confidence);
    }
  }
  if (dependencyHealth.totalDependencies > 0) {
    scores.push(dependencyHealth.healthScore);
  }

  if (scores.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < scores.length; i += 1) {
    sum += scores[i];
  }
  let confidence = Math.round(sum / scores.length);

  if (confidence < 0) {
    return 0;
  }
  if (confidence > 100) {
    return 100;
  }
  return confidence;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentSimulationSummary(input) {
  const extracted = extractSummaryInputs(input);
  const implementationReadiness = buildImplementationReadinessSection(extracted.dryRun);
  const compliance = buildComplianceSection(extracted.compliance);
  const rolloutSimulation = buildRolloutSection(extracted.rollout);
  const dependencyHealth = resolveDependencyHealth(extracted.dryRun, extracted.rollout);
  const risks = buildRisks(
    implementationReadiness,
    compliance,
    rolloutSimulation,
    dependencyHealth,
    extracted.dryRun,
    extracted.compliance,
    extracted.rollout
  );
  const recommendations = buildRecommendations(
    extracted.dryRun,
    extracted.compliance,
    extracted.rollout,
    risks
  );
  const summaryPosture = resolveSummaryPosture(
    implementationReadiness,
    compliance,
    rolloutSimulation,
    dependencyHealth,
    risks
  );
  const confidence = calculateSummaryConfidence(
    implementationReadiness,
    compliance,
    rolloutSimulation,
    dependencyHealth,
    extracted.dryRun,
    extracted.compliance,
    extracted.rollout
  );

  return deepFreeze({
    recruitmentId: extracted.recruitmentId,
    summaryPosture,
    implementationReadiness,
    compliance,
    rolloutSimulation,
    dependencyHealth,
    risks,
    recommendations,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_146",
      schemaVersion: SIMULATION_SUMMARY_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_SIMULATION_SUMMARY_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      simulationOnly: true,
      summaryOnly: true
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_146",
      phase: RECRUITMENT_SIMULATION_SUMMARY_PHASE,
      simulationOnly: true,
      summaryOnly: true,
      executed: false,
      activated: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      activatesAnything: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentSimulationSummary(value) {
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
  if (value.advisoryMetadata.activatesAnything !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_SIMULATION_SUMMARY_PHASE,
  RECRUITMENT_SIMULATION_SUMMARY_ENTITY,
  SIMULATION_SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  DEPENDENCY_HEALTH,
  RISK_SEVERITY,
  RECRUITMENT_SIMULATION_SUMMARY_METADATA,
  RECRUITMENT_SIMULATION_SUMMARY_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentSimulationSummary,
  isRecruitmentSimulationSummary
};
