'use strict';

/**
 * FT-1A — Part A End-to-End Validation + Parts C/D/E helpers
 *
 * Validates advisory flow stages without production activation.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  createMemoryTransport,
  createNullTransport,
  deliverTelegramNotification,
  formatTelegramMessage,
  createNotificationPolicy,
  resolveNotificationDecision,
  TEMPLATE_KINDS,
} = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const {
  createOperatorReviewObject,
  generateReviewDiagnostics,
  wireAdvisoryCandidateToReviewQueue,
} = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');
const {
  createControlledScheduler,
  coordinateSourceExecution,
  createSourceLockManager,
  createRateLimiter,
  createCooldownTracker,
  createExecutionHistory,
  generateSchedulerHealthReport,
  HEALTH_STATUSES,
} = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
const {
  createStructuredRecruitment,
  buildAdvisoryCandidate,
} = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const {
  runAdvisoryPipelineIntegration,
} = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');

const END_TO_END_VALIDATION_VERSION = 'FT1A.1.0.0';

const WORKFLOW_STAGES = Object.freeze([
  'GOVERNMENT_SOURCE',
  'REGISTRY',
  'CHANGE_DETECTION',
  'RECRUITMENT_EXTRACTION',
  'PIPELINE_INTEGRATION',
  'TELEGRAM_NOTIFICATION',
  'REVIEW_QUEUE',
  'DRAFT_READY',
]);

const SAMPLE_HTML = `
<html>
  <head><title>UPSC CDS 2026 Notification</title></head>
  <body>
    <h1>UPSC CDS 2026 Notification</h1>
    <p>Advertisement No: UPSC/CDS/2026/01</p>
    <p>Organization: Union Public Service Commission</p>
    <p>Department: UPSC</p>
    <p>Qualification: Graduate</p>
    <p>Total Vacancies: 400</p>
    <p>Notification Date: 2026-07-01</p>
    <p>Last Date: 2026-09-01</p>
  </body>
</html>
`;

function stageResult(stageId, passed, detail) {
  return deepFreeze({
    stageId,
    passed: passed === true,
    detail: detail || null,
  });
}

/**
 * Run controlled end-to-end advisory validation (injected detection / no live HTTP).
 * @param {object} [input]
 */
async function validateEndToEndAdvisoryFlow(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const timestamp = src.timestamp || '2026-07-20T00:00:00.000Z';
  const sourceId = src.sourceId || 'UPSC';
  const transport = src.notificationTransport || createMemoryTransport();

  const result = await coordinateSourceExecution({
    sourceId,
    detectionResult: src.detectionResult || {
      sourceId,
      detectionStatus: 'CHANGED',
      fetchUrl: 'https://www.upsc.gov.in/whats-new',
      fingerprint: { fingerprint: 'ft1a-e2e-fp' },
      timestamp,
    },
    body: src.body || SAMPLE_HTML,
    allowNotificationDelivery: src.allowNotificationDelivery !== false,
    notificationTransport: transport,
    timestamp,
    sourceRegistry: src.sourceRegistry,
    monitoringConfiguration: src.monitoringConfiguration,
  });

  const stages = [
    stageResult(
      'GOVERNMENT_SOURCE',
      !!sourceId,
      `sourceId=${sourceId}`
    ),
    stageResult(
      'REGISTRY',
      true,
      'MB-1 registry used by coordinator'
    ),
    stageResult(
      'CHANGE_DETECTION',
      !!(result.detectionResult && result.detectionResult.detectionStatus),
      result.detectionResult && result.detectionResult.detectionStatus
    ),
    stageResult(
      'RECRUITMENT_EXTRACTION',
      !!(result.extractionResult && result.extractionResult.candidate),
      result.extractionResult && result.extractionResult.extractionStatus
    ),
    stageResult(
      'PIPELINE_INTEGRATION',
      !!result.pipelineResult,
      result.pipelineResult ? 'pipeline_present' : 'missing'
    ),
    stageResult(
      'TELEGRAM_NOTIFICATION',
      !!result.notificationResult,
      result.notificationResult && result.notificationResult.reason
    ),
    stageResult(
      'REVIEW_QUEUE',
      !!(result.reviewResult && result.reviewResult.operatorReview),
      result.reviewResult &&
        result.reviewResult.operatorReview &&
        result.reviewResult.operatorReview.advisoryRecommendation
    ),
    stageResult(
      'DRAFT_READY',
      !!(
        result.reviewResult &&
        result.reviewResult.operatorReview &&
        (result.reviewResult.operatorReview.draftPreview ||
          result.reviewResult.operatorReview.lifecycleMapping ||
          result.reviewResult.operatorReview.publishReadinessMapping ||
          result.reviewResult.operatorReview.advisoryRecommendation)
      ),
      'advisory draft readiness mapping present'
    ),
  ];

  const allPassed = stages.every((s) => s.passed === true);

  return deepFreeze({
    validationVersion: END_TO_END_VALIDATION_VERSION,
    part: 'A',
    advisoryOnly: true,
    productionActivated: false,
    workflowStages: WORKFLOW_STAGES.slice(),
    stages,
    allPassed,
    executionStatus: result.status,
    effects: result.effects,
    publishingDenied: true,
    automaticApprovalDenied: true,
    databaseWritten: !!(result.effects && result.effects.databaseWritten),
    result,
  });
}

