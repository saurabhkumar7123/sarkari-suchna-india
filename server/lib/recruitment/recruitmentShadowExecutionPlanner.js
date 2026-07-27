"use strict";

/**
 * Phase 150 — Recruitment Shadow Execution Planner (Advisory Only).
 *
 * Pure deterministic plans describing how each work package could be
 * validated in shadow mode. No execution. No database access, no persistence,
 * no runtime imports, no side effects. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE = 150;

const RECRUITMENT_SHADOW_EXECUTION_PLANNER_ENTITY = "recruitment_shadow_execution_planner";

const SHADOW_PLANNER_SCHEMA_VERSION = "1.0.0";

const SHADOW_VALIDATION_APPROACH = Object.freeze({
  READ_ONLY_COMPARISON: "READ_ONLY_COMPARISON",
  OBSERVATION_ONLY: "OBSERVATION_ONLY",
  CONTRACT_CHECK: "CONTRACT_CHECK",
  SIMULATION_COMPARE: "SIMULATION_COMPARE",
  TRACE_CORRELATION: "TRACE_CORRELATION"
});

const SHADOW_PLAN_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  SKIPPED: "SKIPPED",
  BLOCKED: "BLOCKED"
});

const SHADOW_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    workPackageId: "WP_MONITORING_PIPELINE_HEALTH",
    order: 1,
    validationApproach: SHADOW_VALIDATION_APPROACH.OBSERVATION_ONLY,
    observationPoints: Object.freeze([
      "pipeline_stage_health_emit",
      "monitoring_baseline_compare",
      "advisory_health_schema_validate"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_health_checkpoint_report",
      "baseline_divergence_summary"
    ]),
    failureConditions: Object.freeze([
      "health_checkpoint_schema_invalid",
      "unexpected_write_side_effect",
      "production_monitoring_mutation_detected"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_MONITORING_ALERTING_THRESHOLDS",
    order: 2,
    validationApproach: SHADOW_VALIDATION_APPROACH.CONTRACT_CHECK,
    observationPoints: Object.freeze([
      "threshold_definition_load",
      "shadow_alert_emission",
      "on_call_page_guard"
    ]),
    expectedOutputs: Object.freeze([
      "advisory_threshold_catalog",
      "shadow_alert_sample_set"
    ]),
    failureConditions: Object.freeze([
      "threshold_vocabulary_mismatch",
      "production_paging_triggered",
      "threshold_definition_incomplete"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_UPDATE_INGESTION_BOT_DETECTION",
    order: 3,
    validationApproach: SHADOW_VALIDATION_APPROACH.READ_ONLY_COMPARISON,
    observationPoints: Object.freeze([
      "bot_detection_signal_tap",
      "production_ingestion_count",
      "shadow_detection_store"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_detection_signal_log",
      "ingestion_count_parity_report"
    ]),
    failureConditions: Object.freeze([
      "production_ingestion_path_consumed_signal",
      "ingestion_count_divergence",
      "write_coupling_detected"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_UPDATE_INGESTION_NORMALIZATION",
    order: 4,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "raw_update_payload",
      "shadow_normalized_payload",
      "contract_compliance_check"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_normalized_payload_set",
      "normalization_failure_rate_report"
    ]),
    failureConditions: Object.freeze([
      "production_schema_mutation",
      "normalization_failure_above_threshold",
      "contract_compliance_failure"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_IDENTIFICATION_CONFIDENCE_ROUTING",
    order: 5,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "confidence_band_decision",
      "advisory_review_queue",
      "identity_write_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_routing_decision_log",
      "advisory_review_queue_snapshot"
    ]),
    failureConditions: Object.freeze([
      "unstable_routing_across_runs",
      "production_identity_write",
      "review_queue_enforcement_detected"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_IDENTIFICATION_DEDUPLICATION",
    order: 6,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "dedup_candidate_generation",
      "collision_report",
      "identity_merge_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_dedup_proposal_set",
      "identity_collision_report"
    ]),
    failureConditions: Object.freeze([
      "production_identity_merge",
      "destructive_merge_proposal",
      "missing_collision_rationale"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_LIFECYCLE_EVENT_CLASSIFIER",
    order: 7,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "lifecycle_event_input",
      "shadow_classification_output",
      "scenario_fixture_compare"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_classification_result_set",
      "misclassification_rate_report"
    ]),
    failureConditions: Object.freeze([
      "production_lifecycle_state_change",
      "misclassification_above_tolerance",
      "fixture_mismatch"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_LIFECYCLE_TRANSITION_VALIDATION",
    order: 8,
    validationApproach: SHADOW_VALIDATION_APPROACH.CONTRACT_CHECK,
    observationPoints: Object.freeze([
      "transition_rule_load",
      "illegal_transition_flag",
      "state_machine_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_transition_violation_report",
      "transition_rule_coverage_summary"
    ]),
    failureConditions: Object.freeze([
      "production_state_machine_altered",
      "rule_set_contract_drift",
      "unenforced_illegal_transition_missed"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_DRAFT_RECRUITMENT_BINDING",
    order: 9,
    validationApproach: SHADOW_VALIDATION_APPROACH.READ_ONLY_COMPARISON,
    observationPoints: Object.freeze([
      "draft_entity_snapshot",
      "shadow_binding_proposal",
      "orphan_draft_metric"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_binding_proposal_set",
      "orphan_draft_rate_report"
    ]),
    failureConditions: Object.freeze([
      "draft_row_mutation",
      "recruitment_row_mutation",
      "binding_contract_violation"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_DRAFT_APPROVAL_GATE",
    order: 10,
    validationApproach: SHADOW_VALIDATION_APPROACH.CONTRACT_CHECK,
    observationPoints: Object.freeze([
      "approval_decision_eval",
      "governance_checklist_compare",
      "write_through_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_approval_decision_log",
      "rejection_reason_audit_trail"
    ]),
    failureConditions: Object.freeze([
      "write_through_approval_detected",
      "governance_mismatch",
      "missing_rejection_rationale"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_GROUPING_CANDIDATE_RESOLUTION",
    order: 11,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "grouping_candidate_set",
      "identity_prerequisite_check",
      "group_membership_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_grouping_candidate_set",
      "candidate_stability_report"
    ]),
    failureConditions: Object.freeze([
      "production_group_membership_write",
      "unstable_candidates_across_runs",
      "identity_prerequisite_violation"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_GROUPING_IDENTITY_MERGE",
    order: 12,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "merge_simulation_input",
      "collision_conflict_report",
      "identity_mutation_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_merge_simulation_result",
      "identity_conflict_report"
    ]),
    failureConditions: Object.freeze([
      "production_identity_mutation",
      "irreversible_merge_artifact",
      "incomplete_conflict_report"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_TIMELINE_EVENT_AGGREGATION",
    order: 13,
    validationApproach: SHADOW_VALIDATION_APPROACH.SIMULATION_COMPARE,
    observationPoints: Object.freeze([
      "classified_lifecycle_events",
      "shadow_timeline_aggregate",
      "publication_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_timeline_aggregate",
      "timeline_coherence_report"
    ]),
    failureConditions: Object.freeze([
      "public_timeline_publication",
      "non_deterministic_aggregation",
      "incoherent_event_sequence"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_TIMELINE_PUBLICATION_SYNC",
    order: 14,
    validationApproach: SHADOW_VALIDATION_APPROACH.READ_ONLY_COMPARISON,
    observationPoints: Object.freeze([
      "public_content_snapshot",
      "shadow_sync_plan",
      "public_write_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_sync_plan",
      "intended_public_diff_report"
    ]),
    failureConditions: Object.freeze([
      "public_content_mutation",
      "non_repeatable_sync_plan",
      "diff_report_incomplete"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_VALIDATION_CONTRACT_COMPLIANCE",
    order: 15,
    validationApproach: SHADOW_VALIDATION_APPROACH.CONTRACT_CHECK,
    observationPoints: Object.freeze([
      "active_contract_set",
      "compliance_runner_output",
      "enforcement_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_compliance_report",
      "advisory_violation_list"
    ]),
    failureConditions: Object.freeze([
      "enforcement_side_effect",
      "incomplete_contract_coverage",
      "compliance_runner_error"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_VALIDATION_GOVERNANCE_GATES",
    order: 16,
    validationApproach: SHADOW_VALIDATION_APPROACH.CONTRACT_CHECK,
    observationPoints: Object.freeze([
      "governance_checklist_eval",
      "gate_outcome_log",
      "traffic_block_guard"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_governance_gate_report",
      "gate_decision_audit_trail"
    ]),
    failureConditions: Object.freeze([
      "production_traffic_blocked",
      "checklist_definition_mismatch",
      "incomplete_audit_trail"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_PUBLISH_READINESS_GATE",
    order: 17,
    validationApproach: SHADOW_VALIDATION_APPROACH.READ_ONLY_COMPARISON,
    observationPoints: Object.freeze([
      "readiness_decision_eval",
      "publish_path_guard",
      "false_positive_metric"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_readiness_decision_log",
      "false_positive_rate_report"
    ]),
    failureConditions: Object.freeze([
      "publish_path_blocking_detected",
      "false_positive_above_tolerance",
      "prerequisite_alignment_failure"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_PUBLISH_CONTROLLED_ROLLOUT",
    order: 18,
    validationApproach: SHADOW_VALIDATION_APPROACH.OBSERVATION_ONLY,
    observationPoints: Object.freeze([
      "feature_flag_stage_plan",
      "flag_activation_guard",
      "rollback_step_checklist"
    ]),
    expectedOutputs: Object.freeze([
      "controlled_rollout_plan",
      "rollback_step_document"
    ]),
    failureConditions: Object.freeze([
      "feature_flag_activated",
      "production_publish_behavior_change",
      "rollback_steps_incomplete"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_OBSERVABILITY_TRACE_CORRELATION",
    order: 19,
    validationApproach: SHADOW_VALIDATION_APPROACH.TRACE_CORRELATION,
    observationPoints: Object.freeze([
      "ingestion_span",
      "classification_span",
      "publishing_span",
      "correlation_id_join"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_trace_correlation_map",
      "stage_coverage_report"
    ]),
    failureConditions: Object.freeze([
      "production_sampling_change_required",
      "incomplete_stage_coverage",
      "correlation_artifact_write_side_effect"
    ])
  }),
  Object.freeze({
    workPackageId: "WP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT",
    order: 20,
    validationApproach: SHADOW_VALIDATION_APPROACH.OBSERVATION_ONLY,
    observationPoints: Object.freeze([
      "workflow_stage_context",
      "shadow_diagnostics_payload",
      "production_output_parity"
    ]),
    expectedOutputs: Object.freeze([
      "shadow_diagnostics_attachment_set",
      "production_output_parity_report"
    ]),
    failureConditions: Object.freeze([
      "production_run_output_changed",
      "observation_contract_violation",
      "non_reversible_attachment"
    ])
  })
]);

const RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA = Object.freeze({
  phase: RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  shadowExecutionPlannerOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  activatesAnything: false,
  writeExecutionPermitted: false,
  sourcePhases: Object.freeze([
    63, 64, 65, 66, 67, 114, 120, 134, 138, 139, 140, 145, 146, 147, 148, 149, 150
  ])
});

const RECRUITMENT_SHADOW_EXECUTION_PLANNER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_SHADOW_EXECUTION_PLANNER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE,
  description:
    "Pure deterministic shadow validation plans for recruitment execution work packages. No execution.",
  schemaVersion: SHADOW_PLANNER_SCHEMA_VERSION,
  metadata: RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "shadowPlans",
  "totalPlanCount",
  "plansByApproach",
  "writeExecutionPermitted",
  "plannerSummary",
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
 * @returns {boolean}
 */
function isRecognizedShadowPlannerInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.workPackages != null && !isPlainObject(input.workPackages) && !Array.isArray(input.workPackages)) {
    return false;
  }
  if (input.excludedPackageIds != null && !Array.isArray(input.excludedPackageIds)) {
    return false;
  }
  if (input.completedPackageIds != null && !Array.isArray(input.completedPackageIds)) {
    return false;
  }
  return true;
}

/**
 * @param {*} input
 * @returns {Readonly<Set>|null}
 */
function deriveExcludedPackageSet(input) {
  if (!isPlainObject(input) || !Array.isArray(input.excludedPackageIds)) {
    return null;
  }
  const excluded = new Set();
  for (let i = 0; i < input.excludedPackageIds.length; i += 1) {
    if (typeof input.excludedPackageIds[i] === "string") {
      excluded.add(input.excludedPackageIds[i]);
    }
  }
  return excluded;
}

/**
 * @param {*} input
 * @returns {Readonly<Set>}
 */
function deriveKnownPackageIds(input) {
  const known = new Set();
  if (!isPlainObject(input)) {
    return known;
  }

  if (isPlainObject(input.workPackages) && Array.isArray(input.workPackages.workPackages)) {
    for (let i = 0; i < input.workPackages.workPackages.length; i += 1) {
      const pkg = input.workPackages.workPackages[i];
      if (isPlainObject(pkg) && typeof pkg.identifier === "string") {
        known.add(pkg.identifier);
      }
    }
  }

  if (Array.isArray(input.workPackages)) {
    for (let i = 0; i < input.workPackages.length; i += 1) {
      const pkg = input.workPackages[i];
      if (typeof pkg === "string") {
        known.add(pkg);
      } else if (isPlainObject(pkg) && typeof pkg.identifier === "string") {
        known.add(pkg.identifier);
      }
    }
  }

  if (Array.isArray(input.workPackageIds)) {
    for (let i = 0; i < input.workPackageIds.length; i += 1) {
      if (typeof input.workPackageIds[i] === "string") {
        known.add(input.workPackageIds[i]);
      }
    }
  }

  return known;
}

