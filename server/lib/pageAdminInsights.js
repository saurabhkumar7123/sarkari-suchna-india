"use strict";

const JOB_STATUS_SET = new Set(["latest job", "new form", "new", "form"]);

function normalizeJobStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isActiveJobStatus(status) {
  return JOB_STATUS_SET.has(normalizeJobStatus(status));
}

function buildPageQualityFlags(row) {
  const flags = [];
  if (!row || typeof row !== "object") return flags;

  const status = normalizeJobStatus(row.status);
  const isJob = isActiveJobStatus(status);

  if (isJob && !row.last_date && !row.lastDate) {
    flags.push({ code: "no_last_date", label: "No last date" });
  }

  const stateVal = row.state != null ? String(row.state).trim() : "";
  const deptVal = row.department != null ? String(row.department).trim() : "";
  if (!stateVal) flags.push({ code: "no_state", label: "No state" });
  if (!deptVal) flags.push({ code: "no_dept", label: "No dept" });

  const titleLen = String(row.title || "").trim().length;
  if (titleLen > 0 && titleLen < 12) {
    flags.push({ code: "short_title", label: "Short title" });
  }

  return flags;
}

function normalizeTitleForMatch(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\.(html|pdf)$/gi, "")
    .replace(/[^a-z0-9\u0900-\u097F]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarityScore(a, b) {
  const left = normalizeTitleForMatch(a);
  const right = normalizeTitleForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;
  const leftWords = new Set(left.split(" ").filter((w) => w.length > 2));
  const rightWords = new Set(right.split(" ").filter((w) => w.length > 2));
  if (!leftWords.size || !rightWords.size) return 0;
  let overlap = 0;
  leftWords.forEach((w) => {
    if (rightWords.has(w)) overlap += 1;
  });
  return overlap / Math.max(leftWords.size, rightWords.size);
}

module.exports = {
  JOB_STATUS_SET,
  isActiveJobStatus,
  buildPageQualityFlags,
  normalizeTitleForMatch,
  titleSimilarityScore
};
