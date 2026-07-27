"use strict";

/**
 * Phase 106 — Recruitment Workflow Observation Integration Contract tests.
 * Valid observation, missing observation, malformed outcome, determinism,
 * immutability, validation helper, summary helper, architecture boundaries,
 * and no persistence.
 */

const fs = require("fs");
const path = require("path");

jest.mock("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator", () => {
  const actual = jest.requireActual(
    "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
  );
  return {
    ...actual,
    coordinateRecruitmentWorkflowIntegration: jest.fn(
      actual.coordinateRecruitmentWorkflowIntegration
    )
  };
});

const {
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA,
  EMPTY_CONTRACT_SUMMARY,
  EXPECTED_CONTRACT_KEYS,
  buildRecruitmentWorkflowObservationContract,
  isRecruitmentWorkflowObservationContract,
  summarizeRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract");

const {
  getRecruitmentWorkflowObservation,
  summarizeRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation,
  EMPTY_OBSERVATION_SUMMARY
} = require("../server/lib/recruitment/recruitmentWorkflowObservationService");

const {
  attachRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const {
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const { DIAGNOSTICS_SEVERITY } = require(
  "../server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract.js";
const OBSERVATION_SERVICE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationService.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";
const SNAPSHOT_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowSnapshotAdapter.js";
const OBSERVATION_VIEW_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationView.js";
const DIAGNOSTICS_ADAPTER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationDiagnosticsAdapter.js";
const DIAGNOSTICS_ATTACHMENT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1 Advertisement Number CGL-01/2026",
    url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    id: 1,
    department: "ssc",
    post_name: "Combined Graduate Level",
    exam_name: "CGL",
    cycle_year: 2026,
    advertisement_no: "CGL-01/2026",
    ...overrides
  };
}

function mockProcessorResult() {
  return {
    status: PROCESS_RESULT_STATUS.SUCCESS,
    warnings: [],
    eventType: "admit_card",
    selectedRecruitment: candidate(),
    reviewItem: { title: notice().title, eventType: "admit_card", status: "pending" }
  };
}

function enabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 106,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-106-trace",
    ...overrides
  };
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

describe("Phase 106 — recruitmentWorkflowObservationIntegrationContract", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE).toBe(106);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_ENTITY).toBe(
        "recruitment_workflow_observation_integration_contract"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_DESCRIPTOR.phase).toBe(106);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.contractOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.sourcePhase).toBe(105);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.persistenceEnabled).toBe(
        false
      );
    });
  });

  describe("valid observation", () => {
    test("wraps complete Phase 105 observation bundle without recomputation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 601 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 601 }));

      const expectedObservation = getRecruitmentWorkflowObservation(outcome);
      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(contract.observation).toEqual(expectedObservation);
      expect(contract.observation).not.toBe(expectedObservation);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.metadata).toEqual({
        phase: 106,
        schemaVersion: "1.0.0"
      });
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
    });

    test("includes Phase 104 attachment when previously attached", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 602 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 602 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(contract.observation.attachment).not.toBeNull();
      expect(contract.observation.snapshot).not.toBeNull();
      expect(contract.observation.observation.status).toBe(OBSERVATION_VIEW_STATUS.READY);
    });
  });

  describe("missing observation", () => {
    test("returns empty observation bundle when snapshot is unavailable", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 603 };
      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(contract.observation.snapshot).toBeNull();
      expect(contract.observation.attachment).toBeNull();
      expect(contract.observation.observation.status).toBe(OBSERVATION_VIEW_STATUS.UNKNOWN);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
    });

    test("returns empty observation bundle for unrelated outcome objects", () => {
      const contract = buildRecruitmentWorkflowObservationContract({});

      expect(contract.observation.snapshot).toBeNull();
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
    });

    test("returns empty observation when advisory snapshot is invalid", () => {
      const outcome = { updateId: 604 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: {
          workflowAdvisorySnapshot: { invalid: true },
          architectureOnly: true,
          advisory: true,
          executed: false
        },
        diagnostics: {}
      });

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(contract.observation.snapshot).toBeNull();
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => buildRecruitmentWorkflowObservationContract("bad")).not.toThrow();
      expect(() => buildRecruitmentWorkflowObservationContract([])).not.toThrow();
      expect(() => buildRecruitmentWorkflowObservationContract(Symbol("x"))).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowObservationContract(undefined)).not.toThrow();
      expect(() => isRecruitmentWorkflowObservationContract(42)).not.toThrow();
    });

    test("returns stable empty observation for non-object inputs", () => {
      const contract = buildRecruitmentWorkflowObservationContract("bad");

      expect(contract.observation.snapshot).toBeNull();
      expect(contract.observation.observation.health).toBe(OBSERVATION_VIEW_HEALTH.UNKNOWN);
      expect(contract.observation.diagnostics.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
    });
  });

  describe("deterministic behavior", () => {
    test("repeated builds return deeply equal contracts", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 605 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 605 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const first = buildRecruitmentWorkflowObservationContract(outcome);
      const second = buildRecruitmentWorkflowObservationContract(outcome);

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
      expect(summarizeRecruitmentWorkflowObservationContract(first)).toEqual(
        summarizeRecruitmentWorkflowObservationContract(second)
      );
    });

    test("always exposes the stable contract key set", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 606 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 606 }));

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(Object.keys(contract).sort()).toEqual([...EXPECTED_CONTRACT_KEYS].sort());
    });

    test("does not invoke coordinator during contract builds", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 607 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 607 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      buildRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(
        buildRecruitmentWorkflowObservationContract(outcome)
      );

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 608 };
      const before = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 608 }));
      buildRecruitmentWorkflowObservationContract(outcome);
      summarizeRecruitmentWorkflowObservationContract(
        buildRecruitmentWorkflowObservationContract(outcome)
      );

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("freezes entire contract object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 609 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 609 }));

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      assertAllFrozen(contract);
      expect(() => {
        contract.advisory = false;
      }).toThrow();
    });

    test("summary helper returns frozen object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 610 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 610 }));

      const summary = summarizeRecruitmentWorkflowObservationContract(
        buildRecruitmentWorkflowObservationContract(outcome)
      );

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("summary helper", () => {
    test("reuses Phase 105 summary field semantics", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 611 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 611 }));

      const contract = buildRecruitmentWorkflowObservationContract(outcome);
      const contractSummary = summarizeRecruitmentWorkflowObservationContract(contract);
      const phase105Summary = summarizeRecruitmentWorkflowObservation(outcome);

      expect(contractSummary).toEqual({
        lifecycle: phase105Summary.lifecycle,
        health: phase105Summary.health,
        severity: phase105Summary.severity,
        recommendation: phase105Summary.recommendation
      });
      expect(contractSummary.lifecycle).toBe("ADMIT_CARD");
    });

    test("returns UNKNOWN summary when contract is invalid", () => {
      const summary = summarizeRecruitmentWorkflowObservationContract(null);

      expect(summary).toEqual(EMPTY_CONTRACT_SUMMARY);
      expect(summary).toEqual({
        lifecycle: EMPTY_OBSERVATION_SUMMARY.lifecycle,
        health: EMPTY_OBSERVATION_SUMMARY.health,
        severity: EMPTY_OBSERVATION_SUMMARY.severity,
        recommendation: EMPTY_OBSERVATION_SUMMARY.recommendation
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("returns UNKNOWN summary when observation snapshot is unavailable", () => {
      const contract = buildRecruitmentWorkflowObservationContract({});
      const summary = summarizeRecruitmentWorkflowObservationContract(contract);

      expect(summary.lifecycle).toBe("UNKNOWN");
      expect(summary.health).toBe("UNKNOWN");
      expect(summary.severity).toBe(DIAGNOSTICS_SEVERITY.UNKNOWN);
      expect(summary.recommendation).toBeNull();
    });
  });

  describe("validation helper", () => {
    test("accepts valid contracts and rejects malformed values", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 612 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 612 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(isRecruitmentWorkflowObservationContract(null)).toBe(false);
      expect(isRecruitmentWorkflowObservationContract({ observation: null })).toBe(false);
      expect(
        isRecruitmentWorkflowObservationContract({
          ...contract,
          advisory: false
        })
      ).toBe(false);
      expect(
        isRecruitmentWorkflowObservationContract({
          ...contract,
          metadata: { phase: 106, schemaVersion: "2.0.0" }
        })
      ).toBe(false);
      expect(
        isRecruitmentWorkflowObservationContract({
          ...contract,
          metadata: { phase: 105, schemaVersion: "1.0.0" }
        })
      ).toBe(false);
    });

    test("requires observation bundle to satisfy Phase 105 shape guard", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 613 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 613 }));

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(isRecruitmentWorkflowObservation(contract.observation)).toBe(true);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry, hook, or compatibility observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 614 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 614,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 614 }));

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);

      buildRecruitmentWorkflowObservationContract(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
    });
  });

  describe("no persistence", () => {
    test("contract metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.persistenceEnabled).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.mutatesProduction).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA.sideEffects).toBe(
        false
      );
    });

    test("contract remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 615 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 615 }));

      const contract = buildRecruitmentWorkflowObservationContract(outcome);

      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
      expect(contract.observation.advisory).toBe(true);
      expect(contract.observation.architectureOnly).toBe(true);
      expect(contract.observation.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure contract constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 106");
      expect(source).toContain("buildRecruitmentWorkflowObservationContract");
      expect(source).toContain("isRecruitmentWorkflowObservationContract");
      expect(source).toContain("summarizeRecruitmentWorkflowObservationContract");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("contractOnly");
      expect(source).toContain("sourcePhase");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not import coordinator, registry, pipeline, compatibility layer, or worker", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(source).not.toMatch(/runRecruitmentPipeline/);
      expect(source).not.toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentPipelineIntegrationHook/);
      expect(source).not.toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/recruitmentWorkerObservation/);
    });

    test("module reuses Phase 105 observation service only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowObservationService/);
      expect(source).toMatch(/getRecruitmentWorkflowObservation/);
      expect(source).toMatch(/isRecruitmentWorkflowObservation/);
      expect(source).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("integration contract is not wired into coordinator, pipeline, compatibility layer, registry, worker, observation service, or upstream adapters", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);
      const observationViewSource = read(OBSERVATION_VIEW_MODULE_PATH);
      const diagnosticsAdapterSource = read(DIAGNOSTICS_ADAPTER_MODULE_PATH);
      const diagnosticsAttachmentSource = read(DIAGNOSTICS_ATTACHMENT_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(observationServiceSource).not.toMatch(
        /recruitmentWorkflowObservationIntegrationContract/
      );
      expect(snapshotAdapterSource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(observationViewSource).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(diagnosticsAdapterSource).not.toMatch(
        /recruitmentWorkflowObservationIntegrationContract/
      );
      expect(diagnosticsAttachmentSource).not.toMatch(
        /recruitmentWorkflowObservationIntegrationContract/
      );
    });
  });
});
