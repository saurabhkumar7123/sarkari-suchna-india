"use strict";

/**
 * Phase AI-2 — Department / recruiting body detection.
 *
 * Known organizations resolve to a canonical name and code. Organizations that
 * are not in the registry are still reported: the detected text is preserved
 * verbatim so nothing is lost before the Production Workflow sees the event.
 */

const { collapse, round2, toKey, uniqueBy } = require("./textUtils");

const ORGANIZATION_KINDS = Object.freeze({
  COMMISSION: "commission",
  BOARD: "board",
  AGENCY: "agency",
  RAILWAY: "railway",
  UNIVERSITY: "university",
  INSTITUTE: "institute",
  FORCE: "force",
  DEPARTMENT: "department",
  BANK: "bank",
  UNKNOWN: "unknown"
});

/**
 * Registry of frequently monitored official recruiting bodies.
 * `aliases` are matched case-insensitively against title, headings and body.
 * `domains` are matched against the source URL host.
 */
const ORGANIZATION_REGISTRY = Object.freeze([
  {
    code: "UPPSC",
    name: "Uttar Pradesh Public Service Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of Uttar Pradesh",
    aliases: [
      "uppsc",
      "uttar pradesh public service commission",
      "up public service commission",
      "उत्तर प्रदेश लोक सेवा आयोग"
    ],
    domains: ["uppsc.up.nic.in"]
  },
  {
    code: "UPPRPB",
    name: "Uttar Pradesh Police Recruitment and Promotion Board",
    kind: ORGANIZATION_KINDS.BOARD,
    parentAuthority: "Government of Uttar Pradesh",
    aliases: [
      "upprpb",
      "uppbpb",
      "uttar pradesh police recruitment and promotion board",
      "up police recruitment and promotion board",
      "up police recruitment board",
      "उत्तर प्रदेश पुलिस भर्ती एवं प्रोन्नति बोर्ड",
      "उत्तर प्रदेश पुलिस भर्ती बोर्ड"
    ],
    domains: ["uppbpb.gov.in", "uppolice.gov.in"]
  },
  {
    code: "UPSSSC",
    name: "Uttar Pradesh Subordinate Services Selection Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of Uttar Pradesh",
    aliases: [
      "upsssc",
      "uttar pradesh subordinate services selection commission",
      "उत्तर प्रदेश अधीनस्थ सेवा चयन आयोग"
    ],
    domains: ["upsssc.gov.in"]
  },
  {
    code: "SSC",
    name: "Staff Selection Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of India",
    aliases: ["ssc", "staff selection commission", "कर्मचारी चयन आयोग"],
    domains: ["ssc.nic.in", "ssc.gov.in"]
  },
  {
    code: "UPSC",
    name: "Union Public Service Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of India",
    aliases: ["upsc", "union public service commission", "संघ लोक सेवा आयोग"],
    domains: ["upsc.gov.in"]
  },
  {
    code: "NTA",
    name: "National Testing Agency",
    kind: ORGANIZATION_KINDS.AGENCY,
    parentAuthority: "Ministry of Education",
    aliases: ["nta", "national testing agency", "राष्ट्रीय परीक्षा एजेंसी"],
    domains: ["nta.ac.in", "nta.nic.in"]
  },
  {
    code: "RRB",
    name: "Railway Recruitment Board",
    kind: ORGANIZATION_KINDS.RAILWAY,
    parentAuthority: "Ministry of Railways",
    aliases: [
      "rrb",
      "railway recruitment board",
      "railway recruitment boards",
      "indian railways",
      "रेलवे भर्ती बोर्ड",
      "भारतीय रेल"
    ],
    domains: ["rrbcdg.gov.in", "indianrailways.gov.in", "rrbapply.gov.in"]
  },
  {
    code: "RRC",
    name: "Railway Recruitment Cell",
    kind: ORGANIZATION_KINDS.RAILWAY,
    parentAuthority: "Ministry of Railways",
    aliases: ["rrc", "railway recruitment cell", "रेलवे भर्ती प्रकोष्ठ"],
    domains: ["rrcnr.org"]
  },
  {
    code: "BPSC",
    name: "Bihar Public Service Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of Bihar",
    aliases: ["bpsc", "bihar public service commission", "बिहार लोक सेवा आयोग"],
    domains: ["bpsc.bih.nic.in", "bpsc.bihar.gov.in"]
  },
  {
    code: "BSSC",
    name: "Bihar Staff Selection Commission",
    kind: ORGANIZATION_KINDS.COMMISSION,
    parentAuthority: "Government of Bihar",
    aliases: ["bssc", "bihar staff selection commission", "बिहार कर्मचारी चयन आयोग"],
    domains: ["bssc.bihar.gov.in"]
  },
  {
    code: "DSSSB",
    name: "Delhi Subordinate Services Selection Board",
    kind: ORGANIZATION_KINDS.BOARD,
    parentAuthority: "Government of NCT of Delhi",
    aliases: [
      "dsssb",
      "delhi subordinate services selection board",
      "दिल्ली अधीनस्थ सेवा चयन बोर्ड"
    ],
    domains: ["dsssb.delhi.gov.in", "dsssbonline.nic.in"]
  },
  {
    code: "BHU",
    name: "Banaras Hindu University",
    kind: ORGANIZATION_KINDS.UNIVERSITY,
    parentAuthority: "Ministry of Education",
    aliases: ["bhu", "banaras hindu university", "काशी हिन्दू विश्वविद्यालय"],
    domains: ["bhu.ac.in"]
  },
  {
    code: "AIIMS",
    name: "All India Institute of Medical Sciences",
    kind: ORGANIZATION_KINDS.INSTITUTE,
    parentAuthority: "Ministry of Health and Family Welfare",
    aliases: [
      "aiims",
      "all india institute of medical sciences",
      "अखिल भारतीय आयुर्विज्ञान संस्थान"
    ],
    domains: ["aiims.edu", "aiimsexams.ac.in"]
  },
  {
    code: "IBPS",
    name: "Institute of Banking Personnel Selection",
    kind: ORGANIZATION_KINDS.INSTITUTE,
    parentAuthority: "Government of India",
    aliases: ["ibps", "institute of banking personnel selection"],
    domains: ["ibps.in"]
  },
  {
    code: "ESIC",
    name: "Employees State Insurance Corporation",
    kind: ORGANIZATION_KINDS.DEPARTMENT,
    parentAuthority: "Ministry of Labour and Employment",
    aliases: ["esic", "employees state insurance corporation", "कर्मचारी राज्य बीमा निगम"],
    domains: ["esic.gov.in", "esic.nic.in"]
  },
  {
    code: "KVS",
    name: "Kendriya Vidyalaya Sangathan",
    kind: ORGANIZATION_KINDS.DEPARTMENT,
    parentAuthority: "Ministry of Education",
    aliases: ["kvs", "kendriya vidyalaya sangathan", "केंद्रीय विद्यालय संगठन"],
    domains: ["kvsangathan.nic.in"]
  },
  {
    code: "NVS",
    name: "Navodaya Vidyalaya Samiti",
    kind: ORGANIZATION_KINDS.DEPARTMENT,
    parentAuthority: "Ministry of Education",
    aliases: ["nvs", "navodaya vidyalaya samiti", "नवोदय विद्यालय समिति"],
    domains: ["navodaya.gov.in"]
  },
  {
    code: "DELHI_POLICE",
    name: "Delhi Police",
    kind: ORGANIZATION_KINDS.FORCE,
    parentAuthority: "Ministry of Home Affairs",
    aliases: ["delhi police", "दिल्ली पुलिस"],
    domains: ["delhipolice.gov.in"]
  },
  {
    code: "RBI",
    name: "Reserve Bank of India",
    kind: ORGANIZATION_KINDS.BANK,
    parentAuthority: "Government of India",
    aliases: ["rbi", "reserve bank of india", "भारतीय रिज़र्व बैंक"],
    domains: ["rbi.org.in"]
  },
  {
    code: "ISRO",
    name: "Indian Space Research Organisation",
    kind: ORGANIZATION_KINDS.DEPARTMENT,
    parentAuthority: "Department of Space",
    aliases: ["isro", "indian space research organisation"],
    domains: ["isro.gov.in"]
  },
  {
    code: "DRDO",
    name: "Defence Research and Development Organisation",
    kind: ORGANIZATION_KINDS.DEPARTMENT,
    parentAuthority: "Ministry of Defence",
    aliases: ["drdo", "defence research and development organisation"],
    domains: ["drdo.gov.in", "rac.gov.in"]
  }
]);

