'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Dashboard Model (Read-Only / Advisory)
 *
 * Read-only dashboard model showing:
 *   - Current state
 *   - Previous state
 *   - Allowed next states
 *   - Failed gates
 *   - Diagnostics
 *   - Transition history summary
 *
 * Do not wire runtime routes.
 */

const {
  deepFreeze,
  normalizeLifecycleState,
  getDefaultLifecycleDefinition,
  REUSED_MODULE_IDS,
} = require('./lifecycleDefinition');
const {
  getDefaultLifecycleTransitionRules,
  listAllowedNextStates,
} = require('./lifecycleTransitionRules');
const {
  getDefaultLifecycleGateRegistry,
  evaluateLifecycleGates,
} = require('./lifecycleGates');
const {
  buildLifecycleHistory,
  summarizeLifecycleHistory,
} = require('./lifecycleHistory');
const { generateLifecycleReadinessReport } = require('./lifecycleReadinessReport');

const LIFECYCLE_DASHBOARD_VERSION = '5C.1.0.0';

/**
 * Generate a read-only lifecycle dashboard model.
 *
 * @param {object} [input]
 * @param {string} [input.currentState]
 * @param {string} [input.previousState]
 * @param {object} [input.gateObservations]
 * @param {object[]} [input.historyRecords]
 * @param {object} [input.definition]
 * @param {object} [input.rules]
 * @param {object} [input.gateRegistry]
 * @param {string} [input.lastEvaluatedAt]
 */
function generateLifecycleDashboard(input = {}) {
  const definition = input.definition || getDefaultLifecycleDefinition();
  const rules =
    input.rules || getDefaultLifecycleTransitionRules(definition);
  const gateRegistry =
    input.gateRegistry || getDefaultLifecycleGateRegistry(definition);

  const currentState = normalizeLifecycleState(input.currentState);
  const previousState = normalizeLifecycleState(input.previousState);
  const allowedNextStates = currentState
    ? listAllowedNextStates(currentState, rules)
    : [];

  const history = buildLifecycleHistory({
    records: Array.isArray(input.historyRecords) ? input.historyRecords : [],
  });
  const historySummary = summarizeLifecycleHistory(history);

  const inferredPrevious =
    previousState ||
    historySummary.latestPreviousState ||
    (history.records.length > 0
      ? history.records[history.records.length - 1].previousState
      : null);

  const readiness = generateLifecycleReadinessReport({
    currentState,
    gateObservations: input.gateObservations || {},
    definition,
    rules,
    gateRegistry,
  });

  const failedGates = [];
  const gateDiagnostics = [];

  for (let i = 0; i < allowedNextStates.length; i += 1) {
    const evalNext = evaluateLifecycleGates(
      allowedNextStates[i],
      input.gateObservations || {},
      gateRegistry
    );
    for (let j = 0; j < evalNext.failed.length; j += 1) {
      if (failedGates.indexOf(evalNext.failed[j]) === -1) {
        failedGates.push(evalNext.failed[j]);
      }
    }
    for (let j = 0; j < evalNext.results.length; j += 1) {
      const r = evalNext.results[j];
      if (r.status === 'FAILED' || r.status === 'MISSING') {
        gateDiagnostics.push({
          targetState: allowedNextStates[i],
          gateId: r.gateId,
          status: r.status,
          message: `${r.name} is ${r.status.toLowerCase()} for ${allowedNextStates[i]}`,
        });
      }
    }
  }

  const diagnostics = [
    ...gateDiagnostics,
    ...readiness.transitionDiagnostics.map((d) => ({
      code: d.code,
      severity: d.severity,
      message: d.message,
      detail: d.detail,
    })),
  ];

  const currentMeta = currentState ? definition.byId[currentState] : null;
  const previousMeta = inferredPrevious
    ? definition.byId[inferredPrevious]
    : null;

  const stateRows = definition.states.map((s) => ({
    stateId: s.stateId,
    label: s.label,
    order: s.order,
    terminal: s.terminal,
    isCurrent: s.stateId === currentState,
    isPrevious: s.stateId === inferredPrevious,
    isAllowedNext: allowedNextStates.indexOf(s.stateId) !== -1,
    reusedModules: s.reusedModules,
  }));

  return deepFreeze({
    dashboardId: 'CONTROLLED_LIFECYCLE_OPERATOR_DASHBOARD',
    title: 'Controlled Lifecycle Engine',
    version: LIFECYCLE_DASHBOARD_VERSION,
    packageId: 'PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE',
    operatorSurface: 'ADMIN_DASHBOARD',
    readOnly: true,
    advisoryOnly: true,
    runtimeWired: false,
    featureActivated: false,
    routesWired: false,
    lastEvaluatedAt:
      typeof input.lastEvaluatedAt === 'string' && input.lastEvaluatedAt.trim()
        ? input.lastEvaluatedAt.trim()
        : null,
    currentState,
    currentStateLabel: currentMeta ? currentMeta.label : null,
    previousState: inferredPrevious,
    previousStateLabel: previousMeta ? previousMeta.label : null,
    allowedNextStates,
    allowedNextStateLabels: allowedNextStates.map((id) =>
      definition.byId[id] ? definition.byId[id].label : id
    ),
    failedGates,
    diagnostics,
    transitionHistorySummary: historySummary,
    lifecycleStates: stateRows,
    readinessSummary: {
      remainingGates: readiness.remainingGates,
      missingPrerequisites: readiness.missingPrerequisites,
      recommendedNextStep: readiness.recommendedNextStep,
    },
    quickLinks: [
      {
        id: 'LINK_PIPELINE_HEALTH',
        label: 'Pipeline Health',
        moduleId: REUSED_MODULE_IDS.PIPELINE_HEALTH,
        pathHint: '/admin/pipeline-health',
        wired: false,
      },
      {
        id: 'LINK_EDITORIAL_REVIEW',
        label: 'Editorial Review',
        moduleId: REUSED_MODULE_IDS.EDITORIAL_REVIEW,
        pathHint: '/admin/editorial-review',
        wired: true,
      },
      {
        id: 'LINK_SHARED_PREVIEW',
        label: 'Shared Preview',
        moduleId: REUSED_MODULE_IDS.SHARED_PREVIEW,
        pathHint: '/admin/recruitment-runtime-preview',
        wired: true,
      },
      {
        id: 'LINK_SEO_DIAGNOSTICS',
        label: 'SEO Diagnostics',
        moduleId: REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
        pathHint: '/admin/seo-diagnostics',
        wired: true,
      },
      {
        id: 'LINK_RECRUITMENT_OPERATIONS',
        label: 'Recruitment Operations',
        moduleId: REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
        pathHint: '/admin/recruitments',
        wired: true,
      },
    ],
    safety: {
      automation: false,
      publishing: false,
      autoApproval: false,
      automaticTransitions: false,
      aiDecisions: false,
      schedulers: false,
      workers: false,
      redis: false,
      runtimeStateMutation: false,
    },
  });
}

module.exports = {
  LIFECYCLE_DASHBOARD_VERSION,
  generateLifecycleDashboard,
};