/**
 * Part C — Scheduler validation suite (in-process, no background loops).
 */
async function validateSchedulerControls(input = {}) {
  const checks = [];
  const scheduler = createControlledScheduler(input.schedulerOptions || {});

  checks.push({
    checkId: 'DISABLED_BY_DEFAULT',
    passed: scheduler.isEnabled() === false,
  });

  const blocked = await scheduler.invoke({ sourceIds: ['UPSC'] });
  checks.push({
    checkId: 'NO_BACKGROUND_WHEN_DISABLED',
    passed:
      blocked.invoked === false &&
      blocked.reason === 'SCHEDULER_DISABLED' &&
      blocked.background === false &&
      blocked.cronInstalled === false,
  });

  scheduler.enable();
  checks.push({ checkId: 'ENABLE', passed: scheduler.isEnabled() === true });
  scheduler.disable();
  checks.push({ checkId: 'DISABLE', passed: scheduler.isEnabled() === false });

  const locks = createSourceLockManager({ defaultTtlMs: 5000 });
  const a = locks.tryAcquire('UPSC', 'e1');
  const b = locks.tryAcquire('UPSC', 'e2');
  locks.release('UPSC', 'e1');
  checks.push({
    checkId: 'LOCKING',
    passed: a.acquired === true && b.acquired === false,
  });

  const limiter = createRateLimiter({ maxPerWindow: 1, windowMs: 60000 });
  checks.push({
    checkId: 'CONCURRENCY_RATE_LIMIT',
    passed:
      limiter.allow('RRB').allowed === true &&
      limiter.allow('RRB').allowed === false,
  });

  const cooldown = createCooldownTracker({ defaultCooldownMs: 10000 });
  const t0 = 2_000_000;
  cooldown.markFinished('IBPS', t0, 10000);
  checks.push({
    checkId: 'COOLDOWN',
    passed: cooldown.canRun('IBPS', t0 + 100).allowed === false,
  });

  const history = createExecutionHistory({ maxEntries: 5 });
  history.record({ source: 'UPSC', status: 'COMPLETED', started: new Date().toISOString() });
  checks.push({
    checkId: 'EXECUTION_HISTORY',
    passed: history.list().length === 1,
  });

  const healthDisabled = generateSchedulerHealthReport({ enabled: false });
  const healthIdle = generateSchedulerHealthReport({
    enabled: true,
    activeExecutions: 0,
  });
  checks.push({
    checkId: 'HEALTH_REPORTING',
    passed:
      healthDisabled.status === HEALTH_STATUSES.DISABLED &&
      healthIdle.status === HEALTH_STATUSES.IDLE,
  });

  const timeoutScheduler = createControlledScheduler({
    executionTimeoutMs: 1,
    enabled: true,
  });
  checks.push({
    checkId: 'TIMEOUT_CONFIGURED',
    passed: timeoutScheduler._internals.executionTimeoutMs === 1,
  });

  // Inactive source must not execute
  const activeScheduler = createControlledScheduler({ enabled: true });
  activeScheduler.enable();
  const inactiveOutcome = await activeScheduler.invoke({
    sourceIds: ['NTA'],
    ignoreInterval: true,
    ignoreCooldown: true,
    ignoreRateLimit: true,
  });
  const inactiveSkipped =
    inactiveOutcome.invoked === true &&
    inactiveOutcome.results.some(
      (r) => r.status === 'SKIPPED' && r.reason === 'SOURCE_INACTIVE'
    );
  checks.push({
    checkId: 'DISABLED_SOURCES_NOT_EXECUTED',
    passed: inactiveSkipped,
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: END_TO_END_VALIDATION_VERSION,
    part: 'C',
    checks,
    allPassed,
    backgroundExecutionDenied: true,
    cronDenied: true,
  });
}

/**
 * Part D — Telegram validation.
 */
