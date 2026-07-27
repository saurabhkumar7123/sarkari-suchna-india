"use strict";

/**
 * Phase 52 — Runtime Capability Validation tests.
 * Structural validation of the observed capability only; informational; no runtime impact.
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
  peekObservedRuntimeCapabilityValidation,
  isRuntimeCapabilityObservation
} = require("../server/lib/recruitment/runtimeCapabilityObservation");
const {
  VALIDATION_PHASE,
  REQUIRED_STRUCTURAL_FIELDS,
  VALIDATION_REASONS,
  validateObservedCapability,
  normalizeValidationResult,
  isRuntimeCapabilityValidationResult
} = require("../server/lib/recruitment/runtimeCapabilityValidation");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9052,
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
        id: "rec-52",
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

function validCapabilityFixture(overrides = {}) {
  return {
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
    ...overrides
  };
}

describe("Phase 52 — runtimeCapabilityValidation", () => {
  describe("constants", () => {
    test("exposes validation phase and structural field list", () => {
      expect(VALIDATION_PHASE).toBe(52);
      expect(CONSUMPTION_PHASE).toBe(51);
      expect(REQUIRED_STRUCTURAL_FIELDS).toEqual([
        "id",
        "name",
        "phase",
        "description",
        "available",
        "wired",
        "enabled",
        "architectureOnly",
        "productionReady",
        "dependencies"
      ]);
      expect(VALIDATION_REASONS.VALID).toBe("VALID");
      expect(VALIDATION_REASONS.MISSING_CAPABILITY).toBe("MISSING_CAPABILITY");
    });
  });

  describe("valid capability", () => {
    test("accepts a structurally complete observed capability", () => {
      const capability = validCapabilityFixture();
      const result = validateObservedCapability(
        capability,
        "preview_runtime_wiring"
      );

      expect(isRuntimeCapabilityValidationResult(result)).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validationOnly).toBe(true);
      expect(result.informational).toBe(true);
      expect(result.phase).toBe(52);
      expect(result.expectedCapabilityId).toBe("preview_runtime_wiring");
      expect(result.capabilityId).toBe("preview_runtime_wiring");
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([VALIDATION_REASONS.VALID]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.errors)).toBe(true);
      expect(Object.isFrozen(result.reasons)).toBe(true);
    });

    test("live wiring observation validates successfully", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const observation = peekObservedRuntimeCapability(runtime);
      const validation = peekObservedRuntimeCapabilityValidation(runtime);

      expect(isRuntimeCapabilityObservation(observation)).toBe(true);
      expect(observation.validation).toBe(validation);
      expect(isRuntimeCapabilityValidationResult(validation)).toBe(true);
      expect(validation.valid).toBe(true);
      expect(validation.capabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(validation.expectedCapabilityId).toBe(OBSERVED_CAPABILITY_ID);
      expect(validation.errors).toEqual([]);
      expect(observation.capability.id).toBe(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
    });
  });

  describe("missing capability", () => {
    test("reports missing capability without throwing", () => {
      const result = validateObservedCapability(
        null,
        "preview_runtime_wiring"
      );

      expect(result.valid).toBe(false);
      expect(result.capabilityId).toBeNull();
      expect(result.errors).toContain("capability does not exist");
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_CAPABILITY);
      expect(result.validationOnly).toBe(true);
      expect(result.informational).toBe(true);
    });

    test("treats undefined the same as missing", () => {
      const result = validateObservedCapability(
        undefined,
        OBSERVED_CAPABILITY_ID
      );
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_CAPABILITY);
    });
  });

  describe("malformed capability", () => {
    test("rejects non-object capability metadata", () => {
      const result = validateObservedCapability(
        "not-a-capability",
        "preview_runtime_wiring"
      );

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.INVALID_CAPABILITY);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_METADATA);
      expect(result.errors[0]).toMatch(/plain object/i);
    });

    test("rejects arrays as capability metadata", () => {
      const result = validateObservedCapability(
        [{ id: "preview_runtime_wiring" }],
        "preview_runtime_wiring"
      );
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_METADATA);
    });

    test("reports missing identifier and required fields", () => {
      const result = validateObservedCapability(
        { name: "Incomplete" },
        "preview_runtime_wiring"
      );

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_IDENTIFIER);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      expect(result.errors.some((e) => /missing required capability field: id/.test(e))).toBe(
        true
      );
      expect(
        result.errors.some((e) =>
          /missing required capability field: dependencies/.test(e)
        )
      ).toBe(true);
    });

    test("reports identifier mismatch without validating business flags", () => {
      const result = validateObservedCapability(
        validCapabilityFixture({
          id: "some_other_capability",
          enabled: true,
          productionReady: true,
          architectureOnly: false
        }),
        "preview_runtime_wiring"
      );

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.IDENTIFIER_MISMATCH);
      expect(result.reasons).not.toContain(VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      expect(result.errors[0]).toMatch(/identifier mismatch/i);
      // Structural only: business values are ignored even when "wrong".
      expect(JSON.stringify(result.errors)).not.toMatch(/enabled must be false/i);
      expect(JSON.stringify(result.errors)).not.toMatch(/architectureOnly must be true/i);
    });

    test("reports undefined required fields as structural failures", () => {
      const result = validateObservedCapability(
        validCapabilityFixture({ description: undefined }),
        "preview_runtime_wiring"
      );

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      expect(result.errors.some((e) => /undefined: description/.test(e))).toBe(
        true
      );
    });
  });

  describe("normalized validation result", () => {
    test("normalizeValidationResult freezes a stable informational shape", () => {
      const result = normalizeValidationResult({
        valid: true,
        expectedCapabilityId: "preview_runtime_wiring",
        capabilityId: "preview_runtime_wiring",
        errors: [],
        reasons: []
      });

      expect(isRuntimeCapabilityValidationResult(result)).toBe(true);
      expect(result).toEqual({
        phase: 52,
        validationOnly: true,
        informational: true,
        valid: true,
        expectedCapabilityId: "preview_runtime_wiring",
        capabilityId: "preview_runtime_wiring",
        errors: [],
        reasons: [VALIDATION_REASONS.VALID]
      });
      expect(Object.isFrozen(result)).toBe(true);
    });

    test("invalid results never claim VALID when errors exist", () => {
      const result = normalizeValidationResult({
        valid: true,
        expectedCapabilityId: "x",
        capabilityId: null,
        errors: ["capability does not exist"],
        reasons: [VALIDATION_REASONS.MISSING_CAPABILITY]
      });

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(VALIDATION_REASONS.MISSING_CAPABILITY);
      expect(result.reasons).not.toContain(VALIDATION_REASONS.VALID);
    });
  });

  describe("validator never throws", () => {
    test("validateObservedCapability never throws on hostile inputs", () => {
      const hostiles = [
        null,
        undefined,
        "",
        0,
        false,
        [],
        { id: 123 },
        Object.create(null),
        { get id() { throw new Error("boom"); } }
      ];

      for (const input of hostiles) {
        expect(() =>
          validateObservedCapability(input, "preview_runtime_wiring")
        ).not.toThrow();
        const result = validateObservedCapability(
          input,
          "preview_runtime_wiring"
        );
        expect(isRuntimeCapabilityValidationResult(result)).toBe(true);
        expect(typeof result.valid).toBe("boolean");
      }
    });

    test("observation path never throws when validation is attached", () => {
      expect(() => observeRuntimeCapability({ enabled: true })).not.toThrow();
      expect(() => observeRuntimeCapability(null)).not.toThrow();
      expect(() => runPreviewRuntimeWiring(eligibleInput())).not.toThrow();
      expect(() => runPreviewRuntimeWiring(null)).not.toThrow();
    });
  });

  describe("runtime behavior unchanged", () => {
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
      expect(result.metadata.capabilityValidation).toBeUndefined();
      expect(result.metadata.validation).toBeUndefined();
      expect(result.capabilityValidation).toBeUndefined();
      expect(result.validation).toBeUndefined();
      expect(Object.keys(result)).not.toContain("capabilityValidation");
      expect(Object.keys(result)).not.toContain("validation");
    });

    test("validation is internal only — never projected into advisory metadata", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());
      const { capabilityRegistry, ...publicWithoutRegistry } = result;

      expect(meta.capabilityValidation).toBeUndefined();
      expect(meta.validation).toBeUndefined();
      expect(helperMeta.capabilityValidation).toBeUndefined();
      expect(helperMeta.validation).toBeUndefined();
      expect(JSON.stringify(meta)).not.toMatch(/capabilityValidation|VALIDATION_PHASE|validationOnly/);
      expect(JSON.stringify(helperMeta)).not.toMatch(
        /capabilityValidation|validationOnly/
      );
      expect(JSON.stringify(publicWithoutRegistry)).not.toMatch(
        /validationOnly|"valid":true/
      );
      expect(capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      const validation = peekObservedRuntimeCapabilityValidation(result);
      expect(validation).not.toBeNull();
      expect(validation.valid).toBe(true);
    });

    test("validation failures do not alter runtime outputs", () => {
      const runtime = { enabled: true, reason: "KEEP", metadata: { ok: true } };
      const before = JSON.stringify(runtime);
      const returned = observeRuntimeCapability(runtime);

      expect(returned).toBe(runtime);
      expect(JSON.stringify(runtime)).toBe(before);
      expect(runtime.enabled).toBe(true);
      expect(runtime.reason).toBe("KEEP");
      expect(runtime.metadata).toEqual({ ok: true });
      expect(runtime.validation).toBeUndefined();
      expect(peekObservedRuntimeCapabilityValidation(runtime)).not.toBeNull();
    });
  });

  describe("no branching or enablement", () => {
    test("observation never branches on validation outcome", () => {
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const validation = read(
        "server/lib/recruitment/runtimeCapabilityValidation.js"
      );

      expect(observation).toMatch(/Phase 52/);
      expect(observation).toMatch(/validateObservedCapability/);
      expect(observation).not.toMatch(/if\s*\(\s*validation/);
      expect(observation).not.toMatch(/validation\.valid/);
      expect(observation).not.toMatch(/capability\.enabled/);
      expect(observation).not.toMatch(/console\.(log|info|warn|error|debug)/);

      expect(wiring).not.toMatch(/runtimeCapabilityValidation/);
      expect(wiring).not.toMatch(/validateObservedCapability/);
      expect(wiring).not.toMatch(/peekObservedRuntimeCapabilityValidation/);
      expect(wiring).not.toMatch(/if\s*\(\s*validation/);

      expect(validation).toMatch(/informational only/i);
      expect(validation).toMatch(/Never throws/i);
      expect(validation).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(validation).not.toMatch(/capability\.enabled\s*===/);
      expect(validation).not.toMatch(/architectureOnly must be true/);
    });
  });

  describe("backward compatibility", () => {
    test("validation module has no registry / access / resolver / worker dependencies", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityValidation.js"
      );
      expect(source).toMatch(/Phase 52/);
      expect(source).toMatch(/structural/i);
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
    });

    test("observation depends on resolver, validation, awareness, and context", () => {
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
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityRegistry["']\)/
      );
      expect(source).not.toMatch(
        /require\(["']\.\/runtimeCapabilityAccess["']\)/
      );
    });

    test("siteWorker is unchanged — no validation import", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityValidation/);
      expect(worker).not.toMatch(/validateObservedCapability/);
      expect(worker).not.toMatch(/peekObservedRuntimeCapabilityValidation/);
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 52/);
        expect(source).not.toMatch(/runtimeCapabilityValidation/);
        expect(source).not.toMatch(/validateObservedCapability/);
        expect(source).not.toMatch(/peekObservedRuntimeCapabilityValidation/);
      }
    });
  });
});
