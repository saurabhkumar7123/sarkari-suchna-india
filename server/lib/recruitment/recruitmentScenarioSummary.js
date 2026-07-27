"use strict";

/**
 * Phase 147 — Recruitment Scenario Summary (Advisory Only).
 *
 * Pure advisory consolidator producing one scenario verification report.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_SCENARIO_SUMMARY_PHASE = 147;

const RECRUITMENT_SCENARIO_SUMMARY_ENTITY = "recruitment_scenario_summary";

const SCENARIO_SUMMARY_SCHEMA_VERSION = "1.0.0";

const SUMMARY_POSTURE = Object.freeze({
  READY_FOR_NEXT_REVIEW: "READY_FOR_NEXT_REVIEW",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  BLOCKED: "BLOCKED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  INCOMPLETE: "INCOMPLETE",
  UNKNOWN: "UNKNOWN"
});

const RISK_SEVERITY = Object.freeze({
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const IMPLEMENTATION_DECISION = Object.freeze({
  PROCEED_TO_NEXT_REVIEW: "PROCEED_TO_NEXT_REVIEW",
  COMPLETE_PREREQUISITES: "COMPLETE_PREREQUISITES",
  REVISE_IMPLEMENTATION_PLAN: "REVISE_IMPLEMENTATION_PLAN",
  PERFORM_ADDITIONAL_VALIDATION: "PERFORM_ADDITIONAL_VALIDATION",
  ROLLBACK_RECOMMENDED: "ROLLBACK_RECOMMENDED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED"
});

const SCENARIO_STATUS = Object.freeze({
  MATCHED: "SCENARIO_MATCHED",
  PARTIAL: "SCENARIO_PARTIAL",
  UNMATCHED: "SCENARIO_UNMATCHED",
  INVALID: "SCENARIO_INVALID",
  EMPTY: "SCENARIO_EMPTY",
  UNKNOWN: "SCENARIO_UNKNOWN"
});

const RECRUITMENT_SCENARIO_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_SCENARIO_SUMMARY_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  summaryOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  activated: false,
  activatesAnything: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  sourcePhases: Object.freeze([145, 146, 147])
});

const RECRUITMENT_SCENARIO_SUMMARY_DESCRIPTOR = Object.freeze({
  phase: RECRUITMENT_SCENARIO_SUMMARY_PHASE,
  entity: RECRUITMENT_SCENARIO_SUMMARY_ENTITY,
  schemaVersion: SCENARIO_SUMMARY_SCHEMA_VERSION,
  description:
    "Pure consolidated advisory scenario verification summary without execution or activation.",
  advisoryOnly: true
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "selectedScenario",
  "evaluation",
  "decision",
  "risks",
  "recommendations",
  "confidence",
  "nextReviewSteps",
  "summaryPosture",
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
 * @param {*} value
 * @returns {string}
 */
function resolveRecruitmentId(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "UNKNOWN";
}

/**
 * @param {*} value
 * @returns {number}
 */
function resolveConfidence(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function extractSummaryInputs(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      available: false,
      recruitmentId: "UNKNOWN",
      selectedScenario: null,
      evaluation: null,
      decision: null
    });
  }

  const selectedScenario = isPlainObject(input.selectedScenario)
    ? input.selectedScenario
    : isPlainObject(input.scenario)
      ? input.scenario
      : null;

  const evaluation = isPlainObject(input.evaluation) ? input.evaluation : null;
  const decision = isPlainObject(input.decision) ? input.decision : null;

  let recruitmentId = resolveRecruitmentId(input.recruitmentId);
  if (recruitmentId === "UNKNOWN" && evaluation != null) {
    recruitmentId = resolveRecruitmentId(evaluation.recruitmentId);
  }
  if (recruitmentId === "UNKNOWN" && decision != null) {
    recruitmentId = resolveRecruitmentId(decision.recruitmentId);
  }

  return Object.freeze({
    available: true,
    recruitmentId: recruitmentId,
    selectedScenario: selectedScenario,
    evaluation: evaluation,
    decision: decision
  });
}

