"use strict";

/**
 * CIP Stage 1C — section title indicator rules.
 *
 * Rules are ordered: the first matching rule decides the section type.
 * Patterns run against a normalized heading key (lowercase, collapsed
 * whitespace, numbering / trailing colon / "| table" suffix stripped).
 *
 * Complements (does not replace) the narrower publisher alias map in
 * server/utils/publisherSections.js, which stays untouched for
 * Generator/publishing compatibility.
 */

const { SECTION_TYPES } = require("./structureTypes");

function rule(sectionType, confidence, patterns) {
  return Object.freeze({
    id: `section:${sectionType}`,
    sectionType,
    confidence,
    patterns
  });
}

const SECTION_RULES = Object.freeze([
  rule(SECTION_TYPES.SHORT_INFORMATION, "high", [
    /^short\s*information\b/,
    /^short\s*info$/,
    /^shortinfo$/,
    /^brief\s*information\b/,
    /संक्षिप्त\s*जानकारी/
  ]),
  rule(SECTION_TYPES.IMPORTANT_DATES, "high", [
    /^important\s*dates?\b/,
    /^exam\s*schedule$/,
    /^schedule\s*of\s*(?:important\s*)?dates?$/,
    /महत्?वपूर्ण\s*(?:तिथि|तारीख)/
  ]),
  rule(SECTION_TYPES.APPLICATION_FEE, "high", [
    /^application\s*fees?\b/,
    /^exam(?:ination)?\s*fees?\b/,
    /^fees?\s*details?$/,
    /आवेदन\s*शुल्क/
  ]),
  rule(SECTION_TYPES.AGE_LIMIT, "high", [
    /^age\s*limits?\b/,
    /^age\s*criteria\b/,
    /^age\s*relaxation\b/,
    /आयु\s*सीमा/
  ]),
  rule(SECTION_TYPES.QUALIFICATION, "high", [
    /^(?:educational?\s*)?qualifications?\b/,
    /^eligibility\s*criteria$/,
    /(?:शैक्षणिक\s*)?योग्यता/
  ]),
  rule(SECTION_TYPES.VACANCY_DETAILS, "high", [
    /^vacancy\s*details?\b/,
    /^vacanc(?:y|ies)\b/,
    /^post\s*(?:wise\s*)?details?\b/,
    /^details?\s*of\s*posts?$/,
    /पद\s*विवरण/,
    /रिक्ति(?:यों)?\s*(?:का\s*)?विवरण/
  ]),
  rule(SECTION_TYPES.SELECTION_PROCESS, "high", [
    /^selection\s*(?:process|procedure)\b/,
    /^mode\s*of\s*selection$/,
    /चयन\s*प्रक्रिया/
  ]),
  rule(SECTION_TYPES.HOW_TO_APPLY, "high", [
    /^how\s*to\s*apply\b/,
    /^how\s*to\s*fill\s*(?:the\s*)?(?:online\s*)?(?:application\s*)?form\b/,
    /^application\s*(?:process|procedure)\b/,
    /^apply\s*online\s*process$/,
    /आवेदन\s*कैसे\s*करें?/
  ]),
  rule(SECTION_TYPES.IMPORTANT_LINKS, "high", [
    /^(?:some\s*)?(?:useful\s*)?important\s*links?\b/,
    /^useful\s*links?$/,
    /^quick\s*links?$/,
    /महत्?वपूर्ण\s*लिंक/
  ]),
  rule(SECTION_TYPES.FAQ, "high", [
    /^faqs?$/,
    /^frequently\s*asked\s*questions?\b/,
    /^important\s*questions?\b/,
    /अक्सर\s*पूछे\s*जाने\s*वाले\s*प्रश्न/
  ]),
  rule(SECTION_TYPES.EXAM_PATTERN, "high", [
    /^exam(?:ination)?\s*pattern\b/,
    /^exam\s*scheme$/,
    /^scheme\s*of\s*exam(?:ination)?$/,
    /परीक्षा\s*पैटर्न/
  ]),
  rule(SECTION_TYPES.SYLLABUS, "high", [
    /^(?:exam(?:ination)?\s*|detailed\s*)?syllabus\b/,
    /पाठ्यक्रम/
  ]),
  rule(SECTION_TYPES.ADMIT_CARD, "high", [
    /^admit\s*cards?\b/,
    /^hall\s*tickets?\b/,
    /^call\s*letters?\b/,
    /प्रवेश\s*पत्र/,
    /एडमिट\s*कार्ड/
  ]),
  rule(SECTION_TYPES.ANSWER_KEY, "high", [
    /^answer\s*keys?\b/,
    /उत्तर\s*कुंजी/
  ]),
  rule(SECTION_TYPES.RESULT, "high", [
    /^(?:exam(?:ination)?\s*|final\s*)?results?\b/,
    /परिणाम/,
    /रिजल्ट/
  ]),
  rule(SECTION_TYPES.CORRECTION, "high", [
    /^correction\b/,
    /^(?:form\s*)?correction(?:\s*\/?\s*edit)?\s*(?:form|window)?$/,
    /^edit\s*form\b/,
    /संशोधन/
  ]),
  rule(SECTION_TYPES.IMPORTANT_INSTRUCTIONS, "high", [
    /^important\s*instructions?\b/,
    /^general\s*instructions?\b/,
    /महत्?वपूर्ण\s*निर्देश/
  ]),
  rule(SECTION_TYPES.NOTICE, "high", [
    /^notices?$/,
    /^(?:short\s*|official\s*)?notice\b/,
    /सूचना/
  ]),

  // Generic / lower-confidence aliases (kept after specific rules).
  rule(SECTION_TYPES.IMPORTANT_DATES, "medium", [/^dates?$/, /^schedule$/]),
  rule(SECTION_TYPES.APPLICATION_FEE, "medium", [/^fees?$/, /शुल्क/]),
  rule(SECTION_TYPES.QUALIFICATION, "medium", [/^eligibility$/]),
  rule(SECTION_TYPES.IMPORTANT_LINKS, "medium", [/^links?$/]),
  rule(SECTION_TYPES.VACANCY_DETAILS, "medium", [/^total\s*posts?\b/]),
  rule(SECTION_TYPES.IMPORTANT_INSTRUCTIONS, "medium", [/^instructions?$/]),
  rule(SECTION_TYPES.NOTICE, "medium", [/^notifications?$/])
]);

