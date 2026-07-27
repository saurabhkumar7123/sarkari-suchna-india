"use strict";

/**
 * Phase 53 — Preview Runtime Capability Awareness tests.
 * Informational awareness from validated observation only; no runtime impact.
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
  peekObservedRuntimeCapability,
  peekObservedRuntimeCapabilityValidation
} = require("../server/lib/recruitment/runtimeCapabilityObservation");
const {
  VALIDATION_PHASE,
  validateObservedCapability
} = require("../server/lib/recruitment/runtimeCapabilityValidation");
const {
  AWARENESS_PHASE,
  buildRuntimeCapabilityAwareness,
  attachRuntimeCapabilityAwareness,
  peekRuntimeCapabilityAwareness,
  isRuntimeCapabilityAwareness
} = require("../server/lib/recruitment/runtimeCapabilityAwareness");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9053,
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
        id: "rec-53",
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

function validatedObservationFixture(overrides = {}) {
  const capability =
    overrides.capability === null
      ? null
      : {
          id: "preview_runtime_wiring",
          name: "Preview-First Runtime Wiring",
          phase: 41,
          description: "Observation-only wiring capability fixture.",
          available: true,
          wired: true,
          enabled: false,
          architectureOnly: true,
          productionReady: false,
          dependencies: ["execution_context"],
          ...(overrides.capability && typeof overrides.capability === "object"
            ? overrides.capability
            : {})
        };

  const validation =
    Object.prototype.hasOwnProperty.call(overrides, "validation")
      ? overrides.validation
      : validateObservedCapability(capability, OBSERVED_CAPABILITY_ID);

  return {
    phase: CONSUMPTION_PHASE,
    observationOnly: true,
    capabilityId: OBSERVED_CAPABILITY_ID,
    ...overrides,
    capability,
    validation
  };
}

describe("Phase 53 — runtimeCapabilityAwareness", () => {
  describe("constants", () => {
    test("exposes awareness phase", () => {
      expect(AWARENESS_PHASE).toBe(53);
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(VALIDATION_PHASE).toBe(52);
      expect(OBSERVED_CAPABILITY_ID).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("awareness created from validated observation", () => {
    test("live wiring builds awareness from the internal validated observation", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(runtime);
      const validation = peekObservedRuntimeCapabilityValidation(runtime);
      const awareness = peekRuntimeCapabilityAwareness(runtime);

      expect(observation).not.toBeNull();
      expect(validation).not.toBeNull();
      expect(validation.valid).toBe(true);
      expect(isRuntimeCapabilityAwareness(awareness)).toBe(true);
      expect(awareness.phase).toBe(53);
      expect(awareness.awarenessOnly).toBe(true);
      expect(awareness.informational).toBe(true);
      expect(awareness.observationPresent).toBe(true);
      expect(awareness.validationPresent).toBe(true);
      expect(awareness.structurallyValid).toBe(true);
      expect(awareness.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(Object.isFrozen(awareness)).toBe(true);
    });

    test("buildRuntimeCapabilityAwareness derives state only from the observation", () => {
      const observation = validatedObservationFixture();
      const awareness = buildRuntimeCapabilityAwareness(observation);

      expect(isRuntimeCapabilityAwareness(awareness)).toBe(true);
      expect(awareness).toEqual({
        phase: 53,
        awarenessOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring",
        observationPresent: true,
        observationPhase: 51,
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
      expect(Object.isFrozen(awareness)).toBe(true);
    });
  });

  describe("awareness unavailable when observation absent", () => {
    test("returns null when observation is missing or malformed", () => {
      expect(buildRuntimeCapabilityAwareness(null)).toBeNull();
      expect(buildRuntimeCapabilityAwareness(undefined)).toBeNull();
      expect(buildRuntimeCapabilityAwareness({})).toBeNull();
      expect(
        buildRuntimeCapabilityAwareness({ observationOnly: false })
      ).toBeNull();
      expect(buildRuntimeCapabilityAwareness("x")).toBeNull();
      expect(buildRuntimeCapabilityAwareness([])).toBeNull();
    });

    test("peek returns null when awareness was never attached", () => {
      const runtime = { enabled: true };
      expect(peekRuntimeCapabilityAwareness(runtime)).toBeNull();
      expect(peekRuntimeCapabilityAwareness(null)).toBeNull();
      expect(peekRuntimeCapabilityAwareness(undefined)).toBeNull();
    });

    test("attach without a valid observation leaves awareness unavailable", () => {
      const runtime = { enabled: true };
      attachRuntimeCapabilityAwareness(runtime, null);
      expect(peekRuntimeCapabilityAwareness(runtime)).toBeNull();

      attachRuntimeCapabilityAwareness(runtime, { observationOnly: false });
      expect(peekRuntimeCapabilityAwareness(runtime)).toBeNull();
    });
  });

  describe("normalized awareness state", () => {
    test("normalizes missing capability fields to null without throwing", () => {
      const awareness = buildRuntimeCapabilityAwareness({
        phase: 51,
        observationOnly: true,
        capabilityId: "preview_runtime_wiring",
        capability: null,
        validation: { valid: false, phase: 52 }
      });

      expect(isRuntimeCapabilityAwareness(awareness)).toBe(true);
      expect(awareness.capabilityId).toBe("preview_runtime_wiring");
      expect(awareness.validationPresent).toBe(true);
      expect(awareness.structurallyValid).toBe(false);
      expect(awareness.available).toBeNull();
      expect(awareness.wired).toBeNull();
      expect(awareness.enabled).toBeNull();
      expect(awareness.architectureOnly).toBeNull();
      expect(awareness.productionReady).toBeNull();
      expect(awareness.capabilityName).toBeNull();
      expect(awareness.capabilityPhase).toBeNull();
    });

    test("records structural validity from observation validation only", () => {
      const invalid = buildRuntimeCapabilityAwareness(
        validatedObservationFixture({
          capability: { id: "other" },
          validation: validateObservedCapability(
            { id: "other", name: "x" },
            OBSERVED_CAPABILITY_ID
          )
        })
      );

      expect(invalid.structurallyValid).toBe(false);
      expect(invalid.validationPresent).toBe(true);
      expect(invalid.awarenessOnly).toBe(true);
      expect(invalid.informational).toBe(true);
    });
  });

  describe("internal storage only", () => {
    test("awareness is not a public enumerable field on the runtime result", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(result.awareness).toBeUndefined();
      expect(result.capabilityAwareness).toBeUndefined();
      expect(result.runtimeCapabilityAwareness).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(result, "capabilityAwareness")
      ).toBe(false);
      expect(Object.keys(result)).not.toContain("awareness");
      expect(Object.keys(result)).not.toContain("capabilityAwareness");
      expect(Object.keys(result)).not.toContain("runtimeCapabilityAwareness");
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /awarenessOnly|structurallyValid|AWARENESS_PHASE/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const awareness = peekRuntimeCapabilityAwareness(result);
      expect(awareness).not.toBeNull();
      expect(awareness.awarenessOnly).toBe(true);
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
      expect(result.metadata.capabilityAwareness).toBeUndefined();
      expect(result.metadata.awareness).toBeUndefined();
      expect(result.capabilityAwareness).toBeUndefined();
      expect(result.awareness).toBeUndefined();
      expect(Object.keys(result)).not.toContain("capabilityAwareness");
      expect(Object.keys(result)).not.toContain("awareness");
    });

    test("awareness is never projected into advisory metadata or worker helpers", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(meta.capabilityAwareness).toBeUndefined();
      expect(meta.awareness).toBeUndefined();
      expect(helperMeta.capabilityAwareness).toBeUndefined();
      expect(helperMeta.awareness).toBeUndefined();
      expect(JSON.stringify(meta)).not.toMatch(
        /capabilityAwareness|awarenessOnly|structurallyValid/
      );
      expect(JSON.stringify(helperMeta)).not.toMatch(
        /capabilityAwareness|awarenessOnly|structurallyValid/
      );
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /awarenessOnly|structurallyValid/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const awareness = peekRuntimeCapabilityAwareness(result);
      expect(awareness).not.toBeNull();
      expect(awareness.structurallyValid).toBe(true);
    });

    test("awareness attach failures do not alter runtime outputs", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = observeRuntimeCapability(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(runtime.awareness).toBeUndefined();
      expect(peekRuntimeCapabilityAwareness(runtime)).not.toBeNull();
    });

    test("disabled and invalid wiring paths still continue existing behavior", () => {
      const disabled = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );
      const invalid = runPreviewRuntimeWiring(null);

      expect(disabled.enabled).toBe(false);
      expect(invalid.enabled).toBe(false);
      expect(peekRuntimeCapabilityAwareness(disabled)).not.toBeNull();
      expect(peekRuntimeCapabilityAwareness(invalid)).not.toBeNull();
      expect(disabled.awareness).toBeUndefined();
      expect(invalid.awareness).toBeUndefined();
    });
  });

  describe("no branching or enablement", () => {
    test("awareness never drives branching and observation never consumes awareness state", () => {
      const awareness = read(
        "server/lib/recruitment/runtimeCapabilityAwareness.js"
      );
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");

      expect(awareness).toMatch(/Phase 53/);
      expect(awareness).toMatch(/informational only/i);
      expect(awareness).toMatch(/WeakMap/);
      expect(awareness).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(awareness).not.toMatch(/if\s*\(\s*awareness\.structurallyValid/);
      expect(awareness).not.toMatch(/enabled\s*===\s*true/);
      expect(awareness).not.toMatch(/resolveCapability\s*\(/);

      expect(observation).toMatch(/Phase 53/);
      expect(observation).toMatch(/attachRuntimeCapabilityAwareness/);
      expect(observation).not.toMatch(/if\s*\(\s*awareness/);
      expect(observation).not.toMatch(/peekRuntimeCapabilityAwareness/);
      expect(observation).not.toMatch(/structurallyValid/);
      expect(observation).not.toMatch(/awareness\.enabled/);

      expect(wiring).not.toMatch(/runtimeCapabilityAwareness/);
      expect(wiring).not.toMatch(/attachRuntimeCapabilityAwareness/);
      expect(wiring).not.toMatch(/peekRuntimeCapabilityAwareness/);
      expect(wiring).not.toMatch(/if\s*\(\s*awareness/);
    });
  });

  describe("backward compatibility", () => {
    test("awareness module has no registry / access / resolver dependencies", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityAwareness.js"
      );
      expect(source).toMatch(/Phase 53/);
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
    });

    test("siteWorker is unchanged — no awareness import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityAwareness/);
      expect(worker).not.toMatch(/attachRuntimeCapabilityAwareness/);
      expect(worker).not.toMatch(/peekRuntimeCapabilityAwareness/);
      expect(worker).not.toMatch(/runtimeCapabilityObservation/);
      expect(worker).not.toMatch(/runtimeCapabilityValidation/);
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 53/);
        expect(source).not.toMatch(/runtimeCapabilityAwareness/);
        expect(source).not.toMatch(/attachRuntimeCapabilityAwareness/);
        expect(source).not.toMatch(/peekRuntimeCapabilityAwareness/);
        expect(source).not.toMatch(/buildRuntimeCapabilityAwareness/);
      }
    });
  });
});
