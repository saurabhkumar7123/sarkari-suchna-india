"use strict";

/**
 * Phase 138 — Recruitment Workflow Runtime Integration Contract Suite tests.
 * Verifies integration contract, adapter interface, compatibility validator,
 * version registry, migration planner, integration contract summary, isolation,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_ENTITY,
  CONTRACT_SCHEMA_VERSION,
  CONTRACT_POSTURE,
  INTEGRATION_SURFACE_STATUS,
  INTEGRATION_SURFACE_IDS,
  INTEGRATION_SURFACE_DEFINITIONS,
  CAPABILITY_REQUIREMENT_IDS,
  CAPABILITY_REQUIREMENT_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA,
  createRecruitmentWorkflowRuntimeIntegrationContract,
  isRecruitmentWorkflowRuntimeIntegrationContract
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeIntegrationContract");

const {
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY,
  ADAPTER_INTERFACE_VERSION,
  ADAPTER_METHOD_IDS,
  ADAPTER_METHOD_DEFINITIONS,
  ADAPTER_CAPABILITY_IDS,
  ADAPTER_CAPABILITY_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA,
  getRecruitmentWorkflowRuntimeAdapterInterface,
  isRecruitmentWorkflowRuntimeAdapterInterface,
  assessAdapterCapabilityConformance
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeAdapterInterface");

const {
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_ENTITY,
  COMPATIBILITY_STATUS,
  COMPATIBILITY_RULE_STATUS,
  COMPATIBILITY_RULE_IDS,
  COMPATIBILITY_RULE_DEFINITIONS,
  VERSION_LIFECYCLE,
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_METADATA,
  validateRecruitmentWorkflowContractCompatibility
} = require("../server/lib/recruitment/recruitmentWorkflowContractCompatibilityValidator");

const {
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_ENTITY,
  VERSION_IDS,
  CONTRACT_VERSION_DEFINITIONS,
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_METADATA,
  getRecruitmentWorkflowContractVersion,
  listRecruitmentWorkflowContractVersions,
  resolveRecruitmentWorkflowContractVersionLifecycle,
  compareRecruitmentWorkflowContractVersions,
  isRecruitmentWorkflowContractVersionEntry
} = require("../server/lib/recruitment/recruitmentWorkflowContractVersionRegistry");

const {
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_ENTITY,
  MIGRATION_STAGE_STATUS,
  MIGRATION_POSTURE,
  MIGRATION_STAGE_IDS,
  MIGRATION_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA,
  createRecruitmentWorkflowRuntimeMigrationPlan
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeMigrationPlanner");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_ENTITY,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_METADATA,
  createRecruitmentWorkflowIntegrationContractSummary
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationContractSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");

const INTEGRATION_CONTRACT_PATH =
  "server/lib/recruitment/recruitmentWorkflowRuntimeIntegrationContract.js";
const ADAPTER_INTERFACE_PATH =
  "server/lib/recruitment/recruitmentWorkflowRuntimeAdapterInterface.js";
const COMPATIBILITY_VALIDATOR_PATH =
  "server/lib/recruitment/recruitmentWorkflowContractCompatibilityValidator.js";
const VERSION_REGISTRY_PATH =
  "server/lib/recruitment/recruitmentWorkflowContractVersionRegistry.js";
const MIGRATION_PLANNER_PATH =
  "server/lib/recruitment/recruitmentWorkflowRuntimeMigrationPlanner.js";
const INTEGRATION_SUMMARY_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationContractSummary.js";

const PHASE_138_MODULE_PATHS = Object.freeze([
  INTEGRATION_CONTRACT_PATH,
  ADAPTER_INTERFACE_PATH,
  COMPATIBILITY_VALIDATOR_PATH,
  VERSION_REGISTRY_PATH,
  MIGRATION_PLANNER_PATH,
  INTEGRATION_SUMMARY_PATH
]);

const PHASE_138_EXPORT_PATTERNS = Object.freeze([
  /createRecruitmentWorkflowRuntimeIntegrationContract/,
  /getRecruitmentWorkflowRuntimeAdapterInterface/,
  /validateRecruitmentWorkflowContractCompatibility/,
  /getRecruitmentWorkflowContractVersion/,
  /createRecruitmentWorkflowRuntimeMigrationPlan/,
  /createRecruitmentWorkflowIntegrationContractSummary/
]);

const SIMULATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSimulationEngine.js";
const GOVERNANCE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationGovernancePolicy.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

const ALL_SURFACE_IDS = Object.freeze(Object.values(INTEGRATION_SURFACE_IDS));

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

function buildFullAdapterCapabilities() {
  return {
    [ADAPTER_CAPABILITY_IDS.ADVISORY_ONLY]: true,
    [ADAPTER_CAPABILITY_IDS.INPUT_IMMUTABILITY]: true,
    [ADAPTER_CAPABILITY_IDS.DETERMINISTIC_OUTPUT]: true,
    [ADAPTER_CAPABILITY_IDS.DEEP_FREEZE_OUTPUT]: true,
    [ADAPTER_CAPABILITY_IDS.NO_PERSISTENCE]: true,
    [ADAPTER_CAPABILITY_IDS.NO_SCHEDULER]: true,
    [ADAPTER_CAPABILITY_IDS.NO_WORKERS]: true,
    [ADAPTER_CAPABILITY_IDS.NO_API]: true,
    [ADAPTER_CAPABILITY_IDS.NO_PUBLISHING]: true
  };
}

function buildFullIntegrationContext() {
  return {
    advisoryOnly: true,
    draftProposal: { present: true, ready: true },
    approvalGate: { ready: true, satisfied: true },
    reviewPackage: { available: true, ready: true },
    storageBoundary: { ready: true, available: true },
    repositoryContract: { ready: true, available: true },
    workflowOrchestrator: { available: true, ready: true },
    decisionTrace: { available: true, ready: true },
    capabilityRegistry: { available: true, ready: true },
    readinessAssessment: { ready: true, available: true },
    advisoryReport: { available: true, ready: true },
    advisorySnapshot: { available: true, ready: true },
    snapshotComparison: { available: true, ready: true },
    health: { ready: true, available: true },
    risk: { ready: true, available: true },
    intelligenceSummary: { available: true, ready: true },
    recommendation: { ready: true, available: true },
    timeline: { ready: true, available: true },
    consistencyValidation: { ready: true, available: true },
    integrationReadiness: { ready: true, available: true },
    activationPlanning: { ready: true, available: true },
    safetyChecklist: { ready: true, available: true },
    governancePolicy: { ready: true, available: true },
    complianceValidation: { ready: true, available: true },
    simulation: { ready: true, available: true },
    dryRun: { ready: true, available: true }
  };
}

function buildPartialIntegrationContext() {
  return {
    advisoryOnly: true,
    draftProposal: { present: true, ready: true },
    approvalGate: { ready: true },
    reviewPackage: { available: true },
    health: { ready: true },
    risk: { ready: true }
  };
}

function buildBlockedIntegrationContext() {
  return {
    advisoryOnly: true,
    draftProposal: { blocked: true, status: "BLOCKED" },
    approvalGate: { blocked: true, status: "BLOCKED" },
    reviewPackage: { ready: true }
  };
}

function buildFullIntegrationContractSuiteInput(overrides = {}) {
  const integrationContext = buildFullIntegrationContext();
  const adapterCapabilities = buildFullAdapterCapabilities();

  const integrationContract = createRecruitmentWorkflowRuntimeIntegrationContract({
    recruitmentId: 138001,
    contractVersion: VERSION_IDS.V1_0_0,
    integrationContext
  });

  const adapterInterface = assessAdapterCapabilityConformance(adapterCapabilities);

  const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
    sourceVersion: VERSION_IDS.V0_9_0,
    targetVersion: VERSION_IDS.V1_0_0,
    sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
    targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    integrationContract,
    adapterCapabilities
  });

  const versionLifecycle = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_0_0);

  const versionComparison = compareRecruitmentWorkflowContractVersions(
    VERSION_IDS.V0_9_0,
    VERSION_IDS.V1_0_0
  );

  const migrationPlan = createRecruitmentWorkflowRuntimeMigrationPlan({
    sourceVersion: VERSION_IDS.V0_9_0,
    targetVersion: VERSION_IDS.V1_0_0,
    compatibilityValidation,
    versionComparison,
    migrationRequested: true
  });

  return {
    recruitmentId: 138001,
    integrationContext,
    adapterCapabilities,
    integrationContract,
    adapterInterface,
    compatibilityValidation,
    versionLifecycle,
    versionComparison,
    migrationPlan,
    ...overrides
  };
}

function runFullIntegrationContractSuite(overrides = {}) {
  const input = buildFullIntegrationContractSuiteInput(overrides);

  const integrationContract =
    input.integrationContract ||
    createRecruitmentWorkflowRuntimeIntegrationContract({
      recruitmentId: input.recruitmentId,
      contractVersion: VERSION_IDS.V1_0_0,
      integrationContext: input.integrationContext
    });

  const adapterInterface =
    input.adapterInterface ||
    assessAdapterCapabilityConformance(input.adapterCapabilities);

  const compatibilityValidation =
    input.compatibilityValidation ||
    validateRecruitmentWorkflowContractCompatibility({
      sourceVersion: VERSION_IDS.V0_9_0,
      targetVersion: VERSION_IDS.V1_0_0,
      sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
      targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      integrationContract,
      adapterCapabilities: input.adapterCapabilities
    });

  const versionLifecycle =
    input.versionLifecycle ||
    resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_0_0);

  const migrationPlan =
    input.migrationPlan ||
    createRecruitmentWorkflowRuntimeMigrationPlan({
      sourceVersion: VERSION_IDS.V0_9_0,
      targetVersion: VERSION_IDS.V1_0_0,
      compatibilityValidation,
      versionComparison: input.versionComparison,
      migrationRequested: true
    });

  const integrationSummary = createRecruitmentWorkflowIntegrationContractSummary({
    recruitmentId: input.recruitmentId,
    integrationContract,
    adapterInterface,
    compatibilityValidation,
    versionLifecycle,
    migrationPlan
  });

  return {
    integrationContract,
    adapterInterface,
    adapterSpec: getRecruitmentWorkflowRuntimeAdapterInterface(),
    compatibilityValidation,
    versionLifecycle,
    migrationPlan,
    integrationSummary
  };
}

describe("Phase 138 — recruitmentWorkflowRuntimeIntegrationContractSuite", () => {
  describe("exports and metadata", () => {
    test("integration contract phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_ENTITY).toBe(
        "recruitment_workflow_runtime_integration_contract"
      );
      expect(CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA.executed).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA.integrationContractOnly).toBe(
        true
      );
    });

    test("adapter interface phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY).toBe(
        "recruitment_workflow_runtime_adapter_interface"
      );
      expect(ADAPTER_INTERFACE_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA.interfaceDefinitionOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA.implementationProvided).toBe(
        false
      );
    });

    test("compatibility validator phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_ENTITY).toBe(
        "recruitment_workflow_contract_compatibility_validator"
      );
      expect(COMPATIBILITY_STATUS.COMPATIBLE).toBe("COMPATIBLE");
      expect(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE).toBe("PARTIALLY_COMPATIBLE");
      expect(COMPATIBILITY_STATUS.INCOMPATIBLE).toBe("INCOMPATIBLE");
      expect(COMPATIBILITY_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(
        RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_METADATA.compatibilityValidatorOnly
      ).toBe(true);
    });

    test("version registry phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_ENTITY).toBe(
        "recruitment_workflow_contract_version_registry"
      );
      expect(VERSION_LIFECYCLE.ACTIVE).toBe("ACTIVE");
      expect(VERSION_LIFECYCLE.DEPRECATED).toBe("DEPRECATED");
      expect(VERSION_LIFECYCLE.RETIRED).toBe("RETIRED");
      expect(RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_METADATA.versionRegistryOnly).toBe(true);
    });

    test("migration planner phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_ENTITY).toBe(
        "recruitment_workflow_runtime_migration_planner"
      );
      expect(RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA.migrationPlannerOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA.executesMigration).toBe(false);
    });

    test("integration contract summary phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE).toBe(138);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_ENTITY).toBe(
        "recruitment_workflow_integration_contract_summary"
      );
      expect(SUMMARY_POSTURE.INTEGRATION_CONTRACT_READY).toBe("INTEGRATION_CONTRACT_READY");
      expect(
        RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_METADATA.integrationContractSummaryOnly
      ).toBe(true);
    });

    test("all phase 138 modules list source phases through 137", () => {
      const metadatas = [
        RECRUITMENT_WORKFLOW_RUNTIME_INTEGRATION_CONTRACT_METADATA,
        RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_METADATA,
        RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_METADATA,
        RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_METADATA,
        RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA,
        RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_METADATA
      ];

      for (let i = 0; i < metadatas.length; i += 1) {
        expect(metadatas[i].sourcePhases).toContain(137);
        expect(metadatas[i].sourcePhases).toContain(114);
      }
    });
  });

  describe("integration contract — surfaces and posture", () => {
    test("defines 14 integration surfaces across phases 114-137", () => {
      expect(INTEGRATION_SURFACE_DEFINITIONS).toHaveLength(14);
      expect(ALL_SURFACE_IDS).toContain(INTEGRATION_SURFACE_IDS.DRAFT_PIPELINE);
      expect(ALL_SURFACE_IDS).toContain(INTEGRATION_SURFACE_IDS.SIMULATION);
    });

    test("defines six capability requirements", () => {
      expect(CAPABILITY_REQUIREMENT_DEFINITIONS).toHaveLength(6);
      expect(CAPABILITY_REQUIREMENT_IDS.ADVISORY_ONLY).toBe("ADVISORY_ONLY");
      expect(CAPABILITY_REQUIREMENT_IDS.NO_PERSISTENCE).toBe("NO_PERSISTENCE");
    });

    test("returns unknown posture for null input", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract(null);

      expect(result.contractPosture).toBe(CONTRACT_POSTURE.UNKNOWN);
      expect(result.recognized).toBe(false);
      expect(result.integrationSurfaces).toHaveLength(14);
      expect(result.missingSurfaceCount).toBe(14);
    });

    test("returns ready for integration review when all surfaces satisfied", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        recruitmentId: 138001,
        integrationContext: buildFullIntegrationContext()
      });

      expect(result.contractPosture).toBe(CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW);
      expect(result.satisfiedSurfaceCount).toBe(14);
      expect(result.partialSurfaceCount).toBe(0);
      expect(result.blockedSurfaceCount).toBe(0);
      expect(result.recognized).toBe(true);
    });

    test("returns review required for partial integration context", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        recruitmentId: 138002,
        integrationContext: buildPartialIntegrationContext()
      });

      expect(result.contractPosture).toBe(CONTRACT_POSTURE.REVIEW_REQUIRED);
      expect(result.partialSurfaceCount + result.satisfiedSurfaceCount).toBeGreaterThan(0);
      expect(result.missingSurfaceCount).toBeGreaterThan(0);
    });

    test("returns blocked integration when surfaces are blocked", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        recruitmentId: 138003,
        integrationContext: buildBlockedIntegrationContext()
      });

      expect(result.contractPosture).toBe(CONTRACT_POSTURE.BLOCKED_INTEGRATION);
      expect(result.blockedSurfaceCount).toBeGreaterThan(0);
    });

    test("generates contract id from recruitment id and version", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        recruitmentId: 138001,
        contractVersion: VERSION_IDS.V1_0_0,
        integrationContext: buildFullIntegrationContext()
      });

      expect(result.contractId).toBe("rwric-138001-1.0.0");
    });

    test("all integration surfaces include module phases", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      for (let i = 0; i < result.integrationSurfaces.length; i += 1) {
        expect(result.integrationSurfaces[i].modulePhases.length).toBeGreaterThan(0);
        expect(result.integrationSurfaces[i].requiredSignals.length).toBeGreaterThan(0);
      }
    });

    test("draft pipeline surface satisfied with full context", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const surface = result.integrationSurfaces.find(
        (item) => item.id === INTEGRATION_SURFACE_IDS.DRAFT_PIPELINE
      );

      expect(surface.status).toBe(INTEGRATION_SURFACE_STATUS.SATISFIED);
      expect(surface.modulePhases).toContain(114);
    });

    test("simulation surface satisfied with full context", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const surface = result.integrationSurfaces.find(
        (item) => item.id === INTEGRATION_SURFACE_IDS.SIMULATION
      );

      expect(surface.status).toBe(INTEGRATION_SURFACE_STATUS.SATISFIED);
      expect(surface.modulePhases).toContain(137);
    });

    test("capability requirements enforced for advisory context", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const advisoryReq = result.capabilityRequirements.find(
        (item) => item.id === CAPABILITY_REQUIREMENT_IDS.ADVISORY_ONLY
      );

      expect(advisoryReq.enforced).toBe(true);
    });

    test("isRecruitmentWorkflowRuntimeIntegrationContract validates contract shape", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      expect(isRecruitmentWorkflowRuntimeIntegrationContract(contract)).toBe(true);
      expect(isRecruitmentWorkflowRuntimeIntegrationContract({})).toBe(false);
      expect(isRecruitmentWorkflowRuntimeIntegrationContract(null)).toBe(false);
    });

    test("contract summary text reflects ready posture", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      expect(result.contractSummary).toContain("ready for advisory review");
    });
  });

  describe("adapter interface — definition only", () => {
    test("defines eight adapter methods", () => {
      expect(ADAPTER_METHOD_DEFINITIONS).toHaveLength(8);
      expect(ADAPTER_METHOD_IDS.INITIALIZE).toBe("INITIALIZE");
      expect(ADAPTER_METHOD_IDS.SHUTDOWN).toBe("SHUTDOWN");
    });

    test("defines nine adapter capabilities", () => {
      expect(ADAPTER_CAPABILITY_DEFINITIONS).toHaveLength(9);
      expect(ADAPTER_CAPABILITY_IDS.NO_SCHEDULER).toBe("NO_SCHEDULER");
      expect(ADAPTER_CAPABILITY_IDS.NO_WORKERS).toBe("NO_WORKERS");
    });

    test("getRecruitmentWorkflowRuntimeAdapterInterface returns frozen spec", () => {
      const adapterSpec = getRecruitmentWorkflowRuntimeAdapterInterface();

      assertAllFrozen(adapterSpec);
      expect(adapterSpec.implementationProvided).toBe(false);
      expect(adapterSpec.requiredMethodCount).toBe(7);
      expect(adapterSpec.requiredCapabilityCount).toBe(9);
      expect(adapterSpec.methods).toHaveLength(8);
      expect(adapterSpec.capabilities).toHaveLength(9);
    });

    test("all adapter methods declare advisory only and no production mutation", () => {
      const adapterSpec = getRecruitmentWorkflowRuntimeAdapterInterface();

      for (let i = 0; i < adapterSpec.methods.length; i += 1) {
        expect(adapterSpec.methods[i].returnsAdvisoryOnly).toBe(true);
        expect(adapterSpec.methods[i].mutatesProduction).toBe(false);
      }
    });

    test("isRecruitmentWorkflowRuntimeAdapterInterface validates interface spec", () => {
      const adapterSpec = getRecruitmentWorkflowRuntimeAdapterInterface();

      expect(isRecruitmentWorkflowRuntimeAdapterInterface(adapterSpec)).toBe(true);
      expect(isRecruitmentWorkflowRuntimeAdapterInterface({})).toBe(false);
    });

    test("assessAdapterCapabilityConformance reports conformant for full capabilities", () => {
      const result = assessAdapterCapabilityConformance(buildFullAdapterCapabilities());

      expect(result.conformancePosture).toBe("CONFORMANT");
      expect(result.satisfiedCount).toBe(9);
      expect(result.missingCount).toBe(0);
      expect(result.assessments).toHaveLength(9);
    });

    test("assessAdapterCapabilityConformance reports non-conformant for empty capabilities", () => {
      const result = assessAdapterCapabilityConformance({});

      expect(result.conformancePosture).toBe("NON_CONFORMANT");
      expect(result.missingCount).toBe(9);
    });

    test("assessAdapterCapabilityConformance reports partially conformant for partial capabilities", () => {
      const result = assessAdapterCapabilityConformance({
        [ADAPTER_CAPABILITY_IDS.ADVISORY_ONLY]: true,
        [ADAPTER_CAPABILITY_IDS.NO_PERSISTENCE]: true
      });

      expect(result.conformancePosture).toBe("PARTIALLY_CONFORMANT");
      expect(result.satisfiedCount).toBe(2);
      expect(result.missingCount).toBeGreaterThan(0);
    });

    test("adapter interface spec has no implementation functions", () => {
      const adapterSpec = getRecruitmentWorkflowRuntimeAdapterInterface();

      expect(typeof adapterSpec.initialize).toBe("undefined");
      expect(typeof adapterSpec.connect).toBe("undefined");
      expect(typeof adapterSpec.observeWorkflow).toBe("undefined");
    });
  });

  describe("compatibility validator — classification", () => {
    test("defines six compatibility rules", () => {
      expect(COMPATIBILITY_RULE_DEFINITIONS).toHaveLength(6);
      expect(COMPATIBILITY_RULE_IDS.VERSION_ALIGNMENT).toBe("VERSION_ALIGNMENT");
      expect(COMPATIBILITY_RULE_IDS.ADVISORY_BOUNDARY_PRESERVED).toBe(
        "ADVISORY_BOUNDARY_PRESERVED"
      );
    });

    test("returns unknown for null input", () => {
      const result = validateRecruitmentWorkflowContractCompatibility(null);

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.UNKNOWN);
      expect(result.recognized).toBe(false);
      expect(result.compatibilityRules).toHaveLength(6);
      expect(result.unknownCount).toBe(6);
    });

    test("reports compatible for fully aligned inputs", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.ACTIVE,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: contract,
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
      expect(result.satisfiedCount).toBeGreaterThanOrEqual(5);
      expect(result.violatedCount).toBe(0);
    });

    test("reports partially compatible for same-major version difference", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildPartialIntegrationContext()
      });

      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_1_0,
        sourceLifecycle: VERSION_LIFECYCLE.ACTIVE,
        targetLifecycle: VERSION_LIFECYCLE.DRAFT,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: contract,
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
      expect(result.partialCount).toBeGreaterThan(0);
    });

    test("reports incompatible for retired lifecycle", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.RETIRED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
      expect(result.violatedCount).toBeGreaterThan(0);
    });

    test("reports incompatible for major version mismatch", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: "0.9.0",
        targetVersion: "2.0.0",
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: "2.0.0"
      });

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
    });

    test("version alignment rule satisfied for identical versions", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rule = result.compatibilityRules.find(
        (item) => item.id === COMPATIBILITY_RULE_IDS.VERSION_ALIGNMENT
      );

      expect(rule.status).toBe(COMPATIBILITY_RULE_STATUS.SATISFIED);
    });

    test("surface coverage rule partial for partial contract", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildPartialIntegrationContext()
      });

      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        integrationContract: contract,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rule = result.compatibilityRules.find(
        (item) => item.id === COMPATIBILITY_RULE_IDS.SURFACE_COVERAGE
      );

      expect(rule.status).toBe(COMPATIBILITY_RULE_STATUS.PARTIAL);
    });

    test("adapter capability match violated for empty capabilities", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        adapterCapabilities: {},
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rule = result.compatibilityRules.find(
        (item) => item.id === COMPATIBILITY_RULE_IDS.ADAPTER_CAPABILITY_MATCH
      );

      expect(rule.status).toBe(COMPATIBILITY_RULE_STATUS.VIOLATED);
    });

    test("compatibility summary text reflects status", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.ACTIVE,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: createRecruitmentWorkflowRuntimeIntegrationContract({
          integrationContext: buildFullIntegrationContext()
        }),
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      expect(result.compatibilitySummary).toContain("fully compatible");
    });
  });

  describe("version registry — lifecycle metadata", () => {
    test("defines four contract versions", () => {
      expect(CONTRACT_VERSION_DEFINITIONS).toHaveLength(4);
      expect(listRecruitmentWorkflowContractVersions()).toHaveLength(4);
    });

    test("returns null for unrecognized version", () => {
      expect(getRecruitmentWorkflowContractVersion("9.9.9")).toBeNull();
      expect(getRecruitmentWorkflowContractVersion(null)).toBeNull();
    });

    test("active version 1.0.0 supports phases through 137", () => {
      const version = getRecruitmentWorkflowContractVersion(VERSION_IDS.V1_0_0);

      expect(version.lifecycle).toBe(VERSION_LIFECYCLE.ACTIVE);
      expect(version.supportedPhases).toContain(137);
      expect(version.supportedPhases).toContain(114);
      expect(version.advisoryOnly).toBe(true);
    });

    test("retired version 0.8.0 does not permit integration", () => {
      const lifecycle = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V0_8_0);

      expect(lifecycle.lifecycle).toBe(VERSION_LIFECYCLE.RETIRED);
      expect(lifecycle.integrationPermitted).toBe(false);
      expect(lifecycle.lifecycleSummary).toContain("retired");
    });

    test("deprecated version 0.9.0 requires migration", () => {
      const lifecycle = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V0_9_0);

      expect(lifecycle.lifecycle).toBe(VERSION_LIFECYCLE.DEPRECATED);
      expect(lifecycle.migrationRequired).toBe(true);
      expect(lifecycle.lifecycleSummary).toContain("deprecated");
    });

    test("draft version 1.1.0 permits integration review", () => {
      const lifecycle = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_1_0);

      expect(lifecycle.lifecycle).toBe(VERSION_LIFECYCLE.DRAFT);
      expect(lifecycle.integrationPermitted).toBe(true);
      expect(lifecycle.supportedPhases).toContain(138);
    });

    test("compare versions permits upgrade from deprecated to active", () => {
      const comparison = compareRecruitmentWorkflowContractVersions(
        VERSION_IDS.V0_9_0,
        VERSION_IDS.V1_0_0
      );

      expect(comparison.recognized).toBe(true);
      expect(comparison.upgradePermitted).toBe(true);
      expect(comparison.migrationRequired).toBe(true);
    });

    test("compare versions blocks upgrade from retired version", () => {
      const comparison = compareRecruitmentWorkflowContractVersions(
        VERSION_IDS.V0_8_0,
        VERSION_IDS.V1_0_0
      );

      expect(comparison.upgradePermitted).toBe(false);
    });

    test("isRecruitmentWorkflowContractVersionEntry validates version entry", () => {
      const version = getRecruitmentWorkflowContractVersion(VERSION_IDS.V1_0_0);

      expect(isRecruitmentWorkflowContractVersionEntry(version)).toBe(true);
      expect(isRecruitmentWorkflowContractVersionEntry({})).toBe(false);
    });

    test("list versions returns frozen summary without supported phases array", () => {
      const versions = listRecruitmentWorkflowContractVersions();

      assertAllFrozen(versions);
      expect(versions[0]).not.toHaveProperty("supportedPhases");
      expect(versions[0].supportedPhaseCount).toBeGreaterThan(0);
    });
  });

  describe("migration planner — advisory stages", () => {
    test("defines seven advisory migration stages", () => {
      expect(MIGRATION_STAGE_DEFINITIONS).toHaveLength(7);
      expect(MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION).toBe("VALIDATE_SOURCE_VERSION");
      expect(MIGRATION_STAGE_IDS.DOCUMENT_MIGRATION_COMPLETION).toBe(
        "DOCUMENT_MIGRATION_COMPLETION"
      );
    });

    test("returns unknown posture without signals", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan(null);

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.UNKNOWN);
      expect(result.migrationStages).toHaveLength(7);
      expect(
        result.migrationStages.every((stage) => stage.status === MIGRATION_STAGE_STATUS.UNKNOWN)
      ).toBe(true);
    });

    test("reports no migration needed for identical versions", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0
      });

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.NO_MIGRATION_NEEDED);
      expect(result.recommendedCount).toBe(0);
      expect(result.migrationSummary).toContain("no migration needed");
    });

    test("reports migration ready for compatible upgrade", () => {
      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: createRecruitmentWorkflowRuntimeIntegrationContract({
          integrationContext: buildFullIntegrationContext()
        }),
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        compatibilityValidation,
        versionComparison: compareRecruitmentWorkflowContractVersions(
          VERSION_IDS.V0_9_0,
          VERSION_IDS.V1_0_0
        ),
        migrationRequested: true
      });

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.MIGRATION_READY);
      expect(result.recommendedCount).toBe(7);
    });

    test("reports migration blocked for incompatible signals", () => {
      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.RETIRED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: VERSION_IDS.V1_0_0,
        compatibilityValidation,
        versionComparison: compareRecruitmentWorkflowContractVersions(
          VERSION_IDS.V0_8_0,
          VERSION_IDS.V1_0_0
        ),
        migrationRequested: true
      });

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.MIGRATION_BLOCKED);
      expect(result.blockedCount).toBeGreaterThan(0);
    });

    test("migration stages maintain prerequisite ordering", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      });

      const assessStage = result.migrationStages.find(
        (stage) => stage.id === MIGRATION_STAGE_IDS.ASSESS_COMPATIBILITY
      );

      expect(assessStage.prerequisiteStageIds).toContain(
        MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION
      );
    });

    test("document migration completion is final stage", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      });

      const finalStage = result.migrationStages.find(
        (stage) => stage.id === MIGRATION_STAGE_IDS.DOCUMENT_MIGRATION_COMPLETION
      );

      expect(finalStage.order).toBe(7);
      expect(finalStage.prerequisiteStageIds).toContain(MIGRATION_STAGE_IDS.STAGING_VERIFICATION);
    });

    test("does not execute migration — advisory metadata confirms", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      });

      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.executesMigration).toBe(false);
    });
  });

  describe("integration contract summary — aggregation", () => {
    test("returns unknown posture without signals", () => {
      const result = createRecruitmentWorkflowIntegrationContractSummary(null);

      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.UNKNOWN);
      expect(result.aggregatedComponents).toHaveLength(5);
      expect(result.keyIntegrationSignals).toHaveLength(0);
    });

    test("aggregates all five component outputs", () => {
      const outputs = runFullIntegrationContractSuite();

      const components = outputs.integrationSummary.aggregatedComponents.map(
        (item) => item.component
      );

      expect(components).toContain(AGGREGATED_COMPONENT.INTEGRATION_CONTRACT);
      expect(components).toContain(AGGREGATED_COMPONENT.ADAPTER_INTERFACE);
      expect(components).toContain(AGGREGATED_COMPONENT.COMPATIBILITY_VALIDATION);
      expect(components).toContain(AGGREGATED_COMPONENT.VERSION_REGISTRY);
      expect(components).toContain(AGGREGATED_COMPONENT.MIGRATION_PLAN);
    });

    test("reports integration contract ready for full suite outputs", () => {
      const outputs = runFullIntegrationContractSuite();

      expect(outputs.integrationSummary.summaryPosture).toBe(
        SUMMARY_POSTURE.MIGRATION_REVIEW_REQUIRED
      );
      expect(outputs.integrationSummary.recruitmentId).toBe("138001");
      expect(outputs.integrationSummary.keyIntegrationSignals.length).toBeGreaterThan(0);
    });

    test("reports integration blocked for blocked contract signals", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildBlockedIntegrationContext()
      });

      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.RETIRED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: contract
      });

      const result = createRecruitmentWorkflowIntegrationContractSummary({
        integrationContract: contract,
        compatibilityValidation,
        migrationPlan: createRecruitmentWorkflowRuntimeMigrationPlan({
          sourceVersion: VERSION_IDS.V0_8_0,
          targetVersion: VERSION_IDS.V1_0_0,
          compatibilityValidation,
          versionComparison: compareRecruitmentWorkflowContractVersions(
            VERSION_IDS.V0_8_0,
            VERSION_IDS.V1_0_0
          )
        })
      });

      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.INTEGRATION_BLOCKED);
      expect(result.integrationSummary).toContain("blocked");
    });

    test("integration overview includes all posture fields", () => {
      const outputs = runFullIntegrationContractSuite();

      expect(outputs.integrationSummary.integrationOverview).toHaveProperty("contractPosture");
      expect(outputs.integrationSummary.integrationOverview).toHaveProperty("compatibilityStatus");
      expect(outputs.integrationSummary.integrationOverview).toHaveProperty("migrationPosture");
      expect(outputs.integrationSummary.integrationOverview).toHaveProperty("versionLifecycle");
    });

    test("recommended integration focus provided for partial signals", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildPartialIntegrationContext()
      });

      const result = createRecruitmentWorkflowIntegrationContractSummary({
        integrationContract: contract,
        adapterInterface: assessAdapterCapabilityConformance({
          [ADAPTER_CAPABILITY_IDS.ADVISORY_ONLY]: true
        })
      });

      expect(result.recommendedIntegrationFocus.length).toBeGreaterThan(0);
    });

    test("advisory metadata confirms summary is not executed", () => {
      const outputs = runFullIntegrationContractSuite();

      expect(outputs.integrationSummary.advisoryMetadata.executed).toBe(false);
      expect(outputs.integrationSummary.advisoryMetadata.integrationContractSummaryOnly).toBe(true);
    });
  });

  describe("contract suite integration — advisory composition", () => {
    test("all six libraries produce coherent advisory output from shared input", () => {
      const outputs = runFullIntegrationContractSuite();

      expect(outputs.integrationContract.advisoryMetadata.phase).toBe(138);
      expect(outputs.adapterSpec.advisoryMetadata.phase).toBe(138);
      expect(outputs.compatibilityValidation.advisoryMetadata.phase).toBe(138);
      expect(outputs.versionLifecycle.advisoryMetadata.phase).toBe(138);
      expect(outputs.migrationPlan.advisoryMetadata.phase).toBe(138);
      expect(outputs.integrationSummary.advisoryMetadata.phase).toBe(138);

      expect(outputs.integrationContract.contractPosture).toBe(
        CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW
      );
      expect(outputs.adapterInterface.conformancePosture).toBe("CONFORMANT");
      expect(outputs.compatibilityValidation.compatibilityStatus).toBe(
        COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE
      );
    });

    test("blocked suite outputs produce blocked summary consistently", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildBlockedIntegrationContext()
      });

      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: "2.0.0",
        sourceLifecycle: VERSION_LIFECYCLE.RETIRED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: "2.0.0",
        integrationContract: contract
      });

      const migrationPlan = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_8_0,
        targetVersion: "2.0.0",
        compatibilityValidation,
        versionComparison: { upgradePermitted: false }
      });

      const summary = createRecruitmentWorkflowIntegrationContractSummary({
        integrationContract: contract,
        compatibilityValidation,
        migrationPlan
      });

      expect(contract.contractPosture).toBe(CONTRACT_POSTURE.BLOCKED_INTEGRATION);
      expect(compatibilityValidation.compatibilityStatus).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
      expect(migrationPlan.migrationPosture).toBe(MIGRATION_POSTURE.MIGRATION_BLOCKED);
      expect(summary.summaryPosture).toBe(SUMMARY_POSTURE.INTEGRATION_BLOCKED);
    });
  });

  describe("isolation", () => {
    test("phase 138 modules do not import each other or other recruitment modules", () => {
      for (let i = 0; i < PHASE_138_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_138_MODULE_PATHS[i]);

        expect(source).toContain("Phase 138");
        expect(source).not.toMatch(/require\(["']\./);
        expect(source).not.toMatch(/require\(["']fs["']\)/);
        expect(source).not.toMatch(/require\(["']express/);
        expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
        expect(source).not.toMatch(/mysql2/);
      }
    });

    test("phase 138 modules are not referenced by prior phase production modules", () => {
      const productionSources = [
        read(SIMULATION_MODULE_PATH),
        read(GOVERNANCE_MODULE_PATH),
        read(ORCHESTRATOR_MODULE_PATH),
        read(COORDINATOR_MODULE_PATH),
        read(GATEWAY_MODULE_PATH),
        read(PIPELINE_MODULE_PATH),
        read(WORKER_MODULE_PATH)
      ];

      for (let i = 0; i < productionSources.length; i += 1) {
        for (let j = 0; j < PHASE_138_EXPORT_PATTERNS.length; j += 1) {
          expect(productionSources[i]).not.toMatch(PHASE_138_EXPORT_PATTERNS[j]);
        }
      }
    });
  });

  describe("deterministic output", () => {
    test("returns identical integration contract for identical input", () => {
      const input = { integrationContext: buildFullIntegrationContext(), recruitmentId: 1 };
      const first = createRecruitmentWorkflowRuntimeIntegrationContract(input);
      const second = createRecruitmentWorkflowRuntimeIntegrationContract(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical adapter interface spec on repeated calls", () => {
      const first = getRecruitmentWorkflowRuntimeAdapterInterface();
      const second = getRecruitmentWorkflowRuntimeAdapterInterface();

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical compatibility validation for identical input", () => {
      const input = {
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      };
      const first = validateRecruitmentWorkflowContractCompatibility(input);
      const second = validateRecruitmentWorkflowContractCompatibility(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical version lifecycle for identical version", () => {
      const first = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_0_0);
      const second = resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_0_0);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical migration plan for identical input", () => {
      const input = {
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      };
      const first = createRecruitmentWorkflowRuntimeMigrationPlan(input);
      const second = createRecruitmentWorkflowRuntimeMigrationPlan(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical integration summary for identical input", () => {
      const outputs = runFullIntegrationContractSuite();
      const input = {
        recruitmentId: 138001,
        integrationContract: outputs.integrationContract,
        adapterInterface: outputs.adapterInterface,
        compatibilityValidation: outputs.compatibilityValidation,
        versionLifecycle: outputs.versionLifecycle,
        migrationPlan: outputs.migrationPlan
      };
      const first = createRecruitmentWorkflowIntegrationContractSummary(input);
      const second = createRecruitmentWorkflowIntegrationContractSummary(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes integration contract output", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });
      assertAllFrozen(result);
      expect(() => {
        result.integrationSurfaces.push({});
      }).toThrow();
    });

    test("deep freezes adapter interface spec", () => {
      const result = getRecruitmentWorkflowRuntimeAdapterInterface();
      assertAllFrozen(result);
      expect(() => {
        result.methods.push({});
      }).toThrow();
    });

    test("deep freezes compatibility validator output", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      assertAllFrozen(result);
      expect(() => {
        result.compatibilityRules[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes version registry output", () => {
      const result = getRecruitmentWorkflowContractVersion(VERSION_IDS.V1_0_0);
      assertAllFrozen(result);
      expect(() => {
        result.supportedPhases.push(999);
      }).toThrow();
    });

    test("deep freezes migration planner output", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      });
      assertAllFrozen(result);
      expect(() => {
        result.migrationStages[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes integration contract summary output", () => {
      const outputs = runFullIntegrationContractSuite();
      assertAllFrozen(outputs.integrationSummary);
      expect(() => {
        outputs.integrationSummary.keyIntegrationSignals.push("CHANGED");
      }).toThrow();
    });

    test("does not mutate integration context input", () => {
      const context = buildFullIntegrationContext();
      const before = JSON.stringify(context);
      createRecruitmentWorkflowRuntimeIntegrationContract({ integrationContext: context });
      expect(JSON.stringify(context)).toBe(before);
    });

    test("does not mutate adapter capabilities input during conformance assessment", () => {
      const capabilities = buildFullAdapterCapabilities();
      const before = JSON.stringify(capabilities);
      assessAdapterCapabilityConformance(capabilities);
      expect(JSON.stringify(capabilities)).toBe(before);
    });

    test("contract suite does not mutate process environment", () => {
      const envBefore = { ...process.env };
      runFullIntegrationContractSuite();
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("phase 138 module sources declare no persistence or integration storage", () => {
      for (let i = 0; i < PHASE_138_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_138_MODULE_PATHS[i]);

        expect(source).toContain("no persistence");
        expect(source).toContain("integrationPersistence: false");
        expect(source).toContain("historyTracking: false");
        expect(source).not.toMatch(/INSERT INTO/i);
        expect(source).not.toMatch(/UPDATE\s+/i);
        expect(source).not.toMatch(/saveIntegration/i);
        expect(source).not.toMatch(/persistIntegration/i);
      }
    });
  });

  describe("no runtime wiring", () => {
    test("phase 138 modules declare pure advisory contract constraints", () => {
      for (let i = 0; i < PHASE_138_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_138_MODULE_PATHS[i]);

        expect(source).toContain("Advisory Only");
        expect(source).toContain("Never mutates input");
        expect(source).toContain("No automation");
        expect(source).toContain("advisoryOnly: true");
        expect(source).toContain("executed: false");
      }
    });

    test("orchestrator behavior remains unchanged and independent from phase 138 contract suite", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("contractPosture");
      expect(orchestration).not.toHaveProperty("integrationSurfaces");
      expect(orchestration).not.toHaveProperty("compatibilityStatus");
      expect(orchestration).not.toHaveProperty("migrationStages");
      expect(orchestration).not.toHaveProperty("summaryPosture");
    });

    test("contract suite outputs never declare executed true", () => {
      const outputs = runFullIntegrationContractSuite();

      expect(outputs.integrationContract.advisoryMetadata.executed).toBe(false);
      expect(outputs.compatibilityValidation.advisoryMetadata.executed).toBe(false);
      expect(outputs.migrationPlan.advisoryMetadata.executed).toBe(false);
      expect(outputs.integrationSummary.advisoryMetadata.executed).toBe(false);
    });
  });

  describe("no production imports", () => {
    test("phase 138 libraries have no runtime require statements", () => {
      for (let i = 0; i < PHASE_138_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_138_MODULE_PATHS[i]);
        expect(source).not.toMatch(/require\(/);
      }
    });
  });

  describe("integration contract — extended surface coverage", () => {
    test("governance surface requires governance policy and compliance signals", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: {
          governancePolicy: { ready: true },
          complianceValidation: { available: true }
        }
      });

      const surface = result.integrationSurfaces.find(
        (item) => item.id === INTEGRATION_SURFACE_IDS.GOVERNANCE
      );

      expect(surface.status).toBe(INTEGRATION_SURFACE_STATUS.SATISFIED);
    });

    test("storage boundary surface partial with only storage boundary signal", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: { storageBoundary: { ready: true } }
      });

      const surface = result.integrationSurfaces.find(
        (item) => item.id === INTEGRATION_SURFACE_IDS.STORAGE_BOUNDARY
      );

      expect(surface.status).toBe(INTEGRATION_SURFACE_STATUS.PARTIAL);
    });

    test("orchestration surface missing without workflow orchestrator signal", () => {
      const result = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildPartialIntegrationContext()
      });

      const surface = result.integrationSurfaces.find(
        (item) => item.id === INTEGRATION_SURFACE_IDS.ORCHESTRATION
      );

      expect(surface.status).toBe(INTEGRATION_SURFACE_STATUS.MISSING);
    });

    test("each integration surface definition maps to a unique id", () => {
      const ids = INTEGRATION_SURFACE_DEFINITIONS.map((item) => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test("integration surfaces span phases 114 through 137", () => {
      const allPhases = new Set();
      for (let i = 0; i < INTEGRATION_SURFACE_DEFINITIONS.length; i += 1) {
        const phases = INTEGRATION_SURFACE_DEFINITIONS[i].modulePhases;
        for (let j = 0; j < phases.length; j += 1) {
          allPhases.add(phases[j]);
        }
      }
      expect(allPhases.has(114)).toBe(true);
      expect(allPhases.has(137)).toBe(true);
    });
  });

  describe("adapter interface — extended conformance", () => {
    test("health check method is optional", () => {
      const optionalMethod = ADAPTER_METHOD_DEFINITIONS.find(
        (item) => item.id === ADAPTER_METHOD_IDS.HEALTH_CHECK
      );
      expect(optionalMethod.required).toBe(false);
    });

    test("all required capabilities must be declared for conformant posture", () => {
      const result = assessAdapterCapabilityConformance(buildFullAdapterCapabilities());
      const requiredAssessments = result.assessments.filter((item) => item.required);
      expect(requiredAssessments.every((item) => item.satisfied)).toBe(true);
    });

    test("adapter interface entity and phase match constants", () => {
      const spec = getRecruitmentWorkflowRuntimeAdapterInterface();
      expect(spec.entity).toBe(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_ENTITY);
      expect(spec.phase).toBe(RECRUITMENT_WORKFLOW_RUNTIME_ADAPTER_INTERFACE_PHASE);
    });
  });

  describe("compatibility validator — extended rules", () => {
    test("lifecycle compatibility partial for deprecated source", () => {
      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rule = result.compatibilityRules.find(
        (item) => item.id === COMPATIBILITY_RULE_IDS.LIFECYCLE_COMPATIBILITY
      );

      expect(rule.status).toBe(COMPATIBILITY_RULE_STATUS.PARTIAL);
    });

    test("advisory boundary preserved when contract is advisory", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        integrationContract: contract,
        adapterCapabilities: buildFullAdapterCapabilities(),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rule = result.compatibilityRules.find(
        (item) => item.id === COMPATIBILITY_RULE_IDS.ADVISORY_BOUNDARY_PRESERVED
      );

      expect(rule.status).toBe(COMPATIBILITY_RULE_STATUS.SATISFIED);
    });

    test("0.9.0 to 1.0.0 upgrade is partially compatible with full signals", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const result = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: contract,
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      expect(result.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
      expect(result.violatedCount).toBe(0);
    });
  });

  describe("version registry — extended lifecycle", () => {
    test("active version does not require migration", () => {
      const version = getRecruitmentWorkflowContractVersion(VERSION_IDS.V1_0_0);
      expect(version.migrationRequired).toBe(false);
    });

    test("unrecognized version lifecycle defaults to draft", () => {
      const lifecycle = resolveRecruitmentWorkflowContractVersionLifecycle("99.0.0");
      expect(lifecycle.recognized).toBe(false);
      expect(lifecycle.integrationPermitted).toBe(false);
    });

    test("version comparison unrecognized for invalid versions", () => {
      const comparison = compareRecruitmentWorkflowContractVersions("invalid", "also-invalid");
      expect(comparison.recognized).toBe(false);
      expect(comparison.upgradePermitted).toBe(false);
    });
  });

  describe("migration planner — extended stages", () => {
    test("partially compatible migration with request reports migration ready", () => {
      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: createRecruitmentWorkflowRuntimeIntegrationContract({
          integrationContext: buildFullIntegrationContext()
        }),
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        compatibilityValidation,
        versionComparison: compareRecruitmentWorkflowContractVersions(
          VERSION_IDS.V0_9_0,
          VERSION_IDS.V1_0_0
        ),
        migrationRequested: true
      });

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.MIGRATION_READY);
      expect(result.recommendedCount).toBe(7);
    });

    test("validate source version is first migration stage", () => {
      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        migrationRequested: true
      });

      expect(result.migrationStages[0].id).toBe(MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION);
      expect(result.migrationStages[0].order).toBe(1);
    });

    test("migration review required without explicit migration request", () => {
      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.DEPRECATED,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const result = createRecruitmentWorkflowRuntimeMigrationPlan({
        sourceVersion: VERSION_IDS.V0_9_0,
        targetVersion: VERSION_IDS.V1_0_0,
        compatibilityValidation,
        versionComparison: compareRecruitmentWorkflowContractVersions(
          VERSION_IDS.V0_9_0,
          VERSION_IDS.V1_0_0
        )
      });

      expect(result.migrationPosture).toBe(MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED);
    });
  });

  describe("integration contract summary — extended aggregation", () => {
    test("key integration signals include contract and compatibility postures", () => {
      const outputs = runFullIntegrationContractSuite();
      expect(outputs.integrationSummary.keyIntegrationSignals).toContain(
        `contract:${CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW}`
      );
      expect(outputs.integrationSummary.keyIntegrationSignals.some((signal) =>
        signal.startsWith("compatibility:")
      )).toBe(true);
    });

    test("aggregated components include metric counts from source outputs", () => {
      const outputs = runFullIntegrationContractSuite();
      const contractComponent = outputs.integrationSummary.aggregatedComponents.find(
        (item) => item.component === AGGREGATED_COMPONENT.INTEGRATION_CONTRACT
      );

      expect(contractComponent.metricCount).toBe(14);
      expect(contractComponent.posture).toBe(CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW);
    });

    test("integration contract ready when no migration and fully compatible", () => {
      const contract = createRecruitmentWorkflowRuntimeIntegrationContract({
        integrationContext: buildFullIntegrationContext()
      });

      const compatibilityValidation = validateRecruitmentWorkflowContractCompatibility({
        sourceVersion: VERSION_IDS.V1_0_0,
        targetVersion: VERSION_IDS.V1_0_0,
        sourceLifecycle: VERSION_LIFECYCLE.ACTIVE,
        targetLifecycle: VERSION_LIFECYCLE.ACTIVE,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        integrationContract: contract,
        adapterCapabilities: buildFullAdapterCapabilities()
      });

      const result = createRecruitmentWorkflowIntegrationContractSummary({
        integrationContract: contract,
        adapterInterface: assessAdapterCapabilityConformance(buildFullAdapterCapabilities()),
        compatibilityValidation,
        versionLifecycle: resolveRecruitmentWorkflowContractVersionLifecycle(VERSION_IDS.V1_0_0),
        migrationPlan: createRecruitmentWorkflowRuntimeMigrationPlan({
          sourceVersion: VERSION_IDS.V1_0_0,
          targetVersion: VERSION_IDS.V1_0_0,
          compatibilityValidation
        })
      });

      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.INTEGRATION_CONTRACT_READY);
      expect(result.integrationSummary).toContain("ready for advisory runtime integration review");
    });
  });
});
