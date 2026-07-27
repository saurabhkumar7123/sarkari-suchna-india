"use strict";

/**
 * Phase 62 — Execution Diagnostics Capability Observation tests.
 * Execution Diagnostics fulfills the Preview Integration Contract during
 * preview runtime initialization while traces, metadata, advisory output,
 * and runtime state remain byte-for-byte unchanged.
 */

const fs = require("fs");
const path = require("path");

const {
  WIRING_REASONS,
  runPreviewRuntimeWiring,
  toPreviewAdvisoryMetadata,
  buildPreviewLifecycleArchitecture
} = require("../server/lib/recruitment/previewRuntimeWiring");
const {
  createExecutionTrace,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace,
  observeExecutionDiagnosticsCapability
} = require("../server/lib/recruitment/executionDiagnostics");
const {
  fulfillPreviewIntegrationContract
} = require("../server/lib/recruitment/previewIntegrationContract");

const ROOT = path.join(__dirname, "..");
const CONTRACT_MODULE = "../server/lib/recruitment/previewIntegrationContract";
const INTEGRATION_MODULE =
  "../server/lib/recruitment/executionDiagnosticsCapabilityIntegration";
const OBSERVATION_MODULE =
  "../server/lib/recruitment/runtimeCapabilityObservation";
const DIAGNOSTICS_MODULE = "../server/lib/recruitment/executionDiagnostics";
const WIRING_MODULE = "../server/lib/recruitment/previewRuntimeWiring";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput() {
  return {
    updateId: 9062,
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
        id: "rec-62",
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

function baseTraceInput() {
  return {
    correlationId: "corr-62",
    pipelineRunId: "run-62",
    contextId: "ctx-62",
    metadata: { marker: "phase62" }
  };
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
    wiring: require(WIRING_MODULE),
    diagnostics: require(DIAGNOSTICS_MODULE),
    observation: require(OBSERVATION_MODULE)
  };
}

afterEach(() => {
  jest.dontMock(CONTRACT_MODULE);
  jest.dontMock(INTEGRATION_MODULE);
  jest.dontMock(OBSERVATION_MODULE);
  jest.dontMock(DIAGNOSTICS_MODULE);
  jest.resetModules();
});

describe("Phase 62 — Execution Diagnostics Capability Observation", () => {
  test("runtime initialization invokes contract fulfillment for diagnostics", () => {
    const { fulfill, wiring, diagnostics } = loadWithContractSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());

    expect(fulfill).toHaveBeenCalledTimes(1);
    expect(fulfill.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        phase: 55,
        readOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring"
      })
    );
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(runtime)).toEqual(
      fulfill.mock.results[0].value
    );
  });

  test("inspectPreviewExecutionDiagnosticsCapability delegates through integration", () => {
    const { fulfill, wiring, diagnostics, observation } = loadWithContractSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    fulfill.mockClear();

    const viaInspection =
      observation.inspectPreviewExecutionDiagnosticsCapability(runtime);

    expect(fulfill).toHaveBeenCalledTimes(1);
    expect(viaInspection).toEqual(fulfill.mock.results[0].value);
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(runtime)).toEqual(
      viaInspection
    );
  });

  test("advisory output is byte-for-byte identical for all consumed values", () => {
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

  test("metadata and runtime remain byte-for-byte unchanged", () => {
    const { wiring } = loadWithContractSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    const runtimeBefore = JSON.stringify(runtime);
    const metadataBefore = JSON.stringify(runtime.metadata);

    const advisory = wiring.toPreviewAdvisoryMetadata(runtime);

    expect(JSON.stringify(runtime)).toBe(runtimeBefore);
    expect(JSON.stringify(runtime.metadata)).toBe(metadataBefore);
    expect(advisory).not.toHaveProperty("capability");
    expect(advisory).not.toHaveProperty("capabilityId");
    expect(advisory).not.toHaveProperty("consumedCapability");
    expect(advisory).not.toHaveProperty("executionDiagnosticsCapability");
    expect(runtime).not.toHaveProperty("executionDiagnosticsCapability");
  });

  test("execution traces remain byte-for-byte unchanged", () => {
    const input = baseTraceInput();
    const stageInput = {
      stageType: "context",
      status: "recorded",
      message: "phase 62 trace",
      detail: { marker: true }
    };

    const open = createExecutionTrace(input);
    const appended = appendExecutionStage(open, stageInput);
    const finalized = finalizeExecutionTrace(appended.trace);
    const summary = summarizeExecutionTrace(finalized.trace);

    const openAgain = createExecutionTrace(input);
    const appendedAgain = appendExecutionStage(openAgain, stageInput);
    const finalizedAgain = finalizeExecutionTrace(appendedAgain.trace);
    const summaryAgain = summarizeExecutionTrace(finalizedAgain.trace);

    expect(JSON.stringify(open)).toBe(JSON.stringify(openAgain));
    expect(JSON.stringify(appended)).toBe(JSON.stringify(appendedAgain));
    expect(JSON.stringify(finalized)).toBe(JSON.stringify(finalizedAgain));
    expect(JSON.stringify(summary)).toBe(JSON.stringify(summaryAgain));
  });

  test("capability observation does not alter trace mutation results", () => {
    const { diagnostics } = loadWithContractSpy();
    const runtime = { enabled: true, metadata: { marker: "trace" } };
    const trace = createExecutionTrace(baseTraceInput());
    const traceBefore = JSON.stringify(trace);

    diagnostics.observeExecutionDiagnosticsCapability(
      runtime,
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

    const appended = appendExecutionStage(trace, {
      stageType: "policy",
      status: "recorded",
      message: "unchanged"
    });

    expect(JSON.stringify(trace)).toBe(traceBefore);
    expect(appended.success).toBe(true);
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(runtime)).toEqual(
      expect.objectContaining({ capabilityId: "preview_runtime_wiring" })
    );
  });

  test("missing capability information is non-breaking and preserves legacy output", () => {
    const { fulfill, wiring, diagnostics } = loadWithContractSpy();
    const legacyDisabled = {
      enabled: false,
      reason: "WIRING_DISABLED",
      metadata: { legacy: true }
    };
    const before = JSON.stringify(legacyDisabled);

    fulfill.mockReturnValue(null);

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
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(legacyDisabled)).toBeNull();
  });

  test("contract failures cannot affect runtime or advisory generation", () => {
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
    const diagnostics = require(DIAGNOSTICS_MODULE);
    const legacy = { enabled: false, reason: "KEEP" };

    expect(wiring.toPreviewAdvisoryMetadata(legacy).reason).toBe("KEEP");
    expect(wiring.runPreviewRuntimeWiring(eligibleInput()).reason).toBe(
      WIRING_REASONS.ENABLED
    );
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(legacy)).toBeNull();
  });

  test("worker helper output remains backward compatible", () => {
    const helperMeta = buildPreviewLifecycleArchitecture(eligibleInput());

    expect(helperMeta).toEqual(
      expect.objectContaining({
        observationOnly: true,
        architectureOnly: true,
        enabled: true,
        wiringPhase: 41,
        sideEffects: false,
        persistenceEnabled: false,
        automationEnabled: false
      })
    );
    expect(helperMeta).not.toHaveProperty("executionDiagnosticsCapability");
    expect(helperMeta).not.toHaveProperty("capabilityId");
  });

  test("integration is observation-only with no capability-driven branching", () => {
    const observation = read("server/lib/recruitment/runtimeCapabilityObservation.js");
    const integration = read(
      "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js"
    );
    const diagnostics = read("server/lib/recruitment/executionDiagnostics.js");
    const wiring = read("server/lib/recruitment/previewRuntimeWiring.js");
    const worker = read("server/services/workers/siteWorker.js");

    expect(observation).toMatch(/Phase 62/);
    expect(observation).toMatch(/inspectExecutionDiagnosticsCapability/);
    expect(observation).toMatch(/void diagnosticsCapability/);
    expect(integration).toMatch(/fulfillPreviewIntegrationContract/);
    expect(diagnostics).toMatch(/Phase 62/);
    expect(wiring).not.toMatch(/inspectExecutionDiagnosticsCapability/);
    expect(wiring).not.toMatch(/executionDiagnosticsCapabilityIntegration/);
    expect(wiring).not.toMatch(/observeExecutionDiagnosticsCapability/);
    expect(observation).not.toMatch(/if\s*\(\s*diagnosticsCapability/);
    expect(observation).not.toMatch(
      /diagnosticsCapability\.(enabled|available|wired)/
    );
    expect(diagnostics).not.toMatch(/if\s*\(\s*capabilityInfo/);
    expect(diagnostics).not.toMatch(
      /capabilityInfo\.(enabled|available|wired)/
    );
    expect(worker).not.toMatch(/inspectExecutionDiagnosticsCapability/);
    expect(worker).not.toMatch(/observeExecutionDiagnosticsCapability/);
    expect(worker).not.toMatch(/executionDiagnosticsCapabilityIntegration/);
  });

  test("diagnostics module never imports forbidden capability layers", () => {
    const diagnostics = read("server/lib/recruitment/executionDiagnostics.js");
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
      expect(diagnostics).not.toContain(moduleName);
    }
    expect(diagnostics).not.toMatch(/require\(["']/);
  });

  test("integration depends only on contract and context-read peek", () => {
    const integration = read(
      "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js"
    );

    expect(integration).toMatch(/fulfillPreviewIntegrationContract/);
    expect(integration).toMatch(/peekRuntimeCapabilityContextRead/);
    expect(integration).not.toMatch(/runtimeCapabilityRegistry/);
    expect(integration).not.toMatch(/runtimeCapabilityResolver/);
    expect(integration).not.toMatch(/runtimeCapabilityObservation/);
    expect(integration).not.toMatch(/runtimeCapabilityValidation/);
    expect(integration).not.toMatch(/runtimeCapabilityAwareness/);
    expect(integration).not.toMatch(/runtimeCapabilityContext[^R]/);
    expect(integration).not.toMatch(/resolveCapability/);
    expect(integration).not.toMatch(/observeRuntimeCapability/);
  });

  test("prior modules do not import the Phase 62 integration module", () => {
    const files = [
      "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
      "server/lib/recruitment/persistenceExecutionPipeline.js",
      "server/lib/recruitment/persistenceEnablement.js",
      "server/lib/recruitment/controlledRuntimeExecutionAdapter.js",
      "server/lib/recruitment/dryRunPersistenceSimulator.js",
      "server/lib/recruitment/reviewWorkflow.js",
      "server/lib/recruitment/runtimePreviewBuffer.js",
      "server/lib/recruitment/previewRuntimeWiring.js",
      "server/config/recruitmentPipeline.js",
      "server/config/recruitmentLifecycle.js"
    ];

    for (const rel of files) {
      const source = read(rel);
      expect(source).not.toMatch(/executionDiagnosticsCapabilityIntegration/);
      expect(source).not.toMatch(/inspectExecutionDiagnosticsCapability/);
    }
  });

  test("contract fulfillment is not duplicated as a second consumer", () => {
    const integration = read(
      "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js"
    );

    expect(integration).not.toMatch(/consumePreviewRuntimeCapabilityContextRead/);
    expect(integration).not.toMatch(/CONSUMER_PHASE/);
    expect(integration).not.toMatch(/invokePreviewRuntimeCapabilityIntegration/);
  });

  test("diagnostics accepts only contract-shaped capability information", () => {
    const { diagnostics } = loadWithContractSpy();
    const runtime = { enabled: true };

    expect(
      diagnostics.observeExecutionDiagnosticsCapability(runtime, {
        phase: 55,
        readOnly: true,
        informational: true,
        capabilityId: "preview_runtime_wiring"
      })
    ).toEqual(
      expect.objectContaining({ capabilityId: "preview_runtime_wiring" })
    );

    expect(
      diagnostics.observeExecutionDiagnosticsCapability(runtime, {
        phase: 57,
        capabilityId: "preview_runtime_wiring"
      })
    ).toBeNull();
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(runtime)).toBeNull();
  });

  test("direct contract fulfillment matches integration observation", () => {
    const { fulfill, wiring, diagnostics } = loadWithContractSpy();
    const runtime = wiring.runPreviewRuntimeWiring(eligibleInput());
    const direct = fulfillPreviewIntegrationContract(fulfill.mock.calls[0][0]);

    expect(direct).toEqual(fulfill.mock.results[0].value);
    expect(diagnostics.peekExecutionDiagnosticsCapabilityObservation(runtime)).toEqual(
      direct
    );
  });
});