/**
 * @param {Readonly<Object>|null} selectedScenario
 * @param {Readonly<Object>|null} evaluation
 * @returns {Readonly<Object>}
 */
function buildSelectedScenarioSection(selectedScenario, evaluation) {
  if (selectedScenario == null && evaluation == null) {
    return Object.freeze({
      available: false,
      id: "UNKNOWN",
      description: null,
      expectedOutcome: null,
      advisoryOnly: true
    });
  }

  const idFromScenario =
    selectedScenario != null && typeof selectedScenario.id === "string"
      ? selectedScenario.id
      : null;
  const idFromEvaluation =
    evaluation != null && typeof evaluation.scenarioId === "string"
      ? evaluation.scenarioId
      : null;

  return Object.freeze({
    available: true,
    id: idFromScenario != null ? idFromScenario : idFromEvaluation != null ? idFromEvaluation : "UNKNOWN",
    description:
      selectedScenario != null && typeof selectedScenario.description === "string"
        ? selectedScenario.description
        : null,
    expectedOutcome:
      selectedScenario != null && typeof selectedScenario.expectedOutcome === "string"
        ? selectedScenario.expectedOutcome
        : evaluation != null && typeof evaluation.expectedOutcome === "string"
          ? evaluation.expectedOutcome
          : null,
    advisoryOnly:
      selectedScenario != null && selectedScenario.advisoryOnly === false ? false : true
  });
}

/**
 * @param {Readonly<Object>|null} evaluation
 * @returns {Readonly<Object>}
 */
function buildEvaluationSection(evaluation) {
  if (evaluation == null) {
    return Object.freeze({
      available: false,
      scenarioStatus: SCENARIO_STATUS.EMPTY,
      matchedConditionCount: 0,
      unmetConditionCount: 0,
      findingsCount: 0,
      confidence: 0
    });
  }

  return Object.freeze({
    available: true,
    scenarioStatus:
      typeof evaluation.scenarioStatus === "string"
        ? evaluation.scenarioStatus
        : SCENARIO_STATUS.UNKNOWN,
    matchedConditionCount: Array.isArray(evaluation.matchedConditions)
      ? evaluation.matchedConditions.length
      : 0,
    unmetConditionCount: Array.isArray(evaluation.unmetConditions)
      ? evaluation.unmetConditions.length
      : 0,
    findingsCount: Array.isArray(evaluation.findings) ? evaluation.findings.length : 0,
    confidence: resolveConfidence(evaluation.confidence)
  });
}

/**
 * @param {Readonly<Object>|null} decision
 * @returns {Readonly<Object>}
 */
function buildDecisionSection(decision) {
  if (decision == null) {
    return Object.freeze({
      available: false,
      decision: IMPLEMENTATION_DECISION.REVIEW_REQUIRED,
      rationale: "Decision matrix output was not provided.",
      confidence: 0
    });
  }

  return Object.freeze({
    available: true,
    decision:
      typeof decision.decision === "string"
        ? decision.decision
        : IMPLEMENTATION_DECISION.REVIEW_REQUIRED,
    rationale:
      typeof decision.rationale === "string"
        ? decision.rationale
        : "No rationale provided.",
    confidence: resolveConfidence(decision.confidence)
  });
}

