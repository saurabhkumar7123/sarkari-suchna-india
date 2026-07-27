"use strict";

/**
 * Phase 69 — Recruitment Compatibility Layer tests.
 * Normalization, compatibility creation, immutability, deterministic behavior,
 * backward compatibility, failure isolation, and pipeline integration.
 */

const fs = require("fs");
const path = require("path");

const {
  COMPATIBILITY_LAYER_PHASE,
  INTEGRATION_TARGET_ID,
  ADOPTION_ORDER_ENTRY,
  UPDATE_NOTICE_KEYS,
  FOUNDATION_BRIDGE_DESCRIPTORS,
  RECRUITMENT_COMPATIBILITY_DESCRIPTOR,
  RECRUITMENT_COMPATIBILITY_METADATA,
  VALIDATION_STATUS,
  normalizeUpdateMetadata,
  buildRecruitmentCompatibilityContext,
  isRecruitmentCompatibilityContext,
  summarizeRecruitmentCompatibility,
  validateRecruitmentCompatibility,
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const {
  RECRUITMENT_CONTEXT_PHASE,
  DEFAULT_RECRUITMENT_CONTEXT,
  createRecruitmentContext
} = require("../server/lib/recruitment/recruitmentContext");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";

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

function sampleNotice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card",
    url: "https://ssc.nic.in/admit-card.pdf",
    ...overrides
  };
}

