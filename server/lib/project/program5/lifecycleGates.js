'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Gates (Reusable / Advisory)
 *
 * Advisory gates evaluated before entering a lifecycle state.
 * Reusable across states. Diagnostics only — never auto-advance.
 *
 * Reuses module identities from:
 *   Pipeline Health, Monitoring Review Integration, Editorial Review,
 *   Shared Preview, SEO Diagnostics, Recruitment Operations.
 */

const {
  deepFreeze,
  normalizeLifecycleState,
  REUSED_MODULE_IDS,
  getDefaultLifecycleDefinition,
} = require('./lifecycleDefinition');

const LIFECYCLE_GATES_VERSION = '5C.1.0.0';

const GATE_IDS = Object.freeze({
  REQUIRED_METADATA: 'REQUIRED_METADATA',
  REQUIRED_VALIDATION: 'REQUIRED_VALIDATION',
  EDITORIAL_CHECKLIST: 'EDITORIAL_CHECKLIST',
  SHARED_PREVIEW_AVAILABILITY: 'SHARED_PREVIEW_AVAILABILITY',
  SEO_VALIDATION: 'SEO_VALIDATION',
  HUMAN_APPROVAL: 'HUMAN_APPROVAL',
});

/**
 * Reusable gate catalog (configuration-driven).
 */