/**
 * @param {Readonly<Object>} selectedScenario
 * @param {Readonly<Object>} evaluation
 * @param {Readonly<Object>} decision
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function buildRisks(selectedScenario, evaluation, decision) {
  const risks = [];

  if (!selectedScenario.available) {
    risks.push(
      Object.freeze({
        id: "RISK_SCENARIO_MISSING",
        severity: RISK_SEVERITY.MEDIUM,
        message: "Selected scenario was not provided for summary consolidation."
      })
    );
  }

  if (!evaluation.available) {
    risks.push(
      Object.freeze({
        id: "RISK_EVALUATION_MISSING",
        severity: RISK_SEVERITY.HIGH,
        message: "Scenario evaluation was not provided."
      })
    );
  } else {
    if (evaluation.scenarioStatus === SCENARIO_STATUS.PARTIAL) {
      risks.push(
        Object.freeze({
          id: "RISK_PARTIAL_MATCH",
          severity: RISK_SEVERITY.MEDIUM,
          message: "Scenario evaluation is only partially matched."
        })
      );
    }
    if (evaluation.scenarioStatus === SCENARIO_STATUS.UNMATCHED) {
      risks.push(
        Object.freeze({
          id: "RISK_UNMATCHED",
          severity: RISK_SEVERITY.HIGH,
          message: "Scenario evaluation did not match the selected scenario."
        })
      );
    }
    if (evaluation.scenarioStatus === SCENARIO_STATUS.INVALID) {
      risks.push(
        Object.freeze({
          id: "RISK_INVALID_SCENARIO",
          severity: RISK_SEVERITY.HIGH,
          message: "Selected scenario id is invalid."
        })
      );
    }
    if (evaluation.unmetConditionCount > 0) {
      risks.push(
        Object.freeze({
          id: "RISK_UNMET_CONDITIONS",
          severity: RISK_SEVERITY.MEDIUM,
          message:
            "Unmet conditions remain: count=" + String(evaluation.unmetConditionCount) + "."
        })
      );
    }
    if (evaluation.findingsCount > 0) {
      risks.push(
        Object.freeze({
          id: "RISK_FINDINGS_PRESENT",
          severity: RISK_SEVERITY.LOW,
          message: "Evaluation findings are present: count=" + String(evaluation.findingsCount) + "."
        })
      );
    }
  }

  if (!decision.available) {
    risks.push(
      Object.freeze({
        id: "RISK_DECISION_MISSING",
        severity: RISK_SEVERITY.HIGH,
        message: "Decision matrix output was not provided."
      })
    );
  } else {
    if (decision.decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED) {
      risks.push(
        Object.freeze({
          id: "RISK_ROLLBACK_RECOMMENDED",
          severity: RISK_SEVERITY.CRITICAL,
          message: "Decision matrix recommends advisory rollback."
        })
      );
    }
    if (decision.decision === IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN) {
      risks.push(
        Object.freeze({
          id: "RISK_PLAN_REVISION",
          severity: RISK_SEVERITY.MEDIUM,
          message: "Decision matrix recommends revising the implementation plan."
        })
      );
    }
    if (decision.decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES) {
      risks.push(
        Object.freeze({
          id: "RISK_PREREQUISITES",
          severity: RISK_SEVERITY.HIGH,
          message: "Decision matrix requires completing prerequisites."
        })
      );
    }
    if (decision.decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION) {
      risks.push(
        Object.freeze({
          id: "RISK_VALIDATION_GAP",
          severity: RISK_SEVERITY.MEDIUM,
          message: "Decision matrix requires additional validation."
        })
      );
    }
    if (decision.decision === IMPLEMENTATION_DECISION.REVIEW_REQUIRED) {
      risks.push(
        Object.freeze({
          id: "RISK_REVIEW_REQUIRED",
          severity: RISK_SEVERITY.MEDIUM,
          message: "Decision matrix requires advisory review."
        })
      );
    }
  }

  risks.sort(function sortRisks(a, b) {
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
 * @param {Readonly<Object>} evaluation
 * @param {Readonly<Object>} decision
 * @param {ReadonlyArray<Readonly<Object>>} risks
 * @param {Readonly<Object>|null} rawEvaluation
 * @returns {ReadonlyArray<string>}
 */
