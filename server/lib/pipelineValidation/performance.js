"use strict";

/**
 * Phase AI-5 — Performance measurement helpers.
 *
 * Measures extraction / classification / matching / editorial / total latency
 * and optional memory deltas. Advisory only.
 */

const { deepFreeze, round2 } = require("../noticeIntelligence/textUtils");
const { PIPELINE_STAGES } = require("./types");
const { sampleHeapUsed } = require("./diagnostics");

/**
 * @returns {{ mark: Function, measure: Function, snapshot: Function }}
 */
function createPerformanceTracker() {
  const marks = Object.create(null);
  const measures = Object.create(null);
  const memoryMarks = Object.create(null);

  function mark(name) {
    marks[name] = Date.now();
    memoryMarks[name] = sampleHeapUsed();
    return marks[name];
  }

  function measure(name, startMark, endMark) {
    const start = marks[startMark];
    const end = endMark ? marks[endMark] : Date.now();
    const durationMs = start == null ? 0 : Math.max(0, end - start);
    const memStart = memoryMarks[startMark];
    const memEnd = endMark ? memoryMarks[endMark] : sampleHeapUsed();
    const memoryDeltaBytes =
      memStart != null && memEnd != null ? memEnd - memStart : null;
    measures[name] = { durationMs, memoryDeltaBytes };
    return measures[name];
  }

  function snapshot() {
    return deepFreeze({ ...measures });
  }

  return { mark, measure, snapshot, marks, measures };
}

/**
 * Build a performance summary from stage diagnostics.
 * @param {object[]} stageDiagnostics
 * @param {number} totalDurationMs
 * @returns {object}
 */
function buildPerformanceSummary(stageDiagnostics = [], totalDurationMs = 0) {
  const byStage = Object.create(null);
  for (const diag of stageDiagnostics) {
    if (!diag || !diag.stageId) continue;
    byStage[diag.stageId] = {
      durationMs: diag.durationMs || 0,
      memoryDeltaBytes: diag.memoryDeltaBytes
    };
  }

  const extraction =
    (byStage[PIPELINE_STAGES.PDF_HTML_EXTRACTION] &&
      byStage[PIPELINE_STAGES.PDF_HTML_EXTRACTION].durationMs) ||
    0;
  const classification =
    (byStage[PIPELINE_STAGES.NOTICE_INTELLIGENCE] &&
      byStage[PIPELINE_STAGES.NOTICE_INTELLIGENCE].durationMs) ||
    0;
  const matching =
    (byStage[PIPELINE_STAGES.RECRUITMENT_MATCHING] &&
      byStage[PIPELINE_STAGES.RECRUITMENT_MATCHING].durationMs) ||
    0;
  const editorial =
    (byStage[PIPELINE_STAGES.EDITORIAL_INTELLIGENCE] &&
      byStage[PIPELINE_STAGES.EDITORIAL_INTELLIGENCE].durationMs) ||
    0;

  const memorySamples = stageDiagnostics
    .map((d) => d && d.memoryDeltaBytes)
    .filter((n) => typeof n === "number");

  const peakMemoryDeltaBytes =
    memorySamples.length > 0 ? Math.max(...memorySamples.map((n) => Math.abs(n))) : null;

  return deepFreeze({
    extractionTimeMs: extraction,
    classificationTimeMs: classification,
    matchingTimeMs: matching,
    editorialAnalysisTimeMs: editorial,
    totalPipelineLatencyMs: totalDurationMs,
    peakMemoryDeltaBytes,
    byStage,
    bottlenecks: identifyBottlenecks(byStage, totalDurationMs)
  });
}

/**
 * @param {object} byStage
 * @param {number} totalMs
 * @returns {object[]}
 */
function identifyBottlenecks(byStage, totalMs) {
  const entries = Object.entries(byStage || {})
    .map(([stageId, info]) => ({
      stageId,
      durationMs: (info && info.durationMs) || 0,
      share:
        totalMs > 0 ? round2(((info && info.durationMs) || 0) / totalMs) : 0
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  return entries
    .filter((e) => e.durationMs > 0 && (e.share >= 0.25 || e.durationMs >= 50))
    .slice(0, 3);
}

/**
 * Aggregate performance across many pipeline runs.
 * @param {object[]} runSummaries
 * @returns {object}
 */
function aggregatePerformance(runSummaries = []) {
  const n = runSummaries.length || 1;
  const sum = {
    extractionTimeMs: 0,
    classificationTimeMs: 0,
    matchingTimeMs: 0,
    editorialAnalysisTimeMs: 0,
    totalPipelineLatencyMs: 0
  };
  let maxTotal = 0;
  let minTotal = Infinity;
  let peakMemory = null;

  for (const s of runSummaries) {
    if (!s) continue;
    sum.extractionTimeMs += s.extractionTimeMs || 0;
    sum.classificationTimeMs += s.classificationTimeMs || 0;
    sum.matchingTimeMs += s.matchingTimeMs || 0;
    sum.editorialAnalysisTimeMs += s.editorialAnalysisTimeMs || 0;
    sum.totalPipelineLatencyMs += s.totalPipelineLatencyMs || 0;
    maxTotal = Math.max(maxTotal, s.totalPipelineLatencyMs || 0);
    minTotal = Math.min(minTotal, s.totalPipelineLatencyMs || 0);
    if (typeof s.peakMemoryDeltaBytes === "number") {
      peakMemory =
        peakMemory == null
          ? s.peakMemoryDeltaBytes
          : Math.max(peakMemory, s.peakMemoryDeltaBytes);
    }
  }

  const count = runSummaries.length;
  if (count === 0) minTotal = 0;

  return deepFreeze({
    sampleCount: count,
    averages: {
      extractionTimeMs: round2(sum.extractionTimeMs / n),
      classificationTimeMs: round2(sum.classificationTimeMs / n),
      matchingTimeMs: round2(sum.matchingTimeMs / n),
      editorialAnalysisTimeMs: round2(sum.editorialAnalysisTimeMs / n),
      totalPipelineLatencyMs: round2(sum.totalPipelineLatencyMs / n)
    },
    minTotalPipelineLatencyMs: count ? minTotal : 0,
    maxTotalPipelineLatencyMs: maxTotal,
    peakMemoryDeltaBytes: peakMemory
  });
}

module.exports = {
  createPerformanceTracker,
  buildPerformanceSummary,
  identifyBottlenecks,
  aggregatePerformance
};
