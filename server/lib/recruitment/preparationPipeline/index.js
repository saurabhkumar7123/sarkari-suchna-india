"use strict";

/**
 * Preparation Pipeline — readiness orchestration helpers.
 *
 * Composes extraction quality, classification, validation, section mapping,
 * and merge context for the live AMP-4B path. Does not enable automation.
 */

const { assessExtractionConfidence, ADVISORY_STATUS, EXTRACTION_CODES } = require("./extractionQualityGate");
const { classifyLifecycleDocument, PRODUCT_EVENT_TYPES } = require("./documentLifecycleClassification");
const {
  mapStructuredSectionsToGenerator,
  fieldEnvelope,
  SECTION_TAXONOMY,
  SUGGESTED_SECTIONS_BY_EVENT
} = require("./sectionTaxonomy");
const { validatePreparationDraft } = require("./advisoryValidation");
const {
  buildUpdateMergeContext,
  buildEventDraftTitle,
  mergePublisherSectionText,
  diffPublisherSections,
  resolveCombinedPreviewText,
  editorLooksFullyMerged,
  GENERATOR_MODES
} = require("./updateMergeContext");
const {
  normalizePublisherDocument,
  mergeStructuredPublisherDocuments,
  assessPublishPrepReadiness,
  buildRawSourceEnvelope,
  FIELD_ACTIONS
} = require("./structuredNormalizeMerge");
const { describeAuthoritativePath } = require("./authoritativePath");
const {
  evaluateLifecycleMatch
} = require("../lifecycleMatching");
const {
  resolvePersistenceDecision,
  MATCH_LEVELS,
  PERSISTENCE_DECISIONS,
  isDownstreamEvent
} = require("../lifecycleSafety");
const { resolveCanonicalFromLinkedPages } = require("../canonicalPublicPage");

/**
 * Evaluate preparation readiness for a detected document (pure / advisory).
 */
