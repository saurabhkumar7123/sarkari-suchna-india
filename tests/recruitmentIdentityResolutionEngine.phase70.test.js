"use strict";

/**
 * Phase 70 — Recruitment Identity Resolution Engine tests.
 * Exports, deterministic behavior, immutability, validation, helper behavior,
 * compatibility integration, pipeline output preservation, failure isolation,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  IDENTITY_RESOLUTION_ENGINE_PHASE,
  IDENTITY_RESOLUTION_STATES,
  SUPPORTED_RESOLUTION_STATES,
  PRIMARY_SIGNAL_KEYS,
  REQUIRED_SIGNAL_KEYS,
  CONFIDENCE_LEVELS,
  ANCHOR_EVENT_IDS,
  IDENTITY_RESOLUTION_DESCRIPTOR,
  IDENTITY_RESOLUTION_METADATA,
  VALIDATION_STATUS,
  collectSignalObservations,
  createIdentityResolutionResult,
  resolveRecruitmentIdentity,
  validateIdentityResolution,
  summarizeIdentityResolution
} = require("../server/lib/recruitment/recruitmentIdentityResolutionEngine");

const {
  createRecruitmentContext,
  DEFAULT_RECRUITMENT_CONTEXT,
  isRecruitmentContext
} = require("../server/lib/recruitment/recruitmentContext");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility,
  peekRecruitmentIdentityResolution,
  buildObservedSignalsFromNormalizedUpdate,
  buildIdentityResolutionContext,
  normalizeUpdateMetadata
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const ENGINE_MODULE_PATH = "server/lib/recruitment/recruitmentIdentityResolutionEngine.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
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
    content: "Download admit card for SSC Combined Graduate Level Examination 2026",
    url: "https://ssc.nic.in/admit-card.pdf",
    ...overrides
  };
}

function contextWithSignals(observedSignals, extraMetadata = {}) {
  return createRecruitmentContext({
    metadata: {
      observedSignals,
      ...extraMetadata
    }
  });
}

describe("Phase 70 — recruitmentIdentityResolutionEngine", () => {
  describe("exports", () => {
    test("exposes phase 70 identity resolution constants and descriptor", () => {
      expect(IDENTITY_RESOLUTION_ENGINE_PHASE).toBe(70);
      expect(IDENTITY_RESOLUTION_DESCRIPTOR.entity).toBe("recruitment_identity_resolution_result");
      expect(IDENTITY_RESOLUTION_DESCRIPTOR.phase).toBe(70);
      expect(IDENTITY_RESOLUTION_METADATA.matchingExecution).toBe(false);
      expect(IDENTITY_RESOLUTION_METADATA.performsMatching).toBe(false);
      expect(IDENTITY_RESOLUTION_METADATA.assignsRecruitmentIds).toBe(false);
      expect(IDENTITY_RESOLUTION_METADATA.persistenceEnabled).toBe(false);
    });

    test("defines immutable resolution states", () => {
      expect(IDENTITY_RESOLUTION_STATES).toEqual({
        UNRESOLVED: "unresolved",
        INSUFFICIENT_INFORMATION: "insufficient_information",
        IDENTITY_ANCHOR_DETECTED: "identity_anchor_detected",
        READY_FOR_MATCHING: "ready_for_matching"
      });
      expect(SUPPORTED_RESOLUTION_STATES.size).toBe(4);
    });

    test("exports primary and required signal keys", () => {
      expect(REQUIRED_SIGNAL_KEYS).toEqual(["recruitment_title"]);
      expect(PRIMARY_SIGNAL_KEYS).toEqual([
        "advertisement_number",
        "official_identifier",
        "organization"
      ]);
    });

    test("exports public API functions", () => {
      expect(typeof collectSignalObservations).toBe("function");
      expect(typeof createIdentityResolutionResult).toBe("function");
      expect(typeof resolveRecruitmentIdentity).toBe("function");
      expect(typeof validateIdentityResolution).toBe("function");
      expect(typeof summarizeIdentityResolution).toBe("function");
    });
  });

  describe("resolveRecruitmentIdentity and createIdentityResolutionResult", () => {
    test("returns default unresolved result for missing context", () => {
      const result = resolveRecruitmentIdentity(null);
      expect(result).not.toBeNull();
      expect(result.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.UNRESOLVED);
      expect(result.availableSignals).toEqual([]);
      expect(result.recommendsManualReview).toBe(true);
    });

    test("resolveRecruitmentIdentity mirrors createIdentityResolutionResult", () => {
      const context = contextWithSignals({ recruitment_title: "UPSC Civil Services 2025" });
      expect(resolveRecruitmentIdentity(context)).toEqual(
        createIdentityResolutionResult(context)
      );
    });

    test("detects insufficient_information when title is missing", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ source_url: "https://example.gov.in/notice" })
      );
      expect(result.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.INSUFFICIENT_INFORMATION);
      expect(result.missingSignals).toContain("recruitment_title");
      expect(result.recommendsManualReview).toBe(true);
    });

    test("detects identity_anchor_detected with title and organization", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({
          recruitment_title: "SSC CGL Examination 2026",
          organization: "Staff Selection Commission"
        })
      );
      expect(result.resolutionState).toBe(
        IDENTITY_RESOLUTION_STATES.IDENTITY_ANCHOR_DETECTED
      );
      expect(result.anchorEventId).toBe(ANCHOR_EVENT_IDS.NOTIFICATION);
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });

    test("detects ready_for_matching with title and multiple primary signals", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({
          recruitment_title: "SSC CGL Examination 2026",
          organization: "Staff Selection Commission",
          official_identifier: "update:42",
          source_url: "https://ssc.nic.in/notice"
        })
      );
      expect(result.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING);
      expect(result.recommendsManualReview).toBe(false);
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("extracts advertisement number and year from supplemental text", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals(
          { recruitment_title: "SSC Notification" },
          {
            noticeContent:
              "Staff Selection Commission Advt. No. CGL-01/2026 for Combined Graduate Level 2026"
          }
        )
      );
      expect(result.signalObservations.advertisement_number).toBe("CGL-01/2026");
      expect(result.signalObservations.organization).toBe("Staff Selection Commission");
      expect(result.signalObservations.recruitment_year).toBe("2026");
    });

    test("detects short notification anchor from supplemental text", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals(
          { recruitment_title: "SSC short notice" },
          { noticeContent: "Short notification regarding examination schedule" }
        )
      );
      expect(result.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
      expect(result.manualReviewReasons).toContain(
        "ALTERNATE_IDENTITY_ANCHOR_REQUIRES_CONFIRMATION"
      );
    });

    test("does not assign recruitment IDs", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({
          recruitment_title: "SSC CGL 2026",
          official_identifier: "update:99"
        })
      );
      expect(result.assignsRecruitmentIds).toBe(false);
      expect(result).not.toHaveProperty("recruitmentId");
      expect(result).not.toHaveProperty("selectedRecruitment");
    });
  });

  describe("collectSignalObservations", () => {
    test("returns empty observations for invalid context", () => {
      expect(collectSignalObservations(null)).toEqual({});
      expect(collectSignalObservations({ bad: true })).toEqual({});
    });

    test("preserves explicitly observed signals", () => {
      const observations = collectSignalObservations(
        contextWithSignals({
          recruitment_title: "Railway Recruitment",
          post_name: "Junior Engineer"
        })
      );
      expect(observations.recruitment_title).toBe("Railway Recruitment");
      expect(observations.post_name).toBe("Junior Engineer");
    });

    test("collectSignalObservations is deterministic", () => {
      const context = contextWithSignals({ recruitment_title: "IBPS PO 2026" }, {
        noticeContent: "IBPS Advt. No. 10/2026"
      });
      expect(collectSignalObservations(context)).toEqual(collectSignalObservations(context));
    });
  });

  describe("validation", () => {
    test("validateIdentityResolution accepts a valid result", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Test Recruitment 2026" })
      );
      const validation = validateIdentityResolution(result);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("validateIdentityResolution rejects invalid shapes", () => {
      const validation = validateIdentityResolution({ phase: 70 });
      expect(validation.valid).toBe(false);
      expect(validation.reasons.length).toBeGreaterThan(0);
    });

    test("validateIdentityResolution rejects invalid resolution state", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "SSC 2026" })
      );
      const tampered = { ...result, resolutionState: "matched" };
      expect(validateIdentityResolution(tampered).valid).toBe(false);
    });

    test("validateIdentityResolution never throws", () => {
      expect(() => validateIdentityResolution(Symbol("x"))).not.toThrow();
    });

    test("validateIdentityResolution is deterministic", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "SSC 2026" })
      );
      expect(validateIdentityResolution(result)).toEqual(validateIdentityResolution(result));
    });
  });

  describe("summarizeIdentityResolution", () => {
    test("returns invalid summary for bad results", () => {
      const summary = summarizeIdentityResolution(null);
      expect(summary.valid).toBe(false);
      expect(summary.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.UNRESOLVED);
      expect(summary.recommendsManualReview).toBe(true);
    });

    test("returns advisory summary for valid results", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({
          recruitment_title: "SSC CGL 2026",
          organization: "Staff Selection Commission",
          official_identifier: "update:1"
        })
      );
      const summary = summarizeIdentityResolution(result);
      expect(summary.valid).toBe(true);
      expect(summary.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING);
      expect(summary.signalCount).toBeGreaterThan(0);
      expect(summary.matchingExecution).toBe(false);
    });

    test("summarizeIdentityResolution never throws", () => {
      expect(() => summarizeIdentityResolution(Symbol("x"))).not.toThrow();
    });
  });

  describe("immutability", () => {
    test("identity resolution result graph is deeply frozen", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Frozen Recruitment" })
      );
      assertAllFrozen(result);
    });

    test("mutation of result properties throws in strict mode", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Immutable" })
      );
      expect(() => {
        "use strict";
        result.resolutionState = "matched";
      }).toThrow();
    });

    test("mutation of nested signal observations throws", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Immutable nested" })
      );
      expect(() => {
        "use strict";
        result.signalObservations.recruitment_title = "changed";
      }).toThrow();
    });
  });

  describe("deterministic behavior", () => {
    test("createIdentityResolutionResult is deterministic for identical input", () => {
      const context = contextWithSignals(
        { recruitment_title: "Deterministic Recruitment 2026" },
        { noticeContent: "UPSC Advt. No. 12/2026" }
      );
      expect(createIdentityResolutionResult(context)).toEqual(
        createIdentityResolutionResult(context)
      );
    });

    test("partitioned available and missing signals are stable", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Stable signals" })
      );
      const rerun = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Stable signals" })
      );
      expect(result.availableSignals).toEqual(rerun.availableSignals);
      expect(result.missingSignals).toEqual(rerun.missingSignals);
    });
  });

  describe("failure isolation", () => {
    test("createIdentityResolutionResult never throws on invalid input", () => {
      expect(() => createIdentityResolutionResult(Symbol("x"))).not.toThrow();
      expect(createIdentityResolutionResult(undefined)).not.toBeNull();
    });

    test("resolveRecruitmentIdentity never throws", () => {
      expect(() => resolveRecruitmentIdentity(Symbol("x"))).not.toThrow();
    });

    test("collectSignalObservations never throws", () => {
      expect(() => collectSignalObservations(Symbol("x"))).not.toThrow();
    });

    test("invalid recruitment context falls back to default vocabulary", () => {
      const result = createIdentityResolutionResult({ invalid: true });
      expect(result.recruitmentContextPhase).toBe(DEFAULT_RECRUITMENT_CONTEXT.phase);
      expect(result.recruitmentContextEntity).toBe(DEFAULT_RECRUITMENT_CONTEXT.entity);
    });
  });

  describe("resolution state transitions", () => {
    test("unresolved when no observed signals and no supplemental text", () => {
      const result = createIdentityResolutionResult(createRecruitmentContext());
      expect(result.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.UNRESOLVED);
      expect(result.anchorEventId).toBeNull();
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVELS.UNKNOWN);
    });

    test("ready_for_matching with advertisement number and title from content", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals(
          { recruitment_title: "Government Recruitment" },
          {
            noticeContent:
              "Union Public Service Commission Advt. No. 22/2026 for Civil Services"
          }
        )
      );
      expect(result.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING);
      expect(result.availableSignals).toContain("advertisement_number");
      expect(result.availableSignals).toContain("organization");
    });

    test("manual review reasons include missing required signals", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ organization: "RRB" })
      );
      expect(result.manualReviewReasons).toContain("MISSING_REQUIRED_IDENTITY_SIGNALS");
      expect(result.manualReviewReasons).toContain("IDENTITY_NOT_READY_FOR_MATCHING");
    });

    test("available and missing signal lists partition the identity vocabulary", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "Partition test" })
      );
      const combined = [...result.availableSignals, ...result.missingSignals].sort();
      const expected = [...DEFAULT_RECRUITMENT_CONTEXT.identity.signalKeys].sort();
      expect(combined).toEqual(expected);
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when engine resolution fails", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentIdentityResolutionEngine", () => ({
        resolveRecruitmentIdentity: () => {
          throw new Error("engine failure");
        },
        summarizeIdentityResolution: () => ({ valid: false })
      }));

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 1 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 1
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentIdentityResolution(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentIdentityResolutionEngine");
      jest.resetModules();
    });

    test("attachIdentityResolution failure does not remove compatibility context", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 5 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 5 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
    });
  });

  describe("compatibility integration", () => {
    test("buildObservedSignalsFromNormalizedUpdate maps notice fields to signals", () => {
      const normalized = normalizeUpdateMetadata({
        notice: sampleNotice(),
        updateId: 15
      });
      const observed = buildObservedSignalsFromNormalizedUpdate(normalized);
      expect(observed.recruitment_title).toBe("SSC CGL 2026 Admit Card");
      expect(observed.source_url).toBe("https://ssc.nic.in/admit-card.pdf");
      expect(observed.official_identifier).toBe("update:15");
    });

    test("buildIdentityResolutionContext produces a valid recruitment context", () => {
      const normalized = normalizeUpdateMetadata({ notice: sampleNotice(), updateId: 3 });
      const context = buildIdentityResolutionContext(DEFAULT_RECRUITMENT_CONTEXT, normalized);
      expect(isRecruitmentContext(context)).toBe(true);
      expect(context.metadata.observedSignals.recruitment_title).toBe(
        "SSC CGL 2026 Admit Card"
      );
      expect(context.metadata.noticeContent).toBe(
        "Download admit card for SSC Combined Graduate Level Examination 2026"
      );
    });

    test("attachRecruitmentCompatibility stores identity resolution internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 7 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 7
      });
      const resolution = peekRecruitmentIdentityResolution(outcome);
      expect(resolution).not.toBeNull();
      expect(resolution.phase).toBe(70);
      expect(resolution.signalObservations.recruitment_title).toBe(
        "SSC CGL 2026 Admit Card"
      );
    });

    test("identity resolution is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 2 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 2 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "identityResolution")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(outcome, "recruitmentIdentityResolution")).toBe(
        false
      );
    });

    test("peekRecruitmentIdentityResolution returns null for unrelated objects", () => {
      expect(peekRecruitmentIdentityResolution(null)).toBeNull();
      expect(peekRecruitmentIdentityResolution({})).toBeNull();
    });

    test("compatibility attach still succeeds when identity resolution input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      expect(peekRecruitmentCompatibility(outcome)).toBe(attached);
      const resolution = peekRecruitmentIdentityResolution(outcome);
      expect(resolution).not.toBeNull();
      expect(resolution.resolutionState).toBe(IDENTITY_RESOLUTION_STATES.UNRESOLVED);
    });
  });

  describe("pipeline output preservation", () => {
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
        updateId: 101
      });

      expect(result).toEqual({
        skipped: false,
        result: expect.objectContaining({ eventType: "admit_card" }),
        updateId: 101
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
        updateId: 44
      });

      expect(result).toEqual({
        skipped: false,
        failed: true,
        error: expect.any(Error),
        updateId: 44
      });
    });

    test("pipeline attaches identity resolution without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const resolution = peekRecruitmentIdentityResolution(result);
      expect(resolution).not.toBeNull();
      expect(validateIdentityResolution(resolution).valid).toBe(true);
      expect(result).toEqual({
        skipped: true,
        reason: "flag_off",
        updateId: 88
      });
    });

    test("detection processor arguments remain unchanged", () => {
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
    test("identity resolution result graph has no circular references", () => {
      const result = createIdentityResolutionResult(
        contextWithSignals({ recruitment_title: "No cycles" })
      );
      expect(hasCircularReference(result)).toBe(false);
      expect(hasCircularReference(IDENTITY_RESOLUTION_DESCRIPTOR)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("identity resolution engine has no Express / DB / filesystem / env access", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/Phase 70/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("identity resolution engine imports only recruitmentContext", () => {
      const source = read(ENGINE_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./recruitmentContext"]);
    });

    test("identity resolution engine does not perform matching or assign IDs", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/matchingExecution: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/evaluateRecruitmentEligibility/);
    });

    test("compatibility layer integrates identity resolution engine additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentIdentityResolutionEngine/);
      expect(source).toMatch(/resolveRecruitmentIdentity/);
      expect(source).toMatch(/identityResolutionByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentIdentityResolution/);
    });

    test("runRecruitmentPipeline does not import identity resolution engine directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentIdentityResolutionEngine/);
    });

    test("siteWorker is unchanged — integration remains confined to compatibility layer", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentIdentityResolutionEngine/);
      expect(worker).not.toMatch(/peekRecruitmentIdentityResolution/);
    });
  });
});
