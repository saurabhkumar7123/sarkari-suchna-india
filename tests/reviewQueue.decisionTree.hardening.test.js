"use strict";

/**
 * Static contract: Review Center decision-tree UI + Approve≠Publish guidance.
 * Hardens existing canonical workflow — does not invent a parallel path.
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

describe("reviewQueue.decisionTree.hardening", () => {
  const html = read("private/admin-recruitment-review-queue.html");
  const js = read("public/assets/js/admin-recruitment-review-queue.js");
  const ctrl = read("server/controllers/admin/recruitmentReviewQueue.controller.js");
  const preview = read("server/controllers/public/misc.controller.js");
  const mon = read("public/assets/js/admin-monitoring.js");
  const merge = read("server/lib/recruitment/preparationPipeline/structuredNormalizeMerge.js");

  test("decision tree YES/NO gates Attach vs Create Parent/Standalone/Reject", () => {
    expect(html).toContain("data-rrq-branch=\"yes\"");
    expect(html).toContain("data-rrq-branch=\"no\"");
    expect(html).toContain("rrqStepAttach");
    expect(html).toContain("rrqStepAlternate");
    expect(html).toContain('data-match-action="attach"');
    expect(html).toContain('data-match-action="create_parent"');
    expect(html).toContain('data-match-action="standalone"');
    expect(html).toMatch(/Create Parent[\s\S]*Standalone[\s\S]*Reject/);
    expect(js).toContain("matchingBranch");
    expect(js).toContain("persistMatchIntent");
    expect(js).toContain("restoreMatchIntentForItem");
    expect(js).toContain("resolveUiPhase");
    expect(js).toContain("syncMatchIntentUrl");
    const stateJs = read("public/assets/js/admin-rrq-workflow-state.js");
    expect(stateJs).toContain("match_intent");
    expect(stateJs).toContain("resolvePhase");
  });

  test("workflow-state helper is loaded before RRQ script", () => {
    expect(html).toContain("admin-rrq-workflow-state.js");
    const stateIdx = html.indexOf("admin-rrq-workflow-state.js");
    const rrqIdx = html.indexOf("admin-recruitment-review-queue.js");
    expect(stateIdx).toBeGreaterThan(-1);
    expect(rrqIdx).toBeGreaterThan(stateIdx);
  });

  test("pipeline strip SOURCE→UPDATE→RECRUITMENT→DRAFT→PREVIEW→PUBLISH", () => {
    expect(html).toContain("rrqTreePipeline");
    expect(html).toContain('data-rrq-pipe="source"');
    expect(html).toContain('data-rrq-pipe="publish"');
    expect(js).toContain("syncPipelineHighlight");
  });

  test("post-match / approve copy includes Approve before Manual Publish", () => {
    expect(js).toMatch(/Edit Draft → Combined Preview → Approve → Manual Publish/);
    expect(js).toMatch(/Approved \(decision only/);
    expect(ctrl).toMatch(/YES → Select Recruitment → Attach/);
    expect(ctrl).toMatch(/Approve केवल editorial approval/);
  });

  test("Edit Draft prefers /generator?draftId= when draft exists", () => {
    expect(js).toContain("/generator?draftId=");
    expect(js).toMatch(/encodeURIComponent\(draftId\)/);
  });

  test("Combined Preview marks NEW / CHANGED / UNCHANGED", () => {
    expect(preview).toContain("preview-change-badge--unchanged");
    expect(preview).toContain('data-preview-change="${change}"');
    expect(preview).toContain("UNCHANGED");
    expect(preview).toContain("Approve does not publish");
  });

  test("REMOVE never automatic in structured merge", () => {
    expect(merge).toMatch(/allowRemove\s*===\s*true/);
    expect(merge).toMatch(/removeKeys/);
  });

  test("Monitoring Open Review preserves update_id; Manual Publish labeled", () => {
    expect(mon).toContain('reviewParams.set("update_id"');
    expect(mon).toContain("Open Review");
    expect(mon).toContain("Open Official Site");
    expect(mon).toContain("Manual Publish");
    expect(mon).not.toMatch(/label: \"Publish\"\s*\}/);
  });

  test("automation safety flags remain OFF", () => {
    const flags = getAutomationFlags();
    expect(flags.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(isAutoPublishBlocked()).toBe(true);
    expect(flags.AUTO_DRAFT_ENABLED).toBe(false);
    expect(flags.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(flags.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(flags.TELEGRAM_DELIVERY_ENABLED).toBe(false);
  });
});
