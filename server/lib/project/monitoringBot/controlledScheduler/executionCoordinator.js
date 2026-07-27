'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Execution Coordinator
 *
 * Coordinates:
 *   Registry → MB-2 Detection → MB-3 Extraction → MB-4 Pipeline
 *   → TG-1 Notification → RW-1 Review Queue
 *
 * Provides execution diagnostics. No automatic publishing/approval.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  detectWebsiteChange,
  DETECTION_RESULT_STATUSES,
} = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');
const {
  extractRecruitment,
} = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const {
  runAdvisoryPipelineIntegration,
} = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');
const {
  deliverTelegramNotification,
  createNullTransport,
} = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const {
  wireAdvisoryCandidateToReviewQueue,
} = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');
const { createExecutionResult } = require('./executionResult');

const EXECUTION_COORDINATOR_VERSION = 'MB5.1.0.0';

function pushDiag(diagnostics, code, message, severity = 'INFO') {
  diagnostics.push({ code, message, severity });
}

/**
 * Coordinate one source advisory execution cycle.
 * @param {object} [input]
 */
async function coordinateSourceExecution(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const started = new Date().toISOString();
  const startedMs = Date.now();
  const sourceId =
    typeof src.sourceId === 'string' && src.sourceId.trim()
      ? src.sourceId.trim()
      : null;
  const executionId =
    typeof src.executionId === 'string' && src.executionId.trim()
      ? src.executionId.trim()
      : `exec_${sourceId || 'unknown'}_${startedMs}`;

  const diagnostics = [];
  const errors = [];
  const warnings = [];
  const cancelToken =
    src.cancelToken && typeof src.cancelToken === 'object'
      ? src.cancelToken
      : { cancelled: false };

  const timeoutMs =
    typeof src.executionTimeoutMs === 'number' &&
    Number.isFinite(src.executionTimeoutMs) &&
    src.executionTimeoutMs > 0
      ? Math.floor(src.executionTimeoutMs)
      : null;

  let timedOut = false;
  let cancelled = false;
  let detectionResult = null;
  let extractionResult = null;
  let pipelineResult = null;
  let notificationResult = null;
  let reviewResult = null;

  function checkCancelOrTimeout() {
    if (cancelToken.cancelled === true) {
      cancelled = true;
      return 'CANCELLED';
    }
    if (timeoutMs != null && Date.now() - startedMs >= timeoutMs) {
      timedOut = true;
      return 'TIMED_OUT';
    }
    return null;
  }

  pushDiag(
    diagnostics,
    'COORDINATOR_START',
    `Starting coordinated execution for ${sourceId || 'UNKNOWN'}`
  );

  if (!sourceId) {
    errors.push({ code: 'MISSING_SOURCE_ID', message: 'sourceId is required' });
    return createExecutionResult({
      executionId,
      source: null,
      sourceId: null,
      started,
      finished: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      status: 'FAILED',
      errors,
      warnings,
      diagnostics: { steps: diagnostics },
    });
  }

  try {
    let stop = checkCancelOrTimeout();
    if (stop) {
      warnings.push({ code: stop, message: `Stopped before detection: ${stop}` });
    } else if (src.detectionResult) {
      detectionResult = src.detectionResult;
      pushDiag(diagnostics, 'DETECTION_INJECTED', 'Using injected detection result');
    } else {
      detectionResult = await detectWebsiteChange({
        sourceId,
        previousFingerprint: src.previousFingerprint,
        transport: src.detectionTransport || src.transport,
        sourceRegistry: src.sourceRegistry,
        monitoringConfiguration: src.monitoringConfiguration,
        crawlPolicy: src.crawlPolicy,
        timestamp: src.timestamp || started,
      });
      pushDiag(
        diagnostics,
        'DETECTION_COMPLETE',
        `Detection status: ${detectionResult.detectionStatus}`
      );
    }

    stop = checkCancelOrTimeout();
    const changed =
      detectionResult &&
      detectionResult.detectionStatus === DETECTION_RESULT_STATUSES.CHANGED;

    if (!stop && (changed || src.forceExtract === true)) {
      if (src.extractionResult) {
        extractionResult = src.extractionResult;
        pushDiag(
          diagnostics,
          'EXTRACTION_INJECTED',
          'Using injected extraction result'
        );
      } else {
        extractionResult = extractRecruitment({
          sourceId,
          detectionResult,
          body: src.body,
          content: src.content,
          html: src.html,
          forceExtract: src.forceExtract === true,
          sourceRegistry: src.sourceRegistry,
          monitoringConfiguration: src.monitoringConfiguration,
          parserRegistry: src.parserRegistry,
          timestamp: src.timestamp || started,
        });
        pushDiag(
          diagnostics,
          'EXTRACTION_COMPLETE',
          `Extraction status: ${extractionResult.extractionStatus}`
        );
        if (
          extractionResult.diagnostics &&
          Array.isArray(extractionResult.diagnostics.warnings)
        ) {
          for (const warning of extractionResult.diagnostics.warnings) {
            warnings.push({
              code: 'EXTRACTION_WARNING',
              message:
                typeof warning === 'string'
                  ? warning
                  : warning.message || String(warning),
            });
          }
        }
      }
    } else if (!stop && detectionResult) {
      pushDiag(
        diagnostics,
        'EXTRACTION_SKIPPED',
        `Extraction skipped because detection status is ${detectionResult.detectionStatus}`
      );
    }

    stop = checkCancelOrTimeout();
    if (!stop && extractionResult && extractionResult.candidate) {
      if (src.pipelineResult) {
        pipelineResult = src.pipelineResult;
        pushDiag(diagnostics, 'PIPELINE_INJECTED', 'Using injected pipeline result');
      } else {
        pipelineResult = runAdvisoryPipelineIntegration({
          sourceId,
          extraction: extractionResult,
          candidate: extractionResult.candidate,
          recruitment: extractionResult.recruitment,
          duplicate: extractionResult.duplicate,
          detectionTime:
            (detectionResult && detectionResult.timestamp) || started,
          timestamp: src.timestamp || started,
          skipProgram5Stages: src.skipProgram5Stages === true,
          relatedCandidates: src.relatedCandidates,
        });
        pushDiag(
          diagnostics,
          'PIPELINE_COMPLETE',
          'Advisory Program 5 pipeline integration complete'
        );
      }
    } else if (!stop && !extractionResult) {
      pushDiag(
        diagnostics,
        'PIPELINE_SKIPPED',
        'Pipeline skipped — no extraction candidate'
      );
    }

    stop = checkCancelOrTimeout();
    if (!stop && pipelineResult) {
      const candidate =
        pipelineResult.pipelinePayload &&
        pipelineResult.pipelinePayload.candidate;
      const recruitment =
        (extractionResult && extractionResult.recruitment) ||
        (candidate && candidate.structuredRecruitment) ||
        {};
      const duplicateStatus =
        (pipelineResult.pipelinePayload &&
          pipelineResult.pipelinePayload.duplicateStatus) ||
        (extractionResult &&
          extractionResult.duplicate &&
          extractionResult.duplicate.duplicateStatus);

      notificationResult = await deliverTelegramNotification({
        allowDelivery: src.allowNotificationDelivery === true,
        transport: src.notificationTransport || createNullTransport(),
        policy: src.notificationPolicy,
        context: {
          success: true,
          duplicateStatus,
          extractionWarnings: warnings
            .filter((w) => w.code === 'EXTRACTION_WARNING')
            .map((w) => w.message),
          validationIssues:
            (pipelineResult.diagnostics &&
              pipelineResult.diagnostics.issues) ||
            [],
        },
        recruitmentTitle:
          recruitment.recruitmentTitle ||
          recruitment.title ||
          (candidate && candidate.title),
        department: recruitment.department,
        source: sourceId,
        confidence:
          (pipelineResult.pipelinePayload &&
            pipelineResult.pipelinePayload.confidence) ||
          (candidate && candidate.confidence),
        detectionTime:
          (detectionResult && detectionResult.timestamp) || started,
        reviewIdentifier: candidate && candidate.candidateId,
        summary:
          recruitment.summary ||
          `Advisory candidate from ${sourceId} ready for operator review.`,
        officialUrl:
          recruitment.officialUrl ||
          (candidate && candidate.sourceUrl),
      });
      pushDiag(
        diagnostics,
        'NOTIFICATION_COMPLETE',
        `Notification reason: ${notificationResult.reason}`
      );

      reviewResult = wireAdvisoryCandidateToReviewQueue({
        pipelineResult,
        candidate,
        duplicate: extractionResult && extractionResult.duplicate,
        timestamp: src.timestamp || started,
      });
      pushDiag(
        diagnostics,
        'REVIEW_WIRING_COMPLETE',
        `Review recommendation: ${reviewResult.operatorReview.advisoryRecommendation}`
      );
    }
  } catch (error) {
    errors.push({
      code: 'COORDINATOR_EXCEPTION',
      message: error && error.message ? error.message : String(error),
    });
    pushDiag(
      diagnostics,
      'COORDINATOR_EXCEPTION',
      errors[errors.length - 1].message,
      'ERROR'
    );
  }

  const finished = new Date().toISOString();
  const status = cancelled
    ? 'CANCELLED'
    : timedOut
      ? 'TIMED_OUT'
      : errors.length
        ? 'FAILED'
        : 'COMPLETED';

  return createExecutionResult({
    executionId,
    source: sourceId,
    sourceId,
    started,
    finished,
    durationMs: Date.now() - startedMs,
    status,
    cancelled,
    timedOut,
    detectionResult,
    extractionResult,
    pipelineResult,
    notificationResult,
    reviewResult,
    errors,
    warnings,
    diagnostics: {
      coordinatorVersion: EXECUTION_COORDINATOR_VERSION,
      steps: diagnostics,
    },
    effects: {
      published: false,
      approved: false,
      databaseWritten: false,
      telegramAutoSent: false,
      notificationAttempted: !!(
        notificationResult && notificationResult.attempted
      ),
      reviewPayloadGenerated: !!reviewResult,
      schedulerBackground: false,
    },
  });
}

module.exports = {
  EXECUTION_COORDINATOR_VERSION,
  coordinateSourceExecution,
  DETECTION_RESULT_STATUSES,
};
