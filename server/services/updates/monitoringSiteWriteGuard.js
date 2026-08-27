"use strict";

/**
 * Shared write/activation guard for monitored_sites.
 * Used by ACC sources API and /api/admin/sites create/update/restore.
 */

const {
  assertSafeOfficialMonitoringUrl,
  urlsAreDuplicateNormalized,
  createHttpError
} = require("./monitoringUrlSafety");
const { assertRobotsAllowsMonitoring } = require("./robotsAccessPolicy");
const { fetchSites } = require("./updates.repository");

async function findDuplicateMonitoringUrl(url, excludeId = null) {
  const sites = await fetchSites();
  const exclude = excludeId != null ? Number(excludeId) : null;
  for (const site of sites) {
    if (exclude && Number(site.id) === exclude) continue;
    if (urlsAreDuplicateNormalized(site.url, url)) {
      return site;
    }
  }
  return null;
}

/**
 * @param {object} input
 * @param {string} input.url
 * @param {number|null} [input.excludeId]
 * @param {boolean} [input.requireRobotsAllow=true] — fail-closed robots for activation paths
 * @param {boolean} [input.checkDuplicates=true]
 */
async function assertMonitoringSiteWritable(input = {}) {
  const validated = assertSafeOfficialMonitoringUrl(input.url);
  const checkDuplicates = input.checkDuplicates !== false;
  const requireRobotsAllow = input.requireRobotsAllow !== false;

  if (checkDuplicates) {
    const dup = await findDuplicateMonitoringUrl(validated.url, input.excludeId);
    if (dup) {
      throw createHttpError(409, "Monitoring URL already exists.", "MONITORING_URL_DUPLICATE");
    }
  }

  let robots = null;
  if (requireRobotsAllow) {
    robots = await assertRobotsAllowsMonitoring(validated.url);
  }

  return {
    url: validated.url,
    hostname: validated.hostname,
    compareKey: validated.compareKey,
    robots
  };
}

module.exports = {
  assertMonitoringSiteWritable,
  findDuplicateMonitoringUrl
};
