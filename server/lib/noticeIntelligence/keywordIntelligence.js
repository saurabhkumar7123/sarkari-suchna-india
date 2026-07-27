"use strict";

/**
 * Phase AI-2 — Keyword intelligence.
 *
 * Produces normalized, canonical keywords while keeping the exact wording that
 * appeared in the notice, so downstream phases can match on the canonical form
 * without losing the source text.
 */

const { collapse, round2, toKey, toText, uniqueBy } = require("./textUtils");

const KEYWORD_CATEGORIES = Object.freeze({
  ORGANIZATION: "organization",
  POST: "post",
  GRADE: "grade",
  SECTOR: "sector",
  EXAM_STAGE: "exam_stage",
  QUALIFICATION: "qualification",
  LOCATION: "location"
});

/**
 * Canonical keyword dictionary. `aliases` are matched case-insensitively with
 * word-boundary awareness; Devanagari aliases are matched as substrings.
 */
const KEYWORD_DICTIONARY = Object.freeze([
  // Organizations
  { keyword: "UP Police", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["up police", "uttar pradesh police", "uppbpb", "upprpb", "उत्तर प्रदेश पुलिस"] },
  { keyword: "UPPSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["uppsc", "uttar pradesh public service commission", "उत्तर प्रदेश लोक सेवा आयोग"] },
  { keyword: "UPSSSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["upsssc", "uttar pradesh subordinate services selection commission"] },
  { keyword: "SSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["ssc", "staff selection commission", "कर्मचारी चयन आयोग"] },
  { keyword: "UPSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["upsc", "union public service commission"] },
  { keyword: "NTA", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["nta", "national testing agency"] },
  { keyword: "Railway", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["railway", "railways", "indian railways", "rrb", "railway recruitment board", "रेलवे"] },
  { keyword: "BPSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["bpsc", "bihar public service commission", "बिहार लोक सेवा आयोग"] },
  { keyword: "BSSC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["bssc", "bihar staff selection commission"] },
  { keyword: "DSSSB", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["dsssb", "delhi subordinate services selection board"] },
  { keyword: "BHU", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["bhu", "banaras hindu university", "काशी हिन्दू विश्वविद्यालय"] },
  { keyword: "AIIMS", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["aiims", "all india institute of medical sciences"] },
  { keyword: "IBPS", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["ibps", "institute of banking personnel selection"] },
  { keyword: "ESIC", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["esic", "employees state insurance corporation"] },
  { keyword: "KVS", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["kvs", "kendriya vidyalaya sangathan"] },
  { keyword: "Delhi Police", category: KEYWORD_CATEGORIES.ORGANIZATION, aliases: ["delhi police", "दिल्ली पुलिस"] },

  // Posts
  { keyword: "Constable", category: KEYWORD_CATEGORIES.POST, aliases: ["constable", "constables", "constable gd", "आरक्षी"] },
  { keyword: "Head Constable", category: KEYWORD_CATEGORIES.POST, aliases: ["head constable", "मुख्य आरक्षी"] },
  { keyword: "Sub Inspector", category: KEYWORD_CATEGORIES.POST, aliases: ["sub inspector", "sub-inspector", "उप निरीक्षक"] },
  { keyword: "Assistant Professor", category: KEYWORD_CATEGORIES.POST, aliases: ["assistant professor", "asstt professor", "सहायक आचार्य", "सहायक प्रोफेसर"] },
  { keyword: "Associate Professor", category: KEYWORD_CATEGORIES.POST, aliases: ["associate professor", "सह आचार्य"] },
  { keyword: "Professor", category: KEYWORD_CATEGORIES.POST, aliases: ["professor", "आचार्य"] },
  { keyword: "Junior Engineer", category: KEYWORD_CATEGORIES.POST, aliases: ["junior engineer", "jr engineer", "कनिष्ठ अभियंता"] },
  { keyword: "Assistant Engineer", category: KEYWORD_CATEGORIES.POST, aliases: ["assistant engineer", "सहायक अभियंता"] },
  { keyword: "Nursing Officer", category: KEYWORD_CATEGORIES.POST, aliases: ["nursing officer", "नर्सिंग ऑफिसर", "नर्सिंग अधिकारी"] },
  { keyword: "Staff Nurse", category: KEYWORD_CATEGORIES.POST, aliases: ["staff nurse", "स्टाफ नर्स"] },
  { keyword: "Railway Technician", category: KEYWORD_CATEGORIES.POST, aliases: ["railway technician", "technician grade", "रेलवे तकनीशियन"] },
  { keyword: "Technician", category: KEYWORD_CATEGORIES.POST, aliases: ["technician", "तकनीशियन"] },
  { keyword: "Lab Technician", category: KEYWORD_CATEGORIES.POST, aliases: ["lab technician", "laboratory technician", "प्रयोगशाला तकनीशियन"] },
  { keyword: "Stenographer", category: KEYWORD_CATEGORIES.POST, aliases: ["stenographer", "steno", "आशुलिपिक"] },
  { keyword: "Clerk", category: KEYWORD_CATEGORIES.POST, aliases: ["clerk", "junior clerk", "लिपिक"] },
  { keyword: "Junior Assistant", category: KEYWORD_CATEGORIES.POST, aliases: ["junior assistant", "कनिष्ठ सहायक"] },
  { keyword: "Multi Tasking Staff", category: KEYWORD_CATEGORIES.POST, aliases: ["multi tasking staff", "multi-tasking staff", "mts"] },
  { keyword: "Naib Tehsildar", category: KEYWORD_CATEGORIES.POST, aliases: ["naib tehsildar", "नायब तहसीलदार"] },
  { keyword: "Block Development Officer", category: KEYWORD_CATEGORIES.POST, aliases: ["block development officer", "bdo", "खंड विकास अधिकारी"] },
  { keyword: "Deputy Collector", category: KEYWORD_CATEGORIES.POST, aliases: ["deputy collector", "उप समाहर्ता"] },
  { keyword: "Station Master", category: KEYWORD_CATEGORIES.POST, aliases: ["station master", "स्टेशन मास्टर"] },
  { keyword: "Goods Guard", category: KEYWORD_CATEGORIES.POST, aliases: ["goods guard", "goods train manager"] },
  { keyword: "Review Officer", category: KEYWORD_CATEGORIES.POST, aliases: ["review officer", "समीक्षा अधिकारी"] },
  { keyword: "Assistant Review Officer", category: KEYWORD_CATEGORIES.POST, aliases: ["assistant review officer", "सहायक समीक्षा अधिकारी"] },
  { keyword: "Teacher", category: KEYWORD_CATEGORIES.POST, aliases: ["teacher", "tgt", "pgt", "prt", "शिक्षक"] },
  { keyword: "Apprentice", category: KEYWORD_CATEGORIES.POST, aliases: ["apprentice", "apprentices", "apprenticeship", "trade apprentice", "act apprentice", "प्रशिक्षु"] },
  { keyword: "Data Entry Operator", category: KEYWORD_CATEGORIES.POST, aliases: ["data entry operator", "deo"] },
  { keyword: "Pharmacist", category: KEYWORD_CATEGORIES.POST, aliases: ["pharmacist", "फार्मासिस्ट"] },
  { keyword: "Medical Officer", category: KEYWORD_CATEGORIES.POST, aliases: ["medical officer", "चिकित्सा अधिकारी"] },
  { keyword: "Forest Guard", category: KEYWORD_CATEGORIES.POST, aliases: ["forest guard", "वन रक्षक"] },
  { keyword: "Lekhpal", category: KEYWORD_CATEGORIES.POST, aliases: ["lekhpal", "लेखपाल"] },

  // Grades
  { keyword: "Group A", category: KEYWORD_CATEGORIES.GRADE, aliases: ["group a", "group-a", "समूह क"] },
  { keyword: "Group B", category: KEYWORD_CATEGORIES.GRADE, aliases: ["group b", "group-b", "समूह ख"] },
  { keyword: "Group C", category: KEYWORD_CATEGORIES.GRADE, aliases: ["group c", "group-c", "समूह ग"] },
  { keyword: "Group D", category: KEYWORD_CATEGORIES.GRADE, aliases: ["group d", "group-d", "समूह घ"] },
  { keyword: "Level 1", category: KEYWORD_CATEGORIES.GRADE, aliases: ["level-1", "level 1", "pay level 1"] },

  // Sectors
  { keyword: "Police", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["police", "पुलिस"] },
  { keyword: "Defence", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["defence", "defense", "army", "navy", "air force", "रक्षा", "सेना"] },
  { keyword: "Banking", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["banking", "bank", "बैंक"] },
  { keyword: "Teaching", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["teaching", "faculty", "शिक्षण"] },
  { keyword: "Medical", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["medical", "nursing", "paramedical", "चिकित्सा"] },
  { keyword: "Engineering", category: KEYWORD_CATEGORIES.SECTOR, aliases: ["engineering", "अभियांत्रिकी"] },

  // Exam stages
  { keyword: "Computer Based Test", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["computer based test", "cbt", "online exam"] },
  { keyword: "Preliminary Exam", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["preliminary exam", "prelims", "प्रारंभिक परीक्षा"] },
  { keyword: "Main Exam", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["main exam", "mains exam", "मुख्य परीक्षा"] },
  { keyword: "Interview", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["interview", "साक्षात्कार"] },
  { keyword: "Physical Efficiency Test", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["physical efficiency test", "pet", "शारीरिक दक्षता परीक्षा"] },
  { keyword: "Physical Standard Test", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["physical standard test", "pst", "शारीरिक मानक परीक्षा"] },
  { keyword: "Document Verification", category: KEYWORD_CATEGORIES.EXAM_STAGE, aliases: ["document verification", "दस्तावेज़ सत्यापन", "दस्तावेज सत्यापन"] },

  // Qualifications
  { keyword: "Graduate", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["graduate", "graduation", "bachelor degree", "स्नातक"] },
  { keyword: "Post Graduate", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["post graduate", "postgraduate", "master degree", "स्नातकोत्तर"] },
  { keyword: "Diploma", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["diploma", "डिप्लोमा"] },
  { keyword: "ITI", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["iti", "industrial training institute", "आईटीआई"] },
  { keyword: "10th Pass", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["10th pass", "matriculation", "high school", "हाई स्कूल"] },
  { keyword: "12th Pass", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["12th pass", "intermediate", "इंटरमीडिएट"] },
  { keyword: "B.Ed", category: KEYWORD_CATEGORIES.QUALIFICATION, aliases: ["b.ed", "bed degree", "बी.एड"] },

  // Locations
  { keyword: "Uttar Pradesh", category: KEYWORD_CATEGORIES.LOCATION, aliases: ["uttar pradesh", "up state", "उत्तर प्रदेश"] },
  { keyword: "Bihar", category: KEYWORD_CATEGORIES.LOCATION, aliases: ["bihar", "बिहार"] },
  { keyword: "Delhi", category: KEYWORD_CATEGORIES.LOCATION, aliases: ["delhi", "new delhi", "दिल्ली"] },
  { keyword: "All India", category: KEYWORD_CATEGORIES.LOCATION, aliases: ["all india", "pan india", "अखिल भारतीय"] }
]);

/** Aliases pre-normalized and ordered longest-first within each entry. */
const NORMALIZED_DICTIONARY = KEYWORD_DICTIONARY.map((entry) => ({
  keyword: entry.keyword,
  category: entry.category,
  aliases: entry.aliases.map((alias) => toKey(alias)).sort((a, b) => b.length - a.length)
}));

/**
 * Locate an alias in text, preserving the exact original casing/spelling.
 * @param {string} source
 * @param {string} alias
 * @returns {{ original: string, index: number, occurrences: number }|null}
 */
function findAliasOccurrence(source, alias) {
  if (!source || !alias) return null;
  const haystack = source.toLowerCase();
  const isLatin = /^[a-z\d]/.test(alias);
  let index = haystack.indexOf(alias);
  let occurrences = 0;
  let firstIndex = -1;

  while (index !== -1) {
    const before = haystack[index - 1];
    const after = haystack[index + alias.length];
    const isWordChar = (char) => char !== undefined && /[\p{L}\p{N}]/u.test(char);
    const boundaryOk =
      !isLatin || (!isWordChar(before) && !isWordChar(after));
    if (boundaryOk) {
      occurrences += 1;
      if (firstIndex === -1) firstIndex = index;
    }
    index = haystack.indexOf(alias, index + alias.length);
  }

  if (!occurrences) return null;
  return {
    original: collapse(source.slice(firstIndex, firstIndex + alias.length)),
    index: firstIndex,
    occurrences
  };
}

/**
 * Extract normalized keywords while preserving the wording used in the notice.
 *
 * @param {{ title?: string, text?: string, headings?: Array<object> }} input
 * @param {{ maxKeywords?: number }} [options]
 * @returns {Array<{
 *   keyword: string,
 *   original: string,
 *   category: string,
 *   occurrences: number,
 *   inTitle: boolean,
 *   confidence: number
 * }>}
 */
function extractKeywords(input = {}, options = {}) {
  const maxKeywords = Number(options.maxKeywords) > 0 ? Number(options.maxKeywords) : 24;
  const title = collapse(input.title);
  const headingText = (Array.isArray(input.headings) ? input.headings : [])
    .map((heading) => heading.normalizedText || heading.raw || "")
    .join("\n");
  const body = toText(input.text);
  const combined = [title, headingText, body].filter(Boolean).join("\n");
  if (!combined) return [];

  const results = [];

  for (const { keyword, category, aliases } of NORMALIZED_DICTIONARY) {
    let hit = null;
    for (const alias of aliases) {
      hit = findAliasOccurrence(combined, alias);
      if (hit) break;
    }
    if (!hit) continue;

    // Any spelling of the keyword in the title counts, not just the one that
    // happened to match first in the body.
    const inTitle = aliases.some((alias) => Boolean(findAliasOccurrence(title, alias)));
    const frequencyBoost = Math.min(0.15, (hit.occurrences - 1) * 0.03);
    results.push({
      keyword,
      original: hit.original,
      category,
      occurrences: hit.occurrences,
      inTitle,
      confidence: round2(Math.min(0.98, (inTitle ? 0.85 : 0.7) + frequencyBoost))
    });
  }

  return uniqueBy(results, (item) => item.keyword)
    .sort(
      (a, b) =>
        Number(b.inTitle) - Number(a.inTitle) ||
        b.confidence - a.confidence ||
        b.occurrences - a.occurrences ||
        a.keyword.localeCompare(b.keyword)
    )
    .slice(0, maxKeywords);
}

/**
 * Flatten keyword objects to the canonical strings used by the normalized event.
 * @param {Array<object>} keywords
 * @returns {string[]}
 */
function toKeywordList(keywords) {
  return (keywords || []).map((item) => item.keyword);
}

module.exports = {
  KEYWORD_CATEGORIES,
  KEYWORD_DICTIONARY,
  findAliasOccurrence,
  extractKeywords,
  toKeywordList
};
