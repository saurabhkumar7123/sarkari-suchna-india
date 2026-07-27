"use strict";

/**
 * Phase 48 — Runtime Capability Registry Integration tests.
 * Read-only attachment: registry exposed on runtime object, never consumed.
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
  attachRuntimeCapabilityRegistry,
  peekAttachedCapabilityRegistry,
  isReadOnlyRegistryAttachment
} = require("../server/lib/recruitment/runtimeCapabilityRegistryIntegration");
const {
  CAPABILITY_REGISTRY_PHASE,
  createCapabilityRegistry,
  isCapabilityRegistryArchitectureOnly,
  summarizeCapabilityRegistry
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9048,
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
        id: "rec-48",
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

function stripCapabilityRegistry(result) {
  if (result == null || typeof result !== "object") {
    return result;
  }
  const { capabilityRegistry, ...rest } = result;
  return rest;
}

describe("Phase 48 — runtimeCapabilityRegistryIntegration", () => {
  describe("constants and singleton", () => {
    test("exposes integration phase and shared registry identity", () => {
      expect(INTEGRATION_PHASE).toBe(48);
      expect(getRuntimeCapabilityRegistry()).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(RUNTIME_CAPABILITY_REGISTRY.phase).toBe(CAPABILITY_REGISTRY_PHASE);
      expect(isCapabilityRegistryArchitectureOnly(RUNTIME_CAPABILITY_REGISTRY)).toBe(
        true
      );
    });

    test("attach preserves registry object identity and existing fields", () => {
      const source = { enabled: true, reason: "KEEP_ME", nested: { a: 1 } };
      const attached = attachRuntimeCapabilityRegistry(source);

      expect(attached.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(attached.enabled).toBe(true);
      expect(attached.reason).toBe("KEEP_ME");
      expect(attached.nested).toBe(source.nested);
      expect(source.capabilityRegistry).toBeUndefined();
      expect(isReadOnlyRegistryAttachment(attached)).toBe(true);
      expect(peekAttachedCapabilityRegistry(attached)).toBe(
        RUNTIME_CAPABILITY_REGISTRY
      );
    });

    test("attach on null / non-object still yields the shared registry", () => {
      for (const bad of [null, undefined, "x", 1, true, []]) {
        const attached = attachRuntimeCapabilityRegistry(bad);
        expect(attached.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);
        expect(isReadOnlyRegistryAttachment(attached)).toBe(true);
      }
    });
  });

  describe("registry is attached to central runtime init", () => {
    test("enabled wiring result exposes the shared capability registry", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());

      expect(result.enabled).toBe(true);
      expect(result.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);
      expect(result.capabilityRegistry).toBe(getRuntimeCapabilityRegistry());
      expect(isCapabilityRegistryArchitectureOnly(result.capabilityRegistry)).toBe(
        true
      );
      expect(result.capabilityRegistry.architectureOnly).toBe(true);
      expect(result.capabilityRegistry.advisory).toBe(true);
      expect(result.capabilityRegistry.metadata.executed).toBe(false);
      expect(result.capabilityRegistry.metadata.persistenceEnabled).toBe(false);
    });

    test("disabled / invalid wiring results still attach the same registry", () => {
      const disabled = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );
      const invalid = runPreviewRuntimeWiring(null);

      expect(disabled.enabled).toBe(false);
      expect(disabled.reason).toBe(WIRING_REASONS.DISABLED);
      expect(disabled.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      expect(invalid.enabled).toBe(false);
      expect(invalid.reason).toBe(WIRING_REASONS.INVALID_INPUT);
      expect(invalid.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);

      expect(disabled.capabilityRegistry).toBe(invalid.capabilityRegistry);
    });

    test("repeated runtime initializations preserve registry object identity", () => {
      const a = runPreviewRuntimeWiring(eligibleInput());
      const b = runPreviewRuntimeWiring(eligibleInput({ updateId: 9049 }));
      const c = runPreviewRuntimeWiring({ enabled: false });

      expect(a.capabilityRegistry).toBe(b.capabilityRegistry);
      expect(b.capabilityRegistry).toBe(c.capabilityRegistry);
      expect(a.capabilityRegistry).toBe(RUNTIME_CAPABILITY_REGISTRY);
    });
  });

  describe("runtime remains backward compatible — behavior unchanged", () => {
    test("existing wiring fields and decisions match Phase 41 behavior", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());

      expect(result.enabled).toBe(true);
      expect(result.observationOnly).toBe(true);
      expect(result.architectureOnly).toBe(true);
      expect(result.sideEffects).toBe(false);
      expect(result.reason).toBe(WIRING_REASONS.ENABLED);
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

    test("advisory metadata projected to workers omits capabilityRegistry", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const meta = toPreviewAdvisoryMetadata(result);
      const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());

      expect(meta.capabilityRegistry).toBeUndefined();
      expect(helperMeta.capabilityRegistry).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(meta, "capabilityRegistry")).toBe(
        false
      );
      expect(meta.enabled).toBe(true);
      expect(meta.wiringPhase).toBe(WIRING_PHASE);
      expect(meta.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(meta.observationOnly).toBe(true);
      expect(helperMeta.enabled).toBe(true);
      expect(helperMeta.wiringPhase).toBe(WIRING_PHASE);
    });

    test("stripping the attachment leaves a classic wiring result shape", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const classic = stripCapabilityRegistry(result);

      expect(classic.capabilityRegistry).toBeUndefined();
      expect(classic.enabled).toBe(true);
      expect(classic.context).toEqual(result.context);
      expect(classic.policyDecision).toEqual(result.policyDecision);
      expect(classic.persistenceOutcome).toEqual(result.persistenceOutcome);
      expect(classic.executionPlan).toEqual(result.executionPlan);
      expect(classic.transactionPlan).toEqual(result.transactionPlan);
      expect(classic.auditEvents).toEqual(result.auditEvents);
      expect(classic.metadata).toEqual(result.metadata);
    });

    test("runtime does not branch on or consume capability state", () => {
      const source = read(
        "server/lib/recruitment/previewRuntimeWiring.js"
      );
      const integration = read(
        "server/lib/recruitment/runtimeCapabilityRegistryIntegration.js"
      );

      expect(source).not.toMatch(/hasCapability\s*\(/);
      expect(source).not.toMatch(/isCapabilityAvailable\s*\(/);
      expect(source).not.toMatch(/isCapabilityWired\s*\(/);
      expect(source).not.toMatch(/isProductionReady\s*\(/);
      expect(source).not.toMatch(/listCapabilities\s*\(/);
      expect(source).not.toMatch(/summarizeCapabilityRegistry\s*\(/);
      expect(source).not.toMatch(/getCapability\s*\(/);
      expect(source).not.toMatch(/capabilityRegistry\.(enabled|wired|available)/);
      expect(source).not.toMatch(/if\s*\(.*capabilityRegistry/);

      expect(integration).not.toMatch(/hasCapability\s*\(/);
      expect(integration).not.toMatch(/isCapabilityAvailable\s*\(/);
      expect(integration).not.toMatch(/isCapabilityWired\s*\(/);
      expect(integration).not.toMatch(/isProductionReady\s*\(/);
      expect(integration).not.toMatch(/listCapabilities\s*\(/);
      expect(integration).not.toMatch(/summarizeCapabilityRegistry\s*\(/);
      expect(integration).toMatch(/never consumes capabilities/i);
      expect(integration).toMatch(/never branches/i);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("integration module is read-only and side-effect free", () => {
      const source = read(
        "server/lib/recruitment/runtimeCapabilityRegistryIntegration.js"
      );
      expect(source).toMatch(/Phase 48/);
      expect(source).toMatch(/read-only/i);
      expect(source).toMatch(/never consumes capabilities/i);
      expect(source).toMatch(/never branches/i);
      expect(source).toMatch(/Never writes to database/);
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

      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./runtimeCapabilityRegistry"]);
    });

    test("siteWorker is unchanged — no direct registry import or branching", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityRegistry/);
      expect(worker).not.toMatch(/runtimeCapabilityRegistryIntegration/);
      expect(worker).not.toMatch(/createCapabilityRegistry/);
      expect(worker).not.toMatch(/attachRuntimeCapabilityRegistry/);
      expect(worker).not.toMatch(/capabilityRegistry/);
      expect(worker).toMatch(/buildPreviewLifecycleArchitecture/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("adapters, pipelines, and enablement are not modified by Phase 48", () => {
      const files = {
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js":
          /Phase 36/,
        "server/lib/recruitment/persistenceExecutionPipeline.js": /Phase 37/,
        "server/lib/recruitment/persistenceEnablement.js": /Phase 44/,
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js":
          /Phase 45/,
        "server/lib/recruitment/executionDiagnostics.js": /Phase 46/,
        "server/lib/recruitment/runtimeCapabilityRegistry.js": /Phase 47/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/executionContext.js": /Phase 40/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 48/);
        expect(source).not.toMatch(/runtimeCapabilityRegistryIntegration/);
        expect(source).not.toMatch(/attachRuntimeCapabilityRegistry/);
      }
    });

    test("wiring imports the integration helper but does not import the catalog APIs directly", () => {
      const source = read("server/lib/recruitment/previewRuntimeWiring.js");
      expect(source).toMatch(/Phase 48/);
      expect(source).toMatch(/runtimeCapabilityRegistryIntegration/);
      expect(source).toMatch(/attachRuntimeCapabilityRegistry/);
      expect(source).not.toMatch(/createCapabilityRegistry/);
      expect(source).not.toMatch(/listCapabilities/);
      expect(source).not.toMatch(/hasCapability/);
      expect(source).not.toMatch(/summarizeCapabilityRegistry/);
      expect(source).not.toMatch(/require\(["']\.\/runtimeCapabilityRegistry["']\)/);
    });

    test("attached registry remains architecture-only and non-executing", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const summary = summarizeCapabilityRegistry(result.capabilityRegistry);
      const fresh = createCapabilityRegistry();

      expect(result.capabilityRegistry).not.toBe(fresh);
      expect(summary.executed).toBe(false);
      expect(summary.enabledCount).toBe(0);
      expect(summary.productionReadyCount).toBe(0);
      expect(summary.persistenceEnabled).toBe(false);
      expect(summary.architectureOnly).toBe(true);
      for (const capability of result.capabilityRegistry.capabilities) {
        expect(capability.enabled).toBe(false);
        expect(capability.architectureOnly).toBe(true);
        expect(capability.productionReady).toBe(false);
      }
    });
  });
});
