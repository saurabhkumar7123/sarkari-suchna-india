"use strict";

/**
 * Phase 29 — UI structure + auth + runtime regression for
 * Recruitment Review Comparison & Decision Assistant.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 29 UI — comparison / decision assistant / history", () => {
  test("admin page includes comparison, decision assistant, and history sections", () => {
    const html = read("private/admin-recruitment-review-queue.html");

    expect(html).toMatch(/id="rrqComparison"/);
    expect(html).toMatch(/Incoming Notice/);
    expect(html).toMatch(/Selected Recruitment Candidate/);
    expect(html).toMatch(/id="rrqDecisionAssist"/);
    expect(html).toMatch(/Recommended Decision/);
    expect(html).toMatch(/id="rrqHistory"/);
    expect(html).toMatch(/aria-label="Review history"/);
    expect(html).toMatch(/human decision is mandatory/i);
  });

  test("admin client renders comparison, recommendation, and history", () => {
    const js = read("public/assets/js/admin-recruitment-review-queue.js");

    expect(js).toMatch(/function renderComparison/);
    expect(js).toMatch(/function renderDecisionAssist/);
    expect(js).toMatch(/function renderHistory/);
    expect(js).toMatch(/rrqRecommendedDecision/);
    expect(js).toMatch(/visualStatus/);
    expect(js).toMatch(/Frozen state/);
  });

  test("CSS includes green / yellow / red field indicators", () => {
    const css = read("public/assets/css/admin/recruitment-review-queue.css");

    expect(css).toMatch(/\.rrq-field-status\.is-matched/);
    expect(css).toMatch(/\.rrq-field-status\.is-missing/);
    expect(css).toMatch(/\.rrq-field-status\.is-conflicting/);
  });
});

describe("Phase 29 authentication", () => {
  test("GET detail remains authenticated", async () => {
    const response = await request(app).get("/api/admin/recruitment-review-queue/1");
    expect(response.status).toBe(401);
  });

  test("admin review queue page remains authenticated", async () => {
    const response = await request(app).get("/admin/recruitment-review-queue");
    expect([302, 401]).toContain(response.status);
  });
});

describe("Phase 29 regression — runtime unchanged + no automatic decisions", () => {
  test("site worker is untouched by decision assistant", () => {
    const worker = read("server/services/workers/siteWorker.js");
    expect(worker).not.toMatch(/reviewDecisionAssistant/);
    expect(worker).not.toMatch(/reviewComparison/);
    expect(worker).not.toMatch(/buildReviewAssistView/);
  });

  test("runtime recruitment pipeline does not import assist modules", () => {
    const pipeline = read("server/lib/recruitment/runRecruitmentPipeline.js");
    expect(pipeline).not.toMatch(/reviewDecisionAssistant/);
    expect(pipeline).not.toMatch(/reviewComparison/);
    expect(pipeline).not.toMatch(/buildReviewAssistView/);
  });

  test("detection processor remains free of assist / persistence wiring", () => {
    const source = read("server/lib/recruitment/detectionProcessor.js");
    expect(source).not.toMatch(/reviewDecisionAssistant/);
    expect(source).not.toMatch(/reviewComparison/);
    expect(source).not.toMatch(/recruitmentReview/);
  });

  test("decision assistant never auto-applies approve/reject", () => {
    const source = read("server/lib/recruitment/reviewDecisionAssistant.js");
    expect(source).toMatch(/automaticDecisionApplied:\s*false/);
    expect(source).not.toMatch(/updateReviewDecision/);
    expect(source).not.toMatch(/REVIEW_DECISIONS\.APPROVE/);
    expect(source).not.toMatch(/REVIEW_DECISIONS\.REJECT/);
  });

  test("assist view is attached only in admin review queue controller", () => {
    const controller = read(
      "server/controllers/admin/recruitmentReviewQueue.controller.js"
    );
    expect(controller).toMatch(/buildReviewAssistView/);
    expect(controller).toMatch(/withAssistView/);

    const service = read("server/services/recruitmentReview.service.js");
    expect(service).not.toMatch(/buildReviewAssistView/);
    expect(service).not.toMatch(/recommendDecisionFromMatchResult/);
  });
});
