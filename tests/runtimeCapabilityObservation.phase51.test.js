"use strict";

/**
 * Phase 51 — First Runtime Capability Consumption tests.
 * Observation only: resolve via resolver, store internally, never influence output.
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
  RUNTIME_CAPABILITY_REGISTRY,
  getRuntimeCapabilityRegistry
} = require("../server/lib/recruitment/runtimeCapabilityRegistryIntegration");
const {
  CAPABILITY_IDS
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");
const {
  getCapability
} = require("../server/lib/recruitment/runtimeCapabilityAccess");
const {
  resolveCapability
} = require("../server/lib/recruitment/runtimeCapabilityResolver");
const {
  CONSUMPTION_PHASE,
  OBSERVED_CAPABILITY_ID,
  observeRuntimeCapability,
  peekObservedRuntimeCapability,
  isRuntimeCapabilityObservation
} = require("../server/lib/recruitment/runtimeCapabilityObservation");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9051,
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
        id: "rec-51",
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

describe("Phase 51 — runtimeCapabilityObservation", () => {
  describe("constants", () => {
    test("exposes consumption phase and observed capability id", () => {
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(OBSERVED_CAPABILITY_ID).toBe("preview_runtime_wiring");
      expect(OBSERVED_CAPABILITY_ID).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("resolver invoked during runtime initialization", () => {
    test("enabled wiring resolves and stores the observed capability internally", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(result);

      expect(observation).not.toBeNull();
      expect(isRuntimeCapabilityObservation(observation)).toBe(true);
      expect(observation.phase).toBe(51);
      expect(observation.observationOnly).toBe(true);
      expect(observation.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(observation.capability).not.toBeNull();
      expect(observation.capability.id).toBe("preview_runtime_wiring");
      expect(observation.capability.phase).toBe(41);
      expect(observation.capability.architectureOnly).toBe(true);
      expect(observation.capability.enabled).toBe(false);
    });

    test("disabled and invalid wiring paths still observe without breaking", () => {
      const disabled = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );
      const invalid = runPreviewRuntimeWiring(null);

      const disabledObs = peekObservedRuntimeCapability(disabled);
      const invalidObs = peekObservedRuntimeCapability(invalid);

      expect(disabledObs).not.toBeNull();
      expect(invalidObs).not.toBeNull();
      expect(disabledObs.capability).toBe(invalidObs.capability);
      expect(disabledObs.capability.id).toBe("preview_runtime_wiring");
      expect(disabled.enabled).toBe(false);
      expect(invalid.enabled).toBe(false);
    });
  });

  describe("existing capability successfully resolved", () => {
    test("observation capability identity matches resolver and access API", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(result);
      const fromResolver = resolveCapability(OBSERVED_CAPABILITY_ID, result);
      const fromAccess = getCapability(OBSERVED_CAPABILITY_ID, result);
      const fromRegistry = result.capabilityRegistry.capabilities.find(
        (c) => c.id === OBSERVED_CAPABILITY_ID
      );

      expect(observation.capability).toBe(fromResolver);
      expect(observation.capability).toBe(fromAccess);
      expect(observation.capability).toBe(fromRegistry);
      expect(observation.capability).toBe(
        getRuntimeCapabilityRegistry().capabilities.find(
          (c) => c.id === OBSERVED_CAPABILITY_ID
        )
      );
    });
  });

  describe("resolved capability stored internally", () => {
    test("observation is not a public enumerable field on the runtime result", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(result.observedCapability).toBeUndefined();
      expect(result.capabilityObservation).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(result, "observedCapability")
      ).toBe(false);
      expect(Object.keys(result)).not.toContain("observedCapability");
      expect(Object.keys(result)).not.toContain("capabilityObservation");
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /preview_runtime_wiring/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const observation = peekObservedRuntimeCapability(result);
      expect(observation).not.toBeNull();
      expect(observation.capability).not.toBeNull();
    });

    test("observeRuntimeCapability is optional and non-breaking on unexpected failure", () => {
      const runtime = { enabled: true, reason: "KEEP" };
      const returned = observeRuntimeCapability(runtime);
      expect(returned).toBe(runtime);
      expect(peekObservedRuntimeCapability(runtime)).not.toBeNull();

      expect(observeRuntimeCapability(null)).toBeNull();
      expect(observeRuntimeCapability(undefined)).toBeUndefined();
      expect(observeRuntimeCapability("x")).toBe("x");
      expect(peekObservedRuntimeCapability(null)).toBeNull();
    });
  });

  describe("runtime output and metadata unchanged", () => {
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
      expect(result.metadata.observedCapability).toBeUndefined();
      expect(result.metadata.capabilityObservation).toBeUndefined();
    });

    test("advisory metadata projection omits observation and capability surfaces", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());

      expect(meta.capabilityRegistry).toBeUndefined();
      expect(meta.observedCapability).toBeUndefined();
      expect(meta.capabilityObservation).toBeUndefined();
      expect(helperMeta.capabilityRegistry).toBeUndefined();
      expect(helperMeta.observedCapability).toBeUndefined();
      expect(meta.enabled).toBe(true);
      expect(meta.wiringPhase).toBe(WIRING_PHASE);
      expect(helperMeta.enabled).toBe(true);
      expect(JSON.stringify(meta)).not.toMatch(/preview_runtime_wiring/);
      expect(JSON.stringify(helperMeta)).not.toMatch(/preview_runtime_wiring/);
    });
  });

  describe("no branching occurs", () => {
    test("wiring and observation never branch on capability state", () => {
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );

      expect(wiring).not.toMatch(/capabilityExists\s*\(/);
      expect(wiring).not.toMatch(/hasCapability\s*\(/);
      expect(wiring).not.toMatch(/isCapabilityAvailable\s*\(/);
      expect(wiring).not.toMatch(/isCapabilityWired\s*\(/);
      expect(wiring).not.toMatch(/isProductionReady\s*\(/);
      expect(wiring).not.toMatch(/\.enabled\s*===/);
      expect(wiring).not.toMatch(/if\s*\(.*peekObservedRuntimeCapability/);
      expect(wiring).not.toMatch(/if\s*\(.*observeRuntimeCapability/);
      expect(wiring).not.toMatch(/observation\.capability/);

      expect(observation).not.toMatch(/capabilityExists\s*\(/);
      expect(observation).not.toMatch(/hasCapability\s*\(/);
      expect(observation).not.toMatch(/isCapabilityAvailable\s*\(/);
      expect(observation).not.toMatch(/isCapabilityWired\s*\(/);
      expect(observation).not.toMatch(/isProductionReady\s*\(/);
      expect(observation).not.toMatch(/capability\.enabled/);
      expect(observation).not.toMatch(/if\s*\(.*capability/);
      expect(observation).toMatch(/observation only/i);
      expect(observation).toMatch(/never used for\s+branching/i);
    });
  });

  describe("backward compatibility", () => {
    test("observation module depends on resolver, validation, and awareness", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      expect(source).toMatch(/Phase 51/);
      expect(source).toMatch(/observation only/i);
      expect(source).toMatch(/WeakMap/);
      expect(source).toMatch(/optional and non-breaking/i);
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
      expect(source).not.toMatch(/createCapabilityRegistry/);
      expect(source).not.toMatch(/runtimeCapabilityRegistryIntegration/);
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistry["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityAccess["']\)/
      );

      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      // Phase 52 adds structural validation of the observed capability only.
      // Phase 53 attaches normalized awareness from that validated observation.
      // Phase 54 attaches a context container from that awareness value.
      // Phase 55 performs a one-time informational read of that context.
      // Phase 56 invokes the no-op preview integration hook after context read.
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
    });

    test("siteWorker is unchanged — no observation or resolver import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityObservation/);
      expect(worker).not.toMatch(/runtimeCapabilityResolver/);
      expect(worker).not.toMatch(/runtimeCapabilityAccess/);
      expect(worker).not.toMatch(/observeRuntimeCapability/);
      expect(worker).not.toMatch(/peekObservedRuntimeCapability/);
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 51/);
        expect(source).not.toMatch(/runtimeCapabilityObservation/);
        expect(source).not.toMatch(/observeRuntimeCapability/);
        expect(source).not.toMatch(/peekObservedRuntimeCapability/);
      }
    });

    test("wiring invokes observation after registry attach without consuming capability APIs directly", () => {
      const source = read("server/lib/recruitment/previewRuntimeWiring.js");
      expect(source).toMatch(/Phase 51/);
      expect(source).toMatch(/runtimeCapabilityObservation/);
      expect(source).toMatch(/observeRuntimeCapability/);
      expect(source).toMatch(/observeRuntimeCapability\s*\(\s*attachRuntimeCapabilityRegistry/);
      expect(source).not.toMatch(/peekObservedRuntimeCapability/);
      expect(source).not.toMatch(/resolveCapability\s*\(/);
      expect(source).not.toMatch(/createRuntimeCapabilityResolver/);
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityResolver["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityAccess["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistry["']\)/
      );
    });
  });
});
