'use strict';

/**
 * AMP-1 — Confidence Engine
 *
 * Produces 0-100 confidence score with deterministic explanation.
 */

const { deepFreeze } = require('./utils');
const { REVIEW_FLAG_CODES } = require('./recruitmentObjectModel');

const CONFIDENCE_ENGINE_VERSION = 'AMP1.1.0.0';

const CONFIDENCE_FACTORS = Object.freeze({
  MATCH_QUALITY: { weight: 25, label: 'Recruitment match quality' },
  STAGE_CLASSIFICATION: { weight: 15, label: 'Stage classification confidence' },
  FIELD_COMPLETENESS: { weight: 20, label: 'Field completeness' },
  VALIDATION: { weight: 15, label: 'Validation pass rate' },
  HISTORY_RECOVERY: { weight: 10, label: 'History recovery completeness' },
  DUPLICATE_PENALTY: { weight: -20, label: 'Duplicate detection penalty' },
  CONFLICT_PENALTY: { weight: -15, label: 'Conflicting signals penalty' },
  MANUAL_REVIEW_PENALTY: { weight: -25, label: 'Manual review required penalty' },
});

function computeFieldCompleteness(recruitment) {
  const criticalFields = [
    'recruitmentName',
    'advertisementNumber',
    'organization',
    'department',
    'officialWebsite',
    'eligibility',
    'selectionProcess',
  ];
  let filled = 0;
  for (let i = 0; i < criticalFields.length; i += 1) {
    const val = recruitment[criticalFields[i]];
    if (val != null && val !== '') filled += 1;
  }
  const hasDates = Array.isArray(recruitment.importantDates) && recruitment.importantDates.length > 0;
  const hasLinks = Array.isArray(recruitment.importantLinks) && recruitment.importantLinks.length > 0;
  if (hasDates) filled += 1;
  if (hasLinks) filled += 1;
  return Math.round((filled / (criticalFields.length + 2)) * 100);
}

function stageConfidenceToScore(confidence) {
  const map = { high: 90, medium: 65, low: 40, none: 10 };
  return map[confidence] || 30;
}

function computeConfidence(input = {}) {
  const recruitment = input.recruitment || {};
  const matchResult = input.matchResult || {};
  const stageClassification = input.stageClassification || {};
  const validation = input.validation || {};
  const historyRecovery = input.historyRecovery || {};
  const duplicateResult = input.duplicateResult || {};
  const updateDecision = input.updateDecision || {};
  const reviewFlags = Array.isArray(input.reviewFlags) ? input.reviewFlags : [];

  const factors = [];
  let score = 50;

  const matchScore = Math.min(100, matchResult.confidence || 0);
  if (matchResult.match) {
    score += (matchScore / 100) * CONFIDENCE_FACTORS.MATCH_QUALITY.weight;
    factors.push({ factor: CONFIDENCE_FACTORS.MATCH_QUALITY.label, contribution: matchScore, positive: true });
  }

  const stageScore = stageConfidenceToScore(stageClassification.confidence);
  score += (stageScore / 100) * CONFIDENCE_FACTORS.STAGE_CLASSIFICATION.weight;
  factors.push({ factor: CONFIDENCE_FACTORS.STAGE_CLASSIFICATION.label, contribution: stageScore, positive: true });

  const completeness = computeFieldCompleteness(recruitment);
  score += (completeness / 100) * CONFIDENCE_FACTORS.FIELD_COMPLETENESS.weight;
  factors.push({ factor: CONFIDENCE_FACTORS.FIELD_COMPLETENESS.label, contribution: completeness, positive: true });

  const validationScore = validation.valid ? 100 : Math.max(0, 100 - (validation.issues || []).length * 15);
  score += (validationScore / 100) * CONFIDENCE_FACTORS.VALIDATION.weight;
  factors.push({ factor: CONFIDENCE_FACTORS.VALIDATION.label, contribution: validationScore, positive: validation.valid });

  if (historyRecovery.historyRecovered) {
    const recoveryScore = Math.round((historyRecovery.completenessRatio || 0) * 100);
    score += (recoveryScore / 100) * CONFIDENCE_FACTORS.HISTORY_RECOVERY.weight;
    factors.push({ factor: CONFIDENCE_FACTORS.HISTORY_RECOVERY.label, contribution: recoveryScore, positive: true });
  }

  if (duplicateResult.isDuplicate) {
    score += CONFIDENCE_FACTORS.DUPLICATE_PENALTY.weight;
    factors.push({ factor: CONFIDENCE_FACTORS.DUPLICATE_PENALTY.label, contribution: CONFIDENCE_FACTORS.DUPLICATE_PENALTY.weight, positive: false });
  }

  if ((matchResult.conflictingSignals || []).length > 0) {
    score += CONFIDENCE_FACTORS.CONFLICT_PENALTY.weight;
    factors.push({ factor: CONFIDENCE_FACTORS.CONFLICT_PENALTY.label, contribution: CONFIDENCE_FACTORS.CONFLICT_PENALTY.weight, positive: false });
  }

  if (updateDecision.decision === 'MANUAL_REVIEW_REQUIRED') {
    score += CONFIDENCE_FACTORS.MANUAL_REVIEW_PENALTY.weight;
    factors.push({ factor: CONFIDENCE_FACTORS.MANUAL_REVIEW_PENALTY.label, contribution: CONFIDENCE_FACTORS.MANUAL_REVIEW_PENALTY.weight, positive: false });
  }

  if (reviewFlags.includes(REVIEW_FLAG_CODES.MISSING_PRIMARY_NOTIFICATION)) {
    score -= 10;
    factors.push({ factor: 'Missing primary notification', contribution: -10, positive: false });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const explanation = factors.map(
    (f) => `${f.positive ? '+' : ''}${f.contribution}: ${f.factor}`
  );

  let level = 'low';
  if (finalScore >= 80) level = 'high';
  else if (finalScore >= 55) level = 'medium';

  return deepFreeze({
    version: CONFIDENCE_ENGINE_VERSION,
    score: finalScore,
    level,
    factors,
    explanation,
  });
}

module.exports = {
  CONFIDENCE_ENGINE_VERSION,
  CONFIDENCE_FACTORS,
  computeConfidence,
  computeFieldCompleteness,
};
