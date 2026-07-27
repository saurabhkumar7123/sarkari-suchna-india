"use strict";

/**
 * Phase 49 — Runtime Capability Access API tests.
 * Read-only lookup over the attached registry; no cloning; identity preserved.
 */

const fs = require("fs");
const path = require("path");

const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  PERSISTENCE_ACTIONS
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  WIRING_PHASE,
  WIRING_REASONS,
  runPreviewRuntimeWiring,
  toPreviewAdvisoryMetadata,
  buildPreviewLifecycleArchitecture
} = require("../server/lib/recruitment/previewRuntimeWiring");
const {
  INTEGRATION_PHASE,
  RUNTIME_CAPABILITY_REGISTRY,
  getRuntimeCapabilityRegistry,
  attachRuntimeCapabilityRegistry
} = require("../server/lib/recruitment/runtimeCapabilityRegistryIntegration");
const {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY_PHASE,
  createCapabilityRegistry,
  isCapabilityRegistryArchitectureOnly
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");
const {
  ACCESS_PHASE,
  getCapability,
  hasCapability,
  listCapabilities,
  getAccessRegistry,
  createRuntimeCapabilityAccess
} = require("../server/lib/recruitment/runtimeCapabilityAccess");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9049,
    notice: {
      title: "SSC CGL 2026 Admit Card",
      content: "SSC CGL 2026 Admit Card",
      url: "https://ssc.nic.in/admit.pdf"
    },
    lookupSummary: {
      status: "ok",
      strategy: "advertisement_no",
      candidateCount: 1
    },
    eligibility: {
      eligible: true,
      status: ELIGIBILITY_STATUS.ELIGIBLE,
      reasons: ["CONFIDENCE_HIGH", "KNOWN_LIFECYCLE_EVENT"],
      confidence: "high",
      eventType: "admit_card",
      candidateCount: 1,
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ADVERTISEMENT_NUMBER"],
        conflictingSignals: []
      }
    },
    processorResult: {
      status: "success",
      eventType: "admit_card",
      warnings: [],
      selectedRecruitment: {
        id: "rec-49",
        lifecycle_state: "open"
      },
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ADVERTISEMENT_NUMBER"],
        conflictingSignals: []
      }
    },
    ...overrides
  };
}

