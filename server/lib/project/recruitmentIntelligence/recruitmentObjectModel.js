'use strict';

/**
 * AMP-1 — Recruitment Object Model
 *
 * Canonical structured recruitment object schema.
 * Pages are rendered output only — never HTML/CSS from this module.
 */

const { deepFreeze, pickString, stableHash } = require('./utils');

const RECRUITMENT_OBJECT_SCHEMA_VERSION = 'AMP1.1.0.0';

const RECRUITMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});

const REVIEW_FLAG_CODES = Object.freeze({
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  MISSING_PRIMARY_NOTIFICATION: 'MISSING_PRIMARY_NOTIFICATION',
  CONFLICTING_ADVERTISEMENT: 'CONFLICTING_ADVERTISEMENT',
  DUPLICATE_DETECTED: 'DUPLICATE_DETECTED',
  HISTORY_RECOVERED: 'HISTORY_RECOVERED',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
  INCOMPLETE_TIMELINE: 'INCOMPLETE_TIMELINE',
  INVALID_URL: 'INVALID_URL',
  MISSING_CRITICAL_FIELDS: 'MISSING_CRITICAL_FIELDS',
});

function createEmptyRecruitmentObject(overrides = {}) {
  const now = overrides.generatedAt || new Date(0).toISOString();
  const recruitment = {
    schemaVersion: RECRUITMENT_OBJECT_SCHEMA_VERSION,
    recruitmentId: overrides.recruitmentId || null,
    department: null,
    organization: null,
    recruitmentName: null,
    advertisementNumber: null,
    officialWebsite: null,
    officialNotification: null,
    currentStage: null,
    previousStage: null,
    possibleNextStages: [],
    missingStages: [],
    timeline: [],
    vacancy: {
      totalPosts: null,
      postName: null,
      details: [],
    },
    eligibility: null,
    age: null,
    fees: null,
    selectionProcess: null,
    vacancyDetails: [],
    importantDates: [],
    importantLinks: [],
    currentStatus: RECRUITMENT_STATUS.UNKNOWN,
    history: [],
    confidenceScore: 0,
    confidenceExplanation: [],
    reviewFlags: [],
    missingInformation: [],
    validation: {
      valid: false,
      issues: [],
    },
    draftReadiness: {
      ready: false,
      reasons: [],
    },
    pageDecision: null,
    updateDecision: null,
    duplicateSignals: [],
    rendererSections: {},
    metadata: {
      generatedAt: now,
      sourceNotificationId: null,
      historyRecovered: false,
      matchedExisting: false,
      advisoryOnly: true,
    },
  };

  return deepFreeze({ ...recruitment, ...overrides });
}

function deriveRecruitmentId(recruitment) {
  if (recruitment.recruitmentId) return String(recruitment.recruitmentId);
  const parts = [
    pickString(recruitment.organization),
    pickString(recruitment.advertisementNumber),
    pickString(recruitment.recruitmentName),
  ].filter(Boolean);
  if (!parts.length) return null;
  return `RIB-${stableHash(parts.join('|'))}`;
}

function createHistoryEntry(event) {
  return deepFreeze({
    eventType: pickString(event.eventType) || 'unknown',
    stage: pickString(event.stage) || null,
    title: pickString(event.title) || null,
    url: pickString(event.url) || null,
    pdfUrl: pickString(event.pdfUrl) || null,
    detectedAt: pickString(event.detectedAt) || null,
    source: pickString(event.source) || null,
    confidence: typeof event.confidence === 'number' ? event.confidence : null,
    recovered: event.recovered === true,
  });
}

function createTimelineEntry(entry) {
  return deepFreeze({
    stage: pickString(entry.stage) || null,
    eventType: pickString(entry.eventType) || null,
    label: pickString(entry.label) || null,
    date: pickString(entry.date) || null,
    url: pickString(entry.url) || null,
    order: typeof entry.order === 'number' ? entry.order : 0,
    source: pickString(entry.source) || null,
  });
}

module.exports = {
  RECRUITMENT_OBJECT_SCHEMA_VERSION,
  RECRUITMENT_STATUS,
  REVIEW_FLAG_CODES,
  createEmptyRecruitmentObject,
  deriveRecruitmentId,
  createHistoryEntry,
  createTimelineEntry,
};
