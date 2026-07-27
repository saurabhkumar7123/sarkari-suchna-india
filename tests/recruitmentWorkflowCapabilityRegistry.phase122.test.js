"use strict";

/**
 * Phase 122 — Recruitment Workflow Capability Registry tests.
 * Registry creation, capability catalog, metadata, advisory flags,
 * determinism, immutability, architecture boundaries, and no side effects.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_ENTITY,
  CAPABILITY_IDS,
  CAPABILITY_STATUSES,
  CAPABILITY_MODES,
  CAPABILITY_CATEGORIES,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA,
  RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_DESCRIPTOR,
  CANONICAL_CAPABILITY_DEFINITIONS,
  createRecruitmentWorkflowCapabilityRegistry
} = require("../server/lib/recruitment/recruitmentWorkflowCapabilityRegistry");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_CAPABILITY_IDS = Object.freeze([
  CAPABILITY_IDS.DRAFT_PROPOSAL,
  CAPABILITY_IDS.PERSISTENCE_BOUNDARY,
  CAPABILITY_IDS.APPROVAL_GATE,
  CAPABILITY_IDS.REVIEW_PACKAGE,
  CAPABILITY_IDS.STORAGE_ADAPTER,
  CAPABILITY_IDS.REPOSITORY_CONTRACT,
  CAPABILITY_IDS.WORKFLOW_ORCHESTRATOR,
  CAPABILITY_IDS.DECISION_TRACE_MODEL
]);

const EXPECTED_CAPABILITY_CATALOG = Object.freeze([
  {
    id: CAPABILITY_IDS.DRAFT_PROPOSAL,
    name: "Draft Proposal Engine",
    phase: 114,
    category: CAPABILITY_CATEGORIES.GENERATION
  },
  {
    id: CAPABILITY_IDS.PERSISTENCE_BOUNDARY,
    name: "Persistence Boundary",
    phase: 115,
    category: CAPABILITY_CATEGORIES.BOUNDARY
  },
  {
    id: CAPABILITY_IDS.APPROVAL_GATE,
    name: "Approval Gate",
    phase: 116,
    category: CAPABILITY_CATEGORIES.GOVERNANCE
  },
  {
    id: CAPABILITY_IDS.REVIEW_PACKAGE,
    name: "Review Package",
    phase: 117,
    category: CAPABILITY_CATEGORIES.REVIEW
  },
  {
    id: CAPABILITY_IDS.STORAGE_ADAPTER,
    name: "Storage Adapter",
    phase: 118,
    category: CAPABILITY_CATEGORIES.STORAGE
  },
  {
    id: CAPABILITY_IDS.REPOSITORY_CONTRACT,
    name: "Repository Contract",
    phase: 119,
    category: CAPABILITY_CATEGORIES.CONTRACT
  },
  {
    id: CAPABILITY_IDS.WORKFLOW_ORCHESTRATOR,
    name: "Recruitment Workflow Orchestrator",
    phase: 120,
    category: CAPABILITY_CATEGORIES.COORDINATION
  },
  {
    id: CAPABILITY_IDS.DECISION_TRACE_MODEL,
    name: "Decision Trace Model",
    phase: 121,
    category: CAPABILITY_CATEGORIES.TRACE
  }
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

describe("Phase 122 — recruitmentWorkflowCapabilityRegistry", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_PHASE).toBe(122);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_ENTITY).toBe(
        "recruitment_workflow_capability_registry"
      );
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_DESCRIPTOR.phase).toBe(122);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.registryType).toBe("descriptive");
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.runtimeConnected).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.autoDiscovery).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.persistenceEnabled).toBe(false);
      expect(CAPABILITY_STATUSES.AVAILABLE).toBe("available");
      expect(CAPABILITY_MODES.ADVISORY_ONLY).toBe("advisory_only");
    });
  });

  describe("registry creation", () => {
    test("createRecruitmentWorkflowCapabilityRegistry returns capabilities and metadata", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();

      expect(registry).toEqual(
        expect.objectContaining({
          capabilities: expect.any(Array),
          metadata: expect.objectContaining({
            advisoryOnly: true,
            registryType: "descriptive",
            runtimeConnected: false
          })
        })
      );
      expect(registry.capabilities).toHaveLength(EXPECTED_CAPABILITY_IDS.length);
    });
  });

  describe("capability catalog", () => {
    test("all expected capabilities exist with stable ids", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      const ids = registry.capabilities.map((capability) => capability.id);

      expect(ids).toEqual([...EXPECTED_CAPABILITY_IDS]);
      expect(new Set(ids).size).toBe(EXPECTED_CAPABILITY_IDS.length);
    });

    test("each capability has correct metadata", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();

      for (let i = 0; i < EXPECTED_CAPABILITY_CATALOG.length; i += 1) {
        const expected = EXPECTED_CAPABILITY_CATALOG[i];
        const capability = registry.capabilities.find((entry) => entry.id === expected.id);

        expect(capability).toEqual(
          expect.objectContaining({
            id: expected.id,
            name: expected.name,
            phase: expected.phase,
            category: expected.category,
            status: CAPABILITY_STATUSES.AVAILABLE,
            mode: CAPABILITY_MODES.ADVISORY_ONLY,
            persistenceEnabled: false,
            productionConnected: false
          })
        );
      }
    });

    test("canonical definitions align with exported catalog", () => {
      expect(CANONICAL_CAPABILITY_DEFINITIONS).toHaveLength(EXPECTED_CAPABILITY_IDS.length);
      expect(CANONICAL_CAPABILITY_DEFINITIONS.map((entry) => entry.id)).toEqual([
        ...EXPECTED_CAPABILITY_IDS
      ]);
    });
  });

  describe("advisory flags", () => {
    test("registry metadata is advisory-only and descriptive", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();

      expect(registry.metadata.advisoryOnly).toBe(true);
      expect(registry.metadata.registryType).toBe("descriptive");
      expect(registry.metadata.runtimeConnected).toBe(false);
    });

    test("every capability is advisory-only and not production connected", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();

      for (let i = 0; i < registry.capabilities.length; i += 1) {
        const capability = registry.capabilities[i];
        expect(capability.mode).toBe(CAPABILITY_MODES.ADVISORY_ONLY);
        expect(capability.persistenceEnabled).toBe(false);
        expect(capability.productionConnected).toBe(false);
        expect(capability.status).toBe(CAPABILITY_STATUSES.AVAILABLE);
      }
    });
  });

  describe("deterministic output", () => {
    test("repeated calls return equivalent registry snapshots", () => {
      const first = createRecruitmentWorkflowCapabilityRegistry();
      const second = createRecruitmentWorkflowCapabilityRegistry();

      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    test("capabilities are returned in canonical phase order", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      const phases = registry.capabilities.map((capability) => capability.phase);

      expect(phases).toEqual([114, 115, 116, 117, 118, 119, 120, 121]);
    });
  });

  describe("immutability", () => {
    test("registry result is deep frozen", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      assertAllFrozen(registry);
    });

    test("mutating returned registry does not affect subsequent calls", () => {
      const first = createRecruitmentWorkflowCapabilityRegistry();

      expect(() => {
        first.metadata.advisoryOnly = false;
      }).toThrow();

      expect(() => {
        first.capabilities[0].status = "disabled";
      }).toThrow();

      const second = createRecruitmentWorkflowCapabilityRegistry();
      expect(second.metadata.advisoryOnly).toBe(true);
      expect(second.capabilities[0].status).toBe(CAPABILITY_STATUSES.AVAILABLE);
    });
  });

  describe("no side effects", () => {
    test("registry creation does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowCapabilityRegistry();
      expect(process.env).toEqual(envBefore);
    });

    test("registry creation is side-effect free across repeated invocations", () => {
      const first = createRecruitmentWorkflowCapabilityRegistry();
      const second = createRecruitmentWorkflowCapabilityRegistry();
      const third = createRecruitmentWorkflowCapabilityRegistry();

      expect(second).toEqual(first);
      expect(third).toEqual(first);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure capability registry constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 122");
      expect(source).toContain("createRecruitmentWorkflowCapabilityRegistry");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("No auto-discovery");
      expect(source).toContain("No workflow module imports");
      expect(source).toContain("capabilityRegistryOnly");
      expect(source).toContain("autoDiscovery");
      expect(source).toContain("runtimeConnected");
    });

    test("module has no runtime imports or filesystem access", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([]);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/readdir|readdirSync|glob\(|fs\.promises/);
    });

    test("module does not import workflow phase modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(source).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(source).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(source).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(source).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(source).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(source).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(source).not.toMatch(/workflowDecisionTraceModel/);
    });

    test("capability registry is not wired into coordinator, gateway, pipeline, worker, orchestrator, trace model, or observation registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const observationRegistrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(gatewaySource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(orchestratorSource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(traceModelSource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(observationRegistrySource).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
    });

    test("metadata declares no persistence, runtime connection, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.runtimeConnected).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.connectsToStorage).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CAPABILITY_REGISTRY_METADATA.autoDiscovery).toBe(false);
    });
  });
});
