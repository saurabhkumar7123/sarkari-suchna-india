"use strict";

/**
 * Phase 64 — Recruitment Lifecycle Contracts tests.
 * Transition integrity, helper correctness, graph consistency, uniqueness,
 * immutability, circular references, descriptive-only architecture, and zero
 * runtime dependencies.
 */

const fs = require("fs");
const path = require("path");

const {
  LIFECYCLE_CONTRACTS_PHASE,
  LIFECYCLE_STAGE_GROUPS,
  LIFECYCLE_EVENT_CONTRACTS,
  LIFECYCLE_EVENT_CONTRACT_BY_ID,
  SUPPORTED_LIFECYCLE_CONTRACT_IDS,
  PRIMARY_LIFECYCLE_CONTRACT_IDS,
  TERMINAL_LIFECYCLE_CONTRACT_IDS,
  LIFECYCLE_CONTRACT_METADATA,
  getLifecycleEventContract,
  listLifecycleEventContractsInOrder,
  isValidLifecycleTransition,
  getNextLifecycleEvents,
  getPreviousLifecycleEvents,
  isTerminalTransition,
  isPrimaryTransition,
  summarizeRecruitmentLifecycleContracts
} = require("../server/lib/recruitment/recruitmentLifecycleContracts");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentLifecycleContracts.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function hasCircularReference(value, seen = new WeakSet(), stack = new WeakSet()) {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (stack.has(value)) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  stack.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (hasCircularReference(value[i], seen, stack)) {
        return true;
      }
    }
    stack.delete(value);
    return false;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (hasCircularReference(value[keys[i]], seen, stack)) {
      return true;
    }
  }
  stack.delete(value);
  return false;
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  nodes.push(value);
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

function collectReferencedIds(contract) {
  return [
    ...contract.previousEvents,
    ...contract.nextEvents,
    ...contract.optionalPredecessors,
    ...contract.allowedSuccessors
  ];
}

