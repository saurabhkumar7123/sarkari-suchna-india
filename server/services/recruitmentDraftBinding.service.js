"use strict";

/**
 * Package 4C — Recruitment ↔ Generator draft binding.
 *
 * Attach / detach / replace using existing generator_drafts linkage columns.
 * No SQL schema redesign. No publishing. No automation.
 */

const generatorDraftRepository = require("../repositories/generatorDraft.repository");
const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const editorialReviewRepository = require("../repositories/editorialReview.repository");
const {
  WORKFLOW_STATES,
  deriveBindingStatus,
  bindingStatusLabel,
  workflowStateLabel,
  normalizeState
} = require("../lib/recruitment/editorialWorkflow");
const { isGeneratorDraftsEnabled } = require("../config/generatorDrafts");

function assertDraftsEnabled() {
  if (!isGeneratorDraftsEnabled()) {
    const err = new Error("Generator drafts are disabled (GENERATOR_DRAFTS_ENABLED=0)");
    err.statusCode = 503;
    throw err;
  }
}

async function assertTablesReady() {
  const ok = await generatorDraftRepository.tableExists();
  if (!ok) {
    const err = new Error(
      "generator_drafts table is missing. Run db/migrations/2026-06-27-generator-drafts.sql"
    );
    err.statusCode = 503;
    throw err;
  }
  const linkage = await generatorDraftRepository.linkageColumnsExist();
  if (!linkage) {
    const err = new Error(
      "generator_drafts recruitment linkage columns are missing. Run db/migrations/2026-07-13-add-generator-drafts-recruitment-linkage.sql"
    );
    err.statusCode = 503;
    throw err;
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

async function assertRecruitment(recruitmentId) {
  const recruitment = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!recruitment) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitment;
}

async function assertDraftForBinding(draftId) {
  const draft = await generatorDraftRepository.findById(draftId);
  if (!draft) {
    const err = new Error("Draft not found");
    err.statusCode = 404;
    throw err;
  }
  if (draft.status !== "draft") {
    const err = new Error("Only unpublished drafts can be bound");
    err.statusCode = 400;
    throw err;
  }
  return draft;
}

async function assertEventBelongs(recruitmentEventId, recruitmentId) {
  if (recruitmentEventId == null) return null;
  const event = await recruitmentEventRepository.getRecruitmentEventById(recruitmentEventId);
  if (!event) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  if (Number(event.recruitment_id) !== Number(recruitmentId)) {
    const err = new Error("recruitment_event_id does not belong to recruitment_id");
    err.statusCode = 400;
    throw err;
  }
  return event;
}

function summarizeDraft(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    slugHint: row.slug_hint || null,
    status: row.status,
    recruitmentId: row.recruitment_id != null ? Number(row.recruitment_id) : null,
    recruitmentEventId: row.recruitment_event_id != null ? Number(row.recruitment_event_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ensureReviewRecord(recruitmentId, { draftId = null, operator = null } = {}) {
  const existing = editorialReviewRepository.getReviewByRecruitmentId(recruitmentId);
  if (existing) {
    return existing;
  }
  return editorialReviewRepository.upsertReview(recruitmentId, {
    draftId,
    workflowState: draftId ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED,
    updatedBy: operator || null,
    notes: [],
    decisionHistory: []
  });
}

async function getBinding(recruitmentId) {
  assertDraftsEnabled();
  await assertTablesReady();
  const id = parsePositiveId(recruitmentId, "recruitment id");
  const recruitment = await assertRecruitment(id);
  const drafts = await generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: id,
    limit: 50
  });
  let review = editorialReviewRepository.getReviewByRecruitmentId(id);
  if (!review) {
    review = {
      recruitmentId: id,
      draftId: drafts[0] ? Number(drafts[0].id) : null,
      workflowState: drafts.length
        ? WORKFLOW_STATES.DRAFT_ATTACHED
        : WORKFLOW_STATES.DRAFT_CREATED,
      notes: [],
      decisionHistory: [],
      createdAt: null,
      updatedAt: null,
      updatedBy: null
    };
  } else if (drafts.length === 0 && review.draftId) {
    review = editorialReviewRepository.upsertReview(id, {
      draftId: null,
      workflowState: WORKFLOW_STATES.DRAFT_CREATED
    });
  } else if (
    review.draftId &&
    !drafts.some((d) => Number(d.id) === Number(review.draftId)) &&
    drafts[0]
  ) {
    review = editorialReviewRepository.upsertReview(id, {
      draftId: Number(drafts[0].id)
    });
  }

  const workflowState =
    normalizeState(review.workflowState) ||
    (drafts.length ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED);
  const bindingStatus = deriveBindingStatus({
    draftCount: drafts.length,
    workflowState
  });
  const primaryDraft =
    drafts.find((d) => Number(d.id) === Number(review.draftId)) || drafts[0] || null;

  return {
    recruitment: {
      id: recruitment.id,
      title: recruitment.title,
      slug: recruitment.slug,
      department: recruitment.department,
      lifecycle_state: recruitment.lifecycle_state
    },
    drafts: drafts.map(summarizeDraft),
    primaryDraftId: primaryDraft ? Number(primaryDraft.id) : null,
    bindingStatus,
    bindingStatusLabel: bindingStatusLabel(bindingStatus),
    workflowState,
    workflowStateLabel: workflowStateLabel(workflowState),
    review: {
      draftId: review.draftId,
      updatedAt: review.updatedAt,
      updatedBy: review.updatedBy,
      notesCount: Array.isArray(review.notes) ? review.notes.length : 0,
      decisionCount: Array.isArray(review.decisionHistory)
        ? review.decisionHistory.length
        : 0
    }
  };
}

async function attachDraft(recruitmentId, { draftId, recruitmentEventId = null, operator = null } = {}) {
  assertDraftsEnabled();
  await assertTablesReady();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  const did = parsePositiveId(draftId, "draft_id");
  await assertRecruitment(rid);
  const draft = await assertDraftForBinding(did);

  let eventId = null;
  if (recruitmentEventId != null && recruitmentEventId !== "") {
    eventId = parsePositiveId(recruitmentEventId, "recruitment_event_id");
    await assertEventBelongs(eventId, rid);
  }

  if (draft.recruitment_id != null && Number(draft.recruitment_id) !== rid) {
    const err = new Error(
      `Draft is already attached to recruitment #${draft.recruitment_id}. Detach it first or use replace.`
    );
    err.statusCode = 409;
    throw err;
  }

  const ok = await generatorDraftRepository.updateDraftLinkage(did, {
    recruitmentId: rid,
    recruitmentEventId: eventId
  });
  if (!ok) {
    const err = new Error("Draft could not be attached");
    err.statusCode = 409;
    throw err;
  }

  const existing = editorialReviewRepository.getReviewByRecruitmentId(rid);
  const nextState =
    existing &&
    normalizeState(existing.workflowState) &&
    normalizeState(existing.workflowState) !== WORKFLOW_STATES.DRAFT_CREATED
      ? normalizeState(existing.workflowState)
      : WORKFLOW_STATES.DRAFT_ATTACHED;

  editorialReviewRepository.upsertReview(rid, {
    draftId: did,
    workflowState: nextState === WORKFLOW_STATES.DRAFT_CREATED ? WORKFLOW_STATES.DRAFT_ATTACHED : nextState,
    updatedBy: operator || null
  });

  return getBinding(rid);
}

async function detachDraft(recruitmentId, { draftId = null, operator = null } = {}) {
  assertDraftsEnabled();
  await assertTablesReady();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  await assertRecruitment(rid);

  const drafts = await generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: rid,
    limit: 50
  });
  if (!drafts.length) {
    const err = new Error("No drafts attached to this recruitment");
    err.statusCode = 400;
    throw err;
  }

  let targetId = draftId != null ? parsePositiveId(draftId, "draft_id") : null;
  if (targetId == null) {
    const review = editorialReviewRepository.getReviewByRecruitmentId(rid);
    targetId = review?.draftId ? Number(review.draftId) : Number(drafts[0].id);
  }

  const target = drafts.find((d) => Number(d.id) === targetId);
  if (!target) {
    const err = new Error("Draft is not attached to this recruitment");
    err.statusCode = 400;
    throw err;
  }

  const ok = await generatorDraftRepository.updateDraftLinkage(targetId, {
    recruitmentId: null,
    recruitmentEventId: null
  });
  if (!ok) {
    const err = new Error("Draft could not be detached");
    err.statusCode = 409;
    throw err;
  }

  const remaining = drafts.filter((d) => Number(d.id) !== targetId);
  if (remaining.length === 0) {
    editorialReviewRepository.upsertReview(rid, {
      draftId: null,
      workflowState: WORKFLOW_STATES.DRAFT_CREATED,
      updatedBy: operator || null
    });
  } else {
    editorialReviewRepository.upsertReview(rid, {
      draftId: Number(remaining[0].id),
      workflowState: WORKFLOW_STATES.DRAFT_ATTACHED,
      updatedBy: operator || null
    });
  }

  return getBinding(rid);
}

