"use strict";

/**
 * Phase 80 — Recruitment Lifecycle State Descriptor tests.
 * Registry integrity, lookup helpers, immutability, deterministic output,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY,
  RECRUITMENT_LIFECYCLE_STATES,
  RECRUITMENT_LIFECYCLE_STATE_BY_STATE,
  SUPPORTED_LIFECYCLE_STATES,
  TERMINAL_LIFECYCLE_STATES,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA,
  LIFECYCLE_STATE_VALIDATION_REASONS,
  getLifecycleStateDescriptor,
  isValidLifecycleState,
  isTerminalLifecycleState,
  getLifecycleStateOrder,
  listLifecycleStatesInOrder,
  validateLifecycleStateDescriptor,
  summarizeRecruitmentLifecycleStateDescriptors
} = require("../server/lib/recruitment/recruitmentLifecycleStateDescriptor");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentLifecycleStateDescriptor.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";

const EXPECTED_STATES = Object.freeze([
  "DISCOVERED",
  "NOTIFICATION_AVAILABLE",
  "APPLICATION_OPEN",
  "APPLICATION_CLOSED",
  "CORRECTION_WINDOW",
  "EXAM_STAGE",
  "ANSWER_KEY_STAGE",
  "RESULT_STAGE",
  "FINAL_RESULT_STAGE",
  "JOINING_STAGE",
  "COMPLETED"
]);

const EXPECTED_ORDERS = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]);

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

describe("Phase 80 — recruitmentLifecycleStateDescriptor", () => {
  describe("exports", () => {
    test("exposes phase 80 constants and descriptor", () => {
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE).toBe(80);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY).toBe(
        "recruitment_lifecycle_state"
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR.entity).toBe(
        "recruitment_lifecycle_state"
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR.phase).toBe(80);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.runtimeIntegration).toBe(
        false
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.performsStateTransitions).toBe(
        false
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.infersStateFromEvents).toBe(
        false
      );
    });

    test("exports all required lifecycle states", () => {
      expect(RECRUITMENT_LIFECYCLE_STATES).toHaveLength(EXPECTED_STATES.length);
      expect(RECRUITMENT_LIFECYCLE_STATES.map((descriptor) => descriptor.state)).toEqual(
        [...EXPECTED_STATES]
      );
      expect([...SUPPORTED_LIFECYCLE_STATES]).toEqual([...EXPECTED_STATES]);
    });

    test("registry validation passes for canonical descriptors", () => {
      const validation = validateLifecycleStateDescriptor();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.reasons).toEqual([LIFECYCLE_STATE_VALIDATION_REASONS.VALID]);
    });
  });

  describe("state descriptor structure", () => {
    test("each descriptor includes required metadata fields", () => {
      for (let i = 0; i < RECRUITMENT_LIFECYCLE_STATES.length; i += 1) {
        const descriptor = RECRUITMENT_LIFECYCLE_STATES[i];
        expect(descriptor).toEqual(
          expect.objectContaining({
            state: EXPECTED_STATES[i],
            label: expect.any(String),
            order: EXPECTED_ORDERS[i],
            description: expect.any(String),
            terminal: expect.any(Boolean)
          })
        );
        expect(descriptor.label.trim()).not.toBe("");
        expect(descriptor.description.trim()).not.toBe("");
      }
    });

    test("BY_STATE map mirrors registry entries", () => {
      for (let i = 0; i < EXPECTED_STATES.length; i += 1) {
        const state = EXPECTED_STATES[i];
        expect(RECRUITMENT_LIFECYCLE_STATE_BY_STATE[state]).toBe(
          RECRUITMENT_LIFECYCLE_STATES[i]
        );
      }
    });
  });

  describe("ordering", () => {
    test("states are in strictly increasing deterministic order", () => {
      const orders = RECRUITMENT_LIFECYCLE_STATES.map((descriptor) => descriptor.order);
      expect(orders).toEqual([...EXPECTED_ORDERS]);

      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("listLifecycleStatesInOrder returns frozen registry in order", () => {
      const listed = listLifecycleStatesInOrder();
      expect(listed).toEqual(RECRUITMENT_LIFECYCLE_STATES);
      expect(listed).toBe(RECRUITMENT_LIFECYCLE_STATES);
      expect(Object.isFrozen(listed)).toBe(true);
    });

    test("getLifecycleStateOrder returns order for valid states only", () => {
      for (let i = 0; i < EXPECTED_STATES.length; i += 1) {
        expect(getLifecycleStateOrder(EXPECTED_STATES[i])).toBe(EXPECTED_ORDERS[i]);
      }
      expect(getLifecycleStateOrder("UNKNOWN")).toBeNull();
      expect(getLifecycleStateOrder(null)).toBeNull();
      expect(getLifecycleStateOrder("")).toBeNull();
    });
  });

  describe("descriptor lookup", () => {
    test("getLifecycleStateDescriptor returns frozen descriptors", () => {
      const descriptor = getLifecycleStateDescriptor("APPLICATION_OPEN");
      expect(descriptor).toEqual(
        expect.objectContaining({
          state: "APPLICATION_OPEN",
          label: "Application Open",
          order: 30,
          terminal: false
        })
      );
      expect(Object.isFrozen(descriptor)).toBe(true);
    });

    test("lookup is case-sensitive and trims surrounding whitespace", () => {
      expect(getLifecycleStateDescriptor("  EXAM_STAGE  ")).toEqual(
        getLifecycleStateDescriptor("EXAM_STAGE")
      );
      expect(getLifecycleStateDescriptor("exam_stage")).toBeNull();
      expect(getLifecycleStateDescriptor(" EXAM_STAGE ")).toEqual(
        getLifecycleStateDescriptor("EXAM_STAGE")
      );
    });

    test("isValidLifecycleState recognizes supported states", () => {
      for (let i = 0; i < EXPECTED_STATES.length; i += 1) {
        expect(isValidLifecycleState(EXPECTED_STATES[i])).toBe(true);
      }
      expect(isValidLifecycleState("  RESULT_STAGE ")).toBe(true);
      expect(isValidLifecycleState("INVALID")).toBe(false);
      expect(isValidLifecycleState(undefined)).toBe(false);
      expect(isValidLifecycleState(42)).toBe(false);
    });
  });

  describe("terminal states", () => {
    test("only COMPLETED is terminal", () => {
      expect(TERMINAL_LIFECYCLE_STATES).toEqual(["COMPLETED"]);
      expect(isTerminalLifecycleState("COMPLETED")).toBe(true);
      expect(isTerminalLifecycleState("JOINING_STAGE")).toBe(false);
      expect(isTerminalLifecycleState("DISCOVERED")).toBe(false);
    });

    test("terminal flag matches descriptor metadata", () => {
      for (let i = 0; i < RECRUITMENT_LIFECYCLE_STATES.length; i += 1) {
        const descriptor = RECRUITMENT_LIFECYCLE_STATES[i];
        expect(isTerminalLifecycleState(descriptor.state)).toBe(descriptor.terminal);
      }
    });

    test("invalid states are not terminal", () => {
      expect(isTerminalLifecycleState("UNKNOWN")).toBe(false);
      expect(isTerminalLifecycleState(null)).toBe(false);
    });
  });

  describe("invalid state handling", () => {
    test("lookup helpers return null or false for unsupported input", () => {
      expect(getLifecycleStateDescriptor(null)).toBeNull();
      expect(getLifecycleStateDescriptor(undefined)).toBeNull();
      expect(getLifecycleStateDescriptor("")).toBeNull();
      expect(getLifecycleStateDescriptor("NOT_A_STATE")).toBeNull();
      expect(isValidLifecycleState("NOT_A_STATE")).toBe(false);
      expect(getLifecycleStateOrder("NOT_A_STATE")).toBeNull();
    });
  });

  describe("immutability", () => {
    test("registry, maps, and metadata are deeply frozen", () => {
      assertAllFrozen(RECRUITMENT_LIFECYCLE_STATES);
      assertAllFrozen(RECRUITMENT_LIFECYCLE_STATE_BY_STATE);
      assertAllFrozen(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR);
      assertAllFrozen(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA);
      assertAllFrozen(TERMINAL_LIFECYCLE_STATES);
    });

    test("mutation attempts on frozen registry throw", () => {
      expect(() => {
        RECRUITMENT_LIFECYCLE_STATES.push({});
      }).toThrow();

      expect(() => {
        RECRUITMENT_LIFECYCLE_STATES[0].label = "mutated";
      }).toThrow();

      expect(() => {
        RECRUITMENT_LIFECYCLE_STATE_BY_STATE.DISCOVERED = {};
      }).toThrow();
    });

    test("validation and summary results are frozen", () => {
      const validation = validateLifecycleStateDescriptor();
      const summary = summarizeRecruitmentLifecycleStateDescriptors();

      expect(Object.isFrozen(validation)).toBe(true);
      expect(Object.isFrozen(validation.errors)).toBe(true);
      expect(Object.isFrozen(validation.reasons)).toBe(true);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("registry has no circular references", () => {
      expect(hasCircularReference(RECRUITMENT_LIFECYCLE_STATES)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR)).toBe(false);
    });
  });

  describe("deterministic output", () => {
    test("summary helper returns stable frozen output", () => {
      const first = summarizeRecruitmentLifecycleStateDescriptors();
      const second = summarizeRecruitmentLifecycleStateDescriptors();

      expect(first).toEqual(second);
      expect(first).toEqual(
        expect.objectContaining({
          phase: 80,
          entity: "recruitment_lifecycle_state",
          stateCount: 11,
          terminalStates: ["COMPLETED"],
          firstState: "DISCOVERED",
          lastState: "COMPLETED",
          descriptiveOnly: true,
          readOnly: true,
          runtimeIntegration: false,
          performsStateTransitions: false,
          infersStateFromEvents: false
        })
      );
    });

    test("validation output is deterministic across calls", () => {
      expect(validateLifecycleStateDescriptor()).toEqual(validateLifecycleStateDescriptor());
    });

    test("lookup helpers return consistent references for the same state", () => {
      const first = getLifecycleStateDescriptor("RESULT_STAGE");
      const second = getLifecycleStateDescriptor("RESULT_STAGE");
      expect(first).toBe(second);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 80");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/getLifecycleStateDescriptor/);
      expect(source).toMatch(/validateLifecycleStateDescriptor/);
      expect(source).not.toMatch(/function\s+transition/i);
      expect(source).not.toMatch(/function\s+inferState/i);
    });

    test("module has zero require dependencies (pure surface)", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (match) => match[1]
      );
      expect(requires).toEqual([]);
    });

    test("module does not import database, express, filesystem, or env access", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/process\.env/);
    });

    test("module is not wired into compatibility layer or pipeline", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentLifecycleStateDescriptor/);
      expect(pipelineSource).not.toMatch(/recruitmentLifecycleStateDescriptor/);
    });

    test("metadata confirms no runtime integration or side effects", () => {
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.performsStateTransitions).toBe(
        false
      );
      expect(RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA.infersStateFromEvents).toBe(
        false
      );
    });
  });
});
