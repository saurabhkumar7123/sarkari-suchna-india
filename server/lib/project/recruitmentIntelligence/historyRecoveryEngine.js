'use strict';

/**
 * AMP-1 — History Recovery Engine
 *
 * Reconstructs recruitment history when first observed stage is not Vacancy.
 * Accepts sourceSearchResults (advisory input from monitoring layer) — no HTTP.
 */

const { deepFreeze, pickString, normalizeText, jaccardSimilarity, mergeObjects } = require('./utils');
const { createHistoryEntry } = require('./recruitmentObjectModel');
const { classifyStageFromNotification, mapEventTypeToStage } = require('./lifecycleIntelligence');
const { extractAdvertisementNo, resolveOrganization } = require('./recruitmentMatchingEngine');

const HISTORY_RECOVERY_VERSION = 'AMP1.1.0.0';

const RECOVERABLE_FIELDS = Object.freeze([
  'recruitmentName',
  'advertisementNumber',
  'organization',
  'department',
  'officialWebsite',
  'officialNotification',
  'eligibility',
  'age',
  'fees',
  'selectionProcess',
  'vacancyDetails',
  'importantDates',
  'importantLinks',
]);

function scoreSourceResult(notification, result) {
  let score = 0;
  const notifAdv = extractAdvertisementNo(notification.title) || pickString(notification.advertisementNumber);
  const resultAdv = extractAdvertisementNo(result.title) || pickString(result.advertisementNumber);
  if (notifAdv && resultAdv && notifAdv === resultAdv) score += 50;

  const notifOrg = resolveOrganization([notification.organization, notification.department, notification.title].join(' '));
  const resultOrg = resolveOrganization([result.organization, result.department, result.title].join(' '));
  if (notifOrg && resultOrg && notifOrg === resultOrg) score += 20;

  const sim = jaccardSimilarity(notification.title, result.title);
  score += Math.round(sim * 30);

  return score;
}

function filterRelevantSourceResults(notification, sourceSearchResults = []) {
  if (!Array.isArray(sourceSearchResults)) return [];
  return sourceSearchResults
    .map((result) => ({
      ...result,
      relevanceScore: scoreSourceResult(notification, result),
    }))
    .filter((r) => r.relevanceScore >= 25)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function extractFieldsFromResult(result) {
  const fields = {};
  for (let i = 0; i < RECOVERABLE_FIELDS.length; i += 1) {
    const field = RECOVERABLE_FIELDS[i];
    if (result[field] != null && result[field] !== '') {
      fields[field] = result[field];
    }
  }
  if (result.title && !fields.recruitmentName) {
    fields.recruitmentName = result.title;
  }
  if (result.url && !fields.officialNotification) {
    fields.officialNotification = result.url;
  }
  if (result.pdfUrl) {
    fields.importantLinks = [
      ...(Array.isArray(fields.importantLinks) ? fields.importantLinks : []),
      { label: 'Official PDF', url: result.pdfUrl },
    ];
  }
  return fields;
}

function recoverRecruitmentHistory(input = {}) {
  const notification = input.notification || {};
  const existingRecruitment = input.existingRecruitment || {};
  const sourceSearchResults = filterRelevantSourceResults(
    notification,
    input.sourceSearchResults || []
  );

  const recoveredHistory = [];
  const recoveredFields = {};
  const observedStages = [];

  for (let i = 0; i < sourceSearchResults.length; i += 1) {
    const result = sourceSearchResults[i];
    const classification = classifyStageFromNotification(result);
    const stage = classification.stage;

    if (!observedStages.includes(stage)) {
      observedStages.push(stage);
    }

    recoveredHistory.push(
      createHistoryEntry({
        eventType: mapEventTypeToStage(result.eventType) || classification.stage,
        stage,
        title: result.title,
        url: result.url,
        pdfUrl: result.pdfUrl,
        detectedAt: result.detectedAt || null,
        source: result.source || input.sourceId || null,
        confidence: result.relevanceScore,
        recovered: true,
      })
    );

    const fields = extractFieldsFromResult(result);
    Object.assign(recoveredFields, mergeObjects(recoveredFields, fields));
  }

  const currentClassification = classifyStageFromNotification(notification);
  if (!observedStages.includes(currentClassification.stage)) {
    observedStages.push(currentClassification.stage);
  }

  const mergedRecruitment = mergeObjects(existingRecruitment, recoveredFields);
  const historyRecovered = recoveredHistory.length > 0;
  const completenessRatio =
    sourceSearchResults.length > 0
      ? Math.min(1, recoveredHistory.length / sourceSearchResults.length)
      : 0;

  const hasPrimaryNotification = observedStages.some((s) =>
    ['vacancy', 'short_notice', 'detailed_notification'].includes(s)
  );

  return deepFreeze({
    version: HISTORY_RECOVERY_VERSION,
    historyRecovered,
    recoveredHistory,
    observedStages,
    mergedRecruitment,
    completenessRatio,
    hasPrimaryNotification,
    sourceResultsProcessed: sourceSearchResults.length,
    recoveryExplanation: historyRecovered
      ? `Recovered ${recoveredHistory.length} historical events from ${sourceSearchResults.length} source results.`
      : 'No relevant source results available for history recovery.',
  });
}

module.exports = {
  HISTORY_RECOVERY_VERSION,
  RECOVERABLE_FIELDS,
  recoverRecruitmentHistory,
  filterRelevantSourceResults,
};
