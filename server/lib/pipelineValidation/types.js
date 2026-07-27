"use strict";

/**
 * Phase AI-5 — End-to-End Production Validation & Operational Readiness taxonomy.
 *
 * Advisory only. Validates the automation pipeline against representative
 * scenarios without changing Production Workflow, Generator UI, Monitoring,
 * scheduler behaviour, deployment config, database schema, or AUTO_PUBLISH.
 */

const FORMAT_ID = "pipeline_validation_report_v1";
const ENGINE_VERSION = "ai5.1.0";
const PHASE = "AI-5";

/** Ordered pipeline stages under validation (matches Phase AI-5 brief). */
const PIPELINE_STAGES = Object.freeze({
  MONITORING_INPUT: "monitoring_input",
  NOTICE_INTELLIGENCE: "notice_intelligence",
  RECRUITMENT_MATCHING: "recruitment_matching",
  PDF_HTML_EXTRACTION: "pdf_html_extraction",
  EDITORIAL_INTELLIGENCE: "editorial_intelligence",
  DRAFT_GENERATION: "draft_generation",
  TELEGRAM_PAYLOAD: "telegram_payload",
  EDITORIAL_QUEUE: "editorial_queue",
  MANUAL_PUBLISH_GATE: "manual_publish_gate"
});

const PIPELINE_STAGE_ORDER = Object.freeze([
  PIPELINE_STAGES.MONITORING_INPUT,
  PIPELINE_STAGES.NOTICE_INTELLIGENCE,
  PIPELINE_STAGES.RECRUITMENT_MATCHING,
  PIPELINE_STAGES.PDF_HTML_EXTRACTION,
  PIPELINE_STAGES.EDITORIAL_INTELLIGENCE,
  PIPELINE_STAGES.DRAFT_GENERATION,
  PIPELINE_STAGES.TELEGRAM_PAYLOAD,
  PIPELINE_STAGES.EDITORIAL_QUEUE,
  PIPELINE_STAGES.MANUAL_PUBLISH_GATE
]);

const PIPELINE_STAGE_LABELS = Object.freeze({
  [PIPELINE_STAGES.MONITORING_INPUT]: "Monitoring Input",
  [PIPELINE_STAGES.NOTICE_INTELLIGENCE]: "Notice Intelligence",
  [PIPELINE_STAGES.RECRUITMENT_MATCHING]: "Recruitment Matching",
  [PIPELINE_STAGES.PDF_HTML_EXTRACTION]: "PDF / HTML Extraction",
  [PIPELINE_STAGES.EDITORIAL_INTELLIGENCE]: "Editorial Intelligence",
  [PIPELINE_STAGES.DRAFT_GENERATION]: "Draft Generation",
  [PIPELINE_STAGES.TELEGRAM_PAYLOAD]: "Telegram Payload",
  [PIPELINE_STAGES.EDITORIAL_QUEUE]: "Editorial Queue",
  [PIPELINE_STAGES.MANUAL_PUBLISH_GATE]: "Manual Publish Gate"
});

/** Stage execution outcomes (diagnostics only). */
const STAGE_RESULT = Object.freeze({
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail",
  SKIP: "skip",
  ERROR: "error"
});

/** Scenario categories from the Phase AI-5 brief. */
const SCENARIO_KINDS = Object.freeze({
  NEW_RECRUITMENT: "new_recruitment",
  RECRUITMENT_UPDATE: "recruitment_update",
  ADMIT_CARD: "admit_card",
  RESULT: "result",
  ANSWER_KEY: "answer_key",
  CORRECTION: "correction",
  CORRIGENDUM: "corrigendum",
  EXTENSION: "extension",
  EXAM_DATE: "exam_date",
  EXAM_CITY: "exam_city",
  FINAL_RESULT: "final_result",
  DV_SCHEDULE: "dv_schedule",
  SCHOLARSHIP: "scholarship",
  ADMISSION: "admission",
  APPRENTICE: "apprentice"
});

/** Failure simulation categories. */
const FAILURE_KINDS = Object.freeze({
  MISSING_PDF: "missing_pdf",
  BROKEN_PDF: "broken_pdf",
  OCR_HEAVY_PDF: "ocr_heavy_pdf",
  INCOMPLETE_HTML: "incomplete_html",
  DUPLICATE_NOTICE: "duplicate_notice",
  UNKNOWN_ORGANIZATION: "unknown_organization",
  CONFLICTING_ADVT_NUMBER: "conflicting_advertisement_number",
  CONFLICTING_DATES: "conflicting_dates",
  MISSING_LINKS: "missing_links",
  LOW_CONFIDENCE_CLASSIFICATION: "low_confidence_classification",
  AMBIGUOUS_RECRUITMENT_MATCH: "ambiguous_recruitment_match"
});

/** Aggregate health bands. */
const HEALTH_LEVELS = Object.freeze({
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  CRITICAL: "critical",
  UNKNOWN: "unknown"
});

/** Operational readiness verdicts. */
const READINESS_VERDICTS = Object.freeze({
  READY: "ready_with_manual_review",
  READY_WITH_CAVEATS: "ready_with_caveats",
  NOT_READY: "not_ready",
  ADVISORY_ONLY: "advisory_validation_complete"
});

const CONFIDENCE_BUCKETS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

module.exports = {
  FORMAT_ID,
  ENGINE_VERSION,
  PHASE,
  PIPELINE_STAGES,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGE_LABELS,
  STAGE_RESULT,
  SCENARIO_KINDS,
  FAILURE_KINDS,
  HEALTH_LEVELS,
  READINESS_VERDICTS,
  CONFIDENCE_BUCKETS
};
