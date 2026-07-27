"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");

const storePath = path.join(os.tmpdir(), `editorial-repo-${process.pid}.json`);
process.env.EDITORIAL_REVIEW_STORE_PATH = storePath;

const repo = require("../server/repositories/editorialReview.repository");
const { WORKFLOW_STATES } = require("../server/lib/recruitment/editorialWorkflow");

describe("editorialReview.repository", () => {
  beforeEach(() => {
    repo.resetStoreForTests(storePath);
  });

  afterAll(() => {
    try {
      fs.unlinkSync(storePath);
    } catch {
      /* ignore */
    }
  });

  test("upsert and get review by recruitment id", () => {
    const saved = repo.upsertReview(3, {
      draftId: 9,
      workflowState: WORKFLOW_STATES.IN_REVIEW,
      updatedBy: "admin",
      notes: [{ text: "hello", operator: "admin", createdAt: new Date().toISOString() }]
    });
    expect(saved.recruitmentId).toBe(3);
    expect(saved.workflowState).toBe(WORKFLOW_STATES.IN_REVIEW);

    const loaded = repo.getReviewByRecruitmentId(3);
    expect(loaded.draftId).toBe(9);
    expect(loaded.notes).toHaveLength(1);
  });

  test("listReviews filters by workflow state", () => {
    repo.upsertReview(1, { workflowState: WORKFLOW_STATES.APPROVED, draftId: 1 });
    repo.upsertReview(2, { workflowState: WORKFLOW_STATES.IN_REVIEW, draftId: 2 });
    const rows = repo.listReviews({ workflowState: WORKFLOW_STATES.IN_REVIEW });
    expect(rows).toHaveLength(1);
    expect(rows[0].recruitmentId).toBe(2);
  });
});
