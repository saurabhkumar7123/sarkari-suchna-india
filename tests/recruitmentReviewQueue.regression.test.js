"use strict";

/**
 * Phase 28/29 regression: runtime recruitment pipeline must remain free of
 * recruitment_review_queue persistence. Admin-only queue management is separate.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 28 regression — runtime unchanged", () => {
  test("site worker does not import recruitment review persistence", () => {
    const worker = read("server/services/workers/siteWorker.js");
    expect(worker).not.toMatch(/recruitmentReview\.service/);
    expect(worker).not.toMatch(/recruitmentReview\.repository/);
    expect(worker).not.toMatch(/saveReviewItem/);
  });

  test("recruitment pipeline runner does not persist review queue items", () => {
    const pipelineCandidates = [
      "server/lib/recruitment/runRecruitmentPipeline.js",
      "server/config/recruitmentPipeline.js"
    ];

    let found = false;
    for (const candidate of pipelineCandidates) {
      const abs = path.join(ROOT, candidate);
      if (!fs.existsSync(abs)) continue;
      found = true;
      const source = fs.readFileSync(abs, "utf8");
      expect(source).not.toMatch(/recruitmentReview\.service/);
      expect(source).not.toMatch(/saveReviewItem/);
      expect(source).not.toMatch(/INSERT INTO recruitment_review_queue/);
    }

    expect(found).toBe(true);
  });

  test("detection processor remains free of DB persistence", () => {
    const source = read("server/lib/recruitment/detectionProcessor.js");
    expect(source).not.toMatch(/recruitmentReview/);
    expect(source).not.toMatch(/recruitment_review_queue/);
  });

  test("admin review queue routes are registered only under protected admin API", () => {
    const protectedRoutes = read("server/api/admin/protected.routes.js");
    const app = read("server/app.js");
    expect(protectedRoutes).toMatch(/recruitmentReviewQueue\.routes/);
    expect(app).toMatch(/\/admin\/recruitment-review-queue/);
    expect(app).not.toMatch(/\/api\/public\/recruitment-review-queue/);
  });
});
