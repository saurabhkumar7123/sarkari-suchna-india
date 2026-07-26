"use strict";

/**
 * CIP Stage 3D — Multi-Source Correlation Engine.
 *
 * Shared deterministic service for manual and automated workflows.
 * Correlates already-normalized documents (Stage 3B HTML, Stage 3C PDF, or
 * plain descriptors) that belong to the same recruitment lifecycle into one
 * canonical recruitment correlation view.
 *
 * Boundaries:
 *   - No AI, OCR, network, downloading, content rewriting, or merging
 *   - Never deletes duplicates — marks them only
 *   - Never modifies Program 1, Program 2, or Stages 3A–3C
 */

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CORRELATION_VERSION,
  RECRUITMENT_CORRELATION_FORMAT_ID,
  DOCUMENT_ROLES
} = require("./correlationTypes");
const { deepFreeze } = require("./correlationUtils");
const { buildDocumentViews } = require("./documentAdapter");
const {
  buildRelationships,
  clusterDocuments,
  buildRecruitmentIdentity
} = require("./relationshipEngine");
const { analyzeDuplicates } = require("./duplicateDetector");
const { detectChanges } = require("./changeDetector");
const { buildTimeline } = require("./timelineBuilder");
const { buildRecruitmentGraph } = require("./recruitmentGraphBuilder");

function normalizeInput(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.documents)) {
    return input.documents;
  }
  throw new TypeError(
    "Correlation input must be an array of documents or an object with a documents array."
  );
}

function toPublicDocument(view, correlatedIds, duplicateMarks) {
  return {
    documentId: view.documentId,
    inputIndex: view.inputIndex,
    kind: view.kind,
    formatId: view.formatId,
    sourceEngineId: view.sourceEngineId,
    sourceStageId: view.sourceStageId,
    role: view.role,
    roleLabel: view.roleLabel,
    roleSource: view.roleSource,
    roleConfidence: view.roleConfidence,
    title: view.title,
    filename: view.filename,
    sourceUrl: view.sourceUrl,
    fingerprint: view.fingerprint,
    sections: view.sections,
    revisionMarkers: view.revisionMarkers,
    applicationFee: view.applicationFee,
    totalPosts: view.totalPosts,
    evidence: view.evidence,
    metadata: view.metadata,
    correlated: correlatedIds.has(view.documentId),
    duplicateMarks: duplicateMarks[view.documentId] || null,
    warnings: view.warnings,
    // Traceability: lossless reference back to the original normalized input.
    trace: {
      inputIndex: view.inputIndex,
      formatId: view.formatId,
      engineId: view.sourceEngineId,
      stageId: view.sourceStageId,
      sourceUrl: view.sourceUrl,
      fingerprint: view.fingerprint
    }
  };
}

function resolveCorrelationConfidence(primaryIds, edges) {
  if (primaryIds.size === 0) return "none";
  if (primaryIds.size === 1) return "low";
  const clusterEdges = edges.filter(
    (edge) =>
      edge.correlated && primaryIds.has(edge.fromDocumentId) && primaryIds.has(edge.toDocumentId)
  );
  if (!clusterEdges.length) return "low";
  return clusterEdges.every((edge) => edge.confidence === "high") ? "high" : "medium";
}

