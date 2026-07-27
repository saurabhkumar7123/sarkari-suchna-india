"use strict";

/**
 * Phase 56 — Preview Runtime Capability Integration Hook tests.
 * No-op integration point after context read; no runtime impact.
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
  CONTEXT_PHASE,
  peekRuntimeCapabilityContext,
  isRuntimeCapabilityContext
} = require("../server/lib/recruitment/runtimeCapabilityContext");
const {
  READ_PHASE,
  buildRuntimeCapabilityContextRead,
  peekRuntimeCapabilityContextRead,
  isRuntimeCapabilityContextRead
} = require("../server/lib/recruitment/runtimeCapabilityContextRead");
const {
  INTEGRATION_PHASE,
  invokePreviewRuntimeCapabilityIntegration
} = require("../server/lib/recruitment/runtimeCapabilityPreviewIntegration");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9056,
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
        id: "rec-56",
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

function contextReadFixture(overrides = {}) {
  const contextRead = buildRuntimeCapabilityContextRead({
    phase: 54,
    contextOnly: true,
    informational: true,
    awarenessPresent: true,
    capabilityId: OBSERVED_CAPABILITY_ID,
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

  if (contextRead == null) {
    return null;
  }

  return Object.freeze({
    ...contextRead,
    ...overrides
  });
}

describe("Phase 56 — runtimeCapabilityPreviewIntegration", () => {
  describe("constants", () => {
    test("exposes integration hook phase", () => {
      expect(INTEGRATION_PHASE).toBe(56);
      expect(READ_PHASE).toBe(55);
      expect(CONTEXT_PHASE).toBe(54);
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(OBSERVED_CAPABILITY_ID).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("hook invoked during runtime initialization", () => {
    test("live wiring invokes integration hook after context read", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const context = peekRuntimeCapabilityContext(runtime);
      const contextRead = peekRuntimeCapabilityContextRead(runtime);

      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);

      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      expect(observation).toMatch(/invokePreviewRuntimeCapabilityIntegration/);
      expect(observation).toMatch(/readRuntimeCapabilityContext/);
      expect(observation).toMatch(/peekRuntimeCapabilityContextRead/);
    });

    test("observation chains context read then integration hook", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(runtime);
      const contextRead = peekRuntimeCapabilityContextRead(runtime);

      expect(observation).not.toBeNull();
      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
      expect(contextRead.phase).toBe(55);
    });
  });

  describe("hook receives expected inputs", () => {
    test("invoke accepts runtime object and context read snapshot", () => {
      const runtime = { enabled: true, reason: "KEEP" };
      const contextRead = contextReadFixture();

      const returned = invokePreviewRuntimeCapabilityIntegration(
        runtime,
        contextRead
      );

      expect(returned).toBe(runtime);
      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
    });

    test("invoke accepts runtime object with null context read", () => {
      const runtime = { enabled: true, reason: "KEEP" };

      const returned = invokePreviewRuntimeCapabilityIntegration(runtime, null);

      expect(returned).toBe(runtime);
    });

    test("invoke accepts runtime object with undefined context read", () => {
      const runtime = { enabled: true, reason: "KEEP" };

      const returned = invokePreviewRuntimeCapabilityIntegration(
        runtime,
        undefined
      );

      expect(returned).toBe(runtime);
    });
  });

  describe("hook performs no mutations", () => {
    test("direct invoke leaves runtime unchanged", () => {
      const runtime = {
        enabled: true,
        reason: "KEEP",
        metadata: { ok: true, wiringPhase: 41 }
      };
      const contextRead = contextReadFixture();
      const before = JSON.stringify(runtime);

      const returned = invokePreviewRuntimeCapabilityIntegration(
        runtime,
        contextRead
      );

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true, wiringPhase: 41 });
    });

    test("missing context read leaves runtime unchanged", () => {
      const runtime = { enabled: true, reason: "KEEP" };
      const before = JSON.stringify(runtime);

      const returned = invokePreviewRuntimeCapabilityIntegration(runtime, null);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
    });

    test("non-object runtime is returned unchanged", () => {
      expect(invokePreviewRuntimeCapabilityIntegration(null, null)).toBeNull();
      expect(
        invokePreviewRuntimeCapabilityIntegration(undefined, null)
      ).toBeUndefined();
      expect(invokePreviewRuntimeCapabilityIntegration("x", null)).toBe("x");
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
      expect(result.previewIntegration).toBeUndefined();
      expect(result.runtimeCapabilityPreviewIntegration).toBeUndefined();
      expect(Object.keys(result)).not.toContain("previewIntegration");
      expect(Object.keys(result)).not.toContain(
        "runtimeCapabilityPreviewIntegration"
      );
    });

    test("observation integration hook failures do not alter runtime outputs", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = observeRuntimeCapability(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(peekRuntimeCapabilityContext(runtime)).not.toBeNull();
      expect(peekRuntimeCapabilityContextRead(runtime)).not.toBeNull();
    });

    test("disabled and invalid wiring paths still continue existing behavior", () => {
      const disabled = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );
      const invalid = runPreviewRuntimeWiring(null);

      expect(disabled.enabled).toBe(false);
      expect(invalid.enabled).toBe(false);
      expect(peekRuntimeCapabilityContextRead(disabled)).not.toBeNull();
      expect(peekRuntimeCapabilityContextRead(invalid)).not.toBeNull();
      expect(disabled.previewIntegration).toBeUndefined();
      expect(invalid.previewIntegration).toBeUndefined();
    });
  });

  describe("metadata unchanged", () => {
    test("integration hook is never projected into advisory metadata or worker helpers", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(meta.previewIntegration).toBeUndefined();
      expect(meta.runtimeCapabilityPreviewIntegration).toBeUndefined();
      expect(helperMeta.previewIntegration).toBeUndefined();
      expect(helperMeta.runtimeCapabilityPreviewIntegration).toBeUndefined();
      expect(result.metadata.previewIntegration).toBeUndefined();
      expect(result.metadata.runtimeCapabilityPreviewIntegration).toBeUndefined();
      expect(JSON.stringify(meta)).not.toMatch(
        /previewIntegration|runtimeCapabilityPreviewIntegration|INTEGRATION_PHASE/
      );
      expect(JSON.stringify(helperMeta)).not.toMatch(
        /previewIntegration|runtimeCapabilityPreviewIntegration|INTEGRATION_PHASE/
      );
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /previewIntegration|INTEGRATION_PHASE/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const contextRead = peekRuntimeCapabilityContextRead(result);
      expect(contextRead).not.toBeNull();
      expect(contextRead.contextPresent).toBe(true);
    });
  });

  describe("no branching or enablement", () => {
    test("integration hook never drives branching or feature enablement", () => {
      const integration = read(
        "server/lib/recruitment/runtimeCapabilityPreviewIntegration.js"
      );
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const contextRead = read(
        "server/lib/recruitment/runtimeCapabilityContextRead.js"
      );

      expect(integration).toMatch(/Phase 56/);
      expect(integration).not.toMatch(/WeakMap/);
      expect(integration).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(integration).not.toMatch(/if\s*\(\s*contextRead/);
      expect(integration).not.toMatch(/if\s*\(\s*read\./);
      expect(integration).not.toMatch(/enabled\s*===\s*true/);
      expect(integration).not.toMatch(/resolveCapability\s*\(/);
      expect(integration).not.toMatch(/attachRuntimeCapabilityContext/);
      expect(integration).not.toMatch(/readRuntimeCapabilityContext/);

      expect(observation).toMatch(/Phase 56/);
      expect(observation).toMatch(/invokePreviewRuntimeCapabilityIntegration/);
      expect(observation).toMatch(/readRuntimeCapabilityContext/);
      expect(observation).not.toMatch(/if\s*\(\s*contextRead/);
      expect(observation).not.toMatch(/if\s*\(\s*read/);
      expect(observation).not.toMatch(/contextRead\.enabled/);

      expect(wiring).not.toMatch(/runtimeCapabilityPreviewIntegration/);
      expect(wiring).not.toMatch(/invokePreviewRuntimeCapabilityIntegration/);

      expect(contextRead).not.toMatch(/runtimeCapabilityPreviewIntegration/);
      expect(contextRead).not.toMatch(/Phase 56/);
    });
  });

  describe("backward compatibility", () => {
    test("integration module has no upstream capability dependencies", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityPreviewIntegration.js"
      );
      expect(source).toMatch(/Phase 56/);
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
    });

    test("siteWorker is unchanged — no integration hook import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityPreviewIntegration/);
      expect(worker).not.toMatch(/invokePreviewRuntimeCapabilityIntegration/);
      expect(worker).not.toMatch(/runtimeCapabilityContextRead/);
      expect(worker).not.toMatch(/runtimeCapabilityContext/);
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
        "server/lib/recruitment/runtimeCapabilityContext.js": /Phase 54/,
        "server/lib/recruitment/runtimeCapabilityContextRead.js": /Phase 55/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 56/);
        expect(source).not.toMatch(/runtimeCapabilityPreviewIntegration/);
        expect(source).not.toMatch(/invokePreviewRuntimeCapabilityIntegration/);
      }
    });

    test("observation chains context read then integration hook with expected requires", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./runtimeCapabilityResolver",
        "./runtimeCapabilityValidation",
        "./runtimeCapabilityAwareness",
        "./runtimeCapabilityContext",
        "./runtimeCapabilityContextRead",
        "./runtimeCapabilityPreviewIntegration",
        "./previewIntegrationContract",
        "./executionDiagnosticsCapabilityIntegration"
      ]);
      expect(source).toMatch(/readRuntimeCapabilityContext\(runtimeObject\)/);
      expect(source).toMatch(/invokePreviewRuntimeCapabilityIntegration/);
      expect(source).toMatch(/peekRuntimeCapabilityContextRead\(runtimeObject\)/);
    });

    test("context read module still has no integration hook requires after Phase 56 wiring", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityContextRead.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./runtimeCapabilityContext"]);
      expect(source).not.toMatch(/runtimeCapabilityPreviewIntegration/);
    });
  });
});
