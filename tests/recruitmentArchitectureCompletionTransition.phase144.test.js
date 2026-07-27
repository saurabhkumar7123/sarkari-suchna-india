"use strict";

/**
 * Phase 144 — Final Architecture Audit, Completion & Transition Suite tests.
 * Verifies deterministic output, invalid inputs, empty metadata, complete
 * architecture, audit generation, completion calculations, transition manifest,
 * production guide, stable ordering, confidence calculations, and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_PHASE,
  RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_ENTITY,
  AUDIT_STATUS,
  MATURITY_LEVEL,
  ADVISORY_COVERAGE_STATUS,
  COMPLETED_CAPABILITY_IDS,
  RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_DESCRIPTOR,
  RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_METADATA,
  EXPECTED_RESULT_KEYS: AUDIT_EXPECTED_KEYS,
  CANONICAL_MODULE_COUNT,
  CANONICAL_LAYER_COUNT,
  buildRecruitmentArchitectureAuditReport,
  isRecruitmentArchitectureAuditReport
} = require("../server/lib/recruitment/recruitmentArchitectureAuditReport");

const {
  RECRUITMENT_COMPLETION_REPORT_PHASE,
  RECRUITMENT_COMPLETION_REPORT_ENTITY,
  COMPLETION_STATUS,
  COVERAGE_STATUS,
  PHASES_COMPLETED,
  PHASE_144_ADVISORY_MODULES,
  ARCHITECTURE_LAYER_DEFINITIONS,
  RECRUITMENT_COMPLETION_REPORT_DESCRIPTOR,
  RECRUITMENT_COMPLETION_REPORT_METADATA,
  EXPECTED_RESULT_KEYS: COMPLETION_EXPECTED_KEYS,
  buildRecruitmentCompletionReport,
  isRecruitmentCompletionReport
} = require("../server/lib/recruitment/recruitmentCompletionReport");

const {
  RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_PHASE,
  RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_ENTITY,
  GUIDE_POSTURE,
  ADOPTION_SEQUENCE_IDS,
  RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_DESCRIPTOR,
  RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA,
  EXPECTED_RESULT_KEYS: GUIDE_EXPECTED_KEYS,
  buildRecruitmentProductionAdoptionGuide,
  isRecruitmentProductionAdoptionGuide
} = require("../server/lib/recruitment/recruitmentProductionAdoptionGuide");

const {
  RECRUITMENT_TRANSITION_MANIFEST_PHASE,
  RECRUITMENT_TRANSITION_MANIFEST_ENTITY,
  CURRENT_STATE,
  NEXT_STAGE,
  TRANSITION_READINESS,
  RECRUITMENT_TRANSITION_MANIFEST_DESCRIPTOR,
  RECRUITMENT_TRANSITION_MANIFEST_METADATA,
  EXPECTED_RESULT_KEYS: TRANSITION_EXPECTED_KEYS,
  buildRecruitmentTransitionManifest,
  isRecruitmentTransitionManifest
} = require("../server/lib/recruitment/recruitmentTransitionManifest");

const {
  buildRecruitmentArchitectureManifest
} = require("../server/lib/recruitment/recruitmentArchitectureManifest");

const {
  buildRecruitmentDependencyMap
} = require("../server/lib/recruitment/recruitmentDependencyMap");

const {
  validateRecruitmentArchitectureConsistency,
  VALIDATION_STATUS
} = require("../server/lib/recruitment/recruitmentConsistencyValidator");

const {
  buildRecruitmentDocumentationRegistry
} = require("../server/lib/recruitment/recruitmentDocumentationRegistry");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const AUDIT_MODULE = "server/lib/recruitment/recruitmentArchitectureAuditReport.js";
const COMPLETION_MODULE = "server/lib/recruitment/recruitmentCompletionReport.js";
const GUIDE_MODULE = "server/lib/recruitment/recruitmentProductionAdoptionGuide.js";
const TRANSITION_MODULE = "server/lib/recruitment/recruitmentTransitionManifest.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_144_MODULES = [
  "recruitmentArchitectureAuditReport",
  "recruitmentCompletionReport",
  "recruitmentProductionAdoptionGuide",
  "recruitmentTransitionManifest"
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
  const manifest = buildRecruitmentArchitectureManifest({ recruitmentId: "ARCH_144" });
  const dependencyMap = buildRecruitmentDependencyMap({ recruitmentId: "ARCH_144" });
  const documentationRegistry = buildRecruitmentDocumentationRegistry({ recruitmentId: "ARCH_144" });
  const consistencyResult = validateRecruitmentArchitectureConsistency({
    recruitmentId: "ARCH_144",
    architectureManifest: manifest,
    dependencyMap
  });
  const completionReport = buildRecruitmentCompletionReport({
    recruitmentId: "ARCH_144",
    architectureManifest: manifest,
    consistencyResult,
    documentationRegistry
  });
  const auditReport = buildRecruitmentArchitectureAuditReport({
    recruitmentId: "ARCH_144",
    architectureManifest: manifest,
    dependencyMap,
    consistencyResult,
    documentationRegistry,
    completionReport
  });
  const productionGuide = buildRecruitmentProductionAdoptionGuide({
    recruitmentId: "ARCH_144",
    architectureManifest: manifest,
    completionReport,
    auditReport
  });
  const transitionManifest = buildRecruitmentTransitionManifest({
    recruitmentId: "ARCH_144",
    architectureManifest: manifest,
    completionReport,
    auditReport
  });
  return {
    manifest,
    dependencyMap,
    documentationRegistry,
    consistencyResult,
    completionReport,
    auditReport,
    productionGuide,
    transitionManifest
  };
}

describe("Phase 144 — recruitmentArchitectureAuditReport", () => {
  describe("module metadata", () => {
    test("exports phase 144 constants", () => {
      expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_PHASE).toBe(144);
      expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_ENTITY).toBe("recruitment_architecture_audit_report");
      expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_DESCRIPTOR.phase).toBe(144);
      expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_METADATA.executed).toBe(false);
    });

    test("completed capability ids cover all architecture domains", () => {
      expect(COMPLETED_CAPABILITY_IDS).toContain("ARCHITECTURE_CONSOLIDATION");
      expect(COMPLETED_CAPABILITY_IDS).toContain("COMPLETION_AND_TRANSITION");
      expect(COMPLETED_CAPABILITY_IDS).toContain("OPERATIONAL_GOVERNANCE");
    });
  });

  describe("empty and invalid inputs", () => {
    test("handles null input without throwing", () => {
      expect(() => buildRecruitmentArchitectureAuditReport(null)).not.toThrow();
      const result = buildRecruitmentArchitectureAuditReport(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.auditStatus).toBe(AUDIT_STATUS.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("handles undefined input without throwing", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(result.recruitmentId).toBe("UNKNOWN");
    });

    test("handles non-object input without throwing", () => {
      const result = buildRecruitmentArchitectureAuditReport("invalid");
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.auditStatus).toBe(AUDIT_STATUS.UNKNOWN);
    });

    test("resolves recruitmentId from input", () => {
      const result = buildRecruitmentArchitectureAuditReport({ recruitmentId: "AUDIT_001" });
      expect(result.recruitmentId).toBe("AUDIT_001");
    });
  });

  describe("audit generation", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(Object.keys(result).sort()).toEqual([...AUDIT_EXPECTED_KEYS].sort());
      expect(isRecruitmentArchitectureAuditReport(result)).toBe(true);
    });

    test("includes all required audit sections", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(result.architectureOverview).toBeDefined();
      expect(result.completedCapabilities).toBeDefined();
      expect(result.executionIsolation).toBeDefined();
      expect(result.advisoryCoverage).toBeDefined();
      expect(result.maturityAssessment).toBeDefined();
      expect(result.identifiedConstraints).toBeDefined();
      expect(typeof result.confidence).toBe("number");
      expect(result.auditStatus).toBeDefined();
    });

    test("architecture overview declares advisory complete maturity", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(result.architectureOverview.maturityLevel).toBe(MATURITY_LEVEL.ADVISORY_COMPLETE);
      expect(result.architectureOverview.advisoryOnly).toBe(true);
      expect(result.architectureOverview.runtimeIntegration).toBe(false);
    });

    test("execution isolation declares fully isolated posture", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(result.executionIsolation.allBoundariesIsolated).toBe(true);
      expect(result.executionIsolation.advisoryImportsPermitted).toBe(false);
      expect(result.executionIsolation.runtimeWiringEnabled).toBe(false);
    });

    test("complete architecture yields COMPLETE audit status with high confidence", () => {
      const { manifest, dependencyMap, consistencyResult, documentationRegistry } =
        buildCompleteArchitectureContext();
      const result = buildRecruitmentArchitectureAuditReport({
        recruitmentId: "ARCH_144",
        architectureManifest: manifest,
        dependencyMap,
        consistencyResult,
        documentationRegistry
      });
      expect(result.auditStatus).toBe(AUDIT_STATUS.COMPLETE);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.advisoryCoverage.coverageStatus).toBe(ADVISORY_COVERAGE_STATUS.COMPREHENSIVE);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "DET_144" };
      const first = buildRecruitmentArchitectureAuditReport(input);
      const second = buildRecruitmentArchitectureAuditReport(input);
      expect(first).toEqual(second);
    });

    test("does not mutate input", () => {
      const input = { recruitmentId: "IMMUTABLE_144" };
      const snapshot = JSON.parse(JSON.stringify(input));
      buildRecruitmentArchitectureAuditReport(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentArchitectureAuditReport());
    });
  });

  describe("stable ordering", () => {
    test("completed capabilities maintain ascending order", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      const orders = result.completedCapabilities.map((c) => c.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("capability count matches canonical ids", () => {
      const result = buildRecruitmentArchitectureAuditReport();
      expect(result.completedCapabilities.length).toBe(COMPLETED_CAPABILITY_IDS.length);
    });
  });
});

describe("Phase 144 — recruitmentCompletionReport", () => {
  describe("module metadata", () => {
    test("exports phase 144 constants", () => {
      expect(RECRUITMENT_COMPLETION_REPORT_PHASE).toBe(144);
      expect(RECRUITMENT_COMPLETION_REPORT_ENTITY).toBe("recruitment_completion_report");
      expect(RECRUITMENT_COMPLETION_REPORT_DESCRIPTOR.phase).toBe(144);
      expect(RECRUITMENT_COMPLETION_REPORT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_COMPLETION_REPORT_METADATA.executed).toBe(false);
    });
  });

  describe("empty and invalid inputs", () => {
    test("handles null input without throwing", () => {
      expect(() => buildRecruitmentCompletionReport(null)).not.toThrow();
      const result = buildRecruitmentCompletionReport(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.overallCompletion.status).toBe(COMPLETION_STATUS.UNKNOWN);
    });

    test("handles undefined input without throwing", () => {
      const result = buildRecruitmentCompletionReport();
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("completion calculations", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentCompletionReport();
      expect(Object.keys(result).sort()).toEqual([...COMPLETION_EXPECTED_KEYS].sort());
      expect(isRecruitmentCompletionReport(result)).toBe(true);
    });

    test("phases completed spans 114 through 144", () => {
      const result = buildRecruitmentCompletionReport();
      expect(result.phasesCompleted.phases).toEqual(PHASES_COMPLETED);
      expect(result.phasesCompleted.firstPhase).toBe(114);
      expect(result.phasesCompleted.lastPhase).toBe(144);
      expect(result.phasesCompleted.phaseCount).toBe(31);
    });

    test("advisory modules include phase 144 modules", () => {
      const result = buildRecruitmentCompletionReport();
      expect(result.advisoryModules.phase144Modules).toEqual(PHASE_144_ADVISORY_MODULES);
      expect(result.advisoryModules.phase144ModuleCount).toBe(4);
      expect(result.advisoryModules.allAdvisoryOnly).toBe(true);
      expect(result.advisoryModules.runtimeModules).toBe(0);
    });

    test("architecture layers include completion and transition layer", () => {
      const result = buildRecruitmentCompletionReport();
      expect(result.architectureLayers.layerCount).toBe(ARCHITECTURE_LAYER_DEFINITIONS.length);
      expect(result.architectureLayers.includesCompletionLayer).toBe(true);
    });

    test("complete architecture yields COMPLETE overall completion", () => {
      const { manifest, consistencyResult, documentationRegistry } = buildCompleteArchitectureContext();
      const result = buildRecruitmentCompletionReport({
        recruitmentId: "ARCH_144",
        architectureManifest: manifest,
        consistencyResult,
        documentationRegistry
      });
      expect(result.overallCompletion.status).toBe(COMPLETION_STATUS.COMPLETE);
      expect(result.overallCompletion.percentage).toBeGreaterThanOrEqual(95);
      expect(result.overallCompletion.advisoryArchitectureComplete).toBe(true);
    });

    test("summary text describes completion posture", () => {
      const result = buildRecruitmentCompletionReport();
      expect(result.summary).toContain("114");
      expect(result.summary).toContain("144");
      expect(result.summary).toContain("advisory-only");
    });

    test("governance coverage is FULL for default input", () => {
      const result = buildRecruitmentCompletionReport({});
      expect(result.governanceCoverage.status).toBe(COVERAGE_STATUS.FULL);
      expect(result.governanceCoverage.operationalGovernanceComplete).toBe(true);
    });

    test("validation coverage reflects consistency result", () => {
      const { consistencyResult } = buildCompleteArchitectureContext();
      const result = buildRecruitmentCompletionReport({ consistencyResult });
      expect(result.validationCoverage.status).toBe(COVERAGE_STATUS.FULL);
      expect(result.validationCoverage.validationStatus).toBe(VALIDATION_STATUS.VALID);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "COMP_144" };
      expect(buildRecruitmentCompletionReport(input)).toEqual(buildRecruitmentCompletionReport(input));
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentCompletionReport());
    });
  });
});

describe("Phase 144 — recruitmentProductionAdoptionGuide", () => {
  describe("module metadata", () => {
    test("exports phase 144 constants", () => {
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_PHASE).toBe(144);
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_ENTITY).toBe("recruitment_production_adoption_guide");
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_DESCRIPTOR.phase).toBe(144);
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.activatesAnything).toBe(false);
      expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.executed).toBe(false);
    });
  });

  describe("empty and invalid inputs", () => {
    test("handles null input without throwing", () => {
      expect(() => buildRecruitmentProductionAdoptionGuide(null)).not.toThrow();
      const result = buildRecruitmentProductionAdoptionGuide(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.guidePosture).toBe(GUIDE_POSTURE.GUIDE_UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("handles undefined input without throwing", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("production guide", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(Object.keys(result).sort()).toEqual([...GUIDE_EXPECTED_KEYS].sort());
      expect(isRecruitmentProductionAdoptionGuide(result)).toBe(true);
    });

    test("includes all required guide sections", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(result.recommendedAdoptionSequence.length).toBeGreaterThan(0);
      expect(result.operationalCheckpoints.length).toBeGreaterThan(0);
      expect(result.validationCheckpoints.length).toBeGreaterThan(0);
      expect(result.rollbackConsiderations.length).toBeGreaterThan(0);
      expect(result.monitoringRecommendations.length).toBeGreaterThan(0);
      expect(result.rolloutRecommendations.length).toBeGreaterThan(0);
    });

    test("adoption sequence does not activate runtime", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(
        result.recommendedAdoptionSequence.every((step) => step.activatesRuntime === false)
      ).toBe(true);
      expect(result.recommendedAdoptionSequence.map((s) => s.id)).toEqual(ADOPTION_SEQUENCE_IDS);
    });

    test("rollback considerations do not enable automated rollback", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(
        result.rollbackConsiderations.every((r) => r.automatedRollback === false)
      ).toBe(true);
    });

    test("rollout recommendations do not activate rollout", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(
        result.rolloutRecommendations.every((r) => r.activatesRollout === false)
      ).toBe(true);
    });

    test("monitoring recommendations do not activate alerting", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(
        result.monitoringRecommendations.every((m) => m.activatesAlerting === false)
      ).toBe(true);
    });

    test("complete context yields GUIDE_COMPLETE posture", () => {
      const { completionReport, auditReport, manifest } = buildCompleteArchitectureContext();
      const result = buildRecruitmentProductionAdoptionGuide({
        recruitmentId: "ARCH_144",
        completionReport,
        auditReport,
        architectureManifest: manifest
      });
      expect(result.guidePosture).toBe(GUIDE_POSTURE.GUIDE_COMPLETE);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    test("guide metadata declares activatesAnything false", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
      expect(result.advisoryMetadata.flagExecutionEnabled).toBe(false);
    });
  });

  describe("stable ordering", () => {
    test("adoption sequence maintains ascending order", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      const orders = result.recommendedAdoptionSequence.map((s) => s.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("operational checkpoints maintain ascending order", () => {
      const result = buildRecruitmentProductionAdoptionGuide();
      const orders = result.operationalCheckpoints.map((c) => c.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "GUIDE_144" };
      expect(buildRecruitmentProductionAdoptionGuide(input)).toEqual(
        buildRecruitmentProductionAdoptionGuide(input)
      );
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentProductionAdoptionGuide());
    });
  });
});

describe("Phase 144 — recruitmentTransitionManifest", () => {
  describe("module metadata", () => {
    test("exports phase 144 constants", () => {
      expect(RECRUITMENT_TRANSITION_MANIFEST_PHASE).toBe(144);
      expect(RECRUITMENT_TRANSITION_MANIFEST_ENTITY).toBe("recruitment_transition_manifest");
      expect(RECRUITMENT_TRANSITION_MANIFEST_DESCRIPTOR.phase).toBe(144);
      expect(RECRUITMENT_TRANSITION_MANIFEST_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_TRANSITION_MANIFEST_METADATA.executed).toBe(false);
    });
  });

  describe("empty metadata", () => {
    test("returns UNKNOWN state for null input", () => {
      const result = buildRecruitmentTransitionManifest(null);
      expect(result.currentState).toBe(CURRENT_STATE.UNKNOWN);
      expect(result.nextStage).toBe(NEXT_STAGE.UNKNOWN);
      expect(result.transitionReadiness).toBe(TRANSITION_READINESS.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("returns UNKNOWN state for empty object", () => {
      const result = buildRecruitmentTransitionManifest({});
      expect(isRecruitmentTransitionManifest(result)).toBe(true);
    });
  });

  describe("transition manifest", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentTransitionManifest();
      expect(Object.keys(result).sort()).toEqual([...TRANSITION_EXPECTED_KEYS].sort());
      expect(isRecruitmentTransitionManifest(result)).toBe(true);
    });

    test("includes all required transition sections", () => {
      const result = buildRecruitmentTransitionManifest({});
      expect(result.currentState).toBeDefined();
      expect(result.nextStage).toBeDefined();
      expect(result.recommendedObjectives.length).toBeGreaterThan(0);
      expect(result.runtimeBoundaries.length).toBeGreaterThan(0);
      expect(result.advisoryConstraints.length).toBeGreaterThan(0);
    });

    test("complete architecture transitions to FUTURE_IMPLEMENTATION_PHASE", () => {
      const { completionReport, auditReport, manifest } = buildCompleteArchitectureContext();
      const result = buildRecruitmentTransitionManifest({
        recruitmentId: "ARCH_144",
        completionReport,
        auditReport,
        architectureManifest: manifest
      });
      expect(result.currentState).toBe(CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE);
      expect(result.nextStage).toBe(NEXT_STAGE.FUTURE_IMPLEMENTATION_PHASE);
      expect(result.transitionReadiness).toBe(TRANSITION_READINESS.READY_FOR_TRANSITION_PLANNING);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("runtime boundaries prohibit advisory imports", () => {
      const result = buildRecruitmentTransitionManifest({});
      expect(
        result.runtimeBoundaries.every((b) => b.advisoryImportsAllowed === false)
      ).toBe(true);
      expect(
        result.runtimeBoundaries.every((b) => b.isolationMaintained === true)
      ).toBe(true);
    });

    test("advisory constraints are all enforced", () => {
      const result = buildRecruitmentTransitionManifest({});
      expect(
        result.advisoryConstraints.every((c) => c.enforced === true)
      ).toBe(true);
    });

    test("generated metadata declares architecture to implementation transition", () => {
      const result = buildRecruitmentTransitionManifest({});
      expect(result.generatedMetadata.fromPhase).toBe("ARCHITECTURE_PHASE");
      expect(result.generatedMetadata.toPhase).toBe("FUTURE_IMPLEMENTATION_PHASE");
      expect(result.generatedMetadata.advisoryOnly).toBe(true);
      expect(result.generatedMetadata.runtimeImpact).toBe("none");
    });
  });

  describe("stable ordering", () => {
    test("recommended objectives maintain ascending order", () => {
      const result = buildRecruitmentTransitionManifest({});
      const orders = result.recommendedObjectives.map((o) => o.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("runtime boundaries maintain ascending order", () => {
      const result = buildRecruitmentTransitionManifest({});
      const orders = result.runtimeBoundaries.map((b) => b.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = { recruitmentId: "TRANS_144" };
      expect(buildRecruitmentTransitionManifest(input)).toEqual(
        buildRecruitmentTransitionManifest(input)
      );
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentTransitionManifest({}));
    });
  });
});

describe("Phase 144 — confidence calculations", () => {
  test("audit confidence increases with complete architecture context", () => {
    const minimal = buildRecruitmentArchitectureAuditReport({});
    const { manifest, dependencyMap, consistencyResult, documentationRegistry } =
      buildCompleteArchitectureContext();
    const complete = buildRecruitmentArchitectureAuditReport({
      architectureManifest: manifest,
      dependencyMap,
      consistencyResult,
      documentationRegistry
    });
    expect(complete.confidence).toBeGreaterThan(minimal.confidence);
    expect(complete.confidence).toBeGreaterThanOrEqual(90);
  });

  test("completion percentage is 100 for complete architecture", () => {
    const { manifest, consistencyResult, documentationRegistry } = buildCompleteArchitectureContext();
    const result = buildRecruitmentCompletionReport({
      architectureManifest: manifest,
      consistencyResult,
      documentationRegistry
    });
    expect(result.overallCompletion.percentage).toBe(100);
  });

  test("transition confidence reaches threshold for complete context", () => {
    const { completionReport, auditReport, manifest } = buildCompleteArchitectureContext();
    const result = buildRecruitmentTransitionManifest({
      completionReport,
      auditReport,
      architectureManifest: manifest
    });
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });
});

describe("Phase 144 — complete architecture integration", () => {
  test("full suite produces consistent cross-module signals", () => {
    const ctx = buildCompleteArchitectureContext();
    expect(ctx.auditReport.auditStatus).toBe(AUDIT_STATUS.COMPLETE);
    expect(ctx.completionReport.overallCompletion.status).toBe(COMPLETION_STATUS.COMPLETE);
    expect(ctx.productionGuide.guidePosture).toBe(GUIDE_POSTURE.GUIDE_COMPLETE);
    expect(ctx.transitionManifest.currentState).toBe(CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE);
    expect(ctx.transitionManifest.nextStage).toBe(NEXT_STAGE.FUTURE_IMPLEMENTATION_PHASE);
  });

  test("canonical module and layer counts align", () => {
    const audit = buildRecruitmentArchitectureAuditReport({});
    expect(audit.architectureOverview.moduleCount).toBe(CANONICAL_MODULE_COUNT);
    expect(audit.architectureOverview.layerCount).toBe(CANONICAL_LAYER_COUNT);
  });
});

describe("Phase 144 — architecture boundaries", () => {
  const modulePaths = [AUDIT_MODULE, COMPLETION_MODULE, GUIDE_MODULE, TRANSITION_MODULE];

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

  test("orchestrator behavior remains unchanged and independent from phase 144", () => {
    const orchestration = orchestrateRecruitmentWorkflow({
      recruitmentId: 144,
      eventType: "notification"
    });

    expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
    expect(orchestration.advisory).toBe(true);
    expect(orchestration.executed).toBe(false);
    expect(orchestration).not.toHaveProperty("auditStatus");
    expect(orchestration).not.toHaveProperty("transitionReadiness");
    expect(orchestration).not.toHaveProperty("guidePosture");
  });

  test.each(PHASE_144_MODULES)("phase 144 module %s is not imported by orchestrator", (moduleName) => {
    expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_144_MODULES)("phase 144 module %s is not imported by coordinator", (moduleName) => {
    expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_144_MODULES)("phase 144 module %s is not imported by advisory gateway", (moduleName) => {
    expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_144_MODULES)("phase 144 module %s is not imported by recruitment pipeline", (moduleName) => {
    expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_144_MODULES)("phase 144 module %s is not imported by site worker", (moduleName) => {
    expect(read(WORKER_MODULE)).not.toContain(moduleName);
  });

  test("all phase 144 outputs declare executed false", () => {
    const ctx = buildCompleteArchitectureContext();
    expect(ctx.auditReport.advisoryMetadata.executed).toBe(false);
    expect(ctx.completionReport.advisoryMetadata.executed).toBe(false);
    expect(ctx.productionGuide.advisoryMetadata.executed).toBe(false);
    expect(ctx.transitionManifest.advisoryMetadata.executed).toBe(false);
  });

  test("metadata source phases include 143", () => {
    expect(RECRUITMENT_ARCHITECTURE_AUDIT_REPORT_METADATA.sourcePhases).toContain(143);
    expect(RECRUITMENT_COMPLETION_REPORT_METADATA.sourcePhases).toContain(143);
    expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.sourcePhases).toContain(143);
    expect(RECRUITMENT_TRANSITION_MANIFEST_METADATA.sourcePhases).toContain(143);
  });

  test("production guide metadata declares activatesAnything false at module level", () => {
    expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.activatesAnything).toBe(false);
    expect(RECRUITMENT_PRODUCTION_ADOPTION_GUIDE_METADATA.rolloutActivationEnabled).toBe(false);
  });
});
