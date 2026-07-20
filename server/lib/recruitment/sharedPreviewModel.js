"use strict";

/**
 * Package 4D — Shared preview snapshot model.
 *
 * Pure, deterministic snapshot construction and advisory integrity
 * validation for the shared recruitment editorial preview.
 *
 * Read-oriented: no persistence, no publishing, no automation.
 * The same aggregated state always produces the same snapshot version.
 */

const crypto = require("crypto");
const {
  WORKFLOW_STATES,
  normalizeState,
  listAllowedDecisions,
  deriveBindingStatus,
  bindingStatusLabel,
  workflowStateLabel,
  buildValidationSummary
} = require("./editorialWorkflow");

const SHARED_PREVIEW_SCHEMA_VERSION = 1;

/** Workflow states that only make sense while a draft is bound. */
const DRAFT_REQUIRED_STATES = Object.freeze([
  WORKFLOW_STATES.REVIEW_PENDING,
  WORKFLOW_STATES.IN_REVIEW,
  WORKFLOW_STATES.APPROVED,
  WORKFLOW_STATES.CHANGES_REQUESTED
]);

const INTEGRITY_ISSUE_CODES = Object.freeze({
  MISSING_DRAFT: "missing_draft",
  BROKEN_LINK: "broken_link",
  INVALID_REVIEW_STATE: "invalid_review_state",
  INCOMPLETE_METADATA: "incomplete_metadata",
  ORPHAN_EVENT: "orphan_event"
});

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonical JSON: object keys sorted recursively so hashing is stable
 * regardless of property insertion order.
 */
function canonicalSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`);
  return `{${parts.join(",")}}`;
}

/**
 * Deterministic snapshot version derived from the snapshot content
 * (timestamps excluded). Same state → same version.
 */
function computeSnapshotVersion(content) {
  const hash = crypto
    .createHash("sha256")
    .update(canonicalSerialize(content))
    .digest("hex");
  return `v${SHARED_PREVIEW_SCHEMA_VERSION}-${hash.slice(0, 16)}`;
}

function summarizeRecruitment(recruitment) {
  if (!recruitment || typeof recruitment !== "object") return null;
  return {
    id: toNumberOrNull(recruitment.id),
    title: recruitment.title != null ? String(recruitment.title) : null,
    slug: recruitment.slug != null ? String(recruitment.slug) : null,
    department: recruitment.department != null ? String(recruitment.department) : null,
    postName: recruitment.post_name != null ? String(recruitment.post_name) : null,
    advertisementNo:
      recruitment.advertisement_no != null ? String(recruitment.advertisement_no) : null,
    cycleYear: toNumberOrNull(recruitment.cycle_year),
    lifecycleState:
      recruitment.lifecycle_state != null ? String(recruitment.lifecycle_state) : null,
    createdAt: recruitment.created_at != null ? String(recruitment.created_at) : null,
    updatedAt: recruitment.updated_at != null ? String(recruitment.updated_at) : null
  };
}

function summarizeEvents(events) {
  const rows = (Array.isArray(events) ? events : [])
    .map((event) => ({
      id: toNumberOrNull(event.id),
      recruitmentId: toNumberOrNull(event.recruitment_id),
      eventType: event.event_type != null ? String(event.event_type) : null,
      sequenceOrder: toNumberOrNull(event.sequence_order),
      status: event.status != null ? String(event.status) : null
    }))
    .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
  return rows;
}

function buildLifecycleSummary({ recruitment = null, events = [] } = {}) {
  const rows = summarizeEvents(events);
  const statusCounts = {};
  for (const row of rows) {
    const key = row.status || "unknown";
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  return {
    lifecycleState:
      recruitment && recruitment.lifecycle_state != null
        ? String(recruitment.lifecycle_state)
        : null,
    totalEvents: rows.length,
    statusCounts,
    events: rows.map(({ recruitmentId, ...rest }) => rest)
  };
}

function summarizeLinkedPages({ pages = [], events = [] } = {}) {
  const eventIds = new Set(
    summarizeEvents(events)
      .map((event) => event.id)
      .filter((id) => id != null)
  );
  return (Array.isArray(pages) ? pages : [])
    .map((page) => {
      const eventId = toNumberOrNull(page.recruitment_event_id);
      return {
        id: toNumberOrNull(page.id),
        slug: page.slug != null ? String(page.slug) : null,
        recruitmentEventId: eventId,
        linkStatus: eventId != null && !eventIds.has(eventId) ? "broken_event_link" : "linked"
      };
    })
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

function summarizeOperatorNotes(review) {
  const notes = review && Array.isArray(review.notes) ? review.notes : [];
  return notes.map((note) => ({
    id: note.id != null ? String(note.id) : null,
    text: note.text != null ? String(note.text) : null,
    decision: note.decision != null ? String(note.decision) : null,
    operator: note.operator != null ? String(note.operator) : null,
    createdAt: note.createdAt != null ? String(note.createdAt) : null
  }));
}

function buildReviewStatus({ review = null, draftCount = 0 } = {}) {
  const workflowState =
    normalizeState(review && review.workflowState) ||
    (draftCount > 0 ? WORKFLOW_STATES.DRAFT_ATTACHED : WORKFLOW_STATES.DRAFT_CREATED);
  const bindingStatus = deriveBindingStatus({ draftCount, workflowState });
  const history = review && Array.isArray(review.decisionHistory) ? review.decisionHistory : [];
  const last = history.length ? history[history.length - 1] : null;
  return {
    workflowState,
    workflowStateLabel: workflowStateLabel(workflowState),
    bindingStatus,
    bindingStatusLabel: bindingStatusLabel(bindingStatus),
    allowedDecisions: listAllowedDecisions(workflowState),
    decisionCount: history.length,
    lastDecision: last
      ? {
          decision: last.decision != null ? String(last.decision) : null,
          fromState: last.fromState != null ? String(last.fromState) : null,
          toState: last.toState != null ? String(last.toState) : null,
          operator: last.operator != null ? String(last.operator) : null,
          createdAt: last.createdAt != null ? String(last.createdAt) : null
        }
      : null,
    reviewDraftId: review && review.draftId != null ? Number(review.draftId) : null,
    updatedAt: review && review.updatedAt != null ? String(review.updatedAt) : null,
    updatedBy: review && review.updatedBy != null ? String(review.updatedBy) : null
  };
}

/**
 * Advisory preview integrity validation. Detection only — never corrects.
 *
 * Detects: missing draft, broken links, invalid review state,
 * incomplete metadata, orphan events.
 */
function validatePreviewIntegrity({
  recruitment = null,
  drafts = [],
  review = null,
  pages = [],
  events = []
} = {}) {
  const issues = [];
  const draftRows = Array.isArray(drafts) ? drafts : [];
  const draftIds = new Set(
    draftRows.map((draft) => toNumberOrNull(draft.id)).filter((id) => id != null)
  );

  const missingFields = [];
  if (!recruitment || !String(recruitment.title || "").trim()) missingFields.push("title");
  if (!recruitment || !String(recruitment.slug || "").trim()) missingFields.push("slug");
  if (!recruitment || !String(recruitment.lifecycle_state || "").trim()) {
    missingFields.push("lifecycle_state");
  }
  if (missingFields.length) {
    issues.push({
      code: INTEGRITY_ISSUE_CODES.INCOMPLETE_METADATA,
      severity: "warning",
      subject: "recruitment",
      message: `Recruitment metadata is incomplete: missing ${missingFields.join(", ")}`
    });
  }

  if (draftRows.length === 0) {
    issues.push({
      code: INTEGRITY_ISSUE_CODES.MISSING_DRAFT,
      severity: "warning",
      subject: "draft",
      message: "No generator draft is bound to this recruitment"
    });
  }

  const rawState = review ? review.workflowState : null;
  const workflowState = normalizeState(rawState);
  if (review && rawState != null && !workflowState) {
    issues.push({
      code: INTEGRITY_ISSUE_CODES.INVALID_REVIEW_STATE,
      severity: "error",
      subject: "review",
      message: `Review workflow state "${String(rawState)}" is not a recognized state`
    });
  }
  if (workflowState && DRAFT_REQUIRED_STATES.includes(workflowState) && draftRows.length === 0) {
    issues.push({
      code: INTEGRITY_ISSUE_CODES.INVALID_REVIEW_STATE,
      severity: "error",
      subject: "review",
      message: `Review state "${workflowState}" requires a bound draft, but none is attached`
    });
  }

  const reviewDraftId = review && review.draftId != null ? Number(review.draftId) : null;
  if (reviewDraftId != null && !draftIds.has(reviewDraftId)) {
    issues.push({
      code: INTEGRITY_ISSUE_CODES.BROKEN_LINK,
      severity: "error",
      subject: `draft:${reviewDraftId}`,
      message: `Review references draft #${reviewDraftId}, which is not bound to this recruitment`
    });
  }

  const eventIds = new Set(
    (Array.isArray(events) ? events : [])
      .map((event) => toNumberOrNull(event.id))
      .filter((id) => id != null)
  );
  const sortedPages = (Array.isArray(pages) ? pages : [])
    .slice()
    .sort((a, b) => (toNumberOrNull(a.id) ?? 0) - (toNumberOrNull(b.id) ?? 0));
  for (const page of sortedPages) {
    const eventId = toNumberOrNull(page.recruitment_event_id);
    if (eventId != null && !eventIds.has(eventId)) {
      issues.push({
        code: INTEGRITY_ISSUE_CODES.BROKEN_LINK,
        severity: "error",
        subject: `page:${page.slug || page.id}`,
        message: `Linked page "${page.slug || page.id}" references missing recruitment event #${eventId}`
      });
    }
  }

  const recruitmentId = recruitment ? toNumberOrNull(recruitment.id) : null;
  const sortedEvents = (Array.isArray(events) ? events : [])
    .slice()
    .sort((a, b) => (toNumberOrNull(a.id) ?? 0) - (toNumberOrNull(b.id) ?? 0));
  for (const event of sortedEvents) {
    const eventRecruitmentId = toNumberOrNull(event.recruitment_id);
    if (
      recruitmentId != null &&
      eventRecruitmentId != null &&
      eventRecruitmentId !== recruitmentId
    ) {
      issues.push({
        code: INTEGRITY_ISSUE_CODES.ORPHAN_EVENT,
        severity: "error",
        subject: `event:${event.id}`,
        message: `Event #${event.id} belongs to recruitment #${eventRecruitmentId}, not #${recruitmentId}`
      });
    }
  }

  return {
    status: issues.length ? "issues_found" : "ok",
    advisory: true,
    issueCount: issues.length,
    issues
  };
}

