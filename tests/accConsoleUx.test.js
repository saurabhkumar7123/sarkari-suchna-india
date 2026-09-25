"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("ACC Controls / Health / Reviews console UX", () => {
  const controls = read("private/admin-automation-controls.html");
  const health = read("private/admin-automation-health.html");
  const reviews = read("private/admin-automation-reviews.html");
  const client = read("public/assets/js/admin-automation-control-center.js");
  const css = read("public/assets/css/admin/automation-control-center.css");
  const rrq = read("private/admin-recruitment-review-queue.html");

  test("Controls shows grouped ON/OFF UI with confirmation and locked Auto Publish", () => {
    expect(controls).toContain("Automation Controls");
    expect(controls).toContain("Only place for automation ON/OFF actions");
    expect(controls).toContain('id="accOperatorControls"');
    expect(controls).toContain('id="accPublicationSafety"');
    expect(controls).toContain("Publication safety");
    expect(controls).toContain("LOCKED");
    expect(controls).toContain("MANUAL REVIEW ONLY");
    expect(controls).not.toMatch(/id=["']accAutoPublishToggle["']/);
    expect(controls).toContain('id="accSchedulerToggle"');
    expect(client).toContain("Turn ON");
    expect(client).toContain("Turn OFF");
    expect(client).toContain("confirmEnable");
    expect(client).toContain("renderOperatorControlCards");
    expect(client).toContain("CONTROL_GROUPS");
    expect(client).toContain("unavailableBecause");
  });

  test("Health renders compact tables and does not invent values", () => {
    expect(health).toContain("System health");
    expect(health).toContain("Automation runtime");
    expect(health).toContain("Notification");
    expect(health).toContain("Advanced / Technical details");
    expect(health).toContain("Not available");
    expect(health).toContain("Open Monitoring");
    expect(health).not.toContain("Turn ON");
    expect(client).toContain("renderHealthTables");
    expect(client).toContain("Not available");
    expect(css).toContain(".acc-health-table");
  });

  test("Reviews is a snapshot with Open Review links, not a full workflow", () => {
    expect(reviews).toContain("Review queue snapshot");
    expect(reviews).toContain("Requires your action");
    expect(reviews).toContain("Open Review Queue");
    expect(reviews).toContain('href="/admin/recruitment-review-queue"');
    expect(reviews).toContain('id="accReviewList"');
    expect(reviews).not.toContain("Side-by-side Comparison");
    expect(reviews).not.toContain("Request changes");
    expect(reviews).not.toMatch(/\bReject\b/);
    expect(reviews).not.toContain('id="accReviewDetail"');
    expect(client).toContain("Open Review");
    expect(client).toContain("reviewOpenHref");
    expect(client).toContain("/admin/recruitment-review-queue?update_id=");
    expect(rrq).toContain("Needs Matching");
  });

  test("shared console styles exist and Auto Publish lock is distinct", () => {
    expect(css).toContain(".acc-console");
    expect(css).toContain(".acc-control-group");
    expect(css).toContain(".acc-lock-panel");
    expect(css).toContain(".acc-clean-section--lock");
  });

  test("automation flags remain fail-safe off", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });
});
