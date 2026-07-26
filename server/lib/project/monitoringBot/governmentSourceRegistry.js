'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Government Source Registry (Configuration-Driven / Advisory Only)
 *
 * Reusable registry of government monitoring sources.
 * Configuration only. No HTTP. No crawling. No scheduling.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const GOVERNMENT_SOURCE_REGISTRY_VERSION = 'MB1.1.0.0';

const SOURCE_CATEGORIES = Object.freeze({
  CENTRAL_EXAM: 'CENTRAL_EXAM',
  BANKING: 'BANKING',
  RAILWAY: 'RAILWAY',
  DEFENCE: 'DEFENCE',
  STATE: 'STATE',
  OTHER: 'OTHER',
});

const REUSED_GOVERNANCE_MODULE_IDS = Object.freeze({
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
  MONITORING_REVIEW_INTEGRATION: 'MONITORING_REVIEW_INTEGRATION',
  ADMIN_DASHBOARD: 'ADMIN_DASHBOARD',
  PUBLISH_READINESS_AUTHORIZATION: 'PUBLISH_READINESS_AUTHORIZATION',
});

/**
 * Canonical default government monitoring sources (configuration only).
 * URLs are registry metadata — never fetched by this package.
 */
const DEFAULT_SOURCE_CONFIG = deepFreeze([
  {
    sourceId: 'SSC_NIC',
    displayName: 'Staff Selection Commission',
    organization: 'Staff Selection Commission',
    department: 'DoPT',
    category: SOURCE_CATEGORIES.CENTRAL_EXAM,
    baseUrl: 'https://ssc.nic.in',
    recruitmentUrl: 'https://ssc.nic.in/Portal/Apply',
    resultUrl: 'https://ssc.nic.in/Portal/Results',
    noticeUrl: 'https://ssc.nic.in/Portal/LatestNews',
    rssUrl: null,
    active: true,
  },
  {
    sourceId: 'UPSC',
    displayName: 'Union Public Service Commission',
    organization: 'Union Public Service Commission',
    department: 'DoPT',
    category: SOURCE_CATEGORIES.CENTRAL_EXAM,
    baseUrl: 'https://www.upsc.gov.in',
    recruitmentUrl: 'https://www.upsc.gov.in/examinations',
    resultUrl: 'https://www.upsc.gov.in/examinations/results',
    noticeUrl: 'https://www.upsc.gov.in/whats-new',
    rssUrl: null,
    active: true,
  },
  {
    sourceId: 'IBPS',
    displayName: 'Institute of Banking Personnel Selection',
    organization: 'IBPS',
    department: 'Banking',
    category: SOURCE_CATEGORIES.BANKING,
    baseUrl: 'https://www.ibps.in',
    recruitmentUrl: 'https://www.ibps.in/html/cand_app.htm',
    resultUrl: 'https://www.ibps.in/html/cand_res.htm',
    noticeUrl: 'https://www.ibps.in',
    rssUrl: null,
    active: true,
  },
  {
    sourceId: 'RRB',
    displayName: 'Railway Recruitment Boards',
    organization: 'Indian Railways',
    department: 'Ministry of Railways',
    category: SOURCE_CATEGORIES.RAILWAY,
    baseUrl: 'https://www.rrbcdg.gov.in',
    recruitmentUrl: 'https://www.rrbcdg.gov.in',
    resultUrl: 'https://www.rrbcdg.gov.in',
    noticeUrl: 'https://www.rrbcdg.gov.in',
    rssUrl: null,
    active: true,
  },
  {
    sourceId: 'NTA',
    displayName: 'National Testing Agency',
    organization: 'National Testing Agency',
    department: 'Ministry of Education',
    category: SOURCE_CATEGORIES.CENTRAL_EXAM,
    baseUrl: 'https://nta.ac.in',
    recruitmentUrl: 'https://nta.ac.in',
    resultUrl: 'https://nta.ac.in',
    noticeUrl: 'https://nta.ac.in',
    rssUrl: null,
    active: false,
  },
]);

function normalizeOptionalUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSource(source, index) {
  const sourceId =
    typeof source.sourceId === 'string' && source.sourceId.trim()
      ? source.sourceId.trim()
      : `CUSTOM_SOURCE_${index + 1}`;

  return {
    sourceId,
    displayName:
      typeof source.displayName === 'string' && source.displayName.trim()
        ? source.displayName.trim()
        : sourceId,
    organization:
      typeof source.organization === 'string' && source.organization.trim()
        ? source.organization.trim()
        : '',
    department:
      typeof source.department === 'string' && source.department.trim()
        ? source.department.trim()
        : '',
    category:
      typeof source.category === 'string' && source.category.trim()
        ? source.category.trim()
        : SOURCE_CATEGORIES.OTHER,
    baseUrl:
      typeof source.baseUrl === 'string' && source.baseUrl.trim()
        ? source.baseUrl.trim()
        : '',
    recruitmentUrl:
      typeof source.recruitmentUrl === 'string' && source.recruitmentUrl.trim()
        ? source.recruitmentUrl.trim()
        : '',
    resultUrl:
      typeof source.resultUrl === 'string' && source.resultUrl.trim()
        ? source.resultUrl.trim()
        : '',
    noticeUrl:
      typeof source.noticeUrl === 'string' && source.noticeUrl.trim()
        ? source.noticeUrl.trim()
        : '',
    rssUrl: normalizeOptionalUrl(source.rssUrl),
    active: source.active !== false,
  };
}

function normalizeSourceConfig(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return DEFAULT_SOURCE_CONFIG.map((s) => ({ ...s }));
  }
  return sources.map((source, index) => normalizeSource(source || {}, index));
}

/**
 * Build a reusable, configuration-driven government source registry.
 * @param {object} [options]
 * @param {Array<object>} [options.sources]
 */
function createGovernmentSourceRegistry(options = {}) {
  const sources = normalizeSourceConfig(options && options.sources);
  const byId = {};
  for (let i = 0; i < sources.length; i += 1) {
    byId[sources[i].sourceId] = sources[i];
  }

  const ordered = sources
    .slice()
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  const activeSources = ordered.filter((s) => s.active);
  const inactiveSources = ordered.filter((s) => !s.active);

  return deepFreeze({
    registryVersion: GOVERNMENT_SOURCE_REGISTRY_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    reusable: true,
    versioned: true,
    deterministic: true,
    executionEngine: false,
    httpRequestsDenied: true,
    websiteVisitsDenied: true,
    scrapingDenied: true,
    schedulingDenied: true,
    sourceCount: ordered.length,
    activeCount: activeSources.length,
    inactiveCount: inactiveSources.length,
    sourceIds: ordered.map((s) => s.sourceId),
    sources: ordered,
    activeSources,
    inactiveSources,
    byId,
    reusedGovernanceModuleIds: { ...REUSED_GOVERNANCE_MODULE_IDS },
    defaultSourceIds: DEFAULT_SOURCE_CONFIG.map((s) => s.sourceId),
  });
}

function getDefaultGovernmentSourceRegistry() {
  return createGovernmentSourceRegistry();
}

function getGovernmentSource(registry, sourceId) {
  if (!registry || !registry.byId || typeof sourceId !== 'string') {
    return null;
  }
  return registry.byId[sourceId] || null;
}

function listGovernmentSources(registry) {
  if (!registry || !Array.isArray(registry.sources)) {
    return [];
  }
  return registry.sources.slice();
}

function listActiveGovernmentSources(registry) {
  if (!registry || !Array.isArray(registry.activeSources)) {
    return [];
  }
  return registry.activeSources.slice();
}

module.exports = {
  GOVERNMENT_SOURCE_REGISTRY_VERSION,
  SOURCE_CATEGORIES,
  REUSED_GOVERNANCE_MODULE_IDS,
  DEFAULT_SOURCE_CONFIG,
  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
  listGovernmentSources,
  listActiveGovernmentSources,
};