/**
 * Build a deterministic shared preview snapshot from aggregated inputs.
 *
 * @param {Object} input
 * @param {Object|null} input.recruitment Recruitment row
 * @param {Object[]} [input.drafts] Summarized bound drafts (binding service shape)
 * @param {Object|null} [input.primaryDraft] Full primary draft row (with payload)
 * @param {Object|null} [input.review] Editorial review record
 * @param {Object[]} [input.pages] Linked page rows
 * @param {Object[]} [input.events] Recruitment event rows
 * @param {string[]} [input.missingDependencies] Advisory dependency gaps
 * @param {string} [input.generatedAt] ISO timestamp (excluded from version hash)
 */
function buildPreviewSnapshot({
  recruitment = null,
  drafts = [],
  primaryDraft = null,
  review = null,
  pages = [],
  events = [],
  missingDependencies = [],
  generatedAt = new Date().toISOString()
} = {}) {
  const draftRows = Array.isArray(drafts) ? drafts : [];
  const content = {
    schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
    recruitmentId: recruitment ? toNumberOrNull(recruitment.id) : null,
    recruitment: summarizeRecruitment(recruitment),
    currentDraft: primaryDraft
      ? {
          id: toNumberOrNull(primaryDraft.id),
          title: primaryDraft.title != null ? String(primaryDraft.title) : null,
          slugHint:
            primaryDraft.slug_hint != null
              ? String(primaryDraft.slug_hint)
              : primaryDraft.slugHint != null
                ? String(primaryDraft.slugHint)
                : null,
          status: primaryDraft.status != null ? String(primaryDraft.status) : null,
          updatedAt:
            primaryDraft.updated_at != null
              ? String(primaryDraft.updated_at)
              : primaryDraft.updatedAt != null
                ? String(primaryDraft.updatedAt)
                : null
        }
      : null,
    drafts: draftRows
      .map((draft) => ({
        id: toNumberOrNull(draft.id),
        title: draft.title != null ? String(draft.title) : null,
        status: draft.status != null ? String(draft.status) : null
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
    reviewStatus: buildReviewStatus({ review, draftCount: draftRows.length }),
    validationSummary: buildValidationSummary({ recruitment, draft: primaryDraft }),
    integrity: validatePreviewIntegrity({
      recruitment,
      drafts: draftRows,
      review,
      pages,
      events
    }),
    linkedPages: summarizeLinkedPages({ pages, events }),
    lifecycleSummary: buildLifecycleSummary({ recruitment, events }),
    operatorNotes: summarizeOperatorNotes(review),
    missingDependencies: (Array.isArray(missingDependencies) ? missingDependencies : [])
      .map((item) => String(item))
      .sort()
  };

  return {
    ...content,
    timestamp: String(generatedAt),
    snapshotVersion: computeSnapshotVersion(content)
  };
}

module.exports = {
  SHARED_PREVIEW_SCHEMA_VERSION,
  INTEGRITY_ISSUE_CODES,
  canonicalSerialize,
  computeSnapshotVersion,
  buildLifecycleSummary,
  validatePreviewIntegrity,
  buildPreviewSnapshot
};