function buildRecommendations(evaluation, decision, risks, rawEvaluation) {
  const recommendations = [];

  if (Array.isArray(rawEvaluation != null ? rawEvaluation.recommendations : null)) {
    for (let i = 0; i < rawEvaluation.recommendations.length; i += 1) {
      const item = rawEvaluation.recommendations[i];
      if (typeof item === "string" && item.length > 0) {
        recommendations.push(item);
      }
    }
  }

  if (decision.available) {
    if (decision.decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW) {
      recommendations.push("Proceed to the next advisory review checkpoint.");
    } else if (decision.decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES) {
      recommendations.push("Complete all missing prerequisites before re-evaluation.");
    } else if (decision.decision === IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN) {
      recommendations.push("Revise the implementation plan to improve scenario alignment.");
    } else if (decision.decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION) {
      recommendations.push("Perform additional advisory validation and observability checks.");
    } else if (decision.decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED) {
      recommendations.push("Follow advisory rollback verification steps before continuing.");
    } else {
      recommendations.push("Schedule advisory governance review before further progression.");
    }
  } else {
    recommendations.push("Generate a decision matrix output to complete the scenario summary.");
  }

  if (!evaluation.available) {
    recommendations.push("Provide scenario evaluation output for consolidated reporting.");
  }

  if (risks.length > 0) {
    recommendations.push(
      "Mitigate " + String(risks.length) + " identified advisory risk(s) before activation planning."
    );
  }

  const unique = [];
  const seen = Object.create(null);
  for (let j = 0; j < recommendations.length; j += 1) {
    const text = recommendations[j];
    if (seen[text] === true) {
      continue;
    }
    seen[text] = true;
    unique.push(text);
  }
  unique.sort();
  return Object.freeze(unique);
}

/**
 * @param {Readonly<Object>} decision
 * @param {Readonly<Object>} evaluation
 * @param {ReadonlyArray<Readonly<Object>>} risks
 * @returns {ReadonlyArray<string>}
 */
function buildNextReviewSteps(decision, evaluation, risks) {
  const steps = [];

  if (!evaluation.available) {
    steps.push("Run scenario evaluation against the selected built-in scenario.");
  } else if (evaluation.unmetConditionCount > 0) {
    steps.push("Resolve unmet scenario conditions and re-run evaluation.");
  } else {
    steps.push("Confirm scenario evaluation remains MATCHED on re-check.");
  }

  if (!decision.available) {
    steps.push("Generate advisory decision matrix output from evaluation signals.");
  } else if (decision.decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW) {
    steps.push("Prepare next advisory review package without activating runtime.");
    steps.push("Verify runtime isolation and advisory-only posture remain intact.");
  } else if (decision.decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES) {
    steps.push("Enumerate missing prerequisites and assign advisory owners.");
    steps.push("Re-evaluate MISSING_PREREQUISITES scenario after remediation.");
  } else if (decision.decision === IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN) {
    steps.push("Update implementation plan coverage for stages and capabilities.");
    steps.push("Re-evaluate against PARTIAL_IMPLEMENTATION or COMPLETE_IMPLEMENTATION.");
  } else if (decision.decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION) {
    steps.push("Execute additional advisory validation and observability checks.");
    steps.push("Re-evaluate VALIDATION_FAILURE or OBSERVABILITY_INCOMPLETE scenario.");
  } else if (decision.decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED) {
    steps.push("Walk advisory rollback checkpoints and verify isolation restoration.");
    steps.push("Re-evaluate ROLLBACK_REQUIRED scenario after verification.");
  } else {
    steps.push("Convene advisory governance review for unresolved decision factors.");
    steps.push("Re-evaluate GOVERNANCE_REVIEW_REQUIRED scenario after review.");
  }

  if (risks.length > 0) {
    steps.push("Document residual advisory risks for the next review cycle.");
  }

  steps.sort();
  return Object.freeze(steps);
}

/**
 * @param {Readonly<Object>} evaluation
 * @param {Readonly<Object>} decision
 * @param {ReadonlyArray<Readonly<Object>>} risks
 * @returns {string}
 */