const DEFAULT_GATE_CATALOG = deepFreeze([
  {
    gateId: GATE_IDS.REQUIRED_METADATA,
    name: 'Required Metadata',
    summary: 'Required candidate metadata fields must be present.',
    reusedModules: [
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    prerequisiteHint: 'METADATA_COMPLETE',
  },
  {
    gateId: GATE_IDS.REQUIRED_VALIDATION,
    name: 'Required Validation',
    summary: 'Advisory validation diagnostics must not block progression.',
    reusedModules: [
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.PIPELINE_HEALTH,
    ],
    prerequisiteHint: 'VALIDATION_PASS',
  },
  {
    gateId: GATE_IDS.EDITORIAL_CHECKLIST,
    name: 'Editorial Checklist',
    summary: 'Editorial checklist items must be satisfied for review states.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
    prerequisiteHint: 'EDITORIAL_CHECKLIST_COMPLETE',
  },
  {
    gateId: GATE_IDS.SHARED_PREVIEW_AVAILABILITY,
    name: 'Shared Preview Availability',
    summary: 'Shared Preview snapshot must be available for inspection.',
    reusedModules: [REUSED_MODULE_IDS.SHARED_PREVIEW],
    prerequisiteHint: 'SHARED_PREVIEW_AVAILABLE',
  },
  {
    gateId: GATE_IDS.SEO_VALIDATION,
    name: 'SEO Validation',
    summary: 'SEO diagnostics must indicate advisory readiness.',
    reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
    prerequisiteHint: 'SEO_VALIDATION_PASS',
  },
  {
    gateId: GATE_IDS.HUMAN_APPROVAL,
    name: 'Human Approval',
    summary: 'Human approval decision must be recorded before draft readiness.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
    prerequisiteHint: 'HUMAN_APPROVAL_RECORDED',
  },
]);

/**
 * Default mapping: target state → required gate IDs before entry.
 */
const DEFAULT_STATE_GATE_MAP = deepFreeze({
  DETECTED: [],
  NORMALIZED: [GATE_IDS.REQUIRED_METADATA],
  VALIDATED: [GATE_IDS.REQUIRED_METADATA, GATE_IDS.REQUIRED_VALIDATION],
  REVIEW_READY: [
    GATE_IDS.REQUIRED_METADATA,
    GATE_IDS.REQUIRED_VALIDATION,
    GATE_IDS.EDITORIAL_CHECKLIST,
  ],
  UNDER_REVIEW: [GATE_IDS.EDITORIAL_CHECKLIST],
  APPROVED: [GATE_IDS.HUMAN_APPROVAL, GATE_IDS.EDITORIAL_CHECKLIST],
  REJECTED: [GATE_IDS.HUMAN_APPROVAL],
  DRAFT_READY: [GATE_IDS.HUMAN_APPROVAL],
  PREVIEW_READY: [GATE_IDS.SHARED_PREVIEW_AVAILABILITY],
  SEO_READY: [GATE_IDS.SHARED_PREVIEW_AVAILABILITY, GATE_IDS.SEO_VALIDATION],
  PUBLISH_READY: [GATE_IDS.SEO_VALIDATION, GATE_IDS.HUMAN_APPROVAL],
  ARCHIVED: [],
});

/**
 * Create a reusable gate registry.
 * @param {object} [options]
 * @param {object[]} [options.gates]
 * @param {object} [options.stateGateMap]
 * @param {object} [options.definition]
 */
function createLifecycleGateRegistry(options = {}) {
  const definition = options.definition || getDefaultLifecycleDefinition();
  const gates =
    Array.isArray(options.gates) && options.gates.length
      ? options.gates.map((g) => ({
          gateId: String(g.gateId),
          name: typeof g.name === 'string' ? g.name : String(g.gateId),
          summary: typeof g.summary === 'string' ? g.summary : '',
          reusedModules: Array.isArray(g.reusedModules)
            ? g.reusedModules.map(String)
            : [],
          prerequisiteHint:
            typeof g.prerequisiteHint === 'string' ? g.prerequisiteHint : null,
        }))
      : DEFAULT_GATE_CATALOG.map((g) => ({
          gateId: g.gateId,
          name: g.name,
          summary: g.summary,
          reusedModules: g.reusedModules.slice(),
          prerequisiteHint: g.prerequisiteHint,
        }));

  const byId = {};
  for (let i = 0; i < gates.length; i += 1) {
    byId[gates[i].gateId] = gates[i];
  }

  const rawMap =
    options.stateGateMap && typeof options.stateGateMap === 'object'
      ? options.stateGateMap
      : DEFAULT_STATE_GATE_MAP;

  const stateGateMap = {};
  for (let i = 0; i < definition.stateIds.length; i += 1) {
    const stateId = definition.stateIds[i];
    const gateIds = Array.isArray(rawMap[stateId])
      ? rawMap[stateId].map(String).filter((id) => byId[id])
      : [];
    stateGateMap[stateId] = gateIds;
  }

  return deepFreeze({
    registryId: 'CONTROLLED_LIFECYCLE_GATE_REGISTRY',
    version: LIFECYCLE_GATES_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    reusable: true,
    automaticAdvancement: false,
    gates,
    gateIds: gates.map((g) => g.gateId),
    byId,
    stateGateMap,
    definitionVersion: definition.version,
  });
}

function getDefaultLifecycleGateRegistry(definition) {
  return createLifecycleGateRegistry({ definition });
}

/**
 * List gates required before entering a target state.
 * @param {string} targetState
 * @param {object} [registry]
 * @returns {object[]}
 */
function listGatesForState(targetState, registry) {
  const resolved = registry || getDefaultLifecycleGateRegistry();
  const stateId = normalizeLifecycleState(targetState);
  if (!stateId || !resolved.stateGateMap[stateId]) return [];
  return resolved.stateGateMap[stateId]
    .map((id) => resolved.byId[id])
    .filter(Boolean);
}

/**
 * Evaluate gates for a target state against provided observations.
 *
 * Observation shape (advisory input only):
 *   { satisfiedGates: string[], failedGates: string[],
 *     availablePrerequisites: string[] }
 *
 * @param {string} targetState
 * @param {object} [observations]
 * @param {object} [registry]
 */
function evaluateLifecycleGates(targetState, observations = {}, registry) {
  const resolved = registry || getDefaultLifecycleGateRegistry();
  const stateId = normalizeLifecycleState(targetState);
  const required = listGatesForState(stateId, resolved);

  const satisfiedSet = new Set(
    (Array.isArray(observations.satisfiedGates)
      ? observations.satisfiedGates
      : []
    ).map(String)
  );
  const failedSet = new Set(
    (Array.isArray(observations.failedGates)
      ? observations.failedGates
      : []
    ).map(String)
  );
  const availablePrereqs = new Set(
    (Array.isArray(observations.availablePrerequisites)
      ? observations.availablePrerequisites
      : []
    ).map(String)
  );

  const results = [];
  const passed = [];
  const failed = [];
  const missing = [];

  for (let i = 0; i < required.length; i += 1) {
    const gate = required[i];
    let status = 'PENDING';

    if (failedSet.has(gate.gateId)) {
      status = 'FAILED';
      failed.push(gate.gateId);
    } else if (satisfiedSet.has(gate.gateId)) {
      status = 'PASSED';
      passed.push(gate.gateId);
    } else if (
      gate.prerequisiteHint &&
      availablePrereqs.has(gate.prerequisiteHint)
    ) {
      status = 'PASSED';
      passed.push(gate.gateId);
      satisfiedSet.add(gate.gateId);
    } else {
      status = 'MISSING';
      missing.push(gate.gateId);
    }

    results.push({
      gateId: gate.gateId,
      name: gate.name,
      status,
      summary: gate.summary,
      reusedModules: gate.reusedModules,
      prerequisiteHint: gate.prerequisiteHint,
    });
  }

  return deepFreeze({
    evaluationId: 'LIFECYCLE_GATE_EVALUATION',
    version: LIFECYCLE_GATES_VERSION,
    advisoryOnly: true,
    automaticAdvancement: false,
    targetState: stateId,
    requiredGateCount: required.length,
    results,
    passed,
    failed,
    missing,
    allPassed: failed.length === 0 && missing.length === 0,
    blocking: failed.length > 0 || missing.length > 0,
  });
}

module.exports = {
  LIFECYCLE_GATES_VERSION,
  GATE_IDS,
  DEFAULT_GATE_CATALOG,
  DEFAULT_STATE_GATE_MAP,
  createLifecycleGateRegistry,
  getDefaultLifecycleGateRegistry,
  listGatesForState,
  evaluateLifecycleGates,
};
