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
const generatorDraftRepository = require("../../../repositories/generatorDraft.repository");
const notificationGateway = require("../../enterprise/notificationGateway");
const { METRIC_TYPES } = require("../../../repositories/enterprise/metricsEnterprise.repository");
const { isLifecycleEventType } = require("../recruitmentDomainModel");
const {
  mapEventStageToRecruitmentLifecycleState
} = require("./mapEventStageToLifecycleState");
const {
  downloadOfficialPdfForGeneratorExtraction
} = require("./downloadOfficialPdfForGeneratorExtraction");
const {
  convertAmpExtractedTextToPublisher,
  withConvertedPublisherData
} = require("./applyGeneratorAiConvert");

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveEventStageForPersistence(detection, recruitmentObject) {
  const candidates = [
    detection && detection.eventType,
    recruitmentObject && recruitmentObject.currentStage,
    detection && detection.reviewItem && detection.reviewItem.eventType
  ];
  const classifiedEvent = candidates.find((value) => isLifecycleEventType(value));
  if (classifiedEvent) {
    return classifiedEvent;
  }
  const first = candidates.find((value) => value != null && String(value).trim() !== "");
  return first || null;
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

  logger.info("production-runtime: no matched recruitment; continuing without fabricating one", {
    updateId: pipelineOutcome.updateId || null,
    title: notice && notice.title ? notice.title : null
  });
  return { recruitmentId: null, created: false, row: null };
}

function seedPublisherDraftPayload({ workflowResult, notice, updateId } = {}) {
  const raw =
    workflowResult?.generatorPayload ||
    workflowResult?.draftPackage?.generatorPayload ||
    workflowResult?.draftCoordination?.draftPackage?.generatorPayload ||
    null;
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const title =
    collapseWhitespace(base.title) ||
    collapseWhitespace(notice && notice.title) ||
    "Official update";
  const pageUrl =
    collapseWhitespace(base.pageUrl) ||
    collapseWhitespace(notice && (notice.pdfUrl || notice.url)) ||
    "";
  const data =
    typeof base.data === "string" && String(base.data).trim()
      ? base.data
      : `[Section: Short Information]\n${title}${pageUrl ? `\nOfficial URL: ${pageUrl}` : ""}`;
  const payload = {
    ...base,
    title,
    pageUrl,
    data
  };
  const numericUpdateId = Number(updateId);
  if (Number.isFinite(numericUpdateId) && numericUpdateId > 0) {
    payload.updateId = numericUpdateId;
  }
  return payload;
}

