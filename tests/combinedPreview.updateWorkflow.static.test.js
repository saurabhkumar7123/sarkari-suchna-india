"use strict";

/**
 * Static contract checks for Combined Preview / source verification affordances.
 * No DB. No automation activation.
 */

const fs = require("fs");
const path = require("path");
const {
  getAutomationFlags,
  isAutoPublishBlocked
} = require("../server/config/automationFlags");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

describe("combinedPreview.updateWorkflow.static", () => {
  test("Generator Combined Preview path sends existingText + combinePreview", () => {
    const js = read("public/assets/js/generator.js");
    expect(js).toMatch(/combinePreview\s*=\s*true/);
    expect(js).toMatch(/existingText/);
    expect(js).toMatch(/Combined Preview/);
    expect(js).toMatch(/resolveExistingPageTextForPreview/);
  });

  test("preview API supports combined merge markers", () => {
    const ctrl = read("server/controllers/public/misc.controller.js");
    const schema = read("server/validations/public.validation.js");
    expect(ctrl).toMatch(/injectCombinedPreviewMarkers/);
    expect(ctrl).toMatch(/X-Combined-Preview/);
    expect(ctrl).toMatch(/resolveCombinedPreviewText/);
    expect(ctrl).toMatch(/preview-change-badge--unchanged|UNCHANGED/);
    expect(schema).toMatch(/combinePreview/);
    expect(schema).toMatch(/existingText/);
  });

  test("Monitoring + RRQ expose official site/PDF verification links", () => {
    const mon = read("public/assets/js/admin-monitoring.js");
    const rrq = read("public/assets/js/admin-recruitment-review-queue.js");
    expect(mon).toMatch(/Open Official Site/);
    expect(mon).toMatch(/Open Official PDF|Open Official Notice/);
    expect(rrq).toMatch(/Open Official PDF|Open Official Notice/);
    expect(rrq).toMatch(/Verify PDF in Generator|rrq-source-link/);
  });

  test("Manual update seeds merge + binds recruitment linkage", () => {
    const life = read("server/services/recruitmentLifecycle.service.js");
    expect(life).toMatch(/mergePublisherSectionText/);
    expect(life).toMatch(/bindDraftRecruitmentLinkage/);
    expect(life).toMatch(/mergeApplied/);
  });

  test("AUTO_PUBLISH remains blocked; safety gates unchanged defaults", () => {
    const flags = getAutomationFlags();
    expect(flags.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(isAutoPublishBlocked()).toBe(true);
    expect(flags.AUTO_DRAFT_ENABLED).toBe(false);
    expect(flags.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(flags.WORKER_ACTIVATION_ENABLED).toBe(false);
    expect(flags.LIVE_CRAWLER_ENABLED).toBe(false);
  });
});
