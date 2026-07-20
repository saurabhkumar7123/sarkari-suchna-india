"use strict";

/**
 * AMP-4B — Unified Production Runtime.
 *
 * Converts advisory detection output into persisted enterprise records:
 * Detection → Brain → History Recovery → Validation → Persistence → Review → Audit → Metrics → Telegram
 *
 * Publishing remains manual. AUTO_PUBLISH_ENABLED must stay false.
 */

const logger = require("../../../utils/logger");
const { getAutomationFlags } = require("../../../config/automationFlags");
const { isRecruitmentPipelineEnabled } = require("../../../config/recruitmentPipeline");
const { runRecruitmentPipeline } = require("../runRecruitmentPipeline");
const { runProductionAutomationWorkflow } = require("../automationWorkflow");
const { defaultService } = require("../../../services/enterprise/enterprisePersistence.service");
const recruitmentReviewService = require("../../../services/recruitmentReview.service");
const generatorDraftService = require("../../../services/generatorDraft.service");
const recruitmentService = require("../../../services/recruitment.service");
const notificationGateway = require("../../enterprise/notificationGateway");
const { METRIC_TYPES } = require("../../../repositories/enterprise/metricsEnterprise.repository");

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqueSlug(base, suffix) {
  const root = slugify(base) || "recruitment";
  const tail = suffix != null ? `-${String(suffix)}` : "";
  return `${root}${tail}`.slice(0, 160);
}

function isProductionRuntimeEnabled() {
  const flags = getAutomationFlags();
  return (
    isRecruitmentPipelineEnabled() &&
    flags.RECRUITMENT_PIPELINE_ENABLED === true &&
    flags.PRODUCTION_MONITORING_ENABLED === true
  );
}

async function resolveRecruitmentRecord({
  pipelineOutcome,
  workflowResult,
  notice,
  candidateRecruitments
}) {
  const detection = pipelineOutcome.skipped || pipelineOutcome.failed ? null : pipelineOutcome.result;
  const recruitmentObject = workflowResult?.recruitmentObject || {};
  const matched = detection?.selectedRecruitment || candidateRecruitments?.[0] || null;

  if (matched && matched.id) {
    await defaultService.recruitment.upsertExtended(matched.id, {
      timeline: workflowResult?.intelligenceResult?.timeline?.timeline || [],
      confidence: workflowResult?.intelligenceResult?.confidence || {},
      validation: workflowResult?.validation || {},
      missing_information: workflowResult?.intelligenceResult?.missingResult?.missingInformation || { items: [] },
      history_recovery: workflowResult?.historyRecovery || {},
      current_stage: recruitmentObject.currentStage || detection?.eventType || null,
      metadata: {
        updateId: pipelineOutcome.updateId,
        sourceUrl: notice?.url || null
      }
    });
    return { recruitmentId: matched.id, created: false, row: matched };
  }

  const title =
    collapseWhitespace(recruitmentObject.recruitmentName) ||
    collapseWhitespace(notice?.title) ||
    "Detected recruitment";
  const slug = uniqueSlug(title, pipelineOutcome.updateId || Date.now());
  const created = await recruitmentService.createRecruitment({
    title,
    slug,
    department: recruitmentObject.department || null,
    post_name: recruitmentObject.postName || null,
    advertisement_no: recruitmentObject.advertisementNo || null,
    cycle_year: recruitmentObject.cycleYear || null,
    lifecycle_state: recruitmentObject.currentStage || "detected"
  });

  await defaultService.recruitment.upsertExtended(created.id, {
    timeline: workflowResult?.intelligenceResult?.timeline?.timeline || [],
    confidence: workflowResult?.intelligenceResult?.confidence || {},
    validation: workflowResult?.validation || {},
    missing_information: workflowResult?.intelligenceResult?.missingResult?.missingInformation || { items: [] },
    history_recovery: workflowResult?.historyRecovery || {},
    current_stage: recruitmentObject.currentStage || "detected",
    metadata: {
      updateId: pipelineOutcome.updateId,
      sourceUrl: notice?.url || null
    }
  });

  return { recruitmentId: created.id, created: true, row: created };
}

async function persistDraft({ flags, workflowResult, recruitmentId, recruitmentEventId }) {
  if (flags.AUTO_DRAFT_ENABLED !== true) {
    return { skipped: true, reason: "auto_draft_disabled" };
  }

  const payload =
    workflowResult?.generatorPayload ||
    workflowResult?.draftPackage?.generatorPayload ||
    workflowResult?.draftCoordination?.draftPackage?.generatorPayload ||
    null;

  if (!payload || typeof payload !== "object") {
    return { skipped: true, reason: "no_draft_payload" };
  }

  const draft = await generatorDraftService.saveDraft({
    payload,
    recruitmentId,
    recruitmentEventId
  });

  await defaultService.draft.upsertExtended(draft.id, {
    generator_payload: payload,
    structured_output: workflowResult?.draftPreview || {},
    difference_report: workflowResult?.difference || { changes: [] },
    confidence: workflowResult?.intelligenceResult?.confidence || {},
    validation: workflowResult?.validation || {},
    warnings: workflowResult?.intelligenceResult?.reviewFlags || []
  });

  return { skipped: false, draftId: draft.id, draft };
}

