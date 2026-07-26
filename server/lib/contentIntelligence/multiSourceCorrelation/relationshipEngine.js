"use strict";

/**
 * CIP Stage 3D — deterministic pairwise correlation and clustering.
 *
 * A pair of documents is correlated ONLY when:
 *   - at least one STRONG evidence item exists (shared advertisement number,
 *     explicit identifier cross-reference, or explicit URL cross-reference), OR
 *   - the organization matches AND at least one more MEDIUM evidence item
 *     exists (recruitment name, post name, exam name, or shared document URL).
 *
 * Weak evidence (matching dates, department) is reported but never sufficient.
 */

const {
  EVIDENCE_KINDS,
  EVIDENCE_STRENGTHS,
  EVIDENCE_STRENGTH_RANK,
  ROLE_TIMELINE_PRECEDENCE,
  DOCUMENT_ROLES
} = require("./correlationTypes");
const { identityKey, urlHasDocumentPath } = require("./correlationUtils");

function pushEvidence(evidence, kind, strength, valueA, valueB, detail) {
  evidence.push({
    kind,
    strength,
    valueA: valueA == null ? null : String(valueA),
    valueB: valueB == null ? null : String(valueB),
    detail: detail || null
  });
}

/** Collect every deterministic evidence item shared by two document views. */
function buildPairEvidence(viewA, viewB) {
  const evidence = [];
  const a = viewA.evidence;
  const b = viewB.evidence;

  if (a.advertisementNumberKey && a.advertisementNumberKey === b.advertisementNumberKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.ADVERTISEMENT_NUMBER,
      EVIDENCE_STRENGTHS.STRONG,
      a.advertisementNumber,
      b.advertisementNumber,
      "Both documents declare the same advertisement/notification number."
    );
  }

  if (b.advertisementNumberKey && a.referencedIdentifiers.includes(b.advertisementNumberKey)) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.CROSS_REFERENCE,
      EVIDENCE_STRENGTHS.STRONG,
      b.advertisementNumberKey,
      b.advertisementNumber,
      `${viewA.documentId} references the identifier declared by ${viewB.documentId}.`
    );
  } else if (a.advertisementNumberKey && b.referencedIdentifiers.includes(a.advertisementNumberKey)) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.CROSS_REFERENCE,
      EVIDENCE_STRENGTHS.STRONG,
      a.advertisementNumber,
      a.advertisementNumberKey,
      `${viewB.documentId} references the identifier declared by ${viewA.documentId}.`
    );
  }

  if (viewB.sourceUrlKey && a.referenceUrls.includes(viewB.sourceUrlKey)) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.REFERENCE_URL,
      EVIDENCE_STRENGTHS.STRONG,
      viewB.sourceUrlKey,
      viewB.sourceUrl,
      `${viewA.documentId} links directly to ${viewB.documentId}.`
    );
  } else if (viewA.sourceUrlKey && b.referenceUrls.includes(viewA.sourceUrlKey)) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.REFERENCE_URL,
      EVIDENCE_STRENGTHS.STRONG,
      viewA.sourceUrl,
      viewA.sourceUrlKey,
      `${viewB.documentId} links directly to ${viewA.documentId}.`
    );
  }

  const ownUrls = new Set([viewA.sourceUrlKey, viewB.sourceUrlKey].filter(Boolean));
  const sharedUrls = a.referenceUrls.filter(
    (url) => b.referenceUrls.includes(url) && !ownUrls.has(url) && urlHasDocumentPath(url)
  );
  if (sharedUrls.length) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.SHARED_REFERENCE_URL,
      EVIDENCE_STRENGTHS.MEDIUM,
      sharedUrls[0],
      sharedUrls[0],
      `Both documents reference ${sharedUrls.length} common official URL(s).`
    );
  }

  if (a.organizationKey && a.organizationKey === b.organizationKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.ORGANIZATION,
      EVIDENCE_STRENGTHS.MEDIUM,
      a.organization,
      b.organization,
      "Same issuing organization."
    );
  }

  if (a.recruitmentNameKey && a.recruitmentNameKey === b.recruitmentNameKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.RECRUITMENT_NAME,
      EVIDENCE_STRENGTHS.MEDIUM,
      a.recruitmentName,
      b.recruitmentName,
      "Role-independent recruitment names match."
    );
  }

  if (a.postNameKey && a.postNameKey === b.postNameKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.POST_NAME,
      EVIDENCE_STRENGTHS.MEDIUM,
      a.postName,
      b.postName,
      "Same post name."
    );
  }

  if (a.examNameKey && a.examNameKey === b.examNameKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.EXAM_NAME,
      EVIDENCE_STRENGTHS.MEDIUM,
      a.examName,
      b.examName,
      "Same exam name."
    );
  }

  if (a.departmentKey && a.departmentKey === b.departmentKey) {
    pushEvidence(
      evidence,
      EVIDENCE_KINDS.DEPARTMENT,
      EVIDENCE_STRENGTHS.WEAK,
      a.department,
      b.department,
      "Same department (supporting evidence only)."
    );
  }

  for (const [field, valueA] of Object.entries(a.importantDates || {})) {
    const valueB = (b.importantDates || {})[field];
    if (valueA && valueB && valueA === valueB) {
      pushEvidence(
        evidence,
        EVIDENCE_KINDS.DATE,
        EVIDENCE_STRENGTHS.WEAK,
        valueA,
        valueB,
        `Matching ${field} (supporting evidence only).`
      );
    }
  }

  evidence.sort((x, y) => {
    const rank = (EVIDENCE_STRENGTH_RANK[y.strength] || 0) - (EVIDENCE_STRENGTH_RANK[x.strength] || 0);
    if (rank !== 0) return rank;
    return String(x.kind).localeCompare(String(y.kind));
  });
  return evidence;
}