/**
 * Normalize a raw heading into a matching key:
 * lowercase, collapsed whitespace, leading numbering and
 * trailing colon / dash decorations stripped.
 * @param {string} raw
 * @returns {string}
 */
function buildHeadingKey(raw) {
  return String(raw || "")
    .replace(/\|\s*table\s*$/i, "")
    .replace(/^[\s\-–—•*#]+/, "")
    .replace(/^\d+\s*[.)]\s*/, "")
    .replace(/[:：\-–—\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Match a normalized heading key against all section rules.
 * Returns every rule hit (rule order preserved); the first entry is primary.
 * @param {string} key
 * @returns {Array<{ id: string, sectionType: string, confidence: string, matchedPattern: string }>}
 */
function matchSectionTitle(key) {
  const text = String(key || "");
  if (!text) return [];
  const matches = [];
  for (const sectionRule of SECTION_RULES) {
    for (const pattern of sectionRule.patterns) {
      const hit = text.match(pattern);
      if (hit) {
        matches.push({
          id: sectionRule.id,
          sectionType: sectionRule.sectionType,
          confidence: sectionRule.confidence,
          matchedPattern: hit[0]
        });
        break;
      }
    }
  }
  return matches;
}

module.exports = {
  SECTION_RULES,
  buildHeadingKey,
  matchSectionTitle
};
