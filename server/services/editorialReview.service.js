"use strict";

/**
 * Package 4C — Human editorial review workspace service.
 *
 * Manual decisions only. Validated state transitions.
 * No automatic routing, publishing, or workers.
 */

const recruitmentRepository = require("../repositories/recruitment.repository");
const generatorDraftRepository = require("../repositories/generatorDraft.repository");
const editorialReviewRepository = require("../repositories/editorialReview.repository");
const recruitmentDraftBindingService = require("./recruitmentDraftBinding.service");
const {
  WORKFLOW_STATES,
  WORKFLOW_DECISIONS,
  resolveTransition,
  listAllowedDecisions,
  deriveBindingStatus,
  bindingStatusLabel,
  workflowStateLabel,
  buildValidationSummary,
  normalizeState,
  normalizeDecision
} = require("../lib/recruitment/editorialWorkflow");
const { isGeneratorDraftsEnabled } = require("../config/generatorDrafts");
const { analyzeEditorialDraft } = require("../lib/editorialIntelligence");

/**
 * Phase PI-2 — attach AI-4 advisory report for presentation only.
 * Never mutates draft, workflow, or decisions. Failures degrade to null.
 * @param {object|null} draft
 * @returns {object|null}
 */
function buildEditorialIntelligenceForDraft(draft) {
  if (!draft) return null;
  try {
    const payload = draft.payload && typeof draft.payload === "object" ? draft.payload : {};
    const input =
      typeof payload.result === "string"
        ? payload.result
        : typeof payload.content === "string"
          ? payload.content
          : typeof payload.draftText === "string"
            ? payload.draftText
            : typeof payload.publisherText === "string"
              ? payload.publisherText
              : payload.structured || payload;
    const analysis = analyzeEditorialDraft(input, {
      title: draft.title || payload.title || null
    });
    return analysis.editorialIntelligence || null;
  } catch {
    return null;
  }
}

function parsePositiveId(value, fieldName) {
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function assertDraftsEnabled() {
  if (!isGeneratorDraftsEnabled()) {
    const err = new Error("Generator drafts are disabled (GENERATOR_DRAFTS_ENABLED=0)");
    err.statusCode = 503;
    throw err;
  }
}

function appendNote(notes, { text, operator, decision = null }) {
  const comment = String(text || "").trim();
  if (!comment && !decision) {
    return Array.isArray(notes) ? notes.slice() : [];
  }
  const entry = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: comment || null,
    decision: decision || null,
    operator: operator ? String(operator) : "admin",
    createdAt: new Date().toISOString(),
    internal: true
  };
  return [...(Array.isArray(notes) ? notes : []), entry];
}

function appendDecision(history, { decision, fromState, toState, operator, comment = null }) {
  const entry = {
    id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    decision,
    fromState,
    toState,
    operator: operator ? String(operator) : "admin",
    comment: comment ? String(comment).trim() : null,
    createdAt: new Date().toISOString()
  };
  return [...(Array.isArray(history) ? history : []), entry];
}

async function loadRecruitment(recruitmentId) {
  const recruitment = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!recruitment) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitment;
}

async function loadPrimaryDraft(recruitmentId, review) {
  const drafts = await generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: recruitmentId,
    limit: 50
  });
  if (!drafts.length) return { drafts: [], draft: null };

  let draftRow =
    (review?.draftId && drafts.find((d) => Number(d.id) === Number(review.draftId))) ||
    drafts[0];

  if (draftRow) {
    const full = await generatorDraftRepository.findById(draftRow.id);
    if (full) draftRow = full;
  }
  return { drafts, draft: draftRow };
}

function ensureReview(recruitmentId, draftId, operator) {
  const existing = editorialReviewRepository.getReviewByRecruitmentId(recruitmentId);
  if (existing) return existing;
  return editorialReviewRepository.upsertReview(recruitmentId, {
    draftId: draftId || null,
    workflowState: draftId ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED,
    updatedBy: operator || null,
    notes: [],
    decisionHistory: []
  });
}

async function getReviewWorkspace(recruitmentId) {
  assertDraftsEnabled();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  const recruitment = await loadRecruitment(rid);
  let review = editorialReviewRepository.getReviewByRecruitmentId(rid);
  const { drafts, draft } = await loadPrimaryDraft(rid, review);

  if (!review) {
    review = ensureReview(rid, draft ? Number(draft.id) : null, null);
  }

  const workflowState =
    normalizeState(review.workflowState) ||
    (drafts.length ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED);

  if (draft && Number(review.draftId) !== Number(draft.id)) {
    review = editorialReviewRepository.upsertReview(rid, {
      draftId: Number(draft.id),
      workflowState
    });
  }

  const bindingStatus = deriveBindingStatus({
    draftCount: drafts.length,
    workflowState
  });
  const validation = buildValidationSummary({ recruitment, draft });
  const allowedDecisions = listAllowedDecisions(workflowState);
  // PI-2: reuse AI-4 inside the existing workspace payload (no new endpoint).
  const editorialIntelligence = buildEditorialIntelligenceForDraft(draft);

  return {
    recruitment,
    draft: draft
      ? {
          id: Number(draft.id),
          title: draft.title,
          slugHint: draft.slug_hint || null,
          status: draft.status,
          payload: draft.payload || {},
          recruitmentId: draft.recruitment_id != null ? Number(draft.recruitment_id) : null,
          recruitmentEventId:
            draft.recruitment_event_id != null ? Number(draft.recruitment_event_id) : null,
          createdAt: draft.created_at,
          updatedAt: draft.updated_at
        }
      : null,
    drafts: drafts.map((row) => recruitmentDraftBindingService.summarizeDraft(row)),
    comparison: {
      recruitmentTitle: recruitment.title || "",
      draftTitle: draft ? String(draft.title || "") : "",
      recruitmentSlug: recruitment.slug || "",
      draftSlugHint: draft ? String(draft.slug_hint || "") : "",
      recruitmentDepartment: recruitment.department || "",
      recruitmentLifecycle: recruitment.lifecycle_state || "",
      draftStatus: draft ? draft.status : null
    },
    validation,
    editorialIntelligence,
    workflowState,
    workflowStateLabel: workflowStateLabel(workflowState),
    bindingStatus,
    bindingStatusLabel: bindingStatusLabel(bindingStatus),
    allowedDecisions,
    notes: Array.isArray(review.notes) ? review.notes : [],
    decisionHistory: Array.isArray(review.decisionHistory) ? review.decisionHistory : [],
    updatedAt: review.updatedAt || null,
    updatedBy: review.updatedBy || null
  };
}

