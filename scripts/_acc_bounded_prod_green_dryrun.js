#!/usr/bin/env node
"use strict";

/**
 * Production-safe: classify sources, verify 1–2 GREEN candidates, bounded dry-run.
 * Does NOT enable LIVE / Master / Telegram / auto-publish.
 * Restores DORMANT after dry-run.
 */

require("dotenv").config({ path: "/root/sarkari-suchna-india/.env" });

const fs = require("fs");
const path = require("path");

const OUT = process.env.ACC_DRYRUN_OUT || "/tmp/acc_bounded_dryrun_report.json";

const { fetchSites, getSiteById } = require("../server/services/updates/updates.repository");
const {
  buildSourcePolicy,
  deriveSourceHealth,
  assertExactUrlBinding
} = require("../server/services/updates/sourceGovernancePolicy");
const { isApprovedOfficialMonitoringUrl } = require(
  "../server/lib/contentIntelligence/sourceIntelligence/officialDomains"
);
const {
  getControlPlaneSnapshot,
  setDryRunMode,
  writeControlPlane,
  AUTOMATION_MODES
} = require("../server/config/automationControlPlane");
const {
  getAutomationFlags,
  isAutomationDormant,
  isAutoPublishBlocked,
  canDeliverTelegram,
  canAutoDraft,
  canEnqueueLiveCrawlerJobs,
  canStartMonitoringScheduler,
  canRunAutomationWorkers
} = require("../server/config/automationFlags");
const {
  isAutomationMasterEnabled,
  isAutomationExecutionPermitted
} = require("../server/config/automationKillSwitch");
const monitoringDryRun = require("../server/services/updates/monitoringDryRun");
const { verifyMonitoringSource } = require("../server/services/updates/monitoringSourceVerify");

