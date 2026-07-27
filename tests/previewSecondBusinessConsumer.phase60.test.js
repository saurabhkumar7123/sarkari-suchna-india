"use strict";

/**
 * Phase 60 — Second Preview Business Consumer decision tests.
 *
 * The next existing workflow component is runtime preview-buffer recording.
 * It cannot fulfill the Preview Integration Contract without prohibited
 * context access or worker/pipeline changes, so no second integration is made.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTRACT_MODULE =
  "../server/lib/recruitment/previewIntegrationContract";
const BUFFER_MODULE = "../server/lib/recruitment/runtimePreviewBuffer";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function previewInput(overrides = {}) {
  return {
    pipelineOutcome: {
      skipped: false,
      failed: false,
      updateId: 9060,
      result: {
        status: "success",
        eventType: "admit_card",
        warnings: [],
        selectedRecruitment: { id: "rec-60" }
      }
    },
    monitoredSite: {
      id: 60,
      name: "Phase 60",
      url: "https://example.test"
    },
    notice: {
      title: "Phase 60 notice",
      content: "Phase 60 notice",
      url: "https://example.test/notice"
    },
    timestamp: "2026-07-15T03:43:00.000Z",
    updateId: 9060,
    lookupSummary: {
      status: "ok",
      strategy: "advertisement_no",
      candidateCount: 1
    },
    eligibility: {
      eligible: true,
      status: "eligible",
      reasons: ["CONFIDENCE_HIGH"],
      confidence: "high",
      eventType: "admit_card",
      candidateCount: 1,
      matchResult: { match: true, confidence: "high" }
    },
    lifecycleArchitecture: {
      observationOnly: true,
      architectureOnly: true,
      enabled: true,
      wiringPhase: 41,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false
    },
    ...overrides
  };
}

function loadBufferWithContractSpy(contractValue) {
  jest.resetModules();
  const actualContract = jest.requireActual(CONTRACT_MODULE);
  const fulfill = jest.fn(() => contractValue);

  jest.doMock(CONTRACT_MODULE, () => ({
    ...actualContract,
    fulfillPreviewIntegrationContract: fulfill
  }));

  return {
    fulfill,
    buffer: require(BUFFER_MODULE)
  };
}

function withoutGeneratedTimestamp(entry) {
  return {
    ...entry,
    timestamp: "<generated>"
  };
}

afterEach(() => {
  jest.dontMock(CONTRACT_MODULE);
  jest.resetModules();
});

describe("Phase 60 — Second Preview Business Consumer", () => {
  test("documents why the next existing Preview component is not integrated", () => {
    const worker = read("server/services/workers/siteWorker.js");
    const documentation = read("docs/recruitment-runtime-preview.md");

    expect(worker.indexOf("buildPreviewLifecycleArchitecture({")).toBeGreaterThan(
      -1
    );
    expect(worker.indexOf("recordRuntimePreviewFromPipeline({")).toBeGreaterThan(
      worker.indexOf("buildPreviewLifecycleArchitecture({")
    );
    expect(documentation).toMatch(
      /Phase 60 — second business consumer decision/
    );
    expect(documentation).toMatch(
      /No additional Preview Integration Contract consumer is integrated/
    );
    expect(documentation).toMatch(
      /recordRuntimePreviewFromPipeline[\s\S]*not a suitable observation-only second\s+business\s+consumer/
    );
  });

  test("preview buffer and worker do not cross capability boundaries", () => {
    const buffer = read("server/lib/recruitment/runtimePreviewBuffer.js");
    const worker = read("server/services/workers/siteWorker.js");
    const forbidden = [
      "previewIntegrationContract",
      "runtimeCapabilityPreviewIntegration",
      "runtimeCapabilityRegistry",
      "runtimeCapabilityResolver",
      "runtimeCapabilityObservation",
      "runtimeCapabilityValidation",
      "runtimeCapabilityAwareness",
      "runtimeCapabilityContext",
      "runtimeCapabilityContextRead"
    ];

    for (const moduleName of forbidden) {
      expect(buffer).not.toContain(moduleName);
      expect(worker).not.toContain(moduleName);
    }
  });

  test("contract values cannot change preview runtime output or metadata", () => {
    const absent = loadBufferWithContractSpy(null);
    const absentInput = previewInput();
    const absentMetadataBefore = JSON.stringify(
      absentInput.lifecycleArchitecture
    );
    const absentEntry = absent.buffer.recordRuntimePreviewFromPipeline(
      absentInput
    );

    expect(absent.fulfill).not.toHaveBeenCalled();
    expect(JSON.stringify(absentInput.lifecycleArchitecture)).toBe(
      absentMetadataBefore
    );

    const available = loadBufferWithContractSpy(
      Object.freeze({
        phase: 55,
        readOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring",
        available: true,
        wired: true,
        enabled: true
      })
    );
    const availableEntry = available.buffer.recordRuntimePreviewFromPipeline(
      previewInput()
    );

    expect(available.fulfill).not.toHaveBeenCalled();
    expect(JSON.stringify(withoutGeneratedTimestamp(availableEntry))).toBe(
      JSON.stringify(withoutGeneratedTimestamp(absentEntry))
    );
    expect(availableEntry.lifecycleArchitecture).not.toHaveProperty(
      "capabilityId"
    );
    expect(availableEntry).not.toHaveProperty("capability");
    expect(availableEntry).not.toHaveProperty("previewIntegrationContract");
  });

  test("legacy preview-buffer behavior remains backward compatible", () => {
    const { fulfill, buffer } = loadBufferWithContractSpy(null);
    const input = previewInput({ lifecycleArchitecture: undefined });

    const entry = buffer.recordRuntimePreviewFromPipeline(input);

    expect(fulfill).not.toHaveBeenCalled();
    expect(entry).not.toBeNull();
    expect(entry.lifecycleArchitecture).toBeNull();
    expect(entry.updateId).toBe(9060);
    expect(buffer.getRuntimePreviewSize()).toBe(1);
    expect(
      buffer.recordRuntimePreviewFromPipeline({
        pipelineOutcome: { skipped: true }
      })
    ).toBeNull();
    expect(buffer.getRuntimePreviewSize()).toBe(1);
  });
});
