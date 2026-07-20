'use strict';

/**
 * AMP-1 — Recruitment Brain Orchestrator
 *
 * Main intelligence pipeline: notification → structured Recruitment Object.
 * Advisory only. No HTML. No production side effects.
 */

const { deepFreeze, pickString, mergeObjects, isPlainObject } = require('./utils');
const {
  createEmptyRecruitmentObject,
  deriveRecruitmentId,
  createHistoryEntry,
  REVIEW_FLAG_CODES,
  RECRUITMENT_STATUS,
} = require('./recruitmentObjectModel');
const { classifyStageFromNotification, detectStageContext } = require('./lifecycleIntelligence');
const { matchRecruitment, extractAdvertisementNo, resolveOrganization } = require('./recruitmentMatchingEngine');
const { recoverRecruitmentHistory } = require('./historyRecoveryEngine');
const { buildTimeline } = require('./timelineBuilder');
const { decideUpdateAction } = require('./updateIntelligenceEngine');
const { detectDuplicates } = require('./duplicateDetectionEngine');
const { computeConfidence } = require('./confidenceEngine');
const { detectMissingInformation } = require('./missingInformationEngine');
const { validateRecruitment } = require('./validationEngine');
const { evaluateDraftReadiness } = require('./draftReadinessEngine');
const { decidePageAction } = require('./pageDecisionEngine');
const { mapToRendererSections, buildGeneratorPayload } = require('./rendererCompatibility');

const ORCHESTRATOR_VERSION = 'AMP1.1.0.0';

function extractNotificationFields(notification) {
  const title = pickString(notification.title);
  const advNo =
    pickString(notification.advertisementNumber) ||
    extractAdvertisementNo(title) ||
    extractAdvertisementNo(notification.content);
  const org =
    pickString(notification.organization) ||
    resolveOrganization([notification.department, title].join(' '));

  return {
    recruitmentName: title || null,
    advertisementNumber: advNo || null,
    organization: org || null,
    department: pickString(notification.department) || org || null,
    officialWebsite: pickString(notification.officialWebsite) || pickString(notification.sourceUrl) || null,
    officialNotification: pickString(notification.url) || null,
    eligibility: pickString(notification.eligibility) || null,
    age: pickString(notification.age) || null,
    fees: pickString(notification.fees) || null,
    selectionProcess: pickString(notification.selectionProcess) || null,
    importantDates: Array.isArray(notification.importantDates) ? notification.importantDates : [],
    importantLinks: Array.isArray(notification.importantLinks) ? notification.importantLinks : [],
    vacancy: isPlainObject(notification.vacancy)
      ? notification.vacancy
      : {
          totalPosts: notification.totalPosts || null,
          postName: pickString(notification.postName) || null,
          details: Array.isArray(notification.vacancyDetails) ? notification.vacancyDetails : [],
        },
    vacancyDetails: Array.isArray(notification.vacancyDetails) ? notification.vacancyDetails : [],
  };
}

function buildReviewFlags(input) {
  const flags = [];
  if ((input.confidence || {}).score < 50) flags.push(REVIEW_FLAG_CODES.LOW_CONFIDENCE);
  if (input.historyRecovery && !input.historyRecovery.hasPrimaryNotification) {
    flags.push(REVIEW_FLAG_CODES.MISSING_PRIMARY_NOTIFICATION);
  }
  if ((input.matchResult || {}).conflictingSignals?.length > 0) {
    flags.push(REVIEW_FLAG_CODES.CONFLICTING_ADVERTISEMENT);
  }
  if ((input.duplicateResult || {}).isDuplicate) flags.push(REVIEW_FLAG_CODES.DUPLICATE_DETECTED);
  if (input.historyRecovery?.historyRecovered) flags.push(REVIEW_FLAG_CODES.HISTORY_RECOVERED);
  if (input.updateDecision?.decision === 'MANUAL_REVIEW_REQUIRED') {
    flags.push(REVIEW_FLAG_CODES.MANUAL_REVIEW_REQUIRED);
  }
  if ((input.missingResult || {}).criticalCount > 2) {
    flags.push(REVIEW_FLAG_CODES.MISSING_CRITICAL_FIELDS);
  }
  if ((input.timeline || {}).entryCount < 1) flags.push(REVIEW_FLAG_CODES.INCOMPLETE_TIMELINE);
  if (!(input.validation || {}).valid) flags.push(REVIEW_FLAG_CODES.INVALID_URL);
  return flags;
}

/**
 * Process a notification through the full Recruitment Intelligence Brain.
 *
 * @param {object} input
 * @param {object} input.notification - Incoming notification/update
 * @param {object[]} [input.existingRecruitments] - Known recruitments for matching
 * @param {object[]} [input.existingNotifications] - Known notifications for duplicate detection
 * @param {object[]} [input.existingPages] - Known pages for duplicate/page decisions
 * @param {object[]} [input.sourceSearchResults] - Advisory source search results for history recovery
 * @param {object} [input.existingPage] - Linked page if known
 * @param {string} [input.generatedAt] - Deterministic timestamp override for tests
 */
