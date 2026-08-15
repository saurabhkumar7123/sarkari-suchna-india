"use strict";

/**
 * Conservative reconstruction of delimiter-less vacancy grids.
 * Returns a pipe table only when column identity and row mapping are deterministic.
 * Never invents values. Ambiguity → null (caller keeps original lines).
 */

const { detectRowDelimiter } = require("./tableDetect");

const KNOWN_CATEGORIES = new Set(
  [
    "UR",
    "UNRESERVED",
    "GEN",
    "GENERAL",
    "OBC",
    "SC",
    "ST",
    "EWS",
    "PWD",
    "PH",
    "ESM",
    "EXS",
    "OH",
    "HH",
    "VH",
    "TOTAL"
  ].map((s) => s.toUpperCase())
);

/**
 * @param {string} line
 * @returns {"post"|"category"|"vacancy"|null}
 */
function classifyHeader(line) {
  const t = String(line || "")
    .toLowerCase()
    .replace(/[.:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(post|post name|postname|name of post|पद)$/.test(t)) return "post";
  if (/^(category|categories|cat|वर्ग)$/.test(t)) return "category";
  if (/^(vacancy|vacancies|no of vacancy|no of vacancies|number of posts|no of posts|रिक्ति)$/.test(t)) {
    return "vacancy";
  }
  return null;
}

function isNumberToken(line) {
  return /^\d{1,6}$/.test(String(line || "").trim());
}

function isCategoryToken(line) {
  const t = String(line || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return KNOWN_CATEGORIES.has(t);
}

function isPostName(line) {
  const t = String(line || "").trim();
  if (!t || t.length < 2 || t.length > 80) return false;
  if (classifyHeader(t) || isNumberToken(t) || isCategoryToken(t)) return false;
  if (/^(yes|no)$/i.test(t)) return false;
  return /[A-Za-z\u0900-\u097F]/.test(t);
}

function normalizeLines(input) {
  if (Array.isArray(input)) {
    return input.map((l) => String(l || "").trim()).filter(Boolean);
  }
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function hasAnyDelimiter(lines) {
  return lines.some((l) => detectRowDelimiter(l));
}

function formatPipeTable(rows) {
  const header = "Post | Category | Vacancy";
  const body = rows.map((r) => `${r.post} | ${r.category} | ${r.vacancy}`);
  return [header, ...body].join("\n");
}

function rowsKey(rows) {
  return rows.map((r) => `${r.post}\t${r.category}\t${r.vacancy}`).join("\n");
}

function allCellsFromSource(rows, lines) {
  const source = new Set(lines);
  for (const r of rows) {
    if (!source.has(r.post) || !source.has(r.category) || !source.has(String(r.vacancy))) {
      return false;
    }
  }
  return rows.length > 0;
}

/**
 * Pattern A: Post, name, Category, cat, Vacancy, num (repeat).
 * @param {string[]} lines
 */
function tryLabeledTriples(lines) {
  if (lines.length < 6 || lines.length % 6 !== 0) return null;
  const rows = [];
  for (let i = 0; i < lines.length; i += 6) {
    if (classifyHeader(lines[i]) !== "post") return null;
    if (!isPostName(lines[i + 1])) return null;
    if (classifyHeader(lines[i + 2]) !== "category") return null;
    if (!isCategoryToken(lines[i + 3])) return null;
    if (classifyHeader(lines[i + 4]) !== "vacancy") return null;
    if (!isNumberToken(lines[i + 5])) return null;
    rows.push({
      post: lines[i + 1],
      category: lines[i + 3],
      vacancy: lines[i + 5]
    });
  }
  return rows;
}

/**
 * Pattern B: Post, name, Category, cats..., Vacancy, nums... (equal counts, repeat).
 * @param {string[]} lines
 */
function tryLabeledCategoryLists(lines) {
  const rows = [];
  let i = 0;
  while (i < lines.length) {
    if (classifyHeader(lines[i]) !== "post") return null;
    i += 1;
    if (i >= lines.length || !isPostName(lines[i])) return null;
    const post = lines[i];
    i += 1;
    if (i >= lines.length || classifyHeader(lines[i]) !== "category") return null;
    i += 1;
    const cats = [];
    while (i < lines.length && isCategoryToken(lines[i])) {
      cats.push(lines[i]);
      i += 1;
    }
    if (!cats.length) return null;
    if (i >= lines.length || classifyHeader(lines[i]) !== "vacancy") return null;
    i += 1;
    const nums = [];
    while (i < lines.length && isNumberToken(lines[i])) {
      nums.push(lines[i]);
      i += 1;
    }
    if (nums.length !== cats.length) return null;
    for (let k = 0; k < cats.length; k += 1) {
      rows.push({ post, category: cats[k], vacancy: nums[k] });
    }
  }
  return rows.length ? rows : null;
}

/**
 * Pattern C: Post / Category / Vacancy headers (any order) then row-major triples.
 * @param {string[]} lines
 */
function tryHeaderThenRowMajor(lines) {
  if (lines.length < 6) return null;
  const h0 = classifyHeader(lines[0]);
  const h1 = classifyHeader(lines[1]);
  const h2 = classifyHeader(lines[2]);
  if (!h0 || !h1 || !h2) return null;
  if (new Set([h0, h1, h2]).size !== 3) return null;
  const rest = lines.slice(3);
  if (!rest.length || rest.length % 3 !== 0) return null;
  const order = [h0, h1, h2];
  const rows = [];
  for (let i = 0; i < rest.length; i += 3) {
    const rec = { post: null, category: null, vacancy: null };
    rec[order[0]] = rest[i];
    rec[order[1]] = rest[i + 1];
    rec[order[2]] = rest[i + 2];
    if (!isPostName(rec.post) || !isCategoryToken(rec.category) || !isNumberToken(rec.vacancy)) {
      return null;
    }
    rows.push(rec);
  }
  return rows;
}

/**
 * Pattern B (unlabeled): post name, then (category, number)+ groups. No header labels.
 * @param {string[]} lines
 */
function tryPostThenCategoryValuePairs(lines) {
  if (lines.some((l) => classifyHeader(l))) return null;
  const rows = [];
  let i = 0;
  const pairCounts = [];
  while (i < lines.length) {
    if (!isPostName(lines[i])) return null;
    const post = lines[i];
    i += 1;
    let pairs = 0;
    while (i < lines.length && isCategoryToken(lines[i])) {
      if (i + 1 >= lines.length || !isNumberToken(lines[i + 1])) return null;
      rows.push({ post, category: lines[i], vacancy: lines[i + 1] });
      pairs += 1;
      i += 2;
    }
    if (!pairs) return null;
    pairCounts.push(pairs);
  }
  if (new Set(pairCounts).size > 1) return null;
  return rows.length ? rows : null;
}

/**
 * @param {string|string[]} input
 * @returns {string|null} pipe table, or null to keep original lines
 */
function reconstructDelimiterLessVacancyGrid(input) {
  const lines = normalizeLines(input);
  if (lines.length < 4) return null;
  if (hasAnyDelimiter(lines)) return null;

  const candidates = [];
  const attempts = [
    tryLabeledTriples,
    tryLabeledCategoryLists,
    tryHeaderThenRowMajor,
    tryPostThenCategoryValuePairs
  ];
  for (const fn of attempts) {
    const rows = fn(lines);
    if (rows && allCellsFromSource(rows, lines)) {
      candidates.push(rows);
    }
  }
  if (!candidates.length) return null;

  const keys = new Set(candidates.map(rowsKey));
  if (keys.size !== 1) return null;

  return formatPipeTable(candidates[0]);
}

module.exports = {
  reconstructDelimiterLessVacancyGrid,
  classifyHeader,
  isNumberToken,
  isCategoryToken
};
