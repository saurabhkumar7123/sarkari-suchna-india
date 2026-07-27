"use strict";

/**
 * Phase 90 — Feature Flag Integration Design tests.
 * Complete contract, partial readiness, missing inputs,
 * rollout stage calculation, feature flag catalog,
 * dependency generation, rollback generation,
 * deterministic output, immutability,
 * invalid input, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
  FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY,
  ROLLOUT_STAGES,
  COMPATIBILITY_STATUS,
  MIGRATION_STAGES,
  READINESS_STATUS,
  CONFIDENCE_LEVELS,
  FLAG_DEFAULT_STATES,
  FEATURE_FLAG_IDS,
  FEATURE_FLAG_DEFINITIONS,
  ROLLOUT_SEQUENCE_PHASE_IDS,
  BASE_ROLLOUT_SEQUENCE_DEFINITIONS,
  DEPENDENCY_DEFINITIONS,
  ROLLBACK_PLAN_DEFINITIONS,
  FEATURE_FLAG_INTEGRATION_DESIGN_DESCRIPTOR,
  FEATURE_FLAG_INTEGRATION_DESIGN_METADATA,
  EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN,
  createFeatureFlagIntegrationDesign,
  isFeatureFlagIntegrationDesign,
  validateFeatureFlagIntegrationDesign,
  summarizeFeatureFlagIntegrationDesign
} = require("../server/lib/recruitment/featureFlagIntegrationDesign");

const { createBackwardCompatibilityContract } = require("../server/lib/recruitment/backwardCompatibilityContract");
const { createRecruitmentMigrationBlueprint } = require("../server/lib/recruitment/recruitmentMigrationBlueprint");
const { analyzeExistingRecruitmentArchitecture } = require("../server/lib/recruitment/existingRecruitmentArchitectureAnalyzer");
const { createRecruitmentMappingPlan } = require("../server/lib/recruitment/recruitmentMappingPlanner");
const { createRecruitmentMappingCandidateAnalysis } = require("../server/lib/recruitment/recruitmentMappingCandidateAnalyzer");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/featureFlagIntegrationDesign.js";
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

function completeDesignInput() {
  const blueprintInput = completeBlueprintInput();
  const compatibilityContract = createBackwardCompatibilityContract(blueprintInput);

  return {
    compatibilityContract,
    migrationBlueprint: blueprintInput.migrationBlueprint,
    mappingPlan: blueprintInput.mappingPlan
  };
}

describe("Phase 90 — featureFlagIntegrationDesign", () => {
  describe("exports", () => {
    test("exposes phase 90 constants and descriptor", () => {
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_PHASE).toBe(90);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY).toBe("feature_flag_integration_design");
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_DESCRIPTOR.entity).toBe(
        "feature_flag_integration_design"
      );
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_DESCRIPTOR.phase).toBe(90);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.readOnly).toBe(true);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.runtimeIntegration).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.createsFeatureFlags).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.readsEnvironmentVariables).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.performsMigration).toBe(false);
    });

    test("exposes rollout stages and catalog definitions", () => {
      expect(ROLLOUT_STAGES).toEqual({
        DESIGN_READY: "DESIGN_READY",
        DESIGN_INCOMPLETE: "DESIGN_INCOMPLETE",
        REVIEW_REQUIRED: "REVIEW_REQUIRED"
      });
      expect(FEATURE_FLAG_DEFINITIONS).toHaveLength(8);
      expect(BASE_ROLLOUT_SEQUENCE_DEFINITIONS).toHaveLength(9);
      expect(DEPENDENCY_DEFINITIONS).toHaveLength(6);
      expect(ROLLBACK_PLAN_DEFINITIONS).toHaveLength(10);
      expect(FEATURE_FLAG_DEFINITIONS[0].id).toBe(FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE);
    });
  });

  describe("invalid input", () => {
    test("returns empty design for null and non-object input", () => {
      expect(createFeatureFlagIntegrationDesign(null)).toEqual(
        EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN
      );
      expect(createFeatureFlagIntegrationDesign(undefined)).toEqual(
        EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN
      );
      expect(createFeatureFlagIntegrationDesign(false)).toEqual(
        EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN
      );
      expect(createFeatureFlagIntegrationDesign("invalid")).toEqual(
        EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN
      );
      expect(createFeatureFlagIntegrationDesign([])).toEqual(
        EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN
      );
    });

    test("tolerates malformed nested analysis objects", () => {
      const design = createFeatureFlagIntegrationDesign({
        compatibilityContract: "bad",
        migrationBlueprint: 42,
        mappingPlan: null
      });

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
      expect(design.metadata.compatibilityContractAvailable).toBe(false);
      expect(design.metadata.migrationBlueprintAvailable).toBe(false);
      expect(design.metadata.mappingPlanAvailable).toBe(false);
      expect(validateFeatureFlagIntegrationDesign(design).valid).toBe(true);
    });

    test("validateFeatureFlagIntegrationDesign rejects invalid shapes", () => {
      const validation = validateFeatureFlagIntegrationDesign({
        rolloutStage: "INVALID"
      });

      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_DESIGN_SHAPE");
    });

    test("summarizeFeatureFlagIntegrationDesign handles invalid design", () => {
      const summary = summarizeFeatureFlagIntegrationDesign(null);

      expect(summary.valid).toBe(false);
      expect(summary.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.UNKNOWN);
      expect(summary.readOnly).toBe(true);
      expect(summary.createsFeatureFlags).toBe(false);
      expect(summary.runtimeIntegration).toBe(false);
    });
  });

  describe("complete contract", () => {
    test("produces DESIGN_READY when compatibility contract and analyses are fully ready", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_READY);
      expect(design.metadata.compatibilityStatus).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
      expect(design.metadata.blueprintStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(design.metadata.blueprintReadinessStatus).toBe(READINESS_STATUS.READY);
      expect(design.metadata.mappingPlanStatus).toBe(READINESS_STATUS.READY);
      expect(design.metadata.prerequisiteCount).toBe(0);
      expect(design.metadata.unsatisfiedRequirementCount).toBe(0);
      expect(design.metadata.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(validateFeatureFlagIntegrationDesign(design).valid).toBe(true);
    });

    test("rollout sequence contains only base phases when design is ready", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.rolloutSequence).toHaveLength(9);
      expect(design.rolloutSequence.map((phase) => phase.id)).toEqual([
        ROLLOUT_SEQUENCE_PHASE_IDS.VERIFY_COMPATIBILITY_GUARANTEES,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_PIPELINE_FLAG,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_A,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_B,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_C,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_D,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_E,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_PERSISTENCE_FLAG,
        ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_REVIEW_QUEUE_FLAG
      ]);
    });

    test("metadata confirms all upstream analyses are available", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.metadata.compatibilityContractAvailable).toBe(true);
      expect(design.metadata.migrationBlueprintAvailable).toBe(true);
      expect(design.metadata.mappingPlanAvailable).toBe(true);
      expect(design.metadata.createReason).toBe("design_input");
    });
  });

  describe("partial readiness", () => {
    test("reports DESIGN_INCOMPLETE when blueprint and mapping are ready but contract is missing", () => {
      const blueprintInput = completeBlueprintInput();

      const design = createFeatureFlagIntegrationDesign({
        migrationBlueprint: blueprintInput.migrationBlueprint,
        mappingPlan: blueprintInput.mappingPlan
      });

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_INCOMPLETE);
      expect(design.metadata.compatibilityContractAvailable).toBe(false);
      expect(design.metadata.migrationBlueprintAvailable).toBe(true);
      expect(design.metadata.mappingPlanAvailable).toBe(true);
    });

    test("reports DESIGN_INCOMPLETE when only mapping plan is supplied", () => {
      const blueprintInput = completeBlueprintInput();

      const design = createFeatureFlagIntegrationDesign({
        mappingPlan: blueprintInput.mappingPlan
      });

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_INCOMPLETE);
      expect(design.metadata.mappingPlanAvailable).toBe(true);
      expect(design.metadata.migrationBlueprintAvailable).toBe(false);
      expect(design.metadata.compatibilityContractAvailable).toBe(false);
    });

    test("reports REVIEW_REQUIRED when compatibility contract requires review", () => {
      const architectureAnalysis = analyzeExistingRecruitmentArchitecture({
        entities: completeEntities()
      });
      const compatibilityContract = createBackwardCompatibilityContract({ architectureAnalysis });

      const design = createFeatureFlagIntegrationDesign({ compatibilityContract });

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
      expect(design.metadata.compatibilityStatus).toBe(COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE);
      expect(design.rolloutSequence[0].id).toBe(
        ROLLOUT_SEQUENCE_PHASE_IDS.RESOLVE_MIGRATION_PREREQUISITES
      );
      expect(design.rolloutSequence[1].id).toBe(
        ROLLOUT_SEQUENCE_PHASE_IDS.COMPLETE_MANUAL_REVIEW_GATE
      );
    });
  });

  describe("missing inputs", () => {
    test("empty object reports REVIEW_REQUIRED with prep and review phases", () => {
      const design = createFeatureFlagIntegrationDesign({});

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
      expect(design.metadata.compatibilityContractAvailable).toBe(false);
      expect(design.metadata.migrationBlueprintAvailable).toBe(false);
      expect(design.metadata.mappingPlanAvailable).toBe(false);
      expect(design.rolloutSequence).toHaveLength(11);
      expect(design.rolloutSequence[0].id).toBe(
        ROLLOUT_SEQUENCE_PHASE_IDS.RESOLVE_MIGRATION_PREREQUISITES
      );
      expect(design.rolloutSequence[1].id).toBe(
        ROLLOUT_SEQUENCE_PHASE_IDS.COMPLETE_MANUAL_REVIEW_GATE
      );
    });

    test("tolerates missing compatibility contract without throwing", () => {
      const blueprintInput = completeBlueprintInput();

      expect(() =>
        createFeatureFlagIntegrationDesign({
          migrationBlueprint: blueprintInput.migrationBlueprint
        })
      ).not.toThrow();
    });
  });

  describe("rollout stage calculation", () => {
    test("maps COMPATIBLE contract with ready blueprint and mapping to DESIGN_READY", () => {
      const input = completeDesignInput();
      const design = createFeatureFlagIntegrationDesign(input);

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_READY);
    });

    test("maps missing analyses to REVIEW_REQUIRED", () => {
      const design = createFeatureFlagIntegrationDesign(null);

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
    });

    test("maps blueprint with prerequisites to REVIEW_REQUIRED", () => {
      const blueprintInput = completeBlueprintInput();
      const blueprint = {
        ...blueprintInput.migrationBlueprint,
        prerequisites: ["IGNORED_CANDIDATES_REQUIRE_REVIEW"]
      };
      const compatibilityContract = createBackwardCompatibilityContract(blueprintInput);

      const design = createFeatureFlagIntegrationDesign({
        compatibilityContract,
        migrationBlueprint: blueprint,
        mappingPlan: blueprintInput.mappingPlan
      });

      expect(design.rolloutStage).toBe(ROLLOUT_STAGES.REVIEW_REQUIRED);
    });
  });

  describe("feature flag catalog", () => {
    test("includes all standard feature flags in order", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.featureFlags).toHaveLength(8);
      expect(design.featureFlags.map((flag) => flag.id)).toEqual([
        FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE,
        FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE,
        FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS,
        FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT,
        FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH,
        FEATURE_FLAG_IDS.LIFECYCLE_PUBLIC_LIFECYCLE,
        FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE,
        FEATURE_FLAG_IDS.REVIEW_QUEUE_ENQUEUE
      ]);
    });

    test("all feature flags default to disabled", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.featureFlags.every((flag) => flag.defaultState === FLAG_DEFAULT_STATES.DISABLED)).toBe(
        true
      );
    });

    test("includes full catalog even for empty input", () => {
      expect(EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN.featureFlags).toHaveLength(8);
      expect(EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN.featureFlags[0]).toMatchObject({
        id: FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE,
        defaultState: FLAG_DEFAULT_STATES.DISABLED
      });
    });

    test("each flag has id, name, description, and defaultState", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      for (let i = 0; i < design.featureFlags.length; i += 1) {
        const flag = design.featureFlags[i];
        expect(typeof flag.id).toBe("string");
        expect(typeof flag.name).toBe("string");
        expect(typeof flag.description).toBe("string");
        expect(flag.defaultState).toBe(FLAG_DEFAULT_STATES.DISABLED);
      }
    });
  });

  describe("dependency generation", () => {
    test("includes ordered flag dependencies", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.dependencies).toHaveLength(6);
      expect(design.dependencies.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(design.dependencies[0]).toMatchObject({
        flagId: FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS,
        dependsOn: [FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE]
      });
      expect(design.dependencies[5]).toMatchObject({
        flagId: FEATURE_FLAG_IDS.REVIEW_QUEUE_ENQUEUE,
        dependsOn: [FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE]
      });
    });

    test("dependencies are identical regardless of input readiness", () => {
      const complete = createFeatureFlagIntegrationDesign(completeDesignInput());
      const empty = createFeatureFlagIntegrationDesign({});

      expect(complete.dependencies).toEqual(empty.dependencies);
    });

    test("each dependency has order, flagId, dependsOn, and description", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      for (let i = 0; i < design.dependencies.length; i += 1) {
        const dependency = design.dependencies[i];
        expect(dependency.order).toBe(i + 1);
        expect(typeof dependency.flagId).toBe("string");
        expect(Array.isArray(dependency.dependsOn)).toBe(true);
        expect(typeof dependency.description).toBe("string");
      }
    });
  });

  describe("rollback generation", () => {
    test("includes ordered rollback actions in reverse enablement order", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(design.rollbackPlan).toHaveLength(10);
      expect(design.rollbackPlan.map((item) => item.order)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      ]);
      expect(design.rollbackPlan[0].id).toBe("DISABLE_REVIEW_QUEUE");
      expect(design.rollbackPlan[1].id).toBe("DISABLE_AUTOMATIC_PERSISTENCE");
      expect(design.rollbackPlan[7].id).toBe("DISABLE_PIPELINE_FLAG");
      expect(design.rollbackPlan[9].id).toBe("DOCUMENT_ROLLBACK_COMPLETION");
    });

    test("rollback plan is identical regardless of input readiness", () => {
      const complete = createFeatureFlagIntegrationDesign(completeDesignInput());
      const empty = createFeatureFlagIntegrationDesign(null);

      expect(complete.rollbackPlan).toEqual(empty.rollbackPlan);
    });

    test("each rollback action has order, id, and action description", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      for (let i = 0; i < design.rollbackPlan.length; i += 1) {
        const item = design.rollbackPlan[i];
        expect(item.order).toBe(i + 1);
        expect(typeof item.id).toBe("string");
        expect(typeof item.action).toBe("string");
        expect(item.action.length).toBeGreaterThan(0);
      }
    });
  });

  describe("deterministic output", () => {
    test("produces identical results for identical input", () => {
      const input = completeDesignInput();

      const first = createFeatureFlagIntegrationDesign(input);
      const second = createFeatureFlagIntegrationDesign(input);

      expect(first).toEqual(second);
      expect(first.featureFlags).not.toBe(second.featureFlags);
    });

    test("produces identical partial readiness results deterministically", () => {
      const blueprintInput = completeBlueprintInput();
      const input = { mappingPlan: blueprintInput.mappingPlan };

      const first = createFeatureFlagIntegrationDesign(input);
      const second = createFeatureFlagIntegrationDesign(input);

      expect(first).toEqual(second);
      expect(first.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_INCOMPLETE);
    });
  });

  describe("immutability", () => {
    test("freezes entire design object graph", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      assertAllFrozen(design);
      expect(hasCircularReference(design)).toBe(false);
      expect(isFeatureFlagIntegrationDesign(design)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = completeDesignInput();
      const snapshot = JSON.stringify(input);

      createFeatureFlagIntegrationDesign(input);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    test("returned arrays reject mutation", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());

      expect(Object.isFrozen(design.featureFlags)).toBe(true);
      expect(Object.isFrozen(design.rolloutSequence)).toBe(true);
      expect(Object.isFrozen(design.dependencies)).toBe(true);
      expect(Object.isFrozen(design.rollbackPlan)).toBe(true);
      expect(() => {
        design.featureFlags.push({
          id: "NEW",
          name: "x",
          description: "x",
          defaultState: FLAG_DEFAULT_STATES.DISABLED
        });
      }).toThrow();
    });
  });

  describe("summarizeFeatureFlagIntegrationDesign", () => {
    test("summarizes a valid design", () => {
      const design = createFeatureFlagIntegrationDesign(completeDesignInput());
      const summary = summarizeFeatureFlagIntegrationDesign(design);

      expect(summary.valid).toBe(true);
      expect(summary.rolloutStage).toBe(ROLLOUT_STAGES.DESIGN_READY);
      expect(summary.featureFlagCount).toBe(8);
      expect(summary.rolloutSequencePhaseCount).toBe(9);
      expect(summary.dependencyCount).toBe(6);
      expect(summary.rollbackActionCount).toBe(10);
      expect(summary.compatibilityContractAvailable).toBe(true);
      expect(summary.migrationBlueprintAvailable).toBe(true);
      expect(summary.mappingPlanAvailable).toBe(true);
      expect(summary.compatibilityStatus).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
      expect(summary.blueprintStage).toBe(MIGRATION_STAGES.READY_FOR_MIGRATION);
      expect(summary.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
      expect(summary.readOnly).toBe(true);
      expect(summary.createsFeatureFlags).toBe(false);
      expect(summary.runtimeIntegration).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares read-only pure library constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 90");
      expect(source).toContain("Read-only");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toMatch(/createFeatureFlagIntegrationDesign/);
      expect(source).toContain("create feature flags");
      expect(source).toMatch(/does not[\s\S]*runtime integration/);
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

      expect(compatibilitySource).not.toMatch(/featureFlagIntegrationDesign/);
      expect(pipelineSource).not.toMatch(/featureFlagIntegrationDesign/);
    });

    test("metadata confirms no runtime integration, flag creation, or side effects", () => {
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.runtimeIntegration).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.createsFeatureFlags).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.readsEnvironmentVariables).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.persistenceEnabled).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.sideEffects).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.queriesDatabase).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.performsMigration).toBe(false);
      expect(FEATURE_FLAG_INTEGRATION_DESIGN_METADATA.mutatesInput).toBe(false);
    });
  });
});
