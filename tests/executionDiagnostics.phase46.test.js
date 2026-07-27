"use strict";

/**
 * Phase 46 — Execution Diagnostics & Observability Framework tests.
 * Architecture only: deterministic traces — no I/O, persistence, or logging.
 */

const fs = require("fs");
const path = require("path");

const {
  EXECUTION_DIAGNOSTICS_PHASE,
  DIAGNOSTIC_STAGE_TYPES,
  SUPPORTED_DIAGNOSTIC_STAGE_TYPES,
  DIAGNOSTIC_STAGE_STATUSES,
  SUPPORTED_DIAGNOSTIC_STAGE_STATUSES,
  TRACE_STATUSES,
  SUPPORTED_TRACE_STATUSES,
  DIAGNOSTIC_VALIDATION_REASONS,
  REQUIRED_TRACE_FIELDS,
  REQUIRED_STAGE_FIELDS,
  createExecutionTrace,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace,
  validateExecutionTrace,
  validateExecutionStage,
  validateStageInput,
  isSupportedDiagnosticStageType,
  isSupportedDiagnosticStageStatus,
  isExecutionTraceArchitectureOnly
} = require("../server/lib/recruitment/executionDiagnostics");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function baseTraceInput(overrides = {}) {
  return {
    traceId: "trace_phase46",
    correlationId: "corr_phase46",
    pipelineRunId: "run_phase46",
    contextId: "ctx_phase46",
    metadata: { marker: "diag" },
    ...overrides
  };
}

function appendAllCanonicalStages(trace) {
  const types = [
    DIAGNOSTIC_STAGE_TYPES.CONTEXT,
    DIAGNOSTIC_STAGE_TYPES.POLICY,
    DIAGNOSTIC_STAGE_TYPES.ENABLEMENT,
    DIAGNOSTIC_STAGE_TYPES.EXECUTION_PLAN,
    DIAGNOSTIC_STAGE_TYPES.TRANSACTION_PLAN,
    DIAGNOSTIC_STAGE_TYPES.AUDIT,
    DIAGNOSTIC_STAGE_TYPES.REVIEW,
    DIAGNOSTIC_STAGE_TYPES.ADAPTER
  ];

  let current = trace;
  for (const stageType of types) {
    const result = appendExecutionStage(current, {
      stageType,
      status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
      message: `recorded ${stageType}`,
      detail: { stageType },
      reasons: ["RECORDED"]
    });
    expect(result.success).toBe(true);
    current = result.trace;
  }
  return current;
}

function assertTraceShell(trace, status) {
  expect(trace.architectureOnly).toBe(true);
  expect(trace.executed).toBe(false);
  expect(trace.advisory).toBe(true);
  expect(trace.status).toBe(status);
  expect(Array.isArray(trace.stages)).toBe(true);
  expect(trace.metadata).toEqual(
    expect.objectContaining({
      phase: EXECUTION_DIAGNOSTICS_PHASE,
      sideEffects: false,
      architectureOnly: true,
      advisory: true,
      executed: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      repositoriesInvoked: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false,
      consoleLogging: false,
      fileWrites: false,
      databaseWrites: false
    })
  );
  expect(isExecutionTraceArchitectureOnly(trace)).toBe(true);
}

