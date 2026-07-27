"use strict";

/**
 * Phase 59 — Preview Integration Contract tests.
 * Reusable read-only contract for business components; depends only on the
 * Phase 57 consumer output. Preview Advisory fulfills the contract while
 * advisory output, metadata, and runtime state remain unchanged.
 */

const fs = require("fs");
const path = require("path");

const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  WIRING_PHASE,
  WIRING_REASONS,
  runPreviewRuntimeWiring,
  toPreviewAdvisoryMetadata,
  buildPreviewLifecycleArchitecture
} = require("../server/lib/recruitment/previewRuntimeWiring");
const {
  buildRuntimeCapabilityContextRead,
  peekRuntimeCapabilityContextRead
} = require("../server/lib/recruitment/runtimeCapabilityContextRead");
const {
  consumePreviewRuntimeCapabilityContextRead
} = require("../server/lib/recruitment/runtimeCapabilityPreviewIntegration");
const {
  CONTRACT_PHASE,
  CONSUMER_PHASE,
  CONTEXT_READ_PHASE,
  isPreviewIntegrationCapabilityInfo,
  readPreviewIntegrationCapability,
  fulfillPreviewIntegrationContract
} = require("../server/lib/recruitment/previewIntegrationContract");
const {
  OBSERVED_CAPABILITY_ID,
  inspectPreviewAdvisoryCapability
} = require("../server/lib/recruitment/runtimeCapabilityObservation");

const ROOT = path.join(__dirname, "..");
const CONTRACT_MODULE = "../server/lib/recruitment/previewIntegrationContract";
const INTEGRATION_MODULE =
  "../server/lib/recruitment/runtimeCapabilityPreviewIntegration";
const OBSERVATION_MODULE =
  "../server/lib/recruitment/runtimeCapabilityObservation";
const WIRING_MODULE = "../server/lib/recruitment/previewRuntimeWiring";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9059,
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
        id: "rec-59",
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
    awarenessPhase: 53,
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

function loadWithContractSpy() {
  jest.resetModules();
  const actualContract = jest.requireActual(CONTRACT_MODULE);
  const fulfill = jest.fn(actualContract.fulfillPreviewIntegrationContract);

  jest.doMock(CONTRACT_MODULE, () => ({
    ...actualContract,
    fulfillPreviewIntegrationContract: fulfill
  }));

  return {
    fulfill,
    observation: require(OBSERVATION_MODULE),
    wiring: require(WIRING_MODULE)
  };
}

afterEach(() => {
  jest.dontMock(CONTRACT_MODULE);
  jest.dontMock(INTEGRATION_MODULE);
  jest.dontMock(OBSERVATION_MODULE);
  jest.resetModules();
});

