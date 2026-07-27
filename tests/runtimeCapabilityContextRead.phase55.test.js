"use strict";

/**
 * Phase 55 — Preview Runtime Capability Context Read tests.
 * One-time informational context read; no runtime impact.
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
  buildRuntimeCapabilityContext,
  attachRuntimeCapabilityContext,
  peekRuntimeCapabilityContext,
  isRuntimeCapabilityContext
} = require("../server/lib/recruitment/runtimeCapabilityContext");
const {
  READ_PHASE,
  buildRuntimeCapabilityContextRead,
  readRuntimeCapabilityContext,
  peekRuntimeCapabilityContextRead,
  isRuntimeCapabilityContextRead
} = require("../server/lib/recruitment/runtimeCapabilityContextRead");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9055,
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
        id: "rec-55",
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

function contextFixture(overrides = {}) {
  const context = buildRuntimeCapabilityContext({
    phase: 53,
    awarenessOnly: true,
    informational: true,
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

  if (context == null) {
    return null;
  }

  return Object.freeze({
    ...context,
    ...overrides
  });
}

describe("Phase 55 — runtimeCapabilityContextRead", () => {
  describe("constants", () => {
    test("exposes context read phase", () => {
      expect(READ_PHASE).toBe(55);
      expect(CONTEXT_PHASE).toBe(54);
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(OBSERVED_CAPABILITY_ID).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("context successfully read", () => {
    test("live wiring performs one-time context read during initialization", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const context = peekRuntimeCapabilityContext(runtime);
      const contextRead = peekRuntimeCapabilityContextRead(runtime);

      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
      expect(contextRead.phase).toBe(55);
      expect(contextRead.readOnly).toBe(true);
      expect(contextRead.informational).toBe(true);
      expect(contextRead.contextPresent).toBe(true);
      expect(contextRead.contextPhase).toBe(54);
      expect(contextRead.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(contextRead.awarenessPresent).toBe(true);
      expect(contextRead.awarenessPhase).toBe(53);
      expect(contextRead.observationPresent).toBe(true);
      expect(contextRead.validationPresent).toBe(true);
      expect(contextRead.structurallyValid).toBe(true);
      expect(Object.isFrozen(contextRead)).toBe(true);
    });

    test("buildRuntimeCapabilityContextRead derives state only from context", () => {
      const context = contextFixture();
      const contextRead = buildRuntimeCapabilityContextRead(context);

      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
      expect(contextRead).toEqual({
        phase: 55,
        readOnly: true,
        informational: true,
        contextPresent: true,
        contextPhase: 54,
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
      expect(Object.isFrozen(contextRead)).toBe(true);
    });

    test("read consumes existing attached context without rebuilding", () => {
      const runtime = { enabled: true };
      const context = contextFixture();
      attachRuntimeCapabilityContext(runtime, {
        phase: 53,
        awarenessOnly: true,
        informational: true,
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

      const attachedContext = peekRuntimeCapabilityContext(runtime);
      expect(attachedContext).not.toBeNull();

      readRuntimeCapabilityContext(runtime);
      const contextRead = peekRuntimeCapabilityContextRead(runtime);

      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
      expect(contextRead.contextPhase).toBe(54);
      expect(peekRuntimeCapabilityContext(runtime)).toBe(attachedContext);
    });
  });

  describe("missing context handled safely", () => {
    test("returns null when context is missing or malformed", () => {
      expect(buildRuntimeCapabilityContextRead(null)).toBeNull();
      expect(buildRuntimeCapabilityContextRead(undefined)).toBeNull();
      expect(buildRuntimeCapabilityContextRead({})).toBeNull();
      expect(
        buildRuntimeCapabilityContextRead({ contextOnly: false })
      ).toBeNull();
      expect(
        buildRuntimeCapabilityContextRead({
          contextOnly: true,
          informational: false
        })
      ).toBeNull();
      expect(
        buildRuntimeCapabilityContextRead({
          contextOnly: true,
          informational: true,
          awarenessPresent: false
        })
      ).toBeNull();
      expect(buildRuntimeCapabilityContextRead("x")).toBeNull();
      expect(buildRuntimeCapabilityContextRead([])).toBeNull();
    });

    test("peek returns null when read was never stored", () => {
      const runtime = { enabled: true };
      expect(peekRuntimeCapabilityContextRead(runtime)).toBeNull();
      expect(peekRuntimeCapabilityContextRead(null)).toBeNull();
      expect(peekRuntimeCapabilityContextRead(undefined)).toBeNull();
    });

    test("read without context leaves runtime unchanged and read unavailable", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = readRuntimeCapabilityContext(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(peekRuntimeCapabilityContextRead(runtime)).toBeNull();
    });

    test("read failures during observation preserve runtime behavior", () => {
      const runtime = { enabled: true };
      attachRuntimeCapabilityContext(runtime, null);
      expect(peekRuntimeCapabilityContext(runtime)).toBeNull();

      const before = JSON.stringify(runtime);
      observeRuntimeCapability(runtime);

      expect(JSON.stringify(runtime)).toBe(before);
      expect(peekRuntimeCapabilityContextRead(runtime)).not.toBeNull();
    });
  });

  describe("context remains immutable", () => {
    test("context read snapshot is frozen and holds only normalized scalars", () => {
      const contextRead = buildRuntimeCapabilityContextRead(contextFixture());

      expect(Object.isFrozen(contextRead)).toBe(true);
      expect(() => {
        contextRead.capabilityId = "mutated";
      }).toThrow();
      expect(contextRead.capabilityId).toBe("preview_runtime_wiring");

      for (const value of Object.values(contextRead)) {
        expect(
          value === null ||
            typeof value === "boolean" ||
            typeof value === "number" ||
            typeof value === "string"
        ).toBe(true);
      }
    });

    test("context read does not embed live context object graphs", () => {
      const contextRead = buildRuntimeCapabilityContextRead(contextFixture());

      expect(contextRead).not.toHaveProperty("context");
      expect(contextRead).not.toHaveProperty("awareness");
      expect(contextRead).not.toHaveProperty("observation");
      expect(contextRead).not.toHaveProperty("capability");
      expect(Object.keys(contextRead).sort()).toEqual(
        [
          "architectureOnly",
          "available",
          "awarenessPhase",
          "awarenessPresent",
          "capabilityId",
          "capabilityName",
          "capabilityPhase",
          "contextPhase",
          "contextPresent",
          "enabled",
          "informational",
          "observationPresent",
          "phase",
          "productionReady",
          "readOnly",
          "structurallyValid",
          "validationPresent",
          "wired"
        ].sort()
      );
    });
  });

  describe("context is not modified", () => {
    test("read does not mutate the stored context", () => {
      const runtime = { enabled: true };
      attachRuntimeCapabilityContext(runtime, {
        phase: 53,
        awarenessOnly: true,
        informational: true,
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

      const contextBefore = peekRuntimeCapabilityContext(runtime);
      const contextJsonBefore = JSON.stringify(contextBefore);

      readRuntimeCapabilityContext(runtime);

      const contextAfter = peekRuntimeCapabilityContext(runtime);
      expect(contextAfter).toBe(contextBefore);
      expect(JSON.stringify(contextAfter)).toBe(contextJsonBefore);
      expect(Object.isFrozen(contextAfter)).toBe(true);
      expect(contextAfter.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
    });

    test("context module is not rebuilt or reattached during read", () => {
      const readSource = read(
        "server/lib/recruitment/runtimeCapabilityContextRead.js"
      );
      expect(readSource).not.toMatch(/attachRuntimeCapabilityContext/);
      expect(readSource).not.toMatch(/buildRuntimeCapabilityContext\s*\(/);
      expect(readSource).not.toMatch(/buildRuntimeCapabilityAwareness/);
      expect(readSource).not.toMatch(/attachRuntimeCapabilityAwareness/);
      expect(readSource).not.toMatch(/resolveCapability\s*\(/);
    });
  });

  describe("internal storage only", () => {
    test("context read is not a public enumerable field on the runtime result", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(result.capabilityContextRead).toBeUndefined();
      expect(result.runtimeCapabilityContextRead).toBeUndefined();
      expect(result.contextRead).toBeUndefined();
      expect(result.readOnly).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(result, "capabilityContextRead")
      ).toBe(false);
      expect(Object.keys(result)).not.toContain("capabilityContextRead");
      expect(Object.keys(result)).not.toContain("runtimeCapabilityContextRead");
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /contextPresent|contextRead|READ_PHASE/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const contextRead = peekRuntimeCapabilityContextRead(result);
      expect(contextRead).not.toBeNull();
      expect(contextRead.readOnly).toBe(true);
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
      expect(result.capabilityContextRead).toBeUndefined();
      expect(result.runtimeCapabilityContextRead).toBeUndefined();
      expect(Object.keys(result)).not.toContain("capabilityContextRead");
      expect(Object.keys(result)).not.toContain("runtimeCapabilityContextRead");
    });

    test("context read failures do not alter runtime outputs", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = observeRuntimeCapability(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(runtime.capabilityContextRead).toBeUndefined();
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
      expect(disabled.capabilityContextRead).toBeUndefined();
      expect(invalid.capabilityContextRead).toBeUndefined();
    });
  });

  describe("metadata unchanged", () => {
    test("context read is never projected into advisory metadata or worker helpers", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(meta.capabilityContextRead).toBeUndefined();
      expect(meta.runtimeCapabilityContextRead).toBeUndefined();
      expect(meta.contextPresent).toBeUndefined();
      expect(helperMeta.capabilityContextRead).toBeUndefined();
      expect(helperMeta.runtimeCapabilityContextRead).toBeUndefined();
      expect(result.metadata.capabilityContextRead).toBeUndefined();
      expect(result.metadata.runtimeCapabilityContextRead).toBeUndefined();
      expect(JSON.stringify(meta)).not.toMatch(
        /capabilityContextRead|runtimeCapabilityContextRead|contextPresent|readOnly/
      );
      expect(JSON.stringify(helperMeta)).not.toMatch(
        /capabilityContextRead|runtimeCapabilityContextRead|contextPresent|readOnly/
      );
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /contextPresent|contextRead/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const contextRead = peekRuntimeCapabilityContextRead(result);
      expect(contextRead).not.toBeNull();
      expect(contextRead.contextPresent).toBe(true);
    });
  });

  describe("no branching or enablement", () => {
    test("context read never drives branching and never rebuilds context", () => {
      const readSource = read(
        "server/lib/recruitment/runtimeCapabilityContextRead.js"
      );
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const context = read(
        "server/lib/recruitment/runtimeCapabilityContext.js"
      );

      expect(readSource).toMatch(/Phase 55/);
      expect(readSource).toMatch(/Read-only/i);
      expect(readSource).toMatch(/WeakMap/);
      expect(readSource).toMatch(/normalized immutable/i);
      expect(readSource).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(readSource).not.toMatch(/if\s*\(\s*read\.structurallyValid/);
      expect(readSource).not.toMatch(/if\s*\(\s*context\.structurallyValid/);
      expect(readSource).not.toMatch(/enabled\s*===\s*true/);
      expect(readSource).not.toMatch(/resolveCapability\s*\(/);
      expect(readSource).not.toMatch(/attachRuntimeCapabilityContext/);
      expect(readSource).not.toMatch(/buildRuntimeCapabilityContext\s*\(/);

      expect(observation).toMatch(/Phase 55/);
      expect(observation).toMatch(/readRuntimeCapabilityContext/);
      expect(observation).not.toMatch(/if\s*\(\s*read/);
      expect(observation).not.toMatch(/peekRuntimeCapabilityContext\s*\(/);
      expect(observation).not.toMatch(/read\.enabled/);

      expect(wiring).not.toMatch(/runtimeCapabilityContextRead/);
      expect(wiring).not.toMatch(/readRuntimeCapabilityContext/);
      expect(wiring).not.toMatch(/peekRuntimeCapabilityContextRead/);
      expect(wiring).not.toMatch(/if\s*\(\s*read/);

      expect(context).not.toMatch(/runtimeCapabilityContextRead/);
      expect(context).not.toMatch(/Phase 55/);
    });
  });

  describe("backward compatibility", () => {
    test("context read module only requires context peek — no registry / access / resolver", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityContextRead.js"
      );
      expect(source).toMatch(/Phase 55/);
      expect(source).toMatch(/peek only|Read-only/i);
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
      expect(requires).toEqual(["./runtimeCapabilityContext"]);
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

    test("siteWorker is unchanged — no context read import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityContextRead/);
      expect(worker).not.toMatch(/readRuntimeCapabilityContext/);
      expect(worker).not.toMatch(/peekRuntimeCapabilityContextRead/);
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 55/);
        expect(source).not.toMatch(/runtimeCapabilityContextRead/);
        expect(source).not.toMatch(/readRuntimeCapabilityContext/);
        expect(source).not.toMatch(/peekRuntimeCapabilityContextRead/);
        expect(source).not.toMatch(/buildRuntimeCapabilityContextRead/);
      }
    });

    test("context module still has no awareness / observation requires after Phase 55 wiring", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityContext.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
      expect(source).not.toMatch(/runtimeCapabilityContextRead/);
    });

    test("observation chains context attach then one-time read without peek in wiring", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(runtime);
      const context = peekRuntimeCapabilityContext(runtime);
      const contextRead = peekRuntimeCapabilityContextRead(runtime);

      expect(observation).not.toBeNull();
      expect(isRuntimeCapabilityContext(context)).toBe(true);
      expect(isRuntimeCapabilityContextRead(contextRead)).toBe(true);
      expect(contextRead.contextPhase).toBe(context.phase);
      expect(contextRead.capabilityId).toBe(context.capabilityId);
    });
  });
});
