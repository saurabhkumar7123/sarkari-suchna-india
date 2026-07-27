"use strict";

/**
 * Phase AI-2 — Event detection.
 *
 * Scores every candidate event type against the notice using zone-weighted
 * signal matching, and decides whether the notice is a recruitment matching
 * candidate. Detection never discards an unrecognised notice: when nothing
 * matches, the raw wording is preserved for the classification engine.
 */

const { RECRUITMENT_EVENT_TYPES } = require("./types");
const {
  EVENT_SIGNALS,
  SUB_TYPE_SIGNALS,
  RECRUITMENT_CONTEXT_SIGNALS,
  POST_TITLE_PATTERNS
} = require("./eventSignals");
const { clamp, collapse, round2, toText, uniqueBy } = require("./textUtils");

/** How much a match in each zone counts relative to a title match. */
const ZONE_WEIGHTS = Object.freeze({
  title: 1,
  heading: 0.72,
  url: 0.6,
  link: 0.5,
  lead: 0.5,
  body: 0.28
});

const LEAD_LINE_COUNT = 10;
const DETECTION_FLOOR = 0.35;

/**
 * Probability-style combination: independent pieces of evidence reinforce each
 * other without ever exceeding 1.
 * @param {number[]} weights
 * @returns {number}
 */
function combineEvidence(weights) {
  let remaining = 1;
  for (const weight of weights) {
    remaining *= 1 - clamp(weight, 0, 0.98);
  }
  return round2(1 - remaining);
}

/**
 * @param {object} analysis
 * @param {Array<object>} headings
 * @returns {Array<{ zone: string, text: string, weight: number }>}
 */
function buildZones(analysis = {}, headings = []) {
  const lines = Array.isArray(analysis.lines) ? analysis.lines : [];
  const zones = [];

  const title = collapse(analysis.title);
  if (title) zones.push({ zone: "title", text: title, weight: ZONE_WEIGHTS.title });

  const headingText = headings
    .map((heading) => heading.normalizedText || heading.raw || "")
    .filter(Boolean)
    .join("\n");
  if (headingText) zones.push({ zone: "heading", text: headingText, weight: ZONE_WEIGHTS.heading });

  const url = collapse(analysis.url);
  if (url) {
    zones.push({ zone: "url", text: url.replace(/[/_\-?=&+.]+/g, " "), weight: ZONE_WEIGHTS.url });
  }

  const linkText = (Array.isArray(analysis.links) ? analysis.links : [])
    .map((link) => `${link.text || ""} ${link.href || ""}`)
    .join("\n");
  if (collapse(linkText)) {
    zones.push({ zone: "link", text: linkText, weight: ZONE_WEIGHTS.link });
  }

  const lead = lines.slice(0, LEAD_LINE_COUNT).join("\n");
  if (lead) zones.push({ zone: "lead", text: lead, weight: ZONE_WEIGHTS.lead });

  const body = toText(analysis.text) || lines.join("\n");
  if (body) zones.push({ zone: "body", text: body, weight: ZONE_WEIGHTS.body });

  return zones;
}

/**
 * @param {RegExp[]} patterns
 * @param {string} text
 * @returns {string|null}
 */
function firstMatch(patterns, text) {
  for (const pattern of patterns || []) {
    const match = text.match(pattern);
    if (match) return collapse(match[0]);
  }
  return null;
}

/**
 * Score every event type against the notice.
 *
 * @param {object} analysis normalized content view
 * @param {Array<object>} headings normalized headings
 * @returns {Array<{ eventType: string, score: number, evidence: Array<object> }>}
 */
function detectEventCandidates(analysis = {}, headings = []) {
  const zones = buildZones(analysis, headings);
  const byEventType = new Map();

  for (const signal of EVENT_SIGNALS) {
    for (const zone of zones) {
      const matched = firstMatch(signal.patterns, zone.text);
      if (!matched) continue;
      const entry = byEventType.get(signal.eventType) || { weights: [], evidence: [] };
      entry.weights.push(signal.weight * zone.weight);
      entry.evidence.push({
        zone: zone.zone,
        matchedText: matched.slice(0, 120),
        signalWeight: signal.weight,
        zoneWeight: zone.weight
      });
      byEventType.set(signal.eventType, entry);
    }
  }

  return Array.from(byEventType.entries())
    .map(([eventType, entry]) => ({
      eventType,
      score: combineEvidence(entry.weights),
      evidence: entry.evidence,
      topZone: entry.evidence.reduce(
        (best, item) => (!best || item.zoneWeight > best.zoneWeight ? item : best),
        null
      )?.zone || null
    }))
    .sort((a, b) => b.score - a.score || a.eventType.localeCompare(b.eventType));
}

