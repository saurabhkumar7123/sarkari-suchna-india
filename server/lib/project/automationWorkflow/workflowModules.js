'use strict';

/**
 * AMP-2 Automation Workflow modules.
 *
 * Cohesive advisory-only workflow layer that coordinates:
 * - workflow state management
 * - draft package preparation
 * - review queue payloads
 * - Telegram review message formatting
 * - audit logging
 * - metrics
 * - failure recovery
 * - versioning
 *
 * No publishing. No persistence. No runtime activation.
 */

const {
  deepFreeze,
  isPlainObject,
  pickString,
  stableHash,
  normalizeUrl,
} = require('../recruitmentIntelligence/utils');
const {
  prepareDraftFromReviewPayload,
} = require('../program5/package5DDraftPreparationFramework');

const WORKFLOW_MODULES_VERSION = 'AMP2.1.0.0';

const WORKFLOW_STATES = Object.freeze({
  DETECTED: 'Detected',
  FETCHING: 'Fetching',
  HISTORY_RECOVERY: 'History Recovery',
  MATCHING: 'Matching',
  VALIDATED: 'Validated',
  DRAFT_READY: 'Draft Ready',
  TELEGRAM_PENDING: 'Telegram Pending',
  REVIEW_PENDING: 'Review Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED_FUTURE: 'Published (future)',
  FAILED: 'Failed',
  RETRY: 'Retry',
});

const APPROVAL_STATES = Object.freeze({
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NEEDS_CHANGES: 'Needs Changes',
  FUTURE_PUBLISH: 'Future Publish',
});

const FAILURE_ACTIONS = Object.freeze({
  RETRY: 'RETRY',
  RESUME: 'RESUME',
  ABORT: 'ABORT',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  ROLLBACK_STATE: 'ROLLBACK_STATE',
});

const STATE_SEQUENCE = Object.freeze([
  WORKFLOW_STATES.DETECTED,
  WORKFLOW_STATES.FETCHING,
  WORKFLOW_STATES.HISTORY_RECOVERY,
  WORKFLOW_STATES.MATCHING,
  WORKFLOW_STATES.VALIDATED,
  WORKFLOW_STATES.DRAFT_READY,
  WORKFLOW_STATES.TELEGRAM_PENDING,
  WORKFLOW_STATES.REVIEW_PENDING,
  WORKFLOW_STATES.APPROVED,
  WORKFLOW_STATES.REJECTED,
  WORKFLOW_STATES.PUBLISHED_FUTURE,
  WORKFLOW_STATES.FAILED,
  WORKFLOW_STATES.RETRY,
]);

