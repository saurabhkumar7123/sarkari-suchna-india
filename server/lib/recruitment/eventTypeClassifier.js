"use strict";

/**
 * Phase 20 — deterministic recruitment lifecycle event type classifier.
 * Pure library: no DB, no network, no runtime wiring in this phase.
 *
 * EVENT_TYPES must stay aligned with recruitmentEvent.service.EVENT_TYPES.
 */
const LIFECYCLE_EVENT_TYPES = Object.freeze([
  "notification",
  "short_notification",
  "correction",
  "exam_date",
  "city_intimation",
  "admit_card",
  "answer_key",
  "objection",
  "result",
  "final_result",
  "dv",
  "medical",
  "joining"
]);

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const UNKNOWN_EVENT_TYPE = "unknown";

/** Lower number = higher precedence when resolving conflicts. */
const TYPE_PRECEDENCE = Object.freeze({
  correction: 10,
  final_result: 11,
  short_notification: 12,
  objection: 13,
  admit_card: 20,
  answer_key: 21,
  city_intimation: 22,
  dv: 23,
  medical: 24,
  joining: 25,
  exam_date: 30,
  result: 31,
  notification: 40
});

/**
 * @typedef {Object} ClassifyEventTypeInput
 * @property {string} [title]
 * @property {string} [content]
 * @property {string} [url]
 */

/**
 * @typedef {Object} ClassifyEventTypeResult
 * @property {string} eventType
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {string[]} matchedRules
 * @property {string} normalizedText
 */

const ABBREVIATION_REPLACEMENTS = [
  [/\badvt\.?\b/g, " advertisement "],
  [/\bntf\.?\b/g, " notification "],
  [/\bnotif\.?\b/g, " notification "],
  [/\bac\b/g, " admit card "],
  [/\bhm\b/g, " hall ticket "],
  [/\bht\b/g, " hall ticket "],
  [/\bcorrig\.?\b/g, " corrigendum "],
  [/\berrata\b/g, " corrigendum "],
  [/\bans\.?\s*key\b/g, " answer key "],
  [/\bobj\.?\b/g, " objection "],
  [/\bdv\b/g, " document verification "],
  [/\bdoc\.?\s*verif\.?\b/g, " document verification "],
  [/\bmed\.?\s*exam\b/g, " medical examination "],
  [/\bexam\s*dt\b/g, " exam date "],
  [/\bschedule\b/g, " schedule "],
  [/\bsnm\b/g, " short notification "],
  [/\bintimation\b/g, " intimation "]
];

/**
 * Ordered rules: first matching rule at the best precedence wins unless a later
 * rule has strictly higher precedence (lower number) and also matches.
 */
