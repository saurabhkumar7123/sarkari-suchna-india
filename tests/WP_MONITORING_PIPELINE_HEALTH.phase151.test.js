"use strict";

/**
 * Phase 151 — WP_MONITORING_PIPELINE_HEALTH Specification tests.
 * Verifies deterministic output, immutable result, required fields,
 * stable ordering, advisory metadata, and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  WP_MONITORING_PIPELINE_HEALTH_PHASE,
  WP_MONITORING_PIPELINE_HEALTH_ENTITY,
  WP_MONITORING_PIPELINE_HEALTH_SCHEMA_VERSION,
  WORK_PACKAGE_ID,
  GAP_ID,
  EXPECTED_RESULT_KEYS,
  OBJECTIVE,
  CURRENT_PRODUCTION_ASSUMPTIONS,
  HEALTH_INDICATORS,
  REQUIRED_MONITORING_SIGNALS,
  VALIDATION_CRITERIA,
  SHADOW_MODE_VERIFICATION_STEPS,
  ROLLBACK_CRITERIA,
  IMPLEMENTATION_DEPENDENCIES,
  COMPLETION_CHECKLIST,
  WP_MONITORING_PIPELINE_HEALTH_METADATA,
  WP_MONITORING_PIPELINE_HEALTH_DESCRIPTOR,
  buildWpMonitoringPipelineHealthSpecification,
  isWpMonitoringPipelineHealthSpecification
} = require("../server/lib/recruitment/workPackages/WP_MONITORING_PIPELINE_HEALTH");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const SPEC_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "lib",
  "recruitment",
  "workPackages",
  "WP_MONITORING_PIPELINE_HEALTH.js"
);

const ORCHESTRATOR_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "lib",
  "recruitment",
  "recruitmentWorkflowOrchestrator.js"
);

const COORDINATOR_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "lib",
  "recruitment",
  "recruitmentCoordinator.js"
);

const GATEWAY_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "lib",
  "recruitment",
  "recruitmentAdvisoryGateway.js"
);

const PIPELINE_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "lib",
  "recruitment",
  "recruitmentPipeline.js"
);

const WORKER_MODULE = path.join(
  __dirname,
  "..",
  "server",
  "workers",
  "siteWorker.js"
);

const PHASE_151_MARKERS = Object.freeze([
  "WP_MONITORING_PIPELINE_HEALTH.js",
  "buildWpMonitoringPipelineHealthSpecification",
  "wp_monitoring_pipeline_health",
  "phase_151"
]);

function read(modulePath) {
  return fs.readFileSync(modulePath, "utf8");
}

function assertOrderedByOrderField(items) {
  const orders = items.map(function mapOrder(item) {
    return item.order;
  });
  expect(orders).toEqual(
    orders.slice().sort(function sortAsc(a, b) {
      return a - b;
    })
  );
}

describe("Phase 151 — WP_MONITORING_PIPELINE_HEALTH deterministic output", () => {
  test("builder returns identical payloads across calls", () => {
    const a = buildWpMonitoringPipelineHealthSpecification();
    const b = buildWpMonitoringPipelineHealthSpecification();
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("builder ignores input and stays deterministic", () => {
    const a = buildWpMonitoringPipelineHealthSpecification({ noise: true });
    const b = buildWpMonitoringPipelineHealthSpecification(null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("type guard accepts built specification", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(isWpMonitoringPipelineHealthSpecification(result)).toBe(true);
    expect(isWpMonitoringPipelineHealthSpecification(null)).toBe(false);
    expect(isWpMonitoringPipelineHealthSpecification({})).toBe(false);
  });
});

describe("Phase 151 — immutable result", () => {
  test("result and nested collections are frozen", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.currentProductionAssumptions)).toBe(true);
    expect(Object.isFrozen(result.healthIndicators)).toBe(true);
    expect(Object.isFrozen(result.requiredMonitoringSignals)).toBe(true);
    expect(Object.isFrozen(result.validationCriteria)).toBe(true);
    expect(Object.isFrozen(result.shadowModeVerificationSteps)).toBe(true);
    expect(Object.isFrozen(result.rollbackCriteria)).toBe(true);
    expect(Object.isFrozen(result.implementationDependencies)).toBe(true);
    expect(Object.isFrozen(result.completionChecklist)).toBe(true);
    expect(Object.isFrozen(result.advisoryMetadata)).toBe(true);
    expect(Object.isFrozen(result.healthIndicators[0])).toBe(true);
    expect(Object.isFrozen(result.advisoryMetadata.sourcePhases)).toBe(true);
  });

  test("mutation attempts throw in strict mode", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(() => {
      result.objective = "mutated";
    }).toThrow();
    expect(() => {
      result.healthIndicators.push({ id: "x" });
    }).toThrow();
  });
});

describe("Phase 151 — required fields", () => {
  test("result contains all expected keys in stable order", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(Object.keys(result)).toEqual([...EXPECTED_RESULT_KEYS]);
  });

  test("identity and objective fields are correct", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(result.workPackageId).toBe(WORK_PACKAGE_ID);
    expect(result.gapId).toBe(GAP_ID);
    expect(result.phase).toBe(WP_MONITORING_PIPELINE_HEALTH_PHASE);
    expect(result.entity).toBe(WP_MONITORING_PIPELINE_HEALTH_ENTITY);
    expect(result.schemaVersion).toBe(WP_MONITORING_PIPELINE_HEALTH_SCHEMA_VERSION);
    expect(result.objective).toBe(OBJECTIVE);
    expect(result.objective).toContain("read-only");
  });

  test("all specification sections are non-empty arrays", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(result.currentProductionAssumptions.length).toBeGreaterThan(0);
    expect(result.healthIndicators.length).toBeGreaterThan(0);
    expect(result.requiredMonitoringSignals.length).toBeGreaterThan(0);
    expect(result.validationCriteria.length).toBeGreaterThan(0);
    expect(result.shadowModeVerificationSteps.length).toBeGreaterThan(0);
    expect(result.rollbackCriteria.length).toBeGreaterThan(0);
    expect(result.implementationDependencies.length).toBeGreaterThan(0);
    expect(result.completionChecklist.length).toBeGreaterThan(0);
  });

  test("exported section constants match builder output", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(result.currentProductionAssumptions).toEqual(CURRENT_PRODUCTION_ASSUMPTIONS);
    expect(result.healthIndicators).toEqual(HEALTH_INDICATORS);
    expect(result.requiredMonitoringSignals).toEqual(REQUIRED_MONITORING_SIGNALS);
    expect(result.validationCriteria).toEqual(VALIDATION_CRITERIA);
    expect(result.shadowModeVerificationSteps).toEqual(SHADOW_MODE_VERIFICATION_STEPS);
    expect(result.rollbackCriteria).toEqual(ROLLBACK_CRITERIA);
    expect(result.implementationDependencies).toEqual(IMPLEMENTATION_DEPENDENCIES);
    expect(result.completionChecklist).toEqual(COMPLETION_CHECKLIST);
  });

  test("descriptor aligns with specification identity", () => {
    expect(WP_MONITORING_PIPELINE_HEALTH_DESCRIPTOR.workPackageId).toBe(WORK_PACKAGE_ID);
    expect(WP_MONITORING_PIPELINE_HEALTH_DESCRIPTOR.gapId).toBe(GAP_ID);
    expect(WP_MONITORING_PIPELINE_HEALTH_DESCRIPTOR.phase).toBe(151);
    expect(WP_MONITORING_PIPELINE_HEALTH_DESCRIPTOR.advisoryOnly).toBe(true);
  });

  test("required signals include Phase 150 observation points", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    const signals = result.requiredMonitoringSignals.map(function mapSignal(s) {
      return s.signal;
    });
    expect(signals).toContain("pipeline_stage_health_emit");
    expect(signals).toContain("monitoring_baseline_compare");
    expect(signals).toContain("advisory_health_schema_validate");
    expect(signals).toContain("shadow_health_checkpoint_report");
    expect(signals).toContain("baseline_divergence_summary");
  });
});

describe("Phase 151 — stable ordering", () => {
  test("ordered sections are sorted by order field", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    assertOrderedByOrderField(result.currentProductionAssumptions);
    assertOrderedByOrderField(result.healthIndicators);
    assertOrderedByOrderField(result.requiredMonitoringSignals);
    assertOrderedByOrderField(result.validationCriteria);
    assertOrderedByOrderField(result.shadowModeVerificationSteps);
    assertOrderedByOrderField(result.rollbackCriteria);
    assertOrderedByOrderField(result.implementationDependencies);
    assertOrderedByOrderField(result.completionChecklist);
  });

  test("expected key order is frozen and stable", () => {
    expect(Object.isFrozen(EXPECTED_RESULT_KEYS)).toBe(true);
    expect(EXPECTED_RESULT_KEYS[0]).toBe("workPackageId");
    expect(EXPECTED_RESULT_KEYS[EXPECTED_RESULT_KEYS.length - 1]).toBe(
      "advisoryMetadata"
    );
  });
});

describe("Phase 151 — advisory metadata", () => {
  test("advisory metadata confirms specification-only posture", () => {
    const result = buildWpMonitoringPipelineHealthSpecification();
    expect(result.advisoryMetadata).toEqual(WP_MONITORING_PIPELINE_HEALTH_METADATA);
    expect(result.advisoryMetadata.advisoryOnly).toBe(true);
    expect(result.advisoryMetadata.descriptiveOnly).toBe(true);
    expect(result.advisoryMetadata.readOnly).toBe(true);
    expect(result.advisoryMetadata.specificationOnly).toBe(true);
    expect(result.advisoryMetadata.runtimeIntegration).toBe(false);
    expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
    expect(result.advisoryMetadata.queriesDatabase).toBe(false);
    expect(result.advisoryMetadata.sideEffects).toBe(false);
    expect(result.advisoryMetadata.mutatesProduction).toBe(false);
    expect(result.advisoryMetadata.flagExecutionEnabled).toBe(false);
    expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
    expect(result.advisoryMetadata.runtimeWiringEnabled).toBe(false);
    expect(result.advisoryMetadata.executed).toBe(false);
    expect(result.advisoryMetadata.activatesAnything).toBe(false);
    expect(result.advisoryMetadata.writeExecutionPermitted).toBe(false);
    expect(result.advisoryMetadata.phase).toBe(151);
    expect(result.advisoryMetadata.sourcePhases).toEqual([149, 150, 151]);
  });
});

describe("Phase 151 — runtime isolation", () => {
  test("specification module contains no module loading or persistence APIs", () => {
    const source = read(SPEC_MODULE);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s+/);
    expect(source.toLowerCase()).not.toMatch(/\binsert\s+into\b/);
    expect(source.toLowerCase()).not.toMatch(/\bupdate\s+\w+\s+set\b/);
    expect(source).not.toMatch(/\bfs\./);
    expect(source).not.toMatch(/\bwriteFile/);
  });

  test.each(PHASE_151_MARKERS)(
    "phase 151 marker %s is not imported by orchestrator",
    (marker) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(marker);
    }
  );

  test.each(PHASE_151_MARKERS)(
    "phase 151 marker %s is not imported by coordinator",
    (marker) => {
      if (fs.existsSync(COORDINATOR_MODULE)) {
        expect(read(COORDINATOR_MODULE)).not.toContain(marker);
      }
    }
  );

  test.each(PHASE_151_MARKERS)(
    "phase 151 marker %s is not imported by advisory gateway",
    (marker) => {
      if (fs.existsSync(GATEWAY_MODULE)) {
        expect(read(GATEWAY_MODULE)).not.toContain(marker);
      }
    }
  );

  test.each(PHASE_151_MARKERS)(
    "phase 151 marker %s is not imported by recruitment pipeline",
    (marker) => {
      if (fs.existsSync(PIPELINE_MODULE)) {
        expect(read(PIPELINE_MODULE)).not.toContain(marker);
      }
    }
  );

  test.each(PHASE_151_MARKERS)(
    "phase 151 marker %s is not imported by site worker",
    (marker) => {
      if (fs.existsSync(WORKER_MODULE)) {
        expect(read(WORKER_MODULE)).not.toContain(marker);
      }
    }
  );

  test("orchestrator output does not leak phase 151 specification fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_151",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_151");
    expect(serialized).not.toContain("wp_monitoring_pipeline_health");
    expect(serialized).not.toContain("buildWpMonitoringPipelineHealthSpecification");
    expect(serialized).not.toContain("shadowModeVerificationSteps");
    expect(serialized).not.toContain("currentProductionAssumptions");
  });

  test("protected production modules were not modified with phase 151 markers", () => {
    const protectedModules = [
      ORCHESTRATOR_MODULE,
      COORDINATOR_MODULE,
      GATEWAY_MODULE,
      PIPELINE_MODULE,
      WORKER_MODULE
    ];
    for (let i = 0; i < protectedModules.length; i += 1) {
      if (!fs.existsSync(protectedModules[i])) {
        continue;
      }
      const source = read(protectedModules[i]);
      expect(source).not.toContain("phase_151");
      expect(source).not.toContain("buildWpMonitoringPipelineHealthSpecification");
      expect(source).not.toContain("workPackages/WP_MONITORING_PIPELINE_HEALTH");
    }
  });
});