/**
 * @param {*} input
 * @returns {Readonly<Set>}
 */
function deriveCompletedPackageSet(input) {
  const completed = new Set();
  if (!isPlainObject(input)) {
    return completed;
  }
  if (Array.isArray(input.completedPackageIds)) {
    for (let i = 0; i < input.completedPackageIds.length; i += 1) {
      if (typeof input.completedPackageIds[i] === "string") {
        completed.add(input.completedPackageIds[i]);
      }
    }
  }
  if (isPlainObject(input.workPackages) && Array.isArray(input.workPackages.workPackages)) {
    for (let i = 0; i < input.workPackages.workPackages.length; i += 1) {
      const pkg = input.workPackages.workPackages[i];
      if (isPlainObject(pkg) && pkg.status === "COMPLETE" && typeof pkg.identifier === "string") {
        completed.add(pkg.identifier);
      }
    }
  }
  return completed;
}

/**
 * @param {Readonly<Set>} knownPackageIds
 * @param {Readonly<Set>} completedPackages
 * @param {Readonly<Set>|null} excludedPackages
 * @returns {Readonly<Array>}
 */
function buildShadowPlans(knownPackageIds, completedPackages, excludedPackages) {
  return SHADOW_PLAN_DEFINITIONS.filter(function filterPlan(plan) {
    if (excludedPackages != null && excludedPackages.has(plan.workPackageId)) {
      return false;
    }
    if (knownPackageIds.size > 0 && !knownPackageIds.has(plan.workPackageId)) {
      return false;
    }
    return true;
  }).map(function mapPlan(plan) {
    let status = SHADOW_PLAN_STATUS.PLANNED;
    if (completedPackages.has(plan.workPackageId)) {
      status = SHADOW_PLAN_STATUS.SKIPPED;
    }

    return Object.freeze({
      workPackageId: plan.workPackageId,
      order: plan.order,
      validationApproach: plan.validationApproach,
      observationPoints: plan.observationPoints,
      expectedOutputs: plan.expectedOutputs,
      failureConditions: plan.failureConditions,
      status,
      writeExecutionPermitted: false,
      executes: false
    });
  });
}

