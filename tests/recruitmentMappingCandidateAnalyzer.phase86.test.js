"use strict";

/**
 * Phase 86 — Recruitment Mapping Candidate Analyzer tests.
 * Empty input, invalid input, notification candidate, explicit primary,
 * anchor metadata, related recruitmentId/parentRecruitmentId, ignored entities,
 * duplicates, deterministic ordering, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
  CONFIDENCE_LEVELS,
  PRIMARY_SELECTION_REASONS,
  RELATED_HINT_TYPES,
  IGNORE_REASONS,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_DESCRIPTOR,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA,
  EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS,
  createRecruitmentMappingCandidateAnalysis,
  isRecruitmentMappingCandidateAnalysis,
  validateRecruitmentMappingCandidateAnalysis,
  summarizeRecruitmentMappingCandidateAnalysis
} = require("../server/lib/recruitment/recruitmentMappingCandidateAnalyzer");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentMappingCandidateAnalyzer.js";
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

function pageEntity(overrides = {}) {
  return {
    id: "page-1",
    title: "SSC CGL 2024",
    eventType: "notification",
    recruitmentId: "rec-42",
    parentRecruitmentId: null,
    metadata: {},
    ...overrides
  };
}

describe("Phase 86 — recruitmentMappingCandidateAnalyzer", () => {
  describe("exports", () => {
    test("exposes phase 86 constants and descriptor", () => {
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE).toBe(86);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY).toBe(
        "recruitment_mapping_candidate_analysis"
      );
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_DESCRIPTOR.entity).toBe(
        "recruitment_mapping_candidate_analysis"
      );
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_DESCRIPTOR.phase).toBe(86);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.performsMapping).toBe(false);
    });

    test("exposes confidence levels and reason enums", () => {
      expect(CONFIDENCE_LEVELS).toEqual({
        HIGH: "high",
        MEDIUM: "medium",
        LOW: "low",
        UNKNOWN: "unknown"
      });
      expect(PRIMARY_SELECTION_REASONS.EXPLICIT_PRIMARY_METADATA).toBe(
        "explicit_primary_metadata"
      );
      expect(RELATED_HINT_TYPES.MATCHING_RECRUITMENT_ID).toBe("matching_recruitment_id");
      expect(IGNORE_REASONS.MISSING_ID).toBe("missing_id");
    });
  });

  describe("empty input", () => {
    test("returns empty analysis for null input", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis(null);

      expect(analysis).toEqual(EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS);
      expect(analysis.primaryCandidate).toBeNull();
      expect(analysis.relatedCandidates).toEqual([]);
      expect(analysis.ignoredCandidates).toEqual([]);
      expect(analysis.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(analysis.analysisSummary.totalEntities).toBe(0);
    });

    test("returns empty analysis for missing entities array", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({});

      expect(analysis.primaryCandidate).toBeNull();
      expect(analysis.analysisSummary.totalEntities).toBe(0);
      expect(analysis.analysisSummary.analyzedEntities).toBe(0);
      expect(validateRecruitmentMappingCandidateAnalysis(analysis).valid).toBe(true);
    });

    test("returns empty analysis for empty entities array", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({ entities: [] });

      expect(analysis.primaryCandidate).toBeNull();
      expect(analysis.relatedCandidates).toEqual([]);
      expect(analysis.ignoredCandidates).toEqual([]);
      expect(analysis.analysisSummary.totalEntities).toBe(0);
    });
  });

  describe("invalid input", () => {
    test("tolerates non-object input", () => {
      expect(createRecruitmentMappingCandidateAnalysis(undefined)).toEqual(
        EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS
      );
      expect(createRecruitmentMappingCandidateAnalysis(false)).toEqual(
        EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS
      );
      expect(createRecruitmentMappingCandidateAnalysis("invalid")).toEqual(
        EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS
      );
      expect(createRecruitmentMappingCandidateAnalysis([])).toEqual(
        EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS
      );
    });

    test("tolerates malformed entities entries", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [null, 42, "bad", {}, pageEntity({ id: "valid-1" })]
      });

      expect(analysis.primaryCandidate?.id).toBe("valid-1");
      expect(analysis.ignoredCandidates.length).toBeGreaterThan(0);
      expect(validateRecruitmentMappingCandidateAnalysis(analysis).valid).toBe(true);
    });

    test("validateRecruitmentMappingCandidateAnalysis rejects invalid shapes", () => {
      const validation = validateRecruitmentMappingCandidateAnalysis({ phase: 86 });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ANALYSIS_SHAPE");
    });

    test("summarizeRecruitmentMappingCandidateAnalysis handles invalid analysis", () => {
      const summary = summarizeRecruitmentMappingCandidateAnalysis(null);

      expect(summary.valid).toBe(false);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMapping).toBe(false);
    });
  });

  describe("one notification candidate", () => {
    test("selects notification entity as primary with medium confidence", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "SSC CGL 2024 Notification",
            eventType: "notification",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.primaryCandidate).toMatchObject({
        id: "notif-1",
        title: "SSC CGL 2024 Notification",
        eventType: "notification",
        recruitmentId: "rec-42",
        selectionReason: PRIMARY_SELECTION_REASONS.NOTIFICATION_EVENT_TYPE
      });
      expect(analysis.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(analysis.analysisSummary.primaryCount).toBe(1);
      expect(analysis.metadata.primarySelectionReason).toBe(
        PRIMARY_SELECTION_REASONS.NOTIFICATION_EVENT_TYPE
      );
    });

    test("selects short_notification event type as primary", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "short-1",
            title: "SSC Short Notice",
            eventType: "short_notification",
            recruitmentId: "rec-99"
          })
        ]
      });

      expect(analysis.primaryCandidate?.selectionReason).toBe(
        PRIMARY_SELECTION_REASONS.NOTIFICATION_EVENT_TYPE
      );
      expect(analysis.primaryCandidate?.eventType).toBe("short_notification");
    });
  });

  describe("explicit primary metadata", () => {
    test("prefers metadata.primary over notification event type", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "SSC CGL Notification",
            eventType: "notification",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "primary-1",
            title: "SSC CGL 2024 Main",
            eventType: "result",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          })
        ]
      });

      expect(analysis.primaryCandidate?.id).toBe("primary-1");
      expect(analysis.primaryCandidate?.selectionReason).toBe(
        PRIMARY_SELECTION_REASONS.EXPLICIT_PRIMARY_METADATA
      );
      expect(analysis.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe("anchor metadata", () => {
    test("prefers metadata.anchor when no explicit primary", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "SSC CGL Notification",
            eventType: "notification",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "anchor-1",
            title: "SSC CGL Anchor Page",
            eventType: "correction",
            recruitmentId: "rec-42",
            metadata: { anchor: true }
          })
        ]
      });

      expect(analysis.primaryCandidate?.id).toBe("anchor-1");
      expect(analysis.primaryCandidate?.selectionReason).toBe(
        PRIMARY_SELECTION_REASONS.ANCHOR_METADATA
      );
      expect(analysis.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("explicit primary beats anchor metadata", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "anchor-1",
            title: "Anchor",
            eventType: "notification",
            recruitmentId: "rec-1",
            metadata: { anchor: true }
          }),
          pageEntity({
            id: "primary-1",
            title: "Primary",
            eventType: "result",
            recruitmentId: "rec-1",
            metadata: { primary: true }
          })
        ]
      });

      expect(analysis.primaryCandidate?.id).toBe("primary-1");
    });
  });

  describe("related recruitmentId", () => {
    test("marks entities with matching recruitmentId as related", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL 2024",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "evt-admit",
            title: "SSC CGL Admit Card",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.relatedCandidates).toHaveLength(1);
      expect(analysis.relatedCandidates[0]).toMatchObject({
        id: "evt-admit",
        recruitmentId: "rec-42"
      });
      expect(analysis.relatedCandidates[0].relationshipHints).toContain(
        RELATED_HINT_TYPES.MATCHING_RECRUITMENT_ID
      );
      expect(analysis.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
  });

  describe("related parentRecruitmentId", () => {
    test("marks entities with matching parentRecruitmentId as related", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "rec-42",
            title: "SSC CGL 2024",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "child-1",
            title: "SSC CGL Child Event",
            eventType: "exam_date",
            recruitmentId: null,
            parentRecruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.relatedCandidates).toHaveLength(1);
      expect(analysis.relatedCandidates[0].id).toBe("child-1");
      expect(analysis.relatedCandidates[0].relationshipHints).toContain(
        RELATED_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID
      );
    });
  });

  describe("related normalized title", () => {
    test("relates entities with matching normalized titles", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL 2024!",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "related-1",
            title: "SSC   CGL   2024",
            eventType: "result",
            recruitmentId: "rec-other"
          })
        ]
      });

      expect(analysis.relatedCandidates).toHaveLength(1);
      expect(analysis.relatedCandidates[0].relationshipHints).toContain(
        RELATED_HINT_TYPES.MATCHING_NORMALIZED_TITLE
      );
      expect(analysis.relatedCandidates[0].normalizedTitle).toBe("ssc cgl 2024");
    });
  });

  describe("event relationship metadata", () => {
    test("relates entities via metadata relatedEntityId", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL 2024",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "linked-1",
            title: "Linked Event",
            eventType: "correction",
            recruitmentId: "rec-other",
            metadata: { relatedEntityId: "primary-1" }
          })
        ]
      });

      expect(analysis.relatedCandidates).toHaveLength(1);
      expect(analysis.relatedCandidates[0].relationshipHints).toContain(
        RELATED_HINT_TYPES.EVENT_RELATIONSHIP_METADATA
      );
    });
  });

  describe("ignored entities", () => {
    test("ignores entities missing id", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          { title: "No ID Page", eventType: "notification", recruitmentId: "rec-1" },
          pageEntity({ id: "valid-1", metadata: { primary: true } })
        ]
      });

      expect(analysis.ignoredCandidates).toHaveLength(1);
      expect(analysis.ignoredCandidates[0].ignoreReasons).toContain(IGNORE_REASONS.MISSING_ID);
      expect(analysis.analysisSummary.ignoredCount).toBe(1);
    });

    test("ignores entities missing title", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          { id: "no-title-1", eventType: "notification", recruitmentId: "rec-1" },
          pageEntity({ id: "valid-1", metadata: { primary: true } })
        ]
      });

      expect(analysis.ignoredCandidates).toHaveLength(1);
      expect(analysis.ignoredCandidates[0].ignoreReasons).toContain(IGNORE_REASONS.MISSING_TITLE);
    });

    test("ignores entities with insufficient identifying information", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          { id: "sparse-1", title: "!!!" },
          pageEntity({ id: "valid-1", metadata: { primary: true } })
        ]
      });

      expect(analysis.ignoredCandidates.some((entry) =>
        entry.ignoreReasons.includes(IGNORE_REASONS.INSUFFICIENT_IDENTIFYING_INFORMATION)
      )).toBe(true);
    });
  });

  describe("duplicate entities", () => {
    test("deduplicates analyzable entities by id", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({ id: "dup-1", title: "First Copy", metadata: { primary: true } }),
          pageEntity({ id: "dup-1", title: "Second Copy", eventType: "result" }),
          pageEntity({
            id: "related-1",
            title: "Related",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.analysisSummary.analyzedEntities).toBe(2);
      expect(analysis.metadata.duplicateEntitiesSkipped).toBe(1);
      expect(analysis.primaryCandidate?.id).toBe("dup-1");
      expect(analysis.primaryCandidate?.title).toBe("First Copy");
    });
  });

  describe("deterministic ordering", () => {
    test("selects first deterministic candidate when no priority signals", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "z-page",
            title: "Z Page",
            eventType: "result",
            recruitmentId: "rec-z"
          }),
          pageEntity({
            id: "a-page",
            title: "A Page",
            eventType: "exam_date",
            recruitmentId: "rec-a"
          })
        ]
      });

      expect(analysis.primaryCandidate?.id).toBe("a-page");
      expect(analysis.primaryCandidate?.selectionReason).toBe(
        PRIMARY_SELECTION_REASONS.DETERMINISTIC_FIRST
      );
    });

    test("sorts related candidates by id regardless of input order", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "evt-z",
            title: "Z",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "evt-a",
            title: "A",
            eventType: "result",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.relatedCandidates.map((entry) => entry.id)).toEqual(["evt-a", "evt-z"]);
    });

    test("produces identical results for identical input", () => {
      const input = {
        entities: [
          pageEntity({ id: "b", title: "B", recruitmentId: "rec-1", metadata: { primary: true } }),
          pageEntity({ id: "a", title: "A", recruitmentId: "rec-1", eventType: "admit_card" })
        ]
      };

      const first = createRecruitmentMappingCandidateAnalysis(input);
      const second = createRecruitmentMappingCandidateAnalysis(input);

      expect(first).toEqual(second);
      expect(first.relatedCandidates).not.toBe(second.relatedCandidates);
    });
  });

  describe("summarizeRecruitmentMappingCandidateAnalysis", () => {
    test("summarizes a valid analysis", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({
            id: "primary-1",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "related-1",
            title: "Related",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          })
        ]
      });

      const summary = summarizeRecruitmentMappingCandidateAnalysis(analysis);

      expect(summary.valid).toBe(true);
      expect(summary.primaryCount).toBe(1);
      expect(summary.relatedCount).toBe(1);
      expect(summary.primarySelectionReason).toBe(
        PRIMARY_SELECTION_REASONS.EXPLICIT_PRIMARY_METADATA
      );
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMapping).toBe(false);
    });
  });

  describe("immutability", () => {
    test("freezes entire analysis object graph", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [pageEntity({ metadata: { primary: true } })]
      });

      assertAllFrozen(analysis);
      expect(hasCircularReference(analysis)).toBe(false);
      expect(isRecruitmentMappingCandidateAnalysis(analysis)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = {
        entities: [
          pageEntity({
            id: "primary-1",
            metadata: { primary: true, nested: { value: 1 } }
          })
        ]
      };
      const snapshot = JSON.stringify(input);

      createRecruitmentMappingCandidateAnalysis(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const analysis = createRecruitmentMappingCandidateAnalysis({
        entities: [
          pageEntity({ id: "primary-1", metadata: { primary: true } }),
          pageEntity({
            id: "related-1",
            title: "Related",
            recruitmentId: "rec-42",
            eventType: "admit_card"
          })
        ]
      });

      expect(Object.isFrozen(analysis.relatedCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.ignoredCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.analysisSummary.reasons)).toBe(true);
      expect(() => {
        analysis.relatedCandidates.push({});
      }).toThrow();
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 86");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createRecruitmentMappingCandidateAnalysis/);
      expect(source).toMatch(/does not perform mapping/);
    });

    test("module does not import database, express, filesystem, or other recruitment modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
      expect(source).not.toMatch(/require\(["']\.\//);
    });

    test("module is not wired into compatibility layer or pipeline", () => {
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);

      expect(compatibilitySource).not.toMatch(/recruitmentMappingCandidateAnalyzer/);
      expect(pipelineSource).not.toMatch(/recruitmentMappingCandidateAnalyzer/);
    });

    test("metadata confirms no runtime integration, mapping, or side effects", () => {
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.performsMapping).toBe(false);
      expect(RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA.mutatesInput).toBe(false);
    });
  });
});