describe("Phase 46 — executionDiagnostics", () => {
  describe("constants", () => {
    test("exposes frozen stage types, statuses, reasons, and phase", () => {
      expect(EXECUTION_DIAGNOSTICS_PHASE).toBe(46);
      expect(DIAGNOSTIC_STAGE_TYPES).toEqual({
        CONTEXT: "context",
        POLICY: "policy",
        ENABLEMENT: "enablement",
        EXECUTION_PLAN: "execution_plan",
        TRANSACTION_PLAN: "transaction_plan",
        AUDIT: "audit",
        REVIEW: "review",
        ADAPTER: "adapter",
        COMPLETED: "completed"
      });
      expect([...SUPPORTED_DIAGNOSTIC_STAGE_TYPES].sort()).toEqual([
        "adapter",
        "audit",
        "completed",
        "context",
        "enablement",
        "execution_plan",
        "policy",
        "review",
        "transaction_plan"
      ]);
      expect(DIAGNOSTIC_STAGE_STATUSES).toEqual({
        RECORDED: "recorded",
        SKIPPED: "skipped",
        BLOCKED: "blocked",
        COMPLETED: "completed"
      });
      expect([...SUPPORTED_DIAGNOSTIC_STAGE_STATUSES].sort()).toEqual([
        "blocked",
        "completed",
        "recorded",
        "skipped"
      ]);
      expect(TRACE_STATUSES).toEqual({
        OPEN: "open",
        FINALIZED: "finalized",
        INVALID: "invalid"
      });
      expect([...SUPPORTED_TRACE_STATUSES].sort()).toEqual([
        "finalized",
        "invalid",
        "open"
      ]);
      expect(DIAGNOSTIC_VALIDATION_REASONS).toEqual({
        VALID: "VALID",
        INVALID_INPUT: "INVALID_INPUT",
        MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
        INVALID_FIELD: "INVALID_FIELD",
        INVALID_STAGE_TYPE: "INVALID_STAGE_TYPE",
        INVALID_STAGE_STATUS: "INVALID_STAGE_STATUS",
        INVALID_TRACE_STATUS: "INVALID_TRACE_STATUS",
        TRACE_FINALIZED: "TRACE_FINALIZED",
        TRACE_INVALID: "TRACE_INVALID",
        TRACE_NOT_ARCHITECTURE_ONLY: "TRACE_NOT_ARCHITECTURE_ONLY"
      });
      expect(REQUIRED_TRACE_FIELDS).toEqual(
        expect.arrayContaining([
          "traceId",
          "status",
          "stages",
          "summary",
          "architectureOnly",
          "executed",
          "advisory",
          "metadata"
        ])
      );
      expect(REQUIRED_STAGE_FIELDS).toEqual(
        expect.arrayContaining([
          "stageId",
          "stageType",
          "status",
          "order",
          "architectureOnly",
          "executed",
          "advisory"
        ])
      );
      expect(Object.isFrozen(DIAGNOSTIC_STAGE_TYPES)).toBe(true);
      expect(Object.isFrozen(DIAGNOSTIC_STAGE_STATUSES)).toBe(true);
      expect(Object.isFrozen(TRACE_STATUSES)).toBe(true);
      expect(Object.isFrozen(DIAGNOSTIC_VALIDATION_REASONS)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_DIAGNOSTIC_STAGE_TYPES)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_DIAGNOSTIC_STAGE_STATUSES)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_TRACE_STATUSES)).toBe(true);
      expect(Object.isFrozen(REQUIRED_TRACE_FIELDS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_STAGE_FIELDS)).toBe(true);
    });

    test("isSupported helpers recognize canonical values", () => {
      expect(isSupportedDiagnosticStageType("context")).toBe(true);
      expect(isSupportedDiagnosticStageType("CONTEXT")).toBe(true);
      expect(isSupportedDiagnosticStageType("nope")).toBe(false);
      expect(isSupportedDiagnosticStageStatus("recorded")).toBe(true);
      expect(isSupportedDiagnosticStageStatus("")).toBe(true);
      expect(isSupportedDiagnosticStageStatus("live")).toBe(false);
    });
  });

  describe("trace creation", () => {
    test("creates an open architecture-only trace", () => {
      const trace = createExecutionTrace(baseTraceInput());
      assertTraceShell(trace, TRACE_STATUSES.OPEN);
      expect(trace.traceId).toBe("trace_phase46");
      expect(trace.correlationId).toBe("corr_phase46");
      expect(trace.pipelineRunId).toBe("run_phase46");
      expect(trace.contextId).toBe("ctx_phase46");
      expect(trace.stages).toEqual([]);
      expect(trace.summary).toBeNull();
      expect(trace.metadata.marker).toBe("diag");
      expect(validateExecutionTrace(trace).valid).toBe(true);
    });

    test("nullish and non-object inputs still yield architecture-only shell", () => {
      for (const input of [null, undefined, "x", 1, []]) {
        const trace = createExecutionTrace(input);
        assertTraceShell(trace, TRACE_STATUSES.OPEN);
        expect(trace.traceId).toBeNull();
        expect(trace.stages).toEqual([]);
      }
    });

    test("trims blank ids to null", () => {
      const trace = createExecutionTrace({
        traceId: "  ",
        correlationId: "",
        pipelineRunId: null,
        contextId: undefined
      });
      expect(trace.traceId).toBeNull();
      expect(trace.correlationId).toBeNull();
      expect(trace.pipelineRunId).toBeNull();
      expect(trace.contextId).toBeNull();
    });
  });

  describe("stage append", () => {
    test("appends stages with deterministic ids and order", () => {
      let trace = createExecutionTrace(baseTraceInput());
      const first = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
        status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
        message: "context ready",
        detail: { mode: "preview" },
        reasons: ["Z", "A", "A"]
      });
      expect(first.success).toBe(true);
      expect(first.stage).toEqual(
        expect.objectContaining({
          stageId: "stage_000_context",
          stageType: "context",
          status: "recorded",
          order: 0,
          message: "context ready",
          detail: { mode: "preview" },
          reasons: ["A", "Z"],
          architectureOnly: true,
          executed: false,
          advisory: true
        })
      );
      expect(first.trace.stages).toHaveLength(1);
      expect(first.trace.summary).toBeNull();

      const second = appendExecutionStage(first.trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.POLICY,
        status: DIAGNOSTIC_STAGE_STATUSES.BLOCKED,
        stageId: "custom_policy"
      });
      expect(second.success).toBe(true);
      expect(second.stage.stageId).toBe("custom_policy");
      expect(second.stage.order).toBe(1);
      expect(second.trace.stages).toHaveLength(2);
      expect(validateExecutionStage(second.stage).valid).toBe(true);
      expect(validateExecutionTrace(second.trace).valid).toBe(true);
    });

    test("records the full advisory pipe stage sequence", () => {
      const trace = appendAllCanonicalStages(
        createExecutionTrace(baseTraceInput())
      );
      expect(trace.stages.map((s) => s.stageType)).toEqual([
        "context",
        "policy",
        "enablement",
        "execution_plan",
        "transaction_plan",
        "audit",
        "review",
        "adapter"
      ]);
      expect(trace.stages.every((s) => s.executed === false)).toBe(true);
    });

    test("rejects append on finalized and invalid traces", () => {
      const open = createExecutionTrace(baseTraceInput());
      const finalized = finalizeExecutionTrace(open).trace;
      const blocked = appendExecutionStage(finalized, {
        stageType: DIAGNOSTIC_STAGE_TYPES.AUDIT
      });
      expect(blocked.success).toBe(false);
      expect(blocked.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.TRACE_FINALIZED
      );
      expect(blocked.trace.stages).toHaveLength(finalized.stages.length);

      const invalid = createExecutionTrace(baseTraceInput());
      invalid.status = TRACE_STATUSES.INVALID;
      const invalidAppend = appendExecutionStage(invalid, {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT
      });
      expect(invalidAppend.success).toBe(false);
      expect(invalidAppend.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.TRACE_INVALID
      );
    });

    test("rejects non-object trace and bad stage input", () => {
      const badTrace = appendExecutionStage(null, {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT
      });
      expect(badTrace.success).toBe(false);
      expect(badTrace.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT
      );

      const open = createExecutionTrace(baseTraceInput());
      const badStage = appendExecutionStage(open, {
        stageType: "persist_live"
      });
      expect(badStage.success).toBe(false);
      expect(badStage.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_TYPE
      );
      expect(badStage.trace.stages).toEqual([]);
    });
  });

  describe("finalize", () => {
    test("finalizes with completed stage and summary", () => {
      const open = appendAllCanonicalStages(
        createExecutionTrace(baseTraceInput())
      );
      const result = finalizeExecutionTrace(open, {
        message: "pipe complete"
      });
      expect(result.success).toBe(true);
      assertTraceShell(result.trace, TRACE_STATUSES.FINALIZED);
      expect(result.stage).toEqual(
        expect.objectContaining({
          stageType: DIAGNOSTIC_STAGE_TYPES.COMPLETED,
          status: DIAGNOSTIC_STAGE_STATUSES.COMPLETED,
          message: "pipe complete",
          order: 8
        })
      );
      expect(result.trace.stages).toHaveLength(9);
      expect(result.trace.summary).toEqual(
        expect.objectContaining({
          stageCount: 9,
          hasCompletedStage: true,
          finalized: true,
          open: false,
          architectureOnly: true,
          executed: false,
          sideEffects: false,
          persistenceEnabled: false
        })
      );
      expect(result.trace.summary.stageTypes).toContain("completed");
      expect(validateExecutionTrace(result.trace).valid).toBe(true);
    });

    test("finalize is idempotent and skips duplicate completed stage", () => {
      const open = createExecutionTrace(baseTraceInput());
      const withCompleted = appendExecutionStage(open, {
        stageType: DIAGNOSTIC_STAGE_TYPES.COMPLETED,
        status: DIAGNOSTIC_STAGE_STATUSES.COMPLETED
      }).trace;
      const first = finalizeExecutionTrace(withCompleted, {
        appendCompleted: true
      });
      expect(first.success).toBe(true);
      expect(first.trace.stages).toHaveLength(1);
      expect(first.stage).toBeNull();

      const second = finalizeExecutionTrace(first.trace);
      expect(second.success).toBe(true);
      expect(second.trace.status).toBe(TRACE_STATUSES.FINALIZED);
      expect(second.trace.stages).toHaveLength(1);
      expect(second.trace.summary).toEqual(
        summarizeExecutionTrace(second.trace)
      );
    });

    test("finalize can skip auto-completed stage", () => {
      const open = appendExecutionStage(
        createExecutionTrace(baseTraceInput()),
        { stageType: DIAGNOSTIC_STAGE_TYPES.ADAPTER }
      ).trace;
      const result = finalizeExecutionTrace(open, { appendCompleted: false });
      expect(result.success).toBe(true);
      expect(result.trace.stages).toHaveLength(1);
      expect(result.trace.summary.hasCompletedStage).toBe(false);
      expect(result.trace.status).toBe(TRACE_STATUSES.FINALIZED);
    });

    test("cannot finalize without traceId", () => {
      const open = createExecutionTrace({ correlationId: "c" });
      const result = finalizeExecutionTrace(open);
      expect(result.success).toBe(false);
      expect(result.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
      );
      expect(result.trace.status).toBe(TRACE_STATUSES.OPEN);
    });
  });

  describe("summary", () => {
    test("summarize counts statuses and stage types in order", () => {
      let trace = createExecutionTrace(baseTraceInput());
      trace = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
        status: DIAGNOSTIC_STAGE_STATUSES.RECORDED
      }).trace;
      trace = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.POLICY,
        status: DIAGNOSTIC_STAGE_STATUSES.SKIPPED
      }).trace;
      trace = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.ENABLEMENT,
        status: DIAGNOSTIC_STAGE_STATUSES.BLOCKED
      }).trace;

      const summary = summarizeExecutionTrace(trace);
      expect(summary).toEqual(
        expect.objectContaining({
          stageCount: 3,
          stageTypes: ["context", "policy", "enablement"],
          hasCompletedStage: false,
          blockedStageCount: 1,
          skippedStageCount: 1,
          recordedStageCount: 1,
          open: true,
          finalized: false,
          architectureOnly: true,
          executed: false,
          sideEffects: false,
          persistenceEnabled: false
        })
      );
      expect(summary.statusCounts).toEqual({
        recorded: 1,
        skipped: 1,
        blocked: 1,
        completed: 0
      });
      expect(summary.reasons).toEqual(
        [...summary.reasons].sort((a, b) => a.localeCompare(b))
      );
      expect(summary.reason).toBe(summary.reasons[0]);
    });

    test("empty and non-object traces summarize safely", () => {
      const empty = summarizeExecutionTrace(createExecutionTrace(baseTraceInput()));
      expect(empty.stageCount).toBe(0);
      expect(empty.stageTypes).toEqual([]);
      expect(empty.open).toBe(true);

      const fallback = summarizeExecutionTrace(null);
      expect(fallback.stageCount).toBe(0);
      expect(fallback.open).toBe(false);
      expect(fallback.finalized).toBe(false);
      expect(fallback.architectureOnly).toBe(true);
      expect(fallback.executed).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    test("validateStageInput rejects missing and invalid fields", () => {
      expect(validateStageInput(null)).toEqual(
        expect.objectContaining({
          valid: false,
          reasons: expect.arrayContaining([
            DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT
          ])
        })
      );
      expect(validateStageInput({})).toEqual(
        expect.objectContaining({
          valid: false,
          reasons: expect.arrayContaining([
            DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
          ])
        })
      );
      expect(
        validateStageInput({
          stageType: "live_persist",
          status: "running",
          message: 9,
          detail: [],
          reasons: "nope",
          stageId: 3
        })
      ).toEqual(
        expect.objectContaining({
          valid: false,
          reasons: expect.arrayContaining([
            DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_TYPE,
            DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_STATUS,
            DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD
          ])
        })
      );
      expect(
        validateStageInput({
          stageType: DIAGNOSTIC_STAGE_TYPES.AUDIT,
          status: DIAGNOSTIC_STAGE_STATUSES.RECORDED
        }).valid
      ).toBe(true);
    });

    test("validateExecutionTrace rejects bad shells and stages", () => {
      expect(validateExecutionTrace(null).valid).toBe(false);
      expect(validateExecutionTrace({}).valid).toBe(false);

      const trace = createExecutionTrace(baseTraceInput());
      const bad = {
        ...trace,
        stages: [{ stageType: "context" }]
      };
      expect(validateExecutionTrace(bad).valid).toBe(false);

      const mutated = createExecutionTrace(baseTraceInput());
      mutated.executed = true;
      mutated.architectureOnly = false;
      expect(validateExecutionTrace(mutated).valid).toBe(false);
      expect(isExecutionTraceArchitectureOnly(mutated)).toBe(false);
    });

    test("append rejects non-architecture-only traces", () => {
      const trace = createExecutionTrace(baseTraceInput());
      trace.architectureOnly = false;
      const result = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT
      });
      expect(result.success).toBe(false);
      expect(result.reasons).toContain(
        DIAGNOSTIC_VALIDATION_REASONS.TRACE_NOT_ARCHITECTURE_ONLY
      );
    });
  });

  describe("deterministic behavior", () => {
    test("identical inputs yield identical traces and operations", () => {
      const input = baseTraceInput({
        metadata: { marker: "same", flag: false }
      });
      expect(createExecutionTrace(input)).toEqual(createExecutionTrace(input));

      const t1 = createExecutionTrace(input);
      const t2 = createExecutionTrace(input);
      const a1 = appendExecutionStage(t1, {
        stageType: DIAGNOSTIC_STAGE_TYPES.POLICY,
        status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
        detail: { action: "preview_only" },
        reasons: ["B", "A"]
      });
      const a2 = appendExecutionStage(t2, {
        stageType: DIAGNOSTIC_STAGE_TYPES.POLICY,
        status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
        detail: { action: "preview_only" },
        reasons: ["B", "A"]
      });
      expect(a1).toEqual(a2);
      expect(finalizeExecutionTrace(a1.trace)).toEqual(
        finalizeExecutionTrace(a2.trace)
      );
      expect(summarizeExecutionTrace(a1.trace)).toEqual(
        summarizeExecutionTrace(a2.trace)
      );
      expect(validateExecutionTrace(a1.trace)).toEqual(
        validateExecutionTrace(a2.trace)
      );
    });

    test("reasons are sorted uniquely on stages and summaries", () => {
      const result = appendExecutionStage(
        createExecutionTrace(baseTraceInput()),
        {
          stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
          reasons: ["Z", "M", "A", "M"]
        }
      );
      expect(result.stage.reasons).toEqual(["A", "M", "Z"]);
      const summary = summarizeExecutionTrace(
        finalizeExecutionTrace(result.trace).trace
      );
      expect(summary.reasons).toEqual(
        [...summary.reasons].sort((a, b) => a.localeCompare(b))
      );
      expect(new Set(summary.reasons).size).toBe(summary.reasons.length);
    });
  });

  describe("non-mutation", () => {
    test("create / append / finalize / summarize do not mutate inputs", () => {
      const input = baseTraceInput({
        metadata: { nested: true, marker: "keep" }
      });
      const beforeInput = JSON.stringify(input);
      const trace = createExecutionTrace(input);
      expect(JSON.stringify(input)).toBe(beforeInput);

      const stageInput = {
        stageType: DIAGNOSTIC_STAGE_TYPES.ADAPTER,
        status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
        detail: { outcome: "preview_only" },
        reasons: ["X", "Y"]
      };
      const beforeTrace = JSON.stringify(trace);
      const beforeStage = JSON.stringify(stageInput);
      const appended = appendExecutionStage(trace, stageInput);
      expect(JSON.stringify(trace)).toBe(beforeTrace);
      expect(JSON.stringify(stageInput)).toBe(beforeStage);

      const beforeAppended = JSON.stringify(appended.trace);
      const options = { message: "done", appendCompleted: true };
      const beforeOptions = JSON.stringify(options);
      finalizeExecutionTrace(appended.trace, options);
      summarizeExecutionTrace(appended.trace);
      validateExecutionTrace(appended.trace);
      expect(JSON.stringify(appended.trace)).toBe(beforeAppended);
      expect(JSON.stringify(options)).toBe(beforeOptions);
      expect(JSON.stringify(input)).toBe(beforeInput);
    });

    test("mutating a prior result does not affect a fresh operation", () => {
      const input = baseTraceInput();
      const first = appendExecutionStage(createExecutionTrace(input), {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
        detail: { mode: "preview" }
      });
      first.trace.executed = true;
      first.trace.metadata.persistenceEnabled = true;
      first.trace.stages[0].reasons.push("LEAK");
      first.stage.detail.mode = "live";

      const second = appendExecutionStage(createExecutionTrace(input), {
        stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
        detail: { mode: "preview" }
      });
      expect(second.trace.executed).toBe(false);
      expect(second.trace.metadata.persistenceEnabled).toBe(false);
      expect(second.trace.stages[0].reasons).not.toContain("LEAK");
      expect(second.stage.detail.mode).toBe("preview");
    });

    test("detail and metadata are cloned without shared references", () => {
      const detail = { action: "preview_only" };
      const input = baseTraceInput({ metadata: { marker: "src" } });
      const trace = createExecutionTrace(input);
      const result = appendExecutionStage(trace, {
        stageType: DIAGNOSTIC_STAGE_TYPES.POLICY,
        detail
      });
      result.stage.detail.action = "persist";
      result.trace.metadata.marker = "changed";
      expect(detail.action).toBe("preview_only");
      expect(input.metadata.marker).toBe("src");
      expect(trace.metadata.marker).toBe("src");
    });
  });

  describe("architecture boundaries (source)", () => {
    test("diagnostics module never performs I/O or persistence side effects", () => {
      const source = read("server/lib/recruitment/executionDiagnostics.js");
      expect(source).toMatch(/Phase 46/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never writes to database/);
      expect(source).toMatch(/Never writes files/);
      expect(source).toMatch(/Never uses console logging/);
      expect(source).toMatch(/Never modifies workers/);
      expect(source).toMatch(/Never enables persistence/);
      expect(source).toMatch(/Never changes runtime/);
      expect(source).toMatch(/Never calls repositories/);
      expect(source).toMatch(/Never starts transactions/);
      expect(source).toMatch(/Never enqueues queues/);
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
      expect(source).not.toMatch(/simulateDryRunPersistence/);
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/controlledRuntimeExecutionAdapter/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(source).not.toMatch(/require\(/);
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/consoleLogging: false/);
      expect(source).toMatch(/databaseWrites: false/);
    });

    test("siteWorker is unchanged — diagnostics not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/executionDiagnostics/);
      expect(worker).not.toMatch(/createExecutionTrace/);
      expect(worker).not.toMatch(/appendExecutionStage/);
      expect(worker).not.toMatch(/finalizeExecutionTrace/);
    });

    test("prior modules do not import the diagnostics module", () => {
      const files = [
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
        "server/lib/recruitment/reviewWorkflow.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/lib/recruitment/reviewQueue.js",
        "server/config/recruitmentPipeline.js",
        "server/config/recruitmentLifecycle.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/executionDiagnostics/);
        expect(source).not.toMatch(/createExecutionTrace/);
        expect(source).not.toMatch(/appendExecutionStage/);
        expect(source).not.toMatch(/finalizeExecutionTrace/);
      }
    });

    test("prior phase modules are unchanged by this phase", () => {
      const files = {
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/persistenceEnablement.js": /Phase 44/,
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js":
          /Phase 45/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 46/);
      }
    });

    test("all public paths remain architecture-only and non-executing", () => {
      const open = createExecutionTrace(baseTraceInput());
      const appended = appendExecutionStage(open, {
        stageType: DIAGNOSTIC_STAGE_TYPES.ADAPTER,
        status: DIAGNOSTIC_STAGE_STATUSES.BLOCKED
      });
      const finalized = finalizeExecutionTrace(appended.trace);
      const samples = [
        open,
        appended.trace,
        finalized.trace,
        createExecutionTrace(null),
        appendExecutionStage(null, null).trace,
        finalizeExecutionTrace(null).trace
      ];

      for (const trace of samples) {
        expect(trace.executed).toBe(false);
        expect(trace.architectureOnly).toBe(true);
        expect(trace.advisory).toBe(true);
        expect(trace.metadata.persistenceEnabled).toBe(false);
        expect(trace.metadata.sideEffects).toBe(false);
        expect(trace.metadata.consoleLogging).toBe(false);
        expect(trace.metadata.fileWrites).toBe(false);
        expect(trace.metadata.databaseWrites).toBe(false);
        expect(isExecutionTraceArchitectureOnly(trace)).toBe(true);
      }

      const summary = summarizeExecutionTrace(finalized.trace);
      expect(summary.executed).toBe(false);
      expect(summary.architectureOnly).toBe(true);
      expect(summary.persistenceEnabled).toBe(false);
      expect(summary.sideEffects).toBe(false);
    });
  });
});
