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

const ALLOCATION_CATEGORIES = new Set(
  ["UR", "SC", "ST", "OBC", "EWS", "ESM", "OH", "HH", "VH", "OTHERS", "PWD"].map((s) => s.toUpperCase())
);

const ALLOCATION_HEADER =
  "Code, Category, Vacancy, Allocated, Total Marks, Marks in Section-I of Tier-II, Marks in Tier-I, Date of Birth";

const MIN_ALLOCATION_RUN = 3;

/**
 * Conservative parse of one delimiter-less allocation/last-selected row.
 * Code Category Vacancy Allocated TotalMarks SectionI TierI DOB
 * Nil last-selected cells are source "-".
 * @param {string} line
 * @returns {string[]|null}
 */
function parseAllocationGridRow(line) {
  const parts = String(line || "")
    .trim()
    .split(/\s+/);
  if (parts.length !== 8) return null;
  if (!/^[A-Z]{1,3}\d{2,4}$/i.test(parts[0])) return null;
  if (!ALLOCATION_CATEGORIES.has(parts[1].toUpperCase())) return null;
  if (!/^\d+$/.test(parts[2]) || !/^\d+$/.test(parts[3])) return null;
  const restOk = parts.slice(4).every(
    (p) => p === "-" || /^\d+(?:\.\d+)?$/.test(p) || /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(p)
  );
  if (!restOk) return null;
  return parts;
}

/**
 * Existing publisher table schema uses * for empty. Source "-" must not be
 * emitted as "-" because the HTML table builder treats "-" as rowspan merge.
 * @param {string} cell
 */
function allocationCellForPublisher(cell) {
  if (cell === "-") return "*";
  return cell;
}

/**
 * Compile consecutive allocation-grid rows into CSV table blocks.
 * Short/ambiguous runs stay as original text. Never invents values.
 * @param {string[]} lines
 * @returns {Array<{ type: string, text?: string, csvBody?: string, rows?: string[][], kind?: string, confidence?: number }> | null}
 */
function compileAllocationGridBlocks(lines) {
  const src = Array.isArray(lines) ? lines.map((l) => String(l || "").trim()).filter(Boolean) : [];
  if (src.length < MIN_ALLOCATION_RUN) return null;

  const blocks = [];
  let textBuf = [];
  let i = 0;

  const flushText = () => {
    if (!textBuf.length) return;
    blocks.push({ type: "paragraph", text: textBuf.join("\n") });
    textBuf = [];
  };

  while (i < src.length) {
    const first = parseAllocationGridRow(src[i]);
    if (!first) {
      textBuf.push(src[i]);
      i += 1;
      continue;
    }
    const run = [first];
    let j = i + 1;
    while (j < src.length) {
      const next = parseAllocationGridRow(src[j]);
      if (!next) break;
      run.push(next);
      j += 1;
    }
    if (run.length < MIN_ALLOCATION_RUN) {
      for (let k = i; k < j; k += 1) textBuf.push(src[k]);
      i = j;
      continue;
    }
    flushText();
    const dataRows = run.map((cells) => cells.map(allocationCellForPublisher));
    const csvRows = [ALLOCATION_HEADER.split(", ").join(", "), ...dataRows.map((r) => r.join(", "))];
    blocks.push({
      type: "table",
      kind: "vacancy",
      csvBody: csvRows.join("\n"),
      rows: [ALLOCATION_HEADER.split(", "), ...dataRows],
      confidence: 0.9
    });
    i = j;
  }
  flushText();

  if (!blocks.some((b) => b.type === "table")) return null;
  return blocks;
}

const POST_CODE_RE = /^[A-Z]{1,3}\d{2,4}$/i;
const POST_CODE_CAT_RE =
  /^([A-Z]{1,3}\d{2,4})\s+(UR|SC|ST|OBC|EWS|ESM|OH|HH|VH|OTHERS|PWD)\b/i;
