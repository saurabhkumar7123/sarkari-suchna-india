"use strict";

/**
 * Phase 85 — Recruitment Mapping Planning Layer tests.
 * Complete mapping information, missing primary entity, missing relationships,
 * partial information, empty input, invalid input, confidence calculation,
 * readiness calculation, immutability, determinism, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_MAPPING_PLANNER_PHASE,
  RECRUITMENT_MAPPING_PLAN_ENTITY,
  MAPPING_STATUS,
  READINESS_LEVELS,
  CONFIDENCE_LEVELS,
  RELATIONSHIP_TYPES,
  PLANNING_MISSING_INFORMATION,
  RECRUITMENT_MAPPING_PLANNER_DESCRIPTOR,
  RECRUITMENT_MAPPING_PLANNER_METADATA,
  EMPTY_RECRUITMENT_MAPPING_PLAN,
  createRecruitmentMappingPlan,
  isRecruitmentMappingPlan,
  validateRecruitmentMappingPlan,
  summarizeRecruitmentMappingPlan
} = require("../server/lib/recruitment/recruitmentMappingPlanner");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentMappingPlanner.js";
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

function relationship(overrides = {}) {
  return {
    source: "rec-1",
    target: "evt-1",
    relationshipType: RELATIONSHIP_TYPES.PRIMARY,
    confidence: CONFIDENCE_LEVELS.HIGH,
    metadata: {},
    ...overrides
  };
}

function completeInput(overrides = {}) {
  return {
    entities: {
      primaryEntity: { id: "rec-1", entityType: "recruitment" },
      relatedEntities: [
        { id: "evt-1", entityType: "notification" },
        { id: "evt-2", entityType: "admit_card" }
      ]
    },
    relationships: [
      relationship({
        source: "rec-1",
        target: "evt-1",
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH
      }),
      relationship({
        source: "rec-1",
        target: "evt-2",
        relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
        confidence: CONFIDENCE_LEVELS.HIGH
      })
    ],
    validationResult: {
      valid: true,
      status: "VALID",
      relationshipResults: [],
      summary: {
        relationshipCount: 2,
        validCount: 2,
        invalidCount: 0,
        reviewRequiredCount: 0
      }
    },
    timelineProjection: {
      recruitmentId: "rec-1",
      eventCount: 2,
      events: [{ eventType: "notification" }, { eventType: "admit_card" }]
    },
    lifecycleEvaluation: {
      recruitmentId: "rec-1",
      suggestedState: "EXAM_STAGE",
      confidence: CONFIDENCE_LEVELS.HIGH
    },
    ...overrides
  };
}

describe("Phase 85 — recruitmentMappingPlanner", () => {
  describe("exports", () => {
    test("exposes phase 85 constants and descriptor", () => {
      expect(RECRUITMENT_MAPPING_PLANNER_PHASE).toBe(85);
      expect(RECRUITMENT_MAPPING_PLAN_ENTITY).toBe("recruitment_mapping_plan");
      expect(RECRUITMENT_MAPPING_PLANNER_DESCRIPTOR.entity).toBe("recruitment_mapping_plan");
      expect(RECRUITMENT_MAPPING_PLANNER_DESCRIPTOR.phase).toBe(85);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.performsMapping).toBe(false);
    });

    test("exposes mapping status and readiness enums", () => {
      expect(MAPPING_STATUS).toEqual({
        READY: "READY",
        PARTIAL: "PARTIAL",
        NOT_READY: "NOT_READY"
      });
      expect(READINESS_LEVELS).toEqual({
        HIGH: "HIGH",
        MEDIUM: "MEDIUM",
        LOW: "LOW",
        UNKNOWN: "UNKNOWN"
      });
    });
  });

  describe("complete mapping information", () => {
    test("produces READY plan with HIGH readiness for complete input", () => {
      const plan = createRecruitmentMappingPlan(completeInput());

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.HIGH);
      expect(plan.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(plan.recruitmentId).toBe("rec-1");
      expect(plan.primaryCandidate).toEqual({
        id: "rec-1",
        entityType: "recruitment",
        role: null,
        metadata: {}
      });
      expect(plan.relatedCandidates).toHaveLength(2);
      expect(plan.missingInformation).toEqual([]);
      expect(validateRecruitmentMappingPlan(plan).valid).toBe(true);
    });

    test("accepts entities as an array with role markers", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          entities: [
            { id: "rec-9", entityType: "recruitment", role: "PRIMARY" },
            { id: "evt-9", entityType: "notification", role: "RELATED" }
          ],
          relationships: [
            relationship({
              source: "rec-9",
              target: "evt-9",
              confidence: CONFIDENCE_LEVELS.HIGH
            })
          ],
          timelineProjection: {
            recruitmentId: "rec-9",
            eventCount: 1,
            events: [{ eventType: "notification" }]
          },
          lifecycleEvaluation: {
            recruitmentId: "rec-9",
            suggestedState: "NOTIFICATION_AVAILABLE",
            confidence: CONFIDENCE_LEVELS.HIGH
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.READY);
      expect(plan.primaryCandidate.id).toBe("rec-9");
      expect(plan.relatedCandidates).toHaveLength(1);
    });
  });

  describe("missing primary entity", () => {
    test("returns NOT_READY when primary entity is absent", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          entities: {
            relatedEntities: [{ id: "evt-1", entityType: "notification" }]
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.NOT_READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.UNKNOWN);
      expect(plan.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(plan.primaryCandidate).toBeNull();
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY
      );
    });

    test("returns PARTIAL when primary entity lacks an id", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          entities: {
            primaryEntity: { entityType: "recruitment" },
            relatedEntities: [{ id: "evt-1", entityType: "notification" }]
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.primaryCandidate.id).toBeNull();
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY_ID
      );
    });
  });

  describe("missing relationships", () => {
    test("returns PARTIAL when relationships are absent", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          relationships: []
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_RELATIONSHIPS
      );
    });

    test("returns PARTIAL when validation result is missing", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          validationResult: undefined
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_VALIDATION_RESULT
      );
    });

    test("returns PARTIAL when relationships are not validated", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          validationResult: {
            valid: false,
            status: "INVALID",
            relationshipResults: [],
            summary: {
              relationshipCount: 2,
              validCount: 0,
              invalidCount: 2,
              reviewRequiredCount: 0
            }
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.RELATIONSHIPS_NOT_VALIDATED
      );
    });
  });

  describe("partial information", () => {
    test("returns PARTIAL when lifecycle evaluation is missing", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          lifecycleEvaluation: undefined
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_EVALUATION
      );
    });

    test("returns PARTIAL when timeline projection is missing", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          timelineProjection: undefined
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_TIMELINE_PROJECTION
      );
    });

    test("returns PARTIAL when lifecycle state is missing", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          lifecycleEvaluation: {
            recruitmentId: "rec-1",
            confidence: CONFIDENCE_LEVELS.MEDIUM
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_STATE
      );
    });
  });

  describe("empty and invalid input", () => {
    test("returns empty plan for null input", () => {
      const plan = createRecruitmentMappingPlan(null);

      expect(plan).toEqual(EMPTY_RECRUITMENT_MAPPING_PLAN);
      expect(plan.mappingStatus).toBe(MAPPING_STATUS.NOT_READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.UNKNOWN);
    });

    test("returns empty plan for undefined input", () => {
      const plan = createRecruitmentMappingPlan(undefined);

      expect(plan).toEqual(EMPTY_RECRUITMENT_MAPPING_PLAN);
    });

    test("returns empty plan for array input", () => {
      const plan = createRecruitmentMappingPlan([]);

      expect(plan).toEqual(EMPTY_RECRUITMENT_MAPPING_PLAN);
    });

    test("returns NOT_READY for empty object input", () => {
      const plan = createRecruitmentMappingPlan({});

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.NOT_READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.UNKNOWN);
      expect(plan.missingInformation).toContain(
        PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY
      );
    });

    test("validateRecruitmentMappingPlan rejects malformed plans", () => {
      const validation = validateRecruitmentMappingPlan({ invalid: true });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_MAPPING_PLAN_SHAPE");
    });

    test("summarizeRecruitmentMappingPlan handles invalid plans", () => {
      const summary = summarizeRecruitmentMappingPlan(null);

      expect(summary.valid).toBe(false);
      expect(summary.mappingStatus).toBe(MAPPING_STATUS.NOT_READY);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMapping).toBe(false);
    });
  });

  describe("confidence calculation", () => {
    test("uses lowest relationship confidence signal", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          relationships: [
            relationship({ confidence: CONFIDENCE_LEVELS.HIGH }),
            relationship({
              target: "evt-2",
              relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
              confidence: CONFIDENCE_LEVELS.LOW
            })
          ],
          lifecycleEvaluation: {
            recruitmentId: "rec-1",
            suggestedState: "EXAM_STAGE",
            confidence: CONFIDENCE_LEVELS.HIGH
          }
        })
      );

      expect(plan.confidence).toBe(CONFIDENCE_LEVELS.LOW);
      expect(plan.mappingStatus).toBe(MAPPING_STATUS.READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.LOW);
    });

    test("downgrades confidence when validation requires review", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          validationResult: {
            valid: false,
            status: "REVIEW_REQUIRED",
            relationshipResults: [],
            summary: {
              relationshipCount: 2,
              validCount: 0,
              invalidCount: 0,
              reviewRequiredCount: 2
            }
          }
        })
      );

      expect(plan.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
    });

    test("returns unknown confidence without primary entity", () => {
      const plan = createRecruitmentMappingPlan({
        relationships: [relationship()],
        validationResult: { valid: true, status: "VALID" }
      });

      expect(plan.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
    });
  });

  describe("readiness calculation", () => {
    test("maps READY + medium confidence to MEDIUM readiness", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          relationships: [
            relationship({ confidence: CONFIDENCE_LEVELS.MEDIUM }),
            relationship({
              target: "evt-2",
              relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
              confidence: CONFIDENCE_LEVELS.MEDIUM
            })
          ],
          lifecycleEvaluation: {
            recruitmentId: "rec-1",
            suggestedState: "EXAM_STAGE",
            confidence: CONFIDENCE_LEVELS.MEDIUM
          }
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.MEDIUM);
    });

    test("maps PARTIAL with limited gaps to MEDIUM readiness", () => {
      const plan = createRecruitmentMappingPlan(
        completeInput({
          timelineProjection: undefined
        })
      );

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.PARTIAL);
      expect(plan.readiness).toBe(READINESS_LEVELS.MEDIUM);
    });

    test("maps NOT_READY to UNKNOWN readiness", () => {
      const plan = createRecruitmentMappingPlan({});

      expect(plan.mappingStatus).toBe(MAPPING_STATUS.NOT_READY);
      expect(plan.readiness).toBe(READINESS_LEVELS.UNKNOWN);
    });
  });

  describe("summarizeRecruitmentMappingPlan", () => {
    test("summarizes a valid plan", () => {
      const plan = createRecruitmentMappingPlan(completeInput());
      const summary = summarizeRecruitmentMappingPlan(plan);

      expect(summary.valid).toBe(true);
      expect(summary.recruitmentId).toBe("rec-1");
      expect(summary.mappingStatus).toBe(MAPPING_STATUS.READY);
      expect(summary.readiness).toBe(READINESS_LEVELS.HIGH);
      expect(summary.missingInformationCount).toBe(0);
      expect(summary.relatedCandidateCount).toBe(2);
      expect(summary.relationshipCount).toBe(2);
      expect(summary.validationValid).toBe(true);
      expect(summary.timelineAvailable).toBe(true);
      expect(summary.lifecycleAvailable).toBe(true);
    });
  });

  describe("immutability", () => {
    test("freezes entire planning object graph", () => {
      const plan = createRecruitmentMappingPlan(completeInput());

      assertAllFrozen(plan);
      expect(hasCircularReference(plan)).toBe(false);
      expect(isRecruitmentMappingPlan(plan)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = completeInput();
      const snapshot = JSON.stringify(input);

      createRecruitmentMappingPlan(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const plan = createRecruitmentMappingPlan(completeInput());

      expect(Object.isFrozen(plan.relatedCandidates)).toBe(true);
      expect(Object.isFrozen(plan.missingInformation)).toBe(true);
      expect(() => {
        plan.relatedCandidates.push({});
      }).toThrow();
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const input = completeInput();

      const first = createRecruitmentMappingPlan(input);
      const second = createRecruitmentMappingPlan(input);

      expect(first).toEqual(second);
      expect(first.relatedCandidates).not.toBe(second.relatedCandidates);
    });

    test("sorts related candidates regardless of input order", () => {
      const input = completeInput({
        entities: {
          primaryEntity: { id: "rec-1", entityType: "recruitment" },
          relatedEntities: [
            { id: "evt-b", entityType: "admit_card" },
            { id: "evt-a", entityType: "notification" }
          ]
        }
      });

      const forward = createRecruitmentMappingPlan(input);
      const reverse = createRecruitmentMappingPlan({
        ...input,
        entities: {
          primaryEntity: { id: "rec-1", entityType: "recruitment" },
          relatedEntities: [
            { id: "evt-a", entityType: "notification" },
            { id: "evt-b", entityType: "admit_card" }
          ]
        }
      });

      expect(forward).toEqual(reverse);
      expect(forward.relatedCandidates[0].id).toBe("evt-a");
      expect(forward.relatedCandidates[1].id).toBe("evt-b");
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 85");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createRecruitmentMappingPlan/);
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

      expect(compatibilitySource).not.toMatch(/recruitmentMappingPlanner/);
      expect(pipelineSource).not.toMatch(/recruitmentMappingPlanner/);
    });

    test("metadata confirms no runtime integration, mapping, or side effects", () => {
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.performsMapping).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.createsRelationships).toBe(false);
      expect(RECRUITMENT_MAPPING_PLANNER_METADATA.mutatesInput).toBe(false);
    });
  });
});
