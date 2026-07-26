"use strict";

/**
 * CIP Stage 3A — Deterministic source type classification rules.
 * Specialty PDF types take precedence over generic official/linked PDF.
 */

const {
  SOURCE_TYPE_PRECEDENCE,
  SOURCE_TYPE_LABELS
} = require("./sourceTypes");

const SPECIALTY_PDF_RULES = Object.freeze([
  {
    id: "corrigendum-pdf",
    sourceType: "corrigendum_pdf",
    confidence: "high",
    patterns: [
      /\bcorrigendum\b/,
      /\bcorrection\s+notice\b/,
      /\berrata\b/,
      /\bamendment\s+(notice|to)\b/,
      /\brevised\s+(notification|advertisement|notice)\b/,
      /\brectification\b/
    ]
  },
  {
    id: "admit-card-pdf",
    sourceType: "admit_card_pdf",
    confidence: "high",
    patterns: [
      /\badmit[\s_-]*card\b/,
      /\bhall[\s_-]*ticket\b/,
      /\badmission\s+certificate\b/,
      /\bcall[\s_-]*letter\b/,
      /\be[\s_-]*admit\b/
    ]
  },
  {
    id: "answer-key-pdf",
    sourceType: "answer_key_pdf",
    confidence: "high",
    patterns: [
      /\banswer[\s_-]*key\b/,
      /\bprovisional\s+(answer\s+)?key\b/,
      /\bfinal\s+answer\s+key\b/,
      /\bresponse\s+sheet\b/
    ]
  },
  {
    id: "result-pdf",
    sourceType: "result_pdf",
    confidence: "high",
    patterns: [
      /\bfinal\s+result\b/,
      /\bresult\b/,
      /\bmerit[\s_-]*list\b/,
      /\bscore[\s_-]*card\b/,
      /\bcut[\s_-]?off\b/,
      /\bshortlisted\s+candidates\b/
    ]
  },
  {
    id: "notice-pdf",
    sourceType: "notice_pdf",
    confidence: "high",
    patterns: [
      /\bimportant\s+notice\b/,
      /\bshort\s+notice\b/,
      /\bpublic\s+notice\b/,
      /\bnotice\b/,
      /\bcirculat(?:e|ion)\b/
    ]
  }
]);

/**
 * Build searchable text blobs from profiling inputs (no content extraction).
 * @param {object} input
 */
function buildSearchBlobs(input = {}) {
  const parts = {
    title: String(input.title || "").toLowerCase(),
    filename: String(input.filename || "").toLowerCase(),
    url: String(input.url || input.sourceUrl || "").toLowerCase(),
    pathHint: String(input.pathHint || "").toLowerCase(),
    declaredType: String(
      input.declaredSourceType || input.sourceHint || input.sourceType || ""
    ).toLowerCase()
  };
  parts.combined = [parts.title, parts.filename, parts.url, parts.pathHint, parts.declaredType]
    .filter(Boolean)
    .join(" ");
  return parts;
}

function matchSpecialtyRules(blobs) {
  const matches = [];
  for (const rule of SPECIALTY_PDF_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(blobs.combined)) {
        matches.push({
          id: rule.id,
          sourceType: rule.sourceType,
          confidence: rule.confidence,
          matchedPattern: String(pattern)
        });
        break;
      }
    }
  }
  return matches;
}

function pickBestSpecialty(matches) {
  if (!matches.length) return null;
  let best = matches[0];
  for (let i = 1; i < matches.length; i += 1) {
    const candidate = matches[i];
    const bestRank = SOURCE_TYPE_PRECEDENCE[best.sourceType] ?? 99;
    const candidateRank = SOURCE_TYPE_PRECEDENCE[candidate.sourceType] ?? 99;
    if (candidateRank < bestRank) best = candidate;
  }
  return best;
}

/**
 * Classify source type from format + reliability + specialty indicators.
 * @param {object} ctx
 * @param {'html'|'pdf'|'unknown'} ctx.documentFormat
 * @param {boolean} ctx.isOfficial
 * @param {boolean} ctx.isLinkedPdf
 * @param {object} ctx.blobs
 * @returns {{ sourceType: string, confidence: string, matchedIndicators: object[], reasoning: string }}
 */
function classifySourceType(ctx) {
  const matchedIndicators = [];
  const format = ctx.documentFormat || "unknown";
  const specialtyMatches = matchSpecialtyRules(ctx.blobs || {});
  const bestSpecialty = pickBestSpecialty(specialtyMatches);

  if (format === "pdf" && bestSpecialty) {
    matchedIndicators.push(...specialtyMatches);
    return {
      sourceType: bestSpecialty.sourceType,
      confidence: bestSpecialty.confidence,
      matchedIndicators,
      reasoning: `Classified as ${SOURCE_TYPE_LABELS[bestSpecialty.sourceType]} from deterministic specialty indicators.`
    };
  }

  if (format === "pdf" && ctx.isLinkedPdf) {
    matchedIndicators.push({
      id: "linked-pdf-hint",
      sourceType: "linked_pdf",
      confidence: "high",
      matchedPattern: "linkedFromUrl|isLinkedPdf"
    });
    return {
      sourceType: "linked_pdf",
      confidence: "high",
      matchedIndicators,
      reasoning: "Classified as Linked PDF because a parent/link page indicator was provided."
    };
  }

  if (format === "pdf" && ctx.isOfficial) {
    matchedIndicators.push({
      id: "official-pdf-domain",
      sourceType: "official_pdf",
      confidence: "high",
      matchedPattern: "official_domain"
    });
    return {
      sourceType: "official_pdf",
      confidence: "high",
      matchedIndicators,
      reasoning: "Classified as Official PDF from official domain + PDF format."
    };
  }

  if (format === "html" && ctx.isOfficial) {
    matchedIndicators.push({
      id: "official-html-domain",
      sourceType: "official_html_page",
      confidence: "high",
      matchedPattern: "official_domain"
    });
    return {
      sourceType: "official_html_page",
      confidence: "high",
      matchedIndicators,
      reasoning: "Classified as Official HTML Page from official domain + HTML format."
    };
  }

  if (format === "pdf") {
    matchedIndicators.push({
      id: "pdf-format-unknown-authority",
      sourceType: "unknown_source",
      confidence: "medium",
      matchedPattern: "pdf"
    });
    return {
      sourceType: "unknown_source",
      confidence: "medium",
      matchedIndicators,
      reasoning: "PDF format detected but authority is not deterministically official or linked."
    };
  }

  if (format === "html") {
    matchedIndicators.push({
      id: "html-format-unknown-authority",
      sourceType: "unknown_source",
      confidence: "medium",
      matchedPattern: "html"
    });
    return {
      sourceType: "unknown_source",
      confidence: "medium",
      matchedIndicators,
      reasoning: "HTML format detected but authority is not deterministically official."
    };
  }

  return {
    sourceType: "unknown_source",
    confidence: "low",
    matchedIndicators,
    reasoning: "Insufficient deterministic indicators to classify the source."
  };
}

module.exports = {
  SPECIALTY_PDF_RULES,
  buildSearchBlobs,
  matchSpecialtyRules,
  pickBestSpecialty,
  classifySourceType
};
