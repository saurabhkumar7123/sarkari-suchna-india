"use strict";

/**
 * Phase 145 — Implementation Readiness Contract Layer tests.
 * Verifies deterministic output, invalid inputs, empty metadata, contract
 * validation, readiness calculations, activation sequencing, boundary
 * validation, stable ordering, and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_IMPLEMENTATION_CONTRACT_PHASE,
  RECRUITMENT_IMPLEMENTATION_CONTRACT_ENTITY,
  CONTRACT_VERSION,
  CONTRACT_POSTURE,
  IMPLEMENTATION_STAGE_IDS,
  IMPLEMENTATION_STAGE_DEFINITIONS,
  SUPPORTED_CAPABILITY_IDS,
  SUPPORTED_CAPABILITY_DEFINITIONS,
  EXECUTION_REQUIREMENT_DEFINITIONS,
  VALIDATION_REQUIREMENT_DEFINITIONS,
  ROLLBACK_REQUIREMENT_DEFINITIONS,
  RUNTIME_BOUNDARY_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_CONTRACT_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_CONTRACT_METADATA,
  EXPECTED_RESULT_KEYS: CONTRACT_EXPECTED_KEYS,
  buildRecruitmentImplementationContract,
  isRecruitmentImplementationContract
} = require("../server/lib/recruitment/recruitmentImplementationContract");

const {
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_ENTITY,
  EXPECTED_CONTRACT_VERSION,
  VALIDATION_STATUS,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA,
  EXPECTED_RESULT_KEYS: VALIDATOR_EXPECTED_KEYS,
  validateRecruitmentImplementationPlan,
  isRecruitmentImplementationValidation
} = require("../server/lib/recruitment/recruitmentImplementationValidator");

const {
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_ENTITY,
  ACTIVATION_PLAN_POSTURE,
  CHECKPOINT_STATUS,
  ACTIVATION_ORDER_DEFINITIONS,
  VERIFICATION_CHECKPOINT_DEFINITIONS,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_DESCRIPTOR,
  RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA,
  EXPECTED_RESULT_KEYS: ACTIVATION_EXPECTED_KEYS,
  buildRecruitmentCapabilityActivationPlan,
  isRecruitmentCapabilityActivationPlan
} = require("../server/lib/recruitment/recruitmentCapabilityActivationPlan");

const {
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_ENTITY,
  BOUNDARY_CONTRACT_POSTURE,
  ISOLATION_STATUS,
  PROTECTED_COMPONENT_DEFINITIONS,
  ALLOWED_EXTENSION_POINT_DEFINITIONS,
  PROHIBITED_INTEGRATION_DEFINITIONS,
  ISOLATION_GUARANTEE_DEFINITIONS,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_DESCRIPTOR,
  RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_METADATA,
  EXPECTED_RESULT_KEYS: BOUNDARY_EXPECTED_KEYS,
  buildRecruitmentRuntimeBoundaryContract,
  isRecruitmentRuntimeBoundaryContract
} = require("../server/lib/recruitment/recruitmentRuntimeBoundaryContract");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const CONTRACT_MODULE = "server/lib/recruitment/recruitmentImplementationContract.js";
const VALIDATOR_MODULE = "server/lib/recruitment/recruitmentImplementationValidator.js";
const ACTIVATION_MODULE = "server/lib/recruitment/recruitmentCapabilityActivationPlan.js";
const BOUNDARY_MODULE = "server/lib/recruitment/recruitmentRuntimeBoundaryContract.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_145_MODULES = [
  "recruitmentImplementationContract",
  "recruitmentImplementationValidator",
  "recruitmentCapabilityActivationPlan",
  "recruitmentRuntimeBoundaryContract"
];

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

function buildCompleteImplementationPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice()
  };
}

describe("Phase 145 — recruitmentImplementationContract", () => {
  describe("module metadata", () => {
    test("exports phase 145 constants", () => {
      expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_PHASE).toBe(145);
      expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_ENTITY).toBe(
        "recruitment_implementation_contract"
      );
      expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_DESCRIPTOR.phase).toBe(145);
      expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_METADATA.executed).toBe(false);
      expect(CONTRACT_VERSION).toBe("1.0.0");
    });

    test("schema covers required contract domains", () => {
      expect(IMPLEMENTATION_STAGE_IDS).toHaveLength(8);
      expect(SUPPORTED_CAPABILITY_IDS).toHaveLength(8);
      expect(IMPLEMENTATION_STAGE_DEFINITIONS).toHaveLength(8);
      expect(SUPPORTED_CAPABILITY_DEFINITIONS).toHaveLength(8);
      expect(EXECUTION_REQUIREMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(7);
      expect(VALIDATION_REQUIREMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(6);
      expect(ROLLBACK_REQUIREMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(5);
      expect(RUNTIME_BOUNDARY_DEFINITIONS).toHaveLength(5);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const input = {
        recruitmentId: "IMPL_145",
        transitionManifest: { transitionReadiness: "READY_FOR_TRANSITION_PLANNING" }
      };
      const a = buildRecruitmentImplementationContract(input);
      const b = buildRecruitmentImplementationContract(input);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const result = buildRecruitmentImplementationContract({ recruitmentId: "FROZEN" });
      assertAllFrozen(result);
      expect(isRecruitmentImplementationContract(result)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = {
        recruitmentId: "MUT",
        transitionManifest: { transitionReadiness: "READY_FOR_TRANSITION_PLANNING" }
      };
      const snapshot = JSON.stringify(input);
      buildRecruitmentImplementationContract(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });

  describe("invalid inputs and empty metadata", () => {
    test("null input yields UNKNOWN recruitmentId and posture", () => {
      const result = buildRecruitmentImplementationContract(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.contractPosture).toBe(CONTRACT_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.contractVersion).toBe(CONTRACT_VERSION);
    });

    test("empty object yields contract schema with partial confidence", () => {
      const result = buildRecruitmentImplementationContract({});
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.implementationStages).toHaveLength(8);
      expect(result.supportedCapabilities).toHaveLength(8);
      expect(CONTRACT_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))).toBe(
        true
      );
    });

    test("non-object input is handled safely", () => {
      const result = buildRecruitmentImplementationContract("invalid");
      expect(result.contractVersion).toBe(CONTRACT_VERSION);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });

  describe("stable ordering", () => {
    test("implementation stages are ordered by order field", () => {
      const result = buildRecruitmentImplementationContract({
        recruitmentId: "ORDER",
        architectureManifest: { maturityLevel: "ADVISORY_COMPLETE" }
      });
      for (let i = 1; i < result.implementationStages.length; i += 1) {
        expect(result.implementationStages[i].order).toBeGreaterThan(
          result.implementationStages[i - 1].order
        );
      }
    });

    test("runtime boundaries list protected components in stable order", () => {
      const result = buildRecruitmentImplementationContract({
        recruitmentId: "BOUND",
        completionReport: { overallCompletion: { status: "COMPLETE" } }
      });
      expect(result.runtimeBoundaries.map((b) => b.id)).toEqual([
        "BOUNDARY_ORCHESTRATOR",
        "BOUNDARY_COORDINATOR",
        "BOUNDARY_WORKER",
        "BOUNDARY_GATEWAY",
        "BOUNDARY_PIPELINE"
      ]);
    });
  });
});

describe("Phase 145 — recruitmentImplementationValidator", () => {
  describe("module metadata", () => {
    test("exports phase 145 validator constants", () => {
      expect(RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE).toBe(145);
      expect(RECRUITMENT_IMPLEMENTATION_VALIDATOR_ENTITY).toBe(
        "recruitment_implementation_validator"
      );
      expect(RECRUITMENT_IMPLEMENTATION_VALIDATOR_DESCRIPTOR.phase).toBe(145);
      expect(RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA.validationOnly).toBe(true);
      expect(EXPECTED_CONTRACT_VERSION).toBe("1.0.0");
    });
  });

  describe("contract validation", () => {
    test("complete plan validates as VALID with full readiness", () => {
      const result = validateRecruitmentImplementationPlan({
        recruitmentId: "VALID_145",
        implementationPlan: buildCompleteImplementationPlan()
      });
      expect(result.valid).toBe(true);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.VALID);
      expect(result.missingRequirements).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.readinessScore).toBe(100);
      expect(isRecruitmentImplementationValidation(result)).toBe(true);
    });

    test("inline plan fields are accepted", () => {
      const result = validateRecruitmentImplementationPlan({
        recruitmentId: "INLINE",
        ...buildCompleteImplementationPlan()
      });
      expect(result.valid).toBe(true);
      expect(result.readinessScore).toBe(100);
    });

    test("missing stages produce missingRequirements and lower score", () => {
      const plan = buildCompleteImplementationPlan();
      plan.implementationStages = ["STAGE_CONTRACT_ALIGNMENT"];
      const result = validateRecruitmentImplementationPlan({
        recruitmentId: "PARTIAL",
        implementationPlan: plan
      });
      expect(result.valid).toBe(false);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
      expect(result.readinessScore).toBeLessThan(100);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.PARTIALLY_VALID);
    });

    test("incompatible contract version is invalid", () => {
      const plan = buildCompleteImplementationPlan();
      plan.contractVersion = "9.9.9";
      const result = validateRecruitmentImplementationPlan({
        recruitmentId: "BAD_VER",
        implementationPlan: plan
      });
      expect(result.missingRequirements).toContain("VAL_CONTRACT_VERSION");
      expect(result.valid).toBe(false);
    });
  });

  describe("readiness calculations", () => {
    test("empty metadata yields UNKNOWN with zero readiness", () => {
      const result = validateRecruitmentImplementationPlan({});
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
      expect(result.valid).toBe(false);
      expect(result.readinessScore).toBe(0);
      expect(result.missingRequirements).toContain("IMPLEMENTATION_PLAN");
    });

    test("null input is handled safely", () => {
      const result = validateRecruitmentImplementationPlan(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.readinessScore).toBe(0);
      assertAllFrozen(result);
    });

    test("warnings reduce readiness score", () => {
      const plan = buildCompleteImplementationPlan();
      plan.runtimeWiringEnabled = true;
      plan.rolloutActivationEnabled = true;
      const result = validateRecruitmentImplementationPlan({
        recruitmentId: "WARN",
        implementationPlan: plan
      });
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.readinessScore).toBeLessThan(100);
      expect(result.valid).toBe(true);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.PARTIALLY_VALID);
    });

    test("identical plans produce deterministic validation", () => {
      const input = {
        recruitmentId: "DET",
        implementationPlan: buildCompleteImplementationPlan()
      };
      const a = validateRecruitmentImplementationPlan(input);
      const b = validateRecruitmentImplementationPlan(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe("stable ordering", () => {
    test("findings and missingRequirements are stably ordered", () => {
      const plan = {
        contractVersion: "1.0.0",
        implementationStages: [],
        supportedCapabilities: [],
        executionRequirements: [],
        rollbackRequirements: [],
        runtimeBoundaries: []
      };
      const a = validateRecruitmentImplementationPlan({ recruitmentId: "SORT", implementationPlan: plan });
      const b = validateRecruitmentImplementationPlan({ recruitmentId: "SORT", implementationPlan: plan });
      expect(a.missingRequirements).toEqual(b.missingRequirements);
      expect(a.findings.map((f) => f.id)).toEqual(b.findings.map((f) => f.id));
      const sortedMissing = a.missingRequirements.slice().sort();
      expect(a.missingRequirements).toEqual(sortedMissing);
    });

    test("result contains all expected keys", () => {
      const result = validateRecruitmentImplementationPlan({
        implementationPlan: buildCompleteImplementationPlan()
      });
      expect(VALIDATOR_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))).toBe(
        true
      );
    });
  });
});

describe("Phase 145 — recruitmentCapabilityActivationPlan", () => {
  describe("module metadata", () => {
    test("exports phase 145 activation plan constants", () => {
      expect(RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_PHASE).toBe(145);
      expect(RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_ENTITY).toBe(
        "recruitment_capability_activation_plan"
      );
      expect(RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA.activationEnabled).toBe(false);
      expect(RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA.activatesAnything).toBe(false);
      expect(ACTIVATION_ORDER_DEFINITIONS).toHaveLength(8);
      expect(VERIFICATION_CHECKPOINT_DEFINITIONS).toHaveLength(8);
    });
  });

  describe("activation sequencing", () => {
    test("recommended activation order is sequential and never activated", () => {
      const result = buildRecruitmentCapabilityActivationPlan({
        recruitmentId: "ACT_145",
        transitionManifest: { transitionReadiness: "READY_FOR_TRANSITION_PLANNING" }
      });
      expect(result.recommendedActivationOrder).toHaveLength(8);
      for (let i = 0; i < result.recommendedActivationOrder.length; i += 1) {
        expect(result.recommendedActivationOrder[i].order).toBe(i + 1);
        expect(result.recommendedActivationOrder[i].activated).toBe(false);
      }
      expect(result.advisoryMetadata.activated).toBe(false);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(isRecruitmentCapabilityActivationPlan(result)).toBe(true);
    });

    test("dependencies and prerequisites are documented", () => {
      const result = buildRecruitmentCapabilityActivationPlan({ recruitmentId: "DEPS" });
      expect(result.dependencies).toHaveLength(8);
      expect(result.prerequisiteCapabilities).toHaveLength(8);
      expect(result.dependencies[0].dependsOn).toEqual([]);
      expect(result.dependencies[7].dependsOn).toContain("CAP_ROLLBACK");
    });

    test("verification checkpoints remain non-activated", () => {
      const result = buildRecruitmentCapabilityActivationPlan({
        recruitmentId: "CHK",
        readyCapabilities: ["CAP_BOUNDARY_ISOLATION"]
      });
      expect(result.verificationCheckpoints).toHaveLength(8);
      expect(result.verificationCheckpoints.every((c) => c.activated === false)).toBe(true);
      expect(result.verificationCheckpoints[0].status).toBe(CHECKPOINT_STATUS.READY);
    });

    test("controlled coupling is last in sequence", () => {
      const result = buildRecruitmentCapabilityActivationPlan({});
      const last = result.recommendedActivationOrder[result.recommendedActivationOrder.length - 1];
      expect(last.capabilityId).toBe("CAP_CONTROLLED_COUPLING");
      expect(last.order).toBe(8);
    });
  });

  describe("invalid inputs and empty metadata", () => {
    test("null input yields UNKNOWN posture", () => {
      const result = buildRecruitmentCapabilityActivationPlan(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.activationPlanPosture).toBe(ACTIVATION_PLAN_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
      assertAllFrozen(result);
    });

    test("empty object still defines full sequence", () => {
      const result = buildRecruitmentCapabilityActivationPlan({});
      expect(result.recommendedActivationOrder).toHaveLength(8);
      expect(result.verificationCheckpoints.every((c) => c.status === CHECKPOINT_STATUS.UNKNOWN)).toBe(
        true
      );
      expect(ACTIVATION_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))).toBe(
        true
      );
    });

    test("deterministic for identical ready capability signals", () => {
      const input = {
        recruitmentId: "SEQ",
        readyCapabilities: ["CAP_BOUNDARY_ISOLATION", "CAP_RUNTIME_ADAPTER"]
      };
      const a = buildRecruitmentCapabilityActivationPlan(input);
      const b = buildRecruitmentCapabilityActivationPlan(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });
});

describe("Phase 145 — recruitmentRuntimeBoundaryContract", () => {
  describe("module metadata", () => {
    test("exports phase 145 boundary constants", () => {
      expect(RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_PHASE).toBe(145);
      expect(RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_ENTITY).toBe(
        "recruitment_runtime_boundary_contract"
      );
      expect(RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_DESCRIPTOR.phase).toBe(145);
      expect(PROTECTED_COMPONENT_DEFINITIONS).toHaveLength(5);
      expect(ALLOWED_EXTENSION_POINT_DEFINITIONS.length).toBeGreaterThanOrEqual(5);
      expect(PROHIBITED_INTEGRATION_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
      expect(ISOLATION_GUARANTEE_DEFINITIONS.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("boundary validation", () => {
    test("acknowledged boundaries report ISOLATED status", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({
        recruitmentId: "ISO_145",
        acknowledgeBoundaries: true,
        transitionManifest: { transitionReadiness: "READY_FOR_TRANSITION_PLANNING" }
      });
      expect(result.isolationStatus).toBe(ISOLATION_STATUS.ISOLATED);
      expect(result.boundaryContractPosture).toBe(BOUNDARY_CONTRACT_POSTURE.BOUNDARIES_DOCUMENTED);
      expect(isRecruitmentRuntimeBoundaryContract(result)).toBe(true);
    });

    test("reported violations yield VIOLATED isolation status", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({
        recruitmentId: "VIOL",
        boundaryViolations: ["PROHIBIT_ORCHESTRATOR_IMPORT", "PROHIBIT_DB_WRITES"]
      });
      expect(result.isolationStatus).toBe(ISOLATION_STATUS.VIOLATED);
      expect(result.confidence).toBeLessThan(70);
    });

    test("protected components cover orchestrator coordinator worker gateway pipeline", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({ recruitmentId: "PROT" });
      const components = result.protectedComponents.map((c) => c.component);
      expect(components).toEqual([
        "recruitmentWorkflowOrchestrator",
        "recruitmentWorkflowIntegrationCoordinator",
        "siteWorker",
        "recruitmentWorkflowAdvisoryGateway",
        "runRecruitmentPipeline"
      ]);
      expect(result.protectedComponents.every((c) => c.protected === true)).toBe(true);
      expect(result.protectedComponents.every((c) => c.advisoryImportsAllowed === false)).toBe(true);
    });

    test("prohibited integrations all marked prohibited", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({});
      expect(result.prohibitedIntegrations.every((p) => p.prohibited === true)).toBe(true);
      expect(result.allowedExtensionPoints.every((e) => e.activatesRuntime === false)).toBe(true);
    });
  });

  describe("invalid inputs and empty metadata", () => {
    test("null input yields UNKNOWN posture", () => {
      const result = buildRecruitmentRuntimeBoundaryContract(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.isolationStatus).toBe(ISOLATION_STATUS.UNKNOWN);
      expect(result.boundaryContractPosture).toBe(BOUNDARY_CONTRACT_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
      assertAllFrozen(result);
    });

    test("empty object documents full boundary schema", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({});
      expect(result.protectedComponents).toHaveLength(5);
      expect(result.isolationGuarantees.length).toBeGreaterThanOrEqual(6);
      expect(BOUNDARY_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))).toBe(
        true
      );
    });

    test("deterministic output for identical inputs", () => {
      const input = { recruitmentId: "BDET", acknowledgeBoundaries: true };
      const a = buildRecruitmentRuntimeBoundaryContract(input);
      const b = buildRecruitmentRuntimeBoundaryContract(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe("stable ordering", () => {
    test("protected components and guarantees are order-stable", () => {
      const result = buildRecruitmentRuntimeBoundaryContract({
        recruitmentId: "ORD",
        acknowledgeBoundaries: true
      });
      for (let i = 1; i < result.protectedComponents.length; i += 1) {
        expect(result.protectedComponents[i].order).toBeGreaterThan(
          result.protectedComponents[i - 1].order
        );
      }
      for (let i = 1; i < result.isolationGuarantees.length; i += 1) {
        expect(result.isolationGuarantees[i].order).toBeGreaterThan(
          result.isolationGuarantees[i - 1].order
        );
      }
    });
  });
});

describe("Phase 145 — integrated contract architecture", () => {
  test("contract stages align with validator required stages", () => {
    const contract = buildRecruitmentImplementationContract({
      recruitmentId: "ALIGN",
      transitionManifest: {}
    });
    const stageIds = contract.implementationStages.map((s) => s.id).sort();
    expect(stageIds).toEqual(REQUIRED_STAGE_IDS.slice().sort());
  });

  test("contract capabilities align with validator required capabilities", () => {
    const contract = buildRecruitmentImplementationContract({
      recruitmentId: "ALIGN",
      completionReport: {}
    });
    const capabilityIds = contract.supportedCapabilities.map((c) => c.id).sort();
    expect(capabilityIds).toEqual(REQUIRED_CAPABILITY_IDS.slice().sort());
  });

  test("activation plan capabilities match contract supported capabilities", () => {
    const contract = buildRecruitmentImplementationContract({ recruitmentId: "CAP" });
    const activation = buildRecruitmentCapabilityActivationPlan({ recruitmentId: "CAP" });
    const contractCaps = contract.supportedCapabilities.map((c) => c.id).sort();
    const activationCaps = activation.recommendedActivationOrder.map((c) => c.capabilityId).sort();
    expect(activationCaps).toEqual(contractCaps);
  });

  test("boundary protected components match contract runtime boundaries", () => {
    const contract = buildRecruitmentImplementationContract({ recruitmentId: "B" });
    const boundary = buildRecruitmentRuntimeBoundaryContract({ recruitmentId: "B" });
    const contractComponents = contract.runtimeBoundaries.map((b) => b.component);
    const protectedComponents = boundary.protectedComponents.map((b) => b.component);
    expect(protectedComponents).toEqual(contractComponents);
  });

  test("complete plan validates against contract schema end-to-end", () => {
    const contract = buildRecruitmentImplementationContract({
      recruitmentId: "E2E",
      transitionManifest: { transitionReadiness: "READY_FOR_TRANSITION_PLANNING" },
      completionReport: { overallCompletion: { status: "COMPLETE", percentage: 100 } }
    });
    const validation = validateRecruitmentImplementationPlan({
      recruitmentId: "E2E",
      implementationPlan: {
        contractVersion: contract.contractVersion,
        implementationStages: contract.implementationStages,
        supportedCapabilities: contract.supportedCapabilities,
        executionRequirements: contract.executionRequirements,
        rollbackRequirements: contract.rollbackRequirements,
        runtimeBoundaries: contract.runtimeBoundaries
      }
    });
    expect(validation.valid).toBe(true);
    expect(validation.readinessScore).toBe(100);
  });
});

describe("Phase 145 — runtime isolation", () => {
  const modulePaths = [CONTRACT_MODULE, VALIDATOR_MODULE, ACTIVATION_MODULE, BOUNDARY_MODULE];

  test.each(modulePaths)("module %s declares no persistence", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("no persistence");
    expect(source).toContain("persistenceEnabled: false");
    expect(source).not.toMatch(/INSERT INTO/i);
    expect(source).not.toMatch(/UPDATE\s+/i);
  });

  test.each(modulePaths)("module %s declares advisory-only contract", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("Advisory Only");
    expect(source).toContain("advisoryOnly: true");
    expect(source).toContain("executed: false");
    expect(source).toContain("flagExecutionEnabled: false");
    expect(source).toContain("rolloutActivationEnabled: false");
  });

  test.each(modulePaths)("module %s has no runtime require statements", (modulePath) => {
    const source = read(modulePath);
    expect(source).not.toMatch(/require\(/);
  });

  test("orchestrator behavior remains unchanged and independent from phase 145", () => {
    const orchestration = orchestrateRecruitmentWorkflow({
      recruitmentId: 145,
      eventType: "notification"
    });

    expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
    expect(orchestration.advisory).toBe(true);
    expect(orchestration.executed).toBe(false);
    expect(orchestration).not.toHaveProperty("contractVersion");
    expect(orchestration).not.toHaveProperty("validationStatus");
    expect(orchestration).not.toHaveProperty("activationPlanPosture");
    expect(orchestration).not.toHaveProperty("isolationStatus");
  });

  test.each(PHASE_145_MODULES)("phase 145 module %s is not imported by orchestrator", (moduleName) => {
    expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_145_MODULES)("phase 145 module %s is not imported by coordinator", (moduleName) => {
    expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_145_MODULES)("phase 145 module %s is not imported by advisory gateway", (moduleName) => {
    expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_145_MODULES)("phase 145 module %s is not imported by recruitment pipeline", (moduleName) => {
    expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_145_MODULES)("phase 145 module %s is not imported by site worker", (moduleName) => {
    expect(read(WORKER_MODULE)).not.toContain(moduleName);
  });

  test("all phase 145 outputs declare executed false and no activation", () => {
    const contract = buildRecruitmentImplementationContract({ recruitmentId: "ISO" });
    const validation = validateRecruitmentImplementationPlan({
      recruitmentId: "ISO",
      implementationPlan: buildCompleteImplementationPlan()
    });
    const activation = buildRecruitmentCapabilityActivationPlan({ recruitmentId: "ISO" });
    const boundary = buildRecruitmentRuntimeBoundaryContract({
      recruitmentId: "ISO",
      acknowledgeBoundaries: true
    });

    expect(contract.advisoryMetadata.executed).toBe(false);
    expect(validation.advisoryMetadata.executed).toBe(false);
    expect(activation.advisoryMetadata.executed).toBe(false);
    expect(boundary.advisoryMetadata.executed).toBe(false);
    expect(contract.advisoryMetadata.activatesAnything).toBe(false);
    expect(validation.advisoryMetadata.activatesAnything).toBe(false);
    expect(activation.advisoryMetadata.activatesAnything).toBe(false);
    expect(boundary.advisoryMetadata.activatesAnything).toBe(false);
  });

  test("metadata source phases include 144", () => {
    expect(RECRUITMENT_IMPLEMENTATION_CONTRACT_METADATA.sourcePhases).toContain(144);
    expect(RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA.sourcePhases).toContain(144);
    expect(RECRUITMENT_CAPABILITY_ACTIVATION_PLAN_METADATA.sourcePhases).toContain(144);
    expect(RECRUITMENT_RUNTIME_BOUNDARY_CONTRACT_METADATA.sourcePhases).toContain(144);
  });
});
