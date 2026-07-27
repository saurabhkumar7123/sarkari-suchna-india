"use strict";

/**
 * Phase 50 — Runtime Capability Resolver tests.
 * Read-only metadata resolution via Access API; no cloning; identity preserved.
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
  isCapabilityRegistryArchitectureOnly
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");
const {
  ACCESS_PHASE,
  getCapability,
  getAccessRegistry,
  createRuntimeCapabilityAccess
} = require("../server/lib/recruitment/runtimeCapabilityAccess");
const {
  RESOLVER_PHASE,
  resolveCapability,
  resolveCapabilities,
  capabilityExists,
  createRuntimeCapabilityResolver
} = require("../server/lib/recruitment/runtimeCapabilityResolver");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9050,
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
        id: "rec-50",
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

describe("Phase 50 — runtimeCapabilityResolver", () => {
  describe("constants and Access API wiring", () => {
    test("exposes resolver phase and resolves through Phase 49 Access API", () => {
      expect(RESOLVER_PHASE).toBe(50);
      expect(ACCESS_PHASE).toBe(49);
      expect(INTEGRATION_PHASE).toBe(48);
      expect(getAccessRegistry().phase).toBe(CAPABILITY_REGISTRY_PHASE);
      expect(isCapabilityRegistryArchitectureOnly(getAccessRegistry())).toBe(
        true
      );
    });

    test("createRuntimeCapabilityResolver binds Access API to the shared registry", () => {
      const resolver = createRuntimeCapabilityResolver();
      const access = resolver.getAccess();

      expect(Object.isFrozen(resolver)).toBe(true);
      expect(access.getRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(access.getRegistry()).toBe(getRuntimeCapabilityRegistry());
      expect(access.getRegistry()).toBe(
        createRuntimeCapabilityAccess().getRegistry()
      );
    });

    test("createRuntimeCapabilityResolver wraps an attached runtime registry", () => {
      const runtime = attachRuntimeCapabilityRegistry({ enabled: true });
      const resolver = createRuntimeCapabilityResolver(runtime);

      expect(resolver.getAccess().getRegistry()).toBe(
        runtime.capabilityRegistry
      );
      expect(resolver.getAccess().getRegistry()).toBe(
        RUNTIME_CAPABILITY_REGISTRY
      );
    });
  });

  describe("resolveCapability", () => {
    test("resolves an existing capability", () => {
      const capability = resolveCapability(
        CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING
      );

      expect(capability).not.toBeNull();
      expect(capability.id).toBe("preview_runtime_wiring");
      expect(capability.phase).toBe(41);
      expect(capability.name).toBe("Preview-First Runtime Wiring");
      expect(capability.architectureOnly).toBe(true);
      expect(capability.enabled).toBe(false);
      expect(capability.productionReady).toBe(false);
    });

    test("returns null for an unknown capability", () => {
      expect(resolveCapability("missing_capability")).toBeNull();
      expect(resolveCapability("nope")).toBeNull();
      expect(resolveCapability(null)).toBeNull();
      expect(resolveCapability(undefined)).toBeNull();
      expect(resolveCapability("")).toBeNull();
    });
  });

  describe("resolveCapabilities", () => {
    test("resolves multiple capabilities in order", () => {
      const resolved = resolveCapabilities([
        "persistence_policy",
        CAPABILITY_IDS.EXECUTION_DIAGNOSTICS,
        "  Audit_Trail  "
      ]);

      expect(resolved).toHaveLength(3);
      expect(resolved[0].id).toBe("persistence_policy");
      expect(resolved[0].phase).toBe(33);
      expect(resolved[1].id).toBe("execution_diagnostics");
      expect(resolved[1].phase).toBe(46);
      expect(resolved[2].id).toBe("audit_trail");
      expect(resolved[2].phase).toBe(39);
    });

    test("handles unknown capabilities gracefully with null slots", () => {
      const resolved = resolveCapabilities([
        "audit_trail",
        "missing_capability",
        null,
        "execution_pipeline",
        ""
      ]);

      expect(resolved).toHaveLength(5);
      expect(resolved[0].id).toBe("audit_trail");
      expect(resolved[1]).toBeNull();
      expect(resolved[2]).toBeNull();
      expect(resolved[3].id).toBe("execution_pipeline");
      expect(resolved[4]).toBeNull();
    });

    test("returns an empty array for non-array input", () => {
      expect(resolveCapabilities(null)).toEqual([]);
      expect(resolveCapabilities(undefined)).toEqual([]);
      expect(resolveCapabilities("audit_trail")).toEqual([]);
    });
  });

  describe("capabilityExists", () => {
    test("returns true for a known capability id", () => {
      expect(capabilityExists("persistence_policy")).toBe(true);
      expect(capabilityExists(CAPABILITY_IDS.EXECUTION_DIAGNOSTICS)).toBe(true);
      expect(capabilityExists("  Audit_Trail  ")).toBe(true);
    });

    test("returns false for an unknown capability id", () => {
      expect(capabilityExists("nope")).toBe(false);
      expect(capabilityExists(null)).toBe(false);
      expect(capabilityExists(undefined)).toBe(false);
      expect(capabilityExists("")).toBe(false);
    });
  });

  describe("object identity preservation", () => {
    test("resolveCapability returns the same object as Access API and registry", () => {
      const registry = getRuntimeCapabilityRegistry();
      const fromRegistry = registry.capabilities.find(
        (c) => c.id === "audit_trail"
      );
      const fromAccess = getCapability("audit_trail");
      const fromResolver = resolveCapability("audit_trail");

      expect(fromResolver).toBe(fromAccess);
      expect(fromResolver).toBe(fromRegistry);
      expect(fromResolver).toBe(
        createRuntimeCapabilityResolver().resolveCapability("audit_trail")
      );
    });

    test("resolveCapabilities preserves entry identity without cloning", () => {
      const registry = getRuntimeCapabilityRegistry();
      const resolved = resolveCapabilities([
        "audit_trail",
        "execution_pipeline"
      ]);

      expect(resolved[0]).toBe(
        registry.capabilities.find((c) => c.id === "audit_trail")
      );
      expect(resolved[1]).toBe(
        registry.capabilities.find((c) => c.id === "execution_pipeline")
      );
      expect(resolved[0]).toBe(getCapability("audit_trail"));
      expect(resolved[1]).toBe(getCapability("execution_pipeline"));
    });

    test("resolver against a wiring result uses attached registry identity", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const capability = resolveCapability(
        CAPABILITY_IDS.EXECUTION_PIPELINE,
        result
      );
      const resolved = resolveCapabilities(
        [CAPABILITY_IDS.EXECUTION_PIPELINE],
        result
      );

      expect(capability).toBe(
        result.capabilityRegistry.capabilities.find(
          (c) => c.id === "execution_pipeline"
        )
      );
      expect(resolved[0]).toBe(capability);
      expect(
        createRuntimeCapabilityResolver(result).resolveCapability(
          "execution_pipeline"
        )
      ).toBe(capability);
    });
  });

  describe("immutability", () => {
    test("resolver methods never mutate resolved capabilities or the registry", () => {
      const registry = getRuntimeCapabilityRegistry();
      const beforeIds = registry.capabilities.map((c) => c.id);
      const beforeLength = registry.capabilities.length;
      const beforePhase = registry.phase;

      const capability = resolveCapability("persistence_policy");
      expect(capabilityExists("persistence_policy")).toBe(true);
      const resolved = resolveCapabilities(["persistence_policy", "audit_trail"]);

      expect(() => {
        resolved.push({ id: "injected" });
      }).not.toThrow();
      expect(() => {
        capability.enabled = true;
      }).toThrow();
      expect(() => {
        registry.architectureOnly = false;
      }).toThrow();
      expect(() => {
        resolved[0].enabled = true;
      }).toThrow();

      expect(registry.capabilities).toHaveLength(beforeLength);
      expect(registry.capabilities.map((c) => c.id)).toEqual(beforeIds);
      expect(registry.phase).toBe(beforePhase);
      expect(capability.enabled).toBe(false);
      expect(capability.architectureOnly).toBe(true);
      expect(resolveCapability("injected")).toBeNull();
      expect(capabilityExists("injected")).toBe(false);
    });

    test("resolver façade is frozen and does not duplicate access identity", () => {
      const resolverA = createRuntimeCapabilityResolver();
      const resolverB = createRuntimeCapabilityResolver();

      expect(Object.isFrozen(resolverA)).toBe(true);
      expect(resolverA.getAccess().getRegistry()).toBe(
        resolverB.getAccess().getRegistry()
      );
      expect(resolverA.getAccess().getRegistry()).toBe(
        RUNTIME_CAPABILITY_REGISTRY
      );
      expect(() => {
        resolverA.resolveCapability = () => null;
      }).toThrow();
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

    test("advisory metadata and worker projection omit resolver surface", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());

      expect(meta.capabilityRegistry).toBeUndefined();
      expect(helperMeta.capabilityRegistry).toBeUndefined();
      expect(meta.enabled).toBe(true);
      expect(meta.wiringPhase).toBe(WIRING_PHASE);
      expect(helperMeta.enabled).toBe(true);
    });

    test("runtime production paths do not consume the resolver directly", () => {
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const access = read("server/lib/recruitment/runtimeCapabilityAccess.js");
      const integration = read(
        "server/lib/recruitment/runtimeCapabilityRegistryIntegration.js"
      );

      // Phase 51 wires observation (which uses the resolver); wiring itself
      // must not import or call the resolver APIs directly.
      expect(wiring).not.toMatch(
        /require\(["']\.\/runtimeCapabilityResolver["']\)/
      );
      expect(wiring).not.toMatch(/createRuntimeCapabilityResolver/);
      expect(wiring).not.toMatch(/resolveCapability\s*\(/);
      expect(wiring).not.toMatch(/resolveCapabilities\s*\(/);
      expect(wiring).not.toMatch(/capabilityExists\s*\(/);
      expect(access).not.toMatch(/runtimeCapabilityResolver/);
      expect(access).not.toMatch(/createRuntimeCapabilityResolver/);
      expect(integration).not.toMatch(/runtimeCapabilityResolver/);
      expect(integration).not.toMatch(/createRuntimeCapabilityResolver/);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("resolver module is read-only and depends only on Access API", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityResolver.js"
      );
      expect(source).toMatch(/Phase 50/);
      expect(source).toMatch(/read-only/i);
      expect(source).toMatch(/Never clones capability objects/i);
      expect(source).toMatch(/Preserves object identity/i);
      expect(source).toMatch(/No caching/i);
      expect(source).toMatch(/No lazy loading/i);
      expect(source).toMatch(/No execution/i);
      expect(source).toMatch(/Never accesses the\s+registry directly/i);
      expect(source).toMatch(/Independent from\s+runtime execution/i);
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
      expect(source).not.toMatch(/runtimeCapabilityRegistryIntegration/);
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistry["']\)/
      );
      expect(source).not.toMatch(/getRuntimeCapabilityRegistry/);
      expect(source).not.toMatch(/peekAttachedCapabilityRegistry/);

      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./runtimeCapabilityAccess"]);
    });

    test("siteWorker is unchanged — no resolver import or branching", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityResolver/);
      expect(worker).not.toMatch(/runtimeCapabilityAccess/);
      expect(worker).not.toMatch(/runtimeCapabilityRegistry/);
      expect(worker).not.toMatch(/createRuntimeCapabilityResolver/);
      expect(worker).not.toMatch(/resolveCapability/);
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
        "server/lib/recruitment/runtimeCapabilityAccess.js": /Phase 49/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 50/);
        expect(source).not.toMatch(/runtimeCapabilityResolver/);
        expect(source).not.toMatch(/createRuntimeCapabilityResolver/);
        expect(source).not.toMatch(/resolveCapabilities/);
        expect(source).not.toMatch(/capabilityExists/);
      }

      // Wiring remains Phase 41-anchored and must not import resolver APIs
      // directly (Phase 51 consumes via the observation module only).
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      expect(wiring).toMatch(/Phase 41/);
      expect(wiring).not.toMatch(
        /require\(["']\.\/runtimeCapabilityResolver["']\)/
      );
      expect(wiring).not.toMatch(/createRuntimeCapabilityResolver/);
      expect(wiring).not.toMatch(/resolveCapabilities/);
      expect(wiring).not.toMatch(/capabilityExists/);
    });
  });
});
