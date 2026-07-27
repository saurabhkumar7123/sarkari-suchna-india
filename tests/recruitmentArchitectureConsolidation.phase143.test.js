"use strict";

/**
 * Phase 143 — Architecture Consolidation & Validation Suite tests.
 * Verifies deterministic output, invalid inputs, empty metadata, complete
 * architecture, consistency validation, dependency graph, stable ordering,
 * manifest generation, documentation registry, architecture maturity, and
 * runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_ARCHITECTURE_MANIFEST_PHASE,
  RECRUITMENT_ARCHITECTURE_MANIFEST_ENTITY,
  ARCHITECTURE_VERSION,
  ARCHITECTURE_MATURITY_LEVEL,
  ADVISORY_SECTION_ORDER,
  CANONICAL_ADVISORY_MODULES,
  ARCHITECTURE_LAYER_DEFINITIONS,
  RECRUITMENT_ARCHITECTURE_MANIFEST_DESCRIPTOR,
  RECRUITMENT_ARCHITECTURE_MANIFEST_METADATA,
  EXPECTED_RESULT_KEYS: MANIFEST_EXPECTED_KEYS,
  buildRecruitmentArchitectureManifest,
  isRecruitmentArchitectureManifest
} = require("../server/lib/recruitment/recruitmentArchitectureManifest");

const {
  RECRUITMENT_DEPENDENCY_MAP_PHASE,
  RECRUITMENT_DEPENDENCY_MAP_ENTITY,
  ADVISORY_FLOW_ORDER,
  MODULE_DEPENDENCY_GRAPH,
  RECRUITMENT_DEPENDENCY_MAP_DESCRIPTOR,
  RECRUITMENT_DEPENDENCY_MAP_METADATA,
  EXPECTED_RESULT_KEYS: DEPENDENCY_EXPECTED_KEYS,
  buildRecruitmentDependencyMap,
  isRecruitmentDependencyMap
} = require("../server/lib/recruitment/recruitmentDependencyMap");

const {
  RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
  RECRUITMENT_CONSISTENCY_VALIDATOR_ENTITY,
  VALIDATION_STATUS,
  FINDING_CATEGORY,
  REQUIRED_ADVISORY_SECTIONS,
  RECRUITMENT_CONSISTENCY_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_CONSISTENCY_VALIDATOR_METADATA,
  EXPECTED_RESULT_KEYS: VALIDATOR_EXPECTED_KEYS,
  validateRecruitmentArchitectureConsistency,
  isRecruitmentConsistencyValidationResult
} = require("../server/lib/recruitment/recruitmentConsistencyValidator");

const {
  RECRUITMENT_DOCUMENTATION_REGISTRY_PHASE,
  RECRUITMENT_DOCUMENTATION_REGISTRY_ENTITY,
  RUNTIME_IMPACT,
  CANONICAL_DOCUMENTATION_ENTRIES,
  RECRUITMENT_DOCUMENTATION_REGISTRY_DESCRIPTOR,
  RECRUITMENT_DOCUMENTATION_REGISTRY_METADATA,
  EXPECTED_RESULT_KEYS: REGISTRY_EXPECTED_KEYS,
  buildRecruitmentDocumentationRegistry,
  isRecruitmentDocumentationRegistry
} = require("../server/lib/recruitment/recruitmentDocumentationRegistry");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MANIFEST_MODULE = "server/lib/recruitment/recruitmentArchitectureManifest.js";
const DEPENDENCY_MODULE = "server/lib/recruitment/recruitmentDependencyMap.js";
const VALIDATOR_MODULE = "server/lib/recruitment/recruitmentConsistencyValidator.js";
const REGISTRY_MODULE = "server/lib/recruitment/recruitmentDocumentationRegistry.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_143_MODULES = [
  "recruitmentArchitectureManifest",
  "recruitmentDependencyMap",
  "recruitmentConsistencyValidator",
  "recruitmentDocumentationRegistry"
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
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

function buildCompleteArchitectureContext() {
  const manifest = buildRecruitmentArchitectureManifest({ recruitmentId: "ARCH_143" });
  const dependencyMap = buildRecruitmentDependencyMap({ recruitmentId: "ARCH_143" });
  const documentationRegistry = buildRecruitmentDocumentationRegistry({ recruitmentId: "ARCH_143" });
  const consistencyResult = validateRecruitmentArchitectureConsistency({
    recruitmentId: "ARCH_143",
    architectureManifest: manifest,
    dependencyMap
  });
  return { manifest, dependencyMap, documentationRegistry, consistencyResult };
}

describe("Phase 143 — recruitmentArchitectureManifest", () => {
  describe("module metadata", () => {
    test("exports phase 143 constants", () => {
      expect(RECRUITMENT_ARCHITECTURE_MANIFEST_PHASE).toBe(143);
      expect(RECRUITMENT_ARCHITECTURE_MANIFEST_ENTITY).toBe("recruitment_architecture_manifest");
      expect(RECRUITMENT_ARCHITECTURE_MANIFEST_DESCRIPTOR.phase).toBe(143);
      expect(RECRUITMENT_ARCHITECTURE_MANIFEST_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_ARCHITECTURE_MANIFEST_METADATA.executed).toBe(false);
    });

    test("canonical advisory modules include key phase 142 components", () => {
      const moduleIds = CANONICAL_ADVISORY_MODULES.map((m) => m.moduleId);
      expect(moduleIds).toContain("recruitmentWorkflowCapabilityRegistry");
      expect(moduleIds).toContain("recruitmentWorkflowIntegrationRolloutPlanner");
      expect(moduleIds).toContain("recruitmentWorkflowFeatureFlagStrategy");
      expect(moduleIds).toContain("observabilityPlanning");
      expect(moduleIds).toContain("diagnosticsPlanning");
      expect(moduleIds).toContain("recruitmentOperationalReadinessAssessment");
      expect(moduleIds).toContain("recruitmentGovernanceChecklist");
      expect(moduleIds).toContain("recruitmentRiskAssessmentAdvisor");
      expect(moduleIds).toContain("recruitmentReleaseReadinessAdvisor");
      expect(moduleIds).toContain("recruitmentOperationalSummaryBuilder");
    });
  });

  describe("empty and invalid inputs", () => {
    test("handles null input without throwing", () => {
      expect(() => buildRecruitmentArchitectureManifest(null)).not.toThrow();
      const result = buildRecruitmentArchitectureManifest(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });

    test("handles undefined input without throwing", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.recruitmentId).toBe("UNKNOWN");
    });

    test("handles non-object input without throwing", () => {
      const result = buildRecruitmentArchitectureManifest("invalid");
      expect(result.recruitmentId).toBe("UNKNOWN");
    });

    test("resolves recruitmentId from input", () => {
      const result = buildRecruitmentArchitectureManifest({ recruitmentId: "MANIFEST_001" });
      expect(result.recruitmentId).toBe("MANIFEST_001");
    });
  });

  describe("manifest generation", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(Object.keys(result).sort()).toEqual([...MANIFEST_EXPECTED_KEYS].sort());
      expect(isRecruitmentArchitectureManifest(result)).toBe(true);
    });

    test("includes architecture version and maturity level", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.architectureVersion).toBe(ARCHITECTURE_VERSION);
      expect(result.maturityLevel).toBe(ARCHITECTURE_MATURITY_LEVEL.ADVISORY_COMPLETE);
    });

    test("includes all architecture layers", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.architectureLayers).toEqual(ARCHITECTURE_LAYER_DEFINITIONS);
      expect(result.layerCount).toBe(ARCHITECTURE_LAYER_DEFINITIONS.length);
    });

    test("includes execution boundaries", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.executionBoundaries.length).toBeGreaterThan(0);
      expect(result.executionBoundaries.every((b) => b.isolated === true)).toBe(true);
    });

    test("generated metadata declares deterministic advisory output", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.generatedMetadata.deterministic).toBe(true);
      expect(result.generatedMetadata.generatedBy).toBe("phase_143");
      expect(result.generatedMetadata.runtimeImpact).toBe("none");
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "DET_143" };
      const first = buildRecruitmentArchitectureManifest(input);
      const second = buildRecruitmentArchitectureManifest(input);
      expect(first).toEqual(second);
    });

    test("does not mutate input", () => {
      const input = { recruitmentId: "IMMUTABLE_143" };
      const snapshot = JSON.parse(JSON.stringify(input));
      buildRecruitmentArchitectureManifest(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentArchitectureManifest());
    });
  });

  describe("stable ordering", () => {
    test("advisory modules maintain ascending order", () => {
      const result = buildRecruitmentArchitectureManifest();
      const orders = result.advisoryModules.map((m) => m.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
      }
    });

    test("advisory sections follow canonical order", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.advisorySections.map((s) => s.sectionId)).toEqual(ADVISORY_SECTION_ORDER);
      expect(result.advisorySections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test("module count matches canonical registry", () => {
      const result = buildRecruitmentArchitectureManifest();
      expect(result.moduleCount).toBe(CANONICAL_ADVISORY_MODULES.length);
    });
  });
});

describe("Phase 143 — recruitmentDependencyMap", () => {
  describe("module metadata", () => {
    test("exports phase 143 constants", () => {
      expect(RECRUITMENT_DEPENDENCY_MAP_PHASE).toBe(143);
      expect(RECRUITMENT_DEPENDENCY_MAP_ENTITY).toBe("recruitment_dependency_map");
      expect(RECRUITMENT_DEPENDENCY_MAP_DESCRIPTOR.phase).toBe(143);
      expect(RECRUITMENT_DEPENDENCY_MAP_METADATA.staticAnalysisOnly).toBe(true);
    });
  });

  describe("empty and invalid inputs", () => {
    test("handles null input without throwing", () => {
      expect(() => buildRecruitmentDependencyMap(null)).not.toThrow();
      expect(buildRecruitmentDependencyMap(null).recruitmentId).toBe("UNKNOWN");
    });

    test("handles undefined input without throwing", () => {
      const result = buildRecruitmentDependencyMap();
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("dependency graph", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentDependencyMap();
      expect(Object.keys(result).sort()).toEqual([...DEPENDENCY_EXPECTED_KEYS].sort());
      expect(isRecruitmentDependencyMap(result)).toBe(true);
    });

    test("module relationships cover all graph nodes", () => {
      const result = buildRecruitmentDependencyMap();
      expect(result.moduleCount).toBe(MODULE_DEPENDENCY_GRAPH.length);
      expect(result.moduleRelationships.length).toBe(MODULE_DEPENDENCY_GRAPH.length);
    });

    test("advisory flow follows canonical stage order", () => {
      const result = buildRecruitmentDependencyMap();
      expect(result.advisoryFlow.map((f) => f.stage)).toEqual(ADVISORY_FLOW_ORDER);
    });

    test("upstream and downstream summaries are populated", () => {
      const result = buildRecruitmentDependencyMap();
      expect(result.upstreamSummary.moduleCount).toBeGreaterThan(0);
      expect(result.downstreamSummary.moduleCount).toBeGreaterThan(0);
      expect(result.edgeCount).toBeGreaterThan(0);
    });

    test("phase 142 governance modules have upstream dependencies", () => {
      const result = buildRecruitmentDependencyMap();
      const governance = result.moduleRelationships.find(
        (r) => r.moduleId === "recruitmentGovernanceChecklist"
      );
      expect(governance).toBeDefined();
      expect(governance.dependsOn).toContain("recruitmentOperationalReadinessAssessment");
      expect(governance.dependsOn).toContain("observabilityPlanning");
    });

    test("runtime isolation boundaries declare no advisory imports", () => {
      const result = buildRecruitmentDependencyMap();
      expect(
        result.runtimeIsolationBoundaries.every((b) => b.advisoryImportsAllowed === false)
      ).toBe(true);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "DEP_143" };
      expect(buildRecruitmentDependencyMap(input)).toEqual(buildRecruitmentDependencyMap(input));
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentDependencyMap());
    });
  });
});

describe("Phase 143 — recruitmentConsistencyValidator", () => {
  describe("module metadata", () => {
    test("exports phase 143 constants", () => {
      expect(RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE).toBe(143);
      expect(RECRUITMENT_CONSISTENCY_VALIDATOR_ENTITY).toBe("recruitment_consistency_validator");
      expect(RECRUITMENT_CONSISTENCY_VALIDATOR_METADATA.autoCorrectionEnabled).toBe(false);
    });
  });

  describe("empty metadata", () => {
    test("returns UNKNOWN status for empty input", () => {
      const result = validateRecruitmentArchitectureConsistency(null);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.validatedModuleCount).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test("returns UNKNOWN status for empty object", () => {
      const result = validateRecruitmentArchitectureConsistency({});
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
      expect(isRecruitmentConsistencyValidationResult(result)).toBe(true);
    });
  });

  describe("complete architecture", () => {
    test("validates complete manifest and dependency map as VALID", () => {
      const { manifest, dependencyMap } = buildCompleteArchitectureContext();
      const result = validateRecruitmentArchitectureConsistency({
        recruitmentId: "ARCH_143",
        architectureManifest: manifest,
        dependencyMap
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.VALID);
      expect(result.findings).toHaveLength(0);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.validatedModuleCount).toBe(manifest.moduleCount);
    });

    test("returns all expected result keys", () => {
      const { manifest, dependencyMap } = buildCompleteArchitectureContext();
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: manifest,
        dependencyMap
      });
      expect(Object.keys(result).sort()).toEqual([...VALIDATOR_EXPECTED_KEYS].sort());
    });
  });

  describe("consistency validation", () => {
    test("detects duplicate module names", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const duplicatedModules = manifest.advisoryModules.concat([manifest.advisoryModules[0]]);
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: {
          ...manifest,
          advisoryModules: duplicatedModules
        }
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.findings.some((f) => f.category === FINDING_CATEGORY.DUPLICATE_MODULE)).toBe(true);
    });

    test("detects missing advisory sections", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: {
          ...manifest,
          advisorySections: []
        }
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.findings.some((f) => f.category === FINDING_CATEGORY.MISSING_SECTION)).toBe(true);
    });

    test("detects invalid maturity values", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: {
          ...manifest,
          maturityLevel: "NOT_A_REAL_MATURITY"
        }
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.findings.some((f) => f.category === FINDING_CATEGORY.INVALID_MATURITY)).toBe(true);
    });

    test("detects inconsistent confidence values", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: manifest,
        moduleDescriptors: [
          { moduleId: "testModule", confidence: 150 }
        ]
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(
        result.findings.some((f) => f.category === FINDING_CATEGORY.INCONSISTENT_CONFIDENCE)
      ).toBe(true);
    });

    test("detects ordering violations", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const reordered = manifest.advisoryModules.map((m, index) => ({
        ...m,
        order: manifest.advisoryModules.length - index
      }));
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: {
          ...manifest,
          advisoryModules: reordered
        }
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.findings.some((f) => f.category === FINDING_CATEGORY.ORDERING_VIOLATION)).toBe(
        true
      );
    });

    test("detects missing dependencies", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const result = validateRecruitmentArchitectureConsistency({
        architectureManifest: manifest,
        moduleRelationships: [
          {
            moduleId: "orphanModule",
            dependsOn: ["nonExistentUpstream"]
          }
        ]
      });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.findings.some((f) => f.category === FINDING_CATEGORY.MISSING_DEPENDENCY)).toBe(
        true
      );
    });

    test("required advisory sections match manifest sections", () => {
      const manifest = buildRecruitmentArchitectureManifest();
      const sectionIds = manifest.advisorySections.map((s) => s.sectionId);
      for (let i = 0; i < REQUIRED_ADVISORY_SECTIONS.length; i += 1) {
        expect(sectionIds).toContain(REQUIRED_ADVISORY_SECTIONS[i]);
      }
    });
  });

  describe("determinism and immutability", () => {
    test("does not mutate input", () => {
      const context = buildCompleteArchitectureContext();
      const input = {
        recruitmentId: "VAL_143",
        architectureManifest: context.manifest,
        dependencyMap: context.dependencyMap
      };
      const snapshot = JSON.parse(JSON.stringify(input));
      validateRecruitmentArchitectureConsistency(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      const { manifest, dependencyMap } = buildCompleteArchitectureContext();
      assertAllFrozen(
        validateRecruitmentArchitectureConsistency({
          architectureManifest: manifest,
          dependencyMap
        })
      );
    });
  });
});

describe("Phase 143 — recruitmentDocumentationRegistry", () => {
  describe("module metadata", () => {
    test("exports phase 143 constants", () => {
      expect(RECRUITMENT_DOCUMENTATION_REGISTRY_PHASE).toBe(143);
      expect(RECRUITMENT_DOCUMENTATION_REGISTRY_ENTITY).toBe("recruitment_documentation_registry");
      expect(RECRUITMENT_DOCUMENTATION_REGISTRY_METADATA.documentationRegistryOnly).toBe(true);
    });
  });

  describe("documentation registry", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentDocumentationRegistry();
      expect(Object.keys(result).sort()).toEqual([...REGISTRY_EXPECTED_KEYS].sort());
      expect(isRecruitmentDocumentationRegistry(result)).toBe(true);
    });

    test("indexes every advisory module with required fields", () => {
      const result = buildRecruitmentDocumentationRegistry();
      expect(result.entryCount).toBe(CANONICAL_DOCUMENTATION_ENTRIES.length);
      for (let i = 0; i < result.entries.length; i += 1) {
        const entry = result.entries[i];
        expect(entry.moduleName).toBeTruthy();
        expect(entry.purpose).toBeTruthy();
        expect(entry.advisoryScope).toBeTruthy();
        expect(Array.isArray(entry.expectedInputs)).toBe(true);
        expect(Array.isArray(entry.expectedOutputs)).toBe(true);
        expect(entry.runtimeImpact).toBe(RUNTIME_IMPACT.NONE);
      }
    });

    test("runtime impact summary declares zero runtime impact for all modules", () => {
      const result = buildRecruitmentDocumentationRegistry();
      expect(result.runtimeImpactSummary.runtimeImpact).toBe(RUNTIME_IMPACT.NONE);
      expect(result.runtimeImpactSummary.modulesWithRuntimeImpact).toBe(0);
      expect(result.runtimeImpactSummary.advisoryOnlyModules).toBe(result.entryCount);
    });

    test("includes key advisory modules from user objective list", () => {
      const names = buildRecruitmentDocumentationRegistry().entries.map((e) => e.moduleName);
      expect(names).toContain("recruitmentWorkflowCapabilityRegistry");
      expect(names).toContain("recruitmentWorkflowRuntimeAdoptionBlueprint");
      expect(names).toContain("recruitmentWorkflowIntegrationRolloutPlanner");
      expect(names).toContain("recruitmentWorkflowFeatureFlagStrategy");
      expect(names).toContain("observabilityPlanning");
      expect(names).toContain("diagnosticsPlanning");
      expect(names).toContain("recruitmentOperationalReadinessAssessment");
      expect(names).toContain("recruitmentGovernanceChecklist");
      expect(names).toContain("recruitmentRiskAssessmentAdvisor");
      expect(names).toContain("recruitmentReleaseReadinessAdvisor");
      expect(names).toContain("recruitmentOperationalSummaryBuilder");
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "DOC_143" };
      expect(buildRecruitmentDocumentationRegistry(input)).toEqual(
        buildRecruitmentDocumentationRegistry(input)
      );
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentDocumentationRegistry());
    });
  });
});

describe("Phase 143 — architecture maturity", () => {
  test("manifest declares ADVISORY_COMPLETE maturity", () => {
    const manifest = buildRecruitmentArchitectureManifest();
    expect(manifest.maturityLevel).toBe(ARCHITECTURE_MATURITY_LEVEL.ADVISORY_COMPLETE);
  });

  test("complete architecture passes consistency validation with high confidence", () => {
    const { consistencyResult } = buildCompleteArchitectureContext();
    expect(consistencyResult.validationStatus).toBe(VALIDATION_STATUS.VALID);
    expect(consistencyResult.confidence).toBe(100);
  });

  test("manifest module count aligns with documentation registry entry count", () => {
    const manifest = buildRecruitmentArchitectureManifest();
    const registry = buildRecruitmentDocumentationRegistry();
    expect(manifest.moduleCount).toBe(registry.entryCount);
  });
});

describe("Phase 143 — architecture boundaries", () => {
  const modulePaths = [MANIFEST_MODULE, DEPENDENCY_MODULE, VALIDATOR_MODULE, REGISTRY_MODULE];

  test.each(modulePaths)("module %s declares no persistence", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("no persistence");
    expect(source).toContain("persistenceEnabled: false");
    expect(source).not.toMatch(/INSERT INTO/i);
    expect(source).not.toMatch(/UPDATE\s+/i);
  });

  test.each(modulePaths)("module %s declares advisory-only contract", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("Advisory Only");
    expect(source).toContain("advisoryOnly: true");
    expect(source).toContain("executed: false");
    expect(source).toContain("flagExecutionEnabled: false");
    expect(source).toContain("rolloutActivationEnabled: false");
  });

  test.each(modulePaths)("module %s has no runtime require statements", (modulePath) => {
    const source = read(modulePath);
    expect(source).not.toMatch(/require\(/);
  });

  test("orchestrator behavior remains unchanged and independent from phase 143", () => {
    const orchestration = orchestrateRecruitmentWorkflow({
      recruitmentId: 143,
      eventType: "notification"
    });

    expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
    expect(orchestration.advisory).toBe(true);
    expect(orchestration.executed).toBe(false);
    expect(orchestration).not.toHaveProperty("architectureVersion");
    expect(orchestration).not.toHaveProperty("validationStatus");
    expect(orchestration).not.toHaveProperty("entryCount");
  });

  test.each(PHASE_143_MODULES)("phase 143 module %s is not imported by orchestrator", (moduleName) => {
    expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_143_MODULES)("phase 143 module %s is not imported by coordinator", (moduleName) => {
    expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_143_MODULES)("phase 143 module %s is not imported by advisory gateway", (moduleName) => {
    expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_143_MODULES)("phase 143 module %s is not imported by recruitment pipeline", (moduleName) => {
    expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_143_MODULES)("phase 143 module %s is not imported by site worker", (moduleName) => {
    expect(read(WORKER_MODULE)).not.toContain(moduleName);
  });

  test("all phase 143 outputs declare executed false", () => {
    const context = buildCompleteArchitectureContext();
    expect(context.manifest.advisoryMetadata.executed).toBe(false);
    expect(context.dependencyMap.advisoryMetadata.executed).toBe(false);
    expect(context.consistencyResult.advisoryMetadata.executed).toBe(false);
    expect(context.documentationRegistry.advisoryMetadata.executed).toBe(false);
  });

  test("metadata source phases include 142", () => {
    expect(RECRUITMENT_ARCHITECTURE_MANIFEST_METADATA.sourcePhases).toContain(142);
    expect(RECRUITMENT_DEPENDENCY_MAP_METADATA.sourcePhases).toContain(142);
    expect(RECRUITMENT_DOCUMENTATION_REGISTRY_METADATA.sourcePhases).toContain(142);
  });
});
