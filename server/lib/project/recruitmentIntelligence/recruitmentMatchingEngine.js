'use strict';

/**
 * AMP-1 — Recruitment Matching Engine
 *
 * Intelligently matches notifications to existing recruitments.
 * Never creates duplicate recruitments when a confident match exists.
 */

const {
  deepFreeze,
  pickString,
  normalizeText,
  normalizeUrl,
  normalizeAdvertisementNo,
  jaccardSimilarity,
} = require('./utils');

const MATCH_DECISION = Object.freeze({
  MATCH_EXISTING: 'MATCH_EXISTING',
  CREATE_NEW: 'CREATE_NEW',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const MATCH_SIGNALS = Object.freeze({
  ADVERTISEMENT_NUMBER: 'ADVERTISEMENT_NUMBER',
  ORGANIZATION: 'ORGANIZATION',
  RECRUITMENT_NAME: 'RECRUITMENT_NAME',
  OFFICIAL_URL: 'OFFICIAL_URL',
  PDF_URL: 'PDF_URL',
  TIMELINE: 'TIMELINE',
  NOTIFICATION_SIMILARITY: 'NOTIFICATION_SIMILARITY',
  DEPARTMENT: 'DEPARTMENT',
});

const ORGANIZATION_ALIASES = Object.freeze([
  { canonical: 'ssc', patterns: [/\bstaff selection commission\b/, /\bssc\b/] },
  { canonical: 'rrb', patterns: [/\brailway recruitment board\b/, /\brrb\b/] },
  { canonical: 'upsc', patterns: [/\bunion public service commission\b/, /\bupsc\b/] },
  { canonical: 'ibps', patterns: [/\binstitute of banking personnel selection\b/, /\bibps\b/] },
  { canonical: 'nta', patterns: [/\bnational testing agency\b/, /\bnta\b/] },
]);

function resolveOrganization(text) {
  const normalized = normalizeText(text);
  for (let i = 0; i < ORGANIZATION_ALIASES.length; i += 1) {
    const alias = ORGANIZATION_ALIASES[i];
    for (let j = 0; j < alias.patterns.length; j += 1) {
      if (alias.patterns[j].test(normalized)) return alias.canonical;
    }
  }
  return null;
}

function extractAdvertisementNo(text) {
  const normalized = pickString(text);
  const pattern = /\b(?:advt|advertisement|notification|notice)\.?\s*(?:no|number)?\.?\s*[:#-]?\s*([A-Z0-9][\w\s/.\\-]{2,30}\d{4})\b/i;
  const match = normalized.match(pattern);
  if (match) return normalizeAdvertisementNo(match[1]);
  const fallback = normalized.match(/\b([A-Z]{2,10}[-\s/]?\d{1,4}[-\s/]\d{4})\b/i);
  return fallback ? normalizeAdvertisementNo(fallback[1]) : null;
}

function scoreCandidate(notification, candidate) {
  const matchedSignals = [];
  const conflictingSignals = [];
  let score = 0;

  const notifAdv = normalizeAdvertisementNo(
    notification.advertisementNumber || extractAdvertisementNo(notification.title)
  );
  const candAdv = normalizeAdvertisementNo(candidate.advertisementNumber);
  if (notifAdv && candAdv) {
    if (notifAdv === candAdv) {
      matchedSignals.push(MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
      score += 45;
    } else {
      conflictingSignals.push(MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
      score -= 30;
    }
  }

  const notifOrg = resolveOrganization(
    [notification.organization, notification.department, notification.title].join(' ')
  );
  const candOrg = resolveOrganization(
    [candidate.organization, candidate.department, candidate.recruitmentName].join(' ')
  );
  if (notifOrg && candOrg) {
    if (notifOrg === candOrg) {
      matchedSignals.push(MATCH_SIGNALS.ORGANIZATION);
      score += 15;
    } else {
      conflictingSignals.push(MATCH_SIGNALS.ORGANIZATION);
      score -= 10;
    }
  }

  const nameSim = jaccardSimilarity(
    notification.title || notification.recruitmentName,
    candidate.recruitmentName || candidate.title
  );
  if (nameSim >= 0.5) {
    matchedSignals.push(MATCH_SIGNALS.RECRUITMENT_NAME);
    score += Math.round(nameSim * 20);
  }

  const notifUrl = normalizeUrl(notification.url || notification.officialWebsite);
  const candUrl = normalizeUrl(candidate.officialWebsite || candidate.officialNotification);
  if (notifUrl && candUrl && notifUrl === candUrl) {
    matchedSignals.push(MATCH_SIGNALS.OFFICIAL_URL);
    score += 15;
  }

  const notifPdf = normalizeUrl(notification.pdfUrl);
  const candPdf = normalizeUrl(candidate.pdfUrl);
  if (notifPdf && candPdf && notifPdf === candPdf) {
    matchedSignals.push(MATCH_SIGNALS.PDF_URL);
    score += 10;
  }

  const textSim = jaccardSimilarity(notification.title, candidate.recruitmentName || candidate.title);
  if (textSim >= 0.35) {
    matchedSignals.push(MATCH_SIGNALS.NOTIFICATION_SIMILARITY);
    score += Math.round(textSim * 15);
  }

  if (
    pickString(notification.department) &&
    pickString(candidate.department) &&
    normalizeText(notification.department) === normalizeText(candidate.department)
  ) {
    matchedSignals.push(MATCH_SIGNALS.DEPARTMENT);
    score += 5;
  }

  return { score, matchedSignals, conflictingSignals };
}

function matchRecruitment(notification, existingRecruitments = []) {
  if (!Array.isArray(existingRecruitments) || !existingRecruitments.length) {
    return deepFreeze({
      decision: MATCH_DECISION.CREATE_NEW,
      match: false,
      recruitmentId: null,
      confidence: 0,
      matchedSignals: [],
      conflictingSignals: [],
      candidates: [],
    });
  }

  const candidates = existingRecruitments
    .map((recruitment) => {
      const result = scoreCandidate(notification, recruitment);
      return {
        recruitmentId: recruitment.recruitmentId || recruitment.id,
        score: result.score,
        matchedSignals: result.matchedSignals,
        conflictingSignals: result.conflictingSignals,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return deepFreeze({
      decision: MATCH_DECISION.CREATE_NEW,
      match: false,
      recruitmentId: null,
      confidence: 0,
      matchedSignals: [],
      conflictingSignals: [],
      candidates: [],
    });
  }

  const best = candidates[0];
  const second = candidates[1];
  const ambiguous = second && second.score >= best.score - 10 && second.score >= 40;

  if (ambiguous || best.conflictingSignals.length > 0) {
    return deepFreeze({
      decision: MATCH_DECISION.MANUAL_REVIEW,
      match: false,
      recruitmentId: best.recruitmentId,
      confidence: Math.min(best.score, 60),
      matchedSignals: best.matchedSignals,
      conflictingSignals: best.conflictingSignals,
      candidates,
      reason: ambiguous ? 'AMBIGUOUS_MATCH' : 'CONFLICTING_SIGNALS',
    });
  }

  if (best.score >= 50) {
    return deepFreeze({
      decision: MATCH_DECISION.MATCH_EXISTING,
      match: true,
      recruitmentId: best.recruitmentId,
      confidence: Math.min(best.score, 100),
      matchedSignals: best.matchedSignals,
      conflictingSignals: best.conflictingSignals,
      candidates,
    });
  }

  if (best.score >= 30) {
    return deepFreeze({
      decision: MATCH_DECISION.MANUAL_REVIEW,
      match: false,
      recruitmentId: best.recruitmentId,
      confidence: best.score,
      matchedSignals: best.matchedSignals,
      conflictingSignals: best.conflictingSignals,
      candidates,
      reason: 'LOW_CONFIDENCE_MATCH',
    });
  }

  return deepFreeze({
    decision: MATCH_DECISION.CREATE_NEW,
    match: false,
    recruitmentId: null,
    confidence: best.score,
    matchedSignals: best.matchedSignals,
    conflictingSignals: best.conflictingSignals,
    candidates,
  });
}

module.exports = {
  MATCH_DECISION,
  MATCH_SIGNALS,
  resolveOrganization,
  extractAdvertisementNo,
  matchRecruitment,
};
