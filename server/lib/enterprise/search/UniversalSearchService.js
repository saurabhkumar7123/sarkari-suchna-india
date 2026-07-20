"use strict";

const recruitmentEnterpriseRepository = require("../../../repositories/enterprise/recruitmentEnterprise.repository");
const draftEnterpriseRepository = require("../../../repositories/enterprise/draftEnterprise.repository");
const workflowEnterpriseRepository = require("../../../repositories/enterprise/workflowEnterprise.repository");
const reviewQueueEnterpriseRepository = require("../../../repositories/enterprise/reviewQueueEnterprise.repository");
const auditEnterpriseRepository = require("../../../repositories/enterprise/auditEnterprise.repository");
const metricsEnterpriseRepository = require("../../../repositories/enterprise/metricsEnterprise.repository");
const automationSettingsRepository = require("../../../repositories/automationSettings.repository");
const { matchesSearch } = require("../base/searchBuilder");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../base/pagination");

const ENTITY_SEARCHERS = Object.freeze({
  recruitments: (opts) => recruitmentEnterpriseRepository.search(opts),
  drafts: (opts) => draftEnterpriseRepository.search(opts),
  workflow: (opts) => workflowEnterpriseRepository.search(opts),
  audit: (opts) => auditEnterpriseRepository.listEvents(opts),
  metrics: (opts) => metricsEnterpriseRepository.listMetrics(opts)
});

async function searchAll(opts = {}) {
  const entities = String(opts.entities || "recruitments,drafts,workflow,audit,metrics")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit, 20, 100);
  const results = {};

  for (const entity of entities) {
    if (entity === "sources" || entity === "settings") {
      const settings = automationSettingsRepository.readSettings();
      const rows = [
        {
          type: "settings",
          id: "automation-settings",
          title: "Automation Settings",
          payload: settings
        }
      ];
      results[entity] = buildPaginationResult({
        page: 1,
        limit: rows.length,
        total: rows.length,
        data: rows.filter((row) => matchesSearch(row, opts.search, ["title", "type"]))
      });
      continue;
    }

    const searcher = ENTITY_SEARCHERS[entity];
    if (!searcher) {
      results[entity] = buildPaginationResult({ page: 1, limit, total: 0, data: [] });
      continue;
    }
    results[entity] = await searcher({
      ...opts,
      page: 1,
      limit: 100
    });
  }

  const merged = [];
  for (const [entity, payload] of Object.entries(results)) {
    for (const row of payload.data) {
      merged.push({ entity, ...row });
    }
  }

  const filtered = merged.filter((row) => {
    if (!opts.search) return true;
    return matchesSearch(row, opts.search, ["title", "slug", "workflow_key", "action", "metric_type"]);
  });

  const offset = buildOffset(page, limit);
  return {
    results,
    unified: buildPaginationResult({
      page,
      limit,
      total: filtered.length,
      data: filtered.slice(offset, offset + limit)
    })
  };
}

module.exports = {
  ENTITY_SEARCHERS,
  searchAll
};
