"use strict";

/**
 * Phase 83 — Recruitment Relationship Resolver tests.
 * Empty input, single entity, matching entities, event/version hints,
 * unknown cases, confidence calculation, invalid input, immutability,
 * determinism, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
  RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY,
  RELATIONSHIP_TYPES,
  SUPPORTED_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LIST,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECRUITMENT_RELATIONSHIP_RESOLVER_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION,
  normalizeEntityForRelationship,
  resolveRecruitmentRelationships,
  isRelationshipResolutionResult,
  validateRelationshipResolutionResult,
  summarizeRelationshipResolutionResult
} = require("../server/lib/recruitment/recruitmentRelationshipResolver");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentRelationshipResolver.js";
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

function sampleRecruitment(overrides = {}) {
  return {
    id: "rec-42",
    entityType: "recruitment",
    metadata: { title: "SSC CGL 2024", year: 2024 },
    ...overrides
  };
}

function sampleEvent(overrides = {}) {
  return {
    id: "evt-1",
    entityType: "recruitment_event",
    metadata: {
      eventType: "notification",
      recruitmentId: "rec-42",
      title: "SSC CGL 2024"
    },
    ...overrides
  };
}

describe("Phase 83 — recruitmentRelationshipResolver", () => {
  describe("exports", () => {
    test("exposes phase 83 constants and descriptor", () => {
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE).toBe(83);
      expect(RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY).toBe(
        "recruitment_relationship_resolution"
      );
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_DESCRIPTOR.entity).toBe(
        "recruitment_relationship_resolution"
      );
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_DESCRIPTOR.phase).toBe(83);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.performsLinking).toBe(false);
    });

    test("exports supported relationship types", () => {
      expect(RELATIONSHIP_TYPE_LIST).toEqual([
        "PRIMARY",
        "RELATED_EVENT",
        "PREVIOUS_VERSION",
        "NEXT_VERSION",
        "UNKNOWN"
      ]);
      expect(SUPPORTED_RELATIONSHIP_TYPES.has(RELATIONSHIP_TYPES.PRIMARY)).toBe(true);
      expect(SUPPORTED_CONFIDENCE_LEVELS.has(CONFIDENCE_LEVELS.HIGH)).toBe(true);
    });

    test("exports public API functions", () => {
      expect(typeof resolveRecruitmentRelationships).toBe("function");
      expect(typeof normalizeEntityForRelationship).toBe("function");
      expect(typeof isRelationshipResolutionResult).toBe("function");
      expect(typeof validateRelationshipResolutionResult).toBe("function");
      expect(typeof summarizeRelationshipResolutionResult).toBe("function");
    });
  });

  describe("empty input", () => {
    test("returns empty resolution for missing entities", () => {
      const result = resolveRecruitmentRelationships({});

      expect(result).toEqual(EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION);
      expect(result.candidates).toEqual([]);
      expect(result.suggestedRelationships).toEqual([]);
      expect(result.relationshipCount).toBe(0);
      expect(result.confidenceSummary).toEqual({
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0,
        total: 0
      });
    });

    test("returns empty resolution for null, undefined, and invalid input", () => {
      expect(resolveRecruitmentRelationships(null)).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION
      );
      expect(resolveRecruitmentRelationships(undefined)).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION
      );
      expect(resolveRecruitmentRelationships([])).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION
      );
      expect(resolveRecruitmentRelationships("invalid")).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION
      );
    });
  });

  describe("single entity", () => {
    test("normalizes a single candidate without suggesting relationships", () => {
      const result = resolveRecruitmentRelationships({
        entities: [sampleRecruitment()]
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe("rec-42");
      expect(result.candidates[0].entityType).toBe("recruitment");
      expect(result.suggestedRelationships).toEqual([]);
      expect(result.relationshipCount).toBe(0);
    });
  });

  describe("matching entities", () => {
    test("suggests RELATED_EVENT and PRIMARY for recruitment and event with matching recruitment id", () => {
      const result = resolveRecruitmentRelationships({
        entities: [sampleRecruitment(), sampleEvent()]
      });

      expect(result.relationshipCount).toBeGreaterThanOrEqual(2);

      const related = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.RELATED_EVENT
      );
      const primary = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.PRIMARY
      );

      expect(related).toMatchObject({
        source: "rec-42",
        target: "evt-1",
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "matching_recruitment_identifier"
      });
      expect(primary).toMatchObject({
        source: "rec-42",
        target: "evt-1",
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "primary_recruitment_for_event"
      });
    });

    test("suggests RELATED_EVENT via matching normalized title when recruitment id is absent", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment(),
          sampleEvent({
            metadata: {
              eventType: "notification",
              title: "SSC CGL 2024"
            }
          })
        ]
      });

      const related = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.RELATED_EVENT
      );

      expect(related).toMatchObject({
        source: "rec-42",
        target: "evt-1",
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        reason: "matching_normalized_title"
      });
    });
  });

  describe("different recruitment entities", () => {
    test("does not suggest relationships between unrelated recruitment entities", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({ id: "rec-a", metadata: { title: "UPSC CDS 2024" } }),
          sampleRecruitment({ id: "rec-b", metadata: { title: "SSC CHSL 2024" } })
        ]
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.suggestedRelationships).toEqual([]);
      expect(result.relationshipCount).toBe(0);
    });
  });

  describe("event relationship hints", () => {
    test("suggests low-confidence RELATED_EVENT when only event type is available", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({ metadata: { title: "Railway Group D" } }),
          sampleEvent({
            id: "evt-rail",
            metadata: { eventType: "exam_date", title: "Railway JE" }
          })
        ]
      });

      const related = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.RELATED_EVENT
      );

      expect(related).toMatchObject({
        confidence: CONFIDENCE_LEVELS.LOW,
        reason: "event_type_relationship_hint"
      });
      expect(related.metadata.eventType).toBe("exam_date");
    });
  });

  describe("version relationship hints", () => {
    test("suggests PREVIOUS_VERSION and NEXT_VERSION from year indicators", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({
            id: "rec-2023",
            metadata: { title: "SSC CGL", year: 2023 }
          }),
          sampleRecruitment({
            id: "rec-2024",
            metadata: { title: "SSC CGL", year: 2024 }
          })
        ]
      });

      const previous = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.PREVIOUS_VERSION
      );
      const next = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.NEXT_VERSION
      );

      expect(previous).toMatchObject({
        source: "rec-2023",
        target: "rec-2024",
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        reason: "version_year_indicator"
      });
      expect(next).toMatchObject({
        source: "rec-2024",
        target: "rec-2023",
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        reason: "version_year_indicator_inverse"
      });
    });

    test("suggests PREVIOUS_VERSION from explicit metadata hints", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({
            id: "rec-old",
            metadata: { title: "IBPS PO", nextVersionId: "rec-new" }
          }),
          sampleRecruitment({
            id: "rec-new",
            metadata: { title: "IBPS PO", year: 2025 }
          })
        ]
      });

      const previous = result.suggestedRelationships.find(
        (entry) =>
          entry.relationshipType === RELATIONSHIP_TYPES.PREVIOUS_VERSION &&
          entry.reason === "explicit_previous_version_metadata"
      );

      expect(previous).toMatchObject({
        source: "rec-old",
        target: "rec-new",
        confidence: CONFIDENCE_LEVELS.HIGH
      });
    });
  });

  describe("unknown cases", () => {
    test("suggests UNKNOWN for weak title overlap between same-type entities", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({
            id: "rec-x",
            metadata: { title: "DRDO CEPTAM" }
          }),
          sampleRecruitment({
            id: "rec-y",
            metadata: { title: "DRDO-CEPTAM" }
          })
        ]
      });

      const unknown = result.suggestedRelationships.find(
        (entry) => entry.relationshipType === RELATIONSHIP_TYPES.UNKNOWN
      );

      expect(unknown).toMatchObject({
        confidence: CONFIDENCE_LEVELS.LOW,
        reason: "weak_title_overlap"
      });
    });

    test("suggests UNKNOWN from explicit related entity without relationship type", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment({ id: "rec-1" }),
          sampleRecruitment({
            id: "rec-2",
            metadata: { relatedEntityId: "rec-1" }
          })
        ]
      });

      const unknown = result.suggestedRelationships.find(
        (entry) =>
          entry.relationshipType === RELATIONSHIP_TYPES.UNKNOWN &&
          entry.reason === "explicit_metadata_related_entity"
      );

      expect(unknown).toMatchObject({
        source: "rec-2",
        target: "rec-1",
        confidence: CONFIDENCE_LEVELS.MEDIUM
      });
    });
  });

  describe("confidence calculation", () => {
    test("builds confidence summary from suggested relationships", () => {
      const result = resolveRecruitmentRelationships({
        entities: [
          sampleRecruitment(),
          sampleEvent(),
          sampleRecruitment({
            id: "rec-2023",
            metadata: { title: "SSC CGL", year: 2023 }
          }),
          sampleRecruitment({
            id: "rec-2024",
            metadata: { title: "SSC CGL", year: 2024 }
          })
        ]
      });

      expect(result.confidenceSummary.total).toBe(result.relationshipCount);
      expect(
        result.confidenceSummary.high +
          result.confidenceSummary.medium +
          result.confidenceSummary.low +
          result.confidenceSummary.unknown
      ).toBe(result.relationshipCount);
      expect(result.confidenceSummary.high).toBeGreaterThan(0);
    });

    test("summarizeRelationshipResolutionResult includes confidence summary", () => {
      const result = resolveRecruitmentRelationships({
        entities: [sampleRecruitment(), sampleEvent()]
      });
      const summary = summarizeRelationshipResolutionResult(result);

      expect(summary.valid).toBe(true);
      expect(summary.candidateCount).toBe(2);
      expect(summary.relationshipCount).toBe(result.relationshipCount);
      expect(summary.confidenceSummary).toEqual(result.confidenceSummary);
      expect(summary.performsLinking).toBe(false);
    });
  });

  describe("invalid input", () => {
    test("skips invalid entity entries while resolving valid ones", () => {
      const result = resolveRecruitmentRelationships({
        entities: [null, "bad", {}, sampleRecruitment(), sampleEvent()]
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.relationshipCount).toBeGreaterThan(0);
    });

    test("validateRelationshipResolutionResult rejects invalid shapes", () => {
      const validation = validateRelationshipResolutionResult({ invalid: true });

      expect(validation.valid).toBe(false);
      expect(validation.status).toBe(VALIDATION_STATUS.INCOMPLETE);
      expect(validation.reasons).toContain("INVALID_RELATIONSHIP_RESOLUTION_SHAPE");
    });

    test("summarizeRelationshipResolutionResult handles invalid results", () => {
      const summary = summarizeRelationshipResolutionResult(null);

      expect(summary.valid).toBe(false);
      expect(summary.candidateCount).toBe(0);
      expect(summary.relationshipCount).toBe(0);
    });
  });

  describe("normalizeEntityForRelationship", () => {
    test("normalizes entity aliases and metadata", () => {
      const entity = normalizeEntityForRelationship({
        entityId: 99,
        entity_type: "recruitment_event",
        metadata: { eventType: "notification", recruitment_id: "rec-42" }
      });

      expect(entity).toEqual({
        id: 99,
        entityType: "recruitment_event",
        metadata: { eventType: "notification", recruitment_id: "rec-42" }
      });
      expect(Object.isFrozen(entity)).toBe(true);
      expect(Object.isFrozen(entity.metadata)).toBe(true);
    });

    test("returns null for unusable entity input", () => {
      expect(normalizeEntityForRelationship(null)).toBeNull();
      expect(normalizeEntityForRelationship({})).toBeNull();
      expect(normalizeEntityForRelationship([])).toBeNull();
    });
  });

  describe("immutability", () => {
    test("freezes entire resolution result graph", () => {
      const result = resolveRecruitmentRelationships({
        entities: [sampleRecruitment(), sampleEvent()]
      });

      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
      expect(isRelationshipResolutionResult(result)).toBe(true);
      expect(validateRelationshipResolutionResult(result).valid).toBe(true);
    });

    test("does not mutate input objects", () => {
      const input = {
        entities: [sampleRecruitment(), sampleEvent({ id: "evt-9" })]
      };
      const snapshot = JSON.stringify(input);

      resolveRecruitmentRelationships(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const result = resolveRecruitmentRelationships({
        entities: [sampleRecruitment(), sampleEvent()]
      });

      expect(Object.isFrozen(result.candidates)).toBe(true);
      expect(Object.isFrozen(result.suggestedRelationships)).toBe(true);
      expect(() => {
        result.suggestedRelationships.push({});
      }).toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const input = {
        entities: [
          sampleEvent({ id: "evt-2" }),
          sampleRecruitment(),
          sampleEvent({ id: "evt-1", metadata: { recruitmentId: "rec-42" } })
        ]
      };

      const first = resolveRecruitmentRelationships(input);
      const second = resolveRecruitmentRelationships(input);

      expect(first).toEqual(second);
      expect(first.suggestedRelationships).not.toBe(second.suggestedRelationships);
      expect(first.candidates).not.toBe(second.candidates);
    });

    test("normalizes candidate and relationship order regardless of input order", () => {
      const entitiesA = [
        sampleRecruitment(),
        sampleEvent({ id: "evt-2" }),
        sampleEvent({ id: "evt-1", metadata: { recruitmentId: "rec-42" } })
      ];
      const entitiesB = [...entitiesA].reverse();

      expect(resolveRecruitmentRelationships({ entities: entitiesA })).toEqual(
        resolveRecruitmentRelationships({ entities: entitiesB })
      );
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 83");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/resolveRecruitmentRelationships/);
      expect(source).toMatch(/does not create[\s\S]*real links/);
    });

    test("module does not import database, express, or filesystem modules", () => {
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

      expect(compatibilitySource).not.toMatch(/recruitmentRelationshipResolver/);
      expect(pipelineSource).not.toMatch(/recruitmentRelationshipResolver/);
    });

    test("metadata confirms no runtime integration, linking, or side effects", () => {
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.performsLinking).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.mutatesInput).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA.infersHiddenInformation).toBe(false);
    });
  });
});
