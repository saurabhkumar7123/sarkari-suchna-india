"use strict";

/**
 * Phase 40 — Execution Context & Correlation Layer tests.
 * Architecture only: create/validate/child contexts — no I/O or persistence.
 */

const fs = require("fs");
const path = require("path");

const {
  RUNTIME_MODES
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  EXECUTION_MODES,
  CONTEXT_VALIDATION_REASONS,
  REQUIRED_CONTEXT_FIELDS,
  REQUIRED_RECRUITMENT_FIELDS,
  createExecutionContext,
  createChildContext,
  validateExecutionContext,
  isValidExecutionContext,
  isExecutionContextArchitectureOnly,
  isSupportedExecutionMode,
  toAuditCorrelation
} = require("../server/lib/recruitment/executionContext");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertContextShell(ctx) {
  expect(ctx.architectureOnly).toBe(true);
  expect(typeof ctx.contextId).toBe("string");
  expect(ctx.contextId.length).toBeGreaterThan(0);
  expect(
    ctx.correlationId === null || typeof ctx.correlationId === "string"
  ).toBe(true);
  expect(
    ctx.pipelineRunId === null || typeof ctx.pipelineRunId === "string"
  ).toBe(true);
  expect(
    ctx.parentContextId === null || typeof ctx.parentContextId === "string"
  ).toBe(true);
  expect(
    ctx.sourceModule === null || typeof ctx.sourceModule === "string"
  ).toBe(true);
  expect(Object.keys(ctx.recruitment).sort()).toEqual(
    [...REQUIRED_RECRUITMENT_FIELDS].sort()
  );
  expect(ctx.metadata).toEqual(
    expect.objectContaining({
      sideEffects: false,
      advisory: true,
      architectureOnly: true,
      persisted: false,
      written: false,
      propagated: false,
      persistenceEnabled: false,
      automationEnabled: false
    })
  );
  expect(isExecutionContextArchitectureOnly(ctx)).toBe(true);
  expect(validateExecutionContext(ctx).valid).toBe(true);
  expect(isValidExecutionContext(ctx)).toBe(true);
}