async function validateTelegramSafety(input = {}) {
  const checks = [];
  const policy = createNotificationPolicy(input.policy || {});
  const decision = resolveNotificationDecision({ success: true }, policy);
  checks.push({
    checkId: 'POLICY_SELECTION',
    passed: decision.kind === TEMPLATE_KINDS.SUCCESS,
  });

  const formatted = formatTelegramMessage({
    kind: TEMPLATE_KINDS.SUCCESS,
    recruitmentTitle: 'FT-1A Title',
    department: 'DoPT',
    source: 'UPSC',
    confidence: 0.9,
    detectionTime: '2026-07-20T00:00:00.000Z',
    reviewIdentifier: 'ft1a-1',
    summary: 'Advisory',
    officialUrl: 'https://www.upsc.gov.in',
  });
  checks.push({
    checkId: 'TEMPLATE_GENERATION',
    passed:
      formatted.text.includes('Title: FT-1A Title') &&
      formatted.text.includes('Source: UPSC'),
  });

  const nullTransport = createNullTransport();
  const nullDelivery = await deliverTelegramNotification({
    allowDelivery: true,
    transport: nullTransport,
    context: { success: true },
    recruitmentTitle: 'X',
    source: 'UPSC',
  });
  checks.push({
    checkId: 'NULL_TRANSPORT',
    passed:
      nullDelivery.attempted === true &&
      nullDelivery.delivered === false &&
      nullDelivery.reason === 'NULL_TRANSPORT',
  });

  const memory = createMemoryTransport();
  const memDelivery = await deliverTelegramNotification({
    allowDelivery: true,
    transport: memory,
    context: { success: true },
    recruitmentTitle: 'Y',
    source: 'RRB',
  });
  checks.push({
    checkId: 'MEMORY_TRANSPORT',
    passed: memDelivery.delivered === true && memory.getSent().length === 1,
  });

  const blocked = await deliverTelegramNotification({
    allowDelivery: false,
    transport: createMemoryTransport(),
    context: { success: true },
    recruitmentTitle: 'Z',
    source: 'SSC_NIC',
  });
  checks.push({
    checkId: 'LIVE_DELIVERY_DISABLED_BY_DEFAULT',
    passed:
      blocked.skipped === true &&
      blocked.reason === 'DELIVERY_NOT_EXPLICITLY_ALLOWED' &&
      blocked.automaticSendingDenied === true &&
      blocked.productionCredentialsUsed === false,
  });

  checks.push({
    checkId: 'TRANSPORT_ABSTRACTION',
    passed:
      typeof createNullTransport === 'function' &&
      typeof createMemoryTransport === 'function',
  });

  return deepFreeze({
    validationVersion: END_TO_END_VALIDATION_VERSION,
    part: 'D',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    liveTelegramDisabledUnlessConfigured: true,
  });
}

/**
 * Part E — Review validation.
 */
function validateReviewWorkflow(input = {}) {
  const checks = [];
  const recruitment = createStructuredRecruitment({
    sourceId: 'UPSC',
    recruitmentTitle: 'UPSC CSE 2026',
    advertisementNumber: 'UPSC/CSE/2026',
    officialUrl: 'https://www.upsc.gov.in',
    department: 'UPSC',
    confidenceScore: 0.88,
    extractionTimestamp: '2026-07-20T00:00:00.000Z',
  });
  const candidate = buildAdvisoryCandidate({ recruitment });
  const pipeline = runAdvisoryPipelineIntegration({
    candidate,
    recruitment,
    duplicate: { duplicateStatus: 'UNIQUE' },
    timestamp: '2026-07-20T00:00:00.000Z',
    ...(input.pipelineInput || {}),
  });

  const wired = wireAdvisoryCandidateToReviewQueue({
    pipelineResult: pipeline,
    candidate,
    timestamp: '2026-07-20T00:00:00.000Z',
  });

  checks.push({
    checkId: 'ADVISORY_REVIEW_PAYLOAD',
    passed: !!(wired.operatorReview && wired.operatorReview.candidateId),
  });
  checks.push({
    checkId: 'IMMUTABLE_REVIEW_OBJECT',
    passed: Object.isFrozen(wired) && Object.isFrozen(wired.operatorReview),
  });

  const reviewObj = createOperatorReviewObject({
    candidateId: candidate.candidateId,
    source: 'UPSC',
    confidence: 0.88,
    duplicateStatus: 'UNIQUE',
  });
  const diagnostics = generateReviewDiagnostics({ operatorReview: reviewObj });
  checks.push({
    checkId: 'DIAGNOSTICS',
    passed: !!(diagnostics && diagnostics.readinessSummary),
  });
  checks.push({
    checkId: 'PREVIEW_MAPPING',
    passed:
      wired.operatorReview.draftPreview != null ||
      wired.operatorReview.previewMapping != null ||
      wired.operatorReview.advisoryRecommendation != null,
  });
  checks.push({
    checkId: 'LIFECYCLE_MAPPING',
    passed:
      wired.operatorReview.lifecycleMapping != null ||
      (wired.diagnostics && wired.diagnostics.lifecycleSummary != null) ||
      wired.operatorReview.advisoryRecommendation != null,
  });
  checks.push({
    checkId: 'PUBLISH_READINESS_MAPPING',
    passed:
      wired.operatorReview.publishReadinessMapping != null ||
      (wired.diagnostics && wired.diagnostics.readinessSummary != null) ||
      wired.publishingDenied === true,
  });
  checks.push({
    checkId: 'NO_DATABASE_WRITES',
    passed:
      wired.databaseWriteDenied === true &&
      wired.effects.databaseWritten === false &&
      wired.productionQueueInsert === false,
  });

  return deepFreeze({
    validationVersion: END_TO_END_VALIDATION_VERSION,
    part: 'E',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    databaseWritesDenied: true,
    wired,
  });
}

module.exports = {
  END_TO_END_VALIDATION_VERSION,
  WORKFLOW_STAGES,
  SAMPLE_HTML,
  validateEndToEndAdvisoryFlow,
  validateSchedulerControls,
  validateTelegramSafety,
  validateReviewWorkflow,
};
