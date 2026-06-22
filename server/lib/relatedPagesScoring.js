"use strict";

/** @typedef {"form"|"admit"|"result"|"answer"|"syllabus"|"admission"|"document"|"other"} StatusGroup */

const ORG_TOKENS = [
  "ssc",
  "upsc",
  "rrb",
  "railway",
  "ibps",
  "bank",
  "sbi",
  "rbi",
  "police",
  "crpf",
  "bsf",
  "cisf",
  "itbp",
  "ssb",
  "nda",
  "cds",
  "drdo",
  "isro",
  "nic",
  "dmrc",
  "uppsc",
  "bpsc",
  "mppsc",
  "hssc",
  "kvs",
  "nvs",
  "ctet",
  "ugc",
  "nta",
  "aicte",
  "indian army",
  "indian navy",
  "air force",
  "afcat",
  "capf",
  "home guard"
];

const EXAM_TOKENS = [
  "cgl",
  "chsl",
  "gd",
  "mts",
  "cpo",
  "je",
  "alp",
  "ntpc",
  "group d",
  "group-d",
  "groupd",
  "si",
  "asi",
  "constable",
  "head constable",
  "tradesman",
  "stenographer",
  "ldc",
  "udc",
  "clerk",
  "po",
  "so",
  "technical",
  "apprentice",
  "teacher",
  "tet",
  "patwari",
  "forest guard",
  "assistant"
];