async function replaceDraft(
  recruitmentId,
  { draftId, previousDraftId = null, recruitmentEventId = null, operator = null } = {}
) {
  assertDraftsEnabled();
  await assertTablesReady();
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  const nextDraftId = parsePositiveId(draftId, "draft_id");
  await assertRecruitment(rid);
  await assertDraftForBinding(nextDraftId);

  const bound = await generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: rid,
    limit: 50
  });
  const review = ensureReviewRecord(rid, { operator });
  const detachId =
    previousDraftId != null
      ? parsePositiveId(previousDraftId, "previous_draft_id")
      : review.draftId
        ? Number(review.draftId)
        : bound[0]
          ? Number(bound[0].id)
          : null;

  if (detachId != null && detachId !== nextDraftId) {
    const stillBound = bound.find((d) => Number(d.id) === detachId);
    if (stillBound) {
      await generatorDraftRepository.updateDraftLinkage(detachId, {
        recruitmentId: null,
        recruitmentEventId: null
      });
    }
  }

  return attachDraft(rid, { draftId: nextDraftId, recruitmentEventId, operator });
}

async function listAvailableDrafts(query = {}) {
  assertDraftsEnabled();
  await assertTablesReady();
  const rows = await generatorDraftRepository.listUnboundDrafts({ limit: query.limit });
  return rows.map(summarizeDraft);
}

module.exports = {
  getBinding,
  attachDraft,
  detachDraft,
  replaceDraft,
  listAvailableDrafts,
  summarizeDraft
};
