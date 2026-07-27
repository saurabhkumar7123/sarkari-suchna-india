"use strict";

/**
 * Phase AI-5 — End-to-end pipeline validation runner.
 *
 * Orchestrates existing AI-1..AI-4 engines and advisory inspections of
 * Telegram payload / Editorial Queue / Manual Publish Gate.
 *
 * Never publishes, never enables AUTO_PUBLISH, never activates the scheduler,
 * never mutates Production Workflow behaviour, never changes Generator UI.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { analyzeGovernmentNotice } = require("../noticeIntelligence/pipeline");
const { matchRecruitment } = require("../recruitmentMatching/pipeline");
const { runGeneratorIntelligencePipeline } = require("../generatorIntelligence/pipeline");
const { analyzeEditorialDraft } = require("../editorialIntelligence/pipeline");
const {
  formatTelegramMessage
} = require("../monitoringBot/telegramNotification");
const {
  evaluateManualPublishGate,
  PUBLISHING_POLICY
} = require("../productionWorkflow/publishingPolicy");
const {
  buildEditorialPackage,
  createReviewId
} = require("../productionWorkflow/editorialWorkflow/editorialPackage");
const { REVIEW_STATES } = require("../productionWorkflow/editorialWorkflow/editorialTypes");

const {
  FORMAT_ID,
  ENGINE_VERSION,
  PHASE,
  PIPELINE_STAGES,
  PIPELINE_STAGE_ORDER,
  STAGE_RESULT
} = require("./types");
const { buildStageDiagnostic, sampleHeapUsed } = require("./diagnostics");
const { buildPerformanceSummary } = require("./performance");

/**
 * Resolve raw extraction text from a monitoring event.
 * @param {object} event
 * @returns {string}
 */