describe("Phase 64 — recruitmentLifecycleContracts", () => {
  describe("exports", () => {
    test("exposes phase 64 lifecycle contract constants and metadata", () => {
      expect(LIFECYCLE_CONTRACTS_PHASE).toBe(64);
      expect(LIFECYCLE_CONTRACT_METADATA.phase).toBe(64);
      expect(LIFECYCLE_CONTRACT_METADATA.descriptiveOnly).toBe(true);
      expect(LIFECYCLE_CONTRACT_METADATA.runtimeIntegration).toBe(false);
      expect(LIFECYCLE_CONTRACT_METADATA.buildsOnDomainModelPhase).toBe(63);
      expect(LIFECYCLE_EVENT_CONTRACTS.length).toBe(14);
      expect(SUPPORTED_LIFECYCLE_CONTRACT_IDS.size).toBe(14);
    });

    test("primary and terminal contract id lists match contract flags", () => {
      expect(PRIMARY_LIFECYCLE_CONTRACT_IDS).toEqual([
        "notification",
        "short_notification"
      ]);
      expect(TERMINAL_LIFECYCLE_CONTRACT_IDS).toEqual([
        "final_result",
        "joining"
      ]);
      for (const id of PRIMARY_LIFECYCLE_CONTRACT_IDS) {
        expect(getLifecycleEventContract(id).primary).toBe(true);
      }
      for (const id of TERMINAL_LIFECYCLE_CONTRACT_IDS) {
        expect(getLifecycleEventContract(id).terminal).toBe(true);
      }
    });

    test("summarizeRecruitmentLifecycleContracts returns frozen advisory summary", () => {
      const summary = summarizeRecruitmentLifecycleContracts();
      expect(summary).toEqual({
        phase: 64,
        contractCount: LIFECYCLE_EVENT_CONTRACTS.length,
        primaryContractIds: PRIMARY_LIFECYCLE_CONTRACT_IDS,
        terminalContractIds: TERMINAL_LIFECYCLE_CONTRACT_IDS,
        stageGroupCount: Object.keys(LIFECYCLE_STAGE_GROUPS).length,
        descriptiveOnly: true,
        architectureOnly: true,
        runtimeIntegration: false,
        persistenceEnabled: false,
        sideEffects: false,
        buildsOnDomainModelPhase: 63
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("listLifecycleEventContractsInOrder returns the canonical frozen catalog", () => {
      expect(listLifecycleEventContractsInOrder()).toBe(LIFECYCLE_EVENT_CONTRACTS);
    });
  });

  describe("contract uniqueness", () => {
    test("contract ids are unique", () => {
      const ids = LIFECYCLE_EVENT_CONTRACTS.map((contract) => contract.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("persisted event types appear at most once in contracts", () => {
      const persistedTypes = LIFECYCLE_EVENT_CONTRACTS.filter(
        (contract) => contract.eventType != null
      ).map((contract) => contract.eventType);
      expect(new Set(persistedTypes).size).toBe(persistedTypes.length);
    });

    test("contract orders are strictly increasing", () => {
      const orders = LIFECYCLE_EVENT_CONTRACTS.map((contract) => contract.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("lookup map references the same frozen contract objects", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        expect(LIFECYCLE_EVENT_CONTRACT_BY_ID[contract.id]).toBe(contract);
      }
    });

    test("every contract id is registered in the supported set", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        expect(SUPPORTED_LIFECYCLE_CONTRACT_IDS.has(contract.id)).toBe(true);
      }
    });
  });

  describe("graph consistency", () => {
    test("all referenced transition ids resolve to known contracts", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        for (const refId of collectReferencedIds(contract)) {
          expect(SUPPORTED_LIFECYCLE_CONTRACT_IDS.has(refId)).toBe(true);
        }
      }
    });

    test("allowed successors are a superset of typical next events", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        for (const nextId of contract.nextEvents) {
          expect(contract.allowedSuccessors).toContain(nextId);
        }
      }
    });

    test("typical previous events appear in optional or required predecessor lists", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        for (const prevId of contract.previousEvents) {
          const predecessor =
            prevId === "application_window"
              ? getLifecycleEventContract(prevId)
              : getLifecycleEventContract(prevId);
          const allowedFrom =
            predecessor.allowedSuccessors.includes(contract.id) ||
            contract.optionalPredecessors.includes(prevId);
          expect(allowedFrom).toBe(true);
        }
      }
    });

    test("bidirectional successor links have matching predecessor metadata", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        for (const successorId of contract.allowedSuccessors) {
          const successor = getLifecycleEventContract(successorId);
          const hasBackLink =
            successor.previousEvents.includes(contract.id) ||
            successor.optionalPredecessors.includes(contract.id);
          expect(hasBackLink).toBe(true);
        }
      }
    });

    test("completion terminal contract has no successors; result terminal may still branch", () => {
      const joining = getLifecycleEventContract("joining");
      expect(joining.allowedSuccessors).toEqual([]);
      expect(joining.nextEvents).toEqual([]);

      const finalResult = getLifecycleEventContract("final_result");
      expect(finalResult.terminal).toBe(true);
      expect(finalResult.allowedSuccessors).toEqual(["medical", "joining"]);
    });

    test("primary contracts have no required previous events", () => {
      for (const id of PRIMARY_LIFECYCLE_CONTRACT_IDS) {
        expect(getLifecycleEventContract(id).previousEvents).toEqual([]);
      }
    });

    test("every contract exposes stage group and advisory notes", () => {
      for (const contract of LIFECYCLE_EVENT_CONTRACTS) {
        expect(Object.values(LIFECYCLE_STAGE_GROUPS)).toContain(
          contract.stageGroup
        );
        expect(Array.isArray(contract.advisoryNotes)).toBe(true);
        expect(contract.advisoryNotes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("isValidLifecycleTransition", () => {
    test("accepts initial transitions to primary events only", () => {
      expect(isValidLifecycleTransition(null, "notification")).toBe(true);
      expect(isValidLifecycleTransition(undefined, "short_notification")).toBe(
        true
      );
      expect(isValidLifecycleTransition("", "notification")).toBe(true);
      expect(isValidLifecycleTransition(null, "admit_card")).toBe(false);
      expect(isValidLifecycleTransition(null, "unknown")).toBe(false);
    });

    test("accepts declared allowed successor transitions", () => {
      expect(isValidLifecycleTransition("notification", "exam_date")).toBe(true);
      expect(isValidLifecycleTransition("notification", "correction")).toBe(true);
      expect(isValidLifecycleTransition("exam_date", "admit_card")).toBe(true);
      expect(isValidLifecycleTransition("answer_key", "result")).toBe(true);
      expect(isValidLifecycleTransition("result", "dv")).toBe(true);
    });

    test("rejects undeclared transitions", () => {
      expect(isValidLifecycleTransition("notification", "joining")).toBe(false);
      expect(isValidLifecycleTransition("admit_card", "result")).toBe(false);
      expect(isValidLifecycleTransition("joining", "final_result")).toBe(false);
      expect(isValidLifecycleTransition("bogus", "notification")).toBe(false);
    });

    test("allows self-transitions only when contract is repeatable", () => {
      expect(isValidLifecycleTransition("correction", "correction")).toBe(true);
      expect(isValidLifecycleTransition("exam_date", "exam_date")).toBe(true);
      expect(isValidLifecycleTransition("result", "result")).toBe(true);
      expect(isValidLifecycleTransition("admit_card", "admit_card")).toBe(false);
      expect(isValidLifecycleTransition("notification", "notification")).toBe(
        false
      );
    });
  });

  describe("getNextLifecycleEvents and getPreviousLifecycleEvents", () => {
    test("getNextLifecycleEvents(null) lists primary entry contracts", () => {
      expect(getNextLifecycleEvents(null)).toEqual([
        "notification",
        "short_notification"
      ]);
      expect(Object.isFrozen(getNextLifecycleEvents(null))).toBe(true);
    });

    test("getNextLifecycleEvents returns typical next events for known ids", () => {
      expect(getNextLifecycleEvents("exam_date")).toEqual([
        "city_intimation",
        "admit_card"
      ]);
      expect(getNextLifecycleEvents("answer_key")).toEqual([
        "objection",
        "result"
      ]);
      expect(getNextLifecycleEvents("joining")).toEqual([]);
    });

    test("getPreviousLifecycleEvents returns typical previous events", () => {
      expect(getPreviousLifecycleEvents("exam_date")).toEqual([
        "notification",
        "short_notification",
        "correction"
      ]);
      expect(getPreviousLifecycleEvents("joining")).toEqual([
        "final_result",
        "medical",
        "dv"
      ]);
      expect(getPreviousLifecycleEvents(null)).toEqual([]);
    });

    test("helpers return empty frozen arrays for unknown ids", () => {
      expect(getNextLifecycleEvents("missing")).toEqual([]);
      expect(getPreviousLifecycleEvents("missing")).toEqual([]);
      expect(Object.isFrozen(getNextLifecycleEvents("missing"))).toBe(true);
      expect(Object.isFrozen(getPreviousLifecycleEvents("missing"))).toBe(true);
    });
  });

  describe("isTerminalTransition and isPrimaryTransition", () => {
    test("isPrimaryTransition identifies initial primary event adoption", () => {
      expect(isPrimaryTransition(null, "notification")).toBe(true);
      expect(isPrimaryTransition(null, "short_notification")).toBe(true);
      expect(isPrimaryTransition("notification", "exam_date")).toBe(false);
      expect(isPrimaryTransition(null, "admit_card")).toBe(false);
    });

    test("isTerminalTransition requires valid transition to a terminal contract", () => {
      expect(isTerminalTransition("result", "final_result")).toBe(true);
      expect(isTerminalTransition("medical", "joining")).toBe(true);
      expect(isTerminalTransition("result", "joining")).toBe(false);
      expect(isTerminalTransition("notification", "final_result")).toBe(false);
      expect(isTerminalTransition(null, "joining")).toBe(false);
    });

    test("transition classifiers return false for unknown targets", () => {
      expect(isTerminalTransition("result", "bogus")).toBe(false);
      expect(isPrimaryTransition(null, "bogus")).toBe(false);
      expect(isTerminalTransition(null, null)).toBe(false);
    });
  });

  describe("getLifecycleEventContract", () => {
    test("returns frozen contract for known ids", () => {
      const contract = getLifecycleEventContract("correction");
      expect(contract).toEqual(
        expect.objectContaining({
          id: "correction",
          repeatable: true,
          stageGroup: LIFECYCLE_STAGE_GROUPS.CORRECTION
        })
      );
      expect(Object.isFrozen(contract)).toBe(true);
    });

    test("returns null for empty or unknown ids", () => {
      expect(getLifecycleEventContract("")).toBeNull();
      expect(getLifecycleEventContract("   ")).toBeNull();
      expect(getLifecycleEventContract("not-a-stage")).toBeNull();
      expect(getLifecycleEventContract(null)).toBeNull();
    });

    test("conceptual application_window contract is descriptive only", () => {
      const contract = getLifecycleEventContract("application_window");
      expect(contract.conceptual).toBe(true);
      expect(contract.eventType).toBeNull();
      expect(contract.stageGroup).toBe(LIFECYCLE_STAGE_GROUPS.APPLICATION);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(LIFECYCLE_EVENT_CONTRACTS)).toBe(true);
      expect(Object.isFrozen(LIFECYCLE_EVENT_CONTRACT_BY_ID)).toBe(true);
      expect(Object.isFrozen(LIFECYCLE_CONTRACT_METADATA)).toBe(true);
      expect(Object.isFrozen(PRIMARY_LIFECYCLE_CONTRACT_IDS)).toBe(true);
      expect(Object.isFrozen(TERMINAL_LIFECYCLE_CONTRACT_IDS)).toBe(true);
    });

    test("nested contract graph is deeply frozen", () => {
      assertAllFrozen(LIFECYCLE_EVENT_CONTRACTS);
      assertAllFrozen(LIFECYCLE_EVENT_CONTRACT_BY_ID);
      assertAllFrozen(LIFECYCLE_CONTRACT_METADATA);
    });

    test("mutation attempts on contract catalog do not change exports", () => {
      const before = LIFECYCLE_EVENT_CONTRACTS.length;
      expect(() => {
        LIFECYCLE_EVENT_CONTRACTS.push({});
      }).toThrow();
      expect(LIFECYCLE_EVENT_CONTRACTS.length).toBe(before);
    });

    test("mutation attempts on contract transition arrays are rejected", () => {
      const correction = getLifecycleEventContract("correction");
      expect(() => {
        correction.allowedSuccessors.push("joining");
      }).toThrow();
      expect(correction.allowedSuccessors).not.toContain("joining");
    });
  });

  describe("circular references", () => {
    test("exported contract graph has no circular references", () => {
      expect(hasCircularReference(LIFECYCLE_EVENT_CONTRACTS)).toBe(false);
      expect(hasCircularReference(LIFECYCLE_EVENT_CONTRACT_BY_ID)).toBe(false);
      expect(hasCircularReference(LIFECYCLE_CONTRACT_METADATA)).toBe(false);
    });
  });

  describe("descriptive-only architecture", () => {
    test("helpers only read contract metadata without side effects", () => {
      const before = summarizeRecruitmentLifecycleContracts();
      isValidLifecycleTransition("notification", "exam_date");
      getNextLifecycleEvents("result");
      getPreviousLifecycleEvents("dv");
      isTerminalTransition("dv", "joining");
      isPrimaryTransition(null, "notification");
      const after = summarizeRecruitmentLifecycleContracts();
      expect(after).toEqual(before);
      expect(LIFECYCLE_CONTRACT_METADATA.sideEffects).toBe(false);
    });

    test("contracts align with phase 63 lifecycle vocabulary without importing it", () => {
      const persistedTypes = LIFECYCLE_EVENT_CONTRACTS.filter(
        (contract) => contract.eventType != null
      ).map((contract) => contract.eventType);
      expect(persistedTypes.sort()).toEqual(
        [
          "notification",
          "short_notification",
          "correction",
          "exam_date",
          "city_intimation",
          "admit_card",
          "answer_key",
          "objection",
          "result",
          "final_result",
          "dv",
          "medical",
          "joining"
        ].sort()
      );
    });
  });

  describe("architecture boundaries (source)", () => {
    test("lifecycle contracts module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 64/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("lifecycle contracts module has zero require dependencies", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("production modules are unchanged — lifecycle contracts not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentLifecycleContracts/);

      const domainModel = read("server/lib/recruitment/recruitmentDomainModel.js");
      expect(domainModel).not.toMatch(/recruitmentLifecycleContracts/);

      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const policy = read("server/lib/recruitment/runtimePersistencePolicy.js");
      expect(preview).not.toMatch(/recruitmentLifecycleContracts/);
      expect(policy).not.toMatch(/recruitmentLifecycleContracts/);
    });

    test("runtime, capability, and diagnostics modules do not import lifecycle contracts", () => {
      const modules = [
        "server/lib/recruitment/runtimeCapabilityRegistry.js",
        "server/lib/recruitment/runtimeCapabilityPreviewIntegration.js",
        "server/lib/recruitment/previewIntegrationContract.js",
        "server/lib/recruitment/executionDiagnostics.js",
        "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js",
        "server/lib/recruitment/runRecruitmentPipeline.js"
      ];
      for (const relPath of modules) {
        expect(read(relPath)).not.toMatch(/recruitmentLifecycleContracts/);
      }
    });
  });
});
