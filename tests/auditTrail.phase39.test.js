"use strict";

/**
 * Phase 39 — Audit Trail & Execution History Architecture tests.
 * Architecture only: create/validate audit records — no persistence writes.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ACTIONS,
  evaluateRuntimePersistencePolicy
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  executeRuntimePersistence
} = require("../server/lib/recruitment/runtimePersistenceService");
const {
  buildPersistenceExecutionPlan
} = require("../server/lib/recruitment/persistenceExecutionPipeline");
const {
  buildTransactionPlan
} = require("../server/lib/recruitment/transactionCoordinator");
const { RUNTIME_MODES } = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  AUDIT_EVENT_TYPES,
  AUDIT_EXECUTION_STATUSES,
  AUDIT_VALIDATION_REASONS,
  REQUIRED_AUDIT_FIELDS,
  createAuditEvent,
  createPolicyDecisionAuditEvent,
  createExecutionPlanAuditEvent,
  createTransactionPlanAuditEvent,
  createPersistenceOutcomeAuditEvent,
  validateAuditEvent,
  isSupportedAuditEventType,
  isAuditEventArchitectureOnly
} = require("../server/lib/recruitment/auditTrail");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligiblePolicyContext(overrides = {}) {
  return {
    featureFlags: {
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    runtimeMode: RUNTIME_MODES.LIVE,
    previewMode: false,
    eligibility: {
      eligible: true,
      status: ELIGIBILITY_STATUS.ELIGIBLE,
      reasons: ["CONFIDENCE_HIGH"],
      confidence: "high",
      eventType: "admit_card"
    },
    matcherConfidence: "high",
    matchResult: {
      match: true,
      confidence: "high",
      matchedSignals: ["ADVERTISEMENT_NUMBER"],
      conflictingSignals: []
    },
    eventType: "admit_card",
    lifecycleState: "open",
    reviewRequired: false,
    existingRecruitmentMatch: null,
    ...overrides
  };
}

function decision(action, overrides = {}) {
  return {
    action,
    reason: overrides.reason || "TEST_REASON",
    reasons: overrides.reasons || ["TEST_REASON"],
    metadata: {
      automationEnabled: false,
      reviewQueueEnqueueEnabled: false,
      pipelineEnabled: true,
      previewMode: false,
      runtimeMode: "live",
      intendedAction: action,
      wouldPersistIfAutomationEnabled: action === PERSISTENCE_ACTIONS.PERSIST,
      wouldReviewIfEnqueueEnabled: action === PERSISTENCE_ACTIONS.REVIEW,
      confidence: "high",
      eventType: "admit_card",
      ...(overrides.metadata || {})
    },
    ...overrides
  };
}

function assertAuditShell(event, eventType) {
  expect(event.eventType).toBe(eventType);
  expect(event.architectureOnly).toBe(true);
  expect(event.persisted).toBe(false);
  expect(event.written).toBe(false);
  expect(Array.isArray(event.reasons)).toBe(true);
  expect(Object.keys(event.correlation).sort()).toEqual(
    ["correlationId", "parentEventId", "pipelineStage", "sourceModule"].sort()
  );
  expect(
    event.correlation.correlationId === null ||
      typeof event.correlation.correlationId === "string"
  ).toBe(true);
  expect(
    event.correlation.parentEventId === null ||
      typeof event.correlation.parentEventId === "string"
  ).toBe(true);
  expect(
    event.correlation.pipelineStage === null ||
      typeof event.correlation.pipelineStage === "string"
  ).toBe(true);
  expect(
    event.correlation.sourceModule === null ||
      typeof event.correlation.sourceModule === "string"
  ).toBe(true);
  expect(event.metadata).toEqual(
    expect.objectContaining({
      sideEffects: false,
      advisory: true,
      architectureOnly: true,
      auditWritten: false,
      persistenceEnabled: false,
      automationEnabled: false
    })
  );
  expect(isAuditEventArchitectureOnly(event)).toBe(true);
  expect(validateAuditEvent(event).valid).toBe(true);
}

describe("Phase 39 — auditTrail", () => {
  describe("constants", () => {
    test("exposes frozen event types, statuses, and validation reasons", () => {
      expect(AUDIT_EVENT_TYPES).toEqual({
        POLICY_DECISION: "policy_decision",
        EXECUTION_PLAN: "execution_plan",
        TRANSACTION_PLAN: "transaction_plan",
        PERSISTENCE_OUTCOME: "persistence_outcome"
      });
      expect(AUDIT_EXECUTION_STATUSES).toEqual({
        ADVISORY: "advisory",
        PLANNED: "planned",
        BLOCKED: "blocked",
        COMPLETED_NOOP: "completed_noop",
        NOT_PERSISTED: "not_persisted"
      });
      expect(AUDIT_VALIDATION_REASONS).toEqual({
        VALID: "VALID",
        INVALID_INPUT: "INVALID_INPUT",
        MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
        UNSUPPORTED_EVENT_TYPE: "UNSUPPORTED_EVENT_TYPE",
        INVALID_FIELD: "INVALID_FIELD"
      });
      expect(REQUIRED_AUDIT_FIELDS).toEqual(
        expect.arrayContaining([
          "eventId",
          "eventType",
          "action",
          "reasons",
          "executionStatus",
          "correlation",
          "architectureOnly",
          "persisted",
          "written",
          "metadata"
        ])
      );
      expect(Object.isFrozen(AUDIT_EVENT_TYPES)).toBe(true);
      expect(Object.isFrozen(AUDIT_EXECUTION_STATUSES)).toBe(true);
      expect(Object.isFrozen(AUDIT_VALIDATION_REASONS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_AUDIT_FIELDS)).toBe(true);
    });

    test("isSupportedAuditEventType covers only declared types", () => {
      for (const type of Object.values(AUDIT_EVENT_TYPES)) {
        expect(isSupportedAuditEventType(type)).toBe(true);
      }
      expect(isSupportedAuditEventType("unknown")).toBe(false);
      expect(isSupportedAuditEventType(null)).toBe(false);
      expect(isSupportedAuditEventType("")).toBe(false);
    });
  });

  describe("audit event creation", () => {
    test("createAuditEvent builds a complete architecture-only record", () => {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "persist",
        reason: "ELIGIBLE_HIGH_CONFIDENCE",
        reasons: ["ELIGIBLE_HIGH_CONFIDENCE", "KNOWN_LIFECYCLE_EVENT"],
        confidence: "high",
        lifecycleEventType: "admit_card",
        executionStatus: AUDIT_EXECUTION_STATUSES.ADVISORY,
        correlation: {
          correlationId: "corr-1",
          pipelineStage: "policy",
          sourceModule: "runtimePersistencePolicy"
        },
        context: { previewMode: false },
        payload: { action: "persist" }
      });

      assertAuditShell(event, AUDIT_EVENT_TYPES.POLICY_DECISION);
      expect(event.action).toBe("persist");
      expect(event.reason).toBe("ELIGIBLE_HIGH_CONFIDENCE");
      expect(event.reasons).toEqual([
        "ELIGIBLE_HIGH_CONFIDENCE",
        "KNOWN_LIFECYCLE_EVENT"
      ]);
      expect(event.confidence).toBe("high");
      expect(event.lifecycleEventType).toBe("admit_card");
      expect(event.executionStatus).toBe(AUDIT_EXECUTION_STATUSES.ADVISORY);
      expect(event.correlation.correlationId).toBe("corr-1");
      expect(event.payload).toEqual({ action: "persist" });
      expect(event.eventId).toEqual(expect.any(String));
      expect(event.eventId.length).toBeGreaterThan(0);
    });

    test("invalid input still yields a non-written advisory record", () => {
      const event = createAuditEvent(null);
      assertAuditShell(event, AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME);
      expect(event.reasons).toContain(AUDIT_VALIDATION_REASONS.INVALID_INPUT);
      expect(event.executionStatus).toBe(
        AUDIT_EXECUTION_STATUSES.NOT_PERSISTED
      );
    });

    test("unsupported event type is coerced safely", () => {
      const event = createAuditEvent({
        eventType: "not_a_real_type",
        action: "skip"
      });
      assertAuditShell(event, AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME);
      expect(event.metadata.requestedEventType).toBe("not_a_real_type");
      expect(event.metadata.createReason).toBe(
        AUDIT_VALIDATION_REASONS.UNSUPPORTED_EVENT_TYPE
      );
    });

    test("createPolicyDecisionAuditEvent captures decision fields", () => {
      const d = decision(PERSISTENCE_ACTIONS.PERSIST);
      const event = createPolicyDecisionAuditEvent(d, {
        correlationId: "pipe-1"
      });

      assertAuditShell(event, AUDIT_EVENT_TYPES.POLICY_DECISION);
      expect(event.action).toBe("persist");
      expect(event.reasons).toContain("TEST_REASON");
      expect(event.confidence).toBe("high");
      expect(event.lifecycleEventType).toBe("admit_card");
      expect(event.correlation.pipelineStage).toBe("policy");
      expect(event.correlation.sourceModule).toBe("runtimePersistencePolicy");
      expect(event.payload.action).toBe("persist");
    });

    test("createExecutionPlanAuditEvent captures plan and transaction info", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.PERSIST)
      );
      const event = createExecutionPlanAuditEvent(plan, {
        correlationId: "pipe-2"
      });

      assertAuditShell(event, AUDIT_EVENT_TYPES.EXECUTION_PLAN);
      expect(event.action).toBe("persist");
      expect(event.executionStatus).toBe(AUDIT_EXECUTION_STATUSES.PLANNED);
      expect(event.transaction).toEqual(
        expect.objectContaining({
          required: true,
          scope: "recruitment_and_event",
          begun: false,
          committed: false,
          rolledBack: false
        })
      );
      expect(event.context.stepCount).toBeGreaterThan(0);
      expect(event.correlation.pipelineStage).toBe("pipeline");
    });

    test("createTransactionPlanAuditEvent captures unit-of-work boundaries", () => {
      const txn = buildTransactionPlan(
        buildPersistenceExecutionPlan(decision(PERSISTENCE_ACTIONS.REVIEW))
      );
      const event = createTransactionPlanAuditEvent(txn, {
        correlationId: "pipe-3"
      });

      assertAuditShell(event, AUDIT_EVENT_TYPES.TRANSACTION_PLAN);
      expect(event.action).toBe("review");
      expect(event.executionStatus).toBe(AUDIT_EXECUTION_STATUSES.PLANNED);
      expect(event.transaction.required).toBe(true);
      expect(event.transaction.scope).toBe("review_only");
      expect(event.transaction.begun).toBe(false);
      expect(event.context.stageCount).toBeGreaterThan(0);
      expect(event.correlation.sourceModule).toBe("transactionCoordinator");
    });

    test("createPersistenceOutcomeAuditEvent captures blocked outcomes", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PERSIST)
      );
      const event = createPersistenceOutcomeAuditEvent(result, {
        correlationId: "pipe-4"
      });

      assertAuditShell(event, AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME);
      expect(event.executionStatus).toBe(AUDIT_EXECUTION_STATUSES.BLOCKED);
      expect(event.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(event.context.executionBlocked).toBe(true);
      expect(event.reasons.length).toBeGreaterThan(0);
      expect(event.correlation.pipelineStage).toBe("outcome");
    });

    test("end-to-end policy → pipeline → transaction → outcome audit chain", () => {
      const policyDecision = evaluateRuntimePersistencePolicy(
        eligiblePolicyContext()
      );
      const execPlan = buildPersistenceExecutionPlan(policyDecision);
      const txnPlan = buildTransactionPlan(execPlan);
      const outcome = executeRuntimePersistence(policyDecision);

      const corr = { correlationId: "e2e-1" };
      const a1 = createPolicyDecisionAuditEvent(policyDecision, corr);
      const a2 = createExecutionPlanAuditEvent(execPlan, {
        ...corr,
        parentEventId: a1.eventId
      });
      const a3 = createTransactionPlanAuditEvent(txnPlan, {
        ...corr,
        parentEventId: a2.eventId
      });
      const a4 = createPersistenceOutcomeAuditEvent(outcome, {
        ...corr,
        parentEventId: a3.eventId
      });

      for (const event of [a1, a2, a3, a4]) {
        expect(validateAuditEvent(event).valid).toBe(true);
        expect(event.correlation.correlationId).toBe("e2e-1");
        expect(event.persisted).toBe(false);
        expect(event.written).toBe(false);
      }
      expect(a2.correlation.parentEventId).toBe(a1.eventId);
      expect(a3.correlation.parentEventId).toBe(a2.eventId);
      expect(a4.correlation.parentEventId).toBe(a3.eventId);
    });
  });

  describe("validation", () => {
    test("validateAuditEvent accepts created events", () => {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.EXECUTION_PLAN,
        action: "skip",
        reasons: ["NOOP_SKIP"],
        executionStatus: AUDIT_EXECUTION_STATUSES.PLANNED
      });
      const result = validateAuditEvent(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([AUDIT_VALIDATION_REASONS.VALID]);
    });

    test("rejects non-object input", () => {
      const result = validateAuditEvent(null);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(AUDIT_VALIDATION_REASONS.INVALID_INPUT);
    });

    test("rejects missing required fields", () => {
      const result = validateAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION
      });
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        AUDIT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
      );
      expect(result.errors.some((e) => e.includes("missing required field"))).toBe(
        true
      );
    });

    test("rejects unsupported event types", () => {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "persist",
        reasons: ["OK"]
      });
      const forged = {
        ...event,
        eventType: "invented_type"
      };
      const result = validateAuditEvent(forged);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        AUDIT_VALIDATION_REASONS.UNSUPPORTED_EVENT_TYPE
      );
    });

    test("rejects persisted or written flags", () => {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "persist",
        reasons: ["OK"]
      });
      expect(
        validateAuditEvent({ ...event, persisted: true }).valid
      ).toBe(false);
      expect(validateAuditEvent({ ...event, written: true }).valid).toBe(false);
      expect(
        validateAuditEvent({ ...event, architectureOnly: false }).valid
      ).toBe(false);
    });

    test("rejects side-effect metadata claims", () => {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME,
        action: "skip",
        reasons: ["OK"]
      });
      const forged = {
        ...event,
        metadata: {
          ...event.metadata,
          sideEffects: true,
          auditWritten: true,
          persistenceEnabled: true
        }
      };
      const result = validateAuditEvent(forged);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("required fields", () => {
    test("every created event includes all required fields", () => {
      const samples = [
        createAuditEvent({
          eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
          action: "persist",
          reasons: ["A"]
        }),
        createPolicyDecisionAuditEvent(decision(PERSISTENCE_ACTIONS.SKIP)),
        createExecutionPlanAuditEvent(
          buildPersistenceExecutionPlan(decision(PERSISTENCE_ACTIONS.PREVIEW_ONLY))
        ),
        createTransactionPlanAuditEvent(
          buildTransactionPlan(
            buildPersistenceExecutionPlan(decision(PERSISTENCE_ACTIONS.SKIP))
          )
        ),
        createPersistenceOutcomeAuditEvent(
          executeRuntimePersistence(decision(PERSISTENCE_ACTIONS.SKIP))
        )
      ];

      for (const event of samples) {
        for (const field of REQUIRED_AUDIT_FIELDS) {
          expect(event[field]).toBeDefined();
        }
      }
    });
  });

  describe("supported event types", () => {
    test("each supported type can be created and validated", () => {
      for (const eventType of Object.values(AUDIT_EVENT_TYPES)) {
        const event = createAuditEvent({
          eventType,
          action: "preview_only",
          reasons: ["TYPE_OK"],
          executionStatus: AUDIT_EXECUTION_STATUSES.ADVISORY
        });
        expect(event.eventType).toBe(eventType);
        expect(validateAuditEvent(event).valid).toBe(true);
        expect(isSupportedAuditEventType(event.eventType)).toBe(true);
      }
    });
  });

  describe("deterministic output", () => {
    test("identical inputs yield identical audit events", () => {
      const input = {
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "persist",
        reason: "R1",
        reasons: ["R2", "R1"],
        confidence: "high",
        lifecycleEventType: "admit_card",
        executionStatus: AUDIT_EXECUTION_STATUSES.ADVISORY,
        correlation: { correlationId: "d-1", pipelineStage: "policy" },
        context: { a: 1 },
        payload: { action: "persist" }
      };
      expect(createAuditEvent(input)).toEqual(createAuditEvent(input));
    });

    test("end-to-end helpers are deterministic for the same artifacts", () => {
      const d = evaluateRuntimePersistencePolicy(eligiblePolicyContext());
      const plan = buildPersistenceExecutionPlan(d);
      const txn = buildTransactionPlan(plan);
      const outcome = executeRuntimePersistence(d);
      const corr = { correlationId: "det-1" };

      expect(createPolicyDecisionAuditEvent(d, corr)).toEqual(
        createPolicyDecisionAuditEvent(d, corr)
      );
      expect(createExecutionPlanAuditEvent(plan, corr)).toEqual(
        createExecutionPlanAuditEvent(plan, corr)
      );
      expect(createTransactionPlanAuditEvent(txn, corr)).toEqual(
        createTransactionPlanAuditEvent(txn, corr)
      );
      expect(createPersistenceOutcomeAuditEvent(outcome, corr)).toEqual(
        createPersistenceOutcomeAuditEvent(outcome, corr)
      );
    });

    test("reason ordering is stable regardless of input order", () => {
      const a = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "review",
        reasons: ["Z_REASON", "A_REASON"]
      });
      const b = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "review",
        reasons: ["A_REASON", "Z_REASON"]
      });
      expect(a.reasons).toEqual(["A_REASON", "Z_REASON"]);
      expect(a.reasons).toEqual(b.reasons);
      expect(a.eventId).toBe(b.eventId);
    });
  });

  describe("non-mutation", () => {
    test("does not mutate input objects or options", () => {
      const input = {
        eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
        action: "persist",
        reasons: ["R1"],
        correlation: { correlationId: "m-1" },
        context: { marker: true },
        payload: { nested: { value: 1 } },
        metadata: { custom: "x" }
      };
      const before = JSON.stringify(input);
      createAuditEvent(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    test("payload and context are copied without sharing references", () => {
      const decisionObj = decision(PERSISTENCE_ACTIONS.PERSIST);
      const before = JSON.stringify(decisionObj);
      const event = createPolicyDecisionAuditEvent(decisionObj, {
        correlationId: "m-2"
      });
      expect(event.payload).toEqual(decisionObj);
      expect(event.payload).not.toBe(decisionObj);
      event.payload.action = "MUTATED";
      expect(decisionObj.action).toBe("persist");
      expect(JSON.stringify(decisionObj)).toBe(before);
    });

    test("mutating a returned event does not affect a fresh create", () => {
      const input = {
        eventType: AUDIT_EVENT_TYPES.EXECUTION_PLAN,
        action: "skip",
        reasons: ["NOOP"],
        correlation: { correlationId: "m-3" }
      };
      const first = createAuditEvent(input);
      first.reasons.push("INJECTED");
      first.metadata.createReason = "MUTATED";
      first.correlation.correlationId = "hacked";
      const second = createAuditEvent(input);
      expect(second.reasons).toEqual(["NOOP"]);
      expect(second.metadata.createReason).toBe(AUDIT_VALIDATION_REASONS.VALID);
      expect(second.correlation.correlationId).toBe("m-3");
    });

    test("create helpers do not mutate source plan/decision/result", () => {
      const d = decision(PERSISTENCE_ACTIONS.PERSIST);
      const plan = buildPersistenceExecutionPlan(d);
      const txn = buildTransactionPlan(plan);
      const outcome = executeRuntimePersistence(d);
      const before = [
        JSON.stringify(d),
        JSON.stringify(plan),
        JSON.stringify(txn),
        JSON.stringify(outcome)
      ];
      createPolicyDecisionAuditEvent(d);
      createExecutionPlanAuditEvent(plan);
      createTransactionPlanAuditEvent(txn);
      createPersistenceOutcomeAuditEvent(outcome);
      expect([
        JSON.stringify(d),
        JSON.stringify(plan),
        JSON.stringify(txn),
        JSON.stringify(outcome)
      ]).toEqual(before);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("audit module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/auditTrail.js");
      expect(source).toMatch(/Phase 39/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never writes audit records/);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/recordRuntimePreview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/executeRuntimePersistence/);
      expect(source).not.toMatch(/getConnection/);
      expect(source).not.toMatch(/\.beginTransaction\s*\(/);
      expect(source).not.toMatch(/\.commit\s*\(/);
      expect(source).not.toMatch(/\.rollback\s*\(/);
      expect(source).not.toMatch(/writeFile|appendFile|mkdir/i);
    });

    test("audit module has no runtime requires (self-contained)", () => {
      const source = read("server/lib/recruitment/auditTrail.js");
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("siteWorker is unchanged — audit trail not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/auditTrail/);
      expect(worker).not.toMatch(/createAuditEvent/);
      expect(worker).not.toMatch(/createPolicyDecisionAuditEvent/);
      expect(worker).not.toMatch(/transactionCoordinator/);
      expect(worker).not.toMatch(/persistenceExecutionPipeline/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("prior persistence modules do not import the audit trail", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/services/recruitmentReview.service.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/auditTrail/);
        expect(source).not.toMatch(/createAuditEvent/);
        expect(source).not.toMatch(/createPolicyDecisionAuditEvent/);
      }
    });

    test("prior persistence modules are unchanged by this phase", () => {
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const contracts = read(
        "server/lib/recruitment/persistenceRepositoryContracts.js"
      );
      const adapters = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      const pipeline = read(
        "server/lib/recruitment/persistenceExecutionPipeline.js"
      );
      const coordinator = read(
        "server/lib/recruitment/transactionCoordinator.js"
      );
      expect(policy).toMatch(/Phase 33/);
      expect(policy).not.toMatch(/Phase 39/);
      expect(service).toMatch(/Phase 34/);
      expect(service).not.toMatch(/Phase 39/);
      expect(contracts).toMatch(/Phase 35/);
      expect(contracts).not.toMatch(/Phase 39/);
      expect(adapters).toMatch(/Phase 36/);
      expect(adapters).not.toMatch(/Phase 39/);
      expect(pipeline).toMatch(/Phase 37/);
      expect(pipeline).not.toMatch(/Phase 39/);
      expect(coordinator).toMatch(/Phase 38/);
      expect(coordinator).not.toMatch(/Phase 39/);
    });

    test("records never enable persistence or claim a write", () => {
      const source = read("server/lib/recruitment/auditTrail.js");
      expect(source).toMatch(/persisted: false/);
      expect(source).toMatch(/written: false/);
      expect(source).toMatch(/auditWritten: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/automationEnabled: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      const samples = [
        createAuditEvent({
          eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
          action: "persist",
          reasons: ["X"]
        }),
        createPolicyDecisionAuditEvent(decision(PERSISTENCE_ACTIONS.PERSIST)),
        createExecutionPlanAuditEvent(
          buildPersistenceExecutionPlan(decision(PERSISTENCE_ACTIONS.PERSIST))
        ),
        createTransactionPlanAuditEvent(
          buildTransactionPlan(
            buildPersistenceExecutionPlan(decision(PERSISTENCE_ACTIONS.PERSIST))
          )
        ),
        createPersistenceOutcomeAuditEvent(
          executeRuntimePersistence(decision(PERSISTENCE_ACTIONS.PERSIST))
        )
      ];

      for (const event of samples) {
        expect(event.persisted).toBe(false);
        expect(event.written).toBe(false);
        expect(event.metadata.persistenceEnabled).toBe(false);
        expect(event.metadata.auditWritten).toBe(false);
        expect(event.metadata.automationEnabled).toBe(false);
        expect(isAuditEventArchitectureOnly(event)).toBe(true);
      }
    });
  });
});