/**
 * @param {Readonly<Array>} shadowPlans
 * @returns {Readonly<Object>}
 */
function buildPlansByApproach(shadowPlans) {
  const approaches = Object.keys(SHADOW_VALIDATION_APPROACH);
  const byApproach = {};
  for (let a = 0; a < approaches.length; a += 1) {
    const key = SHADOW_VALIDATION_APPROACH[approaches[a]];
    byApproach[key] = Object.freeze(
      shadowPlans
        .filter(function filterApproach(p) {
          return p.validationApproach === key;
        })
        .map(function mapId(p) {
          return p.workPackageId;
        })
    );
  }
  return deepFreeze(byApproach);
}

/**
 * @param {Readonly<Array>} shadowPlans
 * @returns {string}
 */
function buildPlannerSummary(shadowPlans) {
  const planned = shadowPlans.filter(function filterPlanned(p) {
    return p.status === SHADOW_PLAN_STATUS.PLANNED;
  }).length;
  return (
    shadowPlans.length +
    " shadow validation plans defined (" +
    planned +
    " planned) — write execution never permitted."
  );
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentShadowExecutionPlanner(input) {
  const hasInput = isRecognizedShadowPlannerInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const knownPackageIds = deriveKnownPackageIds(hasInput ? input : null);
  const completedPackages = deriveCompletedPackageSet(hasInput ? input : null);
  const excludedPackages = deriveExcludedPackageSet(hasInput ? input : null);
  const shadowPlans = buildShadowPlans(knownPackageIds, completedPackages, excludedPackages);
  const plansByApproach = buildPlansByApproach(shadowPlans);

  return deepFreeze({
    recruitmentId,
    shadowPlans,
    totalPlanCount: shadowPlans.length,
    plansByApproach,
    writeExecutionPermitted: false,
    plannerSummary: buildPlannerSummary(shadowPlans),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_150",
      phase: RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE,
      shadowExecutionPlannerOnly: true,
      executed: false,
      executes: false,
      writeExecutionPermitted: false,
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
function isRecruitmentShadowExecutionPlanner(value) {
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
  if (value.writeExecutionPermitted !== false) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_ENTITY,
  SHADOW_PLANNER_SCHEMA_VERSION,
  SHADOW_VALIDATION_APPROACH,
  SHADOW_PLAN_STATUS,
  SHADOW_PLAN_DEFINITIONS,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_DESCRIPTOR,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentShadowExecutionPlanner,
  isRecruitmentShadowExecutionPlanner
};