const DEFAULT_TRANSITIONS = Object.freeze({
  [WORKFLOW_STATES.DETECTED]: Object.freeze([
    WORKFLOW_STATES.FETCHING,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.FETCHING]: Object.freeze([
    WORKFLOW_STATES.HISTORY_RECOVERY,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.HISTORY_RECOVERY]: Object.freeze([
    WORKFLOW_STATES.MATCHING,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.MATCHING]: Object.freeze([
    WORKFLOW_STATES.VALIDATED,
    WORKFLOW_STATES.REVIEW_PENDING,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.VALIDATED]: Object.freeze([
    WORKFLOW_STATES.DRAFT_READY,
    WORKFLOW_STATES.REVIEW_PENDING,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.DRAFT_READY]: Object.freeze([
    WORKFLOW_STATES.TELEGRAM_PENDING,
    WORKFLOW_STATES.REVIEW_PENDING,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.TELEGRAM_PENDING]: Object.freeze([
    WORKFLOW_STATES.REVIEW_PENDING,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.REVIEW_PENDING]: Object.freeze([
    WORKFLOW_STATES.APPROVED,
    WORKFLOW_STATES.REJECTED,
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.APPROVED]: Object.freeze([
    WORKFLOW_STATES.PUBLISHED_FUTURE,
    WORKFLOW_STATES.RETRY,
  ]),
  [WORKFLOW_STATES.REJECTED]: Object.freeze([
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.FAILED,
  ]),
  [WORKFLOW_STATES.PUBLISHED_FUTURE]: Object.freeze([]),
  [WORKFLOW_STATES.FAILED]: Object.freeze([
    WORKFLOW_STATES.RETRY,
    WORKFLOW_STATES.REVIEW_PENDING,
  ]),
  [WORKFLOW_STATES.RETRY]: Object.freeze([
    WORKFLOW_STATES.FETCHING,
    WORKFLOW_STATES.MATCHING,
    WORKFLOW_STATES.VALIDATED,
    WORKFLOW_STATES.DRAFT_READY,
    WORKFLOW_STATES.REVIEW_PENDING,
    WORKFLOW_STATES.FAILED,
  ]),
});

function ensureArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function normalizeWarnings(warnings) {
  return ensureArray(warnings)
    .map((item) => pickString(item))
    .filter(Boolean);
}

function flattenSections(prefix, value, entries) {
  if (Array.isArray(value)) {
    entries.push([prefix, JSON.stringify(value)]);
    return;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      flattenSections(prefix ? `${prefix}.${key}` : key, value[key], entries);
    }
    return;
  }
  entries.push([prefix, value == null ? '' : String(value)]);
}

function mapEntries(value) {
  const entries = [];
  if (isPlainObject(value)) {
    flattenSections('', value, entries);
  }
  return entries;
}

function buildChangeSummary(changeSet) {
  const parts = [];
  if (changeSet.addedSections.length) {
    parts.push(`${changeSet.addedSections.length} added`);
  }
  if (changeSet.updatedSections.length) {
    parts.push(`${changeSet.updatedSections.length} updated`);
  }
  if (changeSet.removedSections.length) {
    parts.push(`${changeSet.removedSections.length} removed`);
  }
  if (changeSet.changedDates.length) {
    parts.push(`${changeSet.changedDates.length} date changes`);
  }
  if (changeSet.changedLinks.length) {
    parts.push(`${changeSet.changedLinks.length} link changes`);
  }
  if (changeSet.changedTables.length) {
    parts.push(`${changeSet.changedTables.length} table changes`);
  }
  return parts.length ? parts.join(', ') : 'No material changes detected';
}

function createWorkflowVersionRecord(input = {}) {
  const entityId =
    pickString(input.entityId) ||
    pickString(input.recruitmentId) ||
    'UNASSIGNED_RECRUITMENT';
  const scope = pickString(input.scope) || 'workflow';
  const sequence =
    Number.isInteger(input.sequence) && input.sequence > 0 ? input.sequence : 1;
  const generatedAt = pickString(input.generatedAt) || '1970-01-01T00:00:00.000Z';
  const versionTag = pickString(input.versionTag) || `AMP2.${scope}.${sequence}`;
  const fingerprint = stableHash({
    entityId,
    scope,
    sequence,
    versionTag,
    generatedAt,
    content: input.content || null,
  });

  return deepFreeze({
    versioningVersion: WORKFLOW_MODULES_VERSION,
    entityId,
    scope,
    sequence,
    versionTag,
    generatedAt,
    fingerprint,
    previousVersionTag: pickString(input.previousVersionTag) || null,
    advisoryOnly: true,
  });
}

function createWorkflowStateMachine(input = {}) {
  const currentState =
    STATE_SEQUENCE.includes(input.currentState) ? input.currentState : WORKFLOW_STATES.DETECTED;
  const allowedTransitions = DEFAULT_TRANSITIONS[currentState] || Object.freeze([]);
  const currentIndex = STATE_SEQUENCE.indexOf(currentState);

  return deepFreeze({
    stateMachineVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    currentState,
    previousState:
      currentIndex > 0 && currentIndex < STATE_SEQUENCE.length
        ? STATE_SEQUENCE[currentIndex - 1]
        : null,
    allowedTransitions: allowedTransitions.slice(),
    terminal:
      currentState === WORKFLOW_STATES.REJECTED ||
      currentState === WORKFLOW_STATES.PUBLISHED_FUTURE,
    failed: currentState === WORKFLOW_STATES.FAILED,
    retryable:
      currentState === WORKFLOW_STATES.FAILED ||
      currentState === WORKFLOW_STATES.RETRY ||
      allowedTransitions.includes(WORKFLOW_STATES.RETRY),
    stateOrder: currentIndex >= 0 ? currentIndex + 1 : 1,
    stateCount: STATE_SEQUENCE.length,
  });
}

function createDraftDifference(input = {}) {
  const previous = isPlainObject(input.previousVersion) ? input.previousVersion : {};
  const current = isPlainObject(input.currentVersion) ? input.currentVersion : {};
  const previousEntries = mapEntries(previous);
  const currentEntries = mapEntries(current);
  const previousMap = new Map(previousEntries);
  const currentMap = new Map(currentEntries);

  const addedSections = [];
  const updatedSections = [];
  const removedSections = [];
  const changedDates = [];
  const changedLinks = [];
  const changedTables = [];

  for (const [key, value] of currentMap.entries()) {
    if (!previousMap.has(key)) {
      addedSections.push(key);
      continue;
    }
    if (previousMap.get(key) !== value) {
      updatedSections.push(key);
      if (/date/i.test(key)) changedDates.push(key);
      if (/link|url/i.test(key)) changedLinks.push(key);
      if (/table/i.test(key)) changedTables.push(key);
    }
  }

  for (const [key] of previousMap.entries()) {
    if (!currentMap.has(key)) {
      removedSections.push(key);
      if (/date/i.test(key)) changedDates.push(key);
      if (/link|url/i.test(key)) changedLinks.push(key);
      if (/table/i.test(key)) changedTables.push(key);
    }
  }

  const result = {
    differenceVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    addedSections: addedSections.sort(),
    updatedSections: updatedSections.sort(),
    removedSections: removedSections.sort(),
    changedDates: Array.from(new Set(changedDates)).sort(),
    changedLinks: Array.from(new Set(changedLinks)).sort(),
    changedTables: Array.from(new Set(changedTables)).sort(),
  };

  return deepFreeze({
    ...result,
    reviewSummary: buildChangeSummary(result),
    hasChanges:
      result.addedSections.length > 0 ||
      result.updatedSections.length > 0 ||
      result.removedSections.length > 0,
  });
}

function buildApprovalWorkflowModel(input = {}) {
  const approvalState = Object.values(APPROVAL_STATES).includes(input.state)
    ? input.state
    : APPROVAL_STATES.DRAFT;
  const decision = pickString(input.decision) || 'PENDING_REVIEW';

  return deepFreeze({
    approvalVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    state: approvalState,
    decision,
    manualOnly: true,
    publishEnabled: false,
    allowedStates: Object.values(APPROVAL_STATES),
    transitionGuide: Object.freeze({
      [APPROVAL_STATES.DRAFT]: [APPROVAL_STATES.IN_REVIEW, APPROVAL_STATES.NEEDS_CHANGES],
      [APPROVAL_STATES.IN_REVIEW]: [
        APPROVAL_STATES.APPROVED,
        APPROVAL_STATES.REJECTED,
        APPROVAL_STATES.NEEDS_CHANGES,
      ],
      [APPROVAL_STATES.APPROVED]: [APPROVAL_STATES.FUTURE_PUBLISH],
      [APPROVAL_STATES.REJECTED]: [APPROVAL_STATES.NEEDS_CHANGES],
      [APPROVAL_STATES.NEEDS_CHANGES]: [APPROVAL_STATES.DRAFT, APPROVAL_STATES.IN_REVIEW],
      [APPROVAL_STATES.FUTURE_PUBLISH]: [],
    }),
  });
}

function buildDraftPackage(input = {}) {
  const recruitmentObject = input.recruitmentObject || {};
  const generatorPayload = input.generatorPayload || {};
  const validation = input.validation || recruitmentObject.validation || {};
  const confidence = input.confidence || {};
  const warnings = normalizeWarnings(
    input.warnings ||
      recruitmentObject.reviewFlags ||
      validation.issues ||
      []
  );
  const currentStage =
    pickString(input.currentStage) ||
    pickString(recruitmentObject.currentStage) ||
    WORKFLOW_STATES.DRAFT_READY;
  const decision =
    pickString(input.decision) ||
    pickString(input.pageDecision && input.pageDecision.decision) ||
    pickString(input.updateDecision && input.updateDecision.decision) ||
    'MANUAL_REVIEW_REQUIRED';
  const previousVersion = input.previousVersion || null;
  const timeline =
    ensureArray(input.timeline).length > 0
      ? ensureArray(input.timeline)
      : ensureArray(recruitmentObject.timeline);
  const reviewNotes = ensureArray(input.reviewNotes);
  const missingInformation =
    ensureArray(input.missingInformation).length > 0
      ? ensureArray(input.missingInformation)
      : ensureArray(recruitmentObject.missingInformation);
  const difference = createDraftDifference({
    previousVersion,
    currentVersion: recruitmentObject.rendererSections || recruitmentObject,
  });

  return deepFreeze({
    draftPackageVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    reviewReady: true,
    publishReady: false,
    recruitmentId:
      pickString(recruitmentObject.recruitmentId) ||
      pickString(input.recruitmentId) ||
      'UNASSIGNED_RECRUITMENT',
    currentStage,
    structuredContent:
      recruitmentObject.rendererSections || input.structuredContent || {},
    generatorPayload,
    timeline,
    confidence: {
      score: typeof confidence.score === 'number' ? confidence.score : recruitmentObject.confidenceScore || 0,
      explanation: ensureArray(confidence.explanation).length
        ? ensureArray(confidence.explanation)
        : ensureArray(recruitmentObject.confidenceExplanation),
    },
    validationReport: validation,
    missingInformation,
    decision,
    warnings,
    reviewNotes,
    changeSummary: difference.reviewSummary,
    previousVersion,
    nextExpectedStage: pickString(input.nextExpectedStage) || WORKFLOW_STATES.REVIEW_PENDING,
    difference,
  });
}

function buildReviewPayloadFromRecruitment(recruitmentObject, generatorPayload, draftPackage) {
  const vacancy = recruitmentObject.vacancy || {};

  return {
    candidateId: draftPackage.recruitmentId,
    reviewId: draftPackage.recruitmentId,
    title: recruitmentObject.recruitmentName || null,
    sourceUrl: recruitmentObject.officialNotification || recruitmentObject.officialWebsite || null,
    officialUrl: recruitmentObject.officialWebsite || recruitmentObject.officialNotification || null,
    department: recruitmentObject.department || null,
    qualification: recruitmentObject.eligibility || null,
    eligibility: recruitmentObject.eligibility || null,
    selectionProcess: recruitmentObject.selectionProcess || null,
    applicationProcess: generatorPayload.applicationProcess || null,
    state: recruitmentObject.organization || recruitmentObject.department || null,
    confidence: recruitmentObject.confidenceScore || 0,
    importantDates: ensureArray(recruitmentObject.importantDates),
    importantLinks: ensureArray(recruitmentObject.importantLinks),
    totalPosts: vacancy.totalPosts || null,
    postName: vacancy.postName || null,
  };
}

function coordinateDraftGeneration(input = {}) {
  const recruitmentObject = input.recruitmentObject || {};
  const generatorPayload = input.generatorPayload || {};
  const draftPackage = buildDraftPackage({
    recruitmentObject,
    generatorPayload,
    validation: input.validation,
    confidence: input.confidence,
    warnings: input.warnings,
    timeline: input.timeline,
    missingInformation: input.missingInformation,
    previousVersion: input.previousVersion,
    reviewNotes: input.reviewNotes,
    decision: input.decision,
    nextExpectedStage: input.nextExpectedStage,
  });

  const reviewPayload =
    input.reviewPayload ||
    buildReviewPayloadFromRecruitment(recruitmentObject, generatorPayload, draftPackage);

  const draftPreparation = prepareDraftFromReviewPayload({
    reviewPayload,
    generatedTimestamp: pickString(input.generatedAt) || '1970-01-01T00:00:00.000Z',
    draftId: `${draftPackage.recruitmentId}-draft-preview`,
    lifecycleStateHint: 'DRAFT_READY',
    approved: false,
    reviewApproved: false,
    adapterOverrides: {
      generatorPayload,
    },
  });

  return deepFreeze({
    coordinatorVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    publishDenied: true,
    draftPackage,
    reviewPayload,
    draftPreparation,
    draftPreview: draftPreparation.preview,
    readyForReview: true,
    effects: {
      productionDraftCreated: false,
      draftPersisted: false,
      published: false,
      runtimeActivated: false,
    },
  });
}

function buildTelegramReviewMessage(input = {}) {
  const recruitmentId = pickString(input.recruitmentId) || 'UNASSIGNED_RECRUITMENT';
  const recruitment = pickString(input.recruitment) || 'Untitled Recruitment';
  const currentStage = pickString(input.currentStage) || WORKFLOW_STATES.REVIEW_PENDING;
  const decision = pickString(input.decision) || 'MANUAL_REVIEW_REQUIRED';
  const confidence =
    typeof input.confidence === 'number'
      ? `${input.confidence}%`
      : pickString(input.confidence) || '0%';
  const warnings = normalizeWarnings(input.warnings);
  const summary = pickString(input.summary) || 'Draft package ready for manual review.';

  const placeholders = deepFreeze({
    reviewLink: '[REVIEW_LINK_PLACEHOLDER]',
    publishAction: '[PUBLISH_PLACEHOLDER_FUTURE_ONLY]',
    rejectAction: '[REJECT_PLACEHOLDER]',
  });

  const text = [
    'Automation Workflow Review',
    `Recruitment: ${recruitment}`,
    `Recruitment ID: ${recruitmentId}`,
    `Current Stage: ${currentStage}`,
    `Decision: ${decision}`,
    `Confidence: ${confidence}`,
    `Warnings: ${warnings.length ? warnings.join(', ') : 'None'}`,
    `Summary: ${summary}`,
    `Review Link: ${placeholders.reviewLink}`,
    `Publish: ${placeholders.publishAction}`,
    `Reject: ${placeholders.rejectAction}`,
    'Manual approval required. No automatic publishing.',
  ].join('\n');

  return deepFreeze({
    telegramVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    sendDenied: true,
    placeholdersOnly: true,
    text,
    message: {
      recruitment,
      recruitmentId,
      currentStage,
      decision,
      confidence,
      warnings,
      summary,
      placeholders,
    },
  });
}

function buildReviewQueue(input = {}) {
  const createdAt = pickString(input.createdAt) || '1970-01-01T00:00:00.000Z';
  const warnings = normalizeWarnings(input.warnings);
  const confidence =
    typeof input.confidence === 'number' ? input.confidence : 0;
  const pendingDurationMs =
    typeof input.pendingDurationMs === 'number' && input.pendingDurationMs >= 0
      ? input.pendingDurationMs
      : 0;

  return deepFreeze({
    queueVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    persisted: false,
    items: [
      deepFreeze({
        recruitmentId: pickString(input.recruitmentId) || 'UNASSIGNED_RECRUITMENT',
        priority:
          confidence >= 85 ? 'HIGH' : confidence >= 60 ? 'MEDIUM' : 'MANUAL_REVIEW',
        confidence,
        department: pickString(input.department) || 'UNKNOWN',
        currentStage: pickString(input.currentStage) || WORKFLOW_STATES.REVIEW_PENDING,
        createdAt,
        pendingDurationMs,
        warnings,
      }),
    ],
  });
}

function createAutomationAuditLog(input = {}) {
  const baseTimestamp = pickString(input.generatedAt) || '1970-01-01T00:00:00.000Z';
  const entries = ensureArray(input.entries);
  const normalized = entries.map((entry, index) =>
    deepFreeze({
      order: index + 1,
      eventType: pickString(entry.eventType) || `EVENT_${index + 1}`,
      status: pickString(entry.status) || 'completed',
      state: pickString(entry.state) || null,
      message: pickString(entry.message) || null,
      timestamp: pickString(entry.timestamp) || baseTimestamp,
      retryable: entry.retryable === true,
    })
  );

  return deepFreeze({
    auditVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    entryCount: normalized.length,
    entries: normalized,
  });
}

function collectWorkflowMetrics(input = {}) {
  const records = ensureArray(input.records);
  const metrics = {
    draftCount: 0,
    updateCount: 0,
    mergeCount: 0,
    duplicateCount: 0,
    validationFailures: 0,
    confidenceDistribution: {
      high: 0,
      medium: 0,
      low: 0,
    },
    departmentDistribution: {},
    reviewTimeMs: 0,
    processingTimeMs: 0,
  };

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] || {};
    if (record.draftCreated === true || record.currentState === WORKFLOW_STATES.DRAFT_READY) {
      metrics.draftCount += 1;
    }
    if (record.updated === true) metrics.updateCount += 1;
    if (record.merged === true) metrics.mergeCount += 1;
    if (record.duplicate === true) metrics.duplicateCount += 1;
    if (record.validationValid === false) metrics.validationFailures += 1;

    const confidence = typeof record.confidence === 'number' ? record.confidence : 0;
    if (confidence >= 85) metrics.confidenceDistribution.high += 1;
    else if (confidence >= 60) metrics.confidenceDistribution.medium += 1;
    else metrics.confidenceDistribution.low += 1;

    const department = pickString(record.department) || 'UNKNOWN';
    metrics.departmentDistribution[department] =
      (metrics.departmentDistribution[department] || 0) + 1;

    metrics.reviewTimeMs +=
      typeof record.reviewTimeMs === 'number' ? record.reviewTimeMs : 0;
    metrics.processingTimeMs +=
      typeof record.processingTimeMs === 'number' ? record.processingTimeMs : 0;
  }

  return deepFreeze({
    metricsVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    recordCount: records.length,
    ...metrics,
  });
}

function evaluateFailureRecovery(input = {}) {
  const state = pickString(input.state) || WORKFLOW_STATES.FAILED;
  const reason = pickString(input.reason) || 'UNKNOWN_FAILURE';
  const canResume = input.canResume !== false;
  const retryCount =
    Number.isInteger(input.retryCount) && input.retryCount >= 0 ? input.retryCount : 0;
  const rollbackState =
    pickString(input.rollbackState) || WORKFLOW_STATES.MATCHING;
  const recommendedAction =
    retryCount >= 3
      ? FAILURE_ACTIONS.MANUAL_REVIEW
      : state === WORKFLOW_STATES.FAILED
        ? FAILURE_ACTIONS.RETRY
        : FAILURE_ACTIONS.RESUME;

  return deepFreeze({
    failureRecoveryVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    state,
    reason,
    retryCount,
    canRetry: retryCount < 3,
    canResume,
    canAbort: true,
    rollbackState,
    recommendedAction,
    supportedActions: Object.values(FAILURE_ACTIONS),
    productionRollbackDenied: true,
  });
}

function createSafetyEnvelope() {
  return deepFreeze({
    recruitmentPipelineEnabled: false,
    productionPublishing: false,
    automaticPublishing: false,
    schedulerActivation: false,
    workerActivation: false,
    productionDeployment: false,
    productionRouteChanges: false,
    cronActivation: false,
    liveCrawling: false,
  });
}

function createWorkflowDiagram() {
  return deepFreeze({
    diagramVersion: WORKFLOW_MODULES_VERSION,
    format: 'MERMAID',
    value: [
      'flowchart TD',
      '  A[Official Source] --> B[Bot Visit]',
      '  B --> C[Update Detection]',
      '  C --> D[AI Recruitment Brain]',
      '  D --> E[Recruitment Object]',
      '  E --> F[History Recovery]',
      '  F --> G[Validation]',
      '  G --> H[Generator Payload]',
      '  H --> I[Draft Generation]',
      '  I --> J[Draft Preview]',
      '  J --> K[Telegram Review Message]',
      '  K --> L[Manual Approval]',
      '  L --> M[Publish Future Only]',
    ].join('\n'),
  });
}

module.exports = {
  WORKFLOW_MODULES_VERSION,
  WORKFLOW_STATES,
  APPROVAL_STATES,
  FAILURE_ACTIONS,
  STATE_SEQUENCE,
  createWorkflowVersionRecord,
  createWorkflowStateMachine,
  createDraftDifference,
  buildDraftPackage,
  coordinateDraftGeneration,
  buildTelegramReviewMessage,
  buildApprovalWorkflowModel,
  buildReviewQueue,
  createAutomationAuditLog,
  collectWorkflowMetrics,
  evaluateFailureRecovery,
  createSafetyEnvelope,
  createWorkflowDiagram,
  normalizeUrl,
};
