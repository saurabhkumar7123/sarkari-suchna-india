"use strict";

/**
 * Phase AI-2 — Normalized event object.
 *
 * The single structured object this phase contributes. It is additive: the
 * Production Workflow keeps receiving exactly the monitoring event it received
 * before, with the intelligence attached under one new key.
 */

const { ENGINE_VERSION, EVENT_TYPES, FORMAT_ID } = require("./types");
const { deepFreeze } = require("./textUtils");

/** Key used to attach AI-2 output to an existing monitoring event. */
const INTELLIGENCE_FIELD = "noticeIntelligence";

/**
 * Assemble the normalized event from every engine's output.
 *
 * @param {{
 *   analysis: object,
 *   headingResult: object,
 *   classification: object,
 *   department: object,
 *   references: object,
 *   keywords: Array<object>,
 *   confidence: object,
 *   priority: object,
 *   recruitmentCandidate: object,
 *   fingerprint: object,
 *   validation: object,
 *   detectedAt: string,
 *   sourceUrl: string|null
 * }} parts
 * @returns {object} frozen normalized event
 */
function buildNormalizedEvent(parts = {}) {
  const analysis = parts.analysis || {};
  const headingResult = parts.headingResult || {};
  const classification = parts.classification || {};
  const department = parts.department || {};
  const references = parts.references || {};
  const confidence = parts.confidence || {};
  const priority = parts.priority || {};
  const recruitmentCandidate = parts.recruitmentCandidate || {};
  const keywords = Array.isArray(parts.keywords) ? parts.keywords : [];

  const event = {
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    advisoryOnly: true,
    detectedAt: parts.detectedAt || new Date().toISOString(),

    // --- Required normalized event fields ---
    eventType: classification.eventType || EVENT_TYPES.UNKNOWN,
    eventSubType: classification.eventSubType || null,
    sourceTitle: classification.sourceTitle || null,
    sourceDepartment: department.department || null,
    sourceBoard: department.board || null,
    publicationDate: references.publicationDate || null,
    referenceNumber: references.referenceNumber || null,
    advertisementNumber: references.advertisementNumber || null,
    normalizedTitle: classification.normalizedTitle || null,
    keywords: keywords.map((item) => item.keyword),
    confidence: Number(confidence.overallScore) || 0,
    priority: priority.priority || null,
    language: analysis.language || null,

    // --- Supporting detail ---
    eventTypeLabel: classification.eventTypeLabel || null,
    lifecycleStage: classification.lifecycleStage || null,
    isKnownEventType: Boolean(classification.isKnownEventType),
    rawEventLabel: classification.rawEventLabel || null,
    classificationScore: Number(classification.classificationScore) || 0,
    classificationCandidates: classification.candidates || [],
    ambiguity: classification.ambiguity || null,

    departmentCode: department.departmentCode || null,
    boardCode: department.boardCode || null,
    parentAuthority: department.parentAuthority || null,
    isKnownOrganization: Boolean(department.isKnownOrganization),
    detectedOrganizationText: department.detectedText || null,

    dates: references.dates || [],
    year: references.year || null,

    keywordDetails: keywords,

    confidenceLevel: confidence.overallLevel || null,
    confidenceReport: confidence,

    priorityScore: Number(priority.score) || 0,
    priorityReport: priority,

    recruitmentCandidate: {
      isRecruitmentCandidate: Boolean(recruitmentCandidate.isRecruitmentCandidate),
      score: Number(recruitmentCandidate.score) || 0,
      signals: recruitmentCandidate.signals || [],
      matchHints: recruitmentCandidate.matchHints || {}
    },

    sections: {
      canonicalSections: headingResult.canonicalSections || [],
      knownHeadingCount: Number(headingResult.knownHeadingCount) || 0,
      unknownHeadings: headingResult.unknownHeadings || [],
      repairedHeadingCount: (headingResult.repairs || []).length,
      headings: (headingResult.headings || []).map((heading) => ({
        text: heading.normalizedText,
        canonicalSection: heading.canonicalSection,
        level: heading.level,
        origin: heading.origin,
        confidence: heading.confidence
      }))
    },

    fingerprint: parts.fingerprint || null,
    validation: parts.validation || null,

    source: {
      url: parts.sourceUrl || analysis.url || null,
      format: analysis.sourceFormat || null,
      contentType: analysis.contentType || null,
      characterCount: Number(analysis.characterCount) || 0,
      lineCount: Number(analysis.lineCount) || 0,
      linkCount: (analysis.links || []).length,
      pdfLinkCount: Number(analysis.pdfLinkCount) || 0,
      languageStats: analysis.languageStats || null
    }
  };

  return deepFreeze(event);
}

/**
 * Attach intelligence to an existing monitoring event without altering it.
 *
 * The returned object is a superset of the original event: every original key
 * keeps its original value, so any existing Production Workflow stage behaves
 * exactly as it did before this phase existed.
 *
 * @param {object} originalEvent monitoring event as produced today
 * @param {object} normalizedEvent output of {@link buildNormalizedEvent}
 * @returns {object}
 */
function toWorkflowMonitoringEvent(originalEvent, normalizedEvent) {
  const base = originalEvent && typeof originalEvent === "object" ? originalEvent : {};
  return {
    ...base,
    [INTELLIGENCE_FIELD]: normalizedEvent || null
  };
}

/**
 * Read intelligence back off a monitoring event, if present.
 * @param {object} event
 * @returns {object|null}
 */
function readIntelligence(event) {
  if (!event || typeof event !== "object") return null;
  const value = event[INTELLIGENCE_FIELD];
  return value && typeof value === "object" ? value : null;
}

module.exports = {
  INTELLIGENCE_FIELD,
  buildNormalizedEvent,
  toWorkflowMonitoringEvent,
  readIntelligence
};
