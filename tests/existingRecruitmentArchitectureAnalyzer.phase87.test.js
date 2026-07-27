"use strict";

/**
 * Phase 87 — Existing Recruitment Architecture Analyzer tests.
 * Empty input, invalid input, anchor detection, lifecycle detection,
 * standalone detection, unsupported entities, duplicates, deterministic output,
 * immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY,
  CONFIDENCE_LEVELS,
  MIGRATION_READINESS_STATUS,
  ANCHOR_HINT_TYPES,
  LIFECYCLE_HINT_TYPES,
  UNSUPPORTED_REASONS,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_DESCRIPTOR,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA,
  EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS,
  analyzeExistingRecruitmentArchitecture,
  isExistingRecruitmentArchitectureAnalysis,
  validateExistingRecruitmentArchitectureAnalysis,
  summarizeExistingRecruitmentArchitectureAnalysis
} = require("../server/lib/recruitment/existingRecruitmentArchitectureAnalyzer");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/existingRecruitmentArchitectureAnalyzer.js";
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
    slug: "ssc-cgl-2024",
    category: "ssc",
    department: "staff-selection-commission",
    qualification: "graduate",
    state: "all-india",
    eventType: "notification",
    recruitmentId: "rec-42",
    metadata: {},
    ...overrides
  };
}

describe("Phase 87 — existingRecruitmentArchitectureAnalyzer", () => {
  describe("exports", () => {
    test("exposes phase 87 constants and descriptor", () => {
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE).toBe(87);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY).toBe(
        "existing_recruitment_architecture_analysis"
      );
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_DESCRIPTOR.entity).toBe(
        "existing_recruitment_architecture_analysis"
      );
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_DESCRIPTOR.phase).toBe(87);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.readOnly).toBe(true);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.runtimeIntegration).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.performsMigration).toBe(false);
    });

    test("exposes confidence levels, migration statuses, and hint enums", () => {
      expect(CONFIDENCE_LEVELS).toEqual({
        HIGH: "high",
        MEDIUM: "medium",
        LOW: "low",
        UNKNOWN: "unknown"
      });
      expect(MIGRATION_READINESS_STATUS).toEqual({
        READY: "READY",
        PARTIAL: "PARTIAL",
        NOT_READY: "NOT_READY"
      });
      expect(ANCHOR_HINT_TYPES.EXPLICIT_PRIMARY_METADATA).toBe("explicit_primary_metadata");
      expect(LIFECYCLE_HINT_TYPES.MATCHING_RECRUITMENT_ID).toBe("matching_recruitment_id");
      expect(UNSUPPORTED_REASONS.MISSING_ID).toBe("missing_id");
    });
  });

  describe("empty input", () => {
    test("returns empty analysis for null input", () => {
      const analysis = analyzeExistingRecruitmentArchitecture(null);

      expect(analysis).toEqual(EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS);
      expect(analysis.anchorCandidates).toEqual([]);
      expect(analysis.lifecycleCandidates).toEqual([]);
      expect(analysis.standaloneCandidates).toEqual([]);
      expect(analysis.unsupportedCandidates).toEqual([]);
      expect(analysis.totalEntities).toBe(0);
      expect(analysis.migrationReadiness.status).toBe(MIGRATION_READINESS_STATUS.NOT_READY);
    });

    test("returns empty analysis for missing entities array", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({});

      expect(analysis.totalEntities).toBe(0);
      expect(analysis.anchorCandidates).toEqual([]);
      expect(validateExistingRecruitmentArchitectureAnalysis(analysis).valid).toBe(true);
    });

    test("returns empty analysis for empty entities array", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({ entities: [] });

      expect(analysis.totalEntities).toBe(0);
      expect(analysis.analysisSummary.anchorCount).toBe(0);
      expect(analysis.migrationReadiness.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
    });
  });

  describe("invalid input", () => {
    test("tolerates non-object input", () => {
      expect(analyzeExistingRecruitmentArchitecture(undefined)).toEqual(
        EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS
      );
      expect(analyzeExistingRecruitmentArchitecture(false)).toEqual(
        EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS
      );
      expect(analyzeExistingRecruitmentArchitecture("invalid")).toEqual(
        EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS
      );
      expect(analyzeExistingRecruitmentArchitecture([])).toEqual(
        EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS
      );
    });

    test("tolerates malformed entities entries", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [null, 42, "bad", {}, pageEntity({ id: "valid-1" })]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0].id).toBe("valid-1");
      expect(analysis.unsupportedCandidates.length).toBeGreaterThan(0);
      expect(validateExistingRecruitmentArchitectureAnalysis(analysis).valid).toBe(true);
    });

    test("validateExistingRecruitmentArchitectureAnalysis rejects invalid shapes", () => {
      const validation = validateExistingRecruitmentArchitectureAnalysis({ totalEntities: 1 });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_ANALYSIS_SHAPE");
    });

    test("summarizeExistingRecruitmentArchitectureAnalysis handles invalid analysis", () => {
      const summary = summarizeExistingRecruitmentArchitectureAnalysis(null);

      expect(summary.valid).toBe(false);
      expect(summary.migrationStatus).toBe(MIGRATION_READINESS_STATUS.NOT_READY);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("anchor detection", () => {
    test("detects notification event type as anchor candidate", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "SSC CGL 2024 Notification",
            eventType: "notification",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0]).toMatchObject({
        id: "notif-1",
        title: "SSC CGL 2024 Notification",
        eventType: "notification"
      });
      expect(analysis.anchorCandidates[0].anchorHints).toContain(
        ANCHOR_HINT_TYPES.NOTIFICATION_EVENT_TYPE
      );
      expect(analysis.lifecycleCandidates).toHaveLength(0);
    });

    test("detects short_notification event type as anchor candidate", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "short-1",
            title: "SSC Short Notice",
            eventType: "short_notification",
            recruitmentId: "rec-99"
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0].anchorHints).toContain(
        ANCHOR_HINT_TYPES.SHORT_NOTIFICATION_EVENT_TYPE
      );
    });

    test("detects metadata.primary as anchor candidate", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL 2024 Main",
            eventType: "result",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0].anchorHints).toContain(
        ANCHOR_HINT_TYPES.EXPLICIT_PRIMARY_METADATA
      );
    });

    test("detects metadata.anchor as anchor candidate", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "anchor-1",
            title: "SSC CGL Anchor Page",
            eventType: "correction",
            recruitmentId: "rec-42",
            metadata: { anchor: true }
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0].anchorHints).toContain(
        ANCHOR_HINT_TYPES.ANCHOR_METADATA
      );
    });

    test("classifies multiple anchor candidates", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "Notification",
            eventType: "notification",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "primary-1",
            title: "Primary",
            eventType: "result",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(2);
      expect(analysis.anchorCandidates.map((entry) => entry.id)).toEqual(["notif-1", "primary-1"]);
    });
  });

  describe("lifecycle detection", () => {
    test("detects lifecycle candidate via matching recruitmentId", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(analysis.lifecycleCandidates).toHaveLength(1);
      expect(analysis.lifecycleCandidates[0]).toMatchObject({
        id: "evt-admit",
        recruitmentId: "rec-42"
      });
      expect(analysis.lifecycleCandidates[0].lifecycleHints).toContain(
        LIFECYCLE_HINT_TYPES.MATCHING_RECRUITMENT_ID
      );
      expect(analysis.lifecycleCandidates[0].linkedEntityIds).toContain("primary-1");
    });

    test("detects lifecycle candidate via matching parentRecruitmentId", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(analysis.lifecycleCandidates).toHaveLength(1);
      expect(analysis.lifecycleCandidates[0].id).toBe("child-1");
      expect(analysis.lifecycleCandidates[0].lifecycleHints).toContain(
        LIFECYCLE_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID
      );
    });

    test("detects lifecycle candidate via normalized title similarity", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(analysis.lifecycleCandidates).toHaveLength(1);
      expect(analysis.lifecycleCandidates[0].lifecycleHints).toContain(
        LIFECYCLE_HINT_TYPES.MATCHING_NORMALIZED_TITLE
      );
      expect(analysis.lifecycleCandidates[0].normalizedTitle).toBe("ssc cgl 2024");
    });

    test("detects lifecycle candidate via metadata.relatedEntityId", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(analysis.lifecycleCandidates).toHaveLength(1);
      expect(analysis.lifecycleCandidates[0].lifecycleHints).toContain(
        LIFECYCLE_HINT_TYPES.EVENT_RELATIONSHIP_METADATA
      );
      expect(analysis.lifecycleCandidates[0].linkedEntityIds).toContain("primary-1");
    });

    test("anchor entities are not also classified as lifecycle", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "notif-1",
            title: "SSC CGL",
            eventType: "notification",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "evt-1",
            title: "Admit",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          })
        ]
      });

      const anchorIds = analysis.anchorCandidates.map((entry) => entry.id);
      const lifecycleIds = analysis.lifecycleCandidates.map((entry) => entry.id);

      expect(anchorIds).toContain("notif-1");
      expect(lifecycleIds).toContain("evt-1");
      expect(lifecycleIds).not.toContain("notif-1");
    });
  });

  describe("standalone detection", () => {
    test("classifies identifiable entity with no lifecycle linkage as standalone", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "solo-1",
            title: "Independent Recruitment Page",
            eventType: "result",
            recruitmentId: "rec-solo"
          })
        ]
      });

      expect(analysis.standaloneCandidates).toHaveLength(1);
      expect(analysis.standaloneCandidates[0].id).toBe("solo-1");
      expect(analysis.anchorCandidates).toHaveLength(0);
      expect(analysis.lifecycleCandidates).toHaveLength(0);
    });

    test("classifies unlinked entities alongside grouped architecture", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "Grouped Recruitment",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "related-1",
            title: "Related Event",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "solo-1",
            title: "Unrelated Page",
            eventType: "result",
            recruitmentId: "rec-99"
          })
        ]
      });

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.lifecycleCandidates).toHaveLength(1);
      expect(analysis.standaloneCandidates).toHaveLength(1);
      expect(analysis.standaloneCandidates[0].id).toBe("solo-1");
    });
  });

  describe("unsupported entities", () => {
    test("flags entities missing id as unsupported", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          { title: "No ID Page", eventType: "notification", recruitmentId: "rec-1" },
          pageEntity({ id: "valid-1", metadata: { primary: true } })
        ]
      });

      expect(analysis.unsupportedCandidates).toHaveLength(1);
      expect(analysis.unsupportedCandidates[0].unsupportedReasons).toContain(
        UNSUPPORTED_REASONS.MISSING_ID
      );
      expect(analysis.analysisSummary.unsupportedCount).toBe(1);
    });

    test("flags entities missing title as unsupported", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          { id: "no-title-1", eventType: "notification", recruitmentId: "rec-1" },
          pageEntity({ id: "valid-1", metadata: { primary: true } })
        ]
      });

      expect(analysis.unsupportedCandidates).toHaveLength(1);
      expect(analysis.unsupportedCandidates[0].unsupportedReasons).toContain(
        UNSUPPORTED_REASONS.MISSING_TITLE
      );
    });

    test("flags malformed structure as unsupported", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [null, "bad", 42, pageEntity({ id: "valid-1", metadata: { primary: true } })]
      });

      expect(
        analysis.unsupportedCandidates.some((entry) =>
          entry.unsupportedReasons.includes(UNSUPPORTED_REASONS.MALFORMED_STRUCTURE)
        )
      ).toBe(true);
    });
  });

  describe("duplicate handling", () => {
    test("deduplicates supported entities by id", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(analysis.anchorCandidates).toHaveLength(1);
      expect(analysis.anchorCandidates[0].title).toBe("First Copy");
      expect(analysis.metadata.duplicateEntitiesSkipped).toBe(1);
      expect(analysis.totalEntities).toBe(3);
    });
  });

  describe("deterministic output", () => {
    test("sorts candidates by id regardless of input order", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "z-anchor",
            title: "Z Anchor",
            eventType: "notification",
            recruitmentId: "rec-z"
          }),
          pageEntity({
            id: "a-anchor",
            title: "A Anchor",
            eventType: "short_notification",
            recruitmentId: "rec-a"
          }),
          pageEntity({
            id: "evt-z",
            title: "Z Event",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          }),
          pageEntity({
            id: "evt-a",
            title: "A Event",
            eventType: "result",
            recruitmentId: "rec-42",
            metadata: { relatedEntityId: "a-anchor" }
          })
        ]
      });

      expect(analysis.anchorCandidates.map((entry) => entry.id)).toEqual(["a-anchor", "z-anchor"]);
      expect(analysis.lifecycleCandidates.map((entry) => entry.id)).toEqual(["evt-a", "evt-z"]);
    });

    test("produces identical results for identical input", () => {
      const input = {
        entities: [
          pageEntity({ id: "b", title: "B", recruitmentId: "rec-1", metadata: { primary: true } }),
          pageEntity({ id: "a", title: "A", recruitmentId: "rec-1", eventType: "admit_card" })
        ]
      };

      const first = analyzeExistingRecruitmentArchitecture(input);
      const second = analyzeExistingRecruitmentArchitecture(input);

      expect(first).toEqual(second);
      expect(first.lifecycleCandidates).not.toBe(second.lifecycleCandidates);
    });
  });

  describe("migration readiness", () => {
    test("reports READY when anchors and lifecycle are grouped without gaps", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          }),
          pageEntity({
            id: "evt-1",
            title: "Admit Card",
            eventType: "admit_card",
            recruitmentId: "rec-42"
          })
        ]
      });

      expect(analysis.migrationReadiness.status).toBe(MIGRATION_READINESS_STATUS.READY);
      expect(analysis.migrationReadiness.reasons).toContain("ANCHOR_CANDIDATES_PRESENT");
      expect(analysis.migrationReadiness.reasons).toContain("LIFECYCLE_CANDIDATES_PRESENT");
    });

    test("reports PARTIAL when anchors exist without lifecycle grouping", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "primary-1",
            title: "SSC CGL",
            eventType: "notification",
            recruitmentId: "rec-42",
            metadata: { primary: true }
          })
        ]
      });

      expect(analysis.migrationReadiness.status).toBe(MIGRATION_READINESS_STATUS.PARTIAL);
      expect(analysis.migrationReadiness.reasons).toContain("ANCHORS_WITHOUT_LIFECYCLE_GROUPING");
    });

    test("reports NOT_READY when only standalone entities exist", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [
          pageEntity({
            id: "solo-1",
            title: "Standalone",
            eventType: "result",
            recruitmentId: "rec-solo"
          })
        ]
      });

      expect(analysis.migrationReadiness.status).toBe(MIGRATION_READINESS_STATUS.NOT_READY);
      expect(analysis.migrationReadiness.reasons).toContain("NO_ANCHOR_CANDIDATES");
      expect(analysis.migrationReadiness.reasons).toContain("INSUFFICIENT_ARCHITECTURE_SIGNALS");
    });
  });

  describe("summarizeExistingRecruitmentArchitectureAnalysis", () => {
    test("summarizes a valid analysis", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      const summary = summarizeExistingRecruitmentArchitectureAnalysis(analysis);

      expect(summary.valid).toBe(true);
      expect(summary.anchorCount).toBe(1);
      expect(summary.lifecycleCount).toBe(1);
      expect(summary.migrationStatus).toBe(MIGRATION_READINESS_STATUS.READY);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("immutability", () => {
    test("freezes entire analysis object graph", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
        entities: [pageEntity({ metadata: { primary: true } })]
      });

      assertAllFrozen(analysis);
      expect(hasCircularReference(analysis)).toBe(false);
      expect(isExistingRecruitmentArchitectureAnalysis(analysis)).toBe(true);
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

      analyzeExistingRecruitmentArchitecture(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const analysis = analyzeExistingRecruitmentArchitecture({
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

      expect(Object.isFrozen(analysis.anchorCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.lifecycleCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.standaloneCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.unsupportedCandidates)).toBe(true);
      expect(Object.isFrozen(analysis.analysisSummary.reasons)).toBe(true);
      expect(Object.isFrozen(analysis.migrationReadiness.reasons)).toBe(true);
      expect(() => {
        analysis.anchorCandidates.push({});
      }).toThrow();
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 87");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/analyzeExistingRecruitmentArchitecture/);
      expect(source).toMatch(/does not[\s\S]*perform migration/);
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

      expect(compatibilitySource).not.toMatch(/existingRecruitmentArchitectureAnalyzer/);
      expect(pipelineSource).not.toMatch(/existingRecruitmentArchitectureAnalyzer/);
    });

    test("metadata confirms no runtime integration, migration, or side effects", () => {
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.runtimeIntegration).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.persistenceEnabled).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.sideEffects).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.queriesDatabase).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.performsMigration).toBe(false);
      expect(EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA.mutatesInput).toBe(false);
    });
  });
});