/** Generic organization shapes used when the registry has no entry. */
const GENERIC_ORGANIZATION_PATTERNS = Object.freeze([
  /\b([A-Z][A-Za-z.&'-]*(?:\s+[A-Za-z.&'-]+){0,7}\s+(?:Public Service Commission|Service Commission|Selection Commission|Selection Board|Recruitment Board|Recruitment Cell|Commission|Board|Corporation|Council|Authority|University|Institute|Ministry|Department|Directorate|Nigam|Samiti|Sangathan))\b/,
  /((?:[\u0900-\u097F]+\s+){1,7}(?:आयोग|बोर्ड|मंडल|विभाग|मंत्रालय|विश्वविद्यालय|संस्थान|परिषद|निगम|समिति|संगठन|निदेशालय))/
]);

const SOURCE_WEIGHTS = Object.freeze({
  url: 0.95,
  title: 0.94,
  heading: 0.82,
  body_early: 0.78,
  body: 0.62
});

/**
 * @param {string|null} url
 * @returns {string|null}
 */
function extractHost(url) {
  const value = collapse(url);
  if (!value) return null;
  const match = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]+)/i) || value.match(/^([\w.-]+\.[a-z]{2,})/i);
  return match ? match[1].toLowerCase().replace(/^www\./, "") : null;
}