const ORG_START_RE =
  /^(Department|Ministry|Directorate|Director|Commission|Tribunal|Bureau|Board|Office|O\/o|National|Central|Election|Armed|Archaeological|Staff Selection|Niti|Intelligence|Controller|Registrar|Lal)\b/i;
const MATRIX_CATS = new Set(
  [
    "UR",
    "SC",
    "ST",
    "OBC",
    "EWS",
    "ESM",
    "OH",
    "HH",
    "VH",
    "TOTAL",
    "OTHERS",
    "PWD",
    "PWDOTHERS",
    "EXS",
    "GEN",
    "GENERAL",
    "UNRESERVED"
  ].map((s) => s.toUpperCase())
);
const MATRIX_LABEL_RE =
  /\b(vacancies|vacancy|candidates?\s+recommended|cut[- ]?off(?:\s+marks)?|cut[- ]?off\s+on\s+percentage|recommended)\b/i;

/**
 * Documented thresholds for DUPLICATE_PDF_EXTRACTION_NOISE.
 * Structural overlap only — no document-specific magic strings.
 */
const DUPLICATE_NOISE_THRESHOLDS = Object.freeze({
  minCompiledRows: 20,
  minRegionLines: 12,
  minPairOverlap: 0.7,
  minValueOverlap: 0.5,
  minCodeOrder: 0.7,
  minDegradation: 0.35
});

