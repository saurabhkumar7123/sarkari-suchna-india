"use strict";

/**
 * PWP Phase 5 — Read-only snapshot of the existing production workflow wiring.
 * This module inspects public contracts only; it never executes the workflow.
 */

const websiteChangeDetection = require("../../monitoringBot/websiteChangeDetection");
const telegramNotification = require("../../monitoringBot/telegramNotification");
const documentClassification = require("../../contentIntelligence/documentClassification");
const aiDraftPreparation = require("../../contentIntelligence/aiDraftPreparation");
const sourceIntelligence = require("../../contentIntelligence/sourceIntelligence");
const htmlExtraction = require("../../contentIntelligence/htmlExtraction");
const pdfExtraction = require("../../contentIntelligence/pdfExtraction");
const multiSourceCorrelation = require("../../contentIntelligence/multiSourceCorrelation");
const extractionQuality = require("../../contentIntelligence/extractionQuality");
const {
  PIPELINE_STAGE_ORDER,
  STATE_SEQUENCE,
  STAGE_TO_STATE,
  STAGE_IDS
} = require("../workflowStates");
const { STAGE_RUNNERS } = require("../stageRunners");
const {
  STAGE_STATUS,
  createStageInput,
  createStageResult
} = require("../pipelineContracts");
const {
  ORCHESTRATOR_ID,
  ORCHESTRATOR_VERSION
} = require("../workflowEngine");
const {
  ENGINE_ID: RESOLUTION_ENGINE_ID,
  ENGINE_VERSION: RESOLUTION_ENGINE_VERSION
} = require("../recruitmentResolution/resolutionTypes");
const generatorIntegration = require("../generatorIntegration");
const editorialWorkflow = require("../editorialWorkflow");
const {
  assertAutoPublishDisabled,
  PUBLISHING_POLICY
} = require("../publishingPolicy");

const EXPECTED_STAGE_ORDER = Object.freeze([
  STAGE_IDS.SOURCE_DETECTION,
  STAGE_IDS.CHANGE_DETECTION,
  STAGE_IDS.SOURCE_INTELLIGENCE_3A,
  STAGE_IDS.CONTENT_EXTRACTION_3B_3C,
  STAGE_IDS.MULTI_SOURCE_CORRELATION_3D,
  STAGE_IDS.EXTRACTION_QUALITY_3E,
  STAGE_IDS.RECRUITMENT_RESOLUTION,
  STAGE_IDS.DOCUMENT_INTELLIGENCE_P1,
  STAGE_IDS.AI_INTELLIGENCE_P2,
  STAGE_IDS.GENERATOR_DRAFT,
  STAGE_IDS.EDITORIAL_QUEUE,
  STAGE_IDS.TELEGRAM_NOTIFICATION,
  STAGE_IDS.READY_FOR_REVIEW,
  STAGE_IDS.MANUAL_PUBLISH_GATE
]);

const STAGE_NAMES = Object.freeze({
  [STAGE_IDS.SOURCE_DETECTION]: "Monitoring",
  [STAGE_IDS.CHANGE_DETECTION]: "Change Detection",
  [STAGE_IDS.SOURCE_INTELLIGENCE_3A]: "Program 3 — Source Intelligence",
  [STAGE_IDS.CONTENT_EXTRACTION_3B_3C]: "Program 3 — Content Extraction",
  [STAGE_IDS.MULTI_SOURCE_CORRELATION_3D]: "Program 3 — Correlation",
  [STAGE_IDS.EXTRACTION_QUALITY_3E]: "Program 3 — Extraction Quality",
  [STAGE_IDS.RECRUITMENT_RESOLUTION]: "Workflow Phase 2 — Recruitment Resolution",
  [STAGE_IDS.DOCUMENT_INTELLIGENCE_P1]: "Program 1 — Document Intelligence",
  [STAGE_IDS.AI_INTELLIGENCE_P2]: "Program 2 — Prepared Content Integration",
  [STAGE_IDS.GENERATOR_DRAFT]: "Workflow Phase 3 — Generator Boundary",
  [STAGE_IDS.EDITORIAL_QUEUE]: "Workflow Phase 4 — Editorial Boundary",
  [STAGE_IDS.TELEGRAM_NOTIFICATION]: "Telegram Notification",
  [STAGE_IDS.READY_FOR_REVIEW]: "Manual Review",
  [STAGE_IDS.MANUAL_PUBLISH_GATE]: "Manual Publish Gate"
});

const EXPECTED_VERSIONS = Object.freeze({
  orchestrator: "2.0.0",
  program3: "1.0.0",
  program1: "1.0.0",
  program2: "1.0.0",
  resolution: "1.0.0",
  generator: "1.0.0",
  editorial: "1.0.0"
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSnapshot(base, overrides) {
  if (!isObject(overrides)) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] =
      isObject(value) && isObject(base[key])
        ? mergeSnapshot(base[key], value)
        : Array.isArray(value)
          ? value.slice()
          : value;
  }
  return result;
}

function probePipelineContracts() {
  const input = createStageInput({
    workflowId: "readiness_probe",
    recruitmentId: "readiness_recruitment",
    workflowContext: { readOnly: true }
  });
  const result = createStageResult({
    status: STAGE_STATUS.SUCCESS,
    payload: { readOnly: true }
  });

  return {
    stageInputValid:
      input.workflowId === "readiness_probe" &&
      input.recruitmentId === "readiness_recruitment" &&
      isObject(input.workflowContext) &&
      Object.prototype.hasOwnProperty.call(input, "currentPayload") &&
      Object.prototype.hasOwnProperty.call(input, "previousStage"),
    stageResultValid:
      result.status === STAGE_STATUS.SUCCESS &&
      Array.isArray(result.warnings) &&
      Array.isArray(result.errors) &&
      isObject(result.executionSummary),
    supportedStatuses: Object.values(STAGE_STATUS)
  };
}

