"use strict";

/**
 * Phase 141 — Recruitment Operational Readiness Assessment Framework tests.
 * Verifies deterministic output, empty inputs, partial readiness, fully populated
 * advisory metadata, missing categories, confidence calculations, stable ordering,
 * immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_ENTITY,
  ASSESSMENT_SCHEMA_VERSION,
  OPERATIONAL_READINESS_STATUS,
  CATEGORY_READINESS_LEVEL,
  READINESS_CATEGORY_IDS,
  READINESS_CATEGORY_ORDER,
  READINESS_CATEGORY_DEFINITIONS,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA,
  EXPECTED_RESULT_KEYS,
  buildOperationalReadinessAssessment,
  isOperationalReadinessAssessment
} = require("../server/lib/recruitment/recruitmentOperationalReadinessAssessment");

const {
  FEATURE_FLAG_IDS,
  createRecruitmentWorkflowFeatureFlagStrategy
} = require("../server/lib/recruitment/recruitmentWorkflowFeatureFlagStrategy");

const {
  createRecruitmentWorkflowAdoptionBlueprintSummary
} = require("../server/lib/recruitment/recruitmentWorkflowAdoptionBlueprintSummary");

const {
  evaluateRecruitmentWorkflowRuntimeReadinessGate
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeReadinessGate");

const {
  createRecruitmentWorkflowProductionAdoptionPlaybook
} = require("../server/lib/recruitment/recruitmentWorkflowProductionAdoptionPlaybook");

const {
  createRecruitmentWorkflowRuntimeAdoptionBlueprint
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeAdoptionBlueprint");

const {
  createRecruitmentWorkflowIntegrationRolloutPlan
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationRolloutPlanner");

const {
  createRecruitmentWorkflowCapabilityRegistry
} = require("../server/lib/recruitment/recruitmentWorkflowCapabilityRegistry");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentOperationalReadinessAssessment.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

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

function buildFullyReadyRolloutPlan() {
  return createRecruitmentWorkflowIntegrationRolloutPlan({
    integrationReadiness: {
      integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION"
    }
  });
}

function buildPartialRolloutPlan() {
  return createRecruitmentWorkflowIntegrationRolloutPlan({
    moduleSignals: {
      114: "SATISFIED",
      115: "SATISFIED"
    }
  });
}

function buildBlockedRolloutPlan() {
  return createRecruitmentWorkflowIntegrationRolloutPlan({
    integrationReadiness: {
      integrationStatus: "NOT_READY"
    }
  });
}

function buildFullOperationalInput(overrides = {}) {
  const featureFlagStrategy = createRecruitmentWorkflowFeatureFlagStrategy({
    recruitmentId: "OPS_141"
  });

  const productionAdoptionPlaybook = createRecruitmentWorkflowProductionAdoptionPlaybook({
    recruitmentId: "OPS_141"
  });

  const runtimeReadinessGate = evaluateRecruitmentWorkflowRuntimeReadinessGate({
    recruitmentId: "OPS_141",
    architectureSummary: { summaryPosture: "ARCHITECTURE_READY" },
    futureRuntimeMapping: { mappingPosture: "MAPPING_DEFINED" },
    governanceCompliance: { governancePosture: "COMPLIANT" },
    simulationValidation: { validationStatus: "VALID" },
    integrationContract: { contractStatus: "CONTRACT_READY" },
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    advisoryPosture: { noProductionMutation: true }
  });

  const runtimeAdoptionBlueprint = createRecruitmentWorkflowRuntimeAdoptionBlueprint({
    recruitmentId: "OPS_141",
    architectureSummary: { summaryPosture: "ARCHITECTURE_READY" },
    futureRuntimeMapping: { mappingPosture: "MAPPING_DEFINED" },
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    readinessGate: runtimeReadinessGate,
    governanceCompliance: { governancePosture: "COMPLIANT" },
    productionAdoptionPlaybook
  });

  const adoptionBlueprintSummary = createRecruitmentWorkflowAdoptionBlueprintSummary({
    recruitmentId: "OPS_141",
    runtimeAdoptionBlueprint,
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    runtimeReadinessGate,
    productionAdoptionPlaybook
  });

  const capabilityRegistry = createRecruitmentWorkflowCapabilityRegistry();

  return {
    recruitmentId: "OPS_141",
    adoptionBlueprintSummary,
    runtimeAdoptionBlueprint,
    runtimeReadinessGate,
    productionAdoptionPlaybook,
    featureFlagStrategy,
    integrationRolloutPlan: buildFullyReadyRolloutPlan(),
    observabilityPlanning: {
      observabilityPosture: "OBSERVABILITY_DEFINED",
      contractStatus: "CONTRACT_READY"
    },
    observationRolloutReadiness: {
      status: "READY",
      healthStatus: "READY"
    },
    diagnosticsPlanning: {
      diagnosticsPosture: "DIAGNOSTICS_DEFINED",
      attachmentReady: true,
      coverageRatio: 1
    },
    capabilityRegistry,
    workflowCoverage: {
      registeredCapabilityCount: 8,
      expectedCapabilityCount: 8,
      coverageRatio: 1
    },
    integrationContractSummary: {
      summaryPosture: "INTEGRATION_CONTRACT_READY"
    },
    ...overrides
  };
}

describe("Phase 141 — recruitmentOperationalReadinessAssessment", () => {
  describe("module metadata", () => {
    test("exports phase 141 constants", () => {
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE).toBe(141);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_ENTITY).toBe(
        "recruitment_operational_readiness_assessment"
      );
      expect(ASSESSMENT_SCHEMA_VERSION).toBe("1.0.0");
    });

    test("descriptor declares advisory-only operational readiness assessment", () => {
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR.phase).toBe(141);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR.metadata.advisoryOnly).toBe(
        true
      );
      expect(
        RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR.metadata
          .operationalReadinessAssessmentOnly
      ).toBe(true);
    });

    test("metadata declares no runtime wiring or side effects", () => {
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.flagExecutionEnabled).toBe(false);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.rolloutActivationEnabled).toBe(
        false
      );
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.executed).toBe(false);
    });

    test("metadata source phases include 140", () => {
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.sourcePhases).toContain(140);
      expect(RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA.sourcePhases).toContain(114);
    });

    test("category definitions maintain stable order", () => {
      expect(READINESS_CATEGORY_DEFINITIONS.map((item) => item.id)).toEqual([
        READINESS_CATEGORY_IDS.DEPLOYMENT,
        READINESS_CATEGORY_IDS.OBSERVABILITY,
        READINESS_CATEGORY_IDS.DIAGNOSTICS,
        READINESS_CATEGORY_IDS.ROLLOUT,
        READINESS_CATEGORY_IDS.FEATURE_FLAGS,
        READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE
      ]);
      expect(READINESS_CATEGORY_ORDER).toEqual(READINESS_CATEGORY_DEFINITIONS.map((item) => item.id));
    });
  });

  describe("empty and invalid inputs", () => {
    test("returns unknown status for null input", () => {
      const result = buildOperationalReadinessAssessment(null);
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.recruitmentId).toBeNull();
    });

    test("returns unknown status for undefined input", () => {
      const result = buildOperationalReadinessAssessment(undefined);
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("returns unknown status for empty object", () => {
      const result = buildOperationalReadinessAssessment({});
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.UNKNOWN);
      expect(result.overallReadiness.populatedCategoryCount).toBe(0);
      expect(result.overallReadiness.totalCategoryCount).toBe(6);
    });

    test("returns unknown status for invalid input type", () => {
      const result = buildOperationalReadinessAssessment("invalid");
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.UNKNOWN);
    });

    test("empty input marks all categories unknown with gaps", () => {
      const result = buildOperationalReadinessAssessment({});
      expect(result.deploymentReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.observabilityReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.diagnosticsReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.rolloutReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.featureFlagReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.workflowCoverage.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.UNKNOWN);
      expect(result.knownGaps.length).toBeGreaterThan(0);
      expect(result.recommendedNextActivities.length).toBeGreaterThan(0);
    });

    test("invalid nested field types return unknown assessment", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: "not-an-object"
      });
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.UNKNOWN);
    });
  });

  describe("result structure", () => {
    test("returns all expected result keys", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
        expect(result).toHaveProperty(EXPECTED_RESULT_KEYS[i]);
      }
    });

    test("isOperationalReadinessAssessment validates result shape", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(isOperationalReadinessAssessment(result)).toBe(true);
      expect(isOperationalReadinessAssessment({})).toBe(false);
      expect(isOperationalReadinessAssessment(null)).toBe(false);
    });

    test("advisory metadata declares assessment-only posture", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.operationalReadinessAssessmentOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.flagExecutionEnabled).toBe(false);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = buildFullOperationalInput();
      const first = buildOperationalReadinessAssessment(input);
      const second = buildOperationalReadinessAssessment(input);
      expect(first).toEqual(second);
    });

    test("does not mutate input object", () => {
      const input = buildFullOperationalInput();
      const snapshot = JSON.parse(JSON.stringify(input));
      buildOperationalReadinessAssessment(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      assertAllFrozen(result);
    });

    test("category summaries maintain stable ordering", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      const categoryIds = result.categorySummaries.map((item) => item.categoryId);
      expect(categoryIds).toEqual(READINESS_CATEGORY_ORDER);
      const orders = result.categorySummaries.map((item) => item.order);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("known gaps maintain stable ordering", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({
          includedFlagIds: [FEATURE_FLAG_IDS.ADVISORY_GATEWAY_OBSERVATION]
        }),
        observabilityPlanning: {
          observabilityPosture: "OBSERVABILITY_PARTIAL"
        }
      });

      const firstGapOrder = result.knownGaps.join(",");
      const second = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({
          includedFlagIds: [FEATURE_FLAG_IDS.ADVISORY_GATEWAY_OBSERVATION]
        }),
        observabilityPlanning: {
          observabilityPosture: "OBSERVABILITY_PARTIAL"
        }
      });
      expect(second.knownGaps.join(",")).toBe(firstGapOrder);
    });
  });

  describe("partial readiness", () => {
    test("single category signal yields review required or partially ready status", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({})
      });
      expect(result.featureFlagReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.READY);
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.OPERATIONAL_PARTIALLY_READY);
      expect(result.overallReadiness.populatedCategoryCount).toBe(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(100);
    });

    test("partial deployment signals yield partially ready deployment category", () => {
      const result = buildOperationalReadinessAssessment({
        runtimeAdoptionBlueprint: {
          adoptionPosture: "ADOPTION_ROADMAP_PARTIAL"
        },
        productionAdoptionPlaybook: {
          playbookPosture: "PLAYBOOK_PARTIAL"
        }
      });
      expect(result.deploymentReadiness.readinessLevel).toBe(
        CATEGORY_READINESS_LEVEL.PARTIALLY_READY
      );
      expect(result.deploymentReadiness.gaps).toContain("runtime_adoption_roadmap_partial");
    });

    test("partial observability signals yield partially ready observability category", () => {
      const result = buildOperationalReadinessAssessment({
        observabilityPlanning: {
          observabilityPosture: "OBSERVABILITY_PARTIAL"
        }
      });
      expect(result.observabilityReadiness.readinessLevel).toBe(
        CATEGORY_READINESS_LEVEL.PARTIALLY_READY
      );
      expect(result.observabilityReadiness.gaps).toContain("observability_planning_partial");
    });

    test("partial diagnostics coverage yields partially ready diagnostics category", () => {
      const result = buildOperationalReadinessAssessment({
        diagnosticsPlanning: {
          diagnosticsPosture: "DIAGNOSTICS_PARTIAL",
          coverageRatio: 0.5
        }
      });
      expect(result.diagnosticsReadiness.readinessLevel).toBe(
        CATEGORY_READINESS_LEVEL.PARTIALLY_READY
      );
    });

    test("partial rollout plan yields partially ready rollout category", () => {
      const result = buildOperationalReadinessAssessment({
        integrationRolloutPlan: buildPartialRolloutPlan()
      });
      expect(result.rolloutReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.PARTIALLY_READY);
      expect(result.rolloutReadiness.readyStageCount).toBeGreaterThan(0);
    });

    test("partial feature flag strategy yields partially ready feature flag category", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({
          includedFlagIds: [FEATURE_FLAG_IDS.ADVISORY_GATEWAY_OBSERVATION]
        })
      });
      expect(result.featureFlagReadiness.readinessLevel).toBe(
        CATEGORY_READINESS_LEVEL.PARTIALLY_READY
      );
    });

    test("partial workflow coverage yields partially ready workflow coverage category", () => {
      const result = buildOperationalReadinessAssessment({
        workflowCoverage: {
          registeredCapabilityCount: 4,
          expectedCapabilityCount: 8,
          coverageRatio: 0.5
        }
      });
      expect(result.workflowCoverage.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.PARTIALLY_READY);
      expect(result.workflowCoverage.coverageRatio).toBe(0.5);
    });
  });

  describe("fully populated advisory metadata", () => {
    test("returns operational ready for complete advisory suite", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.OPERATIONAL_READY);
      expect(result.recruitmentId).toBe("OPS_141");
      expect(result.confidence).toBe(100);
    });

    test("all category summaries are ready", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      for (let i = 0; i < result.categorySummaries.length; i += 1) {
        expect(result.categorySummaries[i].readinessLevel).toBe(CATEGORY_READINESS_LEVEL.READY);
        expect(result.categorySummaries[i].score).toBe(100);
        expect(result.categorySummaries[i].hasSignals).toBe(true);
      }
    });

    test("overall readiness reflects populated categories", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.overallReadiness.status).toBe(OPERATIONAL_READINESS_STATUS.OPERATIONAL_READY);
      expect(result.overallReadiness.populatedCategoryCount).toBe(6);
      expect(result.overallReadiness.confidence).toBe(100);
      expect(result.overallReadiness.summary).toContain("Operational readiness satisfied");
    });

    test("known gaps empty when fully ready", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.knownGaps).toEqual([]);
    });

    test("recommended next activities suggest operational review when fully ready", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.recommendedNextActivities).toContain(
        "Proceed with advisory operational readiness review"
      );
    });
  });

  describe("missing categories", () => {
    test("missing categories appear in known gaps", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({})
      });
      expect(result.knownGaps).toContain("deployment_advisory_metadata_missing");
      expect(result.knownGaps).toContain("observability_advisory_metadata_missing");
      expect(result.knownGaps).toContain("diagnostics_advisory_metadata_missing");
      expect(result.knownGaps).toContain("rollout_advisory_metadata_missing");
      expect(result.knownGaps).toContain("workflow_coverage_advisory_metadata_missing");
    });

    test("missing categories recommend supply activities", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({})
      });
      expect(result.recommendedNextActivities).toContain(
        "Supply runtime adoption and deployment advisory metadata"
      );
      expect(result.recommendedNextActivities).toContain(
        "Supply observability planning and observation health advisory metadata"
      );
    });

    test("populated category count reflects only supplied categories", () => {
      const result = buildOperationalReadinessAssessment({
        observabilityPlanning: { observabilityPosture: "OBSERVABILITY_DEFINED" },
        diagnosticsPlanning: {
          diagnosticsPosture: "DIAGNOSTICS_DEFINED",
          attachmentReady: true
        }
      });
      expect(result.overallReadiness.populatedCategoryCount).toBe(2);
    });
  });

  describe("confidence calculations", () => {
    test("confidence is zero for empty input", () => {
      const result = buildOperationalReadinessAssessment({});
      expect(result.confidence).toBe(0);
    });

    test("confidence scales with populated categories and scores", () => {
      const singleCategory = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({})
      });
      expect(singleCategory.confidence).toBe(17);

      const twoCategories = buildOperationalReadinessAssessment({
        featureFlagStrategy: createRecruitmentWorkflowFeatureFlagStrategy({}),
        observabilityPlanning: { observabilityPosture: "OBSERVABILITY_DEFINED" }
      });
      expect(twoCategories.confidence).toBeGreaterThan(singleCategory.confidence);
    });

    test("confidence reaches 100 when all categories ready", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.confidence).toBe(100);
    });

    test("blocked category reduces confidence", () => {
      const ready = buildOperationalReadinessAssessment(buildFullOperationalInput());
      const blocked = buildOperationalReadinessAssessment(
        buildFullOperationalInput({
          runtimeReadinessGate: { gateStatus: "GATE_CLOSED" }
        })
      );
      expect(blocked.confidence).toBeLessThan(ready.confidence);
    });
  });

  describe("blocked readiness", () => {
    test("closed readiness gate blocks deployment category", () => {
      const result = buildOperationalReadinessAssessment({
        runtimeReadinessGate: { gateStatus: "GATE_CLOSED" },
        adoptionBlueprintSummary: { summaryPosture: "ADOPTION_BLOCKED" }
      });
      expect(result.deploymentReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.BLOCKED);
      expect(result.status).toBe(OPERATIONAL_READINESS_STATUS.OPERATIONAL_BLOCKED);
    });

    test("blocked feature flag strategy blocks feature flag category", () => {
      const result = buildOperationalReadinessAssessment({
        featureFlagStrategy: { flagStrategyPosture: "STRATEGY_BLOCKED", flagCount: 1 }
      });
      expect(result.featureFlagReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.BLOCKED);
    });

    test("blocked rollout stage blocks rollout category", () => {
      const result = buildOperationalReadinessAssessment({
        integrationRolloutPlan: buildBlockedRolloutPlan()
      });
      expect(result.rolloutReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.BLOCKED);
    });

    test("blocked observability planning blocks observability category", () => {
      const result = buildOperationalReadinessAssessment({
        observabilityPlanning: { observabilityPosture: "OBSERVABILITY_BLOCKED" }
      });
      expect(result.observabilityReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.BLOCKED);
    });

    test("blocked diagnostics planning blocks diagnostics category", () => {
      const result = buildOperationalReadinessAssessment({
        diagnosticsPlanning: { diagnosticsPosture: "DIAGNOSTICS_BLOCKED" }
      });
      expect(result.diagnosticsReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.BLOCKED);
    });
  });

  describe("rollout planner input aliases", () => {
    test("accepts integrationRolloutPlanner alias", () => {
      const rolloutPlan = buildFullyReadyRolloutPlan();
      const result = buildOperationalReadinessAssessment({
        integrationRolloutPlanner: rolloutPlan
      });
      expect(result.rolloutReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.READY);
    });

    test("accepts rolloutPlanner alias", () => {
      const rolloutPlan = buildFullyReadyRolloutPlan();
      const result = buildOperationalReadinessAssessment({
        rolloutPlanner: rolloutPlan
      });
      expect(result.rolloutReadiness.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.READY);
    });
  });

  describe("workflow coverage from capability registry", () => {
    test("derives coverage from capability registry capabilities array", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      const result = buildOperationalReadinessAssessment({
        capabilityRegistry: registry
      });
      expect(result.workflowCoverage.registeredCapabilityCount).toBe(8);
      expect(result.workflowCoverage.readinessLevel).toBe(CATEGORY_READINESS_LEVEL.READY);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence", () => {
      const source = read(MODULE_PATH);
      expect(source).toContain("no persistence");
      expect(source).toContain("persistenceEnabled: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module declares pure advisory contract constraints", () => {
      const source = read(MODULE_PATH);
      expect(source).toContain("Advisory Only");
      expect(source).toContain("Never mutates input");
      expect(source).toContain("advisoryOnly: true");
      expect(source).toContain("executed: false");
      expect(source).toContain("flagExecutionEnabled: false");
      expect(source).toContain("rolloutActivationEnabled: false");
    });

    test("module has no runtime require statements", () => {
      const source = read(MODULE_PATH);
      expect(source).not.toMatch(/require\(/);
    });

    test("orchestrator behavior remains unchanged and independent from phase 141", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 141,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("overallReadiness");
      expect(orchestration).not.toHaveProperty("operationalReadiness");
      expect(orchestration).not.toHaveProperty("confidence");
    });

    test("assessment output never declares executed true", () => {
      const result = buildOperationalReadinessAssessment(buildFullOperationalInput());
      expect(result.advisoryMetadata.executed).toBe(false);
    });

    test("phase 141 module is not imported by orchestrator", () => {
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      expect(orchestratorSource).not.toContain("recruitmentOperationalReadinessAssessment");
    });

    test("phase 141 module is not imported by coordinator", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      expect(coordinatorSource).not.toContain("recruitmentOperationalReadinessAssessment");
    });

    test("phase 141 module is not imported by advisory gateway", () => {
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      expect(gatewaySource).not.toContain("recruitmentOperationalReadinessAssessment");
    });

    test("phase 141 module is not imported by recruitment pipeline", () => {
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      expect(pipelineSource).not.toContain("recruitmentOperationalReadinessAssessment");
    });

    test("phase 141 module is not imported by site worker", () => {
      const workerSource = read(WORKER_MODULE_PATH);
      expect(workerSource).not.toContain("recruitmentOperationalReadinessAssessment");
    });
  });
});