function stripInvisible(s) {
  return String(s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} status
 * @returns {StatusGroup}
 */
function normalizeStatusGroup(status) {
  const s = stripInvisible(status);
  if (!s) return "other";
  if (s.includes("latest") && s.includes("job")) return "form";
  if (s.includes("new") && s.includes("form")) return "form";
  if (s === "form" || s.startsWith("form ")) return "form";
  if (s.includes("admit")) return "admit";
  if (s.includes("answer")) return "answer";
  if (s.includes("result")) return "result";
  if (s.includes("syllabus")) return "syllabus";
  if (s.includes("admission")) return "admission";
  if (s.includes("document")) return "document";
  return "other";
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function tokenizeText(raw) {
  const s = stripInvisible(raw).replace(/[_,/|]+/g, " ");
  if (!s) return [];
  const tokens = new Set();
  for (const part of s.split(/[^a-z0-9]+/)) {
    const t = part.trim();
    if (t.length >= 2) tokens.add(t);
  }
  return [...tokens];
}

/**
 * @param {string} haystack
 * @param {string[]} dictionary multi-word checked first
 * @returns {Set<string>}
 */
function detectDictionaryTokens(haystack, dictionary) {
  const text = ` ${stripInvisible(haystack)} `;
  const found = new Set();
  const sorted = [...dictionary].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const p = stripInvisible(phrase);
    if (!p) continue;
    if (text.includes(` ${p} `) || text.startsWith(`${p} `) || text.endsWith(` ${p}`) || text === p) {
      found.add(p);
    }
  }
  for (const t of tokenizeText(haystack)) {
    if (dictionary.includes(t)) found.add(t);
  }
  return found;
}

/**
 * @param {import("../repositories/page.repository").RelatedPageRow | null | undefined} row
 */
function buildPageSignals(row) {
  const title = stripInvisible(row?.title);
  const slug = stripInvisible(row?.slug);
  const category = stripInvisible(row?.category);
  const department = stripInvisible(row?.department);
  const postName = stripInvisible(row?.post_name);
  const qualification = stripInvisible(row?.qualification);
  const state = stripInvisible(row?.state);

  const corpus = [title, slug, category, department, postName].filter(Boolean).join(" ");
  const orgs = detectDictionaryTokens(corpus, ORG_TOKENS);
  const exams = detectDictionaryTokens(corpus, EXAM_TOKENS);
  const tags = parseCategoryTags(category);
  const slugTokens = new Set(tokenizeText(slug));

  for (const t of tags) {
    if (ORG_TOKENS.includes(t)) orgs.add(t);
    if (EXAM_TOKENS.includes(t)) exams.add(t);
  }

  return {
    title,
    slug,
    statusGroup: normalizeStatusGroup(row?.status),
    orgs,
    exams,
    tags,
    department,
    qualification,
    state,
    slugTokens,
    createdAt: row?.created_at ? new Date(row.created_at).getTime() : 0,
    views: Math.max(0, Number(row?.views) || 0)
  };
}

/**
 * @param {string} category
 * @returns {string[]}
 */
function parseCategoryTags(category) {
  const raw = stripInvisible(category);
  if (!raw) return [];
  return [...new Set(raw.split(/[,;|]+/).map((t) => stripInvisible(t)).filter((t) => t.length >= 2))];
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
function setOverlapSize(a, b) {
  let n = 0;
  for (const x of a) {
    if (b.has(x)) n += 1;
  }
  return n;
}

/**
 * @param {ReturnType<typeof buildPageSignals>} anchor
 * @param {ReturnType<typeof buildPageSignals>} candidate
 */
function scorePair(anchor, candidate) {
  let score = 0;
  const orgOverlap = setOverlapSize(anchor.orgs, candidate.orgs);
  const examOverlap = setOverlapSize(anchor.exams, candidate.exams);
  const tagOverlap = anchor.tags.length
    ? anchor.tags.filter((t) => candidate.tags.includes(t)).length
    : setOverlapSize(new Set(anchor.tags), new Set(candidate.tags));

  if (examOverlap > 0) score += 100 + (examOverlap - 1) * 15;
  if (orgOverlap > 0) score += 80 + (orgOverlap - 1) * 10;

  if (anchor.statusGroup === candidate.statusGroup && anchor.statusGroup !== "other") {
    score += 55;
  } else if (anchor.statusGroup !== "other" && candidate.statusGroup !== "other") {
    score -= 25;
  }

  if (tagOverlap > 0) score += Math.min(45, tagOverlap * 15);

  if (anchor.department && candidate.department && anchor.department === candidate.department) {
    score += 25;
  }
  if (anchor.state && candidate.state && anchor.state === candidate.state) {
    score += 20;
  }
  if (anchor.qualification && candidate.qualification && anchor.qualification === candidate.qualification) {
    score += 15;
  }

  const slugOverlap = setOverlapSize(anchor.slugTokens, candidate.slugTokens);
  if (slugOverlap >= 2) score += 20;
  else if (slugOverlap === 1) score += 8;

  if (anchor.title && candidate.title) {
    const anchorWords = new Set(tokenizeText(anchor.title));
    const candWords = tokenizeText(candidate.title);
    let titleHits = 0;
    for (const w of candWords) {
      if (w.length >= 4 && anchorWords.has(w)) titleHits += 1;
    }
    score += Math.min(25, titleHits * 5);
  }

  const ageMs = anchor.createdAt && candidate.createdAt ? Math.abs(anchor.createdAt - candidate.createdAt) : 0;
  const ageDays = ageMs / (86400 * 1000);
  if (ageDays <= 7) score += 18;
  else if (ageDays <= 30) score += 12;
  else if (ageDays <= 90) score += 6;

  if (candidate.views > 0) {
    score += Math.min(12, Math.log1p(candidate.views) * 3);
  }

  return {
    score,
    orgOverlap,
    examOverlap,
    tagOverlap,
    sameStatus: anchor.statusGroup === candidate.statusGroup
  };
}

/**
 * @param {StatusGroup} anchorGroup
 * @param {StatusGroup} candidateGroup
 * @param {number} minTier
 */
function isStatusBlockedAtTier(anchorGroup, candidateGroup, minTier) {
  if (minTier >= 6) return false;
  if (anchorGroup === "result" || anchorGroup === "answer") {
    if (candidateGroup === "form") return true;
  }
  if (anchorGroup === "form" && minTier < 5) {
    if (candidateGroup === "result" || candidateGroup === "answer") return true;
  }
  if (anchorGroup === "admit" && minTier < 4) {
    if (candidateGroup === "form") return true;
  }
  return false;
}

/** Minimum relevance score to include in a given tier band (reduces noisy fill). */
function minScoreForTier(minTier) {
  if (minTier <= 1) return 95;
  if (minTier === 2) return 70;
  if (minTier === 3) return 48;
  if (minTier === 4) return 32;
  if (minTier === 5) return 22;
  return 0;
}

/**
 * @param {ReturnType<typeof buildPageSignals>} anchor
 * @param {ReturnType<typeof buildPageSignals>} candidate
 * @param {{ orgOverlap: number, examOverlap: number, tagOverlap: number }} metrics
 * @param {number} minTier
 */
function hasSemanticMatch(anchor, candidate, metrics, minTier) {
  if (metrics.orgOverlap > 0 || metrics.examOverlap > 0) return true;
  if (metrics.tagOverlap >= 1) return true;
  if (anchor.department && candidate.department && anchor.department === candidate.department) {
    return true;
  }
  if (anchor.state && candidate.state && anchor.state === candidate.state) {
    return true;
  }
  if (minTier >= 5) return true;
  if (anchor.orgs.size === 0 && anchor.exams.size === 0 && minTier >= 3) {
    return anchor.statusGroup === candidate.statusGroup;
  }
  return false;
}

/**
 * @param {ReturnType<typeof buildPageSignals>} anchor
 * @param {ReturnType<typeof buildPageSignals>} candidate
 * @param {{ score: number, orgOverlap: number, examOverlap: number, tagOverlap: number, sameStatus: boolean }} metrics
 */
function classifyTier(anchor, candidate, metrics) {
  const { score, orgOverlap, examOverlap, tagOverlap, sameStatus } = metrics;

  if (orgOverlap > 0 && examOverlap > 0 && sameStatus) return 1;
  if ((orgOverlap > 0 || examOverlap >= 1) && sameStatus && (tagOverlap >= 1 || score >= 120)) return 1;
  if (orgOverlap > 0 && (sameStatus || examOverlap > 0)) return 2;
  if (orgOverlap > 0) return 2;
  if (sameStatus && (examOverlap > 0 || tagOverlap >= 2 || score >= 90)) return 3;
  if (sameStatus) return 3;
  if (tagOverlap >= 1 || score >= 60) return 4;
  if (score >= 40) return 4;
  return 5;
}

/**
 * @param {import("../repositories/page.repository").RelatedPageRow | null} anchorRow
 * @param {import("../repositories/page.repository").RelatedPageRow[]} candidates
 * @param {number} [limit]
 * @returns {{ title: string, slug: string }[]}
 */
function pickRelatedPages(anchorRow, candidates, limit = 6) {
  const lim = Math.min(12, Math.max(1, Number(limit) || 6));
  const anchor = buildPageSignals(anchorRow || {});

  const scored = (candidates || [])
    .filter((row) => row && row.slug && stripInvisible(row.slug) !== anchor.slug)
    .map((row) => {
      const signals = buildPageSignals(row);
      const metrics = scorePair(anchor, signals);
      const tier = classifyTier(anchor, signals, metrics);
      return {
        row,
        signals,
        metrics,
        tier,
        sortKey: metrics.score
      };
    });

  const tierPasses = [
    { minTier: 1, maxTier: 1, label: "strict" },
    { minTier: 2, maxTier: 2, label: "org" },
    { minTier: 3, maxTier: 3, label: "status" },
    { minTier: 4, maxTier: 4, label: "tags" },
    { minTier: 5, maxTier: 5, label: "broad" }
  ];

  /** @type {Map<string, { row: import("../repositories/page.repository").RelatedPageRow, sortKey: number, tier: number }>} */
  const picked = new Map();

  const tryPick = (pass) => {
    const pool = scored
      .filter((item) => {
        if (picked.has(item.row.slug)) return false;
        if (item.tier < pass.minTier || item.tier > pass.maxTier) return false;
        if (item.metrics.score < minScoreForTier(pass.minTier)) return false;
        if (isStatusBlockedAtTier(anchor.statusGroup, item.signals.statusGroup, pass.minTier)) {
          return false;
        }
        if (!hasSemanticMatch(anchor, item.signals, item.metrics, pass.minTier)) {
          return false;
        }
        if (pass.minTier <= 3 && anchor.statusGroup !== "other" && !item.metrics.sameStatus) {
          return false;
        }
        if (pass.minTier <= 4 && anchor.orgs.size > 0) {
          if (item.metrics.orgOverlap === 0 && item.metrics.examOverlap === 0 && item.metrics.tagOverlap === 0) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
        return (b.signals.createdAt || 0) - (a.signals.createdAt || 0);
      });

    for (const item of pool) {
      if (picked.size >= lim) break;
      picked.set(item.row.slug, { row: item.row, sortKey: item.sortKey, tier: item.tier });
    }
  };

  for (const pass of tierPasses) {
    if (picked.size >= lim) break;
    tryPick(pass);
  }

  if (picked.size < lim) {
    const fallbackPool = scored
      .filter((item) => {
        if (picked.has(item.row.slug)) return false;
        if (item.metrics.score < minScoreForTier(5)) return false;
        if (isStatusBlockedAtTier(anchor.statusGroup, item.signals.statusGroup, 5)) return false;
        if (!hasSemanticMatch(anchor, item.signals, item.metrics, 5)) return false;
        return true;
      })
      .sort((a, b) => {
        if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
        return (b.signals.createdAt || 0) - (a.signals.createdAt || 0);
      });
    for (const item of fallbackPool) {
      if (picked.size >= lim) break;
      picked.set(item.row.slug, { row: item.row, sortKey: item.sortKey, tier: 5 });
    }
  }

  if (picked.size < lim) {
    const latestPool = scored
      .filter((item) => {
        if (picked.has(item.row.slug)) return false;
        if (isStatusBlockedAtTier(anchor.statusGroup, item.signals.statusGroup, 6)) return false;
        return item.metrics.score >= 8 || item.metrics.sameStatus;
      })
      .sort((a, b) => {
        if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
        return (b.signals.createdAt || 0) - (a.signals.createdAt || 0);
      });
    for (const item of latestPool) {
      if (picked.size >= lim) break;
      picked.set(item.row.slug, { row: item.row, sortKey: item.sortKey, tier: 6 });
    }
  }

  return [...picked.values()]
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
      return (new Date(b.row.created_at).getTime() || 0) - (new Date(a.row.created_at).getTime() || 0);
    })
    .slice(0, lim)
    .map(({ row }) => ({
      title: row.title,
      slug: row.slug
    }));
}

module.exports = {
  pickRelatedPages,
  buildPageSignals,
  normalizeStatusGroup,
  parseCategoryTags,
  scorePair,
  classifyTier,
  isStatusBlockedAtTier
};
