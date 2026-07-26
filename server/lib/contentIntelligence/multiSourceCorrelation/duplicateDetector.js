"use strict";

/**
 * CIP Stage 3D — deterministic duplicate / replacement / superseded detection.
 *
 * Documents are only MARKED — never deleted, merged, or rewritten.
 */

const { DUPLICATE_TYPES } = require("./correlationTypes");
const { tokenSet, jaccardSimilarity, isoDateMs } = require("./correlationUtils");

const NEAR_DUPLICATE_THRESHOLD = 0.85;
const REPLACEMENT_THRESHOLD = 0.5;
const UNKNOWN_RELATIONSHIP_THRESHOLD = 0.7;

/** Best deterministic timestamp for revision comparison; null when unavailable. */
function revisionDateMs(view) {
  return (
    isoDateMs(view.evidence.documentDates.modificationDate) ??
    isoDateMs(view.evidence.documentDates.creationDate) ??
    isoDateMs(view.evidence.importantDates && view.evidence.importantDates.notificationDate) ??
    null
  );
}

/**
 * Decide which of two same-role documents deterministically replaces the other.
 * Returns { newer, older } or null when no deterministic ordering exists.
 */
function resolveReplacementOrder(viewA, viewB) {
  const markersA = viewA.revisionMarkers.length;
  const markersB = viewB.revisionMarkers.length;
  if (markersA > 0 && markersB === 0) return { newer: viewA, older: viewB };
  if (markersB > 0 && markersA === 0) return { newer: viewB, older: viewA };

  const dateA = revisionDateMs(viewA);
  const dateB = revisionDateMs(viewB);
  if (dateA != null && dateB != null && dateA !== dateB) {
    return dateA > dateB ? { newer: viewA, older: viewB } : { newer: viewB, older: viewA };
  }
  return null;
}

function analyzePair(viewA, viewB, edge) {
  if (viewA.fingerprint === viewB.fingerprint) {
    return {
      documentIdA: viewA.documentId,
      documentIdB: viewB.documentId,
      duplicateType: DUPLICATE_TYPES.EXACT_DUPLICATE,
      similarity: 1,
      supersededDocumentId: null,
      replacementDocumentId: null,
      evidence: ["identical_content_fingerprint"]
    };
  }

  const similarity = jaccardSimilarity(
    tokenSet(`${viewA.title || ""} ${viewA.bodyText}`),
    tokenSet(`${viewB.title || ""} ${viewB.bodyText}`)
  );
  const sameRole = viewA.role === viewB.role;
  const correlated = Boolean(edge && edge.correlated);

  if (sameRole && correlated && similarity >= REPLACEMENT_THRESHOLD) {
    const order = resolveReplacementOrder(viewA, viewB);
    if (order) {
      return {
        documentIdA: viewA.documentId,
        documentIdB: viewB.documentId,
        duplicateType: DUPLICATE_TYPES.REPLACEMENT,
        similarity,
        supersededDocumentId: order.older.documentId,
        replacementDocumentId: order.newer.documentId,
        evidence: [
          "same_role",
          "correlated_pair",
          order.newer.revisionMarkers.length
            ? `revision_markers:${order.newer.revisionMarkers.join(",")}`
            : "later_document_date"
        ]
      };
    }
    if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
      return {
        documentIdA: viewA.documentId,
        documentIdB: viewB.documentId,
        duplicateType: DUPLICATE_TYPES.NEAR_DUPLICATE,
        similarity,
        supersededDocumentId: null,
        replacementDocumentId: null,
        evidence: ["same_role", "correlated_pair", `token_similarity:${similarity}`]
      };
    }
  }

  if (!sameRole && similarity >= UNKNOWN_RELATIONSHIP_THRESHOLD) {
    return {
      documentIdA: viewA.documentId,
      documentIdB: viewB.documentId,
      duplicateType: DUPLICATE_TYPES.UNKNOWN_RELATIONSHIP,
      similarity,
      supersededDocumentId: null,
      replacementDocumentId: null,
      evidence: ["different_roles", `token_similarity:${similarity}`]
    };
  }

  return null;
}

/**
 * Analyze every unordered pair. Duplicates are marked, never removed.
 *
 * @param {Array} views Document views (documentAdapter output).
 * @param {Array} edges Pairwise correlation edges (relationshipEngine output).
 */
function analyzeDuplicates(views, edges) {
  const edgeByPair = new Map(
    edges.map((edge) => [`${edge.fromDocumentId}|${edge.toDocumentId}`, edge])
  );

  const pairs = [];
  for (let i = 0; i < views.length; i += 1) {
    for (let j = i + 1; j < views.length; j += 1) {
      const edge = edgeByPair.get(`${views[i].documentId}|${views[j].documentId}`) || null;
      const record = analyzePair(views[i], views[j], edge);
      if (record) pairs.push(record);
    }
  }

  const marks = {};
  function markFor(documentId) {
    if (!marks[documentId]) {
      marks[documentId] = {
        documentId,
        exactDuplicateOf: [],
        nearDuplicateOf: [],
        replaces: [],
        replacedBy: [],
        supersededBy: []
      };
    }
    return marks[documentId];
  }

  for (const pair of pairs) {
    if (pair.duplicateType === DUPLICATE_TYPES.EXACT_DUPLICATE) {
      // The later input is marked as duplicate of the earlier one.
      markFor(pair.documentIdB).exactDuplicateOf.push(pair.documentIdA);
      markFor(pair.documentIdA).exactDuplicateOf.push(pair.documentIdB);
    } else if (pair.duplicateType === DUPLICATE_TYPES.NEAR_DUPLICATE) {
      markFor(pair.documentIdA).nearDuplicateOf.push(pair.documentIdB);
      markFor(pair.documentIdB).nearDuplicateOf.push(pair.documentIdA);
    } else if (pair.duplicateType === DUPLICATE_TYPES.REPLACEMENT) {
      markFor(pair.replacementDocumentId).replaces.push(pair.supersededDocumentId);
      markFor(pair.supersededDocumentId).replacedBy.push(pair.replacementDocumentId);
      markFor(pair.supersededDocumentId).supersededBy.push(pair.replacementDocumentId);
    }
  }

  return {
    pairs,
    marks,
    exactDuplicateCount: pairs.filter((p) => p.duplicateType === DUPLICATE_TYPES.EXACT_DUPLICATE)
      .length,
    nearDuplicateCount: pairs.filter((p) => p.duplicateType === DUPLICATE_TYPES.NEAR_DUPLICATE)
      .length,
    replacementCount: pairs.filter((p) => p.duplicateType === DUPLICATE_TYPES.REPLACEMENT).length,
    unknownRelationshipCount: pairs.filter(
      (p) => p.duplicateType === DUPLICATE_TYPES.UNKNOWN_RELATIONSHIP
    ).length
  };
}

module.exports = {
  NEAR_DUPLICATE_THRESHOLD,
  REPLACEMENT_THRESHOLD,
  UNKNOWN_RELATIONSHIP_THRESHOLD,
  revisionDateMs,
  resolveReplacementOrder,
  analyzeDuplicates
};