function buildProductionReadinessManifest(overrides = {}) {
  const publishing = assertAutoPublishDisabled();
  const generatorContract = generatorIntegration.buildGeneratorContract();
  const editorialContract = editorialWorkflow.buildEditorialContract();
  const program3Versions = [
    sourceIntelligence.ENGINE_VERSION,
    htmlExtraction.ENGINE_VERSION,
    pdfExtraction.ENGINE_VERSION,
    multiSourceCorrelation.ENGINE_VERSION,
    extractionQuality.ENGINE_VERSION
  ];
  const program3Version =
    new Set(program3Versions).size === 1
      ? program3Versions[0]
      : program3Versions.join("|");

  const base = {
    identifiers: {
      orchestratorId: ORCHESTRATOR_ID,
      readinessProbeId: "readiness_probe"
    },
    pipeline: {
      expectedStageOrder: EXPECTED_STAGE_ORDER.slice(),
      actualStageOrder: PIPELINE_STAGE_ORDER.slice(),
      stateSequence: STATE_SEQUENCE.slice(),
      stageToState: { ...STAGE_TO_STATE },
      runners: Object.fromEntries(
        EXPECTED_STAGE_ORDER.map((stageId) => [stageId, typeof STAGE_RUNNERS[stageId] === "function"])
      )
    },
    contracts: probePipelineContracts(),
    components: {
      monitoring: {
        available: typeof STAGE_RUNNERS[STAGE_IDS.SOURCE_DETECTION] === "function"
      },
      changeDetection: {
        available:
          typeof websiteChangeDetection.detectChange === "function" &&
          typeof STAGE_RUNNERS[STAGE_IDS.CHANGE_DETECTION] === "function"
      },
      program3: {
        available: [
          STAGE_IDS.SOURCE_INTELLIGENCE_3A,
          STAGE_IDS.CONTENT_EXTRACTION_3B_3C,
          STAGE_IDS.MULTI_SOURCE_CORRELATION_3D,
          STAGE_IDS.EXTRACTION_QUALITY_3E
        ].every((stageId) => typeof STAGE_RUNNERS[stageId] === "function"),
        version: program3Version,
        expectedVersion: EXPECTED_VERSIONS.program3
      },
      program1: {
        available:
          typeof documentClassification.classifyDocumentFromText === "function" &&
          typeof STAGE_RUNNERS[STAGE_IDS.DOCUMENT_INTELLIGENCE_P1] === "function",
        version: documentClassification.ENGINE_VERSION,
        expectedVersion: EXPECTED_VERSIONS.program1
      },
      program2: {
        available:
          typeof aiDraftPreparation.prepareAiDraftFromValidated === "function" &&
          typeof STAGE_RUNNERS[STAGE_IDS.AI_INTELLIGENCE_P2] === "function",
        version: aiDraftPreparation.ENGINE_VERSION,
        expectedVersion: EXPECTED_VERSIONS.program2
      },
      resolution: {
        available: typeof STAGE_RUNNERS[STAGE_IDS.RECRUITMENT_RESOLUTION] === "function",
        version: RESOLUTION_ENGINE_VERSION,
        expectedVersion: EXPECTED_VERSIONS.resolution,
        engineId: RESOLUTION_ENGINE_ID
      },
      generator: {
        available: typeof generatorIntegration.prepareGeneratorDraft === "function",
        version: generatorIntegration.ENGINE_VERSION,
        expectedVersion: EXPECTED_VERSIONS.generator
      },
      editorial: {
        available: typeof editorialWorkflow.prepareEditorialReview === "function",
        version: editorialWorkflow.ENGINE_VERSION,
        expectedVersion: EXPECTED_VERSIONS.editorial
      },
      telegram: {
        available:
          typeof telegramNotification.deliverTelegramNotification === "function" &&
          typeof STAGE_RUNNERS[STAGE_IDS.TELEGRAM_NOTIFICATION] === "function"
      },
      orchestrator: {
        available: EXPECTED_STAGE_ORDER.every(
          (stageId) => typeof STAGE_RUNNERS[stageId] === "function"
        ),
        version: ORCHESTRATOR_VERSION,
        expectedVersion: EXPECTED_VERSIONS.orchestrator
      }
    },
    boundaries: {
      generator: { ...generatorContract.boundaries },
      editorial: { ...editorialContract.boundaries },
      telegram: {
        available: typeof telegramNotification.deliverTelegramNotification === "function",
        requiresExplicitDelivery: true,
        automaticSending: false
      }
    },
    gates: {
      autoPublishEnabled: publishing.autoPublishEnabled,
      autoPublishBlocked: publishing.autoPublishBlocked,
      policyAutoPublishEnabled: PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED,
      manualPublishOnly: publishing.manualPublishOnly,
      manualApprovalRequired:
        editorialWorkflow.REVIEW_TRANSITIONS[
          editorialWorkflow.REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH
        ][editorialWorkflow.REVIEW_STATES.APPROVED] ===
        editorialWorkflow.REVIEW_STATES.READY_FOR_MANUAL_PUBLISH,
      noBypassPath:
        editorialWorkflow.REVIEW_TRANSITIONS[
          editorialWorkflow.REVIEW_ACTIONS.MARK_READY_FOR_MANUAL_PUBLISH
        ][editorialWorkflow.REVIEW_STATES.QUEUED] == null
    }
  };

  return mergeSnapshot(base, overrides);
}

module.exports = {
  EXPECTED_STAGE_ORDER,
  STAGE_NAMES,
  EXPECTED_VERSIONS,
  buildProductionReadinessManifest,
  mergeSnapshot
};