describe("Phase 59 — Preview Integration Contract", () => {
  describe("constants", () => {
    test("exposes contract phase markers", () => {
      expect(CONTRACT_PHASE).toBe(59);
      expect(CONSUMER_PHASE).toBe(57);
      expect(CONTEXT_READ_PHASE).toBe(55);
    });
  });

  describe("contract returns normalized data", () => {
    test("readPreviewIntegrationCapability accepts Phase 57 consumer output", () => {
      const contextRead = contextReadFixture();
      const consumerOutput =
        consumePreviewRuntimeCapabilityContextRead(contextRead);

      expect(consumerOutput).not.toBeNull();
      expect(readPreviewIntegrationCapability(consumerOutput)).toBe(
        consumerOutput
      );
      expect(isPreviewIntegrationCapabilityInfo(consumerOutput)).toBe(true);
      expect(Object.isFrozen(consumerOutput)).toBe(true);
    });

    test("fulfillPreviewIntegrationContract returns normalized consumer output", () => {
      const contextRead = contextReadFixture();
      const fulfilled = fulfillPreviewIntegrationContract(contextRead);
      const expected = consumePreviewRuntimeCapabilityContextRead(contextRead);

      expect(fulfilled).toEqual(expected);
      expect(fulfilled).toMatchObject({
        phase: CONTEXT_READ_PHASE,
        readOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring",
        available: true,
        wired: true,
        enabled: false,
        architectureOnly: true,
        productionReady: false
      });
    });

    test("returns null for absent or malformed consumer output", () => {
      expect(readPreviewIntegrationCapability(null)).toBeNull();
      expect(readPreviewIntegrationCapability(undefined)).toBeNull();
      expect(readPreviewIntegrationCapability({ phase: 55 })).toBeNull();
      expect(fulfillPreviewIntegrationContract(null)).toBeNull();
      expect(fulfillPreviewIntegrationContract({ phase: 99 })).toBeNull();
    });
  });

  describe("Preview Advisory uses the contract", () => {
    test("advisory preparation fulfills the integration contract", () => {
      const { fulfill, wiring } = loadWithContractSpy();
      const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
      fulfill.mockClear();

      wiring.toPreviewAdvisoryMetadata(runtime);

      expect(fulfill).toHaveBeenCalledTimes(1);
      expect(fulfill.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          phase: 55,
          readOnly: true,
          informational: true,
          capabilityId: "preview_runtime_wiring"
        })
      );
    });

    test("inspectPreviewAdvisoryCapability delegates to the contract", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const viaContract = fulfillPreviewIntegrationContract(
        peekRuntimeCapabilityContextRead(runtime)
      );
      const viaInspection = inspectPreviewAdvisoryCapability(runtime);

      expect(viaInspection).toEqual(viaContract);
    });

    test("observation module fulfills contract instead of calling consumer directly", () => {
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const contract = read("server/lib/recruitment/previewIntegrationContract.js");

      expect(observation).toMatch(/Phase 59/);
      expect(observation).toMatch(/fulfillPreviewIntegrationContract/);
      expect(observation).not.toMatch(
        /consumePreviewRuntimeCapabilityContextRead/
      );
      expect(contract).toMatch(/Phase 59/);
      expect(contract).toMatch(/consumePreviewRuntimeCapabilityContextRead/);
    });
  });

  describe("identical advisory output", () => {
    test("advisory JSON is byte-for-byte identical for all contract values", () => {
      const { fulfill, wiring } = loadWithContractSpy();
      const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
      fulfill.mockClear();

      fulfill.mockReturnValue(null);
      const missing = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

      fulfill.mockReturnValue(
        Object.freeze({
          phase: 55,
          readOnly: true,
          informational: true,
          contextPresent: true,
          capabilityId: "preview_runtime_wiring",
          available: true,
          wired: true,
          enabled: true
        })
      );
      const enabled = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

      fulfill.mockReturnValue(
        Object.freeze({
          phase: 55,
          readOnly: true,
          informational: true,
          contextPresent: true,
          capabilityId: "preview_runtime_wiring",
          available: false,
          wired: false,
          enabled: false
        })
      );
      const disabled = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

      expect(enabled).toBe(missing);
      expect(disabled).toBe(missing);
      expect(fulfill).toHaveBeenCalledTimes(3);
    });
  });

  describe("identical metadata", () => {
    test("runtime and metadata remain byte-for-byte unchanged", () => {
      const runtime = runPreviewRuntimeWiring(eligibleInput());
      const runtimeBefore = JSON.stringify(runtime);
      const metadataBefore = JSON.stringify(runtime.metadata);

      const advisory = toPreviewAdvisoryMetadata(runtime);

      expect(JSON.stringify(runtime)).toBe(runtimeBefore);
      expect(JSON.stringify(runtime.metadata)).toBe(metadataBefore);
      expect(advisory).not.toHaveProperty("capability");
      expect(advisory).not.toHaveProperty("capabilityId");
      expect(advisory).not.toHaveProperty("consumedCapability");
      expect(advisory).not.toHaveProperty("runtimeCapabilityConsumption");
      expect(advisory).not.toHaveProperty("previewIntegrationContract");
    });
  });

  describe("backward compatibility", () => {
    test("disabled wiring advisory shape is unchanged", () => {
      const legacyDisabled = {
        enabled: false,
        reason: "WIRING_DISABLED",
        metadata: { legacy: true }
      };
      const before = JSON.stringify(legacyDisabled);

      expect(toPreviewAdvisoryMetadata(null)).toEqual({
        observationOnly: true,
        architectureOnly: true,
        enabled: false,
        wiringPhase: WIRING_PHASE,
        sideEffects: false,
        persistenceEnabled: false,
        automationEnabled: false,
        reason: WIRING_REASONS.DISABLED,
        auditEventCount: 0
      });
      expect(toPreviewAdvisoryMetadata(legacyDisabled)).toEqual({
        observationOnly: true,
        architectureOnly: true,
        enabled: false,
        wiringPhase: WIRING_PHASE,
        sideEffects: false,
        persistenceEnabled: false,
        automationEnabled: false,
        reason: "WIRING_DISABLED",
        auditEventCount: 0
      });
      expect(JSON.stringify(legacyDisabled)).toBe(before);
    });

    test("lifecycle architecture advisory remains unchanged", () => {
      const advisory = buildPreviewLifecycleArchitecture(eligibleInput());
      expect(advisory).toEqual(
        expect.objectContaining({
          observationOnly: true,
          architectureOnly: true,
          enabled: true,
          wiringPhase: WIRING_PHASE
        })
      );
      expect(advisory).not.toHaveProperty("capabilityId");
    });

    test("contract failures cannot affect advisory generation", () => {
      jest.resetModules();
      const actualContract = jest.requireActual(CONTRACT_MODULE);
      const fulfill = jest.fn(() => {
        throw new Error("optional contract unavailable");
      });

      jest.doMock(CONTRACT_MODULE, () => ({
        ...actualContract,
        fulfillPreviewIntegrationContract: fulfill
      }));

      const wiring = require(WIRING_MODULE);
      const legacy = { enabled: false, reason: "KEEP" };

      expect(wiring.toPreviewAdvisoryMetadata(legacy).reason).toBe("KEEP");
      expect(fulfill).toHaveBeenCalledWith(null);
    });
  });

  describe("no mutations", () => {
    test("contract never mutates consumer output or context read", () => {
      const contextRead = contextReadFixture();
      const contextBefore = JSON.stringify(contextRead);
      const consumerOutput =
        consumePreviewRuntimeCapabilityContextRead(contextRead);
      const consumerBefore = JSON.stringify(consumerOutput);

      const returned = readPreviewIntegrationCapability(consumerOutput);
      fulfillPreviewIntegrationContract(contextRead);

      expect(JSON.stringify(contextRead)).toBe(contextBefore);
      expect(JSON.stringify(consumerOutput)).toBe(consumerBefore);
      expect(returned).toBe(consumerOutput);
      expect(Object.isFrozen(contextRead)).toBe(true);
      expect(Object.isFrozen(consumerOutput)).toBe(true);
    });
  });

  describe("architecture boundaries", () => {
    test("contract depends only on Phase 57 consumer", () => {
      const contract = read("server/lib/recruitment/previewIntegrationContract.js");

      expect(contract).toMatch(/consumePreviewRuntimeCapabilityContextRead/);
      expect(contract).toMatch(/isRuntimeCapabilityContextReadShape/);
      expect(contract).not.toMatch(/runtimeCapabilityRegistry/);
      expect(contract).not.toMatch(/runtimeCapabilityAccess/);
      expect(contract).not.toMatch(/runtimeCapabilityResolver/);
      expect(contract).not.toMatch(/runtimeCapabilityObservation/);
      expect(contract).not.toMatch(/runtimeCapabilityValidation/);
      expect(contract).not.toMatch(/runtimeCapabilityAwareness/);
      expect(contract).not.toMatch(/runtimeCapabilityContext[^R]/);
      expect(contract).not.toMatch(/WeakMap/);
      expect(contract).not.toMatch(/normalizeBoolean|normalizeString|normalizeNumber/);
    });

    test("integration is observation-only with no capability-driven branching", () => {
      const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
      const observation = read(
        "server/lib/recruitment/runtimeCapabilityObservation.js"
      );
      const worker = read("server/services/workers/siteWorker.js");

      expect(wiring).toMatch(/Phase 59/);
      expect(wiring).toMatch(
        /function toPreviewAdvisoryMetadata[\s\S]*inspectPreviewAdvisoryCapability\(result\)/
      );
      expect(wiring).not.toMatch(/if\s*\(\s*consumedCapability/);
      expect(wiring).not.toMatch(/consumedCapability\.(enabled|available|wired)/);
      expect(observation).not.toMatch(
        /if\s*\(\s*consumedCapability|consumedCapability\.(enabled|available|wired)/
      );
      expect(worker).not.toMatch(/fulfillPreviewIntegrationContract/);
      expect(worker).not.toMatch(/inspectPreviewAdvisoryCapability/);
      expect(worker).not.toMatch(/readPreviewIntegrationCapability/);
    });
  });
});
