"use strict";

/**
 * CIP Stage 2E — Compact deterministic Telegram editor notification summary.
 * Plain text only. No markdown. No publishing.
 */

function sanitizeLine(value) {
  return String(value == null ? "" : value)
    .replace(/[`*_~\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTelegramSummary(analysis, decisionSupport) {
  const topFindings = ((decisionSupport && decisionSupport.keyFindings) || [])
    .slice(0, 3)
    .map((f) => `${f.severity}:${f.code}`)
    .join("; ");

  const lines = [
    `CIP Editorial Review`,
    `Type: ${sanitizeLine(analysis.documentTypeLabel || analysis.documentType || "Unknown")}`,
    `Organization: ${sanitizeLine(analysis.organization || "N/A")}`,
    `Post: ${sanitizeLine(analysis.postHint || analysis.title || "N/A")}`,
    `Priority: ${sanitizeLine((decisionSupport && decisionSupport.reviewPriority) || "NORMAL")}`,
    `Readiness: ${sanitizeLine(
      (decisionSupport &&
        decisionSupport.publishReadiness &&
        decisionSupport.publishReadiness.status) ||
        "needs_review"
    )}`,
    `Risk: ${sanitizeLine(
      (decisionSupport && decisionSupport.editorialRisk && decisionSupport.editorialRisk.overall) ||
        "LOW"
    )}`,
    `Top findings: ${sanitizeLine(topFindings || "none")}`,
    `Manual approval required. No auto-publish.`
  ];

  return {
    text: lines.join("\n"),
    lines,
    channel: "telegram",
    markdown: false,
    publishes: false
  };
}

module.exports = { buildTelegramSummary, sanitizeLine };
