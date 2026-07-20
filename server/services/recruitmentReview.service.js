"use strict";

/**
 * Phase 27 — Recruitment review persistence service.
 * Phase 28 — Admin review queue list/detail/actions (no runtime wiring).
 * Validation + thin repository wrapper. No runtime wiring.
 */

const recruitmentReviewRepository = require("../repositories/recruitmentReview.repository");
const {
  REVIEW_STATUS,
  REVIEW_DECISIONS,
  REVIEW_STATUS_VALUES,
  resolveStatusForDecision,
  validateReviewItem,
  createReviewItem
} = require("../lib/recruitment/reviewQueue");

function assertTable() {
  return recruitmentReviewRepository.tableExists().then((ok) => {
    if (!ok) {
      const err = new Error(
        "recruitment_review_queue table is missing. Run Phase 7 + Phase 27 migrations."
      );
      err.statusCode = 503;
      throw err;
    }
  });
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildReviewItemFromSaveInput(input = {}) {
  const reviewItem = input.reviewItem && typeof input.reviewItem === "object"
    ? input.reviewItem
    : input;

  return createReviewItem({
    recruitmentId: reviewItem.recruitmentId ?? reviewItem.recruitment_id ?? null,
    eventType: reviewItem.eventType ?? reviewItem.event_type,
    matchResult: reviewItem.matchResult ?? reviewItem.match_result ?? null,
    confidence: reviewItem.confidence ?? null,
    sourceUrl: reviewItem.sourceUrl ?? reviewItem.source_url ?? null,
    title: reviewItem.title,
    createdAt: reviewItem.createdAt ?? reviewItem.created_at,
    notes: reviewItem.notes ?? null
  });
}

/**
 * Persist a review item produced by the testing dashboard.
 * @param {Object} input
 */
async function saveReviewItem(input = {}) {
  await assertTable();

  const reviewItem = buildReviewItemFromSaveInput(input);
  const validation = validateReviewItem(reviewItem);
  if (!validation.valid) {
    const err = new Error(validation.errors.join("; ") || "Validation failed");
    err.statusCode = 400;
    err.errors = validation.errors;
    throw err;
  }

  const created = await recruitmentReviewRepository.create({
    recruitment_id: reviewItem.recruitmentId,
    // Prefer camelCase; snake_case retained for API backward compatibility.
    update_id: input.updateId ?? input.update_id ?? null,
    recruitment_event_id: input.recruitmentEventId ?? input.recruitment_event_id ?? null,
    event_type: reviewItem.eventType,
    match_result: reviewItem.matchResult,
    confidence: reviewItem.confidence,
    source_url: reviewItem.sourceUrl,
    title: reviewItem.title,
    raw_notice: input.rawNotice ?? input.raw_notice ?? null,
    normalized_notice: input.normalizedNotice ?? input.normalized_notice ?? null,
    processor_output: input.processorOutput ?? input.processor_output ?? null,
    status: reviewItem.status || REVIEW_STATUS.PENDING,
    decision: reviewItem.decision || REVIEW_DECISIONS.NONE,
    notes: reviewItem.notes,
    payload: {
      reviewItem,
      finalStatus: input.finalStatus ?? input.final_status ?? null,
      warnings: input.warnings ?? null
    }
  });

  return created;
}

async function getReviewItemById(id) {
  await assertTable();
  const reviewId = parseInt(String(id), 10);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    const err = new Error("Invalid review id");
    err.statusCode = 400;
    throw err;
  }
  return recruitmentReviewRepository.findById(reviewId);
}

async function listPendingReviewItems(opts = {}) {
  await assertTable();
  return recruitmentReviewRepository.findPending(opts);
}

/**
 * Admin list with filters + pagination.
 * @param {{
 *   page?: number|string,
 *   limit?: number|string,
 *   status?: string,
 *   event_type?: string,
 *   recruitment_id?: number|string,
 *   search?: string
 * }} opts
 */
async function listReviewItems(opts = {}) {
  await assertTable();

  if (opts.status) {
    const status = collapseWhitespace(opts.status).toLowerCase();
    if (!REVIEW_STATUS_VALUES.includes(status)) {
      const err = new Error("Invalid status filter");
      err.statusCode = 400;
      throw err;
    }
    opts = { ...opts, status };
  }

  return recruitmentReviewRepository.list(opts);
}

/**
 * @param {number|string} id
 * @param {{ decision: string, notes?: string | null }} input
 */
async function updateReviewDecision(id, input = {}) {
  await assertTable();
  const reviewId = parseInt(String(id), 10);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    const err = new Error("Invalid review id");
    err.statusCode = 400;
    throw err;
  }

  const decision = collapseWhitespace(input.decision).toLowerCase();
  if (!Object.values(REVIEW_DECISIONS).includes(decision)) {
    const err = new Error("Invalid decision");
    err.statusCode = 400;
    throw err;
  }

  const existing = await recruitmentReviewRepository.findById(reviewId);
  if (!existing) {
    const err = new Error("Review item not found");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status === REVIEW_STATUS.FROZEN) {
    const err = new Error("Review item is frozen");
    err.statusCode = 409;
    throw err;
  }

  return recruitmentReviewRepository.updateDecision(reviewId, {
    decision,
    status: resolveStatusForDecision(decision),
    notes: input.notes !== undefined ? input.notes : existing.notes
  });
}

/**
 * Persist freeze for an existing review item.
 * @param {number|string} id
 */
async function freezeReviewItem(id) {
  await assertTable();
  const reviewId = parseInt(String(id), 10);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    const err = new Error("Invalid review id");
    err.statusCode = 400;
    throw err;
  }

  const existing = await recruitmentReviewRepository.findById(reviewId);
  if (!existing) {
    const err = new Error("Review item not found");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status === REVIEW_STATUS.FROZEN) {
    const err = new Error("Review item is already frozen");
    err.statusCode = 409;
    throw err;
  }

  return recruitmentReviewRepository.updateDecision(reviewId, {
    decision: existing.decision || REVIEW_DECISIONS.NONE,
    status: REVIEW_STATUS.FROZEN,
    notes: existing.notes
  });
}

/**
 * Update notes only (blocked when frozen).
 * @param {number|string} id
 * @param {{ notes?: string | null }} input
 */
async function updateReviewNotes(id, input = {}) {
  await assertTable();
  const reviewId = parseInt(String(id), 10);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    const err = new Error("Invalid review id");
    err.statusCode = 400;
    throw err;
  }

  if (input.notes === undefined) {
    const err = new Error("notes is required");
    err.statusCode = 400;
    throw err;
  }

  const notes =
    input.notes === null || input.notes === ""
      ? null
      : collapseWhitespace(input.notes);

  const existing = await recruitmentReviewRepository.findById(reviewId);
  if (!existing) {
    const err = new Error("Review item not found");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status === REVIEW_STATUS.FROZEN) {
    const err = new Error("Review item is frozen");
    err.statusCode = 409;
    throw err;
  }

  return recruitmentReviewRepository.updateDecision(reviewId, {
    decision: existing.decision || REVIEW_DECISIONS.NONE,
    status: existing.status,
    notes
  });
}

module.exports = {
  saveReviewItem,
  getReviewItemById,
  listPendingReviewItems,
  listReviewItems,
  updateReviewDecision,
  freezeReviewItem,
  updateReviewNotes
};