async function applyDecision(recruitmentId, { decision, comment = null, operator = null } = {}) {
  assertDraftsEnabled();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  await loadRecruitment(rid);

  const action = normalizeDecision(decision);
  if (!action) {
    const err = new Error("Invalid review decision");
    err.statusCode = 400;
    throw err;
  }

  let review = editorialReviewRepository.getReviewByRecruitmentId(rid);
  const { drafts, draft } = await loadPrimaryDraft(rid, review);
  if (!review) {
    review = ensureReview(rid, draft ? Number(draft.id) : null, operator);
  }

  if (!drafts.length && action !== WORKFLOW_DECISIONS.REOPEN_REVIEW) {
    // Most decisions require a bound draft
    if (
      action === WORKFLOW_DECISIONS.APPROVE ||
      action === WORKFLOW_DECISIONS.REQUEST_CHANGES ||
      action === WORKFLOW_DECISIONS.REJECT ||
      action === WORKFLOW_DECISIONS.SUBMIT_FOR_REVIEW ||
      action === WORKFLOW_DECISIONS.START_REVIEW
    ) {
      const err = new Error("Attach a draft before applying this decision");
      err.statusCode = 400;
      throw err;
    }
  }

  const fromState =
    normalizeState(review.workflowState) ||
    (drafts.length ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED);

  const transition = resolveTransition(fromState, action);
  if (!transition.allowed) {
    const err = new Error(transition.error || "Invalid workflow transition");
    err.statusCode = 400;
    throw err;
  }

  const notes = appendNote(review.notes, {
    text: comment,
    operator,
    decision: action
  });
  const decisionHistory = appendDecision(review.decisionHistory, {
    decision: action,
    fromState: transition.fromState,
    toState: transition.toState,
    operator,
    comment
  });

  editorialReviewRepository.upsertReview(rid, {
    draftId: draft ? Number(draft.id) : review.draftId,
    workflowState: transition.toState,
    notes,
    decisionHistory,
    updatedBy: operator || "admin"
  });

  return getReviewWorkspace(rid);
}

async function addNote(recruitmentId, { text, operator = null } = {}) {
  assertDraftsEnabled();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  await loadRecruitment(rid);
  const comment = String(text || "").trim();
  if (!comment) {
    const err = new Error("Note text is required");
    err.statusCode = 400;
    throw err;
  }

  let review = editorialReviewRepository.getReviewByRecruitmentId(rid);
  const { draft } = await loadPrimaryDraft(rid, review);
  if (!review) {
    review = ensureReview(rid, draft ? Number(draft.id) : null, operator);
  }

  const notes = appendNote(review.notes, { text: comment, operator });
  editorialReviewRepository.upsertReview(rid, {
    notes,
    updatedBy: operator || "admin"
  });

  return getReviewWorkspace(rid);
}

async function listInbox(query = {}) {
  assertDraftsEnabled();
  const reviews = editorialReviewRepository.listReviews({
    workflowState: query.workflow_state || query.workflowState,
    limit: query.limit
  });

  const inbox = [];
  for (const review of reviews) {
    const recruitment = await recruitmentRepository.getRecruitmentById(review.recruitmentId);
    if (!recruitment) continue;
    const bindingStatus = deriveBindingStatus({
      draftCount: review.draftId ? 1 : 0,
      workflowState: review.workflowState
    });
    inbox.push({
      recruitmentId: Number(review.recruitmentId),
      recruitmentTitle: recruitment.title,
      draftId: review.draftId,
      workflowState: normalizeState(review.workflowState),
      workflowStateLabel: workflowStateLabel(review.workflowState),
      bindingStatus,
      bindingStatusLabel: bindingStatusLabel(bindingStatus),
      updatedAt: review.updatedAt,
      updatedBy: review.updatedBy,
      notesCount: Array.isArray(review.notes) ? review.notes.length : 0
    });
  }
  return inbox;
}

module.exports = {
  getReviewWorkspace,
  applyDecision,
  addNote,
  listInbox,
  WORKFLOW_DECISIONS,
  WORKFLOW_STATES
};
