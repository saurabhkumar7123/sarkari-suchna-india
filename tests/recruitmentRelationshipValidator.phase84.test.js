"use strict";

/**
 * Phase 84 — Recruitment Relationship Validation Layer tests.
 * Valid relationship, missing source/target, invalid type/confidence,
 * self relationship, duplicate, circular reference, low confidence review,
 * multiple relationships, empty input, invalid input, immutability,
 * determinism, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
  RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY,
  RELATIONSHIP_TYPES,
  CONFIDENCE_LEVELS,
  RELATIONSHIP_VALIDATION_REASONS,
  VALIDATION_STATUS,
  RECRUITMENT_RELATIONSHIP_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA,
  EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION,
  validateRecruitmentRelationships,
  isRelationshipValidationResult,
  validateRelationshipValidationResult,
  summarizeRelationshipValidationResult
} = require("../server/lib/recruitment/recruitmentRelationshipValidator");

const { resolveRecruitmentRelationships } = require("../server/lib/recruitment/recruitmentRelationshipResolver");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentRelationshipValidator.js";
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

function emptyConfidenceSummary(total = 0) {
  return { high: 0, medium: 0, low: 0, unknown: 0, total };
}

function resolutionInput(suggestedRelationships, candidates = []) {
  const confidenceSummary = { high: 0, medium: 0, low: 0, unknown: 0, total: 0 };
  for (let i = 0; i < suggestedRelationships.length; i += 1) {
    const confidence = suggestedRelationships[i].confidence;
    if (confidence === CONFIDENCE_LEVELS.HIGH) {
      confidenceSummary.high += 1;
    } else if (confidence === CONFIDENCE_LEVELS.MEDIUM) {
      confidenceSummary.medium += 1;
    } else if (confidence === CONFIDENCE_LEVELS.LOW) {
      confidenceSummary.low += 1;
    } else {
      confidenceSummary.unknown += 1;
    }
  }
  confidenceSummary.total = suggestedRelationships.length;

  return {
    candidates,
    suggestedRelationships,
    relationshipCount: suggestedRelationships.length,
    confidenceSummary
  };
}

function suggestion(overrides = {}) {
  return {
    source: "rec-1",
    target: "evt-1",
    relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
    confidence: CONFIDENCE_LEVELS.HIGH,
    reason: "test",
    metadata: {},
    ...overrides
  };
}

describe("Phase 84 — recruitmentRelationshipValidator", () => {
  describe("exports", () => {
    test("exposes phase 84 constants and descriptor", () => {
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE).toBe(84);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY).toBe(
        "recruitment_relationship_validation"
      );
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_DESCRIPTOR.entity).toBe(
        "recruitment_relationship_validation"
      );
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_DESCRIPTOR.phase).toBe(84);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.validatesStructureOnly).toBe(true);
    });

    test("exports validation statuses and public API functions", () => {
      expect(VALIDATION_STATUS).toEqual({
        VALID: "VALID",
        INVALID: "INVALID",
        REVIEW_REQUIRED: "REVIEW_REQUIRED"
      });
      expect(typeof validateRecruitmentRelationships).toBe("function");
      expect(typeof isRelationshipValidationResult).toBe("function");
      expect(typeof validateRelationshipValidationResult).toBe("function");
      expect(typeof summarizeRelationshipValidationResult).toBe("function");
    });
  });

  describe("empty input", () => {
    test("returns frozen empty validation for nullish and invalid input", () => {
      for (const input of [null, undefined, false, 0, "", [], "bad", { invalid: true }]) {
        const result = validateRecruitmentRelationships(input);
        expect(result).toEqual(EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION);
        expect(Object.isFrozen(result)).toBe(true);
      }
    });

    test("returns valid empty result for resolution input with no relationships", () => {
      const result = validateRecruitmentRelationships(resolutionInput([]));

      expect(result.valid).toBe(true);
      expect(result.status).toBe(VALIDATION_STATUS.VALID);
      expect(result.relationshipResults).toEqual([]);
      expect(result.summary).toEqual({
        relationshipCount: 0,
        validCount: 0,
        invalidCount: 0,
        reviewRequiredCount: 0
      });
    });
  });

  describe("valid relationship", () => {
    test("accepts a structurally valid high-confidence relationship", () => {
      const input = resolutionInput([
        suggestion({
          source: "rec-42",
          target: "evt-9",
          relationshipType: RELATIONSHIP_TYPES.PRIMARY,
          confidence: CONFIDENCE_LEVELS.HIGH
        })
      ]);

      const result = validateRecruitmentRelationships(input);

      expect(result.valid).toBe(true);
      expect(result.status).toBe(VALIDATION_STATUS.VALID);
      expect(result.relationshipResults).toHaveLength(1);
      expect(result.relationshipResults[0]).toMatchObject({
        source: "rec-42",
        target: "evt-9",
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH,
        status: VALIDATION_STATUS.VALID,
        reasons: []
      });
    });

    test("validates relationships produced by Phase 83 resolver", () => {
      const resolution = resolveRecruitmentRelationships({
        entities: [
          {
            id: "rec-42",
            entityType: "recruitment",
            metadata: { title: "SSC CGL 2024", year: 2024 }
          },
          {
            id: "evt-1",
            entityType: "recruitment_event",
            metadata: {
              eventType: "notification",
              recruitmentId: "rec-42",
              title: "SSC CGL 2024"
            }
          }
        ]
      });

      const result = validateRecruitmentRelationships(resolution);

      expect(result.valid).toBe(true);
      expect(result.status).toBe(VALIDATION_STATUS.VALID);
      expect(result.relationshipResults.length).toBe(resolution.relationshipCount);
      expect(result.summary.relationshipCount).toBe(resolution.relationshipCount);
    });
  });

  describe("missing source", () => {
    test("marks relationship invalid when source is missing", () => {
      const input = resolutionInput([
        suggestion({ source: null, target: "evt-1", confidence: CONFIDENCE_LEVELS.HIGH })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(result.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.MISSING_SOURCE);
    });
  });

  describe("missing target", () => {
    test("marks relationship invalid when target is missing", () => {
      const input = resolutionInput([
        suggestion({ source: "rec-1", target: "", confidence: CONFIDENCE_LEVELS.HIGH })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(entry.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.MISSING_TARGET);
    });
  });

  describe("invalid relationship type", () => {
    test("rejects unsupported relationship types", () => {
      const input = resolutionInput([
        suggestion({
          relationshipType: "NOT_A_REAL_TYPE",
          confidence: CONFIDENCE_LEVELS.HIGH
        })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(entry.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.INVALID_RELATIONSHIP_TYPE);
    });
  });

  describe("invalid confidence", () => {
    test("rejects unsupported confidence values", () => {
      const input = resolutionInput([
        suggestion({
          confidence: "very_high",
          relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT
        })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(entry.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.INVALID_CONFIDENCE);
    });
  });

  describe("self relationship", () => {
    test("rejects relationships where source and target are identical", () => {
      const input = resolutionInput([
        suggestion({
          source: "rec-1",
          target: "rec-1",
          relationshipType: RELATIONSHIP_TYPES.PRIMARY,
          confidence: CONFIDENCE_LEVELS.HIGH
        })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(entry.status).toBe(VALIDATION_STATUS.INVALID);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.SELF_RELATIONSHIP);
    });
  });

  describe("duplicate relationship", () => {
    test("flags duplicate source-target-type combinations", () => {
      const duplicate = suggestion({
        source: "rec-1",
        target: "evt-1",
        relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
        confidence: CONFIDENCE_LEVELS.HIGH
      });
      const input = resolutionInput([duplicate, { ...duplicate }]);

      const result = validateRecruitmentRelationships(input);

      expect(result.valid).toBe(false);
      expect(result.status).toBe(VALIDATION_STATUS.INVALID);
      expect(result.relationshipResults).toHaveLength(2);
      expect(result.relationshipResults[0].status).toBe(VALIDATION_STATUS.VALID);
      expect(result.relationshipResults[1].status).toBe(VALIDATION_STATUS.INVALID);
      expect(result.relationshipResults[1].reasons).toContain(
        RELATIONSHIP_VALIDATION_REASONS.DUPLICATE_RELATIONSHIP
      );
    });
  });

  describe("circular reference", () => {
    test("rejects mutual previous-version edges as circular", () => {
      const input = resolutionInput([
        suggestion({
          source: "rec-2023",
          target: "rec-2024",
          relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
          confidence: CONFIDENCE_LEVELS.HIGH
        }),
        suggestion({
          source: "rec-2024",
          target: "rec-2023",
          relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
          confidence: CONFIDENCE_LEVELS.HIGH
        })
      ]);

      const result = validateRecruitmentRelationships(input);

      expect(result.valid).toBe(false);
      expect(result.summary.invalidCount).toBe(2);
      expect(result.relationshipResults[0].reasons).toContain(
        RELATIONSHIP_VALIDATION_REASONS.CIRCULAR_REFERENCE
      );
      expect(result.relationshipResults[1].reasons).toContain(
        RELATIONSHIP_VALIDATION_REASONS.CIRCULAR_REFERENCE
      );
    });
  });

  describe("low confidence review", () => {
    test("requires review for low-confidence relationships", () => {
      const input = resolutionInput([
        suggestion({
          confidence: CONFIDENCE_LEVELS.LOW,
          relationshipType: RELATIONSHIP_TYPES.UNKNOWN
        })
      ]);

      const result = validateRecruitmentRelationships(input);
      const entry = result.relationshipResults[0];

      expect(result.valid).toBe(false);
      expect(result.status).toBe(VALIDATION_STATUS.REVIEW_REQUIRED);
      expect(entry.status).toBe(VALIDATION_STATUS.REVIEW_REQUIRED);
      expect(entry.reasons).toContain(RELATIONSHIP_VALIDATION_REASONS.LOW_CONFIDENCE_REVIEW);
    });

    test("requires review for unknown-confidence relationships", () => {
      const input = resolutionInput([
        suggestion({
          confidence: CONFIDENCE_LEVELS.UNKNOWN,
          relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT
        })
      ]);

      const result = validateRecruitmentRelationships(input);

      expect(result.status).toBe(VALIDATION_STATUS.REVIEW_REQUIRED);
      expect(result.relationshipResults[0].status).toBe(VALIDATION_STATUS.REVIEW_REQUIRED);
    });
  });

  describe("multiple relationships", () => {
    test("validates mixed valid, review, and invalid relationships", () => {
      const input = resolutionInput([
        suggestion({
          source: "rec-1",
          target: "evt-1",
          relationshipType: RELATIONSHIP_TYPES.PRIMARY,
          confidence: CONFIDENCE_LEVELS.HIGH
        }),
        suggestion({
          source: "rec-2",
          target: "evt-2",
          relationshipType: RELATIONSHIP_TYPES.UNKNOWN,
          confidence: CONFIDENCE_LEVELS.LOW
        }),
        suggestion({
          source: "rec-3",
          target: "rec-3",
          relationshipType: RELATIONSHIP_TYPES.PRIMARY,
          confidence: CONFIDENCE_LEVELS.HIGH
        })
      ]);

      const result = validateRecruitmentRelationships(input);

      expect(result.valid).toBe(false);
      expect(result.status).toBe(VALIDATION_STATUS.INVALID);
      expect(result.summary).toEqual({
        relationshipCount: 3,
        validCount: 1,
        invalidCount: 1,
        reviewRequiredCount: 1
      });
    });
  });

  describe("invalid input", () => {
    test("rejects resolution input with mismatched relationship count", () => {
      const input = resolutionInput([suggestion()]);
      input.relationshipCount = 99;

      const result = validateRecruitmentRelationships(input);

      expect(result).toEqual(EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION);
    });

    test("validateRelationshipValidationResult rejects malformed results", () => {
      const validation = validateRelationshipValidationResult({ invalid: true });

      expect(validation.valid).toBe(false);
      expect(validation.status).toBe(VALIDATION_STATUS.INVALID);
      expect(validation.reasons).toContain("INVALID_RELATIONSHIP_VALIDATION_SHAPE");
    });

    test("summarizeRelationshipValidationResult handles invalid results", () => {
      const summary = summarizeRelationshipValidationResult(null);

      expect(summary.valid).toBe(false);
      expect(summary.relationshipCount).toBe(0);
      expect(summary.readOnly).toBe(true);
    });
  });

  describe("immutability", () => {
    test("freezes entire validation result graph", () => {
      const result = validateRecruitmentRelationships(
        resolutionInput([
          suggestion({
            source: "rec-1",
            target: "evt-1",
            confidence: CONFIDENCE_LEVELS.HIGH
          })
        ])
      );

      assertAllFrozen(result);
      expect(hasCircularReference(result)).toBe(false);
      expect(isRelationshipValidationResult(result)).toBe(true);
      expect(validateRelationshipValidationResult(result).valid).toBe(true);
    });

    test("does not mutate resolution input", () => {
      const input = resolutionInput([
        suggestion({ source: "rec-9", target: "evt-9", confidence: CONFIDENCE_LEVELS.HIGH })
      ]);
      const snapshot = JSON.stringify(input);

      validateRecruitmentRelationships(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const result = validateRecruitmentRelationships(
        resolutionInput([suggestion({ confidence: CONFIDENCE_LEVELS.HIGH })])
      );

      expect(Object.isFrozen(result.relationshipResults)).toBe(true);
      expect(() => {
        result.relationshipResults.push({});
      }).toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const input = resolutionInput([
        suggestion({ source: "rec-b", target: "evt-b", confidence: CONFIDENCE_LEVELS.MEDIUM }),
        suggestion({ source: "rec-a", target: "evt-a", confidence: CONFIDENCE_LEVELS.HIGH })
      ]);

      const first = validateRecruitmentRelationships(input);
      const second = validateRecruitmentRelationships(input);

      expect(first).toEqual(second);
      expect(first.relationshipResults).not.toBe(second.relationshipResults);
    });

    test("sorts relationship results regardless of input order", () => {
      const relationships = [
        suggestion({ source: "rec-b", target: "evt-b", confidence: CONFIDENCE_LEVELS.HIGH }),
        suggestion({ source: "rec-a", target: "evt-a", confidence: CONFIDENCE_LEVELS.HIGH })
      ];

      const forward = validateRecruitmentRelationships(resolutionInput(relationships));
      const reverse = validateRecruitmentRelationships(
        resolutionInput([...relationships].reverse())
      );

      expect(forward).toEqual(reverse);
      expect(forward.relationshipResults[0].source).toBe("rec-a");
      expect(forward.relationshipResults[1].source).toBe("rec-b");
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 84");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/validateRecruitmentRelationships/);
      expect(source).toMatch(/does not create, store, or apply/);
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

      expect(compatibilitySource).not.toMatch(/recruitmentRelationshipValidator/);
      expect(pipelineSource).not.toMatch(/recruitmentRelationshipValidator/);
    });

    test("metadata confirms no runtime integration, linking, or side effects", () => {
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.performsLinking).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.mutatesInput).toBe(false);
      expect(RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA.appliesRelationships).toBe(false);
    });
  });
});
