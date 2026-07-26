"use strict";

/**
 * CIP Stage 3D — canonical recruitment graph builder.
 *
 * Builds a reference graph:
 *
 *   Recruitment (root)
 *   ├── Notification (primary parent when present)
 *   │     ├── Corrigendum
 *   │     ├── Admit Card
 *   │     └── …
 *   └── documents without a notification parent attach to the root
 *
 * Document bodies are never merged — nodes carry references only.
 */

const {
  DOCUMENT_ROLES,
  GRAPH_ROOT_ID
} = require("./correlationTypes");

function relationshipTypeFor(parentId, role, primaryNotificationId) {
  const parentLabel = parentId === GRAPH_ROOT_ID ? "recruitment" : "notification";
  if (parentId !== GRAPH_ROOT_ID && parentId === primaryNotificationId) {
    return `notification->${role}`;
  }
  return `${parentLabel}->${role}`;
}

/**
 * @param {object} identity Recruitment identity (relationshipEngine output).
 * @param {Array} views Correlated document views in timeline order.
 * @param {Array} edges Pairwise correlation edges for evidence lookup.
 * @param {Array} timeline Timeline entries used to pick the primary notification.
 */
function buildRecruitmentGraph(identity, views, edges, timeline) {
  const timelineOrder = new Map(timeline.map((entry) => [entry.documentId, entry.position]));
  const orderedViews = views
    .slice()
    .sort(
      (a, b) => (timelineOrder.get(a.documentId) ?? 999) - (timelineOrder.get(b.documentId) ?? 999)
    );

  const notifications = orderedViews.filter((view) => view.role === DOCUMENT_ROLES.NOTIFICATION);
  const primaryNotificationId = notifications.length ? notifications[0].documentId : null;

  const edgeByPair = new Map();
  for (const edge of edges) {
    edgeByPair.set(`${edge.fromDocumentId}|${edge.toDocumentId}`, edge);
    edgeByPair.set(`${edge.toDocumentId}|${edge.fromDocumentId}`, edge);
  }

  const nodes = orderedViews.map((view) => ({
    id: view.documentId,
    type: "document",
    role: view.role,
    roleLabel: view.roleLabel,
    title: view.title,
    documentRef: {
      documentId: view.documentId,
      inputIndex: view.inputIndex,
      formatId: view.formatId,
      sourceUrl: view.sourceUrl,
      fingerprint: view.fingerprint
    }
  }));

  const graphEdges = [];
  const childrenByRole = {};
  for (const view of orderedViews) {
    if (!childrenByRole[view.role]) childrenByRole[view.role] = [];
    childrenByRole[view.role].push(view.documentId);

    let parentId = GRAPH_ROOT_ID;
    if (
      primaryNotificationId &&
      view.documentId !== primaryNotificationId &&
      view.role !== DOCUMENT_ROLES.NOTIFICATION
    ) {
      parentId = primaryNotificationId;
    }

    const pairEdge =
      parentId === GRAPH_ROOT_ID ? null : edgeByPair.get(`${parentId}|${view.documentId}`) || null;

    graphEdges.push({
      from: parentId,
      to: view.documentId,
      relationshipType: relationshipTypeFor(parentId, view.role, primaryNotificationId),
      confidence: pairEdge && pairEdge.correlated ? pairEdge.confidence : "medium",
      evidence: pairEdge && pairEdge.correlated ? pairEdge.evidence : [],
      evidenceSource:
        pairEdge && pairEdge.correlated ? "pairwise_correlation" : "cluster_membership"
    });
  }

  return {
    rootId: GRAPH_ROOT_ID,
    root: {
      id: GRAPH_ROOT_ID,
      type: "recruitment",
      recruitmentKey: identity.recruitmentKey,
      organization: identity.organization,
      advertisementNumber: identity.advertisementNumber,
      recruitmentName: identity.recruitmentName
    },
    primaryNotificationId,
    nodes,
    edges: graphEdges,
    childrenByRole
  };
}

module.exports = {
  buildRecruitmentGraph
};