describe("Phase 69 — recruitmentCompatibilityLayer", () => {
  describe("exports", () => {
    test("exposes phase 69 compatibility constants and descriptor", () => {
      expect(COMPATIBILITY_LAYER_PHASE).toBe(69);
      expect(RECRUITMENT_COMPATIBILITY_DESCRIPTOR.entity).toBe(
        "recruitment_compatibility_context"
      );
      expect(RECRUITMENT_COMPATIBILITY_DESCRIPTOR.phase).toBe(69);
      expect(RECRUITMENT_COMPATIBILITY_METADATA.additiveOnly).toBe(true);
      expect(RECRUITMENT_COMPATIBILITY_METADATA.matchingExecution).toBe(false);
      expect(RECRUITMENT_COMPATIBILITY_METADATA.lifecycleExecution).toBe(false);
      expect(RECRUITMENT_COMPATIBILITY_METADATA.persistenceEnabled).toBe(false);
    });

    test("targets worker integration per adoption order", () => {
      expect(INTEGRATION_TARGET_ID).toBe("worker");
      expect(ADOPTION_ORDER_ENTRY.order).toBe(2);
      expect(ADOPTION_ORDER_ENTRY.targetId).toBe("worker");
      expect(ADOPTION_ORDER_ENTRY.futureImplementationPhase).toBe(69);
    });

    test("exports notice keys and bridge descriptors", () => {
      expect(UPDATE_NOTICE_KEYS).toEqual(["title", "content", "url"]);
      expect(FOUNDATION_BRIDGE_DESCRIPTORS.length).toBeGreaterThan(0);
      expect(FOUNDATION_BRIDGE_DESCRIPTORS[0].advisoryOnly).toBe(true);
    });

    test("exports public API functions", () => {
      expect(typeof normalizeUpdateMetadata).toBe("function");
      expect(typeof buildRecruitmentCompatibilityContext).toBe("function");
      expect(typeof isRecruitmentCompatibilityContext).toBe("function");
      expect(typeof summarizeRecruitmentCompatibility).toBe("function");
      expect(typeof validateRecruitmentCompatibility).toBe("function");
      expect(typeof attachRecruitmentCompatibility).toBe("function");
      expect(typeof peekRecruitmentCompatibility).toBe("function");
    });
  });

  describe("normalizeUpdateMetadata", () => {
    test("normalizes a complete notice payload", () => {
      const normalized = normalizeUpdateMetadata({
        notice: sampleNotice(),
        updateId: 42,
        createdAt: "2026-07-13T12:00:00.000Z",
        siteId: 7,
        siteName: "SSC",
        siteUrl: "https://ssc.nic.in"
      });

      expect(normalized.updateId).toBe(42);
      expect(normalized.notice.title).toBe("SSC CGL 2026 Admit Card");
      expect(normalized.notice.content).toBe("Download admit card");
      expect(normalized.sourceUrl).toBe("https://ssc.nic.in/admit-card.pdf");
      expect(normalized.urlPresent).toBe(true);
      expect(normalized.createdAt).toBe("2026-07-13T12:00:00.000Z");
      expect(normalized.siteId).toBe(7);
      expect(normalized.siteName).toBe("SSC");
      expect(normalized.siteUrl).toBe("https://ssc.nic.in");
      expect(normalized.noticePayloadKeys).toEqual(["title", "content", "url"]);
    });

    test("applies defaults for missing notice fields", () => {
      const normalized = normalizeUpdateMetadata({});
      expect(normalized.notice.title).toBe("New update");
      expect(normalized.notice.content).toBe("New update");
      expect(normalized.notice.url).toBe("");
      expect(normalized.sourceUrl).toBeNull();
      expect(normalized.urlPresent).toBe(false);
      expect(normalized.updateId).toBeNull();
    });

    test("trims whitespace from string fields", () => {
      const normalized = normalizeUpdateMetadata({
        notice: {
          title: "  SSC Notice  ",
          content: "  Body  ",
          url: "  https://example.com  "
        },
        siteName: "  SSC  "
      });
      expect(normalized.notice.title).toBe("SSC Notice");
      expect(normalized.notice.content).toBe("Body");
      expect(normalized.sourceUrl).toBe("https://example.com");
      expect(normalized.siteName).toBe("SSC");
    });

    test("treats empty strings as null for optional metadata", () => {
      const normalized = normalizeUpdateMetadata({
        notice: { title: "", content: "", url: "" },
        createdAt: "   ",
        siteName: "",
        siteUrl: ""
      });
      expect(normalized.notice.title).toBe("New update");
      expect(normalized.createdAt).toBeNull();
      expect(normalized.siteName).toBeNull();
      expect(normalized.siteUrl).toBeNull();
    });

    test("rejects invalid updateId values", () => {
      expect(normalizeUpdateMetadata({ updateId: 0 }).updateId).toBeNull();
      expect(normalizeUpdateMetadata({ updateId: -1 }).updateId).toBeNull();
      expect(normalizeUpdateMetadata({ updateId: "abc" }).updateId).toBeNull();
      expect(normalizeUpdateMetadata({ updateId: NaN }).updateId).toBeNull();
    });

    test("accepts numeric string updateId", () => {
      expect(normalizeUpdateMetadata({ updateId: "901" }).updateId).toBe(901);
    });

    test("rejects invalid ISO timestamps", () => {
      expect(normalizeUpdateMetadata({ createdAt: "not-a-date" }).createdAt).toBeNull();
    });

    test("does not mutate input notice object", () => {
      const notice = sampleNotice();
      const before = JSON.stringify(notice);
      normalizeUpdateMetadata({ notice, updateId: 1 });
      expect(JSON.stringify(notice)).toBe(before);
    });

    test("handles null and non-object input safely", () => {
      expect(normalizeUpdateMetadata(null).notice.title).toBe("New update");
      expect(normalizeUpdateMetadata(undefined).notice.title).toBe("New update");
      expect(normalizeUpdateMetadata("invalid").notice.title).toBe("New update");
    });

    test("uses title as content fallback when content is absent", () => {
      const normalized = normalizeUpdateMetadata({
        notice: { title: "Only Title", url: "https://x.test" }
      });
      expect(normalized.notice.content).toBe("Only Title");
    });
  });

  describe("buildRecruitmentCompatibilityContext", () => {
    test("builds a valid compatibility context from update metadata", () => {
      const context = buildRecruitmentCompatibilityContext({
        notice: sampleNotice(),
        updateId: 555,
        createdAt: "2026-07-13T12:00:00.000Z"
      });

      expect(context).not.toBeNull();
      expect(isRecruitmentCompatibilityContext(context)).toBe(true);
      expect(context.phase).toBe(69);
      expect(context.entity).toBe("recruitment_compatibility_context");
      expect(context.integrationTargetId).toBe("worker");
      expect(context.normalizedUpdate.updateId).toBe(555);
      expect(context.recruitmentContext.phase).toBe(RECRUITMENT_CONTEXT_PHASE);
      expect(context.bridgeDescriptors).toEqual(FOUNDATION_BRIDGE_DESCRIPTORS);
    });

    test("embeds default recruitment context when none supplied", () => {
      const context = buildRecruitmentCompatibilityContext({});
      expect(context.recruitmentContext).toBe(DEFAULT_RECRUITMENT_CONTEXT);
    });

    test("accepts a custom recruitment context", () => {
      const customContext = createRecruitmentContext({ label: "phase69-test" });
      const context = buildRecruitmentCompatibilityContext({
        recruitmentContext: customContext
      });
      expect(context.recruitmentContext.metadata.label).toBe("phase69-test");
    });

    test("includes recruitment context summary", () => {
      const context = buildRecruitmentCompatibilityContext({ updateId: 1 });
      expect(context.recruitmentContextSummary.phase).toBe(68);
      expect(context.recruitmentContextSummary.lifecycleEventCount).toBe(14);
      expect(context.recruitmentContextSummary.contractCount).toBe(14);
    });

    test("declares non-execution posture", () => {
      const context = buildRecruitmentCompatibilityContext({});
      expect(context.matchingExecution).toBe(false);
      expect(context.lifecycleExecution).toBe(false);
      expect(context.persistenceEnabled).toBe(false);
      expect(context.sideEffects).toBe(false);
      expect(context.compatibilityOnly).toBe(true);
      expect(context.additiveOnly).toBe(true);
    });

    test("returns null when recruitment context override is invalid", () => {
      const context = buildRecruitmentCompatibilityContext({
        recruitmentContext: { phase: 99, entity: "bogus" }
      });
      expect(context).toBeNull();
    });
  });

  describe("validateRecruitmentCompatibility", () => {
    test("validates a built context as valid", () => {
      const context = buildRecruitmentCompatibilityContext({ updateId: 10 });
      const validation = validateRecruitmentCompatibility(context);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("rejects non-object values", () => {
      const validation = validateRecruitmentCompatibility(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_CONTEXT_SHAPE");
    });

    test("rejects contexts with wrong phase", () => {
      const context = buildRecruitmentCompatibilityContext({});
      const tampered = { ...context, phase: 68 };
      const validation = validateRecruitmentCompatibility(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("rejects contexts with execution flags enabled", () => {
      const context = buildRecruitmentCompatibilityContext({});
      const tampered = { ...context, matchingExecution: true };
      const validation = validateRecruitmentCompatibility(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("isRecruitmentCompatibilityContext mirrors validation", () => {
      const context = buildRecruitmentCompatibilityContext({});
      expect(isRecruitmentCompatibilityContext(context)).toBe(true);
      expect(isRecruitmentCompatibilityContext({})).toBe(false);
    });
  });

  describe("summarizeRecruitmentCompatibility", () => {
    test("summarizes a valid compatibility context", () => {
      const context = buildRecruitmentCompatibilityContext({
        notice: sampleNotice(),
        updateId: 77
      });
      const summary = summarizeRecruitmentCompatibility(context);
      expect(summary.valid).toBe(true);
      expect(summary.phase).toBe(69);
      expect(summary.updateId).toBe(77);
      expect(summary.noticeTitle).toBe("SSC CGL 2026 Admit Card");
      expect(summary.noticeUrlPresent).toBe(true);
      expect(summary.bridgeDescriptorCount).toBe(FOUNDATION_BRIDGE_DESCRIPTORS.length);
      expect(summary.foundationPhases).toEqual(DEFAULT_RECRUITMENT_CONTEXT.foundationPhases);
    });

    test("summarizeRecruitmentCompatibility is deterministic", () => {
      const context = buildRecruitmentCompatibilityContext({ updateId: 3 });
      expect(summarizeRecruitmentCompatibility(context)).toEqual(
        summarizeRecruitmentCompatibility(context)
      );
    });

    test("returns safe fallback summary for invalid input", () => {
      const summary = summarizeRecruitmentCompatibility({ bogus: true });
      expect(summary.valid).toBe(false);
      expect(summary.phase).toBe(69);
      expect(summary.matchingExecution).toBe(false);
      expect(summary.lifecycleExecution).toBe(false);
    });
  });

  describe("immutability", () => {
    test("normalized update metadata is deeply frozen", () => {
      assertAllFrozen(normalizeUpdateMetadata({ notice: sampleNotice(), updateId: 1 }));
    });

    test("compatibility context is deeply frozen", () => {
      assertAllFrozen(buildRecruitmentCompatibilityContext({ updateId: 1 }));
    });

    test("mutating normalized notice throws", () => {
      const normalized = normalizeUpdateMetadata({ notice: sampleNotice() });
      expect(() => {
        normalized.notice.title = "mutated";
      }).toThrow();
    });

    test("mutating compatibility context throws", () => {
      const context = buildRecruitmentCompatibilityContext({});
      expect(() => {
        context.integrationTargetId = "updates";
      }).toThrow();
    });

    test("input objects are not mutated during context creation", () => {
      const notice = sampleNotice();
      const before = JSON.stringify(notice);
      buildRecruitmentCompatibilityContext({ notice, updateId: 5 });
      expect(JSON.stringify(notice)).toBe(before);
    });
  });

  describe("deterministic behavior", () => {
    test("normalizeUpdateMetadata is deterministic for identical input", () => {
      const input = { notice: sampleNotice(), updateId: 12, siteId: 7 };
      expect(normalizeUpdateMetadata(input)).toEqual(normalizeUpdateMetadata(input));
    });

    test("buildRecruitmentCompatibilityContext is deterministic for identical input", () => {
      const input = { notice: sampleNotice(), updateId: 12 };
      const a = buildRecruitmentCompatibilityContext(input);
      const b = buildRecruitmentCompatibilityContext(input);
      expect(a).toEqual(b);
    });

    test("validateRecruitmentCompatibility is deterministic", () => {
      const context = buildRecruitmentCompatibilityContext({ updateId: 1 });
      expect(validateRecruitmentCompatibility(context)).toEqual(
        validateRecruitmentCompatibility(context)
      );
    });
  });

  describe("attach and peek", () => {
    test("attachRecruitmentCompatibility stores context without mutating outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const before = JSON.stringify(outcome);
      const attached = attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 1
      });
      expect(JSON.stringify(outcome)).toBe(before);
      expect(attached).not.toBeNull();
      expect(peekRecruitmentCompatibility(outcome)).toBe(attached);
    });

    test("peekRecruitmentCompatibility returns null for unrelated objects", () => {
      expect(peekRecruitmentCompatibility(null)).toBeNull();
      expect(peekRecruitmentCompatibility({})).toBeNull();
    });

    test("attachRecruitmentCompatibility never throws on invalid input", () => {
      expect(() => attachRecruitmentCompatibility(null, {})).not.toThrow();
      expect(() => attachRecruitmentCompatibility({}, null)).not.toThrow();
      expect(attachRecruitmentCompatibility({}, { recruitmentContext: { bad: true } })).toBeNull();
    });

    test("attached compatibility is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 9 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 9 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "compatibility")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(outcome, "recruitmentCompatibility")).toBe(
        false
      );
    });
  });

  describe("failure isolation", () => {
    test("buildRecruitmentCompatibilityContext never throws", () => {
      expect(() => buildRecruitmentCompatibilityContext(Symbol("x"))).not.toThrow();
      expect(buildRecruitmentCompatibilityContext(Symbol("x"))).toBeNull();
    });

    test("validateRecruitmentCompatibility never throws", () => {
      expect(() => validateRecruitmentCompatibility(Symbol("x"))).not.toThrow();
    });

    test("summarizeRecruitmentCompatibility never throws", () => {
      expect(() => summarizeRecruitmentCompatibility(Symbol("x"))).not.toThrow();
    });

    test("invalid recruitment context does not break attach", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 1 };
      const result = attachRecruitmentCompatibility(outcome, {
        recruitmentContext: { invalid: true }
      });
      expect(result).toBeNull();
      expect(peekRecruitmentCompatibility(outcome)).toBeNull();
    });
  });

  describe("backward compatibility — runRecruitmentPipeline", () => {
    const notice = sampleNotice();

    test("skipped outcome shape is unchanged", () => {
      const result = runRecruitmentPipeline({ notice, isEnabled: false });
      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: null });
    });

    test("success outcome shape is unchanged", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.SUCCESS,
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: null
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 555
      });

      expect(result).toEqual({
        skipped: false,
        result: expect.objectContaining({ eventType: "admit_card" }),
        updateId: 555
      });
      expect(processDetection).toHaveBeenCalledWith({
        notice,
        candidateRecruitments: [],
        createdAt: undefined
      });
    });

    test("failure outcome shape is unchanged", () => {
      const processDetection = jest.fn(() => {
        throw new Error("detection failed");
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 12
      });

      expect(result).toEqual({
        skipped: false,
        failed: true,
        error: expect.any(Error),
        updateId: 12
      });
    });

    test("pipeline attaches compatibility without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const compatibility = peekRecruitmentCompatibility(result);
      expect(compatibility).not.toBeNull();
      expect(isRecruitmentCompatibilityContext(compatibility)).toBe(true);
      expect(compatibility.normalizedUpdate.updateId).toBe(88);
      expect(result).toEqual({
        skipped: true,
        reason: "flag_off",
        updateId: 88
      });
    });

    test("detection processor arguments are unchanged by compatibility layer", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.NO_MATCH,
        warnings: [],
        eventType: "result",
        selectedRecruitment: null,
        reviewItem: null
      });

      runRecruitmentPipeline({
        notice,
        candidateRecruitments: [{ id: 1 }],
        isEnabled: true,
        processDetection,
        createdAt: "2026-07-14T00:00:00.000Z",
        updateId: 3
      });

      expect(processDetection).toHaveBeenCalledWith({
        notice,
        candidateRecruitments: [{ id: 1 }],
        createdAt: "2026-07-14T00:00:00.000Z"
      });
    });
  });

  describe("circular references", () => {
    test("compatibility context graph has no circular references", () => {
      const context = buildRecruitmentCompatibilityContext({ updateId: 1 });
      expect(hasCircularReference(context)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_COMPATIBILITY_DESCRIPTOR)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("compatibility layer module has no Express / DB / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 69/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("compatibility layer imports recruitmentContext, identity resolution, matching engine, action planner, persistence coordinator, execution gateway, persistence engine, and persistence adapter", () => {
      const source = read(MODULE_PATH);
      const topLevelSource = source.slice(0, source.indexOf("function attachIdentityResolution"));
      const requires = [...topLevelSource.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./recruitmentContext",
        "./recruitmentIdentityResolutionEngine",
        "./recruitmentMatchingEngine",
        "./recruitmentActionPlanner",
        "./recruitmentPersistenceCoordinator",
        "./recruitmentExecutionGateway",
        "./recruitmentPersistenceEngine",
        "./recruitmentPersistenceAdapter"
      ]);
    });

    test("compatibility layer lazy-loads compatibility integration hook for Phase 93", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityIntegrationHook/);
      expect(source).toMatch(/attachRecruitmentCompatibilityIntegration/);
      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("compatibility layer does not perform matching or lifecycle execution", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/matchingExecution: false/);
      expect(source).toMatch(/lifecycleExecution: false/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/evaluateRecruitmentEligibility/);
      expect(source).not.toMatch(/recruitmentMatcher/);
    });

    test("runRecruitmentPipeline integrates compatibility layer additively", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).toMatch(/attachRecruitmentCompatibility/);
      expect(source).not.toMatch(/peekRecruitmentCompatibility/);
      expect(source).toMatch(/additive only/i);
    });

    test("siteWorker peeks action plans only — attach and persistence coordinator stay in pipeline", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).toMatch(/peekRecruitmentActionPlan/);
      expect(worker).not.toMatch(/attachRecruitmentCompatibility/);
      expect(worker).not.toMatch(/recruitmentPersistenceCoordinator/);
      expect(worker).not.toMatch(/peekRecruitmentPersistencePlan/);
    });
  });
});