async function persistDraft({
  flags,
  workflowResult,
  recruitmentId,
  recruitmentEventId,
  notice = null,
  monitoredSite = null,
  updateId = null,
  requireAcceptedConvert = false
}) {
  if (flags.AUTO_DRAFT_ENABLED !== true) {
    return { skipped: true, reason: "auto_draft_disabled" };
  }

  const payload = seedPublisherDraftPayload({ workflowResult, notice, updateId });
  if (!payload.title && !payload.pageUrl) {
    return { skipped: true, reason: "no_draft_payload" };
  }

  let pdfExtraction = { ok: false, reason: "not_attempted" };
  try {
    const extracted = await downloadOfficialPdfForGeneratorExtraction({
      notice,
      payload,
      monitoredSite
    });
    pdfExtraction = {
      ok: true,
      text: extracted.text,
      extractionNote: extracted.extractionNote || undefined,
      sourceUrl: extracted.sourceUrl
    };
    logger.info("production-runtime: official PDF extracted (draft payload unchanged)", {
      textLen: String(extracted.text || "").length,
      sourceUrl: extracted.sourceUrl
    });
  } catch (err) {
    pdfExtraction = {
      ok: false,
      reason: err && err.code ? err.code : "EXTRACT_FAILED",
      message: err && err.message ? err.message : String(err)
    };
    logger.warn("production-runtime: official PDF extraction skipped; retaining sparse draft", {
      reason: pdfExtraction.reason,
      message: pdfExtraction.message
    });
  }

  let payloadForSave = payload;
  let aiConvert = { ok: false, reason: "not_attempted" };
  if (pdfExtraction.ok && pdfExtraction.text) {
    try {
      const converted = await convertAmpExtractedTextToPublisher({
        extractedText: pdfExtraction.text,
        title: payload.title,
        officialUrl: payload.pageUrl || (notice && notice.url) || pdfExtraction.sourceUrl || null
      });
      aiConvert = {
        ok: converted.accepted === true,
        reason: converted.reason,
        message: converted.message
      };
      if (converted.accepted && converted.result) {
        payloadForSave = withConvertedPublisherData(payload, converted.result);
        logger.info("production-runtime: AI Convert accepted; sparse data replaced", {
          dataLen: converted.result.length
        });
      } else {
        logger.warn("production-runtime: AI Convert rejected; retaining sparse draft", {
          reason: converted.reason
        });
      }
    } catch (err) {
      aiConvert = {
        ok: false,
        reason: "convert_failed",
        message: err && err.message ? err.message : String(err)
      };
      logger.warn("production-runtime: AI Convert threw; retaining sparse draft", {
        message: aiConvert.message
      });
    }
  }

  if (requireAcceptedConvert && (!pdfExtraction.ok || aiConvert.ok !== true)) {
    return {
      skipped: true,
      reason: pdfExtraction.ok ? aiConvert.reason || "conversion_not_accepted" : pdfExtraction.reason || "extraction_failed",
      pdfExtraction,
      aiConvert
    };
  }

  let existingDraftId;
  const numericUpdateId = Number(updateId != null ? updateId : payload.updateId);
  if (
    Number.isFinite(numericUpdateId) &&
    numericUpdateId > 0 &&
    typeof generatorDraftService.findUnpublishedDraftByUpdateId === "function"
  ) {
    try {
      const existingByUpdate = await generatorDraftService.findUnpublishedDraftByUpdateId(numericUpdateId);
      if (existingByUpdate && existingByUpdate.id && String(existingByUpdate.status) === "draft") {
        existingDraftId = existingByUpdate.id;
      }
    } catch (err) {
      logger.warn("production-runtime: update-keyed draft lookup failed; continuing", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }
  if (
    existingDraftId == null &&
    recruitmentId &&
    typeof generatorDraftService.listDraftsByRecruitmentId === "function"
  ) {
    try {
      const rows = await generatorDraftService.listDraftsByRecruitmentId(recruitmentId, { limit: 10 });
      const existing = Array.isArray(rows)
        ? rows.find((row) => row && String(row.status) === "draft" && row.id)
        : null;
      if (existing) existingDraftId = existing.id;
    } catch (err) {
      logger.warn("production-runtime: existing draft lookup failed; inserting new draft", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  let draft = await generatorDraftService.saveDraft({
    id: existingDraftId,
    payload: payloadForSave,
    recruitmentId,
    recruitmentEventId
  });

  if (
    recruitmentId &&
    (draft.recruitment_id == null || Number(draft.recruitment_id) !== Number(recruitmentId))
  ) {
    try {
      await generatorDraftRepository.updateDraftLinkage(draft.id, {
        recruitmentId,
        recruitmentEventId
      });
      const rebound = await generatorDraftService.getDraftById(draft.id);
      if (rebound) draft = rebound;
    } catch (err) {
      logger.warn("production-runtime: draft recruitment binding failed", {
        draftId: draft.id,
        message: err.message
      });
    }
  }

  await defaultService.draft.upsertExtended(draft.id, {
    generator_payload: payloadForSave,
    structured_output: workflowResult?.draftPreview || {},
    difference_report: workflowResult?.difference || { changes: [] },
    confidence: workflowResult?.intelligenceResult?.confidence || {},
    validation: workflowResult?.validation || {},
    warnings: workflowResult?.intelligenceResult?.reviewFlags || []
  });

  return { skipped: false, draftId: draft.id, draft, pdfExtraction, aiConvert, reused: Boolean(existingDraftId) };
}

async function persistWorkflow({ workflowResult, recruitmentId, updateId }) {
  const recruitmentKey = recruitmentId != null ? recruitmentId : "none";
  const workflowKey = `recruitment:${recruitmentKey}:update:${updateId || "unknown"}`;
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

function buildBoundReviewItem({ detection, workflowResult, recruitmentId, notice }) {
  const detectedItem =
    detection && detection.reviewItem && typeof detection.reviewItem === "object"
      ? detection.reviewItem
      : {};
  return {
    ...detectedItem,
    recruitmentId:
      detectedItem.recruitmentId ||
      detectedItem.recruitment_id ||
      recruitmentId ||
      null,
    eventType: detectedItem.eventType || detection?.eventType || "notification",
    matchResult:
      detectedItem.matchResult &&
      typeof detectedItem.matchResult === "object" &&
      !Array.isArray(detectedItem.matchResult)
        ? detectedItem.matchResult
        : null,
    confidence:
      detectedItem.confidence ||
      workflowResult?.intelligenceResult?.confidence?.level ||
      "medium",
    sourceUrl: detectedItem.sourceUrl || detectedItem.source_url || notice?.url || null,
    title: detectedItem.title || notice?.title || "Recruitment review"
  };
}

async function persistReviewQueue({
  pipelineOutcome,
  workflowResult,
  recruitmentId,
  notice,
  updateId,
  draftId = null
}) {
  const detection = pipelineOutcome.skipped || pipelineOutcome.failed ? null : pipelineOutcome.result;
  const reviewItem = buildBoundReviewItem({
    detection,
    workflowResult,
    recruitmentId,
    notice
  });

  if (typeof recruitmentReviewService.getReviewItemByUpdateId === "function" && updateId) {
    try {
      const existingByUpdate = await recruitmentReviewService.getReviewItemByUpdateId(updateId);
      if (existingByUpdate && existingByUpdate.id) {
        return { ...existingByUpdate, reused: true };
      }
    } catch (err) {
      logger.warn("production-runtime: update-keyed review lookup failed; continuing", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  if (typeof recruitmentReviewService.listReviewItems === "function" && (recruitmentId || updateId)) {
    try {
      const listed = await recruitmentReviewService.listReviewItems({
        recruitment_id: recruitmentId,
        status: "pending",
        page: 1,
        limit: 50
      });
      const rows = listed && Array.isArray(listed.data) ? listed.data : [];
      const existing = rows.find((row) => {
        if (!row) return false;
        const rowUpdate = row.update_id != null ? row.update_id : row.updateId;
        if (updateId != null && rowUpdate != null) {
          return Number(rowUpdate) === Number(updateId);
        }
        return false;
      });
      if (existing && existing.id) {
        return { ...existing, reused: true };
      }
    } catch (err) {
      logger.warn("production-runtime: existing review lookup failed; inserting new review", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  const saved = await recruitmentReviewService.saveReviewItem({
    reviewItem,
    updateId,
    rawNotice: notice,
    processorOutput: draftId ? { draftId } : null
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

  return { ...saved, reused: false };
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

function asPlainTelegramText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatTelegramReviewMessage({
  workflowResult,
  notice,
  recruitmentId,
  draftId,
  reviewId
} = {}) {
  const review = workflowResult?.telegramReview || {};
  const base =
    asPlainTelegramText(review.text) ||
    asPlainTelegramText(review.message) ||
    [
      "Recruitment automation review required",
      `Recruitment: ${workflowResult?.recruitmentObject?.recruitmentName || notice?.title || "Unknown"}`,
      `State: ${workflowResult?.workflowState || "detected"}`,
      "Manual review required — publishing remains disabled."
    ].join("\n");

  const extras = [
    notice?.title ? `Update: ${notice.title}` : "",
    recruitmentId ? `Recruitment id: ${recruitmentId}` : "",
    draftId ? `Draft id: ${draftId}` : "",
    reviewId ? `Review item id: ${reviewId}` : "",
    "AUTO_PUBLISH remains disabled."
  ].filter(Boolean);

  return `${base}\n${extras.join("\n")}`.trim();
}

async function deliverTelegramReview({
  flags,
  workflowResult,
  notice,
  recruitmentId,
  draftId,
  reviewId
}) {
  if (flags.NOTIFICATION_GATEWAY_ENABLED !== true || flags.TELEGRAM_DELIVERY_ENABLED !== true) {
    return { delivered: false, status: "disabled", reason: "notification_flags_off" };
  }

  const message = formatTelegramReviewMessage({
    workflowResult,
    notice,
    recruitmentId,
    draftId,
    reviewId
  });

  return notificationGateway.sendNotification({
    channel: notificationGateway.CHANNELS.TELEGRAM,
    payload: { message },
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
    recruitmentEventId: null,
    notice,
    monitoredSite,
    updateId,
    requireAcceptedConvert: true
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
  const draftReady = Boolean(draftResult && draftResult.skipped !== true && draftResult.draftId);
  if (!draftReady) {
    logger.warn("production-runtime: review skipped because draft was not created", {
      updateId,
      draftReason: draftResult && (draftResult.reason || draftResult.error) ? draftResult.reason || draftResult.error : "draft_missing"
    });
  } else {
    try {
      reviewRow = await persistReviewQueue({
        pipelineOutcome,
        workflowResult,
        recruitmentId: recruitmentRecord.recruitmentId,
        notice,
        updateId,
        draftId: draftResult.draftId
      });
    } catch (reviewErr) {
      logger.warn("production-runtime: review queue persistence failed", { message: reviewErr.message });
    }
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

  const telegramResult = !reviewRow
    ? {
        delivered: false,
        status: "skipped",
        reason: draftReady ? "review_missing" : "draft_not_created"
      }
    : reviewRow.reused
      ? {
          delivered: false,
          status: "skipped_duplicate",
          reason: "review_reused"
        }
      : await deliverTelegramReview({
          flags,
          workflowResult,
          notice,
          recruitmentId: recruitmentRecord.recruitmentId,
          draftId: draftResult.draftId || null,
          reviewId: reviewRow.id || null
        });

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
  runProductionDetectionPipeline,
  persistDraft,
  persistReviewQueue,
  seedPublisherDraftPayload,
  mapEventStageToRecruitmentLifecycleState,
  resolveEventStageForPersistence,
  buildBoundReviewItem,
  formatTelegramReviewMessage,
  deliverTelegramReview
};
