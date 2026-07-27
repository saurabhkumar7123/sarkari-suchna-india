"use strict";

const {
  WORKFLOW_STATES,
  WORKFLOW_DECISIONS,
  BINDING_STATUSES,
  isTransitionAllowed,
  resolveTransition,
  listAllowedDecisions,
  deriveBindingStatus,
  buildValidationSummary
} = require("../server/lib/recruitment/editorialWorkflow");

describe("Package 4C editorialWorkflow state machine", () => {
  test("allows the happy-path editorial transitions", () => {
    expect(isTransitionAllowed(WORKFLOW_STATES.DRAFT_ATTACHED, WORKFLOW_DECISIONS.SUBMIT_FOR_REVIEW)).toBe(true);
    expect(isTransitionAllowed(WORKFLOW_STATES.REVIEW_PENDING, WORKFLOW_DECISIONS.START_REVIEW)).toBe(true);
    expect(isTransitionAllowed(WORKFLOW_STATES.IN_REVIEW, WORKFLOW_DECISIONS.APPROVE)).toBe(true);
    expect(isTransitionAllowed(WORKFLOW_STATES.IN_REVIEW, WORKFLOW_DECISIONS.REQUEST_CHANGES)).toBe(true);
    expect(isTransitionAllowed(WORKFLOW_STATES.IN_REVIEW, WORKFLOW_DECISIONS.REJECT)).toBe(true);
  });

  test("blocks invalid transitions", () => {
    expect(isTransitionAllowed(WORKFLOW_STATES.DRAFT_CREATED, WORKFLOW_DECISIONS.APPROVE)).toBe(false);
    expect(isTransitionAllowed(WORKFLOW_STATES.APPROVED, WORKFLOW_DECISIONS.APPROVE)).toBe(false);
    expect(resolveTransition(WORKFLOW_STATES.DRAFT_ATTACHED, WORKFLOW_DECISIONS.REJECT).allowed).toBe(false);
  });

  test("supports return_to_draft and reopen_review", () => {
    expect(resolveTransition(WORKFLOW_STATES.IN_REVIEW, WORKFLOW_DECISIONS.RETURN_TO_DRAFT)).toMatchObject({
      allowed: true,
      toState: WORKFLOW_STATES.DRAFT_ATTACHED
    });
    expect(resolveTransition(WORKFLOW_STATES.APPROVED, WORKFLOW_DECISIONS.REOPEN_REVIEW)).toMatchObject({
      allowed: true,
      toState: WORKFLOW_STATES.REVIEW_PENDING
    });
    expect(resolveTransition(WORKFLOW_STATES.REJECTED, WORKFLOW_DECISIONS.RETURN_TO_DRAFT)).toMatchObject({
      allowed: true,
      toState: WORKFLOW_STATES.DRAFT_ATTACHED
    });
  });

  test("lists allowed decisions for in_review", () => {
    expect(listAllowedDecisions(WORKFLOW_STATES.IN_REVIEW)).toEqual([
      WORKFLOW_DECISIONS.APPROVE,
      WORKFLOW_DECISIONS.REJECT,
      WORKFLOW_DECISIONS.REQUEST_CHANGES,
      WORKFLOW_DECISIONS.RETURN_TO_DRAFT
    ].sort((a, b) => a.localeCompare(b)));
  });

  test("derives binding status labels from draft + workflow state", () => {
    expect(deriveBindingStatus({ draftCount: 0 })).toBe(BINDING_STATUSES.NO_DRAFT);
    expect(deriveBindingStatus({ draftCount: 1, workflowState: WORKFLOW_STATES.DRAFT_ATTACHED })).toBe(
      BINDING_STATUSES.DRAFT_READY
    );
    expect(deriveBindingStatus({ draftCount: 1, workflowState: WORKFLOW_STATES.IN_REVIEW })).toBe(
      BINDING_STATUSES.REVIEW_REQUIRED
    );
    expect(deriveBindingStatus({ draftCount: 1, workflowState: WORKFLOW_STATES.APPROVED })).toBe(
      BINDING_STATUSES.APPROVED
    );
  });

  test("buildValidationSummary compares recruitment and draft", () => {
    const summary = buildValidationSummary({
      recruitment: { id: 1, title: "SSC CGL 2026", slug: "ssc-cgl-2026" },
      draft: {
        id: 9,
        title: "SSC CGL 2026 Notification",
        slug_hint: "ssc-cgl-2026",
        payload: { title: "SSC CGL 2026 Notification", data: "x".repeat(40) }
      }
    });
    expect(summary.ok).toBe(true);
    expect(summary.passed).toBeGreaterThan(0);
  });
});