function resolveExtractionText(event = {}) {
  if (typeof event.pdfText === "string" && event.pdfText.trim()) return event.pdfText;
  if (typeof event.text === "string" && event.text.trim()) return event.text;
  if (typeof event.html === "string" && event.html.trim()) {
    return event.html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

/**
 * Validate monitoring input shape without fetching.
 * @param {object} event
 * @returns {{ ok: boolean, warnings: object[], issues: object[] }}
 */
function validateMonitoringInput(event = {}) {
  const warnings = [];
  const issues = [];
  const hasContent =
    Boolean(event.html) ||
    Boolean(event.pdfText) ||
    Boolean(event.text) ||
    Boolean(event.content);

  if (!event.title && !event.sourceUrl) {
    issues.push({
      code: "MISSING_IDENTITY",
      severity: "high",
      message: "Monitoring event lacks title and sourceUrl"
    });
  }
  if (!hasContent) {
    issues.push({
      code: "MISSING_CONTENT",
      severity: "critical",
      message: "Monitoring event has no html / pdfText / text payload"
    });
  }
  if (event.contentType === "application/pdf" && !String(event.pdfText || "").trim()) {
    warnings.push({
      code: "EMPTY_PDF_TEXT",
      message: "PDF content type with empty pdfText (missing or failed extraction)"
    });
  }
  if (typeof event.html === "string" && !/<\/html>/i.test(event.html) && event.html.length < 80) {
    warnings.push({
      code: "INCOMPLETE_HTML",
      message: "HTML payload looks truncated or incomplete"
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "critical").length === 0,
    warnings,
    issues,
    hasContent,
    contentType: event.contentType || null,
    sourceUrl: event.sourceUrl || event.url || null,
    title: event.title || null
  };
}

/**
 * Run one stage with timing / memory / diagnostic capture.
 * @param {string} stageId
 * @param {Function} fn
 * @param {{ input?: *, notes?: string }} [meta]
 * @returns {{ diagnostic: object, value: *, error: Error|null }}
 */
function runTimedStage(stageId, fn, meta = {}) {
  const startedAt = Date.now();
  const memBefore = sampleHeapUsed();
  let value = null;
  let error = null;
  let warnings = [];
  let validationIssues = [];
  let confidence = null;
  let output = null;
  let result = STAGE_RESULT.PASS;

  try {
    value = fn();
    if (value && typeof value === "object") {
      warnings = value._warnings || value.warnings || [];
      if (!Array.isArray(warnings)) warnings = [];
      validationIssues = value._validationIssues || value.validationIssues || [];
      if (validationIssues && validationIssues.issues) {
        validationIssues = validationIssues.issues;
      }
      if (!Array.isArray(validationIssues)) validationIssues = [];
      confidence =
        value._confidence ||
        value.confidence ||
        (value.meta && value.meta.overallConfidence) ||
        null;
      output = value._output != null ? value._output : summarizeStageOutput(stageId, value);
      if (value._result) result = value._result;
    } else {
      output = value;
    }
  } catch (err) {
    error = err;
    result = STAGE_RESULT.ERROR;
    warnings = [{ code: "STAGE_EXCEPTION", message: err.message || String(err) }];
  }

  const endedAt = Date.now();
  const memAfter = sampleHeapUsed();

  const diagnostic = buildStageDiagnostic({
    stageId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    memoryDeltaBytes:
      memBefore != null && memAfter != null ? memAfter - memBefore : null,
    input: meta.input,
    output,
    warnings,
    validationIssues,
    confidence,
    result,
    error,
    notes: meta.notes || null
  });

  return { diagnostic, value, error };
}

/**
 * @param {string} stageId
 * @param {object} value
 * @returns {object}
 */
function summarizeStageOutput(stageId, value) {
  switch (stageId) {
    case PIPELINE_STAGES.NOTICE_INTELLIGENCE:
      return {
        eventType: value.normalizedEvent && value.normalizedEvent.eventType,
        priority: value.priority && value.priority.level,
        confidence: value.confidence && (value.confidence.level || value.confidence.score)
      };
    case PIPELINE_STAGES.RECRUITMENT_MATCHING:
      return {
        action: value.recommendation && value.recommendation.recommendation,
        matchedId:
          value.recommendation &&
          value.recommendation.bestMatch &&
          value.recommendation.bestMatch.recruitmentId,
        relationship:
          value.relationship &&
          (value.relationship.relationship || value.relationship.type)
      };
    case PIPELINE_STAGES.PDF_HTML_EXTRACTION:
      return {
        sectionCount: value.meta && value.meta.sectionCount,
        overallConfidence: value.meta && value.meta.overallConfidence,
        publisherLength: value.result ? String(value.result).length : 0
      };
    case PIPELINE_STAGES.EDITORIAL_INTELLIGENCE:
      return {
        overall: readEditorialOverall(value.qualityScores),
        suggestionCount: (value.editorSuggestions || []).length,
        profile: value.draft && value.draft.profile
      };
    case PIPELINE_STAGES.TELEGRAM_PAYLOAD:
      return {
        kind: value.kind,
        textLength: value.text ? value.text.length : 0,
        formatting: value.formatting
      };
    case PIPELINE_STAGES.MANUAL_PUBLISH_GATE:
      return {
        allowed: value.allowed,
        published: value.published,
        reason: value.reason,
        autoPublishEnabled:
          value.policy && value.policy.AUTO_PUBLISH_ENABLED
      };
    default:
      return {
        keys: Object.keys(value || {}).slice(0, 12)
      };
  }
}

/**
 * @param {object|null} qualityScores
 * @returns {number|null}
 */
function readEditorialOverall(qualityScores) {
  if (!qualityScores) return null;
  if (typeof qualityScores.overall === "number") return qualityScores.overall;
  if (qualityScores.overall && typeof qualityScores.overall.score === "number") {
    return qualityScores.overall.score;
  }
  return null;
}

/**
 * Build a lightweight advisory draft package shape (no store / no publish).
 * @param {object} parts
 * @returns {object}
 */
function buildAdvisoryDraftPackage(parts = {}) {
  return deepFreeze({
    advisoryOnly: true,
    draftType: parts.draftType || "FULL_RECRUITMENT_DRAFT",
    title: parts.title || null,
    publisherText: parts.publisherText || "",
    eventType: parts.eventType || null,
    matchedRecruitmentId: parts.matchedRecruitmentId || null,
    recommendationAction: parts.recommendationAction || null,
    sectionCount: parts.sectionCount || 0,
    generatedAt: parts.generatedAt || new Date().toISOString()
  });
}

/**
 * Run the full advisory validation pipeline for one scenario / failure case.
 *
 * @param {object} scenario fixture from tests/fixtures/ai5/scenarios.js
 * @param {{
 *   now?: Date,
 *   priorFingerprint?: string|null,
 *   confirmManualPublish?: boolean
 * }} [options]
 * @returns {object}
 */
function validatePipeline(scenario, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const pipelineStarted = Date.now();
  const event = scenario.event && typeof scenario.event === "object" ? scenario.event : {};
  const recruitments = Array.isArray(scenario.recruitments) ? scenario.recruitments : [];
  const stages = [];
  const artifacts = {
    monitoring: null,
    noticeIntelligence: null,
    recruitmentMatching: null,
    extraction: null,
    editorialIntelligence: null,
    draftPackage: null,
    telegram: null,
    editorialQueue: null,
    manualPublishGate: null
  };

  // 1. Monitoring Input
  const monitoring = runTimedStage(
    PIPELINE_STAGES.MONITORING_INPUT,
    () => {
      const check = validateMonitoringInput(event);
      return {
        ...check,
        _output: check,
        _warnings: check.warnings,
        _validationIssues: check.issues,
        _confidence: check.ok ? 1 : 0.2,
        _result: check.ok
          ? check.warnings.length
            ? STAGE_RESULT.WARN
            : STAGE_RESULT.PASS
          : STAGE_RESULT.FAIL
      };
    },
    { input: { title: event.title, sourceUrl: event.sourceUrl, contentType: event.contentType } }
  );
  stages.push(monitoring.diagnostic);
  artifacts.monitoring = monitoring.value;

  // 2. Notice Intelligence (AI-2)
  const notice = runTimedStage(
    PIPELINE_STAGES.NOTICE_INTELLIGENCE,
    () => {
      const result = analyzeGovernmentNotice(event, { now });
      const warnings = [];
      const issues = (result.validation && result.validation.issues) || [];
      const conf = result.confidence || {};
      const level = (conf.level || "").toLowerCase();
      if (level === "low" || (typeof conf.score === "number" && conf.score < 0.45)) {
        warnings.push({
          code: "LOW_CLASSIFICATION_CONFIDENCE",
          message: "Notice classification confidence is low"
        });
      }
      if (
        result.normalizedEvent &&
        result.normalizedEvent.eventType === "unknown"
      ) {
        warnings.push({
          code: "UNKNOWN_EVENT_TYPE",
          message: "Event classified as unknown"
        });
      }
      const fp =
        result.fingerprint &&
        (result.fingerprint.fingerprint || result.fingerprint.hash);
      if (options.priorFingerprint && fp && fp === options.priorFingerprint) {
        warnings.push({
          code: "DUPLICATE_FINGERPRINT",
          message: "Fingerprint matches a prior notice (duplicate candidate)"
        });
      }
      return {
        ...result,
        _warnings: warnings,
        _validationIssues: issues,
        _confidence: conf,
        _result: warnings.length ? STAGE_RESULT.WARN : STAGE_RESULT.PASS
      };
    },
    { input: { title: event.title, sourceUrl: event.sourceUrl } }
  );
  stages.push(notice.diagnostic);
  artifacts.noticeIntelligence = notice.value;

  const normalizedEvent =
    notice.value && notice.value.normalizedEvent ? notice.value.normalizedEvent : null;

  // 3. Recruitment Matching (AI-3)
  const matching = runTimedStage(
    PIPELINE_STAGES.RECRUITMENT_MATCHING,
    () => {
      const input = normalizedEvent || event;
      const result = matchRecruitment(input, recruitments, { now });
      const warnings = [];
      const issues = (result.validation && result.validation.issues) || [];
      const action =
        result.recommendation && result.recommendation.recommendation;
      const ranked = (result.ranking && result.ranking.ranked) || [];
      if (
        ranked.length >= 2 &&
        ranked[0] &&
        ranked[1] &&
        Math.abs((ranked[0].score || 0) - (ranked[1].score || 0)) < 0.08
      ) {
        warnings.push({
          code: "AMBIGUOUS_MATCH",
          message: "Top recruitment candidates are nearly tied"
        });
      }
      if (
        action &&
        /human_review|manual|ambiguous|uncertain|possible_duplicate/i.test(
          String(action)
        )
      ) {
        warnings.push({
          code: "MANUAL_REVIEW_RECOMMENDED",
          message: `Matcher recommends ${action}`
        });
      }
      return {
        ...result,
        _warnings: warnings,
        _validationIssues: issues,
        _confidence: result.confidence,
        _result: warnings.length ? STAGE_RESULT.WARN : STAGE_RESULT.PASS
      };
    },
    {
      input: {
        eventType: normalizedEvent && normalizedEvent.eventType,
        repositorySize: recruitments.length
      }
    }
  );
  stages.push(matching.diagnostic);
  artifacts.recruitmentMatching = matching.value;

  // 4. PDF / HTML Extraction (AI-1)
  const extractionText = resolveExtractionText(event);
  const extraction = runTimedStage(
    PIPELINE_STAGES.PDF_HTML_EXTRACTION,
    () => {
      const warnings = [];
      if (!extractionText) {
        warnings.push({
          code: "MISSING_EXTRACTION_TEXT",
          message: "No extractable PDF/HTML text available"
        });
        return {
          result: "",
          structured: null,
          validation: { ok: false, overallConfidence: 0, issues: ["missing_text"] },
          meta: { sectionCount: 0, overallConfidence: 0 },
          _warnings: warnings,
          _validationIssues: [{ code: "MISSING_TEXT", severity: "critical", message: "Empty extraction input" }],
          _confidence: 0,
          _result: STAGE_RESULT.FAIL
        };
      }
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(extractionText) || /endstream/i.test(extractionText)) {
        warnings.push({
          code: "BROKEN_PDF_ARTIFACTS",
          message: "Extraction text contains binary/corrupt PDF artifacts"
        });
      }
      const result = runGeneratorIntelligencePipeline(extractionText, {
        sourceName: event.sourceUrl || scenario.id || "ai5"
      });
      const conf = (result.meta && result.meta.overallConfidence) || 0;
      if (conf < 0.4) {
        warnings.push({
          code: "LOW_EXTRACTION_CONFIDENCE",
          message: "Generator intelligence overall confidence is low"
        });
      }
      if ((result.meta && result.meta.sectionCount) === 0) {
        warnings.push({
          code: "NO_SECTIONS_DETECTED",
          message: "No structured sections detected from extraction text"
        });
      }
      return {
        ...result,
        _warnings: warnings,
        _validationIssues: (result.validation && result.validation.issues) || [],
        _confidence: conf,
        _result: warnings.some((w) => w.code === "BROKEN_PDF_ARTIFACTS")
          ? STAGE_RESULT.WARN
          : warnings.length
            ? STAGE_RESULT.WARN
            : STAGE_RESULT.PASS
      };
    },
    { input: { textLength: extractionText.length, contentType: event.contentType } }
  );
  stages.push(extraction.diagnostic);
  artifacts.extraction = extraction.value;

  // 5. Editorial Intelligence (AI-4)
  const draftInput =
    scenario.draftText ||
    (extraction.value && extraction.value.result) ||
    extractionText ||
    event.title ||
    "";
  const editorial = runTimedStage(
    PIPELINE_STAGES.EDITORIAL_INTELLIGENCE,
    () => {
      const result = analyzeEditorialDraft(draftInput, {
        now,
        profile: scenario.draftProfile,
        eventType:
          (normalizedEvent && normalizedEvent.eventType) || scenario.expectedEventType,
        title: event.title,
        noticeIntelligence: normalizedEvent,
        recruitmentMatching:
          matching.value && matching.value.recommendation
            ? matching.value.recommendation
            : null
      });
      const warnings = [];
      const overall = readEditorialOverall(result.qualityScores);
      if (typeof overall === "number" && overall < 55) {
        warnings.push({
          code: "LOW_EDITORIAL_QUALITY",
          message: `Editorial overall quality score is ${overall}`
        });
      }
      const missingCritical = (
        (result.missingInformation && result.missingInformation.items) ||
        []
      ).filter(
        (m) => m && (m.severity === "Critical" || m.severity === "critical")
      );
      if (missingCritical.length) {
        warnings.push({
          code: "CRITICAL_MISSING_INFO",
          message: `${missingCritical.length} critical missing information item(s)`
        });
      }
      return {
        ...result,
        _warnings: warnings,
        _validationIssues:
          (result.validationIssues && result.validationIssues.issues) || [],
        _confidence: result.confidence,
        _result: warnings.length ? STAGE_RESULT.WARN : STAGE_RESULT.PASS
      };
    },
    {
      input: {
        profile: scenario.draftProfile,
        draftLength: String(draftInput).length
      }
    }
  );
  stages.push(editorial.diagnostic);
  artifacts.editorialIntelligence = editorial.value;

  // 6. Draft Generation (advisory package — no Generator UI / no persist)
  const draftGen = runTimedStage(
    PIPELINE_STAGES.DRAFT_GENERATION,
    () => {
      const publisherText =
        (extraction.value && extraction.value.result) ||
        scenario.draftText ||
        "";
      const pkg = buildAdvisoryDraftPackage({
        title: event.title,
        publisherText,
        eventType: normalizedEvent && normalizedEvent.eventType,
        matchedRecruitmentId:
          matching.value &&
          matching.value.recommendation &&
          matching.value.recommendation.bestMatch &&
          matching.value.recommendation.bestMatch.recruitmentId,
        recommendationAction:
          matching.value &&
          matching.value.recommendation &&
          matching.value.recommendation.recommendation,
        sectionCount:
          (extraction.value && extraction.value.meta && extraction.value.meta.sectionCount) ||
          (editorial.value && editorial.value.draft && editorial.value.draft.sections
            ? editorial.value.draft.sections.length
            : 0),
        generatedAt: now.toISOString()
      });
      const warnings = [];
      if (!publisherText) {
        warnings.push({
          code: "EMPTY_DRAFT",
          message: "Draft generation produced empty publisher text"
        });
      }
      return {
        draftPackage: pkg,
        _output: pkg,
        _warnings: warnings,
        _confidence: publisherText ? 0.8 : 0.2,
        _result: warnings.length ? STAGE_RESULT.WARN : STAGE_RESULT.PASS
      };
    },
    { input: { hasExtraction: Boolean(extraction.value && extraction.value.result) } }
  );
  stages.push(draftGen.diagnostic);
  artifacts.draftPackage = draftGen.value && draftGen.value.draftPackage;

  // 7. Telegram Payload (format only — no delivery)
  const telegram = runTimedStage(
    PIPELINE_STAGES.TELEGRAM_PAYLOAD,
    () => {
      const conf =
        (normalizedEvent &&
          normalizedEvent.confidence &&
          (normalizedEvent.confidence.score || normalizedEvent.confidence.value)) ||
        (notice.value && notice.value.confidence && notice.value.confidence.score) ||
        0.5;
      const formatted = formatTelegramMessage({
        kind: "SUCCESS",
        title: event.title,
        recruitmentTitle: event.title,
        department:
          (normalizedEvent &&
            normalizedEvent.department &&
            (normalizedEvent.department.name || normalizedEvent.department.label)) ||
          "Unknown Department",
        source: event.sourceUrl || "UNKNOWN",
        confidence: conf,
        detectionTime: now.toISOString(),
        reviewIdentifier: scenario.id || "AI5_REVIEW",
        summary:
          (normalizedEvent && normalizedEvent.eventType) ||
          scenario.kind ||
          "Advisory recruitment candidate",
        officialUrl: event.sourceUrl
      });
      return {
        ...formatted,
        _output: {
          kind: formatted.kind,
          textLength: formatted.text.length,
          delivery: "not_attempted",
          advisoryOnly: true
        },
        _confidence: 1,
        _warnings: [],
        _result: STAGE_RESULT.PASS
      };
    },
    {
      input: { title: event.title },
      notes: "format only — delivery not attempted (AI-5 advisory)"
    }
  );
  stages.push(telegram.diagnostic);
  artifacts.telegram = telegram.value;

  // 8. Editorial Queue (inspect package build — no review actions / no publish)
  const editorialQueue = runTimedStage(
    PIPELINE_STAGES.EDITORIAL_QUEUE,
    () => {
      const draftPackage = artifacts.draftPackage;
      const workflowId = `ai5_${scenario.id || "scenario"}`;
      const draftId = `ai5_draft_${scenario.id || "x"}`;
      const reviewId = createReviewId({
        workflowId,
        draftId,
        recruitmentId: draftPackage && draftPackage.matchedRecruitmentId
      });
      let pkg = null;
      try {
        pkg = buildEditorialPackage({
          workflowId,
          draftPackage: {
            draftId,
            workflowId,
            draftType: draftPackage && draftPackage.draftType,
            publisherText: draftPackage && draftPackage.publisherText,
            title: draftPackage && draftPackage.title,
            recruitmentId: draftPackage && draftPackage.matchedRecruitmentId,
            validationSummary: { ok: true },
            editorialNotes: []
          },
          generatorContract: null,
          validationSummary: { ok: true },
          editorialNotes: [],
          existingPageMetadata: null,
          reviewState: REVIEW_STATES.QUEUED
        });
      } catch (_err) {
        pkg = deepFreeze({
          advisoryOnly: true,
          reviewId,
          reviewState: REVIEW_STATES.QUEUED,
          queueReady: Boolean(draftPackage && draftPackage.publisherText),
          note: "Lightweight advisory queue record (full package shape unavailable)"
        });
      }
      return {
        editorialPackage: pkg,
        reviewState: (pkg && pkg.reviewState) || REVIEW_STATES.QUEUED,
        _output: {
          reviewId: (pkg && pkg.reviewId) || reviewId,
          reviewState: (pkg && pkg.reviewState) || REVIEW_STATES.QUEUED,
          queueReady: true,
          actionsApplied: false
        },
        _confidence: 1,
        _warnings: [],
        _result: STAGE_RESULT.PASS
      };
    },
    { notes: "package inspect only — no reviewAction / no publish" }
  );
  stages.push(editorialQueue.diagnostic);
  artifacts.editorialQueue = editorialQueue.value;

  // 9. Manual Publish Gate (confirm=false — must not publish)
  const publishGate = runTimedStage(
    PIPELINE_STAGES.MANUAL_PUBLISH_GATE,
    () => {
      const gate = evaluateManualPublishGate({
        confirmManualPublish: options.confirmManualPublish === true,
        readyForReview: true
      });
      const warnings = [];
      if (gate.published === true) {
        warnings.push({
          code: "UNEXPECTED_PUBLISH",
          message: "Manual publish gate reported published=true during validation"
        });
      }
      if (PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED !== false) {
        warnings.push({
          code: "AUTO_PUBLISH_NOT_FALSE",
          message: "AUTO_PUBLISH_ENABLED policy is not false"
        });
      }
      return {
        ...gate,
        _output: {
          allowed: gate.allowed,
          published: gate.published,
          reason: gate.reason,
          autoPublishEnabled: PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED
        },
        _warnings: warnings,
        _confidence: 1,
        _result:
          gate.published === true || PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED === true
            ? STAGE_RESULT.FAIL
            : STAGE_RESULT.PASS
      };
    },
    {
      input: { confirmManualPublish: options.confirmManualPublish === true },
      notes: "gate evaluation only — publishing engine not invoked"
    }
  );
  stages.push(publishGate.diagnostic);
  artifacts.manualPublishGate = publishGate.value;

  const totalDurationMs = Date.now() - pipelineStarted;
  const performance = buildPerformanceSummary(stages, totalDurationMs);

  const stageCounts = {
    pass: stages.filter((s) => s.executionResult === STAGE_RESULT.PASS).length,
    warn: stages.filter((s) => s.executionResult === STAGE_RESULT.WARN).length,
    fail: stages.filter((s) => s.executionResult === STAGE_RESULT.FAIL).length,
    error: stages.filter((s) => s.executionResult === STAGE_RESULT.ERROR).length,
    skip: stages.filter((s) => s.executionResult === STAGE_RESULT.SKIP).length,
    total: stages.length
  };

  const pipelineOk = stageCounts.error === 0 && stageCounts.fail === 0;

  return deepFreeze({
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    advisoryOnly: true,
    appliesChanges: false,
    published: false,
    autoPublishEnabled: PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED,
    schedulerActivated: false,
    scenario: {
      id: scenario.id || null,
      kind: scenario.kind || null,
      label: scenario.label || null,
      expectedEventType: scenario.expectedEventType || null
    },
    observed: {
      eventType: normalizedEvent && normalizedEvent.eventType,
      recommendationAction:
        matching.value &&
        matching.value.recommendation &&
        matching.value.recommendation.recommendation,
      editorialOverall: readEditorialOverall(
        editorial.value && editorial.value.qualityScores
      ),
      fingerprint:
        notice.value &&
        notice.value.fingerprint &&
        (notice.value.fingerprint.fingerprint || notice.value.fingerprint.hash)
    },
    stages,
    stageOrder: PIPELINE_STAGE_ORDER.slice(),
    stageCounts,
    pipelineOk,
    performance,
    artifacts: {
      monitoring: artifacts.monitoring,
      noticeEventType: normalizedEvent && normalizedEvent.eventType,
      noticeConfidence: notice.value && notice.value.confidence,
      recommendation: matching.value && matching.value.recommendation,
      extractionMeta: extraction.value && extraction.value.meta,
      editorialSummary: editorial.value && editorial.value.editorSummary,
      draftPackage: artifacts.draftPackage,
      telegramText:
        artifacts.telegram && artifacts.telegram.text
          ? artifacts.telegram.text.slice(0, 500)
          : null,
      editorialQueue: artifacts.editorialQueue && {
        reviewState:
          artifacts.editorialQueue.reviewState ||
          (artifacts.editorialQueue._output &&
            artifacts.editorialQueue._output.reviewState),
        actionsApplied: false
      },
      manualPublishGate: artifacts.manualPublishGate && {
        allowed: artifacts.manualPublishGate.allowed,
        published: artifacts.manualPublishGate.published,
        reason: artifacts.manualPublishGate.reason
      }
    },
    generatedAt: now.toISOString(),
    durationMs: totalDurationMs
  });
}

/**
 * Validate a single named stage in isolation (smoke diagnostic).
 * @param {string} stageId
 * @param {object} scenario
 * @param {object} [options]
 * @returns {object}
 */
function validateStage(stageId, scenario, options = {}) {
  const full = validatePipeline(scenario, options);
  const stage = full.stages.find((s) => s.stageId === stageId) || null;
  return deepFreeze({
    formatId: FORMAT_ID,
    phase: PHASE,
    advisoryOnly: true,
    stageId,
    diagnostic: stage,
    scenario: full.scenario
  });
}

module.exports = {
  resolveExtractionText,
  validateMonitoringInput,
  validatePipeline,
  validateStage,
  buildAdvisoryDraftPackage,
  readEditorialOverall,
  runTimedStage
};