const CLASSIFICATION_RULES = Object.freeze([
  {
    id: "correction-corrigendum",
    eventType: "correction",
    confidence: "high",
    patterns: [
      /\bcorrigendum\b/,
      /\bcorrig\b/,
      /\berrata\b/,
      /\bamendment\s+to\s+(the\s+)?(notification|advertisement)\b/,
      /\brevised\s+notification\b/,
      /\brectification\b/,
      /\bclarification\s+notice\b/
    ]
  },
  {
    id: "final-result-explicit",
    eventType: "final_result",
    confidence: "high",
    patterns: [
      /\bfinal\s+result\b/,
      /\bfinal\s+merit\b/,
      /\bfinal\s+selection\b/,
      /\bfinal\s+list\b/,
      /\bfinal\s+answer\s+key\b/,
      /\bresult\s+final\b/,
      /\bmerit\s+list\s+final\b/
    ]
  },
  {
    id: "short-notification",
    eventType: "short_notification",
    confidence: "high",
    patterns: [
      /\bshort\s+notification\b/,
      /\bshort\s+notice\b/,
      /\bsnm\b/,
      /\bcondensed\s+notification\b/
    ]
  },
  {
    id: "objection-window",
    eventType: "objection",
    confidence: "high",
    patterns: [
      /\bobjection\b/,
      /\brepresentation\b/,
      /\bchallenge\s+(the\s+)?answer\s+key\b/,
      /\bkey\s+challenge\b/
    ]
  },
  {
    id: "admit-card",
    eventType: "admit_card",
    confidence: "high",
    patterns: [
      /\badmit\s+card\b/,
      /\badmission\s+certificate\b/,
      /\bhall\s+ticket\b/,
      /\bentry\s+pass\b/,
      /\bcall\s+letter\b/,
      /\be\s*admit\b/,
      /\badmitcard\b/
    ]
  },
  {
    id: "answer-key",
    eventType: "answer_key",
    confidence: "high",
    patterns: [
      /\banswer\s+key\b/,
      /\banswerkey\b/,
      /\bprovisional\s+key\b/,
      /\bresponse\s+sheet\b/,
      /\bquestion\s+paper\s+with\s+answer\b/
    ]
  },
  {
    id: "city-intimation",
    eventType: "city_intimation",
    confidence: "high",
    patterns: [
      /\bcity\s+intimation\b/,
      /\bexam\s+city\b/,
      /\bcity\s+slip\b/,
      /\bcentre\s+intimation\b/,
      /\bcenter\s+intimation\b/,
      /\ballocation\s+of\s+exam\s+city\b/
    ]
  },
  {
    id: "document-verification",
    eventType: "dv",
    confidence: "high",
    patterns: [
      /\bdocument\s+verification\b/,
      /\bdocuments?\s+verification\b/,
      /\bdv\s+schedule\b/,
      /\bdv\s+list\b/,
      /\bdv\s+call\s+letter\b/
    ]
  },
  {
    id: "medical-examination",
    eventType: "medical",
    confidence: "high",
    patterns: [
      /\bmedical\s+examination\b/,
      /\bmedical\s+test\b/,
      /\bmedical\s+fitness\b/,
      /\bmedical\s+board\b/,
      /\brme\b/
    ]
  },
  {
    id: "joining-appointment",
    eventType: "joining",
    confidence: "high",
    patterns: [
      /\bjoining\s+letter\b/,
      /\bappointment\s+letter\b/,
      /\boffer\s+of\s+appointment\b/,
      /\bposting\s+order\b/,
      /\bjoining\s+instructions\b/,
      /\bjoining\s+report\b/
    ]
  },
  {
    id: "exam-date-schedule",
    eventType: "exam_date",
    confidence: "high",
    patterns: [
      /\bexam\s+date\b/,
      /\bexamination\s+date\b/,
      /\bdate\s+of\s+examination\b/,
      /\bschedule\s+of\s+examination\b/,
      /\bexam\s+schedule\b/,
      /\btest\s+date\b/,
      /\bdate\s+sheet\b/,
      /\brescheduled\s+exam\b/,
      /\bpostponement\s+of\s+exam\b/
    ]
  },
  {
    id: "exam-date-medium",
    eventType: "exam_date",
    confidence: "medium",
    patterns: [/\bschedule\b/, /\bexam\s+on\b/, /\bexamination\s+on\b/]
  },
  {
    id: "result-provisional",
    eventType: "result",
    confidence: "high",
    patterns: [
      /\bresult\b/,
      /\bscore\s+card\b/,
      /\bscorecard\b/,
      /\bmarks\b/,
      /\bmerit\s+list\b/,
      /\bshortlisted\s+candidates\b/,
      /\bqualified\s+candidates\b/,
      /\broll\s+number\s+wise\b/
    ]
  },
  {
    id: "notification-recruitment",
    eventType: "notification",
    confidence: "high",
    patterns: [
      /\bnotification\b/,
      /\badvertisement\b/,
      /\badvert\b/,
      /\brecruitment\b/,
      /\bapply\s+online\b/,
      /\bonline\s+application\b/,
      /\bapplication\s+form\b/,
      /\bdetailed\s+advertisement\b/,
      /\bemployment\s+notice\b/
    ]
  },
  {
    id: "notification-medium",
    eventType: "notification",
    confidence: "medium",
    patterns: [/\bform\b/, /\bvacancy\b/, /\bposts?\b/]
  }
]);

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunctuationToSpaces(value) {
  return String(value ?? "")
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyAbbreviationExpansions(value) {
  let text = ` ${value} `;
  for (const [pattern, replacement] of ABBREVIATION_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return collapseWhitespace(text);
}

/**
 * @param {ClassifyEventTypeInput} input
 */
function buildNormalizedText(input = {}) {
  const title = collapseWhitespace(input.title);
  const content = collapseWhitespace(input.content);
  let urlText = "";
  if (input.url) {
    try {
      const parsed = new URL(String(input.url).trim(), "https://example.com");
      urlText = collapseWhitespace(
        `${parsed.pathname} ${parsed.search}`.replace(/[-_+.]/g, " ")
      );
    } catch {
      urlText = collapseWhitespace(String(input.url).replace(/[-_/.]+/g, " "));
    }
  }

  const combined = collapseWhitespace([title, content, urlText].filter(Boolean).join(" "));
  const lowered = combined.toLowerCase();
  const depunctuated = stripPunctuationToSpaces(lowered);
  return applyAbbreviationExpansions(depunctuated);
}

function ruleMatches(rule, normalizedText) {
  return rule.patterns.some((pattern) => pattern.test(normalizedText));
}

function compareMatches(a, b) {
  const precA = TYPE_PRECEDENCE[a.eventType] ?? 99;
  const precB = TYPE_PRECEDENCE[b.eventType] ?? 99;
  if (precA !== precB) return precA - precB;

  const confRank = { high: 0, medium: 1, low: 2, none: 3 };
  const confA = confRank[a.confidence] ?? 3;
  const confB = confRank[b.confidence] ?? 3;
  if (confA !== confB) return confA - confB;

  return String(a.id).localeCompare(String(b.id));
}

function resolveConfidence(best, allMatches) {
  const competitors = allMatches.filter((m) => m.eventType !== best.eventType);
  if (competitors.length === 0) return best.confidence;

  const bestPrec = TYPE_PRECEDENCE[best.eventType] ?? 99;
  let nearestHighCompetitorPrec = 99;
  for (const match of competitors) {
    if (match.confidence === "high") {
      nearestHighCompetitorPrec = Math.min(
        nearestHighCompetitorPrec,
        TYPE_PRECEDENCE[match.eventType] ?? 99
      );
    }
  }

  if (nearestHighCompetitorPrec === 99) {
    return best.confidence;
  }
  if (nearestHighCompetitorPrec - bestPrec > 10) {
    return best.confidence;
  }

  if (best.confidence === "high") return "medium";
  return "low";
}

/**
 * @param {ClassifyEventTypeInput} input
 * @returns {ClassifyEventTypeResult}
 */
function classifyRecruitmentEventType(input = {}) {
  const normalizedText = buildNormalizedText(input);

  if (!normalizedText) {
    return {
      eventType: UNKNOWN_EVENT_TYPE,
      confidence: "none",
      matchedRules: [],
      normalizedText
    };
  }

  const matches = [];
  for (const rule of CLASSIFICATION_RULES) {
    if (ruleMatches(rule, normalizedText)) {
      matches.push({
        id: rule.id,
        eventType: rule.eventType,
        confidence: rule.confidence
      });
    }
  }

  if (matches.length === 0) {
    return {
      eventType: UNKNOWN_EVENT_TYPE,
      confidence: "none",
      matchedRules: [],
      normalizedText
    };
  }

  matches.sort(compareMatches);
  const best = matches[0];
  const matchedRules = matches
    .filter((m) => m.eventType === best.eventType)
    .map((m) => m.id);

  const confidence = resolveConfidence(best, matches);

  if (!LIFECYCLE_EVENT_TYPES.includes(best.eventType)) {
    return {
      eventType: UNKNOWN_EVENT_TYPE,
      confidence: "none",
      matchedRules: [],
      normalizedText
    };
  }

  return {
    eventType: best.eventType,
    confidence,
    matchedRules,
    normalizedText
  };
}

module.exports = {
  LIFECYCLE_EVENT_TYPES,
  CONFIDENCE_LEVELS,
  UNKNOWN_EVENT_TYPE,
  normalizeRecruitmentNoticeText: buildNormalizedText,
  classifyRecruitmentEventType
};
