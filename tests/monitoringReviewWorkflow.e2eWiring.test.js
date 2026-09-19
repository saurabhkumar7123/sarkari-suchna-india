"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");
const {
  REVIEW_STATUS,
  resolveStatusForDecision,
  REVIEW_DECISIONS
} = require("../server/lib/recruitment/reviewQueue");
const { buildReviewHistory } = require("../server/lib/recruitment/reviewComparison");

describe("Monitoring → Review workflow wiring", () => {
  test("Open Review deep-link preserves update_id in monitoring UI", () => {
    const js = fs.readFileSync(
      path.join(__dirname, "../public/assets/js/admin-monitoring.js"),
      "utf8"
    );
    expect(js).toContain('reviewParams.set("update_id"');
    expect(js).toContain("/admin/recruitment-review-queue?");
  });

  test("Review Center reads update_id / ensure-from-update / unfreeze", () => {
    const js = fs.readFileSync(
      path.join(__dirname, "../public/assets/js/admin-recruitment-review-queue.js"),
      "utf8"
    );
    expect(js).toContain("ensure-from-update");
    expect(js).toContain("openFocusedReviewFromUrl");
    expect(js).toContain('action === "unfreeze"');
    expect(js).toContain("Reject requires a reason");
    expect(js).toContain("syncActionAvailability");
    expect(js).toContain("renderWorkflowGuidance");
    expect(js).toContain("focusedUpdateId");
  });

  test("Review Center HTML exposes workflow context + unfreeze", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../private/admin-recruitment-review-queue.html"),
      "utf8"
    );
    expect(html).toContain("rrqWorkflowPanel");
    expect(html).toContain("rrqContextPanel");
    expect(html).toContain('data-action="unfreeze"');
    expect(html).toContain("Approve (not publish)");
    expect(html).toContain("Keep Under Review");
  });

  test("API routes expose ensure-from-update and unfreeze", () => {
    const routes = fs.readFileSync(
      path.join(__dirname, "../server/api/admin/recruitmentReviewQueue.routes.js"),
      "utf8"
    );
    expect(routes).toContain("/recruitment-review-queue/ensure-from-update");
    expect(routes).toContain("/recruitment-review-queue/by-update/:updateId");
    expect(routes).toContain("/recruitment-review-queue/:id/unfreeze");
  });

  test("list query schema accepts update_id", () => {
    const {
      recruitmentReviewQueueListQuerySchema
    } = require("../server/validations/admin.validation");
    const { error, value } = recruitmentReviewQueueListQuerySchema.validate({
      update_id: "12",
      page: "1"
    });
    expect(error).toBeUndefined();
    expect(String(value.update_id)).toBe("12");
  });

  test("status model: approve is not publish; skip → under_review; freeze distinct", () => {
    expect(resolveStatusForDecision(REVIEW_DECISIONS.APPROVE)).toBe(REVIEW_STATUS.APPROVED);
    expect(resolveStatusForDecision(REVIEW_DECISIONS.REJECT)).toBe(REVIEW_STATUS.REJECTED);
    expect(resolveStatusForDecision(REVIEW_DECISIONS.SKIP)).toBe(REVIEW_STATUS.UNDER_REVIEW);
    expect(REVIEW_STATUS.FROZEN).toBe("frozen");
    expect(REVIEW_STATUS.NEEDS_MATCHING).toBe("needs_matching");
  });

  test("history trail uses existing fields only", () => {
    const history = buildReviewHistory({
      created_at: "2026-09-01T10:00:00.000Z",
      updated_at: "2026-09-01T11:00:00.000Z",
      status: "approved",
      decision: "approve",
      update_id: 44,
      recruitment_id: 9,
      notes: "ok"
    });
    expect(history.updateId).toBe(44);
    expect(history.recruitmentId).toBe(9);
    expect(Array.isArray(history.trail)).toBe(true);
    expect(history.trail.some((t) => t.event === "linked_update")).toBe(true);
    expect(history.trail.some((t) => t.event === "decision")).toBe(true);
  });

  test("ensure-from-update and unfreeze require authentication", async () => {
    const ensure = await request(app)
      .post("/api/admin/recruitment-review-queue/ensure-from-update")
      .send({ update_id: 1 });
    expect(ensure.status).toBe(401);

    const unfreeze = await request(app)
      .post("/api/admin/recruitment-review-queue/1/unfreeze")
      .send({});
    expect(unfreeze.status).toBe(401);

    const byUpdate = await request(app).get(
      "/api/admin/recruitment-review-queue/by-update/1"
    );
    expect(byUpdate.status).toBe(401);
  });
});
