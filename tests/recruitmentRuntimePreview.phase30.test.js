"use strict";

/**
 * Phase 30 regression: runtime preview is in-memory only.
 * No review-queue / DB persistence from worker or preview buffer.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Phase 30 regression — runtime preview has no persistence", () => {
  test("preview buffer module has no DB or review persistence imports", () => {
    const source = read("server/lib/recruitment/runtimePreviewBuffer.js");
    expect(source).not.toMatch(/recruitmentReview\.service/);
    expect(source).not.toMatch(/recruitmentReview\.repository/);
    expect(source).not.toMatch(/saveReviewItem/);
    expect(source).not.toMatch(/mysql|createPool|INSERT INTO/i);
    expect(source).toMatch(/MAX_PREVIEW_ENTRIES\s*=\s*100/);
  });

  test("site worker records preview but does not persist review items", () => {
    const worker = read("server/services/workers/siteWorker.js");
    expect(worker).toMatch(/recordRuntimePreviewFromPipeline/);
    expect(worker).not.toMatch(/recruitmentReview\.service/);
    expect(worker).not.toMatch(/saveReviewItem/);
    expect(worker).not.toMatch(/recruitment_review_queue/);
  });

  test("pipeline runner remains free of preview and review persistence", () => {
    const source = read("server/lib/recruitment/runRecruitmentPipeline.js");
    expect(source).not.toMatch(/runtimePreviewBuffer/);
    expect(source).not.toMatch(/recruitmentReview\.service/);
    expect(source).not.toMatch(/saveReviewItem/);
  });

  test("admin runtime preview routes are protected-only", () => {
    const protectedRoutes = read("server/api/admin/protected.routes.js");
    const app = read("server/app.js");
    expect(protectedRoutes).toMatch(/recruitmentRuntimePreview\.routes/);
    expect(app).toMatch(/\/admin\/recruitment-runtime-preview/);
    expect(app).not.toMatch(/\/api\/public\/recruitment-runtime-preview/);
  });

  test("preview controller uses service layer not buffer directly", () => {
    const controller = read(
      "server/controllers/admin/recruitmentRuntimePreview.controller.js"
    );
    expect(controller).toMatch(/recruitmentRuntimePreview\.service/);
    expect(controller).not.toMatch(/runtimePreviewBuffer/);
  });

  test("admin UI page and client assets exist", () => {
    expect(
      fs.existsSync(path.join(ROOT, "private/admin-recruitment-runtime-preview.html"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ROOT, "public/assets/js/admin-recruitment-runtime-preview.js"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ROOT, "public/assets/css/admin/recruitment-runtime-preview.css"))
    ).toBe(true);

    const html = read("private/admin-recruitment-runtime-preview.html");
    expect(html).toMatch(/Preview only/i);
    expect(html).toMatch(/In-memory/i);
  });
});
