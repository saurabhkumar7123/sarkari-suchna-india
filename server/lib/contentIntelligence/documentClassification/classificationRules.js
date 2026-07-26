"use strict";

/**
 * CIP Stage 1A — classification rules for shared Document Classification Engine.
 * Ordered for readability; resolution uses TYPE_PRECEDENCE + confidence.
 */

const CLASSIFICATION_RULES = Object.freeze([
  {
    id: "age-relaxation-explicit",
    documentType: "age_relaxation_notice",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bage\s+relaxation\b/,
      /\bupper\s+age\s+limit\s+relax(?:ation|ed)\b/,
      /\brelax(?:ation)?\s+in\s+age\b/,
      /\bage\s+limit\s+relax(?:ation|ed)\b/,
      /\bmaximum\s+age\s+relax(?:ation|ed)\b/
    ]
  },
  {
    id: "correction-notice-explicit",
    documentType: "correction_notice",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bcorrection\s+notice\b/,
      /\bcorrigendum\b/,
      /\berrata\b/,
      /\bamendment\s+(notice|to)\b/,
      /\brevised\s+(notification|advertisement|notice)\b/,
      /\brectification\b/,
      /\bclarification\s+notice\b/
    ]
  },
  {
    id: "exam-pattern-explicit",
    documentType: "exam_pattern",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bexam(?:ination)?\s+pattern\b/,
      /\bscheme\s+of\s+(the\s+)?exam(?:ination)?\b/,
      /\bpattern\s+of\s+(the\s+)?exam(?:ination)?\b/,
      /\bmarks\s+distribution\b/,
      /\bnegative\s+marking\b/,
      /\bpaper\s+pattern\b/,
      /\bselection\s+scheme\b/
    ]
  },
  {
    id: "syllabus-explicit",
    documentType: "syllabus",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bsyllabus\b/,
      /\bdetailed\s+syllabus\b/,
      /\bsubject[- ]wise\s+syllabus\b/,
      /\btopic[- ]wise\s+syllabus\b/,
      /\bexam(?:ination)?\s+syllabus\b/
    ]
  },
  {
    id: "admit-card-explicit",
    documentType: "admit_card",
    confidence: "high",
    weight: "title",
    patterns: [
      /\badmit\s+card\b/,
      /\badmitcard\b/,
      /\bhall\s+ticket\b/,
      /\badmission\s+certificate\b/,
      /\bcall\s+letter\b/,
      /\bentry\s+pass\b/,
      /\be\s*admit\b/
    ]
  },
  {
    id: "answer-key-explicit",
    documentType: "answer_key",
    confidence: "high",
    weight: "title",
    patterns: [
      /\banswer\s+key\b/,
      /\banswerkey\b/,
      /\bprovisional\s+(answer\s+)?key\b/,
      /\bfinal\s+answer\s+key\b/,
      /\bresponse\s+sheet\b/,
      /\bquestion\s+paper\s+with\s+answer\b/
    ]
  },
  {
    id: "result-explicit",
    documentType: "result",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bfinal\s+result\b/,
      /\bresult\b/,
      /\bscore\s*card\b/,
      /\bmerit\s+list\b/,
      /\bshortlisted\s+candidates\b/,
      /\bqualified\s+candidates\b/,
      /\bcut[- ]?off\b/
    ]
  },
  {
    id: "short-notice-explicit",
    documentType: "short_notice",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bshort\s+notice\b/,
      /\bshort\s+notification\b/,
      /\bcondensed\s+notification\b/,
      /\bsnm\b/
    ]
  },
  {
    id: "new-recruitment-explicit",
    documentType: "new_recruitment",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bnew\s+recruitment\b/,
      /\brecruitment\s+notification\b/,
      /\bdetailed\s+(advertisement|notification)\b/,
      /\bemployment\s+notice\b/,
      /\bonline\s+application\b/,
      /\bapply\s+online\b/,
      /\bapplication\s+form\b/,
      /\brecruitment\b/,
      /\badvertisement\b/,
      /\bnotification\b/
    ]
  },
  {
    id: "new-recruitment-medium",
    documentType: "new_recruitment",
    confidence: "medium",
    weight: "body",
    patterns: [/\bvacancy\b/, /\bvacancies\b/, /\bposts?\s+available\b/, /\btotal\s+posts?\b/]
  },
  {
    id: "important-notice-explicit",
    documentType: "important_notice",
    confidence: "high",
    weight: "title",
    patterns: [
      /\bimportant\s+notice\b/,
      /\bimportant\s+information\b/,
      /\bpublic\s+notice\b/,
      /\battention\s+(of\s+)?candidates\b/,
      /\bcandidates?\s+are\s+(hereby\s+)?informed\b/
    ]
  },
  {
    id: "document-explicit",
    documentType: "document",
    confidence: "medium",
    weight: "title",
    patterns: [
      /\bdocument\s+required\b/,
      /\brequired\s+documents?\b/,
      /\bdocuments?\s+checklist\b/,
      /\bcertificate\b/,
      /\bcircul\b/,
      /\bofficial\s+document\b/
    ]
  },
  {
    id: "document-generic",
    documentType: "document",
    confidence: "low",
    weight: "body",
    patterns: [/\bdocument\b/, /\bpdf\b/, /\bannexure\b/]
  }
]);

/** Extra abbreviation expansions beyond eventTypeClassifier (CIP-specific). */
const CIP_ABBREVIATION_REPLACEMENTS = Object.freeze([
  [/\bexam\s*ptn\b/g, " exam pattern "],
  [/\bsyll\b/g, " syllabus "],
  [/\bage\s*relax\b/g, " age relaxation "],
  [/\bimp\s*notice\b/g, " important notice "],
  [/\bcorr\s*notice\b/g, " correction notice "]
]);

module.exports = {
  CLASSIFICATION_RULES,
  CIP_ABBREVIATION_REPLACEMENTS
};