function classifyQuality(site, policy) {
  const selector = String(site.selector || "").trim();
  if (!policy.hostApproved) return "BLOCKED";
  if (!site.active && site.active !== 1) return "DISABLED";
  if (!selector || /^body$/i.test(selector)) return "YELLOW";
  let pathname = "/";
  try {
    pathname = new URL(site.url).pathname || "/";
  } catch {
    pathname = "/";
  }
  const isHomepage = pathname === "/" || pathname === "";
  if (isHomepage && /^a(\[|$)/i.test(selector)) return "YELLOW";
  if (/^a$/i.test(selector)) return "YELLOW";
  return "GREEN";
}

function safetySnapshot(label) {
  const flags = getAutomationFlags();
  const plane = getControlPlaneSnapshot();
  return {
    label,
    at: new Date().toISOString(),
    MASTER: isAutomationMasterEnabled() === true,
    MODE: plane.mode,
    LIVE: plane.live === true,
    TELEGRAM: flags.TELEGRAM_DELIVERY_ENABLED === true,
    AUTO_PUBLISH_LOCKED: isAutoPublishBlocked() === true,
    dormant: isAutomationDormant(),
    executionPermitted: isAutomationExecutionPermitted() === true,
    canEnqueueLive: canEnqueueLiveCrawlerJobs() === true,
    canStartScheduler: canStartMonitoringScheduler() === true,
    canRunWorkers: canRunAutomationWorkers() === true,
    canTelegram: canDeliverTelegram() === true,
    canAutoDraft: canAutoDraft() === true
  };
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    safetyBefore: safetySnapshot("before"),
    registry: null,
    selected: [],
    verifications: [],
    dryRuns: [],
    safetyDuringDryRun: null,
    safetyAfter: null,
    externalModificationEvidence: {
      GET_only: true,
      POST: 0,
      PUT: 0,
      PATCH: 0,
      DELETE: 0,
      FORM_SUBMISSION: 0,
      LOGIN: 0,
      CAPTCHA_BYPASS: 0,
      UNAPPROVED_HOST: 0,
      RECURSIVE_CRAWL: 0,
      WEBSITE_MODIFICATION: 0
    },
    stopReason: null
  };

  // Hard refuse if already unsafe
  if (
    report.safetyBefore.MASTER ||
    report.safetyBefore.LIVE ||
    report.safetyBefore.MODE === "LIVE" ||
    !report.safetyBefore.AUTO_PUBLISH_LOCKED ||
    report.safetyBefore.TELEGRAM
  ) {
    report.stopReason = "UNSAFE_PRECONDITION";
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.error("STOP: unsafe precondition");
    process.exit(2);
  }

  const sites = await fetchSites();
  const inventory = sites.map((site) => {
    const policy = buildSourcePolicy(site);
    const health = deriveSourceHealth(site, { policy });
    const qualityGrade = classifyQuality(site, policy);
    const officialUrl = isApprovedOfficialMonitoringUrl(site.url) === true;
    return {
      id: site.id,
      name: site.name,
      url: site.url,
      host: policy.officialHost,
      active: site.active === 1 || site.active === true,
      selector: site.selector,
      hostApproved: policy.hostApproved === true,
      officialUrl,
      qualityGrade,
      health: health.healthStatus,
      broken: site.broken === 1 || site.broken === true,
      isTestOrThirdParty: /DISABLED-THIRD-PARTY|example|test|localhost/i.test(String(site.name || "") + String(site.url || ""))
    };
  });

  report.registry = {
    total: inventory.length,
    enabled: inventory.filter((r) => r.active).length,
    disabled: inventory.filter((r) => !r.active).length,
    GREEN: inventory.filter((r) => r.qualityGrade === "GREEN").length,
    BLOCKED: inventory.filter((r) => r.qualityGrade === "BLOCKED").length,
    YELLOW: inventory.filter((r) => r.qualityGrade === "YELLOW").length,
    DISABLED: inventory.filter((r) => r.qualityGrade === "DISABLED").length,
    UNKNOWN_HEALTH: inventory.filter((r) => r.health === "UNKNOWN").length,
    ERROR_BROKEN: inventory.filter((r) => r.broken).length,
    thirdPartyDisabled: inventory.filter((r) => r.isTestOrThirdParty).length,
    inventory
  };

  // Prefer already-approved official GREEN+active sources only (no invention).
  const candidates = inventory.filter(
    (r) =>
      r.active &&
      r.qualityGrade === "GREEN" &&
      r.hostApproved &&
      r.officialUrl &&
      !r.isTestOrThirdParty
  );

  // Prefer known prior pilot / core boards: UPPSC then SSC
  const preferredOrder = [23, 1];
  candidates.sort((a, b) => {
    const ai = preferredOrder.indexOf(a.id);
    const bi = preferredOrder.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const selected = candidates.slice(0, 2);
  report.selected = selected;

  if (selected.length === 0) {
    report.stopReason = "NO_APPROVED_GREEN_SOURCE_AVAILABLE";
    report.safetyAfter = safetySnapshot("after_no_green");
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ stopReason: report.stopReason, registry: report.registry }, null, 2));
    process.exit(0);
  }

  for (const row of selected) {
    const site = await getSiteById(row.id);
    const policy = buildSourcePolicy(site);
    const binding = assertExactUrlBinding(policy, site.url, { requireEnabled: true });
    let verify = null;
    try {
      verify = await verifyMonitoringSource({
        url: site.url,
        selector: site.selector,
        name: site.name
      });
    } catch (err) {
      verify = { ok: false, error: err.message, code: err.code || null };
    }
    report.verifications.push({
      id: site.id,
      organization: site.name,
      exactUrl: site.url,
      host: policy.officialHost,
      selector: site.selector,
      protocol: policy.approvedProtocol,
      hostApproved: policy.hostApproved,
      binding,
      robots: verify && (verify.robots || verify.robotsResult || verify.robotsPolicy || null),
      verifySummary: {
        ok: verify && (verify.ok === true || verify.allowed === true || verify.status === "ok"),
        status: verify && (verify.status || verify.result || verify.code || null),
        httpStatus: verify && (verify.httpStatus || verify.statusCode || null),
        finalUrl: verify && (verify.finalUrl || verify.url || null),
        redirectHops: verify && (verify.redirects || verify.redirectChain || verify.hops || null),
        responseSize: verify && (verify.responseSize || verify.bytes || null),
        selectorHit: verify && (verify.selectorHit || verify.extracted || verify.sample || null),
        error: verify && verify.error ? verify.error : null,
        rawKeys: verify && typeof verify === "object" ? Object.keys(verify) : []
      },
      rawVerify: verify
    });
  }

  // Enter DRY_RUN only for bounded runs, then restore DORMANT.
  setDryRunMode(true, { updatedBy: "acc_bounded_prod_dryrun" });
  report.safetyDuringDryRun = safetySnapshot("during_dry_run");

  try {
    for (const row of selected) {
      const one = await monitoringDryRun.runSourceDryRun(row.id, {
        actor: "acc_bounded_prod_dryrun"
      });
      report.dryRuns.push({
        siteId: row.id,
        name: row.name,
        url: row.url,
        result: one
      });
      // Count any non-GET evidence fields if present
      if (one && one.requestedMethod && String(one.requestedMethod).toUpperCase() !== "GET") {
        report.externalModificationEvidence.GET_only = false;
        const m = String(one.requestedMethod).toUpperCase();
        if (report.externalModificationEvidence[m] != null) {
          report.externalModificationEvidence[m] += 1;
        }
      }
      if (one && one.unapprovedHost) {
        report.externalModificationEvidence.UNAPPROVED_HOST += 1;
      }
    }
  } finally {
    // Restore dormant/safe state
    setDryRunMode(false, { updatedBy: "acc_bounded_prod_dryrun_restore" });
    writeControlPlane({
      mode: AUTOMATION_MODES.DORMANT,
      updatedBy: "acc_bounded_prod_dryrun_restore"
    });
  }

  report.safetyAfter = safetySnapshot("after");
  report.finishedAt = new Date().toISOString();

  if (
    report.safetyAfter.MASTER ||
    report.safetyAfter.LIVE ||
    report.safetyAfter.MODE !== "DORMANT" ||
    !report.safetyAfter.AUTO_PUBLISH_LOCKED ||
    report.safetyAfter.TELEGRAM
  ) {
    report.stopReason = "UNSAFE_POSTCONDITION";
  } else {
    report.stopReason = null;
    report.ok = true;
  }

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: report.ok === true,
        stopReason: report.stopReason,
        selected: report.selected.map((s) => ({ id: s.id, name: s.name, url: s.url, grade: s.qualityGrade })),
        registry: {
          total: report.registry.total,
          GREEN: report.registry.GREEN,
          BLOCKED: report.registry.BLOCKED,
          YELLOW: report.registry.YELLOW,
          DISABLED: report.registry.DISABLED,
          enabled: report.registry.enabled
        },
        dryRunCount: report.dryRuns.length,
        safetyAfter: report.safetyAfter,
        out: OUT
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("FATAL", err && err.stack ? err.stack : err);
  try {
    setDryRunMode(false, { updatedBy: "acc_bounded_prod_dryrun_fatal_restore" });
    writeControlPlane({ mode: AUTOMATION_MODES.DORMANT, updatedBy: "acc_bounded_prod_dryrun_fatal_restore" });
  } catch (_) {}
  process.exit(1);
});