/**
 * Word-boundary safe alias search that also works for Devanagari aliases.
 * @param {string} haystackKey
 * @param {string} alias
 * @returns {boolean}
 */
function containsAlias(haystackKey, alias) {
  if (!haystackKey || !alias) return false;
  const index = haystackKey.indexOf(alias);
  if (index === -1) return false;
  const before = haystackKey[index - 1];
  const after = haystackKey[index + alias.length];
  const isWordChar = (char) => char !== undefined && /[\p{L}\p{N}]/u.test(char);
  if (/[a-z\d]/.test(alias[0]) && isWordChar(before)) return false;
  if (/[a-z\d]/.test(alias[alias.length - 1]) && isWordChar(after)) return false;
  return true;
}

/**
 * @param {object} entry
 * @param {string} source
 * @param {string} matchedAlias
 * @param {string} matchedText
 * @returns {object}
 */
function buildCandidate(entry, source, matchedAlias, matchedText) {
  return {
    code: entry.code,
    name: entry.name,
    kind: entry.kind,
    parentAuthority: entry.parentAuthority || null,
    source,
    matchedAlias,
    matchedText: collapse(matchedText) || null,
    score: SOURCE_WEIGHTS[source] || 0.5,
    isKnownOrganization: true
  };
}

/**
 * Look for an organization-shaped phrase when the registry does not match.
 * @param {string[]} texts
 * @returns {{ text: string, source: string }|null}
 */
function detectGenericOrganization(texts) {
  for (const { value, source } of texts) {
    const text = collapse(value);
    if (!text) continue;
    for (const pattern of GENERIC_ORGANIZATION_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1] && collapse(match[1]).length >= 6) {
        return { text: collapse(match[1]), source };
      }
    }
  }
  return null;
}

/**
 * Identify the department / recruiting body behind a notice.
 *
 * @param {{
 *   title?: string,
 *   url?: string,
 *   lines?: string[],
 *   text?: string,
 *   headings?: Array<object>
 * }} input
 * @returns {object}
 */
