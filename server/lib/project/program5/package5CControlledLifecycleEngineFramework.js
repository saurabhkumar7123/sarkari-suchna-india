'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Controlled Lifecycle Engine Framework
 *
 * Governs how a recruitment candidate progresses through the system.
 * Defines lifecycle states, transition rules, validation gates,
 * and history tracking.
 *
 * This package defines governance only.
 * It must NOT activate automation.
 * It must NOT publish content.
 * It must NOT mutate runtime state.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 4 / 5A / 5B module identities:
 *   Pipeline Health, Monitoring Review Integration, Editorial Review,
 *   Shared Preview, SEO Diagnostics, Recruitment Operations.
 */

const {
  LIFECYCLE_DEFINITION_VERSION,
  LIFECYCLE_STATES,
  LIFECYCLE_STATE_IDS,
  REUSED_MODULE_IDS,
  DEFAULT_LIFECYCLE_STATE_CONFIG,
  deepFreeze,
  normalizeLifecycleState,
  createLifecycleDefinition,
  getDefaultLifecycleDefinition,
} = require('./lifecycleDefinition');

const {
  LIFECYCLE_TRANSITION_RULES_VERSION,
  DEFAULT_TRANSITION_TABLE,
  createLifecycleTransitionRules,
  getDefaultLifecycleTransitionRules,
  listAllowedNextStates,
  isLifecycleTransitionAllowed,
} = require('./lifecycleTransitionRules');

const {
  LIFECYCLE_GATES_VERSION,
  GATE_IDS,
  DEFAULT_GATE_CATALOG,
  DEFAULT_STATE_GATE_MAP,
  createLifecycleGateRegistry,
  getDefaultLifecycleGateRegistry,
  listGatesForState,
  evaluateLifecycleGates,
} = require('./lifecycleGates');

const {
  LIFECYCLE_TRANSITION_VALIDATOR_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  validateLifecycleTransition,
} = require('./lifecycleTransitionValidator');

const {
  LIFECYCLE_HISTORY_VERSION,
  TRIGGER_SOURCES,
  createLifecycleHistoryRecord,
  buildLifecycleHistory,
  summarizeLifecycleHistory,
} = require('./lifecycleHistory');

const {
  LIFECYCLE_DASHBOARD_VERSION,
  generateLifecycleDashboard,
} = require('./lifecycleDashboard');

const {
  LIFECYCLE_READINESS_REPORT_VERSION,
  generateLifecycleReadinessReport,
} = require('./lifecycleReadinessReport');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE';
const PACKAGE_NAME = 'Controlled Lifecycle Engine Framework';
const PACKAGE_CODE = '5C';

const GAP_ADDRESSED = 'GAP_FC_CONTROLLED_LIFECYCLE_ENGINE';

const OBJECTIVE =
  'Create a controlled Lifecycle Engine that governs how a recruitment candidate progresses through the system via deterministic states, transitions, gates, and history — governance only.';

const OUT_OF_SCOPE = Object.freeze([
  'AUTOMATIC_TRANSITIONS',
  'SCHEDULERS',
  'WORKERS',
  'POLLING',
  'REDIS',
  'PUBLISHING',
  'AUTOMATIC_APPROVALS',
  'AUTOMATIC_DRAFT_GENERATION',
  'RUNTIME_STATE_MUTATION',
  'AI_DECISION_MAKING',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
  'PRODUCTION_STATE_CHANGES',
  'AUTOMATIC_LIFECYCLE_ADVANCEMENT',
]);

const CAPABILITIES = Object.freeze([
  'LIFECYCLE_DEFINITION',
  'TRANSITION_RULES',
  'LIFECYCLE_GATES',
  'TRANSITION_VALIDATOR',
  'LIFECYCLE_HISTORY',
  'LIFECYCLE_DASHBOARD_MODEL',
  'LIFECYCLE_READINESS_REPORT',
]);

/**
 * Evaluate the controlled lifecycle engine for a candidate snapshot.
 * Pure / deterministic. No side effects. No state mutation.
 *
 * @param {object} [input]
 * @param {string} [input.currentState]
 * @param {string} [input.previousState]
 * @param {string} [input.proposedNextState]
 * @param {object} [input.gateObservations]
 * @param {string[]} [input.satisfiedDependencies]
 * @param {object[]} [input.historyRecords]
 * @param {object} [input.definitionOptions]
 * @param {object} [input.transitionOptions]
 * @param {object} [input.gateOptions]
 * @param {string} [input.lastEvaluatedAt]
 */