describe("Phase 40 — executionContext", () => {
  describe("constants", () => {
    test("exposes frozen execution modes and validation reasons", () => {
      expect(EXECUTION_MODES).toEqual({
        LIVE: "live",
        PREVIEW: "preview",
        DRY_RUN: "dry_run"
      });
      expect(EXECUTION_MODES).toEqual(RUNTIME_MODES);
      expect(CONTEXT_VALIDATION_REASONS).toEqual({
        VALID: "VALID",
        INVALID_INPUT: "INVALID_INPUT",
        MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
        UNSUPPORTED_EXECUTION_MODE: "UNSUPPORTED_EXECUTION_MODE",
        INVALID_FIELD: "INVALID_FIELD",
        INVALID_PARENT: "INVALID_PARENT"
      });
      expect(REQUIRED_CONTEXT_FIELDS).toEqual(
        expect.arrayContaining([
          "contextId",
          "correlationId",
          "pipelineRunId",
          "parentContextId",
          "executionMode",
          "sourceModule",
          "recruitment",
          "metadata",
          "architectureOnly"
        ])
      );
      expect(Object.isFrozen(EXECUTION_MODES)).toBe(true);
      expect(Object.isFrozen(CONTEXT_VALIDATION_REASONS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_CONTEXT_FIELDS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_RECRUITMENT_FIELDS)).toBe(true);
    });

    test("isSupportedExecutionMode covers only declared modes", () => {
      for (const mode of Object.values(EXECUTION_MODES)) {
        expect(isSupportedExecutionMode(mode)).toBe(true);
      }
      expect(isSupportedExecutionMode("unknown")).toBe(false);
      expect(isSupportedExecutionMode(null)).toBe(false);
      expect(isSupportedExecutionMode("")).toBe(false);
    });
  });

  describe("context creation", () => {
    test("createExecutionContext builds a complete architecture-only context", () => {
      const ctx = createExecutionContext({
        correlationId: "corr-1",
        pipelineRunId: "run-1",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "runtimePersistencePolicy",
        recruitment: {
          recruitmentId: "rec-42",
          lifecycleEventType: "admit_card",
          lifecycleState: "open",
          eventRef: "evt-9"
        },
        metadata: { stage: "policy" }
      });

      assertContextShell(ctx);
      expect(ctx.correlationId).toBe("corr-1");
      expect(ctx.pipelineRunId).toBe("run-1");
      expect(ctx.parentContextId).toBe(null);
      expect(ctx.executionMode).toBe(EXECUTION_MODES.LIVE);
      expect(ctx.sourceModule).toBe("runtimePersistencePolicy");
      expect(ctx.recruitment).toEqual({
        recruitmentId: "rec-42",
        lifecycleEventType: "admit_card",
        lifecycleState: "open",
        eventRef: "evt-9"
      });
      expect(ctx.metadata.createReason).toBe(CONTEXT_VALIDATION_REASONS.VALID);
      expect(ctx.metadata.stage).toBe("policy");
    });

    test("derives correlation, pipeline run, and context ids when omitted", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.PREVIEW,
        sourceModule: "persistenceExecutionPipeline",
        recruitmentId: "rec-a",
        eventType: "result",
        lifecycleState: "results"
      });

      assertContextShell(ctx);
      expect(ctx.correlationId).toMatch(/^corr_/);
      expect(ctx.pipelineRunId).toMatch(/^run_/);
      expect(ctx.contextId).toMatch(/^ctx_/);
      expect(ctx.recruitment.lifecycleEventType).toBe("result");
      expect(ctx.recruitment.recruitmentId).toBe("rec-a");
    });

    test("honors explicit contextId when provided", () => {
      const ctx = createExecutionContext({
        contextId: "ctx_explicit",
        executionMode: EXECUTION_MODES.DRY_RUN,
        sourceModule: "transactionCoordinator"
      });
      expect(ctx.contextId).toBe("ctx_explicit");
      expect(ctx.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
      assertContextShell(ctx);
    });

    test("accepts top-level recruitment aliases", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.LIVE,
        recruitmentId: "r-1",
        lifecycleEventType: "notification",
        lifecycleState: "announced",
        eventId: "e-1"
      });
      expect(ctx.recruitment).toEqual({
        recruitmentId: "r-1",
        lifecycleEventType: "notification",
        lifecycleState: "announced",
        eventRef: "e-1"
      });
    });
  });

  describe("execution modes", () => {
    test("supports live, preview, and dry_run", () => {
      for (const mode of Object.values(EXECUTION_MODES)) {
        const ctx = createExecutionContext({
          executionMode: mode,
          sourceModule: "test"
        });
        expect(ctx.executionMode).toBe(mode);
        assertContextShell(ctx);
      }
    });

    test("defaults to preview when mode omitted", () => {
      const ctx = createExecutionContext({ sourceModule: "test" });
      expect(ctx.executionMode).toBe(EXECUTION_MODES.PREVIEW);
      assertContextShell(ctx);
    });

    test("falls back to preview for unsupported mode and records reason", () => {
      const ctx = createExecutionContext({
        executionMode: "production",
        sourceModule: "test"
      });
      expect(ctx.executionMode).toBe(EXECUTION_MODES.PREVIEW);
      expect(ctx.metadata.createReason).toBe(
        CONTEXT_VALIDATION_REASONS.UNSUPPORTED_EXECUTION_MODE
      );
      expect(ctx.metadata.requestedExecutionMode).toBe("production");
      assertContextShell(ctx);
    });
  });

  describe("child context behavior", () => {
    test("createChildContext links to parent and preserves correlation", () => {
      const parent = createExecutionContext({
        correlationId: "corr-root",
        pipelineRunId: "run-root",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "runRecruitmentPipeline",
        recruitment: {
          recruitmentId: "rec-1",
          lifecycleEventType: "admit_card",
          lifecycleState: "open",
          eventRef: "evt-1"
        },
        metadata: { root: true, marker: "parent" }
      });

      const child = createChildContext(parent, {
        sourceModule: "runtimePersistencePolicy",
        metadata: { stage: "policy" }
      });

      assertContextShell(child);
      expect(child.parentContextId).toBe(parent.contextId);
      expect(child.correlationId).toBe(parent.correlationId);
      expect(child.pipelineRunId).toBe(parent.pipelineRunId);
      expect(child.executionMode).toBe(parent.executionMode);
      expect(child.sourceModule).toBe("runtimePersistencePolicy");
      expect(child.contextId).not.toBe(parent.contextId);
      expect(child.recruitment).toEqual(parent.recruitment);
      expect(child.metadata.childContext).toBe(true);
      expect(child.metadata.correlationPreserved).toBe(true);
      expect(child.metadata.pipelineRunPreserved).toBe(true);
      expect(child.metadata.root).toBe(true);
      expect(child.metadata.stage).toBe("policy");
      expect(child.metadata.marker).toBe("parent");
    });

    test("child can refine recruitment association without breaking correlation", () => {
      const parent = createExecutionContext({
        correlationId: "corr-x",
        pipelineRunId: "run-x",
        executionMode: EXECUTION_MODES.PREVIEW,
        sourceModule: "detectionProcessor",
        recruitment: {
          recruitmentId: "rec-9",
          lifecycleEventType: "notification",
          lifecycleState: "announced",
          eventRef: null
        }
      });

      const child = createChildContext(parent, {
        sourceModule: "eventTypeClassifier",
        recruitment: {
          lifecycleEventType: "admit_card",
          eventRef: "evt-refined"
        }
      });

      expect(child.correlationId).toBe("corr-x");
      expect(child.pipelineRunId).toBe("run-x");
      expect(child.recruitment).toEqual({
        recruitmentId: "rec-9",
        lifecycleEventType: "admit_card",
        lifecycleState: "announced",
        eventRef: "evt-refined"
      });
    });

    test("nested children preserve root correlation across depth", () => {
      const root = createExecutionContext({
        correlationId: "corr-chain",
        pipelineRunId: "run-chain",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "siteWorker"
      });
      const mid = createChildContext(root, {
        sourceModule: "persistenceExecutionPipeline"
      });
      const leaf = createChildContext(mid, {
        sourceModule: "auditTrail"
      });

      expect(mid.correlationId).toBe("corr-chain");
      expect(leaf.correlationId).toBe("corr-chain");
      expect(leaf.pipelineRunId).toBe("run-chain");
      expect(mid.parentContextId).toBe(root.contextId);
      expect(leaf.parentContextId).toBe(mid.contextId);
      expect(leaf.contextId).not.toBe(mid.contextId);
      expect(leaf.contextId).not.toBe(root.contextId);
    });

    test("invalid parent produces architecture-only context with INVALID_PARENT", () => {
      const child = createChildContext(null, {
        sourceModule: "test",
        correlationId: "corr-orphan"
      });
      assertContextShell(child);
      expect(child.parentContextId).toBe(null);
      expect(child.metadata.invalidParent).toBe(true);
      expect(child.metadata.createReason).toBe(
        CONTEXT_VALIDATION_REASONS.INVALID_PARENT
      );
      expect(child.correlationId).toBe("corr-orphan");
    });
  });

  describe("correlation preservation", () => {
    test("toAuditCorrelation projects context into audit correlation shape", () => {
      const ctx = createExecutionContext({
        correlationId: "corr-audit",
        pipelineRunId: "run-audit",
        parentContextId: "ctx-parent",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "runtimePersistenceService"
      });

      expect(toAuditCorrelation(ctx, { pipelineStage: "outcome" })).toEqual({
        correlationId: "corr-audit",
        parentEventId: "ctx-parent",
        pipelineStage: "outcome",
        sourceModule: "runtimePersistenceService"
      });

      expect(
        toAuditCorrelation(ctx, {
          parentEventId: "audit_parent",
          pipelineStage: "policy",
          sourceModule: "override"
        })
      ).toEqual({
        correlationId: "corr-audit",
        parentEventId: "audit_parent",
        pipelineStage: "policy",
        sourceModule: "override"
      });
    });

    test("toAuditCorrelation handles invalid context safely", () => {
      expect(toAuditCorrelation(null, { pipelineStage: "pipeline" })).toEqual({
        correlationId: null,
        parentEventId: null,
        pipelineStage: "pipeline",
        sourceModule: null
      });
    });
  });

  describe("validation", () => {
    test("validateExecutionContext accepts created contexts", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test"
      });
      const result = validateExecutionContext(ctx);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([CONTEXT_VALIDATION_REASONS.VALID]);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test("rejects non-object input", () => {
      const result = validateExecutionContext(null);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(CONTEXT_VALIDATION_REASONS.INVALID_INPUT);
    });

    test("rejects missing required fields", () => {
      const result = validateExecutionContext({
        contextId: "ctx_1",
        architectureOnly: true
      });
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        CONTEXT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
      );
      expect(result.errors.some((e) => e.includes("correlationId"))).toBe(true);
    });

    test("rejects unsupported execution mode on validation", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test"
      });
      const bogus = { ...ctx, executionMode: "boss_mode" };
      const result = validateExecutionContext(bogus);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        CONTEXT_VALIDATION_REASONS.UNSUPPORTED_EXECUTION_MODE
      );
    });

    test("rejects architectureOnly !== true and unsafe metadata flags", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.PREVIEW,
        sourceModule: "test"
      });

      expect(
        validateExecutionContext({ ...ctx, architectureOnly: false }).valid
      ).toBe(false);

      expect(
        validateExecutionContext({
          ...ctx,
          metadata: { ...ctx.metadata, persisted: true }
        }).valid
      ).toBe(false);

      expect(
        validateExecutionContext({
          ...ctx,
          metadata: { ...ctx.metadata, propagated: true }
        }).valid
      ).toBe(false);

      expect(
        validateExecutionContext({
          ...ctx,
          metadata: { ...ctx.metadata, automationEnabled: true }
        }).valid
      ).toBe(false);
    });

    test("rejects incomplete recruitment association", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test"
      });
      const result = validateExecutionContext({
        ...ctx,
        recruitment: { recruitmentId: "r-1" }
      });
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        CONTEXT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
      );
    });

    test("isValidExecutionContext mirrors validateExecutionContext.valid", () => {
      const good = createExecutionContext({
        executionMode: EXECUTION_MODES.DRY_RUN,
        sourceModule: "test"
      });
      expect(isValidExecutionContext(good)).toBe(true);
      expect(isValidExecutionContext(null)).toBe(false);
      expect(isValidExecutionContext({})).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    test("createExecutionContext handles null / non-object input", () => {
      for (const bad of [null, undefined, "x", 1, [], true]) {
        const ctx = createExecutionContext(bad);
        assertContextShell(ctx);
        expect(ctx.executionMode).toBe(EXECUTION_MODES.PREVIEW);
        expect(ctx.metadata.invalidInput).toBe(true);
        expect(ctx.metadata.createReason).toBe(
          CONTEXT_VALIDATION_REASONS.INVALID_INPUT
        );
      }
    });

    test("trims empty strings to null for identity fields", () => {
      const ctx = createExecutionContext({
        correlationId: "  ",
        pipelineRunId: "",
        sourceModule: "   ",
        executionMode: EXECUTION_MODES.LIVE,
        recruitment: {
          recruitmentId: "  ",
          lifecycleEventType: "",
          lifecycleState: " open ",
          eventRef: "  "
        }
      });
      expect(ctx.sourceModule).toBe(null);
      expect(ctx.recruitment.recruitmentId).toBe(null);
      expect(ctx.recruitment.lifecycleEventType).toBe(null);
      expect(ctx.recruitment.lifecycleState).toBe("open");
      expect(ctx.recruitment.eventRef).toBe(null);
      expect(ctx.correlationId).toMatch(/^corr_/);
      expect(ctx.pipelineRunId).toMatch(/^run_/);
      assertContextShell(ctx);
    });
  });

  describe("deterministic behavior", () => {
    test("identical inputs produce identical contexts", () => {
      const input = {
        correlationId: "corr-det",
        pipelineRunId: "run-det",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "runtimePersistencePolicy",
        recruitment: {
          recruitmentId: "rec-1",
          lifecycleEventType: "admit_card",
          lifecycleState: "open",
          eventRef: "evt-1"
        },
        metadata: { stage: "policy", tags: ["a", "b"] }
      };
      const a = createExecutionContext(input);
      const b = createExecutionContext(input);
      expect(a).toEqual(b);
      expect(a.contextId).toBe(b.contextId);
    });

    test("derived ids are stable across calls when identities omitted", () => {
      const input = {
        executionMode: EXECUTION_MODES.PREVIEW,
        sourceModule: "persistenceExecutionPipeline",
        recruitment: {
          recruitmentId: "rec-stable",
          lifecycleEventType: "result",
          lifecycleState: "results",
          eventRef: null
        }
      };
      const a = createExecutionContext(input);
      const b = createExecutionContext(input);
      expect(a.correlationId).toBe(b.correlationId);
      expect(a.pipelineRunId).toBe(b.pipelineRunId);
      expect(a.contextId).toBe(b.contextId);
    });

    test("child contexts are deterministic for the same parent and overrides", () => {
      const parent = createExecutionContext({
        correlationId: "corr-child-det",
        pipelineRunId: "run-child-det",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "root"
      });
      const overrides = {
        sourceModule: "child",
        metadata: { step: 1 }
      };
      expect(createChildContext(parent, overrides)).toEqual(
        createChildContext(parent, overrides)
      );
    });
  });

  describe("non-mutation", () => {
    test("createExecutionContext does not mutate input", () => {
      const input = {
        correlationId: "corr-m",
        pipelineRunId: "run-m",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test",
        recruitment: {
          recruitmentId: "r-1",
          lifecycleEventType: "admit_card",
          lifecycleState: "open",
          eventRef: "e-1"
        },
        metadata: { nested: { value: 1 } }
      };
      const before = JSON.stringify(input);
      createExecutionContext(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    test("createChildContext does not mutate parent or overrides", () => {
      const parent = createExecutionContext({
        correlationId: "corr-m2",
        pipelineRunId: "run-m2",
        executionMode: EXECUTION_MODES.PREVIEW,
        sourceModule: "parent",
        metadata: { keep: true }
      });
      const overrides = {
        sourceModule: "child",
        metadata: { added: true },
        recruitment: { eventRef: "e-new" }
      };
      const parentBefore = JSON.stringify(parent);
      const overridesBefore = JSON.stringify(overrides);
      createChildContext(parent, overrides);
      expect(JSON.stringify(parent)).toBe(parentBefore);
      expect(JSON.stringify(overrides)).toBe(overridesBefore);
    });

    test("mutating a returned context does not affect a fresh create", () => {
      const input = {
        correlationId: "corr-m3",
        pipelineRunId: "run-m3",
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test",
        metadata: { marker: "ok" }
      };
      const first = createExecutionContext(input);
      first.metadata.marker = "MUTATED";
      first.correlationId = "hacked";
      first.recruitment.recruitmentId = "hacked";
      const second = createExecutionContext(input);
      expect(second.metadata.marker).toBe("ok");
      expect(second.correlationId).toBe("corr-m3");
      expect(second.recruitment.recruitmentId).toBe(null);
    });

    test("metadata safety flags cannot be overridden via input", () => {
      const ctx = createExecutionContext({
        executionMode: EXECUTION_MODES.LIVE,
        sourceModule: "test",
        metadata: {
          sideEffects: true,
          persisted: true,
          written: true,
          propagated: true,
          persistenceEnabled: true,
          automationEnabled: true,
          advisory: false,
          architectureOnly: false,
          custom: "kept"
        }
      });
      expect(ctx.metadata.sideEffects).toBe(false);
      expect(ctx.metadata.persisted).toBe(false);
      expect(ctx.metadata.written).toBe(false);
      expect(ctx.metadata.propagated).toBe(false);
      expect(ctx.metadata.persistenceEnabled).toBe(false);
      expect(ctx.metadata.automationEnabled).toBe(false);
      expect(ctx.metadata.advisory).toBe(true);
      expect(ctx.metadata.architectureOnly).toBe(true);
      expect(ctx.metadata.custom).toBe("kept");
      expect(isExecutionContextArchitectureOnly(ctx)).toBe(true);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("context module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/executionContext.js");
      expect(source).toMatch(/Phase 40/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never writes to a database/);
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
      expect(source).not.toMatch(/AsyncLocalStorage|cls-hooked/);
    });

    test("context module has no runtime requires (self-contained)", () => {
      const source = read("server/lib/recruitment/executionContext.js");
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("siteWorker is unchanged — execution context not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/executionContext/);
      expect(worker).not.toMatch(/createExecutionContext/);
      expect(worker).not.toMatch(/createChildContext/);
      expect(worker).not.toMatch(/auditTrail/);
      expect(worker).not.toMatch(/transactionCoordinator/);
      expect(worker).not.toMatch(/persistenceExecutionPipeline/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("prior persistence and audit modules do not import execution context", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/auditTrail.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/services/recruitmentReview.service.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/executionContext/);
        expect(source).not.toMatch(/createExecutionContext/);
        expect(source).not.toMatch(/createChildContext/);
      }
    });

    test("prior persistence and audit modules are unchanged by this phase", () => {
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
      const audit = read("server/lib/recruitment/auditTrail.js");

      expect(policy).toMatch(/Phase 33/);
      expect(policy).not.toMatch(/Phase 40/);
      expect(service).toMatch(/Phase 34/);
      expect(service).not.toMatch(/Phase 40/);
      expect(contracts).toMatch(/Phase 35/);
      expect(contracts).not.toMatch(/Phase 40/);
      expect(adapters).toMatch(/Phase 36/);
      expect(adapters).not.toMatch(/Phase 40/);
      expect(pipeline).toMatch(/Phase 37/);
      expect(pipeline).not.toMatch(/Phase 40/);
      expect(coordinator).toMatch(/Phase 38/);
      expect(coordinator).not.toMatch(/Phase 40/);
      expect(audit).toMatch(/Phase 39/);
      expect(audit).not.toMatch(/Phase 40/);
    });

    test("contexts never enable persistence, propagation, or automation", () => {
      const source = read("server/lib/recruitment/executionContext.js");
      expect(source).toMatch(/persisted: false/);
      expect(source).toMatch(/written: false/);
      expect(source).toMatch(/propagated: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/automationEnabled: false/);
      expect(source).toMatch(/architectureOnly: true/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      const samples = [
        createExecutionContext({
          executionMode: EXECUTION_MODES.LIVE,
          sourceModule: "policy"
        }),
        createExecutionContext(null),
        createChildContext(
          createExecutionContext({
            correlationId: "c",
            pipelineRunId: "r",
            executionMode: EXECUTION_MODES.PREVIEW,
            sourceModule: "root"
          }),
          { sourceModule: "child" }
        ),
        createChildContext(null, { sourceModule: "orphan" })
      ];

      for (const ctx of samples) {
        expect(ctx.architectureOnly).toBe(true);
        expect(ctx.metadata.persisted).toBe(false);
        expect(ctx.metadata.written).toBe(false);
        expect(ctx.metadata.propagated).toBe(false);
        expect(ctx.metadata.persistenceEnabled).toBe(false);
        expect(ctx.metadata.automationEnabled).toBe(false);
        expect(isExecutionContextArchitectureOnly(ctx)).toBe(true);
      }
    });
  });
});
