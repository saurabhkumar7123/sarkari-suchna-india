"use strict";

/**
 * CIP Stage 3D — shared deterministic Multi-Source Correlation Engine facade.
 *
 * Correlates related official documents (normalized by Stage 3B/3C) belonging
 * to the same recruitment lifecycle into one canonical recruitment view.
 * Documents are never merged, rewritten, deleted, or published; the engine
 * never calls AI, OCR, or the network.
 */

const engine = require("./correlationEngine");
const types = require("./correlationTypes");
const utils = require("./correlationUtils");
const adapter = require("./documentAdapter");
const relationships = require("./relationshipEngine");
const duplicates = require("./duplicateDetector");
const changes = require("./changeDetector");
const timeline = require("./timelineBuilder");
const graph = require("./recruitmentGraphBuilder");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  CORRELATION_VERSION: engine.CORRELATION_VERSION,
  RECRUITMENT_CORRELATION_FORMAT_ID: engine.RECRUITMENT_CORRELATION_FORMAT_ID,

  // Shared primary API (used by both manual and automated workflows)
  correlateDocuments: engine.correlateDocuments,
  correlateNormalizedDocuments: engine.correlateNormalizedDocuments,
  correlationFingerprint: engine.correlationFingerprint,

  // Taxonomy
  DOCUMENT_ROLES: types.DOCUMENT_ROLES,
  DOCUMENT_ROLE_LABELS: types.DOCUMENT_ROLE_LABELS,
  ROLE_TIMELINE_PRECEDENCE: types.ROLE_TIMELINE_PRECEDENCE,
  DOCUMENT_KINDS: types.DOCUMENT_KINDS,
  EVIDENCE_KINDS: types.EVIDENCE_KINDS,
  EVIDENCE_STRENGTHS: types.EVIDENCE_STRENGTHS,
  DUPLICATE_TYPES: types.DUPLICATE_TYPES,
  CHANGE_TYPES: types.CHANGE_TYPES,
  CONFIDENCE_LEVELS: types.CONFIDENCE_LEVELS,
  GRAPH_ROOT_ID: types.GRAPH_ROOT_ID,
  isKnownDocumentRole: types.isKnownDocumentRole,
  getDocumentRoleLabel: types.getDocumentRoleLabel,

  // Deterministic helpers for tests and extension
  buildDocumentView: adapter.buildDocumentView,
  buildDocumentViews: adapter.buildDocumentViews,
  buildRecruitmentNameKey: adapter.buildRecruitmentNameKey,
  extractReferencedIdentifiers: adapter.extractReferencedIdentifiers,
  extractRevisionMarkers: adapter.extractRevisionMarkers,
  extractApplicationFee: adapter.extractApplicationFee,
  extractExamName: adapter.extractExamName,
  isNormalizedHtmlDocument: adapter.isNormalizedHtmlDocument,
  isNormalizedPdfDocument: adapter.isNormalizedPdfDocument,
  ROLE_PATTERNS: adapter.ROLE_PATTERNS,
  STAGE1A_TYPE_TO_ROLE: adapter.STAGE1A_TYPE_TO_ROLE,

  buildPairEvidence: relationships.buildPairEvidence,
  evaluatePair: relationships.evaluatePair,
  buildRelationships: relationships.buildRelationships,
  clusterDocuments: relationships.clusterDocuments,
  buildRecruitmentIdentity: relationships.buildRecruitmentIdentity,

  analyzeDuplicates: duplicates.analyzeDuplicates,
  resolveReplacementOrder: duplicates.resolveReplacementOrder,
  NEAR_DUPLICATE_THRESHOLD: duplicates.NEAR_DUPLICATE_THRESHOLD,
  REPLACEMENT_THRESHOLD: duplicates.REPLACEMENT_THRESHOLD,

  detectChanges: changes.detectChanges,
  DATE_FIELD_CHANGE_TYPES: changes.DATE_FIELD_CHANGE_TYPES,

  buildTimeline: timeline.buildTimeline,
  resolveTimelineDate: timeline.resolveTimelineDate,
  ROLE_DATE_FIELDS: timeline.ROLE_DATE_FIELDS,

  buildRecruitmentGraph: graph.buildRecruitmentGraph,

  identityKey: utils.identityKey,
  identifierKey: utils.identifierKey,
  urlKey: utils.urlKey,
  jaccardSimilarity: utils.jaccardSimilarity,
  tokenSet: utils.tokenSet,
  deepFreeze: utils.deepFreeze
};
