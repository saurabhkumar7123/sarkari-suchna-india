"use strict";

/**
 * Package 4D — unit tests for the shared preview snapshot model.
 */

const {
  SHARED_PREVIEW_SCHEMA_VERSION,
  INTEGRITY_ISSUE_CODES,
  canonicalSerialize,
  computeSnapshotVersion,
  buildLifecycleSummary,
  validatePreviewIntegrity,
  buildPreviewSnapshot
} = require("../server/lib/recruitment/sharedPreviewModel");
const { WORKFLOW_STATES } = require("../server/lib/recruitment/editorialWorkflow");

const recruitment = {
  id: 10,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  department: "ssc",
  post_name: "Combined Graduate Level",
  advertisement_no: "SSC/2026/01",
  cycle_year: 2026,
  lifecycle_state: "open",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-10T00:00:00.000Z"
};

const draft = {
  id: 55,
  title: "SSC CGL 2026 Draft",
  slug_hint: "ssc-cgl-2026",
  status: "draft",
  payload: { title: "SSC CGL 2026 Draft", data: "Notification body content goes here for review." },
  recruitment_id: 10,
  recruitment_event_id: null,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z"
};

const review = {
  recruitmentId: 10,
  draftId: 55,
  workflowState: WORKFLOW_STATES.IN_REVIEW,
  notes: [
    { id: "note_1", text: "Checked eligibility table", operator: "editor1", createdAt: "2026-07-13T00:00:00.000Z", decision: null }
  ],
  decisionHistory: [
    { id: "dec_1", decision: "submit_for_review", fromState: "draft_attached", toState: "review_pending", operator: "editor1", createdAt: "2026-07-12T10:00:00.000Z" },
    { id: "dec_2", decision: "start_review", fromState: "review_pending", toState: "in_review", operator: "editor1", createdAt: "2026-07-12T11:00:00.000Z" }
  ],
  updatedAt: "2026-07-13T00:00:00.000Z",
  updatedBy: "editor1"
};

const events = [
  { id: 1, recruitment_id: 10, event_type: "notification", sequence_order: 0, status: "active" },
  { id: 2, recruitment_id: 10, event_type: "admit_card", sequence_order: 1, status: "pending" }
];

const pages = [
  { id: 100, slug: "ssc-cgl-2026", recruitment_id: 10, recruitment_event_id: null },
  { id: 101, slug: "ssc-cgl-2026-admit-card", recruitment_id: 10, recruitment_event_id: 2 }
];

const fullInput = () => ({
  recruitment: { ...recruitment },
  drafts: [{ ...draft }],
  primaryDraft: { ...draft },
  review: JSON.parse(JSON.stringify(review)),
  pages: pages.map((page) => ({ ...page })),
  events: events.map((event) => ({ ...event }))
});

