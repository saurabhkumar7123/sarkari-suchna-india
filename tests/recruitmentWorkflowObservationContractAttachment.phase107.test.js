"use strict";

/**
 * Phase 107 — Recruitment Workflow Observation Contract Runtime Attachment tests.
 * Flag OFF/ON, repeated attach, malformed outcome, WeakMap isolation, determinism,
 * immutability, backward compatibility, and no persistence.
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
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA,
  attachRecruitmentWorkflowObservationContract,
  peekRecruitmentWorkflowObservationContract,
  hasRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractAttachment");

const {
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  EXPECTED_CONTRACT_KEYS,
  buildRecruitmentWorkflowObservationContract,
  isRecruitmentWorkflowObservationContract
} = require("../server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration
} = require("../server/lib/recruitment/recruitmentCompatibilityIntegrationHook");

const {
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotAdapter");

const {
  OBSERVATION_VIEW_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationView");

const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationContractAttachment.js";
const INTEGRATION_CONTRACT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationIntegrationContract.js";
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
const OBSERVATION_SERVICE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationService.js";

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
    updateId: 107,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-107-trace",
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

describe("Phase 107 — recruitmentWorkflowObservationContractAttachment", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE).toBe(107);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_ENTITY).toBe(
        "recruitment_workflow_observation_contract_attachment"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_DESCRIPTOR.phase).toBe(107);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.attachmentOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.invokesCoordinator).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.rebuildsSnapshots).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.sourcePhase).toBe(106);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.persistenceEnabled).toBe(
        false
      );
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.runtimeIntegration
      ).toBe(true);
    });
  });

  describe("flag OFF", () => {
    test("returns null when workflow integration flag is disabled", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 701 };

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(attachRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(false);
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
    });

    test("does not invoke coordinator when flag is off", () => {
      const outcome = { skipped: true, updateId: 702 };

      attachRecruitmentWorkflowObservationContract(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });

    test("does not store anything in WeakMap when flag is off", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 703 };
      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      attachRecruitmentWorkflowObservationContract(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(false);
    });
  });

  describe("flag ON", () => {
    test("attaches observation integration contract when integration is enabled", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 704 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 704 }));

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(contract).not.toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(true);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(contract);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.metadata.phase).toBe(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE);
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
    });

    test("wraps complete observation bundle from Phase 106 contract", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 705 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 705 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const expectedContract = buildRecruitmentWorkflowObservationContract(outcome);
      const attached = attachRecruitmentWorkflowObservationContract(outcome);

      expect(attached).toEqual(expectedContract);
      expect(attached.observation.snapshot).not.toBeNull();
      expect(attached.observation.attachment).not.toBeNull();
      expect(attached.observation.observation.status).toBe(OBSERVATION_VIEW_STATUS.READY);
    });

    test("attaches contract with empty observation when snapshot is unavailable but flag is on", () => {
      const outcome = { updateId: 706 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(contract).not.toBeNull();
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.observation.snapshot).toBeNull();
    });
  });

  describe("repeated attach", () => {
    test("repeated attach returns the same cached contract reference", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 707 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 707 }));

      const first = attachRecruitmentWorkflowObservationContract(outcome);
      const second = attachRecruitmentWorkflowObservationContract(outcome);
      const third = peekRecruitmentWorkflowObservationContract(outcome);

      expect(second).toBe(first);
      expect(third).toBe(first);
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("always exposes the stable Phase 106 contract key set", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 708 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 708 }));

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(Object.keys(contract).sort()).toEqual([...EXPECTED_CONTRACT_KEYS].sort());
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() => attachRecruitmentWorkflowObservationContract("bad")).not.toThrow();
      expect(() => attachRecruitmentWorkflowObservationContract([])).not.toThrow();
      expect(() => peekRecruitmentWorkflowObservationContract(42)).not.toThrow();
      expect(() => hasRecruitmentWorkflowObservationContract(Symbol("x"))).not.toThrow();
    });

    test("returns null for non-object inputs", () => {
      expect(attachRecruitmentWorkflowObservationContract(null)).toBeNull();
      expect(attachRecruitmentWorkflowObservationContract(undefined)).toBeNull();
      expect(attachRecruitmentWorkflowObservationContract("bad")).toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(null)).toBe(false);
    });

    test("returns null when featureEnabled is false even with registry observation", () => {
      const outcome = { updateId: 709 };
      recordWorkflowObservation(outcome, {
        featureEnabled: false,
        plannedWorkflow: null,
        diagnostics: {}
      });

      expect(attachRecruitmentWorkflowObservationContract(outcome)).toBeNull();
    });
  });

  describe("WeakMap isolation", () => {
    test("isolates attachments per outcome object", () => {
      const outcomeA = { skipped: false, result: mockProcessorResult(), updateId: 710 };
      const outcomeB = { skipped: false, result: mockProcessorResult(), updateId: 711 };

      attachRecruitmentWorkflowIntegration(outcomeA, enabledInput({ updateId: 710 }));
      attachRecruitmentWorkflowObservationContract(outcomeA);

      expect(hasRecruitmentWorkflowObservationContract(outcomeA)).toBe(true);
      expect(hasRecruitmentWorkflowObservationContract(outcomeB)).toBe(false);
      expect(peekRecruitmentWorkflowObservationContract(outcomeB)).toBeNull();
    });

    test("peek returns null until attach is called", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 712 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 712 }));

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBeNull();

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(contract);
    });
  });

  describe("deterministic behavior", () => {
    test("attached contract matches direct Phase 106 build semantics", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 713 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 713 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const attached = attachRecruitmentWorkflowObservationContract(outcome);
      const direct = buildRecruitmentWorkflowObservationContract(outcome);

      expect(attached).toEqual(direct);
      expect(attached).not.toBe(direct);
    });

    test("does not invoke coordinator during attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 714 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 714 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      attachRecruitmentWorkflowObservationContract(outcome);
      peekRecruitmentWorkflowObservationContract(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 715 };
      const before = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 715 }));
      attachRecruitmentWorkflowObservationContract(outcome);
      peekRecruitmentWorkflowObservationContract(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("contract");
      expect(outcome).not.toHaveProperty("diagnostics");
    });

    test("freezes entire attached contract object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 716 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 716 }));

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      assertAllFrozen(contract);
      expect(() => {
        contract.advisory = false;
      }).toThrow();
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry, hook, or compatibility observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 717 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 717,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 717 }));

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);

      attachRecruitmentWorkflowObservationContract(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
    });

    test("compatibility integration path still supports contract attachment", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 718 };
      const { buildRecruitmentCompatibilityContext } = require(
        "../server/lib/recruitment/recruitmentCompatibilityLayer"
      );
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 718 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 718 }), context);

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(contract).not.toBeNull();
      expect(getRecruitmentWorkflowSnapshot(outcome)).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
    });
  });

  describe("no persistence", () => {
    test("attachment metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.persistenceEnabled).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.mutatesProduction).toBe(
        false
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA.sideEffects).toBe(
        false
      );
    });

    test("attached contract remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 719 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 719 }));

      const contract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
      expect(contract.observation.advisory).toBe(true);
      expect(contract.observation.architectureOnly).toBe(true);
      expect(contract.observation.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure attachment constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 107");
      expect(source).toContain("attachRecruitmentWorkflowObservationContract");
      expect(source).toContain("peekRecruitmentWorkflowObservationContract");
      expect(source).toContain("hasRecruitmentWorkflowObservationContract");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("attachmentOnly");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhase: 106");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not invoke coordinator or rebuild snapshots", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
    });

    test("module reuses Phase 106 integration contract only for contract building", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(source).toMatch(/buildRecruitmentWorkflowObservationContract/);
      expect(source).toMatch(/isRecruitmentWorkflowObservationContract/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(source).not.toMatch(/getRecruitmentWorkflowObservation/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
    });

    test("module peeks existing integration state for flag resolution without mutating hooks", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/getRecruitmentWorkflowSnapshot/);
      expect(source).toMatch(/peekWorkflowObservation/);
      expect(source).toMatch(/peekRecruitmentWorkflowIntegration/);
      expect(source).toMatch(/peekRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/recordWorkflowObservation/);
      expect(source).not.toMatch(/attachRecruitmentPipelineDiagnostics/);
    });

    test("attachment module is not wired into coordinator, pipeline, compatibility layer, registry, worker, observation service, integration contract, or upstream adapters", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const integrationContractSource = read(INTEGRATION_CONTRACT_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);
      const observationViewSource = read(OBSERVATION_VIEW_MODULE_PATH);
      const diagnosticsAdapterSource = read(DIAGNOSTICS_ADAPTER_MODULE_PATH);
      const diagnosticsAttachmentSource = read(DIAGNOSTICS_ATTACHMENT_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(observationServiceSource).not.toMatch(
        /recruitmentWorkflowObservationContractAttachment/
      );
      expect(integrationContractSource).not.toMatch(
        /recruitmentWorkflowObservationContractAttachment/
      );
      expect(snapshotAdapterSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(observationViewSource).not.toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(diagnosticsAdapterSource).not.toMatch(
        /recruitmentWorkflowObservationContractAttachment/
      );
      expect(diagnosticsAttachmentSource).not.toMatch(
        /recruitmentWorkflowObservationContractAttachment/
      );
    });
  });
});