async function persistWorkflow({ workflowResult, recruitmentId, updateId }) {
  const workflowKey = `recruitment:${recruitmentId}:update:${updateId || "unknown"}`;
  const existing = await defaultService.workflow.getByKey(workflowKey);
  const currentState = workflowResult?.workflowState || "detected";
  const failureRecovery = workflowResult?.failureRecovery || {};

  if (!existing) {
    return defaultService.workflow.createWorkflow({
      workflow_key: workflowKey,
      workflow_version: 1,
      current_state: currentState,
      retry_count: failureRecovery.retryCount || 0,
      failure_reason: failureRecovery.reason || null,
      rollback_point: failureRecovery.rollbackState || null,
      state_json: {
        recruitmentId,
        updateId,
        workflowStateMachine: workflowResult?.workflowStateMachine || null
      },
      history_json: [
        {
          state: currentState,
          at: new Date().toISOString(),
          event: "workflow_created"
        }
      ],
      started_at: new Date().toISOString()
    });
  }

  return defaultService.workflow.updateWorkflow(
    workflowKey,
    {
      current_state: currentState,
      retry_count: failureRecovery.retryCount || existing.retry_count || 0,
      failure_reason: failureRecovery.reason || existing.failure_reason,
      rollback_point: failureRecovery.rollbackState || existing.rollback_point,
      state_json: {
        ...(existing.state_json || {}),
        recruitmentId,
        updateId,
        workflowStateMachine: workflowResult?.workflowStateMachine || null
      },
      history_entry: {
        state: currentState,
        at: new Date().toISOString(),
        event: "workflow_transition"
      },
      lock_version: existing.lock_version
    },
    { changeSummary: `Transition to ${currentState}` }
  );
}

async function persistReviewQueue({ pipelineOutcome, workflowResult, recruitmentId, notice, updateId }) {
  const detection = pipelineOutcome.skipped || pipelineOutcome.failed ? null : pipelineOutcome.result;
  const reviewItem = detection?.reviewItem || {
    recruitmentId,
    eventType: detection?.eventType || "detected",
    matchResult: detection?.selectedRecruitment ? "matched" : "new",
    confidence: workflowResult?.intelligenceResult?.confidence?.level || "medium",
    sourceUrl: notice?.url || null,
    title: notice?.title || "Recruitment review"
  };

  const saved = await recruitmentReviewService.saveReviewItem({
    reviewItem,
    updateId,
    rawNotice: notice
  });

  await defaultService.reviewQueue.upsertExtended(saved.id, {
    priority: workflowResult?.reviewQueue?.priority || "normal",
    confidence_detail: workflowResult?.intelligenceResult?.confidence || {},
    risk: workflowResult?.reviewQueue?.risk || { level: "low", score: 0 },
    warnings: workflowResult?.intelligenceResult?.reviewFlags || [],
    recommendation: {
      action: "manual_review",
      rationale: workflowResult?.approvalWorkflow?.decision || "MANUAL_REVIEW_REQUIRED"
    },
    history_entry: {
      at: new Date().toISOString(),
      event: "queued_for_review"
    }
  });

  return saved;
}

async function persistAuditAndMetrics({ workflowResult, recruitmentId, draftId, reviewId, workflowKey }) {
  await defaultService.audit.recordEvent({
    category: "workflow",
    eventType: "production_runtime",
    entityType: "recruitment",
    entityId: recruitmentId,
    action: "pipeline_completed",
    actor: "siteWorker",
    detail: {
      draftId,
      reviewId,
      workflowKey,
      workflowState: workflowResult?.workflowState || null
    }
  });

  const metricDate = new Date().toISOString().slice(0, 10);
  const department =
    workflowResult?.recruitmentObject?.department ||
    workflowResult?.intelligenceResult?.recruitmentObject?.department ||
    "UNKNOWN";

  await defaultService.metrics.upsertMetric({
    metricDate,
    metricType: METRIC_TYPES.WORKFLOW,
    dimension: "department",
    dimensionValue: department,
    value: workflowResult?.metrics || { processed: 1 }
  });

  await defaultService.metrics.upsertMetric({
    metricDate,
    metricType: METRIC_TYPES.REVIEW,
    dimension: "queue",
    dimensionValue: "pending",
    value: { count: 1, reviewId }
  });
}

