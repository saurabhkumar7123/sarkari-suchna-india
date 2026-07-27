'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-4
 * Pipeline Integrator (Advisory / No Runtime Activation)
 *
 * Reuses Program 5 packages 5A–5F in advisory mode only.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  evaluatePipelineHealth,
} = require('../../program5/package5APipelineHealthAndDiagnosticsFramework');
const {
  integrateMonitoringCandidateToReview,
} = require('../../program5/package5BMonitoringReviewIntegrationFramework');
const {
  evaluateControlledLifecycle,
  LIFECYCLE_STATES,
} = require('../../program5/package5CControlledLifecycleEngineFramework');
const {
  prepareDraftFromReviewPayload,
} = require('../../program5/package5DDraftPreparationFramework');
const {
  resolveControlledCandidates,
} = require('../../program5/package5EControlledCandidateResolutionFramework');
const {
  evaluatePublishReadinessAuthorization,
} = require('../../program5/package5FControlledPublishReadinessAuthorizationFramework');

const {
  mapToAdvisoryPipelinePayload,
} = require('./advisoryPipelinePayload');
const {
  generateAdvisoryPreviewPayload,
} = require('./previewPayload');
const {
  generateIntegrationDiagnostics,
} = require('./integrationDiagnostics');

const PIPELINE_INTEGRATOR_VERSION = 'MB4.1.0.0';

/**
 * Integrate an MB-3 advisory candidate with Program 5 advisory pipeline.
 * No runtime activation. No publishing. No page generation.
 *
 * @param {object} [input]
 */
function integrateAdvisoryCandidateWithPipeline(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const timestamp =
    typeof src.timestamp === 'string' && src.timestamp.trim()
      ? src.timestamp.trim()
      : new Date().toISOString();

  const extraction = src.extraction || null;
  const candidate =
    src.candidate ||
    (extraction && extraction.candidate) ||
    null;
  const recruitment =
    src.recruitment ||
    (extraction && extraction.recruitment) ||
    (candidate && candidate.structuredRecruitment) ||
    null;
  const duplicate =
    src.duplicate ||
    (extraction && extraction.duplicate) ||
    null;

  const pipelinePayload = mapToAdvisoryPipelinePayload({
    candidate,
    recruitment,
    extraction,
    duplicate,
    detectionTime: src.detectionTime || timestamp,
  });

  const skipStages = src.skipProgram5Stages === true;

  let pipelineHealth = null;
  let monitoringReview = null;
  let lifecycle = null;
  let draft = null;
  let resolution = null;
  let publishReadiness = null;

  if (!skipStages) {
    pipelineHealth = evaluatePipelineHealth(src.pipelineHealthInput || {});

    monitoringReview = integrateMonitoringCandidateToReview({
      candidate: pipelinePayload.candidate,
      ...(src.reviewInput || {}),
    });

    lifecycle = evaluateControlledLifecycle({
      currentState: LIFECYCLE_STATES.DETECTED,
      proposedNextState: LIFECYCLE_STATES.NORMALIZED,
      gateObservations: {
        monitoringCandidatePresent: true,
        confidence:
          typeof pipelinePayload.confidence === 'number'
            ? pipelinePayload.confidence
            : 0,
        ...(src.lifecycleGateObservations || {}),
      },
      ...(src.lifecycleInput || {}),
    });

    const reviewPayload =
      (monitoringReview &&
        monitoringReview.adapter &&
        monitoringReview.adapter.reviewPayload) ||
      (monitoringReview && monitoringReview.preview) ||
      {
        candidateId: pipelinePayload.candidate.candidateId,
        source: pipelinePayload.candidate.source,
        sourceUrl: pipelinePayload.candidate.sourceUrl,
        title: pipelinePayload.mapping.title,
        confidence: pipelinePayload.confidence,
      };

    draft = prepareDraftFromReviewPayload({
      reviewPayload,
      sourceCandidateId: pipelinePayload.candidate.candidateId,
      lifecycleStateHint: LIFECYCLE_STATES.DRAFT_READY,
      generatedTimestamp: timestamp,
      ...(src.draftInput || {}),
    });

    const relatedCandidates = Array.isArray(src.relatedCandidates)
      ? src.relatedCandidates.slice()
      : [];
    resolution = resolveControlledCandidates({
      candidates: [pipelinePayload.candidate, ...relatedCandidates],
      generatedTimestamp: timestamp,
      ...(src.resolutionInput || {}),
    });

    publishReadiness = evaluatePublishReadinessAuthorization({
      evaluationTimestamp: timestamp,
      lifecycleCurrentState: 'DETECTED',
      pipelineHealthStatus:
        (pipelineHealth && pipelineHealth.overallHealth) || 'UNKNOWN',
      draftReady: false,
      humanApprovals: [],
      rollback: { ready: false },
      backup: { ready: false },
      additionalBlockingIssues: [
        {
          code: 'MB4_ADVISORY_ONLY',
          message: 'MB-4 pipeline integration is advisory — publishing denied',
        },
      ],
      ...(src.publishReadinessInput || {}),
    });
  }

  const preview = generateAdvisoryPreviewPayload({
    pipelinePayload,
    reviewIntegration: monitoringReview,
    lifecycle,
    draft,
    resolution,
    publishReadiness,
  });

  const diagnostics = generateIntegrationDiagnostics({
    pipelinePayload,
    preview,
    confidence: pipelinePayload.confidence,
    duplicateStatus: pipelinePayload.duplicateStatus,
    program5: {
      pipelineHealth,
      monitoringReview,
      lifecycle,
      draft,
      resolution,
      publishReadiness,
    },
  });

  return deepFreeze({
    integratorVersion: PIPELINE_INTEGRATOR_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    deterministic: true,
    runtimeActivationDenied: true,
    publishingDenied: true,
    pageGenerationDenied: true,
    telegramDenied: true,
    schedulerDenied: true,

    timestamp,
    pipelinePayload,
    preview,
    diagnostics,

    program5: {
      pipelineHealth,
      monitoringReview,
      lifecycle,
      draft,
      resolution,
      publishReadiness,
    },

    reusedModules: Object.freeze({
      lifecycleEngine: true,
      draftPreparation: true,
      candidateResolution: true,
      publishReadiness: true,
      monitoringReview: true,
      pipelineHealth: true,
    }),

    effects: {
      runtimeActivated: false,
      databaseWritten: false,
      reviewQueueCreated: false,
      published: false,
      pageGenerated: false,
      telegramSent: false,
      schedulerStarted: false,
      workerStarted: false,
      redisUsed: false,
      routesCreated: false,
    },
  });
}

module.exports = {
  PIPELINE_INTEGRATOR_VERSION,
  integrateAdvisoryCandidateWithPipeline,
  LIFECYCLE_STATES,
};