describe("Package 4D shared preview model", () => {
  describe("canonical serialization + snapshot version", () => {
    test("canonicalSerialize is key-order independent", () => {
      const a = canonicalSerialize({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } });
      const b = canonicalSerialize({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 });
      expect(a).toBe(b);
    });

    test("computeSnapshotVersion is deterministic and state-sensitive", () => {
      const v1 = computeSnapshotVersion({ x: 1, y: [1, 2] });
      const v2 = computeSnapshotVersion({ y: [1, 2], x: 1 });
      const v3 = computeSnapshotVersion({ x: 2, y: [1, 2] });
      expect(v1).toBe(v2);
      expect(v1).not.toBe(v3);
      expect(v1).toMatch(new RegExp(`^v${SHARED_PREVIEW_SCHEMA_VERSION}-[0-9a-f]{16}$`));
    });
  });

  describe("buildPreviewSnapshot", () => {
    test("includes all required snapshot sections", () => {
      const snapshot = buildPreviewSnapshot({
        ...fullInput(),
        generatedAt: "2026-07-19T12:00:00.000Z"
      });

      expect(snapshot.schemaVersion).toBe(SHARED_PREVIEW_SCHEMA_VERSION);
      expect(snapshot.recruitment).toMatchObject({
        id: 10,
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        lifecycleState: "open"
      });
      expect(snapshot.currentDraft).toMatchObject({ id: 55, status: "draft" });
      expect(snapshot.reviewStatus).toMatchObject({
        workflowState: "in_review",
        bindingStatus: "review_required",
        decisionCount: 2
      });
      expect(snapshot.reviewStatus.lastDecision.decision).toBe("start_review");
      expect(snapshot.validationSummary.total).toBeGreaterThan(0);
      expect(snapshot.linkedPages).toHaveLength(2);
      expect(snapshot.lifecycleSummary).toMatchObject({
        lifecycleState: "open",
        totalEvents: 2,
        statusCounts: { active: 1, pending: 1 }
      });
      expect(snapshot.operatorNotes).toHaveLength(1);
      expect(snapshot.timestamp).toBe("2026-07-19T12:00:00.000Z");
      expect(snapshot.snapshotVersion).toMatch(/^v1-[0-9a-f]{16}$/);
    });

    test("same aggregated state produces the same snapshot version (deterministic)", () => {
      const first = buildPreviewSnapshot({ ...fullInput(), generatedAt: "2026-07-19T12:00:00.000Z" });
      const second = buildPreviewSnapshot({ ...fullInput(), generatedAt: "2026-07-19T13:30:00.000Z" });
      expect(first.snapshotVersion).toBe(second.snapshotVersion);
      expect(first.timestamp).not.toBe(second.timestamp);
    });

    test("state change produces a different snapshot version", () => {
      const base = buildPreviewSnapshot(fullInput());
      const changed = buildPreviewSnapshot({
        ...fullInput(),
        review: { ...JSON.parse(JSON.stringify(review)), workflowState: WORKFLOW_STATES.APPROVED }
      });
      expect(changed.snapshotVersion).not.toBe(base.snapshotVersion);
    });

    test("clean state reports integrity ok", () => {
      const snapshot = buildPreviewSnapshot(fullInput());
      expect(snapshot.integrity.status).toBe("ok");
      expect(snapshot.integrity.issues).toEqual([]);
      expect(snapshot.integrity.advisory).toBe(true);
    });
  });

  describe("validatePreviewIntegrity", () => {
    test("detects missing draft", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [],
        review: { ...review, workflowState: WORKFLOW_STATES.DRAFT_CREATED, draftId: null },
        pages: [],
        events
      });
      expect(result.status).toBe("issues_found");
      expect(result.issues.map((issue) => issue.code)).toContain(
        INTEGRITY_ISSUE_CODES.MISSING_DRAFT
      );
    });

    test("detects broken page → event links", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [draft],
        review,
        pages: [{ id: 200, slug: "orphan-page", recruitment_id: 10, recruitment_event_id: 999 }],
        events
      });
      const brokenLinks = result.issues.filter(
        (issue) => issue.code === INTEGRITY_ISSUE_CODES.BROKEN_LINK
      );
      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].message).toContain("999");
    });

    test("detects review referencing an unbound draft as broken link", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [],
        review: { ...review, draftId: 55 },
        pages: [],
        events
      });
      expect(
        result.issues.some(
          (issue) =>
            issue.code === INTEGRITY_ISSUE_CODES.BROKEN_LINK && issue.subject === "draft:55"
        )
      ).toBe(true);
    });

    test("detects invalid review state values", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [draft],
        review: { ...review, workflowState: "not_a_state" },
        pages: [],
        events
      });
      expect(result.issues.map((issue) => issue.code)).toContain(
        INTEGRITY_ISSUE_CODES.INVALID_REVIEW_STATE
      );
    });

    test("detects review states that require a draft when none is bound", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [],
        review: { ...review, draftId: null, workflowState: WORKFLOW_STATES.IN_REVIEW },
        pages: [],
        events
      });
      expect(
        result.issues.some(
          (issue) =>
            issue.code === INTEGRITY_ISSUE_CODES.INVALID_REVIEW_STATE &&
            issue.message.includes("in_review")
        )
      ).toBe(true);
    });

    test("detects incomplete recruitment metadata", () => {
      const result = validatePreviewIntegrity({
        recruitment: { id: 10, title: "", slug: null, lifecycle_state: "open" },
        drafts: [draft],
        review,
        pages: [],
        events
      });
      const issue = result.issues.find(
        (item) => item.code === INTEGRITY_ISSUE_CODES.INCOMPLETE_METADATA
      );
      expect(issue).toBeTruthy();
      expect(issue.message).toContain("title");
      expect(issue.message).toContain("slug");
    });

    test("detects orphan events attached to another recruitment", () => {
      const result = validatePreviewIntegrity({
        recruitment,
        drafts: [draft],
        review,
        pages: [],
        events: [{ id: 7, recruitment_id: 42, event_type: "result", sequence_order: 0, status: "pending" }]
      });
      const orphan = result.issues.find(
        (issue) => issue.code === INTEGRITY_ISSUE_CODES.ORPHAN_EVENT
      );
      expect(orphan).toBeTruthy();
      expect(orphan.message).toContain("#42");
    });

    test("validation is advisory only — reports without mutating inputs", () => {
      const inputEvents = [{ id: 7, recruitment_id: 42, event_type: "result", sequence_order: 0, status: "pending" }];
      const frozen = JSON.parse(JSON.stringify(inputEvents));
      validatePreviewIntegrity({ recruitment, drafts: [], review: null, pages: [], events: inputEvents });
      expect(inputEvents).toEqual(frozen);
    });
  });

  describe("buildLifecycleSummary", () => {
    test("orders events and counts statuses", () => {
      const summary = buildLifecycleSummary({
        recruitment,
        events: [
          { id: 2, recruitment_id: 10, event_type: "admit_card", sequence_order: 5, status: "pending" },
          { id: 1, recruitment_id: 10, event_type: "notification", sequence_order: 0, status: "active" }
        ]
      });
      expect(summary.lifecycleState).toBe("open");
      expect(summary.totalEvents).toBe(2);
      expect(summary.events.map((event) => event.id)).toEqual([1, 2]);
      expect(summary.statusCounts).toEqual({ active: 1, pending: 1 });
    });

    test("linked pages flag broken event references", () => {
      const snapshot = buildPreviewSnapshot({
        ...fullInput(),
        pages: [{ id: 100, slug: "broken", recruitment_id: 10, recruitment_event_id: 999 }]
      });
      expect(snapshot.linkedPages[0].linkStatus).toBe("broken_event_link");
    });
  });
});
