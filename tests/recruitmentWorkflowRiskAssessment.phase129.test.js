"use strict";

/**
 * Phase 129 — Recruitment Workflow Advisory Risk Assessment tests.
 * Empty input, unknown state, low/medium/high/critical risk workflows,
 * risk factors, impact areas, mitigation suggestions, summary/metadata,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE,
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_ENTITY,
  RISK_LEVEL,
  HEALTH_STATUS,
  EVOLUTION_STATUS,
  READINESS_STATUS,
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA,
  assessRecruitmentWorkflowRisk
} = require("../server/lib/recruitment/recruitmentWorkflowRiskAssessment");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRiskAssessment.js";
const HEALTH_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowHealthIndicator.js";
const EVOLUTION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowEvolutionAnalyzer.js";
const COMPARISON_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSnapshotComparison.js";
const SNAPSHOT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const READINESS_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowReadinessAssessment.js";
const REPORT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const OBSERVATION_REGISTRY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_RESULT_KEYS = Object.freeze([
  "riskLevel",
  "riskFactors",
  "impactAreas",
  "mitigationSuggestions",
  "riskSummary",
  "advisoryMetadata"
]);

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

describe("Phase 129 — recruitmentWorkflowRiskAssessment", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE).toBe(129);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_ENTITY).toBe(
        "recruitment_workflow_risk_assessment"
      );
      expect(RISK_LEVEL.LOW).toBe("LOW");
      expect(RISK_LEVEL.MEDIUM).toBe("MEDIUM");
      expect(RISK_LEVEL.HIGH).toBe("HIGH");
      expect(RISK_LEVEL.CRITICAL).toBe("CRITICAL");
      expect(RISK_LEVEL.UNKNOWN).toBe("UNKNOWN");
      expect(HEALTH_STATUS.HEALTHY).toBe("HEALTHY");
      expect(EVOLUTION_STATUS.REGRESSED).toBe("REGRESSED");
      expect(READINESS_STATUS.READY_FOR_STORAGE).toBe("READY_FOR_STORAGE");
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.generatedBy).toBe("phase_129");
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.monitoringEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.alertingEnabled).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown risk for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = assessRecruitmentWorkflowRisk(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.riskLevel).toBe(RISK_LEVEL.UNKNOWN);
        expect(result.riskFactors).toEqual([]);
        expect(result.impactAreas).toEqual([]);
        expect(result.mitigationSuggestions).toEqual([]);
        expect(result.riskSummary).toBe("Workflow advisory risk could not be determined");
        expect(result.advisoryMetadata.generatedBy).toBe("phase_129");
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown risk for malformed input fields", () => {
      const malformedInputs = [
        { healthStatus: 42 },
        { readinessStatus: true },
        { evolutionStatus: {} },
        { healthScore: "high" },
        { missingCapabilities: "repository_contract" },
        { blockedReasons: { reason: "blocked" } },
        { riskIndicators: "regressed" }
      ];

      for (const input of malformedInputs) {
        const result = assessRecruitmentWorkflowRisk(input);

        expect(result.riskLevel).toBe(RISK_LEVEL.UNKNOWN);
        expect(result.riskSummary).toBe("Workflow advisory risk could not be determined");
      }
    });

    test("returns unknown risk when signals are insufficient to classify", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthScore: 0,
        missingCapabilities: [],
        blockedReasons: [],
        riskIndicators: []
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.UNKNOWN);
      expect(result.riskFactors).toEqual([]);
      expect(result.impactAreas).toEqual([]);
      expect(result.mitigationSuggestions).toEqual([]);
    });
  });

  describe("low risk", () => {
    test("reports low risk for healthy storage-ready workflow", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "READY_FOR_STORAGE"
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.LOW);
      expect(result.riskFactors).toEqual([]);
      expect(result.mitigationSuggestions).toEqual([]);
      expect(result.impactAreas).toEqual([]);
      expect(result.riskSummary).toBe("Workflow advisory risk is low");
    });

    test("reports low risk for healthy workflow without missing capabilities", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "REVIEW_READY",
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.LOW);
      expect(result.riskFactors).toEqual([]);
      expect(result.mitigationSuggestions).toEqual([]);
    });
  });

  describe("medium risk", () => {
    test("reports medium risk for approval pending with stable evolution", () => {
      const result = assessRecruitmentWorkflowRisk({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE"
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.MEDIUM);
      expect(result.riskFactors).toContain("Approval pending");
      expect(result.impactAreas).toContain("Approval workflow");
      expect(result.mitigationSuggestions).toContain("Monitor approval decision progress");
      expect(result.riskSummary).toBe("Workflow advisory risk is medium");
    });

    test("reports medium risk for stable health with review-ready readiness", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "STABLE",
        readinessStatus: "REVIEW_READY",
        evolutionStatus: "STABLE"
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.MEDIUM);
      expect(result.impactAreas).toContain("Advisory health");
    });
  });

  describe("high risk", () => {
    test("reports high risk when evolution regressed with missing capabilities", () => {
      const result = assessRecruitmentWorkflowRisk({
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["repository_contract"]
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.HIGH);
      expect(result.riskFactors).toContain("Workflow evolution regressed");
      expect(result.riskFactors).toContain("Missing capabilities detected");
      expect(result.riskFactors).toContain("Missing capability: repository_contract");
      expect(result.impactAreas).toContain("Workflow evolution");
      expect(result.impactAreas).toContain("Capability completeness");
      expect(result.impactAreas).toContain("Storage readiness");
      expect(result.mitigationSuggestions).toContain(
        "Review workflow regression and restore prior readiness"
      );
      expect(result.mitigationSuggestions).toContain(
        "Address missing capabilities before storage"
      );
      expect(result.riskSummary).toBe("Workflow advisory risk is high");
    });

    test("reports high risk when workflow health is at risk", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "AT_RISK",
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "REGRESSED"
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.HIGH);
      expect(result.riskFactors).toContain("Workflow health at risk");
      expect(result.mitigationSuggestions).toContain(
        "Strengthen advisory health signals before advancing workflow"
      );
    });
  });

  describe("critical risk", () => {
    test("reports critical risk when health status is blocked", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "BLOCKED",
        blockedReasons: ["Approval rejected"]
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.CRITICAL);
      expect(result.riskFactors).toContain("Approval rejected");
      expect(result.riskFactors).toContain("Workflow blocked");
      expect(result.impactAreas).toContain("Advisory health");
      expect(result.impactAreas).toContain("Workflow continuity");
      expect(result.mitigationSuggestions).toContain(
        "Resolve blocked reasons before proceeding"
      );
      expect(result.riskSummary).toBe("Workflow advisory risk is critical");
    });

    test("reports critical risk when readiness status is blocked", () => {
      const result = assessRecruitmentWorkflowRisk({
        readinessStatus: "BLOCKED",
        blockedReasons: ["Decision trace blocked"]
      });

      expect(result.riskLevel).toBe(RISK_LEVEL.CRITICAL);
      expect(result.riskFactors).toContain("Decision trace blocked");
      expect(result.riskFactors).toContain("Workflow blocked");
    });
  });

  describe("risk factors", () => {
    test("includes approval pending and supplied risk indicators", () => {
      const result = assessRecruitmentWorkflowRisk({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE",
        riskIndicators: ["Approval decision still pending"]
      });

      expect(result.riskFactors).toContain("Approval pending");
      expect(result.riskFactors).toContain("Approval decision still pending");
    });

    test("includes blocked reasons and regression factors", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "BLOCKED",
        evolutionStatus: "REGRESSED",
        blockedReasons: ["Approval rejected", "Invalid draft context"]
      });

      expect(result.riskFactors).toContain("Approval rejected");
      expect(result.riskFactors).toContain("Invalid draft context");
      expect(result.riskFactors).toContain("Workflow blocked");
      expect(result.riskFactors).toContain("Workflow evolution regressed");
    });

    test("does not include risk factors for unknown risk", () => {
      const result = assessRecruitmentWorkflowRisk(null);

      expect(result.riskFactors).toEqual([]);
    });
  });

  describe("impact areas", () => {
    test("includes readiness progression for incomplete readiness", () => {
      const result = assessRecruitmentWorkflowRisk({
        readinessStatus: "PARTIALLY_READY",
        missingCapabilities: ["review_package"]
      });

      expect(result.impactAreas).toContain("Readiness progression");
      expect(result.impactAreas).toContain("Capability completeness");
    });

    test("does not include impact areas for low risk", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "READY_FOR_STORAGE"
      });

      expect(result.impactAreas).toEqual([]);
    });
  });

  describe("mitigation suggestions", () => {
    test("includes mitigation suggestions for medium and higher risk", () => {
      const medium = assessRecruitmentWorkflowRisk({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE"
      });
      const high = assessRecruitmentWorkflowRisk({
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["repository_contract"]
      });
      const critical = assessRecruitmentWorkflowRisk({
        healthStatus: "BLOCKED",
        blockedReasons: ["Approval rejected"]
      });

      expect(medium.mitigationSuggestions).toContain("Monitor approval decision progress");
      expect(high.mitigationSuggestions.length).toBeGreaterThan(0);
      expect(critical.mitigationSuggestions).toContain(
        "Resolve blocked reasons before proceeding"
      );
    });

    test("does not include mitigation suggestions for low risk", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "READY_FOR_STORAGE"
      });

      expect(result.mitigationSuggestions).toEqual([]);
    });
  });

  describe("summary generation", () => {
    test("generates summaries for each risk level", () => {
      const low = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "READY_FOR_STORAGE"
      });
      const medium = assessRecruitmentWorkflowRisk({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE"
      });
      const high = assessRecruitmentWorkflowRisk({
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["repository_contract"]
      });
      const critical = assessRecruitmentWorkflowRisk({
        healthStatus: "BLOCKED",
        blockedReasons: ["Approval rejected"]
      });
      const unknown = assessRecruitmentWorkflowRisk(null);

      expect(low.riskSummary).toBe("Workflow advisory risk is low");
      expect(medium.riskSummary).toBe("Workflow advisory risk is medium");
      expect(high.riskSummary).toBe("Workflow advisory risk is high");
      expect(critical.riskSummary).toBe("Workflow advisory risk is critical");
      expect(unknown.riskSummary).toBe("Workflow advisory risk could not be determined");
    });
  });

  describe("metadata validation", () => {
    test("includes advisory risk metadata on every result", () => {
      const result = assessRecruitmentWorkflowRisk({
        healthStatus: "HEALTHY",
        readinessStatus: "READY_FOR_STORAGE"
      });

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_129");
      expect(result.advisoryMetadata.phase).toBe(129);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.riskPersistence).toBe(false);
      expect(result.advisoryMetadata.monitoringEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryRiskOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA.sourcePhases).toEqual([123, 127, 128]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical risk assessment for identical input", () => {
      const input = {
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE",
        healthStatus: "STABLE"
      };

      const first = assessRecruitmentWorkflowRisk(input);
      const second = assessRecruitmentWorkflowRisk(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes risk assessment output", () => {
      const result = assessRecruitmentWorkflowRisk({
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["repository_contract"]
      });

      assertAllFrozen(result);
      expect(() => {
        result.riskSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.riskFactors.push("extra");
      }).toThrow();
      expect(() => {
        result.impactAreas.push("extra");
      }).toThrow();
      expect(() => {
        result.mitigationSuggestions.push("extra");
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate risk input or nested arrays", () => {
      const input = {
        healthStatus: "AT_RISK",
        healthScore: 30,
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["approval_gate"],
        blockedReasons: [],
        riskIndicators: ["Workflow evolution regressed"]
      };

      const before = JSON.stringify(input);
      const missingBefore = JSON.stringify(input.missingCapabilities);
      const blockedBefore = JSON.stringify(input.blockedReasons);
      const indicatorsBefore = JSON.stringify(input.riskIndicators);

      assessRecruitmentWorkflowRisk(input);
      assessRecruitmentWorkflowRisk(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.missingCapabilities)).toBe(missingBefore);
      expect(JSON.stringify(input.blockedReasons)).toBe(blockedBefore);
      expect(JSON.stringify(input.riskIndicators)).toBe(indicatorsBefore);
    });

    test("risk assessment does not mutate process environment", () => {
      const envBefore = { ...process.env };
      assessRecruitmentWorkflowRisk({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE"
      });
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or risk storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("riskPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveRisk/i);
      expect(source).not.toMatch(/persistRisk/i);
    });
  });

  describe("no alerting", () => {
    test("module source declares alerting and monitoring disabled", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No alerting");
      expect(source).toContain("monitoringEnabled: false");
      expect(source).toContain("alertingEnabled: false");
      expect(source).not.toMatch(/setInterval/i);
      expect(source).not.toMatch(/setTimeout/i);
      expect(source).not.toMatch(/metrics\./i);
      expect(source).not.toMatch(/prometheus/i);
      expect(source).not.toMatch(/datadog/i);
      expect(source).not.toMatch(/sendAlert/i);
      expect(source).not.toMatch(/notify/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory risk constraints for phase 129", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 129");
      expect(source).toContain("assessRecruitmentWorkflowRisk");
      expect(source).toContain("advisoryRiskOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("risk assessment is not wired into health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
      const healthSource = read(HEALTH_MODULE_PATH);
      const evolutionSource = read(EVOLUTION_MODULE_PATH);
      const comparisonSource = read(COMPARISON_MODULE_PATH);
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const readinessSource = read(READINESS_MODULE_PATH);
      const reportSource = read(REPORT_MODULE_PATH);
      const snapshotSource = read(SNAPSHOT_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      expect(healthSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(healthSource).not.toMatch(/recruitmentWorkflowRiskAssessment/);
      expect(evolutionSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(comparisonSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(coordinatorSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(gatewaySource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(pipelineSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(workerSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(orchestratorSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(traceModelSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(registrySource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(readinessSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(reportSource).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(observationRegistrySource).not.toMatch(/assessRecruitmentWorkflowRisk/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowRiskAssessment/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowRiskAssessment/);

      const phase127Block = evolutionSource.slice(evolutionSource.indexOf("Phase 127"));
      expect(phase127Block).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(phase127Block).not.toMatch(/recruitmentWorkflowRiskAssessment/);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(/assessRecruitmentWorkflowRisk/);
      expect(phase128Block).not.toMatch(/recruitmentWorkflowRiskAssessment/);
    });

    test("orchestrator behavior remains unchanged and independent from risk assessment", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("riskLevel");
      expect(orchestration).not.toHaveProperty("riskFactors");
      expect(orchestration).not.toHaveProperty("impactAreas");
    });
  });
});
