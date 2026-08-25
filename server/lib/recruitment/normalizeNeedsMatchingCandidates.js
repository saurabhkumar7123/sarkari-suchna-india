"use strict";

/**
 * Single normalization / deduplication boundary for Needs Matching candidates.
 * Candidates may arrive from needsMatching.candidateRecruitments, candidatePages,
 * and processor_output.candidates — the same logical recruitment must appear once.
 */

const LEVEL_RANK = Object.freeze({
  high: 4,
  medium: 3,
  ambiguous: 2,
  low: 1,
  hard_negative: 0,
  no_match: 0
});

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickRecruitmentId(row) {
  if (!row || typeof row !== "object") return null;
  const direct =
    toFiniteNumber(row.recruitmentId) ??
    toFiniteNumber(row.recruitment_id) ??
    null;
  if (direct != null && direct > 0) return direct;
  const kind = String(row.kind || "").toLowerCase();
  if (kind === "recruitment" || kind === "") {
    const id = toFiniteNumber(row.id);
    if (id != null && id > 0) return id;
  }
  return null;
}

function candidateIdentity(row) {
  const recruitmentId = pickRecruitmentId(row);
  if (recruitmentId != null) {
    return `recruitment:${recruitmentId}`;
  }
  const kind = String((row && row.kind) || "unknown").toLowerCase() || "unknown";
  const pageId = toFiniteNumber(row && (row.pageId || row.page_id));
  if (pageId != null && pageId > 0) {
    return `page:${pageId}`;
  }
  const id = toFiniteNumber(row && row.id);
  if (id != null) {
    return `${kind}:${id}`;
  }
  const title = String((row && row.title) || "")
    .trim()
    .toLowerCase();
  const slug = String((row && row.slug) || "")
    .trim()
    .toLowerCase();
  return `composite:${kind}|${title}|${slug}`;
}

function levelRank(level) {
  const key = String(level || "")
    .trim()
    .toLowerCase();
  return LEVEL_RANK[key] != null ? LEVEL_RANK[key] : -1;
}

function scoreOf(row) {
  const n = toFiniteNumber(row && row.score);
  return n == null ? Number.NEGATIVE_INFINITY : n;
}

function preferNonEmpty(a, b) {
  if (a == null || a === "") return b;
  if (b == null || b === "") return a;
  return a;
}

function mergeCandidate(existing, incoming) {
  if (!existing) return { ...incoming };
  if (!incoming) return { ...existing };

  const existingScore = scoreOf(existing);
  const incomingScore = scoreOf(incoming);
  const existingLevel = levelRank(existing.level || existing.matchLevel);
  const incomingLevel = levelRank(incoming.level || incoming.matchLevel);

  const preferIncoming =
    incomingScore > existingScore ||
    (incomingScore === existingScore && incomingLevel > existingLevel);

  const primary = preferIncoming ? incoming : existing;
  const secondary = preferIncoming ? existing : incoming;

  const merged = { ...secondary, ...primary };

  // Preserve strongest / most informative fields from either side.
  merged.recruitmentId =
    pickRecruitmentId(primary) ?? pickRecruitmentId(secondary) ?? null;
  if (merged.recruitmentId != null) {
    merged.recruitment_id = merged.recruitmentId;
  }
  merged.id = preferNonEmpty(primary.id, secondary.id);
  merged.kind = preferNonEmpty(primary.kind, secondary.kind);
  merged.title = preferNonEmpty(primary.title, secondary.title);
  merged.level = preferNonEmpty(
    primary.level || primary.matchLevel,
    secondary.level || secondary.matchLevel
  );
  merged.matchLevel = preferNonEmpty(
    primary.matchLevel || primary.level,
    secondary.matchLevel || secondary.level
  );
  merged.score =
    Math.max(existingScore, incomingScore) === Number.NEGATIVE_INFINITY
      ? preferNonEmpty(primary.score, secondary.score)
      : Math.max(existingScore, incomingScore);
  merged.confidence = preferNonEmpty(primary.confidence, secondary.confidence);
  merged.reason = preferNonEmpty(primary.reason, secondary.reason);
  merged.recommendation = preferNonEmpty(
    primary.recommendation,
    secondary.recommendation
  );
  merged.recommendedAction = preferNonEmpty(
    primary.recommendedAction,
    secondary.recommendedAction
  );

  return merged;
}

/**
 * Collect candidate arrays from a review-queue shaped item and dedupe.
 * @param {object} item
 * @returns {object[]}
 */
function collectNeedsMatchingCandidateSources(item = {}) {
  const payload =
    item && item.payload && typeof item.payload === "object" ? item.payload : {};
  const processor =
    item && item.processor_output && typeof item.processor_output === "object"
      ? item.processor_output
      : {};
  const needs =
    payload.needsMatching ||
    processor.needsMatching ||
    (typeof processor.needsMatching === "object" ? processor.needsMatching : null) ||
    {};

  const needsObj = needs && typeof needs === "object" && !Array.isArray(needs) ? needs : {};

  return []
    .concat(Array.isArray(needsObj.candidateRecruitments) ? needsObj.candidateRecruitments : [])
    .concat(Array.isArray(needsObj.candidatePages) ? needsObj.candidatePages : [])
    .concat(Array.isArray(needsObj.candidates) ? needsObj.candidates : [])
    .concat(Array.isArray(processor.candidates) ? processor.candidates : [])
    .concat(Array.isArray(payload.candidates) ? payload.candidates : []);
}

/**
 * Deduplicate candidate rows by stable identity.
 * @param {object[]} candidates
 * @returns {object[]}
 */
function normalizeNeedsMatchingCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates.filter((row) => row && typeof row === "object") : [];
  const byKey = new Map();
  const order = [];

  for (const row of list) {
    const key = candidateIdentity(row);
    if (!byKey.has(key)) {
      byKey.set(key, { ...row });
      order.push(key);
    } else {
      byKey.set(key, mergeCandidate(byKey.get(key), row));
    }
  }

  return order.map((key) => {
    const merged = byKey.get(key);
    const rid = pickRecruitmentId(merged);
    if (rid != null) {
      merged.recruitmentId = rid;
      merged.recruitment_id = rid;
    }
    return merged;
  });
}

/**
 * End-to-end: collect from review item sources and normalize.
 * @param {object} item
 * @returns {object[]}
 */
function resolveNeedsMatchingCandidates(item) {
  return normalizeNeedsMatchingCandidates(collectNeedsMatchingCandidateSources(item));
}

module.exports = {
  candidateIdentity,
  pickRecruitmentId,
  mergeCandidate,
  normalizeNeedsMatchingCandidates,
  collectNeedsMatchingCandidateSources,
  resolveNeedsMatchingCandidates
};
