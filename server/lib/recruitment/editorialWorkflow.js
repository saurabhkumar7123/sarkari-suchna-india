"use strict";

/**
 * Package 4C — Human editorial workflow state machine.
 *
 * Controlled transitions for recruitment ↔ draft review.
 * Manual decisions only. No automation, publishing, or queue workers.
 */

const WORKFLOW_STATES = Object.freeze({
  DRAFT_CREATED: "draft_created",
  DRAFT_ATTACHED: "draft_attached",
  REVIEW_PENDING: "review_pending",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REJECTED: "rejected"
});

const WORKFLOW_STATE_VALUES = Object.freeze(Object.values(WORKFLOW_STATES));

const WORKFLOW_DECISIONS = Object.freeze({
  SUBMIT_FOR_REVIEW: "submit_for_review",
  START_REVIEW: "start_review",
  APPROVE: "approve",
  REQUEST_CHANGES: "request_changes",
  REJECT: "reject",
  RETURN_TO_DRAFT: "return_to_draft",
  REOPEN_REVIEW: "reopen_review"
});

const WORKFLOW_DECISION_VALUES = Object.freeze(Object.values(WORKFLOW_DECISIONS));

const BINDING_STATUSES = Object.freeze({
  NO_DRAFT: "no_draft",
  DRAFT_ATTACHED: "draft_attached",
  DRAFT_READY: "draft_ready",
  REVIEW_REQUIRED: "review_required",
  APPROVED: "approved"
});

const BINDING_STATUS_LABELS = Object.freeze({
  [BINDING_STATUSES.NO_DRAFT]: "No Draft",
  [BINDING_STATUSES.DRAFT_ATTACHED]: "Draft Attached",
  [BINDING_STATUSES.DRAFT_READY]: "Draft Ready",
  [BINDING_STATUSES.REVIEW_REQUIRED]: "Review Required",
  [BINDING_STATUSES.APPROVED]: "Approved"
});

const WORKFLOW_STATE_LABELS = Object.freeze({
  [WORKFLOW_STATES.DRAFT_CREATED]: "Draft Created",
  [WORKFLOW_STATES.DRAFT_ATTACHED]: "Draft Attached",
  [WORKFLOW_STATES.REVIEW_PENDING]: "Review Pending",
  [WORKFLOW_STATES.IN_REVIEW]: "In Review",
  [WORKFLOW_STATES.APPROVED]: "Approved",
  [WORKFLOW_STATES.CHANGES_REQUESTED]: "Changes Requested",
  [WORKFLOW_STATES.REJECTED]: "Rejected"
});

/**
 * fromState → decision → toState
 */
const TRANSITION_TABLE = Object.freeze({
  [WORKFLOW_STATES.DRAFT_CREATED]: Object.freeze({
    // Attach is handled by binding service (moves to draft_attached).
  }),
  [WORKFLOW_STATES.DRAFT_ATTACHED]: Object.freeze({
    [WORKFLOW_DECISIONS.SUBMIT_FOR_REVIEW]: WORKFLOW_STATES.REVIEW_PENDING
  }),
  [WORKFLOW_STATES.REVIEW_PENDING]: Object.freeze({
    [WORKFLOW_DECISIONS.START_REVIEW]: WORKFLOW_STATES.IN_REVIEW,
    [WORKFLOW_DECISIONS.RETURN_TO_DRAFT]: WORKFLOW_STATES.DRAFT_ATTACHED
  }),
  [WORKFLOW_STATES.IN_REVIEW]: Object.freeze({
    [WORKFLOW_DECISIONS.APPROVE]: WORKFLOW_STATES.APPROVED,
    [WORKFLOW_DECISIONS.REQUEST_CHANGES]: WORKFLOW_STATES.CHANGES_REQUESTED,
    [WORKFLOW_DECISIONS.REJECT]: WORKFLOW_STATES.REJECTED,
    [WORKFLOW_DECISIONS.RETURN_TO_DRAFT]: WORKFLOW_STATES.DRAFT_ATTACHED
  }),
  [WORKFLOW_STATES.APPROVED]: Object.freeze({
    [WORKFLOW_DECISIONS.REOPEN_REVIEW]: WORKFLOW_STATES.REVIEW_PENDING
  }),
  [WORKFLOW_STATES.CHANGES_REQUESTED]: Object.freeze({
    [WORKFLOW_DECISIONS.RETURN_TO_DRAFT]: WORKFLOW_STATES.DRAFT_ATTACHED,
    [WORKFLOW_DECISIONS.REOPEN_REVIEW]: WORKFLOW_STATES.REVIEW_PENDING,
    [WORKFLOW_DECISIONS.SUBMIT_FOR_REVIEW]: WORKFLOW_STATES.REVIEW_PENDING
  }),
  [WORKFLOW_STATES.REJECTED]: Object.freeze({
    [WORKFLOW_DECISIONS.RETURN_TO_DRAFT]: WORKFLOW_STATES.DRAFT_ATTACHED,
    [WORKFLOW_DECISIONS.REOPEN_REVIEW]: WORKFLOW_STATES.REVIEW_PENDING
  })
});

function normalizeState(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return WORKFLOW_STATE_VALUES.includes(text) ? text : null;
}

function normalizeDecision(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return WORKFLOW_DECISION_VALUES.includes(text) ? text : null;
}

function listAllowedDecisions(fromState) {
  const state = normalizeState(fromState);
  if (!state) return [];
  const row = TRANSITION_TABLE[state] || {};
  return Object.keys(row).sort((a, b) => a.localeCompare(b));
}

