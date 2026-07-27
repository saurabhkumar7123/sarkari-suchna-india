"use strict";

/**
 * Phase 82 — Recruitment Relationship Mapping Foundation tests.
 * Empty input, primary/related entities, relationships, unknown types,
 * invalid input, immutability, determinism, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_RELATIONSHIP_MAP_PHASE,
  RECRUITMENT_RELATIONSHIP_MAP_ENTITY,
  RELATIONSHIP_TYPES,
  SUPPORTED_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LIST,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECRUITMENT_RELATIONSHIP_MAP_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_MAP_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_RELATIONSHIP_MAP,
  isSupportedRelationshipType,
  normalizeRelationshipType,
  normalizeConfidence,
  createRecruitmentRelationshipMap,
  isRecruitmentRelationshipMap,
  validateRecruitmentRelationshipMap,
  summarizeRecruitmentRelationshipMap
} = require("../server/lib/recruitment/recruitmentRelationshipMap");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentRelationshipMap.js";
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

function samplePrimaryEntity(overrides = {}) {
  return {
    id: "rec-42",
    entityType: "recruitment",
    metadata: { label: "SSC CGL 2024" },
    ...overrides
  };
}

function sampleRelatedEntity(overrides = {}) {
  return {
    id: "evt-1",
    entityType: "recruitment_event",
    metadata: { eventType: "notification" },
    ...overrides
  };
}

function sampleRelationship(overrides = {}) {
  return {
    source: "rec-42",
    target: "evt-1",
    relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
    confidence: CONFIDENCE_LEVELS.HIGH,
    metadata: { note: "lifecycle event" },
    ...overrides
  };
}

describe("Phase 82 — recruitmentRelationshipMap", () => {
  describe("exports", () => {
    test("exposes phase 82 constants and descriptor", () => {
      expect(RECRUITMENT_RELATIONSHIP_MAP_PHASE).toBe(82);
      expect(RECRUITMENT_RELATIONSHIP_MAP_ENTITY).toBe("recruitment_relationship_map");
      expect(RECRUITMENT_RELATIONSHIP_MAP_DESCRIPTOR.entity).toBe(
        "recruitment_relationship_map"
      );
      expect(RECRUITMENT_RELATIONSHIP_MAP_DESCRIPTOR.phase).toBe(82);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.performsLinking).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.supportsFutureRelationshipEngine).toBe(
        true
      );
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
      expect(SUPPORTED_RELATIONSHIP_TYPES.has(RELATIONSHIP_TYPES.RELATED_EVENT)).toBe(true);
      expect(SUPPORTED_RELATIONSHIP_TYPES.has(RELATIONSHIP_TYPES.PREVIOUS_VERSION)).toBe(
        true
      );
      expect(SUPPORTED_RELATIONSHIP_TYPES.has(RELATIONSHIP_TYPES.NEXT_VERSION)).toBe(true);
      expect(SUPPORTED_RELATIONSHIP_TYPES.has(RELATIONSHIP_TYPES.UNKNOWN)).toBe(true);
      expect(SUPPORTED_CONFIDENCE_LEVELS.has(CONFIDENCE_LEVELS.HIGH)).toBe(true);
    });

    test("exports helper functions", () => {
      expect(typeof createRecruitmentRelationshipMap).toBe("function");
      expect(typeof isRecruitmentRelationshipMap).toBe("function");
      expect(typeof validateRecruitmentRelationshipMap).toBe("function");
      expect(typeof summarizeRecruitmentRelationshipMap).toBe("function");
      expect(typeof isSupportedRelationshipType).toBe("function");
      expect(typeof normalizeRelationshipType).toBe("function");
      expect(typeof normalizeConfidence).toBe("function");
    });
  });

  describe("empty input", () => {
    test("returns empty relationship map for empty object", () => {
      const map = createRecruitmentRelationshipMap({});

      expect(map).toEqual(EMPTY_RECRUITMENT_RELATIONSHIP_MAP);
      expect(map.recruitmentId).toBeNull();
      expect(map.primaryEntity).toBeNull();
      expect(map.relatedEntities).toEqual([]);
      expect(map.relationships).toEqual([]);
      expect(map.relationshipCount).toBe(0);
    });

    test("returns empty relationship map for null and undefined", () => {
      expect(createRecruitmentRelationshipMap(null)).toBe(EMPTY_RECRUITMENT_RELATIONSHIP_MAP);
      expect(createRecruitmentRelationshipMap(undefined)).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_MAP
      );
    });
  });

  describe("primary entity", () => {
    test("maps a primary recruitment entity", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity()
      });

      expect(map.recruitmentId).toBe(42);
      expect(map.primaryEntity).toEqual({
        id: "rec-42",
        entityType: "recruitment",
        metadata: { label: "SSC CGL 2024" }
      });
      expect(map.relatedEntities).toEqual([]);
      expect(map.relationshipCount).toBe(0);
    });

    test("accepts snake_case primary_entity alias", () => {
      const map = createRecruitmentRelationshipMap({
        recruitment_id: "r-9",
        primary_entity: {
          entity_id: "p-1",
          entity_type: "recruitment"
        }
      });

      expect(map.recruitmentId).toBe("r-9");
      expect(map.primaryEntity.id).toBe("p-1");
      expect(map.primaryEntity.entityType).toBe("recruitment");
    });

    test("ignores empty primary entity objects", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 1,
        primaryEntity: {}
      });

      expect(map.primaryEntity).toBeNull();
    });
  });

  describe("related entities", () => {
    test("maps related lifecycle entities in deterministic order", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [
          sampleRelatedEntity({ id: "evt-3", entityType: "recruitment_event" }),
          sampleRelatedEntity({ id: "evt-1", entityType: "recruitment_event" }),
          sampleRelatedEntity({ id: "evt-2", entityType: "result_event" })
        ]
      });

      expect(map.relatedEntities.map((entity) => entity.id)).toEqual([
        "evt-1",
        "evt-2",
        "evt-3"
      ]);
      expect(map.relatedEntities).toHaveLength(3);
    });

    test("skips invalid related entity entries", () => {
      const map = createRecruitmentRelationshipMap({
        relatedEntities: [
          null,
          "not-an-entity",
          {},
          sampleRelatedEntity({ id: "evt-ok" })
        ]
      });

      expect(map.relatedEntities).toHaveLength(1);
      expect(map.relatedEntities[0].id).toBe("evt-ok");
    });
  });

  describe("multiple relationships", () => {
    test("maps multiple relationships with full structure", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [
          sampleRelatedEntity({ id: "evt-1" }),
          sampleRelatedEntity({ id: "evt-2" })
        ],
        relationships: [
          sampleRelationship({
            source: "rec-42",
            target: "rec-42",
            relationshipType: RELATIONSHIP_TYPES.PRIMARY,
            confidence: CONFIDENCE_LEVELS.HIGH
          }),
          sampleRelationship({
            source: "rec-42",
            target: "evt-1",
            relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
            confidence: 0.9
          }),
          sampleRelationship({
            source: "evt-1",
            target: "evt-2",
            relationshipType: RELATIONSHIP_TYPES.NEXT_VERSION,
            confidence: CONFIDENCE_LEVELS.MEDIUM,
            metadata: { reason: "correction supersedes prior" }
          }),
          sampleRelationship({
            source: "evt-2",
            target: "evt-1",
            relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
            confidence: CONFIDENCE_LEVELS.LOW
          })
        ]
      });

      expect(map.relationshipCount).toBe(4);
      expect(map.relationships).toHaveLength(4);
      expect(map.relationships.every((rel) => typeof rel.relationshipType === "string")).toBe(
        true
      );
      expect(map.relationships.every((rel) => isPlainObject(rel.metadata))).toBe(true);
      expect(map.relationships[0]).toEqual(
        expect.objectContaining({
          source: expect.anything(),
          target: expect.anything(),
          relationshipType: expect.any(String),
          confidence: expect.any(String),
          metadata: expect.any(Object)
        })
      );
    });

    test("sorts relationships deterministically by source, target, type", () => {
      const map = createRecruitmentRelationshipMap({
        relationships: [
          sampleRelationship({
            source: "b",
            target: "z",
            relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT
          }),
          sampleRelationship({
            source: "a",
            target: "y",
            relationshipType: RELATIONSHIP_TYPES.PRIMARY
          }),
          sampleRelationship({
            source: "a",
            target: "x",
            relationshipType: RELATIONSHIP_TYPES.NEXT_VERSION
          })
        ]
      });

      expect(
        map.relationships.map((rel) => `${rel.source}->${rel.target}:${rel.relationshipType}`)
      ).toEqual(["a->x:NEXT_VERSION", "a->y:PRIMARY", "b->z:RELATED_EVENT"]);
    });
  });

  describe("unknown relationship type", () => {
    test("coerces unsupported relationship types to UNKNOWN", () => {
      const map = createRecruitmentRelationshipMap({
        relationships: [
          sampleRelationship({
            relationshipType: "SOME_FUTURE_TYPE",
            confidence: CONFIDENCE_LEVELS.MEDIUM
          })
        ]
      });

      expect(map.relationships).toHaveLength(1);
      expect(map.relationships[0].relationshipType).toBe(RELATIONSHIP_TYPES.UNKNOWN);
      expect(normalizeRelationshipType("bogus")).toBe(RELATIONSHIP_TYPES.UNKNOWN);
      expect(isSupportedRelationshipType("bogus")).toBe(false);
    });

    test("normalizes missing relationship type to UNKNOWN", () => {
      const map = createRecruitmentRelationshipMap({
        relationships: [
          {
            source: "a",
            target: "b",
            confidence: CONFIDENCE_LEVELS.LOW
          }
        ]
      });

      expect(map.relationships[0].relationshipType).toBe(RELATIONSHIP_TYPES.UNKNOWN);
    });

    test("accepts case-insensitive known relationship types", () => {
      expect(normalizeRelationshipType("related_event")).toBe(RELATIONSHIP_TYPES.RELATED_EVENT);
      expect(normalizeRelationshipType("primary")).toBe(RELATIONSHIP_TYPES.PRIMARY);
    });
  });

  describe("invalid input", () => {
    test("returns empty map for non-object input without throwing", () => {
      expect(createRecruitmentRelationshipMap("not-an-object")).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_MAP
      );
      expect(createRecruitmentRelationshipMap(42)).toBe(EMPTY_RECRUITMENT_RELATIONSHIP_MAP);
      expect(createRecruitmentRelationshipMap([1, 2, 3])).toBe(
        EMPTY_RECRUITMENT_RELATIONSHIP_MAP
      );
      expect(() => createRecruitmentRelationshipMap(Symbol("x"))).not.toThrow();
    });

    test("rejects invalid relationship map shapes in helpers", () => {
      expect(isRecruitmentRelationshipMap(null)).toBe(false);
      expect(isRecruitmentRelationshipMap({ relationshipCount: 1 })).toBe(false);

      const validation = validateRecruitmentRelationshipMap({ relationships: [] });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RELATIONSHIP_MAP_SHAPE");
      expect(validation.status).toBe(VALIDATION_STATUS.INCOMPLETE);
    });

    test("validates relationship count inconsistencies", () => {
      const map = createRecruitmentRelationshipMap({
        relationships: [sampleRelationship()]
      });
      const tampered = {
        ...map,
        relationships: map.relationships,
        relatedEntities: map.relatedEntities,
        relationshipCount: 99
      };

      const validation = validateRecruitmentRelationshipMap(tampered);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RELATIONSHIP_MAP_SHAPE");
    });

    test("normalizeConfidence defaults unknown values", () => {
      expect(normalizeConfidence(null)).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(normalizeConfidence("not-a-level")).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(normalizeConfidence(0.95)).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(normalizeConfidence(0.6)).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(normalizeConfidence(0.2)).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });

  describe("validation and summarize", () => {
    test("accepts a valid created map", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [sampleRelatedEntity()],
        relationships: [sampleRelationship()]
      });

      expect(isRecruitmentRelationshipMap(map)).toBe(true);
      const validation = validateRecruitmentRelationshipMap(map);
      expect(validation.valid).toBe(true);
      expect(validation.reasons).toEqual([]);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
    });

    test("summarize returns compact valid summary", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [sampleRelatedEntity(), sampleRelatedEntity({ id: "evt-2" })],
        relationships: [
          sampleRelationship({ relationshipType: RELATIONSHIP_TYPES.PRIMARY }),
          sampleRelationship({
            source: "rec-42",
            target: "evt-2",
            relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT
          })
        ]
      });

      const summary = summarizeRecruitmentRelationshipMap(map);
      expect(summary.valid).toBe(true);
      expect(summary.phase).toBe(82);
      expect(summary.hasPrimaryEntity).toBe(true);
      expect(summary.relatedEntityCount).toBe(2);
      expect(summary.relationshipCount).toBe(2);
      expect(summary.relationshipTypes).toEqual(
        expect.arrayContaining([
          RELATIONSHIP_TYPES.PRIMARY,
          RELATIONSHIP_TYPES.RELATED_EVENT
        ])
      );
      expect(summary.performsLinking).toBe(false);
      expect(summary.readOnly).toBe(true);
    });

    test("summarize invalid map safely", () => {
      const summary = summarizeRecruitmentRelationshipMap(null);

      expect(summary.valid).toBe(false);
      expect(summary.relationshipCount).toBe(0);
      expect(summary.hasPrimaryEntity).toBe(false);
      expect(summary.performsLinking).toBe(false);
    });
  });

  describe("immutability", () => {
    test("returns deeply frozen relationship maps", () => {
      const map = createRecruitmentRelationshipMap({
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [sampleRelatedEntity()],
        relationships: [sampleRelationship()]
      });

      assertAllFrozen(map);
      expect(hasCircularReference(map)).toBe(false);
    });

    test("does not mutate input objects", () => {
      const input = {
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [sampleRelatedEntity({ id: "evt-9" })],
        relationships: [sampleRelationship({ target: "evt-9" })]
      };
      const snapshot = JSON.stringify(input);

      createRecruitmentRelationshipMap(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const map = createRecruitmentRelationshipMap({
        relatedEntities: [sampleRelatedEntity()],
        relationships: [sampleRelationship()]
      });

      expect(Object.isFrozen(map.relatedEntities)).toBe(true);
      expect(Object.isFrozen(map.relationships)).toBe(true);
      expect(() => {
        map.relationships.push({ source: "x" });
      }).toThrow();
      expect(() => {
        map.relatedEntities.push({ id: "y" });
      }).toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical maps for identical input", () => {
      const input = {
        recruitmentId: 42,
        primaryEntity: samplePrimaryEntity(),
        relatedEntities: [
          sampleRelatedEntity({ id: "evt-2" }),
          sampleRelatedEntity({ id: "evt-1" })
        ],
        relationships: [
          sampleRelationship({
            source: "rec-42",
            target: "evt-2",
            relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT
          }),
          sampleRelationship({
            source: "rec-42",
            target: "evt-1",
            relationshipType: RELATIONSHIP_TYPES.PRIMARY
          })
        ]
      };

      const first = createRecruitmentRelationshipMap(input);
      const second = createRecruitmentRelationshipMap(input);

      expect(first).toEqual(second);
      expect(first.relationships).not.toBe(second.relationships);
      expect(first.relatedEntities).not.toBe(second.relatedEntities);
    });

    test("normalizes relationship order regardless of input order", () => {
      const base = {
        recruitmentId: 7,
        relationships: [
          sampleRelationship({ source: "z", target: "a", relationshipType: "RELATED_EVENT" }),
          sampleRelationship({ source: "a", target: "b", relationshipType: "PRIMARY" })
        ]
      };
      const reversed = {
        recruitmentId: 7,
        relationships: [
          sampleRelationship({ source: "a", target: "b", relationshipType: "PRIMARY" }),
          sampleRelationship({ source: "z", target: "a", relationshipType: "RELATED_EVENT" })
        ]
      };

      expect(createRecruitmentRelationshipMap(base)).toEqual(
        createRecruitmentRelationshipMap(reversed)
      );
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 82");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createRecruitmentRelationshipMap/);
      expect(source).toContain("without performing actual linking");
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

      expect(compatibilitySource).not.toMatch(/recruitmentRelationshipMap/);
      expect(pipelineSource).not.toMatch(/recruitmentRelationshipMap/);
    });

    test("metadata confirms no runtime integration, linking, or side effects", () => {
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.resolvesPages).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.fetchesUrls).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.performsLinking).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_MAP_METADATA.mutatesInput).toBe(false);
    });
  });
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
