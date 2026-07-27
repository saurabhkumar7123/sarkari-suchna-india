"use strict";

/**
 * Phase AI-5 — Stage diagnostic builder.
 *
 * Every pipeline stage emits one diagnostic with input / output / result /
 * warnings / confidence / validation issues / duration. Pure advisory object.
 */

const { deepFreeze, round2 } = require("../noticeIntelligence/textUtils");
const {
  PIPELINE_STAGE_LABELS,
  STAGE_RESULT
} = require("./types");

/**
 * @param {object} parts
 * @returns {object}
 */
function buildStageDiagnostic(parts = {}) {
  const stageId = parts.stageId || "unknown";
  const startedAt = typeof parts.startedAt === "number" ? parts.startedAt : null;
  const endedAt = typeof parts.endedAt === "number" ? parts.endedAt : Date.now();
  const durationMs =
    typeof parts.durationMs === "number"
      ? parts.durationMs
      : startedAt != null
        ? Math.max(0, endedAt - startedAt)
        : 0;

  const warnings = Array.isArray(parts.warnings) ? parts.warnings.slice() : [];
  const validationIssues = Array.isArray(parts.validationIssues)
    ? parts.validationIssues.slice()
    : [];

  let result = parts.result || STAGE_RESULT.PASS;
  if (parts.error) result = STAGE_RESULT.ERROR;
  else if (result === STAGE_RESULT.PASS && validationIssues.some((i) => i.severity === "critical" || i.severity === "Critical" || i.severity === "CRITICAL")) {
    result = STAGE_RESULT.WARN;
  } else if (result === STAGE_RESULT.PASS && warnings.length > 0) {
    result = STAGE_RESULT.WARN;
  }

  return deepFreeze({
    stageId,
    stageLabel: PIPELINE_STAGE_LABELS[stageId] || stageId,
    input: parts.input == null ? null : summarizeValue(parts.input),
    output: parts.output == null ? null : summarizeValue(parts.output),
    executionResult: result,
    warnings,
    confidence: normalizeConfidence(parts.confidence),
    validationIssues,
    durationMs,
    memoryDeltaBytes:
      typeof parts.memoryDeltaBytes === "number" ? parts.memoryDeltaBytes : null,
    error: parts.error
      ? {
          message: String(parts.error.message || parts.error),
          name: parts.error.name || "Error"
        }
      : null,
    notes: parts.notes || null
  });
}

/**
 * Keep diagnostics serializable and bounded.
 * @param {*} value
 * @param {number} [depth]
 * @returns {*}
 */
function summarizeValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 2) {
    if (Array.isArray(value)) return { type: "array", length: value.length };
    if (typeof value === "object") {
      return { type: "object", keys: Object.keys(value).slice(0, 20) };
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => summarizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 24);
    for (const key of keys) {
      // Skip huge nested blobs; keep pointers
      if (key === "html" || key === "pdfText" || key === "text" || key === "content") {
        const raw = value[key];
        out[key] =
          typeof raw === "string"
            ? { length: raw.length, preview: raw.slice(0, 120) }
            : summarizeValue(raw, depth + 1);
        continue;
      }
      out[key] = summarizeValue(value[key], depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * @param {*} confidence
 * @returns {{ score: number|null, level: string|null, raw: * }}
 */
function normalizeConfidence(confidence) {
  if (confidence == null) {
    return { score: null, level: null, raw: null };
  }
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    const score = confidence > 1 ? round2(confidence / 100) : round2(confidence);
    let level = "unknown";
    if (score >= 0.75) level = "high";
    else if (score >= 0.45) level = "medium";
    else level = "low";
    return { score, level, raw: confidence };
  }
  if (typeof confidence === "object") {
    const score =
      typeof confidence.score === "number"
        ? confidence.score > 1
          ? round2(confidence.score / 100)
          : round2(confidence.score)
        : typeof confidence.overall === "number"
          ? confidence.overall > 1
            ? round2(confidence.overall / 100)
            : round2(confidence.overall)
          : typeof confidence.value === "number"
            ? confidence.value > 1
              ? round2(confidence.value / 100)
              : round2(confidence.value)
            : confidence.overall && typeof confidence.overall.score === "number"
              ? confidence.overall.score > 1
                ? round2(confidence.overall.score / 100)
                : round2(confidence.overall.score)
              : null;
    let level =
      confidence.level ||
      confidence.band ||
      (confidence.overall && confidence.overall.level) ||
      null;
    if (typeof level === "string") {
      level = level.toLowerCase().replace(/very_/, "");
      if (level === "very_low") level = "low";
    }
    if (!level) {
      level =
        score == null
          ? null
          : score >= 0.75
            ? "high"
            : score >= 0.45
              ? "medium"
              : "low";
    }
    return { score, level, raw: confidence };
  }
  if (typeof confidence === "string") {
    return {
      score: null,
      level: confidence.toLowerCase().replace(/very_/, ""),
      raw: confidence
    };
  }
  return { score: null, level: null, raw: confidence };
}

/**
 * Capture process memory when available (Node). Returns null outside Node.
 * @returns {number|null}
 */
function sampleHeapUsed() {
  try {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
  } catch (_err) {
    /* ignore */
  }
  return null;
}

module.exports = {
  buildStageDiagnostic,
  summarizeValue,
  normalizeConfidence,
  sampleHeapUsed
};