function isTransitionAllowed(fromState, decision) {
  const state = normalizeState(fromState);
  const action = normalizeDecision(decision);
  if (!state || !action) return false;
  const row = TRANSITION_TABLE[state];
  return Boolean(row && Object.prototype.hasOwnProperty.call(row, action));
}

function resolveTransition(fromState, decision) {
  const state = normalizeState(fromState);
  const action = normalizeDecision(decision);
  if (!state) {
    return {
      allowed: false,
      fromState: null,
      toState: null,
      decision: action,
      error: "Invalid workflow state"
    };
  }
  if (!action) {
    return {
      allowed: false,
      fromState: state,
      toState: null,
      decision: null,
      error: "Invalid review decision"
    };
  }
  const row = TRANSITION_TABLE[state] || {};
  if (!Object.prototype.hasOwnProperty.call(row, action)) {
    return {
      allowed: false,
      fromState: state,
      toState: null,
      decision: action,
      error: `Transition not allowed: ${state} + ${action}`
    };
  }
  return {
    allowed: true,
    fromState: state,
    toState: row[action],
    decision: action,
    error: null
  };
}

/**
 * Derive operator-facing binding status from draft presence + workflow state.
 */
function deriveBindingStatus({ draftCount = 0, workflowState = null } = {}) {
  const count = Number(draftCount) || 0;
  if (count <= 0) {
    return BINDING_STATUSES.NO_DRAFT;
  }

  const state = normalizeState(workflowState) || WORKFLOW_STATES.DRAFT_ATTACHED;

  if (state === WORKFLOW_STATES.APPROVED) {
    return BINDING_STATUSES.APPROVED;
  }
  if (
    state === WORKFLOW_STATES.REVIEW_PENDING ||
    state === WORKFLOW_STATES.IN_REVIEW ||
    state === WORKFLOW_STATES.CHANGES_REQUESTED
  ) {
    return BINDING_STATUSES.REVIEW_REQUIRED;
  }
  if (state === WORKFLOW_STATES.DRAFT_ATTACHED) {
    return BINDING_STATUSES.DRAFT_READY;
  }
  if (state === WORKFLOW_STATES.DRAFT_CREATED || state === WORKFLOW_STATES.REJECTED) {
    return BINDING_STATUSES.DRAFT_ATTACHED;
  }
  return BINDING_STATUSES.DRAFT_ATTACHED;
}

function bindingStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  return BINDING_STATUS_LABELS[key] || BINDING_STATUS_LABELS[BINDING_STATUSES.NO_DRAFT];
}

function workflowStateLabel(state) {
  const key = normalizeState(state);
  return key ? WORKFLOW_STATE_LABELS[key] : "Unknown";
}

/**
 * Build a lightweight validation summary comparing recruitment fields to draft payload.
 */
function buildValidationSummary({ recruitment = null, draft = null } = {}) {
  const checks = [];
  const rec = recruitment && typeof recruitment === "object" ? recruitment : null;
  const payload =
    draft && draft.payload && typeof draft.payload === "object" ? draft.payload : {};
  const draftTitle = String(draft?.title || payload.title || "").trim();
  const draftBody = String(payload.data || payload.content || payload.text || "").trim();

  checks.push({
    id: "recruitment_present",
    label: "Recruitment record loaded",
    ok: Boolean(rec && rec.id),
    detail: rec ? `#${rec.id} ${rec.title || ""}`.trim() : "Missing recruitment"
  });
  checks.push({
    id: "draft_present",
    label: "Draft linked",
    ok: Boolean(draft && draft.id),
    detail: draft ? `#${draft.id} ${draftTitle || draft.title || ""}`.trim() : "No draft"
  });
  checks.push({
    id: "draft_title",
    label: "Draft has title",
    ok: draftTitle.length >= 3,
    detail: draftTitle ? draftTitle.slice(0, 80) : "Title too short or missing"
  });
  checks.push({
    id: "draft_body",
    label: "Draft has body content",
    ok: draftBody.length >= 20,
    detail: draftBody ? `${draftBody.length} characters` : "Body too short or missing"
  });

  if (rec && draftTitle) {
    const titleOverlap =
      draftTitle.toLowerCase().includes(String(rec.title || "").toLowerCase().slice(0, 12)) ||
      String(rec.title || "")
        .toLowerCase()
        .includes(draftTitle.toLowerCase().slice(0, 12));
    checks.push({
      id: "title_alignment",
      label: "Title aligns with recruitment",
      ok: titleOverlap || !rec.title,
      detail: titleOverlap ? "Titles appear related" : "Titles differ — review manually"
    });
  }

  if (rec && rec.slug) {
    const slugHint = String(draft?.slug_hint || payload.pageUrl || payload.slug || "")
      .replace(/^\//, "")
      .replace(/\.html$/i, "");
    checks.push({
      id: "slug_hint",
      label: "Slug hint present",
      ok: Boolean(slugHint),
      detail: slugHint || "No slug hint on draft"
    });
  }

  const failed = checks.filter((c) => !c.ok).length;
  return {
    ok: failed === 0,
    total: checks.length,
    passed: checks.length - failed,
    failed,
    checks
  };
}

module.exports = {
  WORKFLOW_STATES,
  WORKFLOW_STATE_VALUES,
  WORKFLOW_DECISIONS,
  WORKFLOW_DECISION_VALUES,
  BINDING_STATUSES,
  BINDING_STATUS_LABELS,
  WORKFLOW_STATE_LABELS,
  TRANSITION_TABLE,
  normalizeState,
  normalizeDecision,
  listAllowedDecisions,
  isTransitionAllowed,
  resolveTransition,
  deriveBindingStatus,
  bindingStatusLabel,
  workflowStateLabel,
  buildValidationSummary
};