/**
 * Detect qualifiers (prelims, revised, final, form correction, …).
 * @param {object} analysis
 * @param {Array<object>} headings
 * @returns {Array<{ subType: string, score: number, matchedText: string, zone: string }>}
 */
function detectSubTypes(analysis = {}, headings = []) {
  const zones = buildZones(analysis, headings).filter((zone) => zone.zone !== "body");
  const found = [];
  for (const signal of SUB_TYPE_SIGNALS) {
    for (const zone of zones) {
      const matched = firstMatch(signal.patterns, zone.text);
      if (!matched) continue;
      found.push({
        subType: signal.subType,
        score: round2(zone.weight),
        matchedText: matched.slice(0, 80),
        zone: zone.zone
      });
      break;
    }
  }
  return found.sort((a, b) => b.score - a.score);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractPostTitles(text) {
  const source = toText(text);
  const found = [];
  for (const pattern of POST_TITLE_PATTERNS) {
    const match = source.match(pattern);
    if (match) found.push(collapse(match[0]));
  }
  return uniqueBy(found, (value) => value.toLowerCase());
}

/**
 * Decide whether this notice belongs to a recruitment lifecycle and collect the
 * hints a future duplicate/lifecycle matcher will need.
 *
 * @param {object} analysis
 * @param {Array<object>} candidates
 * @param {object} references
 * @returns {object}
 */
function detectRecruitmentCandidate(analysis = {}, candidates = [], references = {}) {
  const title = collapse(analysis.title);
  const body = toText(analysis.text);
  const haystack = `${title}\n${body}`;

  const signals = [];
  for (const signal of RECRUITMENT_CONTEXT_SIGNALS) {
    const inTitle = firstMatch(signal.patterns, title);
    const inBody = inTitle ? null : firstMatch(signal.patterns, body);
    const matched = inTitle || inBody;
    if (!matched) continue;
    signals.push({
      name: signal.name,
      matchedText: matched.slice(0, 80),
      zone: inTitle ? "title" : "body",
      weight: round2(signal.weight * (inTitle ? 1 : 0.55))
    });
  }

  const recruitmentTypeCandidate = candidates.find(
    (candidate) =>
      RECRUITMENT_EVENT_TYPES.includes(candidate.eventType) && candidate.score >= DETECTION_FLOOR
  );
  if (recruitmentTypeCandidate) {
    signals.push({
      name: "recruitment_event_type",
      matchedText: recruitmentTypeCandidate.eventType,
      zone: "classification",
      weight: round2(Math.min(0.85, recruitmentTypeCandidate.score))
    });
  }

  const postTitles = extractPostTitles(haystack);
  if (postTitles.length) {
    signals.push({
      name: "post_title",
      matchedText: postTitles.slice(0, 3).join(", "),
      zone: "content",
      weight: 0.7
    });
  }

  const score = combineEvidence(signals.map((signal) => signal.weight));
  const nonRecruitmentLead = candidates[0] &&
    !RECRUITMENT_EVENT_TYPES.includes(candidates[0].eventType) &&
    candidates[0].score >= 0.7;

  return {
    isRecruitmentCandidate: score >= 0.6 && !nonRecruitmentLead,
    score,
    signals,
    suppressedBy: nonRecruitmentLead ? candidates[0].eventType : null,
    matchHints: {
      postTitles,
      departmentCode: analysis.departmentCode || null,
      advertisementNumber: references.advertisementNumber || null,
      referenceNumber: references.referenceNumber || null,
      year: references.year || null
    }
  };
}

/**
 * Preserve the notice's own wording when no known event type matches.
 * @param {object} analysis
 * @returns {string|null}
 */
function extractUnknownEventLabel(analysis = {}) {
  const title = collapse(analysis.title);
  if (title) {
    const segments = title
      .split(/[|:–—]|\s-\s/)
      .map((segment) => collapse(segment))
      .filter((segment) => segment.length >= 3);
    if (segments.length > 1) return segments[segments.length - 1].slice(0, 120);
    return title.slice(0, 120);
  }
  const lines = Array.isArray(analysis.lines) ? analysis.lines : [];
  return lines.length ? collapse(lines[0]).slice(0, 120) : null;
}

module.exports = {
  ZONE_WEIGHTS,
  DETECTION_FLOOR,
  combineEvidence,
  buildZones,
  detectEventCandidates,
  detectSubTypes,
  extractPostTitles,
  detectRecruitmentCandidate,
  extractUnknownEventLabel
};