async function deliverTelegramReview({ flags, workflowResult }) {
  if (flags.NOTIFICATION_GATEWAY_ENABLED !== true || flags.TELEGRAM_DELIVERY_ENABLED !== true) {
    return { delivered: false, status: "disabled", reason: "notification_flags_off" };
  }

  const message =
    workflowResult?.telegramReview?.message ||
    workflowResult?.telegramReview?.text ||
    [
      "Recruitment automation review required",
      `Recruitment: ${workflowResult?.recruitmentObject?.recruitmentName || "Unknown"}`,
      `State: ${workflowResult?.workflowState || "detected"}`,
      "",
      "Manual review required — publishing remains disabled."
    ].join("\n");

  return notificationGateway.sendNotification({
    channel: notificationGateway.CHANNELS.TELEGRAM,
    payload: { message, telegramReview: workflowResult?.telegramReview || null },
    meta: { source: "productionRuntime" }
  });
}

/**
 * Execute the full production detection pipeline for a monitored update.
 */
async function runProductionDetectionPipeline({
  notice,
  updateId = null,
  candidateRecruitments = [],
  monitoredSite = null,
  lookupSummary = null
} = {}) {
  const flags = getAutomationFlags();

  if (!isProductionRuntimeEnabled()) {
    return {
      skipped: true,
      reason: "production_runtime_disabled",
      flags: {
        recruitmentPipeline: isRecruitmentPipelineEnabled(),
        recruitmentPipelineFlag: flags.RECRUITMENT_PIPELINE_ENABLED
      }
    };
  }

  const startedAt = Date.now();
  const pipelineOutcome = runRecruitmentPipeline({
    notice,
    candidateRecruitments,
    isEnabled: true,
    updateId
  });

  if (pipelineOutcome.skipped) {
    return { skipped: true, reason: pipelineOutcome.reason || "pipeline_skipped", pipelineOutcome };
  }

  if (pipelineOutcome.failed) {
    logger.warn("production-runtime: detection failed", {
      updateId,
      message: pipelineOutcome.error?.message
    });
    await defaultService.audit.recordEvent({
      category: "errors",
      eventType: "detection_failed",
      entityType: "update",
      entityId: updateId,
      action: "pipeline_detection_failed",
      actor: "siteWorker",
      status: "error",
      detail: { message: pipelineOutcome.error?.message || "unknown" }
    });
    return { skipped: false, failed: true, pipelineOutcome };
  }

  const workflowResult = await runProductionAutomationWorkflow({
    notification: notice,
    existingRecruitments: candidateRecruitments,
    sourceSearchResults: lookupSummary ? [{ summary: lookupSummary }] : [],
    updateId,
    monitoredSite
  });

  let recruitmentRecord;
  try {
    recruitmentRecord = await resolveRecruitmentRecord({
      pipelineOutcome,
      workflowResult,
      notice,
      candidateRecruitments
    });
  } catch (persistErr) {
    logger.error("production-runtime: recruitment persistence failed", {
      updateId,
      message: persistErr.message
    });
    return { skipped: false, failed: true, stage: "recruitment_persistence", error: persistErr, pipelineOutcome };
  }

  const draftResult = await persistDraft({
    flags,
    workflowResult,
    recruitmentId: recruitmentRecord.recruitmentId,
    recruitmentEventId: null
  }).catch((err) => ({ skipped: true, reason: "draft_error", error: err.message }));

  const workflowRow = await persistWorkflow({
    workflowResult,
    recruitmentId: recruitmentRecord.recruitmentId,
    updateId
  }).catch((err) => {
    logger.warn("production-runtime: workflow persistence failed", { message: err.message });
    return null;
  });

  let reviewRow = null;
  try {
    reviewRow = await persistReviewQueue({
      pipelineOutcome,
      workflowResult,
      recruitmentId: recruitmentRecord.recruitmentId,
      notice,
      updateId
    });
  } catch (reviewErr) {
    logger.warn("production-runtime: review queue persistence failed", { message: reviewErr.message });
  }

  await persistAuditAndMetrics({
    workflowResult,
    recruitmentId: recruitmentRecord.recruitmentId,
    draftId: draftResult.draftId || null,
    reviewId: reviewRow?.id || null,
    workflowKey: workflowRow?.workflow_key || null
  }).catch((err) => {
    logger.warn("production-runtime: audit/metrics persistence failed", { message: err.message });
  });

  const telegramResult = await deliverTelegramReview({ flags, workflowResult });

  return {
    skipped: false,
    success: true,
    processingTimeMs: Date.now() - startedAt,
    pipelineOutcome,
    workflowResult,
    recruitmentId: recruitmentRecord.recruitmentId,
    recruitmentCreated: recruitmentRecord.created,
    draft: draftResult,
    workflow: workflowRow,
    review: reviewRow,
    telegram: telegramResult,
    publishingBlocked: flags.AUTO_PUBLISH_ENABLED !== true
  };
}

module.exports = {
  isProductionRuntimeEnabled,
  runProductionDetectionPipeline
};
