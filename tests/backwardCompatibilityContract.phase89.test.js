"use strict";

/**
 * Phase 89 — Backward Compatibility Integration Contract tests.
 * Complete migration blueprint, partial readiness, missing inputs,
 * compatibility status calculation, implementation requirements,
 * validation checklist, deterministic output, immutability,
 * invalid input, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
  BACKWARD_COMPATIBILITY_CONTRACT_ENTITY,
  COMPATIBILITY_STATUS,
  MIGRATION_STAGES,
  READINESS_STATUS,
  CONFIDENCE_LEVELS,
  PRESERVED_BEHAVIOR_IDS,
  MIGRATION_CONSTRAINT_IDS,
  IMPLEMENTATION_REQUIREMENT_IDS,
  VALIDATION_CHECKLIST_IDS,
  PRESERVED_BEHAVIOR_DEFINITIONS,
  MIGRATION_CONSTRAINT_DEFINITIONS,
  IMPLEMENTATION_REQUIREMENT_DEFINITIONS,
  VALIDATION_CHECKLIST_DEFINITIONS,
  BACKWARD_COMPATIBILITY_CONTRACT_DESCRIPTOR,
  BACKWARD_COMPATIBILITY_CONTRACT_METADATA,
  EMPTY_BACKWARD_COMPATIBILITY_CONTRACT,
  createBackwardCompatibilityContract,
  isBackwardCompatibilityContract,
  validateBackwardCompatibilityContract,
  summarizeBackwardCompatibilityContract
} = require("../server/lib/recruitment/backwardCompatibilityContract");

const { createRecruitmentMigrationBlueprint } = require("../server/lib/recruitment/recruitmentMigrationBlueprint");
const { analyzeExistingRecruitmentArchitecture } = require("../server/lib/recruitment/existingRecruitmentArchitectureAnalyzer");
const { createRecruitmentMappingPlan } = require("../server/lib/recruitment/recruitmentMappingPlanner");
const { createRecruitmentMappingCandidateAnalysis } = require("../server/lib/recruitment/recruitmentMappingCandidateAnalyzer");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/backwardCompatibilityContract.js";
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

function completeBlueprintInput() {
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

  const migrationBlueprint = createRecruitmentMigrationBlueprint({
    architectureAnalysis,
    mappingPlan,
    candidateAnalysis
  });

  return {
    migrationBlueprint,
    architectureAnalysis,
    mappingPlan
  };
}

describe("Phase 89 — backwardCompatibilityContract", () => {
  describe("exports", () => {
    test("exposes phase 89 constants and descriptor", () => {
      expect(BACKWARD_COMPATIBILITY_CONTRACT_PHASE).toBe(89);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_ENTITY).toBe("backward_compatibility_contract");
      expect(BACKWARD_COMPATIBILITY_CONTRACT_DESCRIPTOR.entity).toBe(
        "backward_compatibility_contract"
      );
      expect(BACKWARD_COMPATIBILITY_CONTRACT_DESCRIPTOR.phase).toBe(89);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.readOnly).toBe(true);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.runtimeIntegration).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.performsMigration).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.generatesSql).toBe(false);
    });

    test("exposes compatibility statuses and catalog definitions", () => {
      expect(COMPATIBILITY_STATUS).toEqual({
        COMPATIBLE: "COMPATIBLE",
        PARTIALLY_COMPATIBLE: "PARTIALLY_COMPATIBLE",
        REVIEW_REQUIRED: "REVIEW_REQUIRED"
      });
      expect(PRESERVED_BEHAVIOR_DEFINITIONS).toHaveLength(10);
      expect(MIGRATION_CONSTRAINT_DEFINITIONS).toHaveLength(8);
      expect(IMPLEMENTATION_REQUIREMENT_DEFINITIONS).toHaveLength(11);
      expect(VALIDATION_CHECKLIST_DEFINITIONS).toHaveLength(10);
      expect(PRESERVED_BEHAVIOR_DEFINITIONS[0].id).toBe(
        PRESERVED_BEHAVIOR_IDS.PAGE_URL_RESOLUTION
      );
    });
  });

  describe("invalid input", () => {
    test("returns empty contract for null and non-object input", () => {
      expect(createBackwardCompatibilityContract(null)).toEqual(
        EMPTY_BACKWARD_COMPATIBILITY_CONTRACT
      );
      expect(createBackwardCompatibilityContract(undefined)).toEqual(
        EMPTY_BACKWARD_COMPATIBILITY_CONTRACT
      );
      expect(createBackwardCompatibilityContract(false)).toEqual(
        EMPTY_BACKWARD_COMPATIBILITY_CONTRACT
      );
      expect(createBackwardCompatibilityContract("invalid")).toEqual(
        EMPTY_BACKWARD_COMPATIBILITY_CONTRACT
      );
      expect(createBackwardCompatibilityContract([])).toEqual(
        EMPTY_BACKWARD_COMPATIBILITY_CONTRACT
      );
    });

    test("tolerates malformed nested analysis objects", () => {
      const contract = createBackwardCompatibilityContract({
        migrationBlueprint: "bad",
        architectureAnalysis: 42,
        mappingPlan: null
      });

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.REVIEW_REQUIRED);
      expect(contract.metadata.migrationBlueprintAvailable).toBe(false);
      expect(contract.metadata.architectureAnalysisAvailable).toBe(false);
      expect(contract.metadata.mappingPlanAvailable).toBe(false);
      expect(validateBackwardCompatibilityContract(contract).valid).toBe(true);
    });

    test("validateBackwardCompatibilityContract rejects invalid shapes", () => {
      const validation = validateBackwardCompatibilityContract({
        compatibilityStatus: "INVALID"
      });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_CONTRACT_SHAPE");
    });

    test("summarizeBackwardCompatibilityContract handles invalid contract", () => {
      const summary = summarizeBackwardCompatibilityContract(null);

      expect(summary.valid).toBe(false);
      expect(summary.compatibilityStatus).toBe(COMPATIBILITY_STATUS.REVIEW_REQUIRED);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("complete migration blueprint", () => {
    test("produces COMPATIBLE when blueprint and analyses are fully ready", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
      expect(contract.metadata.blueprintStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(contract.metadata.blueprintReadinessStatus).toBe(READINESS_STATUS.READY);
      expect(contract.metadata.prerequisiteCount).toBe(0);
      expect(contract.metadata.unsatisfiedRequirementCount).toBe(0);
      expect(contract.metadata.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(validateBackwardCompatibilityContract(contract).valid).toBe(true);
    });

    test("includes all standard preserved behaviors in order", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.preservedBehaviors).toHaveLength(10);
      expect(contract.preservedBehaviors.map((item) => item.order)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      ]);
      expect(contract.preservedBehaviors[0]).toMatchObject({
        id: PRESERVED_BEHAVIOR_IDS.PAGE_URL_RESOLUTION,
        description: expect.stringContaining("URLs")
      });
      expect(contract.preservedBehaviors[5]).toMatchObject({
        id: PRESERVED_BEHAVIOR_IDS.COMPATIBILITY_LAYER_ADDITIVE
      });
    });

    test("includes all standard migration constraints in order", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.migrationConstraints).toHaveLength(8);
      expect(contract.migrationConstraints.map((item) => item.id)).toEqual([
        MIGRATION_CONSTRAINT_IDS.NO_SCHEMA_MIGRATION_WITHOUT_BLUEPRINT,
        MIGRATION_CONSTRAINT_IDS.NO_RUNTIME_PERSISTENCE_WITHOUT_CHECKLIST,
        MIGRATION_CONSTRAINT_IDS.FEATURE_FLAG_REQUIRED,
        MIGRATION_CONSTRAINT_IDS.NO_ROUTE_CHANGES_WITHOUT_REDIRECT_PLAN,
        MIGRATION_CONSTRAINT_IDS.NO_PIPELINE_BEHAVIOR_CHANGE,
        MIGRATION_CONSTRAINT_IDS.NO_MONITORING_REGRESSION,
        MIGRATION_CONSTRAINT_IDS.PHASED_ROLLOUT_ONLY,
        MIGRATION_CONSTRAINT_IDS.PRESERVE_EXISTING_ENTITY_RESOLUTION
      ]);
    });
  });

  describe("partial readiness", () => {
    test("reports PARTIALLY_COMPATIBLE when only architecture analysis is supplied", () => {
      const architectureAnalysis = analyzeExistingRecruitmentArchitecture({
        entities: completeEntities()
      });

      const contract = createBackwardCompatibilityContract({ architectureAnalysis });

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
      expect(contract.metadata.architectureAnalysisAvailable).toBe(true);
      expect(contract.metadata.mappingPlanAvailable).toBe(false);
      expect(contract.metadata.migrationBlueprintAvailable).toBe(false);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.ARCHITECTURE_ANALYSIS_READY
        ).satisfied
      ).toBe(true);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.MAPPING_PLAN_READY
        ).satisfied
      ).toBe(false);
    });

    test("reports PARTIALLY_COMPATIBLE when blueprint is in PREPARATION stage", () => {
      const architectureAnalysis = analyzeExistingRecruitmentArchitecture({
        entities: completeEntities()
      });
      const mappingPlan = createRecruitmentMappingPlan({
        entities: {
          primaryEntity: { id: "primary-1", entityType: "recruitment" },
          relatedEntities: []
        },
        relationships: []
      });
      const migrationBlueprint = createRecruitmentMigrationBlueprint({
        architectureAnalysis,
        mappingPlan,
        candidateAnalysis: createRecruitmentMappingCandidateAnalysis({
          entities: completeEntities()
        })
      });

      const contract = createBackwardCompatibilityContract({
        migrationBlueprint,
        architectureAnalysis,
        mappingPlan
      });

      expect(migrationBlueprint.migrationStage).toBe(MIGRATION_STAGES.PREPARATION);
      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
      expect(contract.metadata.blueprintStage).toBe(MIGRATION_STAGES.PREPARATION);
    });
  });

  describe("missing inputs", () => {
    test("flags missing migration blueprint in metadata", () => {
      const input = completeBlueprintInput();
      delete input.migrationBlueprint;

      const contract = createBackwardCompatibilityContract(input);

      expect(contract.metadata.migrationBlueprintAvailable).toBe(false);
      expect(contract.compatibilityStatus).not.toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test("flags missing architecture analysis in metadata", () => {
      const input = completeBlueprintInput();
      delete input.architectureAnalysis;

      const contract = createBackwardCompatibilityContract(input);

      expect(contract.metadata.architectureAnalysisAvailable).toBe(false);
      expect(contract.compatibilityStatus).not.toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test("flags missing mapping plan in metadata", () => {
      const input = completeBlueprintInput();
      delete input.mappingPlan;

      const contract = createBackwardCompatibilityContract(input);

      expect(contract.metadata.mappingPlanAvailable).toBe(false);
      expect(contract.compatibilityStatus).not.toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test("returns REVIEW_REQUIRED for completely empty input object", () => {
      const contract = createBackwardCompatibilityContract({});

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.REVIEW_REQUIRED);
      expect(contract.metadata.migrationBlueprintAvailable).toBe(false);
      expect(contract.metadata.architectureAnalysisAvailable).toBe(false);
      expect(contract.metadata.mappingPlanAvailable).toBe(false);
    });
  });

  describe("compatibility status calculation", () => {
    test("returns REVIEW_REQUIRED when blueprint requires review", () => {
      const contract = createBackwardCompatibilityContract({
        migrationBlueprint: {
          migrationStage: MIGRATION_STAGES.REQUIRES_REVIEW,
          migrationReadiness: {
            status: READINESS_STATUS.PARTIAL,
            confidence: CONFIDENCE_LEVELS.MEDIUM,
            reasons: ["MANUAL_REVIEW_REQUIRED"]
          },
          prerequisites: ["IGNORED_CANDIDATES_REQUIRE_REVIEW"],
          risks: [{ id: "IGNORED_CANDIDATES", description: "review needed" }],
          deferredItems: [{ id: "LIVE_MIGRATION_EXECUTION", description: "deferred" }]
        },
        architectureAnalysis: {
          migrationReadiness: { status: READINESS_STATUS.READY, confidence: CONFIDENCE_LEVELS.HIGH }
        },
        mappingPlan: {
          mappingStatus: READINESS_STATUS.READY,
          confidence: CONFIDENCE_LEVELS.HIGH
        }
      });

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.REVIEW_REQUIRED);
    });

    test("returns REVIEW_REQUIRED when blueprint is ready but has prerequisites", () => {
      const contract = createBackwardCompatibilityContract({
        migrationBlueprint: {
          migrationStage: MIGRATION_STAGES.READY_FOR_MIGRATION,
          migrationReadiness: {
            status: READINESS_STATUS.READY,
            confidence: CONFIDENCE_LEVELS.HIGH,
            reasons: []
          },
          prerequisites: ["MISSING_VALIDATION_RESULT"],
          risks: [],
          deferredItems: []
        },
        architectureAnalysis: {
          migrationReadiness: { status: READINESS_STATUS.READY, confidence: CONFIDENCE_LEVELS.HIGH },
          analysisSummary: { unsupportedCount: 0 }
        },
        mappingPlan: {
          mappingStatus: READINESS_STATUS.READY,
          confidence: CONFIDENCE_LEVELS.HIGH,
          metadata: { validationAvailable: true, validationValid: true }
        }
      });

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.REVIEW_REQUIRED);
    });

    test("returns PARTIALLY_COMPATIBLE when analyses are partial", () => {
      const contract = createBackwardCompatibilityContract({
        migrationBlueprint: {
          migrationStage: MIGRATION_STAGES.PREPARATION,
          migrationReadiness: {
            status: READINESS_STATUS.PARTIAL,
            confidence: CONFIDENCE_LEVELS.MEDIUM,
            reasons: []
          },
          prerequisites: ["MISSING_CANDIDATE_ANALYSIS"],
          risks: [],
          deferredItems: []
        },
        architectureAnalysis: {
          migrationReadiness: { status: READINESS_STATUS.PARTIAL, confidence: CONFIDENCE_LEVELS.MEDIUM }
        },
        mappingPlan: {
          mappingStatus: READINESS_STATUS.PARTIAL,
          confidence: CONFIDENCE_LEVELS.MEDIUM
        }
      });

      expect(contract.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
    });
  });

  describe("implementation requirements", () => {
    test("marks all requirements satisfied for complete ready input", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      const unsatisfied = contract.implementationRequirements.filter(
        (item) => item.satisfied !== true
      );

      expect(unsatisfied).toEqual([]);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.BLUEPRINT_READY_FOR_MIGRATION
        ).satisfied
      ).toBe(true);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.ALL_PREREQUISITES_RESOLVED
        ).satisfied
      ).toBe(true);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.RELATIONSHIP_VALIDATION_PASSED
        ).satisfied
      ).toBe(true);
    });

    test("marks validation requirement unsatisfied when validation fails", () => {
      const contract = createBackwardCompatibilityContract({
        migrationBlueprint: {
          migrationStage: MIGRATION_STAGES.PREPARATION,
          migrationReadiness: { status: READINESS_STATUS.PARTIAL, confidence: CONFIDENCE_LEVELS.LOW },
          prerequisites: ["VALIDATION_GAPS"],
          risks: [],
          deferredItems: []
        },
        architectureAnalysis: {
          migrationReadiness: { status: READINESS_STATUS.PARTIAL, confidence: CONFIDENCE_LEVELS.LOW },
          analysisSummary: { unsupportedCount: 1 }
        },
        mappingPlan: {
          mappingStatus: READINESS_STATUS.PARTIAL,
          confidence: CONFIDENCE_LEVELS.LOW,
          metadata: { validationAvailable: true, validationValid: false }
        }
      });

      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.RELATIONSHIP_VALIDATION_PASSED
        ).satisfied
      ).toBe(false);
      expect(
        contract.implementationRequirements.find(
          (item) => item.id === IMPLEMENTATION_REQUIREMENT_IDS.UNSUPPORTED_ENTITIES_RESOLVED
        ).satisfied
      ).toBe(false);
    });

    test("implementation requirements are ordered sequentially", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.implementationRequirements.map((item) => item.order)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
      ]);
      expect(contract.implementationRequirements[0].id).toBe(
        IMPLEMENTATION_REQUIREMENT_IDS.BLUEPRINT_READY_FOR_MIGRATION
      );
    });
  });

  describe("validation checklist", () => {
    test("includes all standard checklist items in order", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.validationChecklist).toHaveLength(10);
      expect(contract.validationChecklist.map((item) => item.id)).toEqual([
        VALIDATION_CHECKLIST_IDS.VERIFY_PAGE_URLS_UNCHANGED,
        VALIDATION_CHECKLIST_IDS.VERIFY_UPDATE_DETECTION_UNCHANGED,
        VALIDATION_CHECKLIST_IDS.VERIFY_WORKER_PIPELINE_UNCHANGED,
        VALIDATION_CHECKLIST_IDS.VERIFY_COMPATIBILITY_LAYER_ADDITIVE,
        VALIDATION_CHECKLIST_IDS.VERIFY_NO_UNAPPROVED_PERSISTENCE,
        VALIDATION_CHECKLIST_IDS.VERIFY_FEATURE_FLAGS_DEFAULT_OFF,
        VALIDATION_CHECKLIST_IDS.VERIFY_BLUEPRINT_PREREQUISITES_MET,
        VALIDATION_CHECKLIST_IDS.VERIFY_MAPPING_PLAN_VALIDATION,
        VALIDATION_CHECKLIST_IDS.VERIFY_ROLLOUT_DEFERRED_ITEMS,
        VALIDATION_CHECKLIST_IDS.VERIFY_MONITORING_BASELINE
      ]);
      expect(contract.validationChecklist.every((item) => item.required === true)).toBe(true);
    });

    test("includes checklist even for empty input", () => {
      expect(EMPTY_BACKWARD_COMPATIBILITY_CONTRACT.validationChecklist).toHaveLength(10);
      expect(EMPTY_BACKWARD_COMPATIBILITY_CONTRACT.validationChecklist[0].required).toBe(true);
    });

    test("validation checklist items have sequential order", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(contract.validationChecklist.map((item) => item.order)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      ]);
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const input = completeBlueprintInput();

      const first = createBackwardCompatibilityContract(input);
      const second = createBackwardCompatibilityContract(input);

      expect(first).toEqual(second);
      expect(first.preservedBehaviors).not.toBe(second.preservedBehaviors);
    });

    test("produces identical partial readiness results deterministically", () => {
      const input = {
        architectureAnalysis: analyzeExistingRecruitmentArchitecture({
          entities: completeEntities()
        })
      };

      const first = createBackwardCompatibilityContract(input);
      const second = createBackwardCompatibilityContract(input);

      expect(first).toEqual(second);
      expect(first.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
    });
  });

  describe("immutability", () => {
    test("freezes entire contract object graph", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      assertAllFrozen(contract);
      expect(hasCircularReference(contract)).toBe(false);
      expect(isBackwardCompatibilityContract(contract)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = completeBlueprintInput();
      const snapshot = JSON.stringify(input);

      createBackwardCompatibilityContract(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());

      expect(Object.isFrozen(contract.preservedBehaviors)).toBe(true);
      expect(Object.isFrozen(contract.migrationConstraints)).toBe(true);
      expect(Object.isFrozen(contract.implementationRequirements)).toBe(true);
      expect(Object.isFrozen(contract.validationChecklist)).toBe(true);
      expect(() => {
        contract.preservedBehaviors.push({ order: 99, id: "NEW", description: "x" });
      }).toThrow();
    });
  });

  describe("summarizeBackwardCompatibilityContract", () => {
    test("summarizes a valid contract", () => {
      const contract = createBackwardCompatibilityContract(completeBlueprintInput());
      const summary = summarizeBackwardCompatibilityContract(contract);

      expect(summary.valid).toBe(true);
      expect(summary.compatibilityStatus).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
      expect(summary.preservedBehaviorCount).toBe(10);
      expect(summary.migrationConstraintCount).toBe(8);
      expect(summary.implementationRequirementCount).toBe(11);
      expect(summary.validationChecklistCount).toBe(10);
      expect(summary.satisfiedRequirementCount).toBe(11);
      expect(summary.unsatisfiedRequirementCount).toBe(0);
      expect(summary.migrationBlueprintAvailable).toBe(true);
      expect(summary.architectureAnalysisAvailable).toBe(true);
      expect(summary.mappingPlanAvailable).toBe(true);
      expect(summary.blueprintStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(summary.readOnly).toBe(true);
      expect(summary.performsMigration).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 89");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createBackwardCompatibilityContract/);
      expect(source).toMatch(/does not perform[\s\S]*runtime integration/);
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

      expect(compatibilitySource).not.toMatch(/backwardCompatibilityContract/);
      expect(pipelineSource).not.toMatch(/backwardCompatibilityContract/);
    });

    test("metadata confirms no runtime integration, migration, or side effects", () => {
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.runtimeIntegration).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.persistenceEnabled).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.sideEffects).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.queriesDatabase).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.performsMigration).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.generatesSql).toBe(false);
      expect(BACKWARD_COMPATIBILITY_CONTRACT_METADATA.mutatesInput).toBe(false);
    });
  });
});
