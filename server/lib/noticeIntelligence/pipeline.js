"use strict";

/**
 * Phase AI-2 — Government notice intelligence pipeline.
 *
 * Content Analysis → Event Detection → Recruitment Matching Candidate →
 * Event Classification → Priority → Confidence → Normalized Event.
 *
 * The pipeline is pure and side-effect free. It reads a monitoring event and
 * returns intelligence; it never fetches, schedules, persists or publishes.
 */

const { analyzeContent } = require("./contentAnalysis");
const { detectHeadings } = require("./headingIntelligence");
const { detectDepartment } = require("./departmentDetection");
const { extractReferences } = require("./referenceIntelligence");
const {
  detectEventCandidates,
  detectSubTypes,
  detectRecruitmentCandidate
} = require("./eventDetection");
const { classifyEvent, resolveTitle } = require("./eventClassification");
const { extractKeywords } = require("./keywordIntelligence");
const { buildConfidenceReport } = require("./confidenceEngine");
const { assignPriority } = require("./priorityEngine");
const { buildFingerprint } = require("./fingerprint");
const { validateNormalizedEvent } = require("./validation");
const {
  buildNormalizedEvent,
  toWorkflowMonitoringEvent,
  INTELLIGENCE_FIELD
} = require("./normalizedEvent");
const { ENGINE_VERSION, FORMAT_ID } = require("./types");
const { deepFreeze } = require("./textUtils");

/**
 * Accept either a raw monitoring event or an explicit content payload.
 * @param {object} input
 * @returns {object}
 */
function toContentInput(input = {}) {
  const event = input && typeof input === "object" ? input : {};
  return {
    html: event.html,
    pdfText: event.pdfText,
    pdf: event.pdf,
    text: event.text,
    content: event.content,
    title: event.title,
    url: event.url,
    sourceUrl: event.sourceUrl,
    contentType: event.contentType,
    documents: event.documents
  };
}

/**
 * Run the full Phase AI-2 intelligence pass over a government notice.
 *
 * @param {{
 *   html?: string,
 *   pdfText?: string,
 *   text?: string,
 *   title?: string,
 *   sourceUrl?: string,
 *   url?: string,
 *   contentType?: string,
 *   documents?: Array<object>
 * }} input monitoring event or content payload
 * @param {{ now?: Date, maxKeywords?: number }} [options]
 * @returns {{
 *   normalizedEvent: object,
 *   analysis: object,
 *   headings: object,
 *   classification: object,
 *   department: object,
 *   references: object,
 *   keywords: Array<object>,
 *   confidence: object,
 *   priority: object,
 *   recruitmentCandidate: object,
 *   fingerprint: object,
 *   validation: object,
 *   meta: object
 * }}
 */
function analyzeGovernmentNotice(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const startedAt = Date.now();

  const analysis = analyzeContent(toContentInput(input));
  const headingResult = detectHeadings(analysis);

  // The title is needed before classification because department, reference and
  // keyword extraction all weight title matches most heavily.
  const titleInfo = resolveTitle(analysis.titleCandidates);
  const enrichedAnalysis = { ...analysis, title: titleInfo.sourceTitle, headings: headingResult.headings };

  const references = extractReferences({
    title: titleInfo.sourceTitle,
    lines: analysis.lines,
    text: analysis.text
  });

  const department = detectDepartment({
    title: titleInfo.sourceTitle,
    url: analysis.url,
    lines: analysis.lines,
    text: analysis.text,
    headings: headingResult.headings
  });

  const candidates = detectEventCandidates(enrichedAnalysis, headingResult.headings);
  const subTypeCandidates = detectSubTypes(enrichedAnalysis, headingResult.headings);
  const classification = classifyEvent({
    analysis: enrichedAnalysis,
    candidates,
    subTypeCandidates
  });

  const recruitmentCandidate = detectRecruitmentCandidate(
    { ...enrichedAnalysis, departmentCode: department.departmentCode },
    candidates,
    references
  );

  const keywords = extractKeywords(
    {
      title: titleInfo.sourceTitle,
      text: analysis.text,
      headings: headingResult.headings
    },
    { maxKeywords: options.maxKeywords }
  );

  const confidence = buildConfidenceReport({
    classification,
    department,
    references,
    analysis: enrichedAnalysis,
    recruitmentCandidate,
    headingResult
  });

  const priority = assignPriority(
    {
      classification,
      references,
      department,
      recruitmentCandidate,
      analysis: enrichedAnalysis,
      overallConfidence: confidence.overallScore
    },
    { now }
  );

  const fingerprint = buildFingerprint({
    normalizedTitle: classification.normalizedTitle,
    department: department.department,
    departmentCode: department.departmentCode,
    advertisementNumber: references.advertisementNumber,
    referenceNumber: references.referenceNumber,
    year: references.year
  });

  const validation = validateNormalizedEvent({
    classification,
    department,
    references,
    confidence,
    analysis: enrichedAnalysis,
    headingResult
  });

  const normalizedEvent = buildNormalizedEvent({
    analysis: enrichedAnalysis,
    headingResult,
    classification,
    department,
    references,
    keywords,
    confidence,
    priority,
    recruitmentCandidate,
    fingerprint,
    validation,
    detectedAt: now.toISOString(),
    sourceUrl: analysis.url
  });

  return {
    normalizedEvent,
    analysis: enrichedAnalysis,
    headings: headingResult,
    classification,
    department,
    references,
    keywords,
    confidence,
    priority,
    recruitmentCandidate,
    fingerprint,
    validation,
    meta: deepFreeze({
      formatId: FORMAT_ID,
      engineVersion: ENGINE_VERSION,
      sourceFormat: analysis.sourceFormat,
      language: analysis.language,
      candidateCount: candidates.length,
      headingCount: headingResult.headings.length,
      durationMs: Date.now() - startedAt
    })
  };
}

/**
 * Convenience wrapper for callers that only need the enriched monitoring event.
 *
 * The result is the original event plus one additive key, so passing it to the
 * existing Production Workflow produces identical behaviour to passing the
 * original event.
 *
 * @param {object} monitoringEvent
 * @param {{ now?: Date, maxKeywords?: number }} [options]
 * @returns {object}
 */
function enrichMonitoringEvent(monitoringEvent, options = {}) {
  const result = analyzeGovernmentNotice(monitoringEvent, options);
  return toWorkflowMonitoringEvent(monitoringEvent, result.normalizedEvent);
}

module.exports = {
  INTELLIGENCE_FIELD,
  analyzeGovernmentNotice,
  enrichMonitoringEvent
};