function processRecruitmentIntelligence(input = {}) {
  const notification = input.notification || {};
  const generatedAt = input.generatedAt || new Date(0).toISOString();

  const stageClassification = classifyStageFromNotification(notification);

  const duplicateResult = detectDuplicates({
    notification,
    existingNotifications: input.existingNotifications || [],
    existingRecruitments: input.existingRecruitments || [],
    existingPages: input.existingPages || [],
  });

  const matchResult = matchRecruitment(notification, input.existingRecruitments || []);

  let existingRecruitment = null;
  if (matchResult.match && matchResult.recruitmentId) {
    existingRecruitment = (input.existingRecruitments || []).find(
      (r) => String(r.recruitmentId || r.id) === String(matchResult.recruitmentId)
    );
  }

  const historyRecovery = recoverRecruitmentHistory({
    notification,
    existingRecruitment: existingRecruitment || {},
    sourceSearchResults: input.sourceSearchResults || [],
    sourceId: notification.sourceId || notification.source,
  });

  const notificationFields = extractNotificationFields(notification);
  const mergedBase = mergeObjects(
    existingRecruitment || {},
    mergeObjects(historyRecovery.mergedRecruitment, notificationFields)
  );

  const currentHistory = [
    ...(Array.isArray(existingRecruitment?.history) ? existingRecruitment.history : []),
    ...historyRecovery.recoveredHistory,
    createHistoryEntry({
      eventType: stageClassification.stage,
      stage: stageClassification.stage,
      title: notification.title,
      url: notification.url,
      pdfUrl: notification.pdfUrl,
      detectedAt: generatedAt,
      source: notification.source || null,
      confidence: stageClassification.confidence === 'high' ? 90 : 60,
      recovered: false,
    }),
  ];

  const observedFromHistory = currentHistory
    .map((h) => h.stage)
    .filter(Boolean);
  const observedFromExisting = (existingRecruitment?.history || [])
    .map((h) => h.stage)
    .filter(Boolean);

  const stageContext = detectStageContext(
    [
      ...observedFromExisting,
      ...observedFromHistory,
      ...(historyRecovery.observedStages || []),
      stageClassification.stage,
    ],
    stageClassification.stage
  );

  const timelineResult = buildTimeline({
    history: currentHistory,
    importantDates: mergedBase.importantDates || notificationFields.importantDates,
  });

  let recruitment = createEmptyRecruitmentObject({
    ...mergedBase,
    recruitmentId: matchResult.recruitmentId || deriveRecruitmentId(mergedBase),
    currentStage: stageContext.currentStage,
    previousStage: stageContext.previousStage,
    possibleNextStages: stageContext.possibleNextStages,
    missingStages: stageContext.missingStages,
    timeline: timelineResult.timeline,
    history: currentHistory,
    currentStatus:
      stageClassification.stage === 'cancelled'
        ? RECRUITMENT_STATUS.CANCELLED
        : stageClassification.stage === 'closed' || stageClassification.stage === 'joining'
          ? RECRUITMENT_STATUS.CLOSED
          : RECRUITMENT_STATUS.ACTIVE,
    metadata: {
      generatedAt,
      sourceNotificationId: notification.id || notification.notificationId || null,
      historyRecovered: historyRecovery.historyRecovered,
      matchedExisting: matchResult.match === true,
      advisoryOnly: true,
    },
  });

  const validation = validateRecruitment(recruitment);
  const missingResult = detectMissingInformation(recruitment);

  const updateDecision = decideUpdateAction({
    matchResult,
    duplicateResult,
    notification,
  });

  const confidence = computeConfidence({
    recruitment,
    matchResult,
    stageClassification,
    validation,
    historyRecovery,
    duplicateResult,
    updateDecision,
    reviewFlags: [],
  });

  const reviewFlags = buildReviewFlags({
    confidence,
    historyRecovery,
    matchResult,
    duplicateResult,
    updateDecision,
    missingResult,
    timeline: timelineResult,
    validation,
  });

  const confidenceWithFlags = computeConfidence({
    recruitment,
    matchResult,
    stageClassification,
    validation,
    historyRecovery,
    duplicateResult,
    updateDecision,
    reviewFlags,
  });

  const draftReadiness = evaluateDraftReadiness({
    recruitment,
    missingResult,
    validation,
    confidence: confidenceWithFlags,
    updateDecision,
  });

  const pageDecision = decidePageAction({
    updateDecision,
    draftReadiness,
    existingPage: input.existingPage || null,
    duplicateResult,
  });

  const rendererSections = mapToRendererSections(recruitment);
  const generatorPayload = buildGeneratorPayload(recruitment);

  recruitment = createEmptyRecruitmentObject({
    ...recruitment,
    confidenceScore: confidenceWithFlags.score,
    confidenceExplanation: confidenceWithFlags.explanation,
    reviewFlags,
    missingInformation: missingResult.missingInformation,
    validation,
    draftReadiness,
    pageDecision,
    updateDecision,
    duplicateSignals: duplicateResult.duplicates || [],
    rendererSections,
    metadata: {
      ...recruitment.metadata,
      generatorPayloadReady: draftReadiness.ready,
    },
  });

  return deepFreeze({
    version: ORCHESTRATOR_VERSION,
    recruitmentObject: recruitment,
    stageClassification,
    matchResult,
    historyRecovery,
    timeline: timelineResult,
    duplicateResult,
    updateDecision,
    confidence: confidenceWithFlags,
    validation,
    missingResult,
    draftReadiness,
    pageDecision,
    rendererSections,
    generatorPayload,
    reviewFlags,
    effects: {
      productionActivated: false,
      pipelineEnabled: false,
      pagePublished: false,
      draftCreated: false,
      dbWritten: false,
      schedulerActivated: false,
      workerActivated: false,
    },
  });
}

module.exports = {
  ORCHESTRATOR_VERSION,
  processRecruitmentIntelligence,
  extractNotificationFields,
};