/** Deterministic correlation decision for one evidence set. */
function evaluatePair(evidence) {
  const strong = evidence.filter((item) => item.strength === EVIDENCE_STRENGTHS.STRONG);
  const medium = evidence.filter((item) => item.strength === EVIDENCE_STRENGTHS.MEDIUM);
  const hasOrganization = medium.some((item) => item.kind === EVIDENCE_KINDS.ORGANIZATION);

  if (strong.length > 0) {
    return { correlated: true, confidence: "high" };
  }
  if (hasOrganization && medium.length >= 2) {
    return { correlated: true, confidence: "medium" };
  }
  return { correlated: false, confidence: evidence.length > 0 ? "low" : "none" };
}

/** Build correlation edges for every unordered document pair. */
function buildRelationships(views) {
  const edges = [];
  for (let i = 0; i < views.length; i += 1) {
    for (let j = i + 1; j < views.length; j += 1) {
      const evidence = buildPairEvidence(views[i], views[j]);
      const decision = evaluatePair(evidence);
      edges.push({
        fromDocumentId: views[i].documentId,
        toDocumentId: views[j].documentId,
        correlated: decision.correlated,
        confidence: decision.confidence,
        evidence
      });
    }
  }
  return edges;
}

/** Union-find clustering over correlated edges; deterministic ordering. */
function clusterDocuments(views, edges) {
  const parent = new Map(views.map((view) => [view.documentId, view.documentId]));

  function find(id) {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = id;
    while (parent.get(current) !== current) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  for (const edge of edges) {
    if (!edge.correlated) continue;
    const rootA = find(edge.fromDocumentId);
    const rootB = find(edge.toDocumentId);
    if (rootA !== rootB) {
      // Attach to the lexicographically smaller root for determinism.
      if (rootA < rootB) parent.set(rootB, rootA);
      else parent.set(rootA, rootB);
    }
  }

  const byRoot = new Map();
  for (const view of views) {
    const root = find(view.documentId);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(view.documentId);
  }

  const clusters = [...byRoot.values()].map((documentIds) =>
    documentIds.slice().sort((a, b) => {
      const ia = views.find((view) => view.documentId === a).inputIndex;
      const ib = views.find((view) => view.documentId === b).inputIndex;
      return ia - ib;
    })
  );
  clusters.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const ia = views.find((view) => view.documentId === a[0]).inputIndex;
    const ib = views.find((view) => view.documentId === b[0]).inputIndex;
    return ia - ib;
  });
  return clusters;
}

/**
 * Aggregate the recruitment identity from a cluster of views.
 * Values are taken from documents in lifecycle order (notification first);
 * nothing is invented — missing fields stay null.
 */
function buildRecruitmentIdentity(clusterViews) {
  const ordered = clusterViews
    .slice()
    .sort((a, b) => {
      const pa = ROLE_TIMELINE_PRECEDENCE[a.role] ?? 999;
      const pb = ROLE_TIMELINE_PRECEDENCE[b.role] ?? 999;
      if (pa !== pb) return pa - pb;
      return a.inputIndex - b.inputIndex;
    });

  const fields = [
    ["organization", (view) => view.evidence.organization],
    ["advertisementNumber", (view) => view.evidence.advertisementNumber],
    ["recruitmentName", (view) => view.evidence.recruitmentName],
    ["postName", (view) => view.evidence.postName],
    ["department", (view) => view.evidence.department],
    ["examName", (view) => view.evidence.examName]
  ];

  const identity = {};
  const identitySources = {};
  for (const [field, getter] of fields) {
    identity[field] = null;
    identitySources[field] = null;
    for (const view of ordered) {
      const value = getter(view);
      if (value != null && value !== "") {
        identity[field] = value;
        identitySources[field] = view.documentId;
        break;
      }
    }
  }

  const advertisementKey = identityKey(identity.advertisementNumber);
  const organizationKey = identityKey(identity.organization);
  const nameKey =
    identityKey(identity.recruitmentName) || identityKey(identity.postName) || null;

  let recruitmentKey = null;
  if (advertisementKey) recruitmentKey = advertisementKey;
  else if (organizationKey && nameKey) recruitmentKey = `${organizationKey}|${nameKey}`;
  else if (nameKey) recruitmentKey = nameKey;

  let confidence = "low";
  if (identity.advertisementNumber && identity.organization) confidence = "high";
  else if (identity.organization) confidence = "medium";

  const hasNotification = ordered.some((view) => view.role === DOCUMENT_ROLES.NOTIFICATION);

  return {
    recruitmentKey,
    organization: identity.organization,
    advertisementNumber: identity.advertisementNumber,
    recruitmentName: identity.recruitmentName,
    postName: identity.postName,
    department: identity.department,
    examName: identity.examName,
    identitySources,
    hasNotification,
    confidence
  };
}

module.exports = {
  buildPairEvidence,
  evaluatePair,
  buildRelationships,
  clusterDocuments,
  buildRecruitmentIdentity
};