function selectChangePairs(views, duplicateAnalysis, primaryIds) {
  const byId = new Map(views.map((view) => [view.documentId, view]));
  const pairs = [];
  const seen = new Set();

  function addPair(previousId, currentId, compareSections) {
    const key = `${previousId}|${currentId}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({
      previousView: byId.get(previousId),
      currentView: byId.get(currentId),
      compareSections
    });
  }

  // Replacement pairs: full same-role revision comparison including sections.
  for (const pair of duplicateAnalysis.pairs) {
    if (
      pair.duplicateType === "replacement" &&
      primaryIds.has(pair.supersededDocumentId) &&
      primaryIds.has(pair.replacementDocumentId)
    ) {
      addPair(pair.supersededDocumentId, pair.replacementDocumentId, true);
    }
  }

  // Corrigendum / short-notice updates compared against the primary notification.
  const primaryViews = views.filter((view) => primaryIds.has(view.documentId));
  const notification = primaryViews.find((view) => view.role === DOCUMENT_ROLES.NOTIFICATION);
  if (notification) {
    for (const view of primaryViews) {
      if (view.role === DOCUMENT_ROLES.CORRIGENDUM) {
        addPair(notification.documentId, view.documentId, false);
      }
    }
  }

  return pairs;
}

function buildEmptyCorrelation(freeze) {
  const correlation = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    version: CORRELATION_VERSION,
    formatId: RECRUITMENT_CORRELATION_FORMAT_ID,
    recruitmentIdentity: {
      recruitmentKey: null,
      organization: null,
      advertisementNumber: null,
      recruitmentName: null,
      postName: null,
      department: null,
      examName: null,
      identitySources: {},
      hasNotification: false,
      confidence: "none"
    },
    documents: [],
    relationships: [],
    relationshipGraph: {
      rootId: "recruitment",
      root: {
        id: "recruitment",
        type: "recruitment",
        recruitmentKey: null,
        organization: null,
        advertisementNumber: null,
        recruitmentName: null
      },
      primaryNotificationId: null,
      nodes: [],
      edges: [],
      childrenByRole: {}
    },
    correlationConfidence: "none",
    detectedChanges: [],
    duplicateAnalysis: {
      pairs: [],
      marks: {},
      exactDuplicateCount: 0,
      nearDuplicateCount: 0,
      replacementCount: 0,
      unknownRelationshipCount: 0
    },
    timeline: [],
    unrelatedDocumentIds: [],
    warnings: ["No documents provided for correlation."],
    summary: {
      documentCount: 0,
      correlatedDocumentCount: 0,
      unrelatedDocumentCount: 0,
      rolesPresent: {},
      relationshipCount: 0,
      duplicatePairCount: 0,
      changeCount: 0,
      timelineLength: 0,
      primaryNotificationDocumentId: null
    }
  };
  return freeze === false ? correlation : deepFreeze(correlation);
}

/**
 * Correlate multiple normalized documents into one canonical recruitment view.
 *
 * @param {Array|{documents: Array}} input Documents to correlate. Each item may
 *   be a Stage 3B normalized HTML document, a Stage 3C normalized PDF document,
 *   a `{ document, ...hints }` wrapper, or a plain descriptor for unknown docs.
 * @param {object} [options]
 * @param {boolean} [options.freeze=true] Deep-freeze the returned object.
 * @returns Canonical Recruitment Correlation object.
 */
function correlateDocuments(input, options = {}) {
  const entries = normalizeInput(input);
  if (entries.length === 0) return buildEmptyCorrelation(options.freeze);

  const views = buildDocumentViews(entries);
  const edges = buildRelationships(views);
  const clusters = clusterDocuments(views, edges);

  const primaryIds = new Set(clusters[0]);
  const primaryViews = views.filter((view) => primaryIds.has(view.documentId));
  const unrelatedDocumentIds = views
    .filter((view) => !primaryIds.has(view.documentId))
    .map((view) => view.documentId);

  const identity = buildRecruitmentIdentity(primaryViews);
  const duplicateAnalysis = analyzeDuplicates(views, edges);
  const timeline = buildTimeline(primaryViews);
  const relationshipGraph = buildRecruitmentGraph(identity, primaryViews, edges, timeline);

  const detectedChanges = [];
  for (const pair of selectChangePairs(views, duplicateAnalysis, primaryIds)) {
    detectedChanges.push(
      ...detectChanges(pair.previousView, pair.currentView, {
        compareSections: pair.compareSections
      })
    );
  }

  const warnings = [];
  for (const view of views) {
    for (const warning of view.warnings) warnings.push(`${view.documentId}: ${warning}`);
  }
  if (views.length === 1) {
    warnings.push("Only one document provided; correlation is limited to a single source.");
  }
  if (unrelatedDocumentIds.length) {
    warnings.push(
      `${unrelatedDocumentIds.length} document(s) could not be deterministically correlated: ${unrelatedDocumentIds.join(", ")}.`
    );
  }
  if (!identity.hasNotification) {
    warnings.push("No notification document found; the recruitment root has no primary parent.");
  }
  if (duplicateAnalysis.exactDuplicateCount) {
    warnings.push(
      `${duplicateAnalysis.exactDuplicateCount} exact duplicate pair(s) detected; documents were marked, not removed.`
    );
  }
  if (!identity.recruitmentKey) {
    warnings.push("Recruitment identity could not be keyed; evidence is insufficient.");
  }

  const rolesPresent = {};
  for (const view of primaryViews) {
    rolesPresent[view.role] = (rolesPresent[view.role] || 0) + 1;
  }

  const correlation = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    version: CORRELATION_VERSION,
    formatId: RECRUITMENT_CORRELATION_FORMAT_ID,
    recruitmentIdentity: identity,
    documents: views.map((view) =>
      toPublicDocument(view, primaryIds, duplicateAnalysis.marks)
    ),
    relationships: edges,
    relationshipGraph,
    correlationConfidence: resolveCorrelationConfidence(primaryIds, edges),
    detectedChanges,
    duplicateAnalysis,
    timeline,
    unrelatedDocumentIds,
    warnings,
    summary: {
      documentCount: views.length,
      correlatedDocumentCount: primaryViews.length,
      unrelatedDocumentCount: unrelatedDocumentIds.length,
      rolesPresent,
      relationshipCount: edges.filter((edge) => edge.correlated).length,
      duplicatePairCount: duplicateAnalysis.pairs.length,
      changeCount: detectedChanges.length,
      timelineLength: timeline.length,
      primaryNotificationDocumentId: relationshipGraph.primaryNotificationId
    }
  };

  return options.freeze === false ? correlation : deepFreeze(correlation);
}

/** Convenience alias mirroring the naming of other CIP engines. */
function correlateNormalizedDocuments(documents, options = {}) {
  return correlateDocuments(documents, options);
}

function correlationFingerprint(correlation) {
  return JSON.stringify(correlation);
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CORRELATION_VERSION,
  RECRUITMENT_CORRELATION_FORMAT_ID,
  correlateDocuments,
  correlateNormalizedDocuments,
  correlationFingerprint,
  deepFreeze
};
