"use strict";

/**
 * Phase 137 — Recruitment Workflow Simulation Suite tests.
 * Verifies scenario library, simulation engine, dry-run executor,
 * simulation validator, simulation summary, simulation report,
 * isolation, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_PHASE,
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_ENTITY,
  SIMULATION_SCENARIO_IDS,
  WORKFLOW_STATE,
  APPROVAL_STATUS,
  INTEGRATION_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  CONSISTENCY_STATUS,
  SCENARIO_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA,
  getRecruitmentWorkflowScenario,
  listRecruitmentWorkflowScenarios,
  buildRecruitmentWorkflowScenarioContext
} = require("../server/lib/recruitment/recruitmentWorkflowScenarioLibrary");

const {
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_ENTITY,
  SIMULATION_STATUS,
  SIMULATION_STEP_STATUS,
  SIMULATION_STEP_IDS,
  SIMULATION_STEP_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA,
  simulateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowSimulationEngine");

const {
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_PHASE,
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_ENTITY,
  DRY_RUN_STATUS,
  DRY_RUN_STEP_OUTCOME,
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA,
  executeRecruitmentWorkflowDryRun
} = require("../server/lib/recruitment/recruitmentWorkflowDryRunExecutor");

const {
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_ENTITY,
  VALIDATION_STATUS,
  VALIDATION_RULE_STATUS,
  VALIDATION_RULE_IDS,
  VALIDATION_RULE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA,
  validateRecruitmentWorkflowSimulation
} = require("../server/lib/recruitment/recruitmentWorkflowSimulationValidator");

const {
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_ENTITY,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA,
  createRecruitmentWorkflowSimulationSummary
} = require("../server/lib/recruitment/recruitmentWorkflowSimulationSummary");

const {
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_ENTITY,
  REPORT_FORMAT,
  REPORT_SECTION,
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA,
  generateRecruitmentWorkflowSimulationReport
} = require("../server/lib/recruitment/recruitmentWorkflowSimulationReport");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");

const SCENARIO_LIBRARY_PATH = "server/lib/recruitment/recruitmentWorkflowScenarioLibrary.js";
const SIMULATION_ENGINE_PATH = "server/lib/recruitment/recruitmentWorkflowSimulationEngine.js";
const DRY_RUN_EXECUTOR_PATH = "server/lib/recruitment/recruitmentWorkflowDryRunExecutor.js";
const SIMULATION_VALIDATOR_PATH =
  "server/lib/recruitment/recruitmentWorkflowSimulationValidator.js";
const SIMULATION_SUMMARY_PATH = "server/lib/recruitment/recruitmentWorkflowSimulationSummary.js";
const SIMULATION_REPORT_PATH = "server/lib/recruitment/recruitmentWorkflowSimulationReport.js";

const PHASE_137_MODULE_PATHS = Object.freeze([
  SCENARIO_LIBRARY_PATH,
  SIMULATION_ENGINE_PATH,
  DRY_RUN_EXECUTOR_PATH,
  SIMULATION_VALIDATOR_PATH,
  SIMULATION_SUMMARY_PATH,
  SIMULATION_REPORT_PATH
]);

const PHASE_137_EXPORT_PATTERNS = Object.freeze([
  /getRecruitmentWorkflowScenario/,
  /simulateRecruitmentWorkflow/,
  /executeRecruitmentWorkflowDryRun/,
  /validateRecruitmentWorkflowSimulation/,
  /createRecruitmentWorkflowSimulationSummary/,
  /generateRecruitmentWorkflowSimulationReport/
]);

const GOVERNANCE_POLICY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationGovernancePolicy.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

const ALL_SCENARIO_IDS = Object.freeze([
  SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW,
  SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW,
  SIMULATION_SCENARIO_IDS.APPROVAL_PENDING,
  SIMULATION_SCENARIO_IDS.STORAGE_READY,
  SIMULATION_SCENARIO_IDS.REGRESSION,
  SIMULATION_SCENARIO_IDS.RECOVERY
]);

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

function runFullSimulationSuite(scenarioId) {
  const scenario = getRecruitmentWorkflowScenario(scenarioId);
  const context = buildRecruitmentWorkflowScenarioContext(scenarioId);
  const simulation = simulateRecruitmentWorkflow(context);
  const dryRun = executeRecruitmentWorkflowDryRun(simulation);
  const validation = validateRecruitmentWorkflowSimulation({ simulation, dryRun });
  const summary = createRecruitmentWorkflowSimulationSummary({
    recruitmentId: context.recruitmentId,
    scenario,
    simulation,
    dryRun,
    validation
  });
  const report = generateRecruitmentWorkflowSimulationReport({ summary });

  return { scenario, context, simulation, dryRun, validation, summary, report };
}

describe("Phase 137 — recruitmentWorkflowSimulationSuite", () => {
  describe("exports and metadata", () => {
    test("scenario library phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_ENTITY).toBe(
        "recruitment_workflow_scenario_library"
      );
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA.generatedBy).toBe("phase_137");
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA.simulationOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA.executed).toBe(false);
    });

    test("simulation engine phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_ENTITY).toBe(
        "recruitment_workflow_simulation_engine"
      );
      expect(RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA.simulationEngineOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA.runtimeIntegration).toBe(false);
    });

    test("dry-run executor phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_ENTITY).toBe(
        "recruitment_workflow_dry_run_executor"
      );
      expect(RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA.dryRunOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA.executed).toBe(false);
    });

    test("simulation validator phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_ENTITY).toBe(
        "recruitment_workflow_simulation_validator"
      );
      expect(RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA.simulationValidatorOnly).toBe(true);
    });

    test("simulation summary phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_ENTITY).toBe(
        "recruitment_workflow_simulation_summary"
      );
      expect(RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA.simulationSummaryOnly).toBe(true);
    });

    test("simulation report phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SIMULATION_REPORT_PHASE).toBe(137);
      expect(RECRUITMENT_WORKFLOW_SIMULATION_REPORT_ENTITY).toBe(
        "recruitment_workflow_simulation_report"
      );
      expect(RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA.simulationReportOnly).toBe(true);
    });

    test("all phase 137 modules list source phases through 136", () => {
      const metadatas = [
        RECRUITMENT_WORKFLOW_SCENARIO_LIBRARY_METADATA,
        RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA,
        RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA,
        RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA,
        RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA,
        RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA
      ];

      for (let i = 0; i < metadatas.length; i += 1) {
        expect(metadatas[i].sourcePhases).toContain(136);
        expect(metadatas[i].sourcePhases).toContain(114);
      }
    });
  });

  describe("scenario library — definitions and contexts", () => {
    test("defines six simulation scenarios", () => {
      expect(SCENARIO_DEFINITIONS).toHaveLength(6);
      expect(listRecruitmentWorkflowScenarios()).toHaveLength(6);
    });

    test("covers all required scenario identifiers", () => {
      const ids = SCENARIO_DEFINITIONS.map((item) => item.id);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.APPROVAL_PENDING);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.REGRESSION);
      expect(ids).toContain(SIMULATION_SCENARIO_IDS.RECOVERY);
    });

    test("returns null for unrecognized scenario id", () => {
      expect(getRecruitmentWorkflowScenario("INVALID_SCENARIO")).toBeNull();
      expect(getRecruitmentWorkflowScenario(null)).toBeNull();
    });

    test("healthy workflow scenario has storage boundary ready state", () => {
      const scenario = getRecruitmentWorkflowScenario(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(scenario.expectedWorkflowState).toBe(WORKFLOW_STATE.STORAGE_BOUNDARY_READY);
      expect(scenario.context.workflowState).toBe(WORKFLOW_STATE.STORAGE_BOUNDARY_READY);
      expect(scenario.context.approval.status).toBe(APPROVAL_STATUS.APPROVED);
    });

    test("blocked workflow scenario has null recruitment id", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW
      );
      expect(context.workflowState).toBe(WORKFLOW_STATE.BLOCKED);
      expect(context.recruitmentId).toBeNull();
      expect(context.blockedReasons).toContain("MISSING_RECRUITMENT_ID");
    });

    test("approval pending scenario has pending approval status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.APPROVAL_PENDING
      );
      expect(context.workflowState).toBe(WORKFLOW_STATE.WAITING_FOR_APPROVAL);
      expect(context.approval.status).toBe(APPROVAL_STATUS.PENDING);
    });

    test("storage ready scenario has repository contract", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.STORAGE_READY
      );
      expect(context.storageBoundary.ready).toBe(true);
      expect(context.storageBoundary.repositoryContract).toBe(true);
      expect(context.persistenceBoundary.ready).toBe(true);
    });

    test("regression scenario has inconsistent consistency validation", () => {
      const context = buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.REGRESSION);
      expect(context.workflowState).toBe(WORKFLOW_STATE.REGRESSION_DETECTED);
      expect(context.consistencyValidation.consistencyStatus).toBe(CONSISTENCY_STATUS.INCONSISTENT);
      expect(context.regressionSignals.degraded).toBe(true);
    });

    test("recovery scenario has recovery signals", () => {
      const context = buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.RECOVERY);
      expect(context.workflowState).toBe(WORKFLOW_STATE.RECOVERY_IN_PROGRESS);
      expect(context.health.healthStatus).toBe(HEALTH_STATUS.RECOVERING);
      expect(context.recoverySignals.recoveryStepsCompleted).toBe(3);
    });

    test("unrecognized scenario context is blocked", () => {
      const context = buildRecruitmentWorkflowScenarioContext("UNKNOWN");
      expect(context.recognized).toBe(false);
      expect(context.workflowState).toBe(WORKFLOW_STATE.BLOCKED);
    });

    test("all scenario contexts are advisory and simulation only", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const context = buildRecruitmentWorkflowScenarioContext(ALL_SCENARIO_IDS[i]);
        expect(context.advisoryOnly).toBe(true);
        expect(context.simulationOnly).toBe(true);
      }
    });
  });

  describe("simulation engine — workflow steps", () => {
    test("defines 16 simulation steps across phases 114-136", () => {
      expect(SIMULATION_STEP_DEFINITIONS).toHaveLength(16);
      expect(SIMULATION_STEP_DEFINITIONS[0].id).toBe(SIMULATION_STEP_IDS.DRAFT_PROPOSAL);
      expect(SIMULATION_STEP_DEFINITIONS[0].phase).toBe(114);
      expect(SIMULATION_STEP_DEFINITIONS[15].id).toBe(SIMULATION_STEP_IDS.GOVERNANCE_REVIEW);
      expect(SIMULATION_STEP_DEFINITIONS[15].phase).toBe(136);
    });

    test("returns unknown status for null input", () => {
      const result = simulateRecruitmentWorkflow(null);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.UNKNOWN);
      expect(result.recognized).toBe(false);
      expect(result.blockedCount).toBe(SIMULATION_STEP_DEFINITIONS.length);
    });

    test("healthy workflow simulation completes with storage ready status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.STORAGE_READY);
      expect(result.satisfiedCount).toBeGreaterThan(0);
      expect(result.simulationPlan.advisoryOnly).toBe(true);
      expect(result.simulationPlan.executed).toBe(false);
    });

    test("blocked workflow simulation reports blocked status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW
      );
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.BLOCKED);
      expect(result.blockedCount).toBeGreaterThan(0);
    });

    test("approval pending simulation reports awaiting approval", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.APPROVAL_PENDING
      );
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.AWAITING_APPROVAL);
      expect(result.pendingCount).toBeGreaterThan(0);
    });

    test("regression simulation reports regression status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.REGRESSION);
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.REGRESSION);
    });

    test("recovery simulation reports recovery status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.RECOVERY);
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.RECOVERY);
    });

    test("simulation plan contains step entries with dry-run eligibility", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.STORAGE_READY
      );
      const result = simulateRecruitmentWorkflow(context);
      expect(result.simulationPlan.steps.length).toBe(16);
      expect(result.simulationPlan.planId).toContain("STORAGE_READY");
    });

    test("all simulation steps declare advisory only and not executed", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      const result = simulateRecruitmentWorkflow(context);
      for (let i = 0; i < result.simulationSteps.length; i += 1) {
        expect(result.simulationSteps[i].advisoryOnly).toBe(true);
        expect(result.simulationSteps[i].executed).toBe(false);
      }
    });

    test("step counts sum correctly", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      const result = simulateRecruitmentWorkflow(context);
      const total =
        result.satisfiedCount +
        result.blockedCount +
        result.pendingCount +
        result.advisoryOnlyCount;
      expect(total).toBe(result.stepCount);
    });
  });

  describe("dry-run executor — advisory execution", () => {
    test("returns unknown for null input", () => {
      const result = executeRecruitmentWorkflowDryRun(null);
      expect(result.dryRunStatus).toBe(DRY_RUN_STATUS.UNKNOWN);
      expect(result.recognized).toBe(false);
      expect(result.sideEffects).toBe(false);
      expect(result.persisted).toBe(false);
      expect(result.executed).toBe(false);
    });

    test("skips dry-run when plan has no steps", () => {
      const result = executeRecruitmentWorkflowDryRun({ simulationPlan: { steps: [] } });
      expect(result.dryRunStatus).toBe(DRY_RUN_STATUS.SKIPPED);
    });

    test("healthy workflow dry-run completes or partials without side effects", () => {
      const { simulation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const dryRun = executeRecruitmentWorkflowDryRun(simulation);
      expect([DRY_RUN_STATUS.COMPLETED, DRY_RUN_STATUS.PARTIAL]).toContain(dryRun.dryRunStatus);
      expect(dryRun.sideEffects).toBe(false);
      expect(dryRun.persisted).toBe(false);
      expect(dryRun.executed).toBe(false);
    });

    test("blocked workflow dry-run reports blocked or partial", () => {
      const { simulation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      const dryRun = executeRecruitmentWorkflowDryRun(simulation);
      expect([DRY_RUN_STATUS.BLOCKED, DRY_RUN_STATUS.PARTIAL]).toContain(dryRun.dryRunStatus);
      expect(dryRun.blockedCount).toBeGreaterThan(0);
    });

    test("dry-run step count matches simulation step count", () => {
      const { simulation, dryRun } = runFullSimulationSuite(
        SIMULATION_SCENARIO_IDS.APPROVAL_PENDING
      );
      expect(dryRun.stepCount).toBe(simulation.stepCount);
    });

    test("all dry-run steps declare no side effects", () => {
      const { dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      for (let i = 0; i < dryRun.dryRunSteps.length; i += 1) {
        expect(dryRun.dryRunSteps[i].sideEffects).toBe(false);
        expect(dryRun.dryRunSteps[i].persisted).toBe(false);
        expect(dryRun.dryRunSteps[i].executed).toBe(false);
        expect(dryRun.dryRunSteps[i].advisoryOnly).toBe(true);
      }
    });

    test("dry-run outcomes map from simulation step statuses", () => {
      const { dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const outcomes = new Set(dryRun.dryRunSteps.map((step) => step.outcome));
      expect(outcomes.has(DRY_RUN_STEP_OUTCOME.SIMULATED_SUCCESS)).toBe(true);
    });

    test("dry-run preserves plan id from simulation", () => {
      const { simulation, dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.RECOVERY);
      expect(dryRun.planId).toBe(simulation.simulationPlan.planId);
    });
  });

  describe("simulation validator — consistency rules", () => {
    test("defines 10 validation rules", () => {
      expect(VALIDATION_RULE_DEFINITIONS).toHaveLength(10);
      expect(VALIDATION_RULE_DEFINITIONS[0].id).toBe(VALIDATION_RULE_IDS.STEP_COUNT_ALIGNMENT);
    });

    test("returns unknown for null input", () => {
      const result = validateRecruitmentWorkflowSimulation(null);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
      expect(result.recognized).toBe(false);
    });

    test("healthy workflow suite passes consistency validation", () => {
      const { simulation, dryRun, validation } = runFullSimulationSuite(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      expect(validation.validationStatus).toBe(VALIDATION_STATUS.CONSISTENT);
      expect(validation.passedCount).toBeGreaterThan(0);
      expect(validation.failedCount).toBe(0);
    });

    test("all six scenarios produce recognized validation", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { validation } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        expect(validation.recognized).toBe(true);
        expect(validation.ruleCount).toBe(10);
      }
    });

    test("step count alignment rule passes for valid suite", () => {
      const { validation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      const rule = validation.validationRules.find(
        (item) => item.id === VALIDATION_RULE_IDS.STEP_COUNT_ALIGNMENT
      );
      expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
    });

    test("no side effects rule passes for all scenarios", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { validation } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        const rule = validation.validationRules.find(
          (item) => item.id === VALIDATION_RULE_IDS.NO_SIDE_EFFECTS
        );
        expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
      }
    });

    test("no persistence rule passes for all scenarios", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { validation } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        const rule = validation.validationRules.find(
          (item) => item.id === VALIDATION_RULE_IDS.NO_PERSISTENCE
        );
        expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
      }
    });

    test("advisory only enforced rule passes", () => {
      const { validation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.RECOVERY);
      const rule = validation.validationRules.find(
        (item) => item.id === VALIDATION_RULE_IDS.ADVISORY_ONLY_ENFORCED
      );
      expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
    });

    test("scenario id alignment rule passes when ids match", () => {
      const { validation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.REGRESSION);
      const rule = validation.validationRules.find(
        (item) => item.id === VALIDATION_RULE_IDS.SCENARIO_ID_ALIGNMENT
      );
      expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
    });
  });

  describe("simulation summary — aggregation", () => {
    test("returns unknown posture for null input", () => {
      const result = createRecruitmentWorkflowSimulationSummary(null);
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.UNKNOWN);
      expect(result.recognized).toBe(false);
    });

    test("healthy workflow summary is simulation ready", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_READY);
      expect(summary.recognized).toBe(true);
    });

    test("blocked workflow summary is simulation blocked", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      expect(summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_BLOCKED);
    });

    test("regression summary is simulation regression", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.REGRESSION);
      expect(summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_REGRESSION);
    });

    test("recovery summary is simulation recovery", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.RECOVERY);
      expect(summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_RECOVERY);
    });

    test("aggregates all four components", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      expect(summary.aggregatedComponents).toHaveLength(4);
      const components = summary.aggregatedComponents.map((item) => item.component);
      expect(components).toContain(AGGREGATED_COMPONENT.SCENARIO);
      expect(components).toContain(AGGREGATED_COMPONENT.SIMULATION);
      expect(components).toContain(AGGREGATED_COMPONENT.DRY_RUN);
      expect(components).toContain(AGGREGATED_COMPONENT.VALIDATION);
    });

    test("key simulation signals include scenario and status", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.APPROVAL_PENDING);
      expect(summary.keySimulationSignals.length).toBeGreaterThan(0);
      expect(summary.keySimulationSignals.some((s) => s.includes("APPROVAL_PENDING"))).toBe(true);
    });

    test("summary includes workflow state from simulation", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      expect(summary.workflowState).toBe(WORKFLOW_STATE.STORAGE_BOUNDARY_READY);
    });
  });

  describe("simulation report — readable advisory output", () => {
    test("returns unknown format for null input", () => {
      const result = generateRecruitmentWorkflowSimulationReport(null);
      expect(result.reportFormat).toBe(REPORT_FORMAT.UNKNOWN);
      expect(result.recognized).toBe(false);
    });

    test("generates advisory text report for healthy workflow", () => {
      const { summary, report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(report.reportFormat).toBe(REPORT_FORMAT.ADVISORY_TEXT);
      expect(report.recognized).toBe(true);
      expect(report.advisoryText).toContain("Recruitment Workflow Advisory Simulation Report");
      expect(report.advisoryText).toContain(summary.scenarioId);
    });

    test("report contains all required sections", () => {
      const { report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      expect(report.sectionCount).toBe(7);
      const sections = report.reportSections.map((item) => item.section);
      expect(sections).toContain(REPORT_SECTION.HEADER);
      expect(sections).toContain(REPORT_SECTION.SCENARIO);
      expect(sections).toContain(REPORT_SECTION.SIMULATION);
      expect(sections).toContain(REPORT_SECTION.DRY_RUN);
      expect(sections).toContain(REPORT_SECTION.VALIDATION);
      expect(sections).toContain(REPORT_SECTION.SUMMARY);
      expect(sections).toContain(REPORT_SECTION.FOOTER);
    });

    test("report footer declares no production runtime", () => {
      const { report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      const footer = report.reportSections.find((item) => item.section === REPORT_SECTION.FOOTER);
      expect(footer.content).toContain("advisory-only");
      expect(footer.content).toContain("production runtime");
    });

    test("report includes key simulation signals from summary", () => {
      const { summary, report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.RECOVERY);
      expect(report.keySimulationSignals.length).toBe(summary.keySimulationSignals.length);
    });

    test("all six scenarios produce readable reports", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { report } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        expect(report.advisoryText.length).toBeGreaterThan(50);
        expect(report.reportSummary).toContain("Advisory simulation report");
      }
    });
  });

  describe("simulation suite integration — end-to-end scenarios", () => {
    test.each(ALL_SCENARIO_IDS)("scenario %s produces coherent suite outputs", (scenarioId) => {
      const outputs = runFullSimulationSuite(scenarioId);

      expect(outputs.scenario.id).toBe(scenarioId);
      expect(outputs.simulation.advisoryMetadata.phase).toBe(137);
      expect(outputs.dryRun.advisoryMetadata.phase).toBe(137);
      expect(outputs.validation.advisoryMetadata.phase).toBe(137);
      expect(outputs.summary.advisoryMetadata.phase).toBe(137);
      expect(outputs.report.advisoryMetadata.phase).toBe(137);
      expect(outputs.simulation.stepCount).toBe(outputs.dryRun.stepCount);
    });

    test("healthy workflow end-to-end advisory chain is consistent", () => {
      const outputs = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(outputs.simulation.simulationStatus).toBe(SIMULATION_STATUS.STORAGE_READY);
      expect(outputs.validation.validationStatus).toBe(VALIDATION_STATUS.CONSISTENT);
      expect(outputs.summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_READY);
    });

    test("blocked workflow end-to-end advisory chain is blocked", () => {
      const outputs = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      expect(outputs.simulation.simulationStatus).toBe(SIMULATION_STATUS.BLOCKED);
      expect(outputs.summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_BLOCKED);
    });

    test("approval pending end-to-end chain awaits approval", () => {
      const outputs = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.APPROVAL_PENDING);
      expect(outputs.simulation.simulationStatus).toBe(SIMULATION_STATUS.AWAITING_APPROVAL);
      expect(outputs.summary.summaryPosture).toBe(SUMMARY_POSTURE.SIMULATION_READY);
    });
  });

  describe("isolation", () => {
    test("phase 137 modules do not import each other or other recruitment modules", () => {
      for (let i = 0; i < PHASE_137_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_137_MODULE_PATHS[i]);

        expect(source).toContain("Phase 137");
        expect(source).not.toMatch(/require\(["']\./);
        expect(source).not.toMatch(/require\(["']fs["']\)/);
        expect(source).not.toMatch(/require\(["']express/);
        expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
        expect(source).not.toMatch(/mysql2/);
      }
    });

    test("phase 137 modules are not referenced by prior phase production modules", () => {
      const productionSources = [
        read(GOVERNANCE_POLICY_MODULE_PATH),
        read(ORCHESTRATOR_MODULE_PATH),
        read(COORDINATOR_MODULE_PATH),
        read(GATEWAY_MODULE_PATH),
        read(PIPELINE_MODULE_PATH),
        read(WORKER_MODULE_PATH)
      ];

      for (let i = 0; i < productionSources.length; i += 1) {
        for (let j = 0; j < PHASE_137_EXPORT_PATTERNS.length; j += 1) {
          expect(productionSources[i]).not.toMatch(PHASE_137_EXPORT_PATTERNS[j]);
        }
      }
    });

    test("phase 137 simulation libraries have no require statements", () => {
      for (let i = 0; i < PHASE_137_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_137_MODULE_PATHS[i]);
        expect(source).not.toMatch(/require\(/);
      }
    });
  });

  describe("deterministic output", () => {
    test("scenario library returns identical scenarios for identical ids", () => {
      const first = getRecruitmentWorkflowScenario(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const second = getRecruitmentWorkflowScenario(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("simulation engine returns identical output for identical input", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      const first = simulateRecruitmentWorkflow(context);
      const second = simulateRecruitmentWorkflow(context);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("dry-run executor returns identical output for identical input", () => {
      const simulation = simulateRecruitmentWorkflow(
        buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.REGRESSION)
      );
      const first = executeRecruitmentWorkflowDryRun(simulation);
      const second = executeRecruitmentWorkflowDryRun(simulation);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("simulation validator returns identical output for identical input", () => {
      const { simulation, dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      const input = { simulation, dryRun };
      const first = validateRecruitmentWorkflowSimulation(input);
      const second = validateRecruitmentWorkflowSimulation(input);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("simulation summary returns identical output for identical input", () => {
      const { simulation, dryRun, validation, scenario } = runFullSimulationSuite(
        SIMULATION_SCENARIO_IDS.RECOVERY
      );
      const input = { scenario, simulation, dryRun, validation };
      const first = createRecruitmentWorkflowSimulationSummary(input);
      const second = createRecruitmentWorkflowSimulationSummary(input);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("simulation report returns identical output for identical input", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.APPROVAL_PENDING);
      const first = generateRecruitmentWorkflowSimulationReport({ summary });
      const second = generateRecruitmentWorkflowSimulationReport({ summary });
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("full suite produces identical outputs on repeated runs", () => {
      const first = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const second = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes scenario library output", () => {
      const result = getRecruitmentWorkflowScenario(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      assertAllFrozen(result);
      expect(() => {
        result.label = "CHANGED";
      }).toThrow();
    });

    test("deep freezes simulation engine output", () => {
      const result = simulateRecruitmentWorkflow(
        buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW)
      );
      assertAllFrozen(result);
      expect(() => {
        result.simulationSteps.push({});
      }).toThrow();
    });

    test("deep freezes dry-run executor output", () => {
      const simulation = simulateRecruitmentWorkflow(
        buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW)
      );
      const result = executeRecruitmentWorkflowDryRun(simulation);
      assertAllFrozen(result);
      expect(() => {
        result.dryRunSteps[0].outcome = "CHANGED";
      }).toThrow();
    });

    test("deep freezes simulation validator output", () => {
      const { simulation, dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      const result = validateRecruitmentWorkflowSimulation({ simulation, dryRun });
      assertAllFrozen(result);
      expect(() => {
        result.validationRules[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes simulation summary output", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.REGRESSION);
      assertAllFrozen(summary);
      expect(() => {
        summary.keySimulationSignals.push("CHANGED");
      }).toThrow();
    });

    test("deep freezes simulation report output", () => {
      const { summary } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.RECOVERY);
      const result = generateRecruitmentWorkflowSimulationReport({ summary });
      assertAllFrozen(result);
      expect(() => {
        result.advisoryText = "CHANGED";
      }).toThrow();
    });

    test("does not mutate scenario context input", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      const before = JSON.stringify(context);
      simulateRecruitmentWorkflow(context);
      expect(JSON.stringify(context)).toBe(before);
    });

    test("does not mutate simulation input during dry-run", () => {
      const simulation = simulateRecruitmentWorkflow(
        buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.APPROVAL_PENDING)
      );
      const before = JSON.stringify(simulation);
      executeRecruitmentWorkflowDryRun(simulation);
      expect(JSON.stringify(simulation)).toBe(before);
    });

    test("simulation suite does not mutate process environment", () => {
      const envBefore = { ...process.env };
      runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("phase 137 module sources declare no persistence or integration storage", () => {
      for (let i = 0; i < PHASE_137_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_137_MODULE_PATHS[i]);

        expect(source).toContain("no persistence");
        expect(source).toContain("integrationPersistence: false");
        expect(source).toContain("historyTracking: false");
        expect(source).not.toMatch(/INSERT INTO/i);
        expect(source).not.toMatch(/UPDATE\s+/i);
        expect(source).not.toMatch(/saveIntegration/i);
        expect(source).not.toMatch(/persistIntegration/i);
      }
    });

    test("dry-run outputs always declare persisted false", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { dryRun } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        expect(dryRun.persisted).toBe(false);
      }
    });
  });

  describe("no runtime wiring", () => {
    test("phase 137 modules declare pure advisory simulation constraints", () => {
      for (let i = 0; i < PHASE_137_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_137_MODULE_PATHS[i]);

        expect(source).toContain("Advisory Only");
        expect(source).toContain("Never mutates input");
        expect(source).toContain("No automation");
        expect(source).toContain("advisoryOnly: true");
        expect(source).toContain("executed: false");
        expect(source).toContain("simulationOnly: true");
      }
    });

    test("orchestrator behavior remains unchanged and independent from phase 137 simulation suite", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("simulationStatus");
      expect(orchestration).not.toHaveProperty("dryRunStatus");
      expect(orchestration).not.toHaveProperty("validationStatus");
      expect(orchestration).not.toHaveProperty("summaryPosture");
      expect(orchestration).not.toHaveProperty("advisoryText");
    });

    test("simulation suite outputs never declare executed true", () => {
      const outputs = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      expect(outputs.simulation.advisoryMetadata.executed).toBe(false);
      expect(outputs.dryRun.executed).toBe(false);
      expect(outputs.simulation.simulationPlan.executed).toBe(false);
    });
  });

  describe("scenario library — extended coverage", () => {
    test("each scenario definition has expected outcome", () => {
      const expectedOutcomes = {
        [SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW]: "SIMULATION_COMPLETE",
        [SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW]: "SIMULATION_BLOCKED",
        [SIMULATION_SCENARIO_IDS.APPROVAL_PENDING]: "SIMULATION_AWAITING_APPROVAL",
        [SIMULATION_SCENARIO_IDS.STORAGE_READY]: "SIMULATION_STORAGE_READY",
        [SIMULATION_SCENARIO_IDS.REGRESSION]: "SIMULATION_REGRESSION",
        [SIMULATION_SCENARIO_IDS.RECOVERY]: "SIMULATION_RECOVERY"
      };

      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const scenario = getRecruitmentWorkflowScenario(ALL_SCENARIO_IDS[i]);
        expect(scenario.expectedOutcome).toBe(expectedOutcomes[ALL_SCENARIO_IDS[i]]);
      }
    });

    test("healthy scenario has low risk and healthy health status", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW
      );
      expect(context.health.healthStatus).toBe(HEALTH_STATUS.HEALTHY);
      expect(context.risk.riskLevel).toBe(RISK_LEVEL.LOW);
      expect(context.integrationReadiness.integrationStatus).toBe(
        INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
      );
    });

    test("blocked scenario has critical risk", () => {
      const context = buildRecruitmentWorkflowScenarioContext(
        SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW
      );
      expect(context.risk.riskLevel).toBe(RISK_LEVEL.CRITICAL);
      expect(context.health.healthStatus).toBe(HEALTH_STATUS.BLOCKED);
    });

    test("list scenarios returns frozen array without context", () => {
      const list = listRecruitmentWorkflowScenarios();
      assertAllFrozen(list);
      expect(list[0]).not.toHaveProperty("context");
    });
  });

  describe("simulation engine — extended step evaluation", () => {
    test("draft proposal step blocked when draft missing", () => {
      const result = simulateRecruitmentWorkflow({
        recruitmentId: 1,
        draftProposal: { present: false },
        workflowState: WORKFLOW_STATE.BLOCKED
      });
      const draftStep = result.simulationSteps.find(
        (step) => step.id === SIMULATION_STEP_IDS.DRAFT_PROPOSAL
      );
      expect(draftStep.status).toBe(SIMULATION_STEP_STATUS.BLOCKED);
    });

    test("consistency validation step blocked when inconsistent", () => {
      const result = simulateRecruitmentWorkflow({
        recruitmentId: 1,
        consistencyValidation: { consistencyStatus: CONSISTENCY_STATUS.INCONSISTENT },
        workflowState: WORKFLOW_STATE.REGRESSION_DETECTED
      });
      const consistencyStep = result.simulationSteps.find(
        (step) => step.id === SIMULATION_STEP_IDS.CONSISTENCY_VALIDATION
      );
      expect(consistencyStep.status).toBe(SIMULATION_STEP_STATUS.BLOCKED);
    });

    test("integration readiness step pending when partially ready", () => {
      const result = simulateRecruitmentWorkflow({
        recruitmentId: 1,
        integrationReadiness: { integrationStatus: INTEGRATION_STATUS.PARTIALLY_READY },
        workflowState: WORKFLOW_STATE.RECOVERY_IN_PROGRESS
      });
      const readinessStep = result.simulationSteps.find(
        (step) => step.id === SIMULATION_STEP_IDS.INTEGRATION_READINESS
      );
      expect(readinessStep.status).toBe(SIMULATION_STEP_STATUS.PENDING);
    });

    test("governance review step satisfied when governance complete", () => {
      const result = simulateRecruitmentWorkflow({
        recruitmentId: 1,
        governanceReview: { complete: true },
        workflowState: WORKFLOW_STATE.STORAGE_BOUNDARY_READY
      });
      const governanceStep = result.simulationSteps.find(
        (step) => step.id === SIMULATION_STEP_IDS.GOVERNANCE_REVIEW
      );
      expect(governanceStep.status).toBe(SIMULATION_STEP_STATUS.SATISFIED);
    });
  });

  describe("dry-run executor — extended outcomes", () => {
    test("blocked steps report simulated blocked even when not dry-run eligible", () => {
      const simulation = simulateRecruitmentWorkflow(
        buildRecruitmentWorkflowScenarioContext(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW)
      );
      const dryRun = executeRecruitmentWorkflowDryRun(simulation);
      const blockedSteps = dryRun.dryRunSteps.filter(
        (step) => step.outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_BLOCKED
      );
      expect(blockedSteps.length).toBeGreaterThan(0);
    });

    test("dry-run outcome counts sum to step count", () => {
      const { dryRun } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const total =
        dryRun.successCount +
        dryRun.blockedCount +
        dryRun.pendingCount +
        dryRun.skippedCount +
        dryRun.advisoryCount;
      expect(total).toBe(dryRun.stepCount);
    });
  });

  describe("simulation validator — extended rules", () => {
    test("recruitment id alignment rule passes for all scenarios", () => {
      for (let i = 0; i < ALL_SCENARIO_IDS.length; i += 1) {
        const { validation } = runFullSimulationSuite(ALL_SCENARIO_IDS[i]);
        const rule = validation.validationRules.find(
          (item) => item.id === VALIDATION_RULE_IDS.RECRUITMENT_ID_ALIGNMENT
        );
        expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
      }
    });

    test("plan id presence rule passes for recognized simulations", () => {
      const { validation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const rule = validation.validationRules.find(
        (item) => item.id === VALIDATION_RULE_IDS.PLAN_ID_PRESENCE
      );
      expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
    });

    test("dry-run status coherence passes for blocked workflow", () => {
      const { validation } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.BLOCKED_WORKFLOW);
      const rule = validation.validationRules.find(
        (item) => item.id === VALIDATION_RULE_IDS.DRY_RUN_STATUS_COHERENCE
      );
      expect(rule.status).toBe(VALIDATION_RULE_STATUS.PASSED);
    });
  });

  describe("simulation report — extended sections", () => {
    test("report scenario section includes recruitment id", () => {
      const { report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.HEALTHY_WORKFLOW);
      const scenarioSection = report.reportSections.find(
        (item) => item.section === REPORT_SECTION.SCENARIO
      );
      expect(scenarioSection.content).toContain("137001");
    });

    test("report simulation section includes workflow state", () => {
      const { report } = runFullSimulationSuite(SIMULATION_SCENARIO_IDS.STORAGE_READY);
      const simSection = report.reportSections.find(
        (item) => item.section === REPORT_SECTION.SIMULATION
      );
      expect(simSection.content).toContain("STORAGE_BOUNDARY_READY");
    });
  });
});
