"use strict";

/**
 * Phase 58 — Preview Advisory Capability Integration tests.
 * The existing Phase 57 consumer is reached during advisory preparation while
 * advisory output, metadata, and runtime state remain byte-for-byte unchanged.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INTEGRATION_MODULE =
  "../server/lib/recruitment/runtimeCapabilityPreviewIntegration";
const OBSERVATION_MODULE =
  "../server/lib/recruitment/runtimeCapabilityObservation";
const WIRING_MODULE = "../server/lib/recruitment/previewRuntimeWiring";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput() {
  return {
    updateId: 9058,
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
      status: "eligible",
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
        id: "rec-58",
        lifecycle_state: "open"
      },
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ADVERTISEMENT_NUMBER"],
        conflictingSignals: []
      }
    }
  };
}

function loadWithConsumerSpy() {
  jest.resetModules();
  const actualIntegration = jest.requireActual(INTEGRATION_MODULE);
  const consumer = jest.fn(
    actualIntegration.consumePreviewRuntimeCapabilityContextRead
  );

  jest.doMock(INTEGRATION_MODULE, () => ({
    ...actualIntegration,
    consumePreviewRuntimeCapabilityContextRead: consumer
  }));

  return {
    consumer,
    observation: require(OBSERVATION_MODULE),
    wiring: require(WIRING_MODULE)
  };
}

afterEach(() => {
  jest.dontMock(INTEGRATION_MODULE);
  jest.dontMock(OBSERVATION_MODULE);
  jest.resetModules();
});

describe("Phase 58 — Preview Advisory Capability Integration", () => {
  test("central advisory preparation invokes integration and reaches Phase 57 consumer", () => {
    const { consumer, wiring } = loadWithConsumerSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    consumer.mockClear();

    wiring.toPreviewAdvisoryMetadata(runtime);

    expect(consumer).toHaveBeenCalledTimes(1);
    expect(consumer.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        phase: 55,
        readOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring"
      })
    );

    const source = read("server/lib/recruitment/previewRuntimeWiring.js");
    expect(source).toMatch(
      /function toPreviewAdvisoryMetadata[\s\S]*inspectPreviewAdvisoryCapability\(result\)/
    );
  });

  test("advisory output is byte-for-byte identical for all consumed values", () => {
    const { consumer, wiring } = loadWithConsumerSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    consumer.mockClear();

    consumer.mockReturnValue(null);
    const missing = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

    consumer.mockReturnValue(
      Object.freeze({
        phase: 55,
        capabilityId: "preview_runtime_wiring",
        available: true,
        wired: true,
        enabled: true
      })
    );
    const enabled = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

    consumer.mockReturnValue(
      Object.freeze({
        phase: 55,
        capabilityId: "preview_runtime_wiring",
        available: false,
        wired: false,
        enabled: false
      })
    );
    const disabled = JSON.stringify(wiring.toPreviewAdvisoryMetadata(runtime));

    expect(enabled).toBe(missing);
    expect(disabled).toBe(missing);
    expect(consumer).toHaveBeenCalledTimes(3);
  });

  test("metadata and runtime remain byte-for-byte unchanged", () => {
    const { wiring } = loadWithConsumerSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    const runtimeBefore = JSON.stringify(runtime);
    const metadataBefore = JSON.stringify(runtime.metadata);

    const advisory = wiring.toPreviewAdvisoryMetadata(runtime);

    expect(JSON.stringify(runtime)).toBe(runtimeBefore);
    expect(JSON.stringify(runtime.metadata)).toBe(metadataBefore);
    expect(advisory).not.toHaveProperty("capability");
    expect(advisory).not.toHaveProperty("capabilityId");
    expect(advisory).not.toHaveProperty("consumedCapability");
    expect(advisory).not.toHaveProperty("runtimeCapabilityConsumption");
  });

  test("missing capability information is non-breaking and preserves legacy output", () => {
    const { consumer, wiring } = loadWithConsumerSpy();
    const legacyDisabled = {
      enabled: false,
      reason: "WIRING_DISABLED",
      metadata: { legacy: true }
    };
    const before = JSON.stringify(legacyDisabled);

    consumer.mockReturnValue(null);

    expect(wiring.toPreviewAdvisoryMetadata(null)).toEqual({
      observationOnly: true,
      architectureOnly: true,
      enabled: false,
      wiringPhase: 41,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false,
      reason: "WIRING_DISABLED",
      auditEventCount: 0
    });
    expect(wiring.toPreviewAdvisoryMetadata(legacyDisabled)).toEqual({
      observationOnly: true,
      architectureOnly: true,
      enabled: false,
      wiringPhase: 41,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false,
      reason: "WIRING_DISABLED",
      auditEventCount: 0
    });
    expect(JSON.stringify(legacyDisabled)).toBe(before);
  });

  test("inspection failures cannot affect advisory generation", () => {
    jest.resetModules();
    const actualIntegration = jest.requireActual(INTEGRATION_MODULE);
    const consumer = jest.fn(() => {
      throw new Error("optional capability unavailable");
    });

    jest.doMock(INTEGRATION_MODULE, () => ({
      ...actualIntegration,
      consumePreviewRuntimeCapabilityContextRead: consumer
    }));

    const wiring = require(WIRING_MODULE);
    const legacy = { enabled: false, reason: "KEEP" };

    expect(wiring.toPreviewAdvisoryMetadata(legacy).reason).toBe("KEEP");
    expect(consumer).toHaveBeenCalledWith(null);
  });

  test("integration is observation-only with no capability-driven branching", () => {
    const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
    const observation = read(
      "server/lib/recruitment/runtimeCapabilityObservation.js"
    );
    const worker = read("server/services/workers/siteWorker.js");

    expect(wiring).toMatch(/Phase 58/);
    expect(observation).toMatch(/Phase 59/);
    expect(observation).toMatch(/fulfillPreviewIntegrationContract/);
    expect(wiring).not.toMatch(/if\s*\(\s*consumedCapability/);
    expect(wiring).not.toMatch(/consumedCapability\.(enabled|available|wired)/);
    expect(observation).not.toMatch(
      /if\s*\(\s*consumedCapability|consumedCapability\.(enabled|available|wired)/
    );
    expect(worker).not.toMatch(/inspectPreviewAdvisoryCapability/);
    expect(worker).not.toMatch(/consumePreviewRuntimeCapabilityContextRead/);
  });
});
