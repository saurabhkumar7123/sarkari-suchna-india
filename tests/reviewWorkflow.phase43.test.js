"use strict";

/**
 * Phase 43 — Review Workflow Architecture tests.
 * Architecture only: model, validation, lifecycle — no execution.
 */

const fs = require("fs");
const path = require("path");

const {
  REVIEW_WORKFLOW_PHASE,
  REVIEW_WORKFLOW_STATUS,
  REVIEW_WORKFLOW_ACTIONS,
  REVIEW_WORKFLOW_EVENTS,
  REVIEW_WORKFLOW_STATUS_VALUES,
  REVIEW_WORKFLOW_ACTION_VALUES,
  REVIEW_WORKFLOW_EVENT_VALUES,
  TERMINAL_STATUSES,
  TRANSITION_TABLE,
  REQUIRED_REVIEW_ITEM_FIELDS,
  REVIEW_WORKFLOW_VALIDATION_REASONS,
  createReviewWorkflowItem,
  validateReviewWorkflowItem,
  isTerminalStatus,
  listAllowedTriggers,
  listAllowedActions,
  isTransitionAllowed,
  resolveStatusForTrigger,
  resolveStatusForAction,
  planReviewWorkflowTransition,
  applyReviewWorkflowDecision,
  isReviewWorkflowArchitectureOnly
} = require("../server/lib/recruitment/reviewWorkflow");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function baseInput(overrides = {}) {
  return {
    reviewId: "rw-1",
    recruitmentId: "42",
    eventType: "admit_card",
    sourceUrl: "https://example.test/admit",
    title: "Admit Card Review Case",
    confidence: "medium",
    matchResult: {
      match: "unknown",
      confidence: "medium",
      matchedSignals: ["TITLE"],
      conflictingSignals: []
    },
    reasons: ["REVIEW_REQUIRED", "CONFIDENCE_MEDIUM"],
    notes: null,
    ...overrides
  };
}

function validItem(overrides = {}) {
  return createReviewWorkflowItem(baseInput(overrides));
}