describe("Phase 49 — runtimeCapabilityAccess", () => {
  describe("constants and wrapping", () => {
    test("exposes access phase and wraps the shared Phase 48 registry", () => {
      expect(ACCESS_PHASE).toBe(49);
      expect(INTEGRATION_PHASE).toBe(48);
      expect(getAccessRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(getAccessRegistry()).toBe(getRuntimeCapabilityRegistry());
      expect(getAccessRegistry().phase).toBe(CAPABILITY_REGISTRY_PHASE);
      expect(isCapabilityRegistryArchitectureOnly(getAccessRegistry())).toBe(
        true
      );
    });

    test("createRuntimeCapabilityAccess binds the shared registry by default", () => {
      const access = createRuntimeCapabilityAccess();
      expect(access.getRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(Object.isFrozen(access)).toBe(true);
    });

    test("createRuntimeCapabilityAccess wraps an attached runtime registry", () => {
      const runtime = attachRuntimeCapabilityRegistry({ enabled: true });
      const access = createRuntimeCapabilityAccess(runtime);
      expect(access.getRegistry()).toBe(runtime.capabilityRegistry);
      expect(access.getRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
    });
  });

  describe("getCapability", () => {
    test("returns an existing capability from the shared registry", () => {
      const capability = getCapability(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);

      expect(capability).not.toBeNull();
      expect(capability.id).toBe("preview_runtime_wiring");
      expect(capability.phase).toBe(41);
      expect(capability.name).toBe("Preview-First Runtime Wiring");
      expect(capability.architectureOnly).toBe(true);
      expect(capability.enabled).toBe(false);
      expect(capability.productionReady).toBe(false);
    });

    test("returns null for an unknown capability", () => {
      expect(getCapability("missing_capability")).toBeNull();
      expect(getCapability("nope")).toBeNull();
      expect(getCapability(null)).toBeNull();
      expect(getCapability(undefined)).toBeNull();
      expect(getCapability("")).toBeNull();
    });
  });

  describe("hasCapability", () => {
    test("returns true for a known capability id", () => {
      expect(hasCapability("persistence_policy")).toBe(true);
      expect(hasCapability(CAPABILITY_IDS.EXECUTION_DIAGNOSTICS)).toBe(true);
      expect(hasCapability("  Audit_Trail  ")).toBe(true);
    });

    test("returns false for an unknown capability id", () => {
      expect(hasCapability("nope")).toBe(false);
      expect(hasCapability(null)).toBe(false);
      expect(hasCapability(undefined)).toBe(false);
      expect(hasCapability("")).toBe(false);
    });
  });

  describe("listCapabilities", () => {
    test("lists all capabilities from the wrapped registry", () => {
      const listed = listCapabilities();

      expect(listed).toHaveLength(14);
      expect(listed.map((c) => c.id)).toEqual([
        "persistence_policy",
        "runtime_persistence_service",
        "repository_contracts",
        "mysql_repository_adapters",
        "execution_pipeline",
        "transaction_coordinator",
        "audit_trail",
        "execution_context",
        "preview_runtime_wiring",
        "dry_run_simulator",
        "review_workflow",
        "persistence_enablement",
        "controlled_execution_adapter",
        "execution_diagnostics"
      ]);
      expect(listed.map((c) => c.phase)).toEqual([
        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46
      ]);
    });
  });

  describe("object identity preservation", () => {
    test("getCapability returns the same object stored in the registry", () => {
      const registry = getRuntimeCapabilityRegistry();
      const fromRegistry = registry.capabilities.find(
        (c) => c.id === "audit_trail"
      );
      const fromAccess = getCapability("audit_trail");

      expect(fromAccess).toBe(fromRegistry);
      expect(fromAccess).toBe(
        createRuntimeCapabilityAccess().getCapability("audit_trail")
      );
    });

    test("listCapabilities returns the registry capabilities array itself", () => {
      const registry = getRuntimeCapabilityRegistry();
      const listed = listCapabilities();

      expect(listed).toBe(registry.capabilities);
      expect(listed[0]).toBe(registry.capabilities[0]);
      expect(listed[listed.length - 1]).toBe(
        registry.capabilities[registry.capabilities.length - 1]
      );
    });

    test("access against a wiring result uses the attached registry identity", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const capability = getCapability(
        CAPABILITY_IDS.EXECUTION_PIPELINE,
        result
      );
      const listed = listCapabilities(result);

      expect(getAccessRegistry(result)).toBe(result.capabilityRegistry);
      expect(capability).toBe(
        result.capabilityRegistry.capabilities.find(
          (c) => c.id === "execution_pipeline"
        )
      );
      expect(listed).toBe(result.capabilityRegistry.capabilities);
    });
  });

  describe("registry immutability", () => {
    test("access methods never mutate the shared registry", () => {
      const registry = getRuntimeCapabilityRegistry();
      const beforeIds = registry.capabilities.map((c) => c.id);
      const beforeLength = registry.capabilities.length;
      const beforePhase = registry.phase;

      const capability = getCapability("persistence_policy");
      expect(hasCapability("persistence_policy")).toBe(true);
      const listed = listCapabilities();

      expect(() => {
        listed.push({ id: "injected" });
      }).toThrow();
      expect(() => {
        capability.enabled = true;
      }).toThrow();
      expect(() => {
        registry.architectureOnly = false;
      }).toThrow();

      expect(registry.capabilities).toHaveLength(beforeLength);
      expect(registry.capabilities.map((c) => c.id)).toEqual(beforeIds);
      expect(registry.phase).toBe(beforePhase);
      expect(capability.enabled).toBe(false);
      expect(capability.architectureOnly).toBe(true);
      expect(getCapability("injected")).toBeNull();
    });

    test("access does not create a duplicate registry catalog", () => {
      const accessA = createRuntimeCapabilityAccess();
      const accessB = createRuntimeCapabilityAccess();
      const fresh = createCapabilityRegistry();

      expect(accessA.getRegistry()).toBe(accessB.getRegistry());
      expect(accessA.getRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(accessA.getRegistry()).not.toBe(fresh);
      expect(listCapabilities()).toBe(RUNTIME_CAPABILITY_REGISTRY.capabilities);
    });
  });

  describe("backward compatibility — runtime behavior unchanged", () => {
    test("wiring results and decisions remain identical to prior phases", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());

      expect(result.enabled).toBe(true);
      expect(result.observationOnly).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.sideEffects).toBe(false);
      expect(result.reason).toBe(WIRING_REASONS.ENABLED);
      expect(result.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(result.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.persistenceOutcome.actualAction).toBe(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
      expect(result.executionPlan.executable).toBe(false);
      expect(result.transactionPlan.executable).toBe(false);
      expect(result.auditEvents).toHaveLength(4);
      expect(result.metadata.wiringPhase).toBe(WIRING_PHASE);
      expect(result.metadata.persistenceEnabled).toBe(false);
      expect(result.metadata.automationEnabled).toBe(false);
      expect(result.metadata.reviewQueueEnqueueEnabled).toBe(false);
    });

    test("advisory metadata and worker projection omit access API surface", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());

      expect(meta.capabilityRegistry).toBeUndefined();
      expect(helperMeta.capabilityRegistry).toBeUndefined();
      expect(meta.enabled).toBe(true);
      expect(meta.wiringPhase).toBe(WIRING_PHASE);
      expect(helperMeta.enabled).toBe(true);
    });

    test("runtime production paths do not consume the access API", () => {
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const integration = read(
        "server/lib/recruitment/runtimeCapabilityRegistryIntegration.js"
      );

      expect(wiring).not.toMatch(/runtimeCapabilityAccess/);
      expect(wiring).not.toMatch(/createRuntimeCapabilityAccess/);
      expect(integration).not.toMatch(/runtimeCapabilityAccess/);
      expect(integration).not.toMatch(/createRuntimeCapabilityAccess/);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("access module is read-only and side-effect free", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityAccess.js"
      );
      expect(source).toMatch(/Phase 49/);
      expect(source).toMatch(/read-only/i);
      expect(source).toMatch(/Never clones capability objects/i);
      expect(source).toMatch(/Preserves object identity/i);
      expect(source).toMatch(/No caching/i);
      expect(source).toMatch(/No lazy loading/i);
      expect(source).toMatch(/No execution/i);
      expect(source).toMatch(/No feature enablement/i);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);
      expect(source).not.toMatch(/cloneCapability/);
      expect(source).not.toMatch(/createCapabilityRegistry/);

      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./runtimeCapabilityRegistryIntegration"]);
    });

    test("siteWorker is unchanged — no access API import or branching", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityAccess/);
      expect(worker).not.toMatch(/runtimeCapabilityRegistry/);
      expect(worker).not.toMatch(/createRuntimeCapabilityAccess/);
      expect(worker).not.toMatch(/getAccessRegistry/);
      expect(worker).toMatch(/buildPreviewLifecycleArchitecture/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("prior phases, adapters, pipelines, and enablement are untouched", () => {
      const files = {
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js":
          /Phase 36/,
        "server/lib/recruitment/persistenceExecutionPipeline.js": /Phase 37/,
        "server/lib/recruitment/persistenceEnablement.js": /Phase 44/,
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js":
          /Phase 45/,
        "server/lib/recruitment/executionDiagnostics.js": /Phase 46/,
        "server/lib/recruitment/runtimeCapabilityRegistry.js": /Phase 47/,
        "server/lib/recruitment/runtimeCapabilityRegistryIntegration.js":
          /Phase 48/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 49/);
        expect(source).not.toMatch(/runtimeCapabilityAccess/);
        expect(source).not.toMatch(/createRuntimeCapabilityAccess/);
      }
    });
  });
});
