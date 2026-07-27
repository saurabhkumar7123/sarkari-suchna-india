'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Candidate Resolution Engine (Advisory Grouping Only)
 *
 * Groups related candidates and produces:
 *   - Primary candidate suggestion
 *   - Related candidates
 *   - Confidence score
 *   - Resolution explanation
 *
 * Never resolves automatically. Never merges production data.
 */

const { deepFreeze } = require('./candidateIdentityContract');
const {
  DUPLICATE_RELATION_TYPES,
  detectCandidateDuplicates,
} = require('./duplicateDetectionEngine');

const CANDIDATE_RESOLUTION_ENGINE_VERSION = '5E.1.0.0';

const RELATION_WEIGHTS = Object.freeze({
  [DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE]: 1.0,
  [DUPLICATE_RELATION_TYPES.SAME_RECRUITMENT_UPDATED_METADATA]: 0.9,
  [DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT]: 0.8,
  [DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE]: 0.7,
  [DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION]: 0.4,
  [DUPLICATE_RELATION_TYPES.UNRELATED]: 0,
});

function identityIndex(identities) {
  const map = new Map();
  for (const identity of identities) {
    if (identity.candidateId) {
      map.set(identity.candidateId, identity);
    }
  }
  return map;
}

function pairStrength(pair) {
  let best = 0;
  for (const relation of pair.relations || []) {
    const weight = RELATION_WEIGHTS[relation] || 0;
    if (weight > best) best = weight;
  }
  return Math.max(best, Number(pair.identityScore) || 0);
}

function findComponents(candidateIds, relatedPairs) {
  const parent = new Map();
  for (const id of candidateIds) parent.set(id, id);

  function find(id) {
    const current = parent.get(id);
    if (current !== id) {
      const root = find(current);
      parent.set(id, root);
      return root;
    }
    return id;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const pair of relatedPairs) {
    if (
      pair.leftCandidateId &&
      pair.rightCandidateId &&
      pair.primaryRelation !== DUPLICATE_RELATION_TYPES.UNRELATED
    ) {
      union(pair.leftCandidateId, pair.rightCandidateId);
    }
  }

  const groups = new Map();
  for (const id of candidateIds) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return Array.from(groups.values());
}

function choosePrimary(memberIds, byId) {
  const ranked = memberIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const confA = a.confidence == null ? -1 : Number(a.confidence);
      const confB = b.confidence == null ? -1 : Number(b.confidence);
      if (confB !== confA) return confB - confA;
      const fieldsA = [
        a.sourceUrl,
        a.advertisementNumber,
        a.organization,
        a.title,
        a.department,
        a.state,
      ].filter(Boolean).length;
      const fieldsB = [
        b.sourceUrl,
        b.advertisementNumber,
        b.organization,
        b.title,
        b.department,
        b.state,
      ].filter(Boolean).length;
      if (fieldsB !== fieldsA) return fieldsB - fieldsA;
      return String(a.candidateId).localeCompare(String(b.candidateId));
    });

  return ranked[0] || null;
}

function explainGroup(memberIds, relatedPairs, primary) {
  const groupPairs = relatedPairs.filter(
    (pair) =>
      memberIds.includes(pair.leftCandidateId) &&
      memberIds.includes(pair.rightCandidateId)
  );
  const relationSet = new Set();
  for (const pair of groupPairs) {
    for (const relation of pair.relations) relationSet.add(relation);
  }

  const relations = Array.from(relationSet);
  const avgScore =
    groupPairs.length === 0
      ? 0
      : Number(
          (
            groupPairs.reduce((sum, pair) => sum + pairStrength(pair), 0) /
            groupPairs.length
          ).toFixed(4)
        );

  const reasons = [];
  if (relations.includes(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE)) {
    reasons.push('Exact duplicate evidence detected among group members.');
  }
  if (
    relations.includes(DUPLICATE_RELATION_TYPES.SAME_RECRUITMENT_UPDATED_METADATA)
  ) {
    reasons.push(
      'Members appear to represent the same recruitment with updated metadata.'
    );
  }
  if (relations.includes(DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT)) {
    reasons.push('Shared advertisement number links members.');
  }
  if (relations.includes(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE)) {
    reasons.push('Near-duplicate fingerprint or field overlap detected.');
  }
  if (relations.includes(DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION)) {
    reasons.push('Shared organization contributes partial identity evidence.');
  }
  if (!reasons.length) {
    reasons.push('Insufficient related evidence; group retained for inspection only.');
  }

  return {
    confidenceScore: avgScore,
    relations,
    pairCount: groupPairs.length,
    explanation: reasons.join(' '),
    primaryRationale: primary
      ? `Suggested primary '${primary.candidateId}' based on higher confidence and denser identity fields.`
      : 'No primary candidate could be suggested.',
  };
}

/**
 * Group related candidates and produce advisory resolution suggestions.
 * Never resolves automatically.
 *
 * @param {object} [input]
 * @param {object[]} [input.candidates]
 * @param {object} [input.detection] optional precomputed detection result
 * @param {object} [input.fingerprintOptions]
 */
function resolveRelatedCandidates(input = {}) {
  const detection =
    input.detection ||
    detectCandidateDuplicates({
      candidates: input.candidates || [],
      fingerprintOptions: input.fingerprintOptions,
    });

  const byId = identityIndex(detection.identities || []);
  const candidateIds = (detection.identities || [])
    .map((identity) => identity.candidateId)
    .filter(Boolean);

  const components = findComponents(candidateIds, detection.relatedPairs || []);
  const groups = [];
  const unresolvedCandidateIds = [];

  for (const memberIds of components) {
    if (memberIds.length < 2) {
      unresolvedCandidateIds.push(...memberIds);
      continue;
    }

    const primary = choosePrimary(memberIds, byId);
    const explanation = explainGroup(
      memberIds,
      detection.relatedPairs || [],
      primary
    );
    const relatedCandidates = memberIds
      .filter((id) => !primary || id !== primary.candidateId)
      .map((id) => byId.get(id))
      .filter(Boolean);

    groups.push(
      deepFreeze({
        groupId: `res-group-${memberIds.slice().sort().join('-')}`,
        advisoryOnly: true,
        automaticallyResolved: false,
        primaryCandidateSuggestion: primary,
        relatedCandidates,
        memberCandidateIds: memberIds.slice().sort(),
        confidenceScore: explanation.confidenceScore,
        relations: explanation.relations,
        resolutionExplanation: explanation.explanation,
        primaryRationale: explanation.primaryRationale,
        pairCount: explanation.pairCount,
      })
    );
  }

  groups.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return deepFreeze({
    engineVersion: CANDIDATE_RESOLUTION_ENGINE_VERSION,
    advisoryOnly: true,
    automaticallyResolved: false,
    productionDataModified: false,
    candidateCount: candidateIds.length,
    groupCount: groups.length,
    unresolvedCount: unresolvedCandidateIds.length,
    groups,
    unresolvedCandidateIds: unresolvedCandidateIds.slice().sort(),
    detectionSummary: detection.summary,
  });
}

module.exports = {
  CANDIDATE_RESOLUTION_ENGINE_VERSION,
  RELATION_WEIGHTS,
  resolveRelatedCandidates,
};
