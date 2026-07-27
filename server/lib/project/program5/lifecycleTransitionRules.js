'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Transition Rules (Configuration-Driven)
 *
 * Defines allowed state transitions for the controlled Lifecycle Engine.
 * Invalid transitions produce diagnostics only — no automatic correction.
 */

const {
  deepFreeze,
  normalizeLifecycleState,
  getDefaultLifecycleDefinition,
} = require('./lifecycleDefinition');

const LIFECYCLE_TRANSITION_RULES_VERSION = '5C.1.0.0';

/**
 * Default allowed edges: fromStateId → [toStateId, ...]
 */
const DEFAULT_TRANSITION_TABLE = deepFreeze({
  DETECTED: ['NORMALIZED'],
  NORMALIZED: ['VALIDATED'],
  VALIDATED: ['REVIEW_READY'],
  REVIEW_READY: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['DRAFT_READY'],
  REJECTED: [],
  DRAFT_READY: ['PREVIEW_READY'],
  PREVIEW_READY: ['SEO_READY'],
  SEO_READY: ['PUBLISH_READY'],
  PUBLISH_READY: ['ARCHIVED'],
  ARCHIVED: [],
});

/**
 * Create transition rules from configuration.
 * @param {object} [options]
 * @param {object} [options.transitionTable] map of from → to[]
 * @param {object} [options.definition] lifecycle definition
 */
function createLifecycleTransitionRules(options = {}) {
  const definition = options.definition || getDefaultLifecycleDefinition();
  const rawTable =
    options.transitionTable && typeof options.transitionTable === 'object'
      ? options.transitionTable
      : DEFAULT_TRANSITION_TABLE;

  const table = {};
  const edges = [];
  const stateIds = definition.stateIds;

  for (let i = 0; i < stateIds.length; i += 1) {
    const fromId = stateIds[i];
    const targets = Array.isArray(rawTable[fromId])
      ? rawTable[fromId].map(String)
      : [];
    const allowed = [];
    for (let j = 0; j < targets.length; j += 1) {
      const toId = normalizeLifecycleState(targets[j]) || targets[j];
      if (definition.byId[toId] && allowed.indexOf(toId) === -1) {
        allowed.push(toId);
        edges.push({ from: fromId, to: toId });
      }
    }
    table[fromId] = allowed;
  }

  return deepFreeze({
    rulesId: 'CONTROLLED_LIFECYCLE_TRANSITION_RULES',
    version: LIFECYCLE_TRANSITION_RULES_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    automaticCorrection: false,
    definitionVersion: definition.version,
    table,
    edges,
    edgeCount: edges.length,
  });
}

function getDefaultLifecycleTransitionRules(definition) {
  return createLifecycleTransitionRules({ definition });
}

/**
 * List allowed next state IDs from a given state.
 * @param {string} fromState
 * @param {object} [rules]
 * @returns {string[]}
 */
function listAllowedNextStates(fromState, rules) {
  const resolved = rules || getDefaultLifecycleTransitionRules();
  const fromId = normalizeLifecycleState(fromState);
  if (!fromId || !resolved.table[fromId]) return [];
  return resolved.table[fromId].slice();
}

/**
 * Check whether a transition is allowed by the rules table.
 * @param {string} fromState
 * @param {string} toState
 * @param {object} [rules]
 * @returns {boolean}
 */
function isLifecycleTransitionAllowed(fromState, toState, rules) {
  const fromId = normalizeLifecycleState(fromState);
  const toId = normalizeLifecycleState(toState);
  if (!fromId || !toId) return false;
  const allowed = listAllowedNextStates(fromId, rules);
  return allowed.indexOf(toId) !== -1;
}

module.exports = {
  LIFECYCLE_TRANSITION_RULES_VERSION,
  DEFAULT_TRANSITION_TABLE,
  createLifecycleTransitionRules,
  getDefaultLifecycleTransitionRules,
  listAllowedNextStates,
  isLifecycleTransitionAllowed,
};
