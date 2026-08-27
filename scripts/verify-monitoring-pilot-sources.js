"use strict";

/**
 * Controlled pilot verification (read-only).
 * Does NOT insert sources, does NOT enable crawler, does NOT publish.
 *
 * Checks for each candidate:
 * - official host
 * - URL parse / private host rejection
 * - robots/access policy (fail-closed semantics)
 *
 * Usage: node scripts/verify-monitoring-pilot-sources.js
 */

require("dotenv").config();
const {
  assertSafeOfficialMonitoringUrl
} = require("../server/services/updates/monitoringUrlSafety");
const {
  evaluateRobotsAccessPolicy,
  clearRobotsPolicyCache
} = require("../server/services/updates/robotsAccessPolicy");

/** Proposed 10–15 exact official pages for a future pilot (not activated by this script). */
const PILOT_CANDIDATES = [
  {
    organization: "SSC",
    url: "https://ssc.gov.in/api/general-website/portal/notice-boards",
    purpose: "recruitment notices (API path used when SSC_USE_API=1; verify HTML page separately for HTML mode)",
    selector: "body"
  },
  {
    organization: "SSC",
    url: "https://ssc.gov.in/",
    purpose: "SSC portal landing / notice entry",
    selector: "a"
  },
  {
    organization: "UPSC",
    url: "https://www.upsc.gov.in/whats-new",
    purpose: "what's new / notices",
    selector: "a"
  },
  {
    organization: "UPSC",
    url: "https://www.upsc.gov.in/examinations",
    purpose: "examinations hub",
    selector: "a"
  },
  {
    organization: "IBPS",
    url: "https://www.ibps.in/",
    purpose: "bank recruitment notices hub",
    selector: "a"
  },
  {
    organization: "NTA",
    url: "https://www.nta.ac.in/",
    purpose: "exam notices hub",
    selector: "a"
  },
  {
    organization: "RRB",
    url: "https://www.rrbcdg.gov.in/",
    purpose: "railway recruitment board CEN notices",
    selector: "a"
  },
  {
    organization: "India Post",
    url: "https://www.indiapost.gov.in/",
    purpose: "postal recruitment / notices entry",
    selector: "a"
  },
  {
    organization: "ESIC",
    url: "https://www.esic.gov.in/",
    purpose: "recruitment notices",
    selector: "a"
  },
  {
    organization: "DRDO",
    url: "https://www.drdo.gov.in/",
    purpose: "career / recruitment notices",
    selector: "a"
  },
  {
    organization: "CGPDTM",
    url: "https://ipindia.gov.in/",
    purpose: "recruitment / vacancy notices",
    selector: "a"
  },
  {
    organization: "UIDAI",
    url: "https://uidai.gov.in/",
    purpose: "career notices",
    selector: "a"
  }
];

async function verifyOne(candidate) {
  const row = {
    organization: candidate.organization,
    exactUrl: candidate.url,
    contentPurpose: candidate.purpose,
    selector: candidate.selector,
    officialHostVerification: null,
    policyRobotsResult: null,
    monitoringResult: "not_run",
    status: "pending"
  };

  try {
    const validated = assertSafeOfficialMonitoringUrl(candidate.url);
    row.officialHostVerification = {
      ok: true,
      hostname: validated.hostname,
      compareKey: validated.compareKey
    };
  } catch (err) {
    row.officialHostVerification = { ok: false, message: err.message, code: err.code };
    row.status = "rejected_official_host";
    return row;
  }

  try {
    const robots = await evaluateRobotsAccessPolicy(candidate.url, { bypassCache: true });
    row.policyRobotsResult = {
      allowed: robots.allowed,
      reason: robots.reason,
      status: robots.status,
      crawlDelayMs: robots.crawlDelayMs || 0,
      failClosed: robots.failClosed === true
    };
    if (!robots.allowed) {
      row.status = "restricted_robots_or_unclear";
      return row;
    }
  } catch (err) {
    row.policyRobotsResult = { allowed: false, message: err.message };
    row.status = "restricted_robots_or_unclear";
    return row;
  }

  row.status = "verified_ready_for_manual_activation";
  row.monitoringResult = "policy_ok_awaiting_controlled_activation";
  return row;
}

async function main() {
  clearRobotsPolicyCache();
  const results = [];
  for (const candidate of PILOT_CANDIDATES) {
    // Sequential to respect per-host politeness when hitting robots.txt
    // eslint-disable-next-line no-await-in-loop
    results.push(await verifyOne(candidate));
  }

  const ready = results.filter((r) => r.status === "verified_ready_for_manual_activation");
  const blocked = results.filter((r) => r.status !== "verified_ready_for_manual_activation");

  console.log(
    JSON.stringify(
      {
        note: "Read-only verification only. No sources inserted. AUTO_PUBLISH untouched.",
        total: results.length,
        readyCount: ready.length,
        blockedCount: blocked.length,
        results
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
