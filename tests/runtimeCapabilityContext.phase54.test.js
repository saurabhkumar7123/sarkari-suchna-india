"use strict";

/**
 * Phase 54 — Preview Runtime Capability Context tests.
 * Context container from awareness only; no runtime impact.
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
  RUNTIME_CAPABILITY_REGISTRY
} = require("../server/lib/recruitment/runtimeCapabilityRegistryIntegration");
const {
  CAPABILITY_IDS
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");
const {
  CONSUMPTION_PHASE,
  OBSERVED_CAPABILITY_ID,
  observeRuntimeCapability,
  peekObservedRuntimeCapability
} = require("../server/lib/recruitment/runtimeCapabilityObservation");
const {
  AWARENESS_PHASE,
  buildRuntimeCapabilityAwareness,
  attachRuntimeCapabilityAwareness,
  peekRuntimeCapabilityAwareness,
  isRuntimeCapabilityAwareness
} = require("../server/lib/recruitment/runtimeCapabilityAwareness");
const {
  CONTEXT_PHASE,
  buildRuntimeCapabilityContext,
  attachRuntimeCapabilityContext,
  peekRuntimeCapabilityContext,
  isRuntimeCapabilityContext
} = require("../server/lib/recruitment/runtimeCapabilityContext");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9054,
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
        id: "rec-54",
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

function awarenessFixture(overrides = {}) {
  const observation = {
    phase: CONSUMPTION_PHASE,
    observationOnly: true,
    capabilityId: OBSERVED_CAPABILITY_ID,
    capability: {
      id: "preview_runtime_wiring",
      name: "Preview-First Runtime Wiring",
      phase: 41,
      description: "Context-only awareness fixture.",
      available: true,
      wired: true,
      enabled: false,
      architectureOnly: true,
      productionReady: false,
      dependencies: ["execution_context"]
    },
    validation: {
      phase: 52,
      valid: true,
      validationOnly: true,
      informational: true
    }
  };

  const awareness = buildRuntimeCapabilityAwareness(observation);
  if (awareness == null) {
    return null;
  }

  return Object.freeze({
    ...awareness,
    ...overrides
  });
}

describe("Phase 54 — runtimeCapabilityContext", () => {
  describe("constants", () => {
    test("exposes context phase", () => {
      expect(CONTEXT_PHASE).toBe(54);
      expect(AWARENESS_PHASE).toBe(53);
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(OBSERVED_CAPABILITY_ID).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("context created from awareness", () => {
    test("live wiring builds context from internal awareness only", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(runtime);
      const awareness = peekRuntimeCapabilityAwareness(runtime);
      const context = peekRuntimeCapabilityContext(runtime);

      expect(observation).not.toBeNull();
      expect(isRuntimeCapabilityAwareness(awareness)).toBe(true);
      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(context.phase).toBe(54);
      expect(context.contextOnly).toBe(true);
      expect(context.informational).toBe(true);
      expect(context.awarenessPresent).toBe(true);
      expect(context.awarenessPhase).toBe(53);
      expect(context.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(context.observationPresent).toBe(true);
      expect(context.validationPresent).toBe(true);
      expect(context.structurallyValid).toBe(true);
      expect(Object.isFrozen(context)).toBe(true);
    });

    test("buildRuntimeCapabilityContext derives state only from awareness", () => {
      const awareness = awarenessFixture();
      const context = buildRuntimeCapabilityContext(awareness);

      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(context).toEqual({
        phase: 54,
        contextOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring",
        awarenessPresent: true,
        awarenessPhase: 53,
        observationPresent: true,
        validationPresent: true,
        structurallyValid: true,
        available: true,
        wired: true,
        enabled: false,
        architectureOnly: true,
        productionReady: false,
        capabilityName: "Preview-First Runtime Wiring",
        capabilityPhase: 41
      });
      expect(Object.isFrozen(context)).toBe(true);
    });
  });

  describe("immutable context", () => {
    test("context is frozen and holds only normalized scalars", () => {
      const context = buildRuntimeCapabilityContext(awarenessFixture());

      expect(Object.isFrozen(context)).toBe(true);
      expect(() => {
        context.capabilityId = "mutated";
      }).toThrow();
      expect(context.capabilityId).toBe("preview_runtime_wiring");

      for (const value of Object.values(context)) {
        expect(
          value === null ||
            typeof value === "boolean" ||
            typeof value === "number" ||
            typeof value === "string"
        ).toBe(true);
      }
    });

    test("context does not embed live awareness or capability object graphs", () => {
      const awareness = awarenessFixture();
      const context = buildRuntimeCapabilityContext(awareness);

      expect(context).not.toHaveProperty("capability");
      expect(context).not.toHaveProperty("validation");
      expect(context).not.toHaveProperty("awareness");
      expect(context).not.toHaveProperty("observation");
      expect(Object.keys(context).sort()).toEqual(
        [
          "architectureOnly",
          "available",
          "awarenessPhase",
          "awarenessPresent",
          "capabilityId",
          "capabilityName",
          "capabilityPhase",
          "contextOnly",
          "enabled",
          "informational",
          "observationPresent",
          "phase",
          "productionReady",
          "structurallyValid",
          "validationPresent",
          "wired"
        ].sort()
      );
    });
  });

  describe("internal storage only", () => {
    test("context is not a public enumerable field on the runtime result", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(result.capabilityContext).toBeUndefined();
      expect(result.runtimeCapabilityContext).toBeUndefined();
      expect(result.contextOnly).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(result, "capabilityContext")
      ).toBe(false);
      expect(Object.keys(result)).not.toContain("capabilityContext");
      expect(Object.keys(result)).not.toContain("runtimeCapabilityContext");
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /contextOnly|awarenessPresent|CONTEXT_PHASE/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const context = peekRuntimeCapabilityContext(result);
      expect(context).not.toBeNull();
      expect(context.contextOnly).toBe(true);
    });
  });

  describe("unavailable awareness", () => {
    test("returns null when awareness is missing or malformed", () => {
      expect(buildRuntimeCapabilityContext(null)).toBeNull();
      expect(buildRuntimeCapabilityContext(undefined)).toBeNull();
      expect(buildRuntimeCapabilityContext({})).toBeNull();
      expect(
        buildRuntimeCapabilityContext({ awarenessOnly: false })
      ).toBeNull();
      expect(
        buildRuntimeCapabilityContext({
          awarenessOnly: true,
          informational: false
        })
      ).toBeNull();
      expect(buildRuntimeCapabilityContext("x")).toBeNull();
      expect(buildRuntimeCapabilityContext([])).toBeNull();
    });

    test("peek returns null when context was never attached", () => {
      const runtime = { enabled: true };
      expect(peekRuntimeCapabilityContext(runtime)).toBeNull();
      expect(peekRuntimeCapabilityContext(null)).toBeNull();
      expect(peekRuntimeCapabilityContext(undefined)).toBeNull();
    });

    test("attach without valid awareness leaves context unavailable", () => {
      const runtime = { enabled: true };
      attachRuntimeCapabilityContext(runtime, null);
      expect(peekRuntimeCapabilityContext(runtime)).toBeNull();

      attachRuntimeCapabilityContext(runtime, { awarenessOnly: false });
      expect(peekRuntimeCapabilityContext(runtime)).toBeNull();
    });
  });

  describe("runtime output unchanged", () => {
    test("public wiring fields and decisions remain identical to prior phases", () => {
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
      expect(result.capabilityContext).toBeUndefined();
      expect(result.runtimeCapabilityContext).toBeUndefined();
      expect(Object.keys(result)).not.toContain("capabilityContext");
      expect(Object.keys(result)).not.toContain("runtimeCapabilityContext");
    });

    test("context attach failures do not alter runtime outputs", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = observeRuntimeCapability(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(runtime.capabilityContext).toBeUndefined();
      expect(peekRuntimeCapabilityAwareness(runtime)).not.toBeNull();
      expect(peekRuntimeCapabilityContext(runtime)).not.toBeNull();
    });

    test("disabled and invalid wiring paths still continue existing behavior", () => {
      const disabled = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );
      const invalid = runPreviewRuntimeWiring(null);

      expect(disabled.enabled).toBe(false);
      expect(invalid.enabled).toBe(false);
      expect(peekRuntimeCapabilityContext(disabled)).not.toBeNull();
      expect(peekRuntimeCapabilityContext(invalid)).not.toBeNull();
      expect(disabled.capabilityContext).toBeUndefined();
      expect(invalid.capabilityContext).toBeUndefined();
    });
  });

  describe("metadata unchanged", () => {
    test("context is never projected into advisory metadata or worker helpers", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(meta.capabilityContext).toBeUndefined();
      expect(meta.runtimeCapabilityContext).toBeUndefined();
      expect(meta.contextOnly).toBeUndefined();
      expect(helperMeta.capabilityContext).toBeUndefined();
      expect(helperMeta.runtimeCapabilityContext).toBeUndefined();
      expect(result.metadata.capabilityContext).toBeUndefined();
      expect(result.metadata.runtimeCapabilityContext).toBeUndefined();
      expect(JSON.stringify(meta)).not.toMatch(
        /capabilityContext|runtimeCapabilityContext|contextOnly|awarenessPresent/
      );
      expect(JSON.stringify(helperMeta)).not.toMatch(
        /capabilityContext|runtimeCapabilityContext|contextOnly|awarenessPresent/
      );
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /contextOnly|awarenessPresent/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const context = peekRuntimeCapabilityContext(result);
      expect(context).not.toBeNull();
      expect(context.awarenessPresent).toBe(true);
    });
  });

  describe("no branching or enablement", () => {
    test("context never drives branching and never rebuilds awareness", () => {
      const contextSource = read(
        "server/lib/recruitment/runtimeCapabilityContext.js"
      );
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const awareness = read(
        "server/lib/recruitment/runtimeCapabilityAwareness.js"
      );

      expect(contextSource).toMatch(/Phase 54/);
      expect(contextSource).toMatch(/container only/i);
      expect(contextSource).toMatch(/WeakMap/);
      expect(contextSource).toMatch(/normalized immutable/i);
      expect(contextSource).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(contextSource).not.toMatch(/if\s*\(\s*context\.structurallyValid/);
      expect(contextSource).not.toMatch(/enabled\s*===\s*true/);
      expect(contextSource).not.toMatch(/resolveCapability\s*\(/);
      expect(contextSource).not.toMatch(/buildRuntimeCapabilityAwareness/);
      expect(contextSource).not.toMatch(/peekRuntimeCapabilityAwareness/);

      expect(observation).toMatch(/Phase 54/);
      expect(observation).toMatch(/attachRuntimeCapabilityContext/);
      expect(observation).not.toMatch(/if\s*\(\s*context/);
      expect(observation).not.toMatch(/peekRuntimeCapabilityContext\s*\(/);
      expect(observation).not.toMatch(/context\.enabled/);
      expect(observation).not.toMatch(/buildRuntimeCapabilityAwareness/);

      expect(wiring).not.toMatch(/runtimeCapabilityContext/);
      expect(wiring).not.toMatch(/attachRuntimeCapabilityContext/);
      expect(wiring).not.toMatch(/peekRuntimeCapabilityContext/);
      expect(wiring).not.toMatch(/if\s*\(\s*context/);

      expect(awareness).not.toMatch(/runtimeCapabilityContext/);
      expect(awareness).not.toMatch(/Phase 54/);
    });
  });

  describe("backward compatibility", () => {
    test("context module has no registry / access / resolver / awareness requires", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityContext.js"
      );
      expect(source).toMatch(/Phase 54/);
      expect(source).toMatch(/normalized/i);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistry["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistryIntegration["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityAccess["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityResolver["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityObservation["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityValidation["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityAwareness["']\)/
      );
    });

    test("siteWorker is unchanged — no context import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityContext/);
      expect(worker).not.toMatch(/attachRuntimeCapabilityContext/);
      expect(worker).not.toMatch(/peekRuntimeCapabilityContext/);
      expect(worker).not.toMatch(/runtimeCapabilityAwareness/);
      expect(worker).not.toMatch(/runtimeCapabilityObservation/);
      expect(worker).toMatch(/buildPreviewLifecycleArchitecture/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("adapters, pipelines, enablement, and prior capability modules are untouched", () => {
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
        "server/lib/recruitment/runtimeCapabilityResolver.js": /Phase 50/,
        "server/lib/recruitment/runtimeCapabilityValidation.js": /Phase 52/,
        "server/lib/recruitment/runtimeCapabilityAwareness.js": /Phase 53/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 54/);
        expect(source).not.toMatch(/runtimeCapabilityContext/);
        expect(source).not.toMatch(/attachRuntimeCapabilityContext/);
        expect(source).not.toMatch(/peekRuntimeCapabilityContext/);
        expect(source).not.toMatch(/buildRuntimeCapabilityContext/);
      }
    });

    test("awareness module still has zero requires after Phase 54 wiring", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityAwareness.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("attach awareness return value feeds context without rebuild", () => {
      const runtime = { enabled: true };
      const observation = {
        phase: 51,
        observationOnly: true,
        capabilityId: "preview_runtime_wiring",
        capability: {
          id: "preview_runtime_wiring",
          name: "Preview-First Runtime Wiring",
          phase: 41,
          available: true,
          wired: true,
          enabled: false,
          architectureOnly: true,
          productionReady: false
        },
        validation: { valid: true, phase: 52 }
      };

      const awareness = attachRuntimeCapabilityAwareness(runtime, observation);
      expect(isRuntimeCapabilityAwareness(awareness)).toBe(true);
      expect(peekRuntimeCapabilityAwareness(runtime)).toBe(awareness);

      attachRuntimeCapabilityContext(runtime, awareness);
      const context = peekRuntimeCapabilityContext(runtime);
      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(context.capabilityId).toBe("preview_runtime_wiring");
      expect(context.awarenessPhase).toBe(53);
    });
  });
});
