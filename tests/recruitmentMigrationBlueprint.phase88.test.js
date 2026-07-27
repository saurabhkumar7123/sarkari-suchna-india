"use strict";

/**
 * Phase 88 — Recruitment Migration Blueprint tests.
 * Complete readiness, partial readiness, missing analyses, prerequisite generation,
 * risk generation, deferred item generation, deterministic output, immutability,
 * invalid input, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
  RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY,
  MIGRATION_STAGES,
  READINESS_STATUS,
  CONFIDENCE_LEVELS,
  PREREQUISITE_CODES,
  RISK_IDS,
  DEFERRED_ITEM_IDS,
  MIGRATION_STEP_DEFINITIONS,
  RECRUITMENT_MIGRATION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_MIGRATION_BLUEPRINT_METADATA,
  EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT,
  createRecruitmentMigrationBlueprint,
  isRecruitmentMigrationBlueprint,
  validateRecruitmentMigrationBlueprint,
  summarizeRecruitmentMigrationBlueprint
} = require("../server/lib/recruitment/recruitmentMigrationBlueprint");

const { analyzeExistingRecruitmentArchitecture } = require("../server/lib/recruitment/existingRecruitmentArchitectureAnalyzer");
const { createRecruitmentMappingPlan } = require("../server/lib/recruitment/recruitmentMappingPlanner");
const { createRecruitmentMappingCandidateAnalysis } = require("../server/lib/recruitment/recruitmentMappingCandidateAnalyzer");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentMigrationBlueprint.js";
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

function completeEntities() {
  return [
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
  ];
}

function completeBlueprintInput(overrides = {}) {
  const entities = completeEntities();
  const architectureAnalysis = analyzeExistingRecruitmentArchitecture({ entities });
  const candidateAnalysis = createRecruitmentMappingCandidateAnalysis({ entities });
  const mappingPlan = createRecruitmentMappingPlan({
    entities: {
      primaryEntity: { id: "primary-1", entityType: "recruitment" },
      relatedEntities: [{ id: "evt-admit", entityType: "admit_card" }]
    },
    relationships: [
      {
        source: "primary-1",
        target: "evt-admit",
        relationshipType: "RELATED_EVENT",
        confidence: CONFIDENCE_LEVELS.HIGH
      }
    ],
    validationResult: {
      valid: true,
      status: "VALID",
      relationshipResults: [],
      summary: {
        relationshipCount: 1,
        validCount: 1,
        invalidCount: 0,
        reviewRequiredCount: 0
      }
    },
    timelineProjection: {
      recruitmentId: "rec-42",
      eventCount: 2,
      events: [{ eventType: "notification" }, { eventType: "admit_card" }]
    },
    lifecycleEvaluation: {
      recruitmentId: "rec-42",
      suggestedState: "EXAM_STAGE",
      confidence: CONFIDENCE_LEVELS.HIGH
    }
  });

  return {
    architectureAnalysis,
    mappingPlan,
    candidateAnalysis,
    ...overrides
  };
}

describe("Phase 88 — recruitmentMigrationBlueprint", () => {
  describe("exports", () => {
    test("exposes phase 88 constants and descriptor", () => {
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_PHASE).toBe(88);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY).toBe("recruitment_migration_blueprint");
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_DESCRIPTOR.entity).toBe(
        "recruitment_migration_blueprint"
      );
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_DESCRIPTOR.phase).toBe(88);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.performsMigration).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.generatesSql).toBe(false);
    });

    test("exposes migration stages, readiness statuses, and step definitions", () => {
      expect(MIGRATION_STAGES).toEqual({
        PREPARATION: "PREPARATION",
        READY_FOR_MIGRATION: "READY_FOR_MIGRATION",
        REQUIRES_REVIEW: "REQUIRES_REVIEW"
      });
      expect(READINESS_STATUS).toEqual({
        READY: "READY",
        PARTIAL: "PARTIAL",
        NOT_READY: "NOT_READY"
      });
      expect(MIGRATION_STEP_DEFINITIONS).toHaveLength(8);
      expect(MIGRATION_STEP_DEFINITIONS[0].id).toBe("REVIEW_ARCHITECTURE_CLASSIFICATION");
    });
  });

  describe("invalid input", () => {
    test("returns empty blueprint for null and non-object input", () => {
      expect(createRecruitmentMigrationBlueprint(null)).toEqual(
        EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT
      );
      expect(createRecruitmentMigrationBlueprint(undefined)).toEqual(
        EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT
      );
      expect(createRecruitmentMigrationBlueprint(false)).toEqual(
        EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT
      );
      expect(createRecruitmentMigrationBlueprint("invalid")).toEqual(
        EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT
      );
      expect(createRecruitmentMigrationBlueprint([])).toEqual(
        EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT
      );
    });

    test("tolerates malformed nested analysis objects", () => {
      const blueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis: "bad",
        mappingPlan: 42,
        candidateAnalysis: null
      });

      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.REQUIRES_REVIEW);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_ARCHITECTURE_ANALYSIS);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_MAPPING_PLAN);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS);
      expect(validateRecruitmentMigrationBlueprint(blueprint).valid).toBe(true);
    });

    test("validateRecruitmentMigrationBlueprint rejects invalid shapes", () => {
      const validation = validateRecruitmentMigrationBlueprint({ migrationStage: "INVALID" });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_BLUEPRINT_SHAPE");
    });

    test("summarizeRecruitmentMigrationBlueprint handles invalid blueprint", () => {
      const summary = summarizeRecruitmentMigrationBlueprint(null);

      expect(summary.valid).toBe(false);
      expect(summary.migrationStage).toBe(MIGRATION_STAGES.REQUIRES_REVIEW);
      expect(summary.readinessStatus).toBe(READINESS_STATUS.NOT_READY);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("complete readiness", () => {
    test("produces READY_FOR_MIGRATION when all upstream analyses are ready", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());

      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(blueprint.migrationReadiness.status).toBe(READINESS_STATUS.READY);
      expect(blueprint.migrationReadiness.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(blueprint.migrationReadiness.reasons).toContain("ALL_PREREQUISITES_MET");
      expect(blueprint.migrationReadiness.reasons).toContain("UPSTREAM_ANALYSES_ALIGNED");
      expect(blueprint.prerequisites).toEqual([]);
      expect(validateRecruitmentMigrationBlueprint(blueprint).valid).toBe(true);
    });

    test("includes all standard migration steps in order", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());

      expect(blueprint.migrationSteps).toHaveLength(8);
      expect(blueprint.migrationSteps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(blueprint.migrationSteps[0]).toMatchObject({
        id: "REVIEW_ARCHITECTURE_CLASSIFICATION",
        title: "Review architecture classification"
      });
      expect(blueprint.migrationSteps[7]).toMatchObject({
        id: "PREPARE_ROLLOUT_CHECKLIST",
        title: "Prepare rollout checklist"
      });
    });
  });

  describe("partial readiness", () => {
    test("reports PREPARATION when only architecture analysis is supplied", () => {
      const architectureAnalysis = analyzeExistingRecruitmentArchitecture({
        entities: completeEntities()
      });

      const blueprint = createRecruitmentMigrationBlueprint({ architectureAnalysis });

      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.PREPARATION);
      expect(blueprint.migrationReadiness.status).toBe(READINESS_STATUS.PARTIAL);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_MAPPING_PLAN);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS);
      expect(blueprint.metadata.architectureAnalysisAvailable).toBe(true);
      expect(blueprint.metadata.mappingPlanAvailable).toBe(false);
    });

    test("reports PREPARATION when mapping plan is partial", () => {
      const blueprint = createRecruitmentMigrationBlueprint(
        completeBlueprintInput({
          mappingPlan: createRecruitmentMappingPlan({
            entities: {
              primaryEntity: { id: "primary-1", entityType: "recruitment" },
              relatedEntities: []
            },
            relationships: []
          })
        })
      );

      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.PREPARATION);
      expect(blueprint.migrationReadiness.status).toBe(READINESS_STATUS.PARTIAL);
      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MAPPING_PLAN_PARTIALLY_READY);
    });
  });

  describe("missing architecture analysis", () => {
    test("flags missing architecture analysis prerequisite", () => {
      const input = completeBlueprintInput();
      delete input.architectureAnalysis;

      const blueprint = createRecruitmentMigrationBlueprint(input);

      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_ARCHITECTURE_ANALYSIS);
      expect(blueprint.migrationStage).not.toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(blueprint.metadata.architectureAnalysisAvailable).toBe(false);
    });
  });

  describe("missing mapping plan", () => {
    test("flags missing mapping plan prerequisite", () => {
      const input = completeBlueprintInput();
      delete input.mappingPlan;

      const blueprint = createRecruitmentMigrationBlueprint(input);

      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_MAPPING_PLAN);
      expect(blueprint.migrationStage).not.toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(blueprint.metadata.mappingPlanAvailable).toBe(false);
    });
  });

  describe("missing candidate analysis", () => {
    test("flags missing candidate analysis prerequisite", () => {
      const input = completeBlueprintInput();
      delete input.candidateAnalysis;

      const blueprint = createRecruitmentMigrationBlueprint(input);

      expect(blueprint.prerequisites).toContain(PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS);
      expect(blueprint.migrationStage).not.toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(blueprint.metadata.candidateAnalysisAvailable).toBe(false);
    });
  });

  describe("prerequisite generation", () => {
    test("collects architecture, mapping, and candidate prerequisites deterministically", () => {
      const blueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis: {
          migrationReadiness: { status: "PARTIAL", confidence: "medium", reasons: [] },
          analysisSummary: {
            anchorCount: 1,
            lifecycleCount: 0,
            standaloneCount: 1,
            unsupportedCount: 1
          }
        },
        mappingPlan: {
          mappingStatus: "NOT_READY",
          confidence: "low",
          missingInformation: ["MISSING_RELATIONSHIPS", "MISSING_VALIDATION_RESULT"]
        },
        candidateAnalysis: {
          primaryCandidate: null,
          relatedCandidates: [],
          ignoredCandidates: [],
          confidence: "unknown"
        }
      });

      expect(blueprint.prerequisites).toEqual([
        "ARCHITECTURE_PARTIALLY_READY",
        "MAPPING_PLAN_NOT_READY",
        "MISSING_PRIMARY_CANDIDATE",
        "MISSING_RELATIONSHIPS",
        "MISSING_VALIDATION_RESULT",
        "STANDALONE_ENTITIES_IN_ARCHITECTURE",
        "UNSUPPORTED_ENTITIES_IN_ARCHITECTURE"
      ]);
    });

    test("includes ignored candidate review prerequisite", () => {
      const blueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis: analyzeExistingRecruitmentArchitecture({
          entities: completeEntities()
        }),
        mappingPlan: createRecruitmentMappingPlan({
          entities: {
            primaryEntity: { id: "primary-1", entityType: "recruitment" },
            relatedEntities: [{ id: "evt-admit", entityType: "admit_card" }]
          },
          relationships: [
            {
              source: "primary-1",
              target: "evt-admit",
              relationshipType: "RELATED_EVENT",
              confidence: CONFIDENCE_LEVELS.HIGH
            }
          ],
          validationResult: { valid: true, status: "VALID" },
          timelineProjection: { recruitmentId: "rec-42", eventCount: 2, events: [] },
          lifecycleEvaluation: {
            recruitmentId: "rec-42",
            suggestedState: "EXAM_STAGE",
            confidence: CONFIDENCE_LEVELS.HIGH
          }
        }),
        candidateAnalysis: {
          primaryCandidate: { id: "primary-1" },
          relatedCandidates: [{ id: "evt-admit" }],
          ignoredCandidates: [{ id: "ignored-1" }],
          analysisSummary: { relatedCount: 1, ignoredCount: 1 },
          confidence: CONFIDENCE_LEVELS.HIGH
        }
      });

      expect(blueprint.prerequisites).toContain(
        PREREQUISITE_CODES.IGNORED_CANDIDATES_REQUIRE_REVIEW
      );
      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.REQUIRES_REVIEW);
    });
  });

  describe("risk generation", () => {
    test("generates risks for unsupported and ignored entities", () => {
      const blueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis: {
          migrationReadiness: { status: "PARTIAL", confidence: "low", reasons: [] },
          analysisSummary: { unsupportedCount: 2, standaloneCount: 1, anchorCount: 1, lifecycleCount: 0 }
        },
        mappingPlan: {
          mappingStatus: "PARTIAL",
          confidence: "low",
          missingInformation: [],
          metadata: { validationAvailable: true, validationValid: false }
        },
        candidateAnalysis: {
          primaryCandidate: { id: "primary-1" },
          relatedCandidates: [],
          ignoredCandidates: [{ id: "ignored-1" }],
          analysisSummary: { ignoredCount: 1 },
          confidence: "low"
        }
      });

      const riskIds = blueprint.risks.map((risk) => risk.id);

      expect(riskIds).toContain(RISK_IDS.UNSUPPORTED_ENTITIES);
      expect(riskIds).toContain(RISK_IDS.IGNORED_CANDIDATES);
      expect(riskIds).toContain(RISK_IDS.PARTIAL_ARCHITECTURE);
      expect(riskIds).toContain(RISK_IDS.LIFECYCLE_MAPPING_GAPS);
      expect(riskIds).toContain(RISK_IDS.VALIDATION_GAPS);
      expect(riskIds).toContain(RISK_IDS.STANDALONE_ENTITY_ISOLATION);
      expect(riskIds).toContain(RISK_IDS.LOW_CONFIDENCE_SIGNALS);
      expect(riskIds).toEqual([...riskIds].sort((left, right) => left.localeCompare(right)));
    });

    test("generates mapping plan conflict risk", () => {
      const blueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis: {
          migrationReadiness: { status: "READY", confidence: "high", reasons: [] },
          analysisSummary: { anchorCount: 1, lifecycleCount: 1, standaloneCount: 0, unsupportedCount: 0 }
        },
        mappingPlan: {
          mappingStatus: "NOT_READY",
          confidence: "unknown",
          missingInformation: ["MISSING_PRIMARY_ENTITY"]
        },
        candidateAnalysis: {
          primaryCandidate: { id: "primary-1" },
          relatedCandidates: [{ id: "evt-1" }],
          analysisSummary: { relatedCount: 1, ignoredCount: 0 },
          confidence: "high"
        }
      });

      expect(blueprint.risks.map((risk) => risk.id)).toContain(RISK_IDS.MAPPING_PLAN_CONFLICT);
      expect(blueprint.migrationStage).toBe(MIGRATION_STAGES.REQUIRES_REVIEW);
    });
  });

  describe("deferred item generation", () => {
    test("always includes standard production rollout deferred items", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());

      const deferredIds = blueprint.deferredItems.map((item) => item.id);

      expect(deferredIds).toEqual([
        DEFERRED_ITEM_IDS.RUNTIME_PIPELINE_INTEGRATION,
        DEFERRED_ITEM_IDS.DATABASE_SCHEMA_MIGRATION,
        DEFERRED_ITEM_IDS.PAGE_ROUTE_AND_URL_UPDATES,
        DEFERRED_ITEM_IDS.PRODUCTION_DATA_BACKFILL,
        DEFERRED_ITEM_IDS.MONITORING_AND_ALERTING_ALIGNMENT,
        DEFERRED_ITEM_IDS.LIVE_MIGRATION_EXECUTION
      ]);
      expect(blueprint.deferredItems[0]).toMatchObject({
        id: DEFERRED_ITEM_IDS.RUNTIME_PIPELINE_INTEGRATION,
        description: expect.stringContaining("runtime recruitment pipeline")
      });
      expect(blueprint.metadata.deferredItemCount).toBe(6);
    });

    test("includes deferred items even for empty input", () => {
      expect(EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT.deferredItems).toHaveLength(6);
    });
  });

  describe("deterministic output", () => {
    test("sorts prerequisites and risks deterministically", () => {
      const input = {
        architectureAnalysis: {
          migrationReadiness: { status: "NOT_READY", confidence: "unknown", reasons: [] },
          analysisSummary: { unsupportedCount: 1, standaloneCount: 1, anchorCount: 0, lifecycleCount: 0 }
        },
        mappingPlan: {
          mappingStatus: "NOT_READY",
          confidence: "unknown",
          missingInformation: ["MISSING_LIFECYCLE_EVALUATION", "MISSING_PRIMARY_ENTITY"]
        },
        candidateAnalysis: {
          primaryCandidate: null,
          relatedCandidates: [],
          ignoredCandidates: [],
          confidence: "unknown"
        }
      };

      const first = createRecruitmentMigrationBlueprint(input);
      const second = createRecruitmentMigrationBlueprint(input);

      expect(first).toEqual(second);
      expect(first.prerequisites).toEqual(second.prerequisites);
      expect(first.risks).toEqual(second.risks);
    });

    test("produces identical results for identical input", () => {
      const input = completeBlueprintInput();

      const first = createRecruitmentMigrationBlueprint(input);
      const second = createRecruitmentMigrationBlueprint(input);

      expect(first).toEqual(second);
      expect(first.migrationSteps).not.toBe(second.migrationSteps);
    });
  });

  describe("immutability", () => {
    test("freezes entire blueprint object graph", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());

      assertAllFrozen(blueprint);
      expect(hasCircularReference(blueprint)).toBe(false);
      expect(isRecruitmentMigrationBlueprint(blueprint)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = completeBlueprintInput();
      const snapshot = JSON.stringify(input);

      createRecruitmentMigrationBlueprint(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());

      expect(Object.isFrozen(blueprint.prerequisites)).toBe(true);
      expect(Object.isFrozen(blueprint.risks)).toBe(true);
      expect(Object.isFrozen(blueprint.deferredItems)).toBe(true);
      expect(Object.isFrozen(blueprint.migrationSteps)).toBe(true);
      expect(Object.isFrozen(blueprint.migrationReadiness.reasons)).toBe(true);
      expect(() => {
        blueprint.prerequisites.push("NEW");
      }).toThrow();
    });
  });

  describe("summarizeRecruitmentMigrationBlueprint", () => {
    test("summarizes a valid blueprint", () => {
      const blueprint = createRecruitmentMigrationBlueprint(completeBlueprintInput());
      const summary = summarizeRecruitmentMigrationBlueprint(blueprint);

      expect(summary.valid).toBe(true);
      expect(summary.migrationStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(summary.readinessStatus).toBe(READINESS_STATUS.READY);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(summary.prerequisiteCount).toBe(0);
      expect(summary.migrationStepCount).toBe(8);
      expect(summary.architectureAnalysisAvailable).toBe(true);
      expect(summary.mappingPlanAvailable).toBe(true);
      expect(summary.candidateAnalysisAvailable).toBe(true);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 88");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createRecruitmentMigrationBlueprint/);
      expect(source).toMatch(/does not perform[\s\S]*migration/);
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

      expect(compatibilitySource).not.toMatch(/recruitmentMigrationBlueprint/);
      expect(pipelineSource).not.toMatch(/recruitmentMigrationBlueprint/);
    });

    test("metadata confirms no runtime integration, migration, or side effects", () => {
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.queriesDatabase).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.performsMigration).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.generatesSql).toBe(false);
      expect(RECRUITMENT_MIGRATION_BLUEPRINT_METADATA.mutatesInput).toBe(false);
    });
  });
});
