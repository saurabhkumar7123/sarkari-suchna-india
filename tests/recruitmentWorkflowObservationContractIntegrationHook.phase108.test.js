"use strict";

/**
 * Phase 108 — Recruitment Workflow Observation Contract Integration Hook tests.
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
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA,
  attachRecruitmentWorkflowObservationContractIntegration,
  peekRecruitmentWorkflowObservationContractIntegration,
  hasRecruitmentWorkflowObservationContractIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook");

const {
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
  "server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook.js";
const ATTACHMENT_MODULE_PATH =
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
    updateId: 108,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-108-trace",
    ...overrides
  };
}

function disabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 108,
    featureFlags: { workflowIntegrationEnabled: false },
    traceId: "phase-108-trace",
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

describe("Phase 108 — recruitmentWorkflowObservationContractIntegrationHook", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE).toBe(108);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_ENTITY).toBe(
        "recruitment_workflow_observation_contract_integration_hook"
      );
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_DESCRIPTOR.phase).toBe(
        108
      );
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.integrationHook
      ).toBe(true);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.readOnly).toBe(
        true
      );
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.invokesCoordinator
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.rebuildsContracts
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.mutatesDiagnostics
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.pipelineWiring
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.sourcePhase
      ).toBe(107);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.persistenceEnabled
      ).toBe(false);
    });
  });

  describe("flag OFF", () => {
    test("returns null when workflow integration flag is disabled in compatibility input", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 801 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 801 }));

      expect(
        attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput())
      ).toBeNull();
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(false);
    });

    test("does nothing when compatibility input is missing or malformed", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 802 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 802 }));

      expect(attachRecruitmentWorkflowObservationContractIntegration(outcome, null)).toBeNull();
      expect(attachRecruitmentWorkflowObservationContractIntegration(outcome, undefined)).toBeNull();
      expect(attachRecruitmentWorkflowObservationContractIntegration(outcome, "bad")).toBeNull();
      expect(
        attachRecruitmentWorkflowObservationContractIntegration(outcome, { featureFlags: null })
      ).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(false);
    });

    test("does not invoke coordinator when flag is off", () => {
      const outcome = { skipped: true, updateId: 803 };

      attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput());

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });

    test("does not store anything in hook WeakMap when flag is off", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 804 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 804 }));

      attachRecruitmentWorkflowObservationContractIntegration(outcome, disabledInput());

      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(false);
    });
  });

  describe("flag ON", () => {
    test("attaches observation contract integration when flag is enabled", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 805 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 805 }));

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 805 })
      );

      expect(contract).not.toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(true);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(contract);
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.metadata.phase).toBe(RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE);
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
    });

    test("wraps complete observation bundle from Phase 107 attachment", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 806 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 806 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const expectedContract = buildRecruitmentWorkflowObservationContract(outcome);
      const integrated = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 806 })
      );

      expect(integrated).toEqual(expectedContract);
      expect(integrated.observation.snapshot).not.toBeNull();
      expect(integrated.observation.attachment).not.toBeNull();
      expect(integrated.observation.observation.status).toBe(OBSERVATION_VIEW_STATUS.READY);
    });

    test("returns null when outcome is not integration-ready even with flag on", () => {
      const outcome = { updateId: 807 };

      expect(
        attachRecruitmentWorkflowObservationContractIntegration(outcome, enabledInput({ updateId: 807 }))
      ).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(false);
    });

    test("attaches contract with empty observation when snapshot is unavailable but registry enables integration", () => {
      const outcome = { updateId: 808 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 808 })
      );

      expect(contract).not.toBeNull();
      expect(isRecruitmentWorkflowObservationContract(contract)).toBe(true);
      expect(contract.observation.snapshot).toBeNull();
    });
  });

  describe("repeated attach", () => {
    test("repeated attach returns the same cached contract reference", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 809 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 809 }));
      const input = enabledInput({ updateId: 809 });

      const first = attachRecruitmentWorkflowObservationContractIntegration(outcome, input);
      const second = attachRecruitmentWorkflowObservationContractIntegration(outcome, input);
      const third = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      expect(second).toBe(first);
      expect(third).toBe(first);
      expect(coordinateRecruitmentWorkflowIntegration).toHaveBeenCalledTimes(1);
    });

    test("always exposes the stable Phase 106 contract key set", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 810 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 810 }));

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 810 })
      );

      expect(Object.keys(contract).sort()).toEqual([...EXPECTED_CONTRACT_KEYS].sort());
    });
  });

  describe("malformed outcome", () => {
    test("never throws for malformed inputs", () => {
      expect(() =>
        attachRecruitmentWorkflowObservationContractIntegration("bad", enabledInput())
      ).not.toThrow();
      expect(() =>
        attachRecruitmentWorkflowObservationContractIntegration([], enabledInput())
      ).not.toThrow();
      expect(() => peekRecruitmentWorkflowObservationContractIntegration(42)).not.toThrow();
      expect(() => hasRecruitmentWorkflowObservationContractIntegration(Symbol("x"))).not.toThrow();
    });

    test("returns null for non-object outcomes", () => {
      expect(
        attachRecruitmentWorkflowObservationContractIntegration(null, enabledInput())
      ).toBeNull();
      expect(
        attachRecruitmentWorkflowObservationContractIntegration(undefined, enabledInput())
      ).toBeNull();
      expect(
        attachRecruitmentWorkflowObservationContractIntegration("bad", enabledInput())
      ).toBeNull();
      expect(hasRecruitmentWorkflowObservationContractIntegration(null)).toBe(false);
    });
  });

  describe("WeakMap isolation", () => {
    test("isolates hook integrations per outcome object", () => {
      const outcomeA = { skipped: false, result: mockProcessorResult(), updateId: 811 };
      const outcomeB = { skipped: false, result: mockProcessorResult(), updateId: 812 };

      attachRecruitmentWorkflowIntegration(outcomeA, enabledInput({ updateId: 811 }));
      attachRecruitmentWorkflowObservationContractIntegration(
        outcomeA,
        enabledInput({ updateId: 811 })
      );

      expect(hasRecruitmentWorkflowObservationContractIntegration(outcomeA)).toBe(true);
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcomeB)).toBe(false);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcomeB)).toBeNull();
    });

    test("peek returns null until hook attach is called", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 813 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 813 }));

      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 813 })
      );

      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(contract);
    });

    test("hook WeakMap is separate from Phase 107 attachment WeakMap", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 814 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 814 }));

      const attachmentContract = attachRecruitmentWorkflowObservationContract(outcome);

      expect(attachmentContract).not.toBeNull();
      expect(hasRecruitmentWorkflowObservationContract(outcome)).toBe(true);
      expect(hasRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(false);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBeNull();

      const hookContract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 814 })
      );

      expect(hookContract).toBe(attachmentContract);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(hookContract);
    });
  });

  describe("deterministic behavior", () => {
    test("integrated contract matches direct Phase 106 build semantics", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 815 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 815 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const integrated = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 815 })
      );
      const direct = buildRecruitmentWorkflowObservationContract(outcome);

      expect(integrated).toEqual(direct);
      expect(integrated).not.toBe(direct);
    });

    test("does not invoke coordinator during hook attach", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 816 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 816 }));
      coordinateRecruitmentWorkflowIntegration.mockClear();

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 816 })
      );
      peekRecruitmentWorkflowObservationContractIntegration(outcome);

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 817 };
      const before = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 817 }));
      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 817 })
      );
      peekRecruitmentWorkflowObservationContractIntegration(outcome);

      expect(JSON.stringify(outcome)).toBe(before);
      expect(outcome).not.toHaveProperty("observation");
      expect(outcome).not.toHaveProperty("contract");
      expect(outcome).not.toHaveProperty("diagnostics");
      expect(outcome).not.toHaveProperty("integration");
    });

    test("does not mutate existing diagnostics attachments", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 818 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 818 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const diagnosticsJsonBefore = JSON.stringify(diagnosticsBefore);

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 818 })
      );

      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(JSON.stringify(peekRecruitmentWorkflowDiagnostics(outcome))).toBe(
        diagnosticsJsonBefore
      );
    });

    test("freezes entire integrated contract object graph", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 819 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 819 }));

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 819 })
      );

      assertAllFrozen(contract);
      expect(() => {
        contract.advisory = false;
      }).toThrow();
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry, hook, compatibility, or diagnostics observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 820 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 820,
        featureFlags: { workflowIntegrationEnabled: false }
      });
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 820 }));
      const attachmentBefore = attachRecruitmentWorkflowObservationContract(outcome);

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);

      attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 820 })
      );

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContract(outcome)).toBe(attachmentBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(attachmentBefore);
    });

    test("compatibility integration path still supports hook integration", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 821 };
      const { buildRecruitmentCompatibilityContext } = require(
        "../server/lib/recruitment/recruitmentCompatibilityLayer"
      );
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 821 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 821 }), context);

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 821 })
      );

      expect(contract).not.toBeNull();
      expect(getRecruitmentWorkflowSnapshot(outcome)).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
    });
  });

  describe("no persistence", () => {
    test("hook metadata declares no persistence or production mutation", () => {
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.persistenceEnabled
      ).toBe(false);
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.mutatesProduction
      ).toBe(false);
      expect(RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.sideEffects).toBe(
        false
      );
      expect(
        RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA.pipelineWiring
      ).toBe(false);
    });

    test("integrated contract remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 822 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 822 }));

      const contract = attachRecruitmentWorkflowObservationContractIntegration(
        outcome,
        enabledInput({ updateId: 822 })
      );

      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(contract.executed).toBe(false);
      expect(contract.observation.advisory).toBe(true);
      expect(contract.observation.architectureOnly).toBe(true);
      expect(contract.observation.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure integration hook constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 108");
      expect(source).toContain("attachRecruitmentWorkflowObservationContractIntegration");
      expect(source).toContain("peekRecruitmentWorkflowObservationContractIntegration");
      expect(source).toContain("hasRecruitmentWorkflowObservationContractIntegration");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("integrationHook");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("sourcePhase: 107");
      expect(source).toContain("pipelineWiring");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module reuses Phase 107 attachment only for contract integration", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowObservationContractAttachment/);
      expect(source).toMatch(/attachRecruitmentWorkflowObservationContract/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationIntegrationContract/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationContract/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationService/);
      expect(source).not.toMatch(/getRecruitmentWorkflowObservation/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/recruitmentWorkflowObservationDiagnosticsAdapter/);
      expect(source).not.toMatch(/recruitmentWorkflowDiagnosticsAttachment/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowDiagnostics/);
    });

    test("module does not invoke coordinator, rebuild snapshots, or modify diagnostics", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationView/);
      expect(source).not.toMatch(/buildRecruitmentWorkflowObservationDiagnostics/);
      expect(source).not.toMatch(/appendExecutionStage/);
      expect(source).not.toMatch(/recordWorkflowObservation/);
    });

    test("integration hook module is not wired into coordinator, compatibility layer, registry, worker, observation service, Phase 107 attachment, integration contract, or upstream adapters", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationServiceSource = read(OBSERVATION_SERVICE_MODULE_PATH);
      const attachmentSource = read(ATTACHMENT_MODULE_PATH);
      const integrationContractSource = read(INTEGRATION_CONTRACT_MODULE_PATH);
      const snapshotAdapterSource = read(SNAPSHOT_ADAPTER_MODULE_PATH);
      const observationViewSource = read(OBSERVATION_VIEW_MODULE_PATH);
      const diagnosticsAdapterSource = read(DIAGNOSTICS_ADAPTER_MODULE_PATH);
      const diagnosticsAttachmentSource = read(DIAGNOSTICS_ATTACHMENT_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(compatibilitySource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(pipelineSource).toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(pipelineSource).toMatch(/attachRecruitmentWorkflowObservationContractIntegration/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowObservationContractIntegrationHook/);
      expect(observationServiceSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(attachmentSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(integrationContractSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(snapshotAdapterSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(observationViewSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(diagnosticsAdapterSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
      expect(diagnosticsAttachmentSource).not.toMatch(
        /recruitmentWorkflowObservationContractIntegrationHook/
      );
    });
  });
});