describe("Phase 43 — reviewWorkflow", () => {
  describe("constants", () => {
    test("exposes frozen statuses, actions, events, and phase", () => {
      expect(REVIEW_WORKFLOW_PHASE).toBe(43);
      expect(REVIEW_WORKFLOW_STATUS).toEqual({
        PENDING: "pending",
        IN_REVIEW: "in_review",
        APPROVED: "approved",
        REJECTED: "rejected",
        EXPIRED: "expired",
        CANCELLED: "cancelled"
      });
      expect(REVIEW_WORKFLOW_ACTIONS).toEqual({
        APPROVE: "approve",
        REJECT: "reject",
        REQUEST_CHANGES: "request_changes",
        SKIP: "skip"
      });
      expect(REVIEW_WORKFLOW_EVENTS).toEqual({
        START_REVIEW: "start_review",
        EXPIRE: "expire",
        CANCEL: "cancel"
      });
      expect(REVIEW_WORKFLOW_STATUS_VALUES).toEqual([
        "pending",
        "in_review",
        "approved",
        "rejected",
        "expired",
        "cancelled"
      ]);
      expect(REVIEW_WORKFLOW_ACTION_VALUES).toEqual([
        "approve",
        "reject",
        "request_changes",
        "skip"
      ]);
      expect(REVIEW_WORKFLOW_EVENT_VALUES).toEqual([
        "start_review",
        "expire",
        "cancel"
      ]);
      expect(TERMINAL_STATUSES).toEqual([
        "approved",
        "rejected",
        "expired",
        "cancelled"
      ]);
      expect(Object.isFrozen(REVIEW_WORKFLOW_STATUS)).toBe(true);
      expect(Object.isFrozen(REVIEW_WORKFLOW_ACTIONS)).toBe(true);
      expect(Object.isFrozen(REVIEW_WORKFLOW_EVENTS)).toBe(true);
      expect(Object.isFrozen(TRANSITION_TABLE)).toBe(true);
      expect(Object.isFrozen(REQUIRED_REVIEW_ITEM_FIELDS)).toBe(true);
      expect(Object.isFrozen(REVIEW_WORKFLOW_VALIDATION_REASONS)).toBe(true);
    });
  });

  describe("review item creation", () => {
    test("creates a pending architecture-only review item with defaults", () => {
      const item = createReviewWorkflowItem(
        baseInput({ createdAt: "2020-01-01T00:00:00.000Z" })
      );
      expect(item.status).toBe(REVIEW_WORKFLOW_STATUS.PENDING);
      expect(item.lastAction).toBeNull();
      expect(item.title).toBe("Admit Card Review Case");
      expect(item.eventType).toBe("admit_card");
      expect(item.recruitmentId).toBe("42");
      expect(item.reasons).toEqual(["CONFIDENCE_MEDIUM", "REVIEW_REQUIRED"]);
      expect(item.architectureOnly).toBe(true);
      expect(item.executed).toBe(false);
      expect(item.metadata.sideEffects).toBe(false);
      expect(item.metadata.phase).toBe(43);
      expect(item.metadata.persistenceEnabled).toBe(false);
      expect(item.metadata.queueEnqueueEnabled).toBe(false);
      expect(item.metadata.automationEnabled).toBe(false);
      expect(isReviewWorkflowArchitectureOnly(item)).toBe(true);
    });

    test("defaults createdAt to epoch when omitted", () => {
      const item = createReviewWorkflowItem({ title: "Case A" });
      expect(item.createdAt).toBe(new Date(0).toISOString());
      expect(item.updatedAt).toBe(item.createdAt);
    });

    test("records creation field issues in metadata without throwing", () => {
      const item = createReviewWorkflowItem({
        title: "",
        status: "not-a-status",
        lastAction: "approve"
      });
      expect(item.title).toBe("");
      expect(item.metadata.createdValid).toBe(false);
      expect(item.metadata.creationErrors.length).toBeGreaterThan(0);
      expect(item.architectureOnly).toBe(true);
      expect(item.executed).toBe(false);
    });
  });

  describe("validation", () => {
    test("valid item passes validation", () => {
      const item = validItem();
      const result = validateReviewWorkflowItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([REVIEW_WORKFLOW_VALIDATION_REASONS.VALID]);
    });

    test("rejects non-object input", () => {
      const result = validateReviewWorkflowItem(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("review workflow item must be an object");
      expect(result.reasons).toContain(
        REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_INPUT
      );
    });

    test("rejects missing required fields and invalid status", () => {
      const result = validateReviewWorkflowItem({
        title: "x",
        status: "bogus"
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "status is invalid",
          "architectureOnly is required",
          "executed is required",
          "metadata is required"
        ])
      );
    });

    test("rejects architectureOnly/executed/sideEffects violations", () => {
      const item = validItem();
      item.architectureOnly = false;
      item.executed = true;
      item.metadata.sideEffects = true;
      const result = validateReviewWorkflowItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "architectureOnly must be true",
          "executed must be false",
          "metadata.sideEffects must be false"
        ])
      );
    });

    test("rejects invalid matchResult shape", () => {
      const item = validItem();
      item.matchResult = {
        match: true,
        confidence: "high",
        matchedSignals: "nope",
        conflictingSignals: []
      };
      const result = validateReviewWorkflowItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "matchResult.matchedSignals must be an array"
      );
    });
  });

  describe("lifecycle transitions", () => {
    test("pending allows start_review, skip, approve, reject, expire, cancel", () => {
      expect(listAllowedTriggers(REVIEW_WORKFLOW_STATUS.PENDING)).toEqual([
        "approve",
        "cancel",
        "expire",
        "reject",
        "skip",
        "start_review"
      ]);
      expect(listAllowedActions(REVIEW_WORKFLOW_STATUS.PENDING)).toEqual([
        "approve",
        "reject",
        "skip"
      ]);
      expect(
        resolveStatusForTrigger(
          REVIEW_WORKFLOW_EVENTS.START_REVIEW,
          REVIEW_WORKFLOW_STATUS.PENDING
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.IN_REVIEW);
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_ACTIONS.SKIP,
          REVIEW_WORKFLOW_STATUS.PENDING
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.IN_REVIEW);
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_ACTIONS.APPROVE,
          REVIEW_WORKFLOW_STATUS.PENDING
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.APPROVED);
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_ACTIONS.REJECT,
          REVIEW_WORKFLOW_STATUS.PENDING
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.REJECTED);
    });

    test("in_review supports approve, reject, request_changes, skip, expire, cancel", () => {
      expect(listAllowedActions(REVIEW_WORKFLOW_STATUS.IN_REVIEW)).toEqual([
        "approve",
        "reject",
        "request_changes",
        "skip"
      ]);
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES,
          REVIEW_WORKFLOW_STATUS.IN_REVIEW
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.PENDING);
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_ACTIONS.SKIP,
          REVIEW_WORKFLOW_STATUS.IN_REVIEW
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.IN_REVIEW);
      expect(
        resolveStatusForTrigger(
          REVIEW_WORKFLOW_EVENTS.EXPIRE,
          REVIEW_WORKFLOW_STATUS.IN_REVIEW
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.EXPIRED);
      expect(
        resolveStatusForTrigger(
          REVIEW_WORKFLOW_EVENTS.CANCEL,
          REVIEW_WORKFLOW_STATUS.IN_REVIEW
        )
      ).toBe(REVIEW_WORKFLOW_STATUS.CANCELLED);
    });

    test("applyReviewWorkflowDecision moves pending → in_review via start_review", () => {
      const item = validItem();
      const result = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_EVENTS.START_REVIEW,
        { updatedAt: "2020-01-02T00:00:00.000Z" }
      );
      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_WORKFLOW_STATUS.IN_REVIEW);
      expect(result.item.lastAction).toBeNull();
      expect(result.transition.allowed).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.architectureOnly).toBe(true);
      expect(result.item.executed).toBe(false);
      expect(isReviewWorkflowArchitectureOnly(result)).toBe(true);
      expect(isReviewWorkflowArchitectureOnly(result.item)).toBe(true);
    });

    test("applyReviewWorkflowDecision records approve lastAction", () => {
      const item = validItem({ status: REVIEW_WORKFLOW_STATUS.IN_REVIEW });
      const result = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE,
        { notes: "Looks good" }
      );
      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_WORKFLOW_STATUS.APPROVED);
      expect(result.item.lastAction).toBe(REVIEW_WORKFLOW_ACTIONS.APPROVE);
      expect(result.item.notes).toBe("Looks good");
      expect(isTerminalStatus(result.item.status)).toBe(true);
    });

    test("request_changes returns in_review → pending", () => {
      const item = validItem({ status: REVIEW_WORKFLOW_STATUS.IN_REVIEW });
      const result = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES
      );
      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_WORKFLOW_STATUS.PENDING);
      expect(result.item.lastAction).toBe(
        REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES
      );
    });

    test("planReviewWorkflowTransition is advisory and non-executing", () => {
      const item = validItem();
      const plan = planReviewWorkflowTransition(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      expect(plan.allowed).toBe(true);
      expect(plan.fromStatus).toBe(REVIEW_WORKFLOW_STATUS.PENDING);
      expect(plan.toStatus).toBe(REVIEW_WORKFLOW_STATUS.APPROVED);
      expect(plan.advisory).toBe(true);
      expect(plan.executed).toBe(false);
      expect(plan.architectureOnly).toBe(true);
      expect(item.status).toBe(REVIEW_WORKFLOW_STATUS.PENDING);
      expect(isReviewWorkflowArchitectureOnly(plan)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    test("request_changes is not allowed from pending", () => {
      expect(
        isTransitionAllowed(
          REVIEW_WORKFLOW_STATUS.PENDING,
          REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES
        )
      ).toBe(false);
      const plan = planReviewWorkflowTransition(
        validItem(),
        REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES
      );
      expect(plan.allowed).toBe(false);
      expect(plan.reasons).toContain(
        REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_TRANSITION
      );
    });

    test("terminal statuses reject all further transitions", () => {
      for (const status of TERMINAL_STATUSES) {
        expect(isTerminalStatus(status)).toBe(true);
        expect(listAllowedTriggers(status)).toEqual([]);
        for (const action of REVIEW_WORKFLOW_ACTION_VALUES) {
          expect(isTransitionAllowed(status, action)).toBe(false);
          expect(resolveStatusForAction(action, status)).toBeNull();
        }
        const item = validItem({ status });
        const result = applyReviewWorkflowDecision(
          item,
          REVIEW_WORKFLOW_ACTIONS.APPROVE
        );
        expect(result.success).toBe(false);
        expect(result.reasons).toContain(
          REVIEW_WORKFLOW_VALIDATION_REASONS.TERMINAL_STATE
        );
        expect(result.item.status).toBe(status);
      }
    });

    test("unknown trigger is rejected", () => {
      const plan = planReviewWorkflowTransition(validItem(), "publish");
      expect(plan.allowed).toBe(false);
      expect(plan.errors).toContain("trigger is invalid");
      expect(plan.reasons).toContain(
        REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_ACTION
      );
    });

    test("invalid item blocks decision application", () => {
      const result = applyReviewWorkflowDecision(
        { title: "broken" },
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      expect(result.success).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.architectureOnly).toBe(true);
    });
  });

  describe("decision handling", () => {
    test("maps each action from in_review to the expected status", () => {
      const cases = [
        [REVIEW_WORKFLOW_ACTIONS.APPROVE, REVIEW_WORKFLOW_STATUS.APPROVED],
        [REVIEW_WORKFLOW_ACTIONS.REJECT, REVIEW_WORKFLOW_STATUS.REJECTED],
        [
          REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES,
          REVIEW_WORKFLOW_STATUS.PENDING
        ],
        [REVIEW_WORKFLOW_ACTIONS.SKIP, REVIEW_WORKFLOW_STATUS.IN_REVIEW]
      ];
      for (const [action, expected] of cases) {
        const item = validItem({ status: REVIEW_WORKFLOW_STATUS.IN_REVIEW });
        const result = applyReviewWorkflowDecision(item, action);
        expect(result.success).toBe(true);
        expect(result.item.status).toBe(expected);
        expect(result.transition.trigger).toBe(action);
        expect(result.transition.triggerKind).toBe("action");
        expect(result.executed).toBe(false);
      }
    });

    test("system expire / cancel mark terminal without recording lastAction as action", () => {
      const pending = validItem();
      const expired = applyReviewWorkflowDecision(
        pending,
        REVIEW_WORKFLOW_EVENTS.EXPIRE
      );
      expect(expired.success).toBe(true);
      expect(expired.item.status).toBe(REVIEW_WORKFLOW_STATUS.EXPIRED);
      expect(expired.item.lastAction).toBeNull();
      expect(expired.transition.triggerKind).toBe("event");

      const inReview = validItem({ status: REVIEW_WORKFLOW_STATUS.IN_REVIEW });
      const cancelled = applyReviewWorkflowDecision(
        inReview,
        REVIEW_WORKFLOW_EVENTS.CANCEL
      );
      expect(cancelled.success).toBe(true);
      expect(cancelled.item.status).toBe(REVIEW_WORKFLOW_STATUS.CANCELLED);
      expect(cancelled.transition.triggerKind).toBe("event");
    });

    test("resolveStatusForAction returns null for non-actions", () => {
      expect(
        resolveStatusForAction(
          REVIEW_WORKFLOW_EVENTS.EXPIRE,
          REVIEW_WORKFLOW_STATUS.PENDING
        )
      ).toBeNull();
    });
  });

  describe("deterministic behavior", () => {
    test("identical inputs yield identical created items", () => {
      const input = baseInput({
        createdAt: "2021-05-01T12:00:00.000Z",
        updatedAt: "2021-05-01T12:00:00.000Z"
      });
      expect(createReviewWorkflowItem(input)).toEqual(
        createReviewWorkflowItem(input)
      );
    });

    test("identical decisions yield identical results", () => {
      const item = validItem({
        createdAt: "2021-05-01T12:00:00.000Z",
        updatedAt: "2021-05-01T12:00:00.000Z",
        status: REVIEW_WORKFLOW_STATUS.IN_REVIEW
      });
      const a = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.REJECT,
        { updatedAt: "2021-05-02T00:00:00.000Z", notes: "No" }
      );
      const b = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.REJECT,
        { updatedAt: "2021-05-02T00:00:00.000Z", notes: "No" }
      );
      expect(a).toEqual(b);
      expect(planReviewWorkflowTransition(item, REVIEW_WORKFLOW_ACTIONS.REJECT)).toEqual(
        planReviewWorkflowTransition(item, REVIEW_WORKFLOW_ACTIONS.REJECT)
      );
    });

    test("reasons are sorted uniquely on create", () => {
      const item = createReviewWorkflowItem(
        baseInput({
          reasons: ["B", "A", "A", "C"]
        })
      );
      expect(item.reasons).toEqual(["A", "B", "C"]);
    });
  });

  describe("non-mutation", () => {
    test("create and apply do not mutate input objects", () => {
      const input = baseInput({
        reasons: ["Z", "Y"],
        matchResult: {
          match: true,
          confidence: "high",
          matchedSignals: ["A"],
          conflictingSignals: ["B"]
        },
        metadata: { marker: "in" }
      });
      const before = JSON.stringify(input);
      const item = createReviewWorkflowItem(input);
      expect(JSON.stringify(input)).toBe(before);

      const beforeItem = JSON.stringify(item);
      const options = { notes: "n", updatedAt: "2022-01-01T00:00:00.000Z" };
      const beforeOptions = JSON.stringify(options);
      applyReviewWorkflowDecision(item, REVIEW_WORKFLOW_ACTIONS.APPROVE, options);
      planReviewWorkflowTransition(item, REVIEW_WORKFLOW_ACTIONS.REJECT);
      expect(JSON.stringify(item)).toBe(beforeItem);
      expect(JSON.stringify(options)).toBe(beforeOptions);
      expect(JSON.stringify(input)).toBe(before);
    });

    test("returned item clones do not share nested references with input", () => {
      const input = baseInput({
        reasons: ["R1"],
        matchResult: {
          match: false,
          confidence: "low",
          matchedSignals: ["X"],
          conflictingSignals: []
        },
        metadata: { marker: "shared?" }
      });
      const item = createReviewWorkflowItem(input);
      item.reasons.push("LEAK");
      item.matchResult.matchedSignals.push("LEAK");
      item.metadata.marker = "mutated";
      expect(input.reasons).toEqual(["R1"]);
      expect(input.matchResult.matchedSignals).toEqual(["X"]);
      expect(input.metadata.marker).toBe("shared?");

      const again = createReviewWorkflowItem(input);
      expect(again.reasons).toEqual(["R1"]);
      expect(again.matchResult.matchedSignals).toEqual(["X"]);
      expect(again.metadata.marker).toBe("shared?");
    });

    test("mutating a decision result does not affect a fresh apply", () => {
      const item = validItem({ status: REVIEW_WORKFLOW_STATUS.IN_REVIEW });
      const first = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      first.item.status = REVIEW_WORKFLOW_STATUS.REJECTED;
      first.executed = true;
      first.transition.executed = true;
      const second = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      expect(second.item.status).toBe(REVIEW_WORKFLOW_STATUS.APPROVED);
      expect(second.executed).toBe(false);
      expect(second.transition.executed).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("reviewWorkflow module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/reviewWorkflow.js");
      expect(source).toMatch(/Phase 43/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never creates database tables/);
      expect(source).toMatch(/Never inserts review records/);
      expect(source).toMatch(/Never uses[\s\*]+queues/i);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/executeRuntimePersistence/);
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/require\(/);
    });

    test("siteWorker is unchanged — review workflow not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/reviewWorkflow/);
      expect(worker).not.toMatch(/createReviewWorkflowItem/);
      expect(worker).not.toMatch(/applyReviewWorkflowDecision/);
      expect(worker).toMatch(/Never persists review items/);
    });

    test("prior modules do not import the review workflow", () => {
      const files = [
        "server/lib/recruitment/reviewQueue.js",
        "server/lib/recruitment/reviewDecisionAssistant.js",
        "server/lib/recruitment/reviewComparison.js",
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/auditTrail.js",
        "server/lib/recruitment/executionContext.js",
        "server/lib/recruitment/previewRuntimeWiring.js",
        "server/lib/recruitment/dryRunPersistenceSimulator.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/services/recruitmentReview.service.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/reviewWorkflow/);
        expect(source).not.toMatch(/createReviewWorkflowItem/);
        expect(source).not.toMatch(/applyReviewWorkflowDecision/);
      }
    });

    test("prior phase modules are unchanged by this phase", () => {
      const files = {
        "server/lib/recruitment/reviewQueue.js": /Phase 22/,
        "server/lib/recruitment/runtimePersistencePolicy.js": /Phase 33/,
        "server/lib/recruitment/runtimePersistenceService.js": /Phase 34/,
        "server/lib/recruitment/persistenceRepositoryContracts.js": /Phase 35/,
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js":
          /Phase 36/,
        "server/lib/recruitment/persistenceExecutionPipeline.js": /Phase 37/,
        "server/lib/recruitment/transactionCoordinator.js": /Phase 38/,
        "server/lib/recruitment/auditTrail.js": /Phase 39/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 43/);
      }
    });

    test("results never enable automation, queues, persistence, or execution", () => {
      const source = read("server/lib/recruitment/reviewWorkflow.js");
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/queueEnqueueEnabled: false/);
      expect(source).toMatch(/automationEnabled: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      const item = validItem();
      expect(item.executed).toBe(false);
      expect(item.metadata.persistenceEnabled).toBe(false);

      const plan = planReviewWorkflowTransition(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      expect(plan.executed).toBe(false);
      expect(plan.metadata.persistenceEnabled).toBe(false);

      const applied = applyReviewWorkflowDecision(
        item,
        REVIEW_WORKFLOW_ACTIONS.APPROVE
      );
      expect(applied.executed).toBe(false);
      expect(applied.item.executed).toBe(false);
      expect(applied.item.metadata.automationEnabled).toBe(false);
      expect(isReviewWorkflowArchitectureOnly(applied)).toBe(true);
      expect(isReviewWorkflowArchitectureOnly(applied.item)).toBe(true);
      expect(isReviewWorkflowArchitectureOnly(plan)).toBe(true);
    });
  });
});