function evaluateControlledLifecycle(input = {}) {
  const definition = createLifecycleDefinition(input.definitionOptions || {});
  const rules = createLifecycleTransitionRules({
    definition,
    ...(input.transitionOptions || {}),
  });
  const gateRegistry = createLifecycleGateRegistry({
    definition,
    ...(input.gateOptions || {}),
  });

  const currentState = normalizeLifecycleState(input.currentState);
  const previousState = normalizeLifecycleState(input.previousState);
  const allowedNextStates = currentState
    ? listAllowedNextStates(currentState, rules)
    : [];

  const proposedNextState =
    normalizeLifecycleState(input.proposedNextState) || null;

  let transitionValidation = null;
  if (currentState && proposedNextState) {
    transitionValidation = validateLifecycleTransition({
      fromState: currentState,
      toState: proposedNextState,
      currentState,
      gateObservations: input.gateObservations || {},
      satisfiedDependencies: input.satisfiedDependencies,
      definition,
      rules,
      gateRegistry,
    });
  }

  const gateEvaluation = proposedNextState
    ? evaluateLifecycleGates(
        proposedNextState,
        input.gateObservations || {},
        gateRegistry
      )
    : allowedNextStates.length > 0
      ? evaluateLifecycleGates(
          allowedNextStates[0],
          input.gateObservations || {},
          gateRegistry
        )
      : null;

  const history = buildLifecycleHistory({
    records: Array.isArray(input.historyRecords) ? input.historyRecords : [],
  });

  const readiness = generateLifecycleReadinessReport({
    currentState,
    proposedNextState,
    gateObservations: input.gateObservations || {},
    satisfiedDependencies: input.satisfiedDependencies,
    definition,
    rules,
    gateRegistry,
  });

  const dashboard = generateLifecycleDashboard({
    currentState,
    previousState,
    gateObservations: input.gateObservations || {},
    historyRecords: input.historyRecords,
    definition,
    rules,
    gateRegistry,
    lastEvaluatedAt: input.lastEvaluatedAt,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    configurationDriven: true,
    definition,
    rules,
    gateRegistry,
    currentState,
    previousState,
    allowedNextStates,
    proposedNextState,
    transitionValidation,
    gateEvaluation,
    history,
    historySummary: summarizeLifecycleHistory(history),
    readiness,
    dashboard,
    effects: {
      automaticTransition: false,
      runtimeStateMutated: false,
      contentPublished: false,
      schedulerStarted: false,
      workerStarted: false,
      redisUsed: false,
      aiDecisionMade: false,
      persisted: false,
    },
  });
}

function getControlledLifecycleEngineFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    advisoryOnly: true,
  });
}

function getControlledLifecycleEngineFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    productionSafe: true,
    program5PackageStarted: true,
    program5AutomationAuthorized: false,
    package5AComplete: true,
    package5BComplete: true,
    package5DReady: true,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      automaticTransitions: false,
      activatesAutomation: false,
      publishesContent: false,
      mutatesRuntimeState: false,
      automaticApprovals: false,
      automaticDraftGeneration: false,
      aiDecisionMaking: false,
      executionEngine: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    definitionVersion: LIFECYCLE_DEFINITION_VERSION,
    transitionRulesVersion: LIFECYCLE_TRANSITION_RULES_VERSION,
    gatesVersion: LIFECYCLE_GATES_VERSION,
    validatorVersion: LIFECYCLE_TRANSITION_VALIDATOR_VERSION,
    historyVersion: LIFECYCLE_HISTORY_VERSION,
    dashboardVersion: LIFECYCLE_DASHBOARD_VERSION,
    readinessReportVersion: LIFECYCLE_READINESS_REPORT_VERSION,

    lifecycleStates: Object.assign({}, LIFECYCLE_STATES),
    lifecycleStateIds: LIFECYCLE_STATE_IDS.slice(),
    defaultStateCount: DEFAULT_LIFECYCLE_STATE_CONFIG.length,
    gateIds: Object.values(GATE_IDS),
    triggerSources: Object.values(TRIGGER_SOURCES),
    diagnosticSeverities: Object.values(DIAGNOSTIC_SEVERITY),
    diagnosticCodes: Object.values(DIAGNOSTIC_CODES),
    reusedModules: REUSED_MODULE_IDS,
    defaultTransitionTable: DEFAULT_TRANSITION_TABLE,
    defaultGateCatalog: DEFAULT_GATE_CATALOG,
    defaultStateGateMap: DEFAULT_STATE_GATE_MAP,

    safetyBoundaries: {
      boundariesIdentity: 'SAFETY_PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE',
      advisoryOnly: true,
      runtimeIntegrationDenied: true,
      featureActivationDenied: true,
      sqlSchemaRedesignDenied: true,
      databaseChangesDenied: true,
      apiCreationDenied: true,
      routeCreationDenied: true,
      schedulerDenied: true,
      workerDenied: true,
      redisDenied: true,
      pollingDenied: true,
      publishingDenied: true,
      autoApprovalDenied: true,
      automaticTransitionDenied: true,
      automaticDraftGenerationDenied: true,
      runtimeStateMutationDenied: true,
      aiDecisionMakingDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_AUTOMATIC_TRANSITIONS',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_POLLING',
        'DENIED_PUBLISHING',
        'DENIED_AUTO_APPROVAL',
        'DENIED_AUTOMATIC_DRAFT_GENERATION',
        'DENIED_RUNTIME_STATE_MUTATION',
        'DENIED_AI_DECISION_MAKING',
        'DENIED_GITHUB',
        'DENIED_DEPLOYMENT',
        'DENIED_VPS',
        'DENIED_PRODUCTION_CHANGES',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5C',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      pollingEnabled: false,
      publishingExecuted: false,
      automaticTransitionExecuted: false,
      runtimeStateMutated: false,
      filesystemWritten: false,
      networkAccessed: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      automaticProcessingEnabled: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_5C',
      status: 'CONTROLLED_LIFECYCLE_ENGINE_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Controlled Lifecycle Engine for deterministic candidate progression governance.',
      nextPackage: '5D',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      automaticTransitionAuthorized: false,
      runtimeStateMutationAuthorized: false,
    },

    recommendation:
      'CONTROLLED_LIFECYCLE_ENGINE_FRAMEWORK_COMPLETE_ADVISORY_ONLY_READY_FOR_PACKAGE_5D',
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  GAP_ADDRESSED,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  LIFECYCLE_DEFINITION_VERSION,
  LIFECYCLE_STATES,
  LIFECYCLE_STATE_IDS,
  REUSED_MODULE_IDS,
  DEFAULT_LIFECYCLE_STATE_CONFIG,
  LIFECYCLE_TRANSITION_RULES_VERSION,
  DEFAULT_TRANSITION_TABLE,
  LIFECYCLE_GATES_VERSION,
  GATE_IDS,
  DEFAULT_GATE_CATALOG,
  DEFAULT_STATE_GATE_MAP,
  LIFECYCLE_TRANSITION_VALIDATOR_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  LIFECYCLE_HISTORY_VERSION,
  TRIGGER_SOURCES,
  LIFECYCLE_DASHBOARD_VERSION,
  LIFECYCLE_READINESS_REPORT_VERSION,
  deepFreeze,
  normalizeLifecycleState,
  createLifecycleDefinition,
  getDefaultLifecycleDefinition,
  createLifecycleTransitionRules,
  getDefaultLifecycleTransitionRules,
  listAllowedNextStates,
  isLifecycleTransitionAllowed,
  createLifecycleGateRegistry,
  getDefaultLifecycleGateRegistry,
  listGatesForState,
  evaluateLifecycleGates,
  validateLifecycleTransition,
  createLifecycleHistoryRecord,
  buildLifecycleHistory,
  summarizeLifecycleHistory,
  generateLifecycleDashboard,
  generateLifecycleReadinessReport,
  evaluateControlledLifecycle,
  getControlledLifecycleEngineFramework,
  getControlledLifecycleEngineFrameworkIdentity,
};