function csvEscapeCell(cell) {
  const s = String(cell ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function joinCsvRow(cells) {
  return (cells || []).map(csvEscapeCell).join(", ");
}

function cellHasComma(cell) {
  return String(cell || "").includes(",");
}

function uniqueCodesInOrder(pairs) {
  const out = [];
  const seen = new Set();
  for (const p of pairs) {
    const c = String(p.code || "").toUpperCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function longestCommonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

function orderAgreement(garbledCodes, compiledCodes) {
  const compiledIndex = new Map((compiledCodes || []).map((c, i) => [c, i]));
  const shared = (garbledCodes || []).filter((c) => compiledIndex.has(c));
  if (shared.length < 3) return 0;
  let increasing = 0;
  for (let i = 1; i < shared.length; i += 1) {
    if (compiledIndex.get(shared[i]) > compiledIndex.get(shared[i - 1])) increasing += 1;
  }
  return increasing / (shared.length - 1);
}

function numericTokens(text) {
  return (String(text || "").match(/\d+(?:\.\d+)?/g) || []).filter((t) => t.length >= 1);
}

function pairKey(code, cat) {
  return `${String(code || "").toUpperCase()}|${String(cat || "").toUpperCase()}`;
}

function extractCodeCat(line) {
  const m = String(line || "")
    .trim()
    .match(POST_CODE_CAT_RE);
  if (!m) return null;
  return { code: m[1], cat: m[2] };
}

function isDegradedAllocationLike(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (parseAllocationGridRow(s)) return false;
  if (extractCodeCat(s)) return true;
  if (
    POST_CODE_RE.test(s.split(/\s+/)[0] || "") &&
    (/\d{1,2}\s+-\d{1,2}\s+-\d{2,4}/.test(s) || /--\d{4}\b/.test(s) || /\s-\s-\s-\s-/.test(s))
  ) {
    return true;
  }
  return false;
}

function looksLikeDuplicateGridHeader(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (/^code\s+category\s+vacancy\s+allocated/i.test(s)) return true;
  if (/\bcode\b.+\bcategory\b.+\bvacancy\b.+\ballocated\b/i.test(s) && s.length < 160) return true;
  if (/department\s*\|/i.test(s) && /allocated/i.test(s)) return true;
  if (/marks\s*\|\s*of\s*tier/i.test(s)) return true;
  if (/\(dd\s*-?\s*mm/i.test(s) && /yyyy/i.test(s)) return true;
  return false;
}

function looksLikePostCodeLine(line) {
  const s = String(line || "").trim();
  const m = s.match(/^([A-Z]{1,3}\d{2,4})\s+\S+/i);
  if (!m) return false;
  if (extractCodeCat(s) || parseAllocationGridRow(s) || isDegradedAllocationLike(s)) return false;
  return true;
}

function harvestPostCodes(lines, into) {
  const set = into instanceof Set ? into : new Set();
  for (const line of lines || []) {
    const m = String(line || "")
      .trim()
      .match(/^([A-Z]{1,3}\d{2,4})\b/i);
    if (m) set.add(m[1].toUpperCase());
  }
  return set;
}

function compiledRowIndex(compiledRows) {
  const map = new Map();
  for (const row of compiledRows || []) {
    if (!Array.isArray(row) || row.length < 2) continue;
    map.set(pairKey(row[0], row[1]), row);
  }
  return map;
}

function scoreGarbledRegion(regionLines, compiledRows) {
  const compiled = compiledRowIndex(compiledRows);
  const allocLike = [];
  let degraded = 0;
  for (const line of regionLines) {
    const clean = parseAllocationGridRow(line);
    const pair = extractCodeCat(line);
    if (clean || pair || isDegradedAllocationLike(line)) {
      allocLike.push({ line, pair: pair || (clean ? { code: clean[0], cat: clean[1] } : null), clean });
      if (!clean) degraded += 1;
    }
  }
  const pairs = allocLike.map((x) => x.pair).filter(Boolean);
  if (!pairs.length) {
    return { ok: false, confidence: 0, evidence: { reason: "no_code_category_pairs" } };
  }
  let pairHits = 0;
  let valueChecked = 0;
  let valueHits = 0;
  for (const item of allocLike) {
    if (!item.pair) continue;
    const row = compiled.get(pairKey(item.pair.code, item.pair.cat));
    if (!row) continue;
    pairHits += 1;
    const garbledNums = numericTokens(item.line);
    const compiledNums = numericTokens((row || []).join(" "));
    const compiledSet = new Set(compiledNums);
    if (!garbledNums.length) continue;
    valueChecked += 1;
    const overlap = garbledNums.filter((n) => compiledSet.has(n)).length / garbledNums.length;
    if (overlap >= DUPLICATE_NOISE_THRESHOLDS.minValueOverlap) valueHits += 1;
  }
  const pairOverlap = pairHits / pairs.length;
  const valueOverlap = valueChecked ? valueHits / valueChecked : 0;
  const garbledCodes = uniqueCodesInOrder(pairs);
  const compiledCodes = uniqueCodesInOrder(
    [...compiled.keys()].map((k) => {
      const [code] = k.split("|");
      return { code };
    })
  );
  const prefixDenom = Math.max(1, Math.min(garbledCodes.length, compiledCodes.length));
  const prefixOrder = longestCommonPrefixLen(garbledCodes, compiledCodes) / prefixDenom;
  const codeOrder = Math.max(prefixOrder, orderAgreement(garbledCodes, compiledCodes));
  const degradation = allocLike.length ? degraded / allocLike.length : 0;
  const evidence = {
    regionLines: regionLines.length,
    allocationLike: allocLike.length,
    pairCount: pairs.length,
    pairOverlap: Number(pairOverlap.toFixed(3)),
    valueOverlap: Number(valueOverlap.toFixed(3)),
    codeOrder: Number(codeOrder.toFixed(3)),
    degradation: Number(degradation.toFixed(3)),
    compiledRows: compiled.size
  };
  const ok =
    compiled.size >= DUPLICATE_NOISE_THRESHOLDS.minCompiledRows &&
    allocLike.length >= DUPLICATE_NOISE_THRESHOLDS.minRegionLines &&
    pairOverlap >= DUPLICATE_NOISE_THRESHOLDS.minPairOverlap &&
    valueOverlap >= DUPLICATE_NOISE_THRESHOLDS.minValueOverlap &&
    codeOrder >= DUPLICATE_NOISE_THRESHOLDS.minCodeOrder &&
    degradation >= DUPLICATE_NOISE_THRESHOLDS.minDegradation;
  const confidence = Number(
    (
      (Math.min(1, pairOverlap) * 0.35 +
        Math.min(1, valueOverlap) * 0.25 +
        Math.min(1, codeOrder) * 0.2 +
        Math.min(1, degradation) * 0.2) *
      (ok ? 1 : 0.5)
    ).toFixed(3)
  );
  return { ok, confidence: ok ? Math.max(confidence, 0.75) : confidence, evidence };
}

function findDegradedAllocationRegion(lines, compiledRows) {
  const src = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  let best = null;
  let i = 0;
  while (i < src.length) {
    if (!isDegradedAllocationLike(src[i]) && !extractCodeCat(src[i])) {
      i += 1;
      continue;
    }
    let j = i;
    let allocCount = 0;
    while (j < src.length) {
      if (isDegradedAllocationLike(src[j]) || extractCodeCat(src[j]) || parseAllocationGridRow(src[j])) {
        allocCount += 1;
        j += 1;
        continue;
      }
      if (looksLikeDuplicateGridHeader(src[j]) && j - i < 8) {
        j += 1;
        continue;
      }
      break;
    }
    if (allocCount >= DUPLICATE_NOISE_THRESHOLDS.minRegionLines) {
      let start = i;
      while (start > 0) {
        const prev = src[start - 1];
        if (looksLikeUniquePercentCutoffLine(prev)) break;
        if (
          looksLikeDuplicateGridHeader(prev) ||
          isCategoryHeaderLine(prev) ||
          looksLikeDegradedCategoryResidue(prev) ||
          looksLikeCutoffIntroResidue(prev) ||
          looksLikeHorizontalFootnote(prev)
        ) {
          start -= 1;
          continue;
        }
        break;
      }
      let end = j;
      const compiledCodes = new Set(
        (compiledRows || []).map((r) => String(r[0] || "").toUpperCase()).filter(Boolean)
      );
      while (end < src.length) {
        const line = src[end];
        const m = String(line).match(/^([A-Z]{1,3}\d{2,4})\b/i);
        if (m && compiledCodes.has(m[1].toUpperCase()) && looksLikePostCodeLine(line)) {
          end += 1;
          continue;
        }
        if (
          end > j &&
          String(line).length < 80 &&
          !/\b(sliding|pursuance|accordingly|representation|note\s*\d)/i.test(line) &&
          !/^\d+\./.test(line) &&
          looksLikePostCodeLine(src[end - 1])
        ) {
          end += 1;
          continue;
        }
        break;
      }
      const region = src.slice(start, end);
      const scored = scoreGarbledRegion(region, compiledRows);
      if (scored.ok && (!best || scored.confidence > best.confidence)) {
        best = { start, end, region, ...scored };
      }
    }
    i = Math.max(i + 1, j);
  }
  return best;
}

/**
 * Classify a leftover region as duplicate PDF extraction noise of an already
 * compiled allocation grid. Never uses a single magic token.
 * @param {string[]} lines
 * @param {string[][]} compiledRows
 */
function analyzeDuplicatePdfExtractionNoise(lines, compiledRows) {
  const hit = findDegradedAllocationRegion(lines, compiledRows);
  if (!hit) {
    return {
      classified: false,
      class: null,
      confidence: 0,
      regionSize: 0,
      evidence: { reason: "no_degraded_region_or_below_threshold" },
      thresholds: DUPLICATE_NOISE_THRESHOLDS
    };
  }
  return {
    classified: true,
    class: "DUPLICATE_PDF_EXTRACTION_NOISE",
    confidence: hit.confidence,
    regionSize: hit.region.length,
    start: hit.start,
    end: hit.end,
    evidence: hit.evidence,
    thresholds: DUPLICATE_NOISE_THRESHOLDS
  };
}

function stripDuplicatePdfExtractionNoise(lines, compiledRows) {
  const src = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  const analysis = analyzeDuplicatePdfExtractionNoise(src, compiledRows);
  if (!analysis.classified) {
    return { kept: src, removed: [], analysis };
  }
  const kept = src.filter((_, idx) => idx < analysis.start || idx >= analysis.end);
  const removed = src.slice(analysis.start, analysis.end);
  return { kept, removed, analysis };
}

function normalizeMatrixCat(token) {
  return String(token || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function isCategoryHeaderLine(line) {
  const parts = String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 6) return false;
  return parts.every((p) => {
    const n = normalizeMatrixCat(p);
    return MATRIX_CATS.has(n) || /^PWD/.test(n);
  });
}

function isNumericMatrixToken(token) {
  return /^\d+(?:\.\d+)?[%#*]*$/.test(String(token || "").trim());
}

function parseLabeledNumericRow(line, colCount) {
  const parts = String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= colCount) return null;
  const nums = parts.slice(-colCount);
  const label = parts.slice(0, -colCount).join(" ");
  if (!label || !nums.every(isNumericMatrixToken)) return null;
  if (!MATRIX_LABEL_RE.test(label)) return null;
  return { label, nums };
}

function joinWrappedCategoryHeader(lines, index) {
  const cur = String(lines[index] || "").trim();
  if (!isCategoryHeaderLine(cur)) return null;
  let header = cur;
  let consumed = 1;
  const next = String(lines[index + 1] || "").trim();
  if (next) {
    const nextParts = next.split(/\s+/).filter(Boolean);
    if (
      nextParts.length >= 1 &&
      nextParts.length <= 2 &&
      nextParts.every((p) => MATRIX_CATS.has(normalizeMatrixCat(p)) || /^PWD/.test(normalizeMatrixCat(p)))
    ) {
      header = `${header} ${next}`;
      consumed = 2;
    }
  }
  const cols = header.split(/\s+/).filter(Boolean);
  if (cols.length < 6) return null;
  return { cols, consumed };
}

/**
 * Compile a category cut-off / vacancy / recommended matrix only when header
 * columns and numeric rows align exactly. Ambiguity stays prose.
 * @param {string[]} lines
 */
function compileCategoryMatrixBlocks(lines) {
  const src = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  const blocks = [];
  let textBuf = [];
  let i = 0;

  const flushText = () => {
    if (!textBuf.length) return;
    blocks.push({ type: "paragraph", text: textBuf.join("\n") });
    textBuf = [];
  };

  while (i < src.length) {
    const header = joinWrappedCategoryHeader(src, i);
    if (!header) {
      textBuf.push(src[i]);
      i += 1;
      continue;
    }
    const data = [];
    let j = i + header.consumed;
    while (j < src.length) {
      const row = parseLabeledNumericRow(src[j], header.cols.length);
      if (!row) break;
      const rowPct = row.nums.some((n) => /%/.test(n));
      if (data.length) {
        const firstPct = data[0].nums.some((n) => /%/.test(n));
        if (rowPct !== firstPct) break;
      }
      data.push(row);
      j += 1;
    }
    if (!data.length) {
      textBuf.push(src[i]);
      i += 1;
      continue;
    }
    flushText();
    const headerCells = ["", ...header.cols];
    const rows = [headerCells, ...data.map((r) => [r.label, ...r.nums])];
    blocks.push({
      type: "table",
      kind: "vacancy",
      csvBody: rows.map(joinCsvRow).join("\n"),
      rows,
      confidence: 0.85,
      sourceRows: header.consumed + data.length,
      outputRows: data.length
    });
    i = j;
  }
  flushText();
  return blocks;
}

function isTruncatedOrg(org) {
  return /\b(of|and|for|the|&)\s*$/i.test(String(org || "").trim());
}

function looksLikeNewPostDeptRow(line) {
  return /^[A-Z]{1,3}\d{2,4}\s+\S+/i.test(String(line || "").trim());
}

function orgStartIndex(tokens) {
  const toks = Array.isArray(tokens) ? tokens : [];
  for (let i = 0; i < toks.length; i++) {
    if (ORG_START_RE.test(toks.slice(i).join(" "))) return i;
  }
  return -1;
}

function looksLikeUniquePercentCutoffLine(line) {
  const pcts = String(line || "").match(/\d+(?:\.\d+)?%/g) || [];
  return pcts.length >= 4;
}

function looksLikeCutoffIntroResidue(line) {
  const s = String(line || "").trim();
  return /category-wise\s+cut[- ]?off/i.test(s) && (s.match(/\d+(?:\.\d+)?/g) || []).length < 4;
}

function looksLikeHorizontalFootnote(line) {
  return /^[#*]\s*\d+/.test(String(line || "").trim());
}

function looksLikeShortCategoryWrap(line) {
  const parts = String(line || "")
    .trim()
    .split(/[\s|]+/)
    .filter(Boolean);
  if (!parts.length || parts.length > 2) return false;
  return parts.every((p) => MATRIX_CATS.has(normalizeMatrixCat(p)) || /^PWD/i.test(p));
}

function looksLikeDegradedCategoryResidue(line) {
  const s = String(line || "").trim();
  if (!s) return false;
  const unpiped = s.replace(/\|/g, " ");
  if (/\|/.test(s) && /PWD|UR|EWS|OBC|SC|ST/i.test(s)) return true;
  if (isCategoryHeaderLine(s) && /PWD-/.test(s)) return true;
  if (/\|/.test(s) && isCategoryHeaderLine(unpiped)) return true;
  return false;
}

function residueKey(line) {
  return String(line || "")
    .toLowerCase()
    .replace(/\|/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Drop leftover garbled/duplicate cut-off headers. Keep unique percent rows
 * and any line that is not structurally duplicate noise.
 */
function stripLeftoverCutoffResidue(lines, priorText) {
  const src = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  const kept = [];
  const removed = [];
  const seenIntros = new Set();
  const seenFootnotes = new Set();
  for (const raw of String(priorText || "").split(/\n/)) {
    const s = raw.trim();
    if (looksLikeCutoffIntroResidue(s)) seenIntros.add(residueKey(s));
    if (looksLikeHorizontalFootnote(s)) seenFootnotes.add(residueKey(s));
  }
  let prevDegradedHeader = false;

  for (const line of src) {
    const s = String(line || "").trim();
    if (looksLikeUniquePercentCutoffLine(s)) {
      kept.push(line);
      prevDegradedHeader = false;
      continue;
    }
    if (looksLikeCutoffIntroResidue(s)) {
      const k = residueKey(s);
      if (seenIntros.has(k)) {
        removed.push({ line: s, reason: "duplicate-cutoff-intro", confidence: 0.9 });
        prevDegradedHeader = true;
        continue;
      }
      seenIntros.add(k);
      kept.push(line);
      prevDegradedHeader = false;
      continue;
    }
    if (looksLikeHorizontalFootnote(s)) {
      const k = residueKey(s);
      if (seenFootnotes.has(k)) {
        removed.push({ line: s, reason: "duplicate-footnote", confidence: 0.88 });
        prevDegradedHeader = false;
        continue;
      }
      seenFootnotes.add(k);
      kept.push(line);
      prevDegradedHeader = false;
      continue;
    }
    if (looksLikeDegradedCategoryResidue(s)) {
      removed.push({ line: s, reason: "degraded-category-header", confidence: 0.92 });
      prevDegradedHeader = true;
      continue;
    }
    if (looksLikeShortCategoryWrap(s) && prevDegradedHeader) {
      removed.push({ line: s, reason: "degraded-category-header-wrap", confidence: 0.85 });
      prevDegradedHeader = true;
      continue;
    }
    kept.push(line);
    prevDegradedHeader = false;
  }
  return { kept, removed };
}

function isSafeWrapContinuation(current, next) {
  const n = String(next || "").trim();
  if (!n) return false;
  if (looksLikeNewPostDeptRow(n)) return false;
  if (extractCodeCat(n) || parseAllocationGridRow(n) || isDegradedAllocationLike(n)) return false;
  if (/^(note\s*\d|details of post|#\s*\d|cut[- ]?off|category[- ]wise)/i.test(n)) return false;
  if (/^[-*]/.test(n)) return false;
  const toks = n.split(/\s+/);
  const rest = String(current || "")
    .replace(/^[A-Z]{1,3}\d{2,4}\s+/i, "")
    .trim();
  const restOrgAt = orgStartIndex(rest.split(/\s+/));
  const currentHasOrg = restOrgAt >= 0;
  if (currentHasOrg && !isTruncatedOrg(current)) return false;
  if (isTruncatedOrg(current) && toks.length <= 8 && !/^\d/.test(n)) return true;
  const nOrgAt = orgStartIndex(toks);
  if (!currentHasOrg && nOrgAt >= 0 && nOrgAt <= 2) return true;
  if (!currentHasOrg && nOrgAt < 0 && toks.length <= 4 && !/\d{2,}/.test(n)) return true;
  return false;
}

function joinPostDepartmentWrapLines(lines) {
  const src = Array.isArray(lines) ? lines : String(lines || "").split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < src.length) {
    const raw = src[i];
    const line = String(raw || "").trim();
    if (!looksLikeNewPostDeptRow(line)) {
      out.push(raw);
      i += 1;
      continue;
    }
    let combined = line;
    i += 1;
    while (i < src.length) {
      const next = String(src[i] || "").trim();
      if (!isSafeWrapContinuation(combined, next)) break;
      combined = `${combined} ${next}`;
      i += 1;
    }
    out.push(combined);
  }
  return out;
}

function splitSingleLinePostDept(line) {
  const s = String(line || "").trim();
  const m = s.match(/^([A-Z]{1,3}\d{2,4})\s+(.+)$/i);
  if (!m) return null;
  if (extractCodeCat(s) || parseAllocationGridRow(s) || isDegradedAllocationLike(s)) return null;
  const rest = m[2].trim();
  const tokens = rest.split(/\s+/);
  if (tokens.length < 2) return null;
  const orgAt = orgStartIndex(tokens);
  if (orgAt < 1) return null;
  const post = tokens.slice(0, orgAt).join(" ");
  const org = tokens.slice(orgAt).join(" ");
  if (!post || !org) return null;
  if (isTruncatedOrg(org)) return null;
  if (cellHasComma(post) || cellHasComma(m[1])) return null;
  return { code: m[1], post, org };
}

function splitTwoLinePostDept(line, next) {
  const s = String(line || "").trim();
  const n = String(next || "").trim();
  const m = s.match(/^([A-Z]{1,3}\d{2,4})\s+(\S+)$/i);
  if (!m || !n) return null;
  if (POST_CODE_RE.test(n.split(/\s+/)[0] || "")) return null;
  if (!ORG_START_RE.test(n)) return null;
  if (isTruncatedOrg(n)) return null;
  if (cellHasComma(m[1]) || cellHasComma(m[2])) return null;
  return { code: m[1], post: m[2], org: n };
}

/**
 * Compile post-code / department rows only when code, post name, and
 * organization are unambiguously bounded. Organization commas are quoted via
 * csvEscapeCell; truncated/ambiguous rows stay prose.
 * @param {string[]} lines
 */
function compilePostDepartmentBlocks(lines) {
  const src = joinPostDepartmentWrapLines((lines || []).map((l) => String(l || "").trim()).filter(Boolean));
  const blocks = [];
  let textBuf = [];
  let i = 0;
  const MIN_POST_RUN = 2;

  const flushText = () => {
    if (!textBuf.length) return;
    blocks.push({ type: "paragraph", text: textBuf.join("\n") });
    textBuf = [];
  };

  while (i < src.length) {
    const run = [];
    let j = i;
    while (j < src.length) {
      const one = splitSingleLinePostDept(src[j]);
      if (one) {
        run.push({ row: one, consumed: 1 });
        j += 1;
        continue;
      }
      const two = splitTwoLinePostDept(src[j], src[j + 1]);
      if (two) {
        run.push({ row: two, consumed: 2 });
        j += 2;
        continue;
      }
      break;
    }
    if (run.length >= MIN_POST_RUN) {
      flushText();
      const header = ["Code", "Post Name", "Organization/Ministry Name"];
      const data = run.map((r) => [r.row.code, r.row.post, r.row.org]);
      const rows = [header, ...data];
      blocks.push({
        type: "table",
        kind: "vacancy",
        csvBody: rows.map(joinCsvRow).join("\n"),
        rows,
        confidence: 0.82,
        sourceRows: run.reduce((n, r) => n + r.consumed, 0),
        outputRows: data.length
      });
      i = j;
      continue;
    }
    textBuf.push(src[i]);
    i += 1;
  }
  flushText();
  return blocks;
}

function expandParagraphThrough(blocks, compiler) {
  const out = [];
  for (const b of blocks) {
    if (!b || b.type !== "paragraph") {
      out.push(b);
      continue;
    }
    const lines = String(b.text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const compiled = compiler(lines);
    if (!compiled || !compiled.some((x) => x.type === "table")) {
      out.push(b);
      continue;
    }
    out.push(...compiled);
  }
  return out;
}

/**
 * Vacancy-section orchestration: Grid A first (unchanged), then duplicate-noise
 * strip, then category matrix / post-department tables on leftovers.
 * @param {string[]} lines
 */
function compileVacancySectionBlocks(lines) {
  const src = Array.isArray(lines) ? lines.map((l) => String(l || "").trim()).filter(Boolean) : [];
  const alloc = compileAllocationGridBlocks(src);
  const base = alloc || [{ type: "paragraph", text: src.join("\n") }];
  const compiledAllocRows = [];
  for (const b of base) {
    if (b && b.type === "table" && Array.isArray(b.rows)) {
      compiledAllocRows.push(...b.rows.slice(1));
    }
  }

  const out = [];
  let emittedText = "";
  for (const b of base) {
    if (b.type === "table") {
      out.push(b);
      emittedText += `\n${b.csvBody || ""}`;
      continue;
    }
    const paraLines = String(b.text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const stripped = compiledAllocRows.length
      ? stripDuplicatePdfExtractionNoise(paraLines, compiledAllocRows)
      : { kept: paraLines, removed: [], analysis: { classified: false } };
    const residue = stripLeftoverCutoffResidue(stripped.kept, emittedText);
    const kept = joinPostDepartmentWrapLines(residue.kept);
    if (!kept.length) continue;
    emittedText += `\n${kept.join("\n")}`;
    let expanded = [{ type: "paragraph", text: kept.join("\n") }];
    expanded = expandParagraphThrough(expanded, compileCategoryMatrixBlocks);
    expanded = expandParagraphThrough(expanded, compilePostDepartmentBlocks);
    out.push(...expanded.filter((x) => x && (x.type === "table" || String(x.text || "").trim())));
  }

  if (!out.some((b) => b.type === "table")) return alloc ? out : null;
  return out;
}

module.exports = {
  reconstructDelimiterLessVacancyGrid,
  classifyHeader,
  isNumberToken,
  isCategoryToken,
  parseAllocationGridRow,
  compileAllocationGridBlocks,
  compileVacancySectionBlocks,
  compileCategoryMatrixBlocks,
  compilePostDepartmentBlocks,
  joinPostDepartmentWrapLines,
  stripLeftoverCutoffResidue,
  analyzeDuplicatePdfExtractionNoise,
  stripDuplicatePdfExtractionNoise,
  DUPLICATE_NOISE_THRESHOLDS,
  ALLOCATION_HEADER
};