function resolveSummaryPosture(evaluation, decision, risks) {
  if (!evaluation.available && !decision.available) {
    return SUMMARY_POSTURE.INCOMPLETE;
  }

  if (
    decision.available &&
    decision.decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED
  ) {
    return SUMMARY_POSTURE.BLOCKED;
  }

  if (
    evaluation.available &&
    (evaluation.scenarioStatus === SCENARIO_STATUS.INVALID ||
      evaluation.scenarioStatus === SCENARIO_STATUS.EMPTY)
  ) {
    return SUMMARY_POSTURE.INCOMPLETE;
  }

  if (
    decision.available &&
    decision.decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW &&
    evaluation.available &&
    evaluation.scenarioStatus === SCENARIO_STATUS.MATCHED
  ) {
    return SUMMARY_POSTURE.READY_FOR_NEXT_REVIEW;
  }

  if (
    decision.available &&
    (decision.decision === IMPLEMENTATION_DECISION.REVIEW_REQUIRED ||
      decision.decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES ||
      decision.decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION ||
      decision.decision === IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN)
  ) {
    return SUMMARY_POSTURE.ACTION_REQUIRED;
  }

  if (risks.length > 0) {
    return SUMMARY_POSTURE.REVIEW_REQUIRED;
  }

  return SUMMARY_POSTURE.UNKNOWN;
}

/**
 * @param {Readonly<Object>} evaluation
 * @param {Readonly<Object>} decision
 * @param {ReadonlyArray<Readonly<Object>>} risks
 * @returns {number}
 */
function calculateSummaryConfidence(evaluation, decision, risks) {
  if (!evaluation.available && !decision.available) {
    return 0;
  }

  let score = 0;
  let parts = 0;

  if (evaluation.available) {
    score += evaluation.confidence;
    parts += 1;
  }
  if (decision.available) {
    score += decision.confidence;
    parts += 1;
  }

  let average = parts > 0 ? Math.round(score / parts) : 0;

  if (risks.length >= 4) {
    average = Math.min(average, 55);
  } else if (risks.length >= 2) {
    average = Math.min(average, 70);
  }

  if (
    decision.available &&
    decision.decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW &&
    evaluation.available &&
    evaluation.scenarioStatus === SCENARIO_STATUS.MATCHED
  ) {
    average = Math.max(average, 85);
  }

  return resolveConfidence(average);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentScenarioSummary(input) {
  const extracted = extractSummaryInputs(input);
  const selectedScenario = buildSelectedScenarioSection(
    extracted.selectedScenario,
    extracted.evaluation
  );
  const evaluation = buildEvaluationSection(extracted.evaluation);
  const decision = buildDecisionSection(extracted.decision);
  const risks = buildRisks(selectedScenario, evaluation, decision);
  const recommendations = buildRecommendations(
    evaluation,
    decision,
    risks,
    extracted.evaluation
  );
  const nextReviewSteps = buildNextReviewSteps(decision, evaluation, risks);
  const summaryPosture = resolveSummaryPosture(evaluation, decision, risks);
  const confidence = calculateSummaryConfidence(evaluation, decision, risks);

  return deepFreeze({
    recruitmentId: extracted.recruitmentId,
    selectedScenario: selectedScenario,
    evaluation: evaluation,
    decision: decision,
    risks: risks,
    recommendations: recommendations,
    confidence: confidence,
    nextReviewSteps: nextReviewSteps,
    summaryPosture: summaryPosture,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_147",
      schemaVersion: SCENARIO_SUMMARY_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_SCENARIO_SUMMARY_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      summaryOnly: true
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_147",
      phase: RECRUITMENT_SCENARIO_SUMMARY_PHASE,
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
function isRecruitmentScenarioSummary(value) {
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
  RECRUITMENT_SCENARIO_SUMMARY_PHASE,
  RECRUITMENT_SCENARIO_SUMMARY_ENTITY,
  SCENARIO_SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  RISK_SEVERITY,
  RECRUITMENT_SCENARIO_SUMMARY_METADATA,
  RECRUITMENT_SCENARIO_SUMMARY_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentScenarioSummary,
  isRecruitmentScenarioSummary
};