function evaluatePreparationPackage(input = {}) {
  const classification = classifyLifecycleDocument({
    title: input.title,
    content: input.content || input.extractedText,
    url: input.url,
    sourceDocumentRef: input.sourceDocumentRef || input.documentHash || null
  });

  const extraction = assessExtractionConfidence({
    text: input.extractedText || input.content,
    pageCount: input.pageCount,
    ocrUsed: input.ocrUsed,
    extractionNote: input.extractionNote,
    errorCode: input.extractionErrorCode,
    pdfParseLen: input.pdfParseLen,
    pdfJsLen: input.pdfJsLen
  });

  const structuredMap = mapStructuredSectionsToGenerator(input.structuredSections || [], {
    eventType: classification.product_event_type
  });

  const publisherText =
    (input.publisherText && String(input.publisherText).trim()) ||
    structuredMap.publisherText ||
    "";

  const validation = validatePreparationDraft({
    text: publisherText,
    title: input.title,
    eventType: classification.event_type,
    identity: input.identity || {},
    extractedText: input.extractedText || input.content,
    extractionStatus: extraction.status
  });

  const matchEvaluation =
    input.matchEvaluation ||
    evaluateLifecycleMatch({
      notice: {
        title: input.title,
        url: input.url,
        content: input.content || input.extractedText,
        text: input.content || input.extractedText,
        advertisement_no: input.identity && (input.identity.advertisementNo || input.identity.advertisement_no),
        organization: input.identity && input.identity.organization,
        department: input.identity && (input.identity.department || input.identity.organization),
        exam_name: input.identity && (input.identity.examName || input.identity.exam_name),
        post_name: input.identity && (input.identity.postName || input.identity.post_name),
        year: input.identity && (input.identity.cycleYear || input.identity.year),
        recruitment_year: input.identity && (input.identity.cycleYear || input.identity.year),
        cycle_year: input.identity && (input.identity.cycleYear || input.identity.year)
      },
      recruitmentCandidates: input.recruitmentCandidates || [],
      pageCandidates: input.pageCandidates || []
    });

  const identityForPersistence = {
    ...(matchEvaluation.identity || {}),
    ...(input.identity || {}),
    advertisementNo:
      (input.identity && (input.identity.advertisementNo || input.identity.advertisement_no)) ||
      (matchEvaluation.identity && matchEvaluation.identity.advertisementNo) ||
      null,
    organization:
      (input.identity && input.identity.organization) ||
      (matchEvaluation.identity && matchEvaluation.identity.organization) ||
      null,
    examName:
      (input.identity && (input.identity.examName || input.identity.exam_name)) ||
      (matchEvaluation.identity && matchEvaluation.identity.examName) ||
      null,
    postName:
      (input.identity && (input.identity.postName || input.identity.post_name)) ||
      (matchEvaluation.identity && matchEvaluation.identity.postName) ||
      null,
    cycleYear:
      (input.identity && (input.identity.cycleYear || input.identity.year)) ||
      (matchEvaluation.identity &&
        (matchEvaluation.identity.cycleYear || matchEvaluation.identity.recruitmentYear)) ||
      null
  };

  const persistence = resolvePersistenceDecision({
    eventType: classification.event_type,
    matchLevel: matchEvaluation.matchLevel,
    identity: identityForPersistence,
    advisoryDecision: input.advisoryDecision || null
  });

  const canonical = resolveCanonicalFromLinkedPages(input.linkedPages || []);
  const mergeContext = buildUpdateMergeContext({
    recruitment: input.recruitment || matchEvaluation.selected?.record || null,
    eventType: classification.event_type,
    event: input.event || null,
    draft: input.draft || null,
    linkedPages: input.linkedPages || [],
    existingPageContent: input.existingPageContent || null,
    existingPageVersion: input.existingPageVersion || null,
    sourceDocument: {
      url: input.url || null,
      hash: input.documentHash || null,
      reference: classification.source_document_reference
    },
    extraction,
    validation,
    structuredSections: structuredMap.sections
  });

  const draftTitle = buildEventDraftTitle(
    (input.recruitment && (input.recruitment.title || input.recruitment.recruitment_name)) ||
      input.title,
    classification.event_type
  );

  return Object.freeze({
    classification,
    extraction,
    validation,
    matching: Object.freeze({
      matchLevel: matchEvaluation.matchLevel,
      selectedRecruitmentId: matchEvaluation.selectedRecruitmentId || null,
      identity: matchEvaluation.identity || null,
      persistenceDecision: persistence.decision,
      persistenceReason: persistence.reason,
      createEligible: persistence.decision === PERSISTENCE_DECISIONS.CREATE_ELIGIBLE,
      needsMatching: persistence.decision === PERSISTENCE_DECISIONS.NEEDS_MATCHING,
      downstreamWithoutParent:
        isDownstreamEvent(classification.event_type) &&
        !matchEvaluation.selectedRecruitmentId &&
        matchEvaluation.matchLevel === MATCH_LEVELS.NO_MATCH
    }),
    pageMatching: Object.freeze({
      status: canonical.status,
      slug: canonical.page ? canonical.page.slug : null,
      ambiguous: canonical.ambiguous
    }),
    structuredMap,
    mergeContext,
    draftTitle,
    generatorMode: mergeContext.generatorMode,
    reviewSurface: Object.freeze({
      document: input.title || null,
      eventType: classification.event_type,
      productEventType: classification.product_event_type,
      aiConfidence: classification.confidence,
      extractionStatus: extraction.status,
      extractionCode: extraction.code,
      validationStatus: validation.status,
      conversionStatus: input.conversionAccepted === true ? "accepted" : input.conversionAccepted === false ? "failed" : "pending",
      canonicalPage: mergeContext.canonicalPage.slug,
      warnings: Object.freeze([
        ...(extraction.findings || []).map((f) => f.message),
        ...(validation.warnings || []).map((w) => w.message),
        ...(validation.problems || []).map((p) => p.message)
      ])
    }),
    automation: Object.freeze({
      preparesOnly: true,
      autoPublishImpossible: true,
      humanPublishOnly: true
    }),
    authoritativePath: describeAuthoritativePath()
  });
}

module.exports = {
  ADVISORY_STATUS,
  EXTRACTION_CODES,
  PRODUCT_EVENT_TYPES,
  SECTION_TAXONOMY,
  SUGGESTED_SECTIONS_BY_EVENT,
  GENERATOR_MODES,
  MATCH_LEVELS,
  PERSISTENCE_DECISIONS,
  assessExtractionConfidence,
  classifyLifecycleDocument,
  mapStructuredSectionsToGenerator,
  fieldEnvelope,
  validatePreparationDraft,
  buildUpdateMergeContext,
  buildEventDraftTitle,
  mergePublisherSectionText,
  diffPublisherSections,
  resolveCombinedPreviewText,
  editorLooksFullyMerged,
  normalizePublisherDocument,
  mergeStructuredPublisherDocuments,
  assessPublishPrepReadiness,
  buildRawSourceEnvelope,
  FIELD_ACTIONS,
  evaluatePreparationPackage,
  describeAuthoritativePath
};
