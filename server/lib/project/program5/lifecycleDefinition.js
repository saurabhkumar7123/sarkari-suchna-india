'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Definition (Configuration-Driven / Versioned)
 *
 * Reusable lifecycle state model governing how a recruitment candidate
 * progresses through the controlled automation pipeline.
 *
 * Advisory / governance only. Does NOT activate automation.
 * Does NOT publish content. Does NOT mutate runtime state.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const LIFECYCLE_DEFINITION_VERSION = '5C.1.0.0';

const LIFECYCLE_STATES = Object.freeze({
  DETECTED: 'Detected',
  NORMALIZED: 'Normalized',
  VALIDATED: 'Validated',
  REVIEW_READY: 'Review Ready',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DRAFT_READY: 'Draft Ready',
  PREVIEW_READY: 'Preview Ready',
  SEO_READY: 'SEO Ready',
  PUBLISH_READY: 'Publish Ready',
  ARCHIVED: 'Archived',
});

const LIFECYCLE_STATE_IDS = Object.freeze(Object.keys(LIFECYCLE_STATES));

const REUSED_MODULE_IDS = Object.freeze({
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
  MONITORING_REVIEW_INTEGRATION: 'MONITORING_REVIEW_INTEGRATION',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  SEO_DIAGNOSTICS: 'SEO_DIAGNOSTICS',
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
});

/**
 * Default lifecycle state configuration.
 * Order is the canonical advisory progression (branches noted in transitions).
 */
const DEFAULT_LIFECYCLE_STATE_CONFIG = deepFreeze([
  {
    stateId: 'DETECTED',
    label: LIFECYCLE_STATES.DETECTED,
    order: 1,
    summary: 'Candidate notice detected from a monitored source.',
    reusedModules: [
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
      REUSED_MODULE_IDS.PIPELINE_HEALTH,
    ],
    terminal: false,
  },
  {
    stateId: 'NORMALIZED',
    label: LIFECYCLE_STATES.NORMALIZED,
    order: 2,
    summary: 'Candidate fields normalized into canonical shapes.',
    reusedModules: [
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    terminal: false,
  },
  {
    stateId: 'VALIDATED',
    label: LIFECYCLE_STATES.VALIDATED,
    order: 3,
    summary: 'Candidate passed advisory validation diagnostics.',
    reusedModules: [
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.PIPELINE_HEALTH,
    ],
    terminal: false,
  },
  {
    stateId: 'REVIEW_READY',
    label: LIFECYCLE_STATES.REVIEW_READY,
    order: 4,
    summary: 'Candidate is ready for human editorial review intake.',
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
    ],
    terminal: false,
  },
  {
    stateId: 'UNDER_REVIEW',
    label: LIFECYCLE_STATES.UNDER_REVIEW,
    order: 5,
    summary: 'Candidate is actively under human editorial review.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
    terminal: false,
  },
  {
    stateId: 'APPROVED',
    label: LIFECYCLE_STATES.APPROVED,
    order: 6,
    summary: 'Human review approved the candidate for draft preparation.',
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    terminal: false,
  },
  {
    stateId: 'REJECTED',
    label: LIFECYCLE_STATES.REJECTED,
    order: 7,
    summary: 'Human review rejected the candidate; no further automation.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
    terminal: true,
  },
  {
    stateId: 'DRAFT_READY',
    label: LIFECYCLE_STATES.DRAFT_READY,
    order: 8,
    summary: 'Draft content is prepared and ready for shared preview.',
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    terminal: false,
  },
  {
    stateId: 'PREVIEW_READY',
    label: LIFECYCLE_STATES.PREVIEW_READY,
    order: 9,
    summary: 'Shared Preview is available for operator inspection.',
    reusedModules: [REUSED_MODULE_IDS.SHARED_PREVIEW],
    terminal: false,
  },
  {
    stateId: 'SEO_READY',
    label: LIFECYCLE_STATES.SEO_READY,
    order: 10,
    summary: 'SEO diagnostics indicate readiness for publish assessment.',
    reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
    terminal: false,
  },
  {
    stateId: 'PUBLISH_READY',
    label: LIFECYCLE_STATES.PUBLISH_READY,
    order: 11,
    summary: 'Publish readiness gates satisfied (advisory — no publish).',
    reusedModules: [
      REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    terminal: false,
  },
  {
    stateId: 'ARCHIVED',
    label: LIFECYCLE_STATES.ARCHIVED,
    order: 12,
    summary: 'Candidate lifecycle archived; no further progression.',
    reusedModules: [REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS],
    terminal: true,
  },
]);

/**
 * Normalize a state identifier or label to a canonical stateId.
 * @param {string} value
 * @returns {string|null}
 */
function normalizeLifecycleState(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (Object.prototype.hasOwnProperty.call(LIFECYCLE_STATES, trimmed)) {
    return trimmed;
  }
  const upper = trimmed.toUpperCase().replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(LIFECYCLE_STATES, upper)) {
    return upper;
  }
  const entries = Object.entries(LIFECYCLE_STATES);
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i][1].toLowerCase() === trimmed.toLowerCase()) {
      return entries[i][0];
    }
  }
  return null;
}

/**
 * Create a versioned lifecycle definition from configuration.
 * @param {object} [options]
 * @param {object[]} [options.states] custom state configs
 * @param {string} [options.version]
 */
function createLifecycleDefinition(options = {}) {
  const states = Array.isArray(options.states) && options.states.length
    ? options.states.map((s, index) => ({
        stateId: String(s.stateId),
        label:
          typeof s.label === 'string' && s.label.trim()
            ? s.label.trim()
            : String(s.stateId),
        order:
          typeof s.order === 'number' && Number.isFinite(s.order)
            ? s.order
            : index + 1,
        summary: typeof s.summary === 'string' ? s.summary : '',
        reusedModules: Array.isArray(s.reusedModules)
          ? s.reusedModules.map(String)
          : [],
        terminal: Boolean(s.terminal),
      }))
    : DEFAULT_LIFECYCLE_STATE_CONFIG.map((s) => ({
        stateId: s.stateId,
        label: s.label,
        order: s.order,
        summary: s.summary,
        reusedModules: s.reusedModules.slice(),
        terminal: s.terminal,
      }));

  const byId = {};
  for (let i = 0; i < states.length; i += 1) {
    byId[states[i].stateId] = states[i];
  }

  const ordered = states.slice().sort((a, b) => a.order - b.order);

  return deepFreeze({
    definitionId: 'CONTROLLED_LIFECYCLE_DEFINITION',
    version:
      typeof options.version === 'string' && options.version.trim()
        ? options.version.trim()
        : LIFECYCLE_DEFINITION_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    stateCount: ordered.length,
    states: ordered,
    stateIds: ordered.map((s) => s.stateId),
    byId,
    labels: Object.assign({}, LIFECYCLE_STATES),
    reusedModules: Object.values(REUSED_MODULE_IDS),
  });
}

function getDefaultLifecycleDefinition() {
  return createLifecycleDefinition();
}

module.exports = {
  LIFECYCLE_DEFINITION_VERSION,
  LIFECYCLE_STATES,
  LIFECYCLE_STATE_IDS,
  REUSED_MODULE_IDS,
  DEFAULT_LIFECYCLE_STATE_CONFIG,
  deepFreeze,
  normalizeLifecycleState,
  createLifecycleDefinition,
  getDefaultLifecycleDefinition,
};