function detectDepartment(input = {}) {
  const title = collapse(input.title);
  const url = collapse(input.url);
  const host = extractHost(url);
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const headingText = (Array.isArray(input.headings) ? input.headings : [])
    .map((heading) => heading.normalizedText || heading.text || "")
    .join(" \n ");
  const earlyBody = lines.slice(0, 8).join(" \n ");
  const fullBody = collapse(input.text) || lines.join(" \n ");

  const searchSpaces = [
    { source: "title", value: title },
    { source: "heading", value: headingText },
    { source: "body_early", value: earlyBody },
    { source: "body", value: fullBody }
  ].map((space) => ({ ...space, key: toKey(space.value) }));

  const candidates = [];

  for (const entry of ORGANIZATION_REGISTRY) {
    if (host && (entry.domains || []).some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      candidates.push(buildCandidate(entry, "url", host, host));
    }
    for (const space of searchSpaces) {
      if (!space.key) continue;
      const alias = (entry.aliases || []).find((candidate) => containsAlias(space.key, toKey(candidate)));
      if (alias) {
        candidates.push(buildCandidate(entry, space.source, toKey(alias), space.value.slice(0, 160)));
        break;
      }
    }
  }

  // Agreement across independent surfaces is the strongest possible signal.
  const byCode = new Map();
  for (const candidate of candidates) {
    const existing = byCode.get(candidate.code);
    if (!existing) {
      byCode.set(candidate.code, { ...candidate, sources: [candidate.source] });
      continue;
    }
    existing.sources.push(candidate.source);
    if (candidate.score > existing.score) {
      existing.score = candidate.score;
      existing.source = candidate.source;
      existing.matchedAlias = candidate.matchedAlias;
      existing.matchedText = candidate.matchedText;
    }
  }

  const ranked = Array.from(byCode.values())
    .map((candidate) => ({
      ...candidate,
      sources: uniqueBy(candidate.sources, (source) => source),
      score: round2(Math.min(0.99, candidate.score + 0.03 * (candidate.sources.length - 1)))
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] || null;

  if (best) {
    const isBoardLike = [
      ORGANIZATION_KINDS.COMMISSION,
      ORGANIZATION_KINDS.BOARD,
      ORGANIZATION_KINDS.AGENCY,
      ORGANIZATION_KINDS.RAILWAY
    ].includes(best.kind);

    return {
      department: best.name,
      departmentCode: best.code,
      board: isBoardLike ? best.name : null,
      boardCode: isBoardLike ? best.code : null,
      organizationKind: best.kind,
      parentAuthority: best.parentAuthority,
      isKnownOrganization: true,
      detectedText: best.matchedText,
      matchedOn: best.source,
      matchedSources: best.sources,
      confidence: best.score,
      candidates: ranked.slice(0, 5)
    };
  }

  const generic = detectGenericOrganization([
    { value: title, source: "title" },
    { value: headingText, source: "heading" },
    { value: earlyBody, source: "body_early" },
    { value: fullBody, source: "body" }
  ]);

  if (generic) {
    return {
      department: generic.text,
      departmentCode: null,
      board: /board|commission|आयोग|बोर्ड/i.test(generic.text) ? generic.text : null,
      boardCode: null,
      organizationKind: ORGANIZATION_KINDS.UNKNOWN,
      parentAuthority: null,
      isKnownOrganization: false,
      detectedText: generic.text,
      matchedOn: generic.source,
      matchedSources: [generic.source],
      confidence: generic.source === "title" ? 0.6 : 0.45,
      candidates: []
    };
  }

  return {
    department: null,
    departmentCode: null,
    board: null,
    boardCode: null,
    organizationKind: ORGANIZATION_KINDS.UNKNOWN,
    parentAuthority: null,
    isKnownOrganization: false,
    detectedText: null,
    matchedOn: null,
    matchedSources: [],
    confidence: 0,
    candidates: []
  };
}

module.exports = {
  ORGANIZATION_KINDS,
  ORGANIZATION_REGISTRY,
  extractHost,
  containsAlias,
  detectDepartment,
  detectGenericOrganization
};
