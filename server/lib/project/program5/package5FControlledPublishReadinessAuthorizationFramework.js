'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Controlled Publish Readiness & Authorization Framework
 *
 * Final governance framework that evaluates whether the recruitment
 * platform is eligible for controlled implementation.
 *
 * This package performs authorization assessment only.
 *
 * It must NEVER:
 *   - publish content
 *   - deploy software
 *   - enable automation
 *   - activate schedulers
 *   - mutate production state
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 4 / 5A–5E module identities:
 *   Pipeline Health, Monitoring Review Integration,
 *   Controlled Lifecycle Engine, Draft Preparation,
 *   Candidate Resolution, Editorial Review, Shared Preview,
 *   SEO Diagnostics.
 */

const {
  PUBLISH_READINESS_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  LIFECYCLE_STATUS,
  AUTHORIZATION_STATUS,
  DEFAULT_READINESS_FIELD_CATALOG,
  deepFreeze,
  createPublishReadinessContract,
  getDefaultPublishReadinessContract,
  createPublishReadinessModel,
} = require('./publishReadinessContract');

const {
  AUTHORIZATION_GATES_VERSION,
  GATE_RESULT,
  AUTHORIZATION_GATE_IDS,
  DEFAULT_AUTHORIZATION_GATE_CATALOG,
  createAuthorizationGateRegistry,
  getDefaultAuthorizationGateRegistry,
  evaluateAuthorizationGates,
} = require('./authorizationGates');

const {
  ROLLBACK_READINESS_VERSION,
  ROLLBACK_CHECK_IDS,
  DEFAULT_ROLLBACK_CHECKS,
  verifyRollbackReadiness,
} = require('./rollbackReadiness');

const {
  BACKUP_READINESS_VERSION,
  BACKUP_CHECK_IDS,
  DEFAULT_BACKUP_CHECKS,
  verifyBackupReadiness,
} = require('./backupReadiness');

const {
  FINAL_READINESS_EVALUATOR_VERSION,
  OVERALL_STATUS,
  evaluateFinalReadiness,
} = require('./finalReadinessEvaluator');

const {
  OPERATOR_AUTHORIZATION_PANEL_VERSION,
  buildOperatorAuthorizationPanel,
} = require('./operatorAuthorizationPanel');

const {
  FINAL_GOVERNANCE_REPORT_VERSION,
  DEPLOYMENT_RECOMMENDATION,
  generateFinalGovernanceReport,
} = require('./finalGovernanceReport');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5F_CONTROLLED_PUBLISH_READINESS_AUTHORIZATION';
const PACKAGE_NAME = 'Controlled Publish Readiness & Authorization Framework';
const PACKAGE_CODE = '5F';

const GAP_ADDRESSED = 'GAP_FC_PUBLISH_READINESS_AUTHORIZATION';

const OBJECTIVE =
  'Create the final governance framework that evaluates whether the recruitment platform is eligible for controlled implementation — authorization assessment only, never publishing or deploying.';

const OUT_OF_SCOPE = Object.freeze([
  'PUBLISHING',
  'DEPLOYMENT',
  'RUNTIME_ACTIVATION',
  'WORKERS',
  'SCHEDULERS',
  'REDIS',
  'MONITORING_EXECUTION',
  'AUTO_APPROVAL',
  'FEATURE_ACTIVATION',
  'DATABASE_WRITES',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'SQL_SCHEMA_REDESIGN',
  'PRODUCTION_WRITES',
  'AUTHORIZATION_BYPASS',
  'AUTOMATIC_PUBLISHING',
]);

const CAPABILITIES = Object.freeze([
  'PUBLISH_READINESS_CONTRACT',
  'AUTHORIZATION_GATES',
  'ROLLBACK_READINESS',
  'BACKUP_READINESS',
  'FINAL_READINESS_EVALUATOR',
  'OPERATOR_AUTHORIZATION_PANEL',
  'FINAL_GOVERNANCE_REPORT',
]);

/**
 * Map optional prior-package evaluation snapshots into gate observations.
 * Reuses identity/results — does not reimplement business logic.
 *
 * @param {object} [input]
 */
function buildGateObservationsFromInput(input = {}) {
  const observations = {
    ...(input.gateObservations || {}),
  };

  if (input.pipelineEvaluation) {
    const pe = input.pipelineEvaluation;
    observations.pipelineOverallStatus =
      observations.pipelineOverallStatus ||
      (pe.overallStatus ||
        (pe.report && pe.report.overallStatus) ||
        (pe.dashboard && pe.dashboard.overallStatus) ||
        'UNKNOWN');
    if (typeof observations.pipelineHealthy !== 'boolean') {
      observations.pipelineHealthy =
        observations.pipelineOverallStatus === 'HEALTHY';
    }
  }

  if (input.lifecycleEvaluation || input.lifecycleReadinessReport) {
    const lr =
      input.lifecycleReadinessReport ||
      (input.lifecycleEvaluation && input.lifecycleEvaluation.readinessReport) ||
      input.lifecycleEvaluation ||
      {};
    observations.lifecycleCurrentState =
      observations.lifecycleCurrentState ||
      lr.currentLifecycleState ||
      lr.currentState ||
      'UNKNOWN';
    observations.lifecycleRemainingGates =
      observations.lifecycleRemainingGates || lr.remainingGates || [];
    if (typeof observations.lifecycleReady !== 'boolean') {
      observations.lifecycleReady =
        Array.isArray(observations.lifecycleRemainingGates) &&
        observations.lifecycleRemainingGates.length === 0 &&
        (observations.lifecycleCurrentState === 'PUBLISH_READY' ||
          observations.lifecycleCurrentState === 'SEO_READY' ||
          Boolean(lr.ready));
    }
  }

  if (input.draftReadinessReport || input.draftEvaluation) {
    const dr =
      input.draftReadinessReport ||
      (input.draftEvaluation && input.draftEvaluation.report) ||
      input.draftEvaluation ||
      {};
    const completeness = dr.draftCompleteness || {};
    observations.draftReady =
      typeof observations.draftReady === 'boolean'
        ? observations.draftReady
        : Boolean(completeness.ready);
    observations.draftCompletenessScore =
      observations.draftCompletenessScore != null
        ? observations.draftCompletenessScore
        : completeness.score;
    observations.draftRemainingIssues =
      observations.draftRemainingIssues ||
      (dr.remainingValidationIssues || []).map((i) => i.code || i.message);
    observations.editorialReady =
      typeof observations.editorialReady === 'boolean'
        ? observations.editorialReady
        : Boolean(dr.editorialStatus && dr.editorialStatus.ready);
    observations.seoReady =
      typeof observations.seoReady === 'boolean'
        ? observations.seoReady
        : Boolean(dr.seoStatus && dr.seoStatus.ready);
    observations.seoMissingFields =
      observations.seoMissingFields ||
      (dr.seoStatus && dr.seoStatus.missingFields) ||
      [];
    observations.editorialMissingChecklist =
      observations.editorialMissingChecklist ||
      (dr.missingFields && dr.missingFields.editorialChecklist) ||
      [];
  }

  if (input.resolutionResult || input.resolutionReport) {
    const rr =
      input.resolutionReport ||
      (input.resolutionResult && input.resolutionResult.report) ||
      input.resolutionResult ||
      {};
    const resolution =
      (input.resolutionResult && input.resolutionResult.resolution) ||
      rr.resolutionSummary ||
      {};
    observations.resolutionUnresolvedCount =
      observations.resolutionUnresolvedCount != null
        ? observations.resolutionUnresolvedCount
        : Number(resolution.unresolvedCount) || 0;
    observations.resolutionAutomaticMerge =
      typeof observations.resolutionAutomaticMerge === 'boolean'
        ? observations.resolutionAutomaticMerge
        : Boolean(rr.automaticMerge);
    observations.resolutionAdvisoryOnly =
      typeof observations.resolutionAdvisoryOnly === 'boolean'
        ? observations.resolutionAdvisoryOnly
        : rr.advisoryOnly !== false;
  }

  if (!Array.isArray(observations.completedPackages)) {
    observations.completedPackages = ['5A', '5B', '5C', '5D', '5E'];
  }
  if (typeof observations.configurationValid !== 'boolean') {
    observations.configurationValid = true;
  }
  if (typeof observations.program5AutomationAuthorized !== 'boolean') {
    observations.program5AutomationAuthorized = false;
  }

  return observations;
}

/**
 * Run the full advisory Controlled Publish Readiness & Authorization pipeline.
 * Pure / deterministic. No side effects. No publishing. No deployment.
 *
 * @param {object} [input]
 * @param {object} [input.gateObservations]
 * @param {object} [input.pipelineEvaluation]
 * @param {object} [input.lifecycleEvaluation]
 * @param {object} [input.lifecycleReadinessReport]
 * @param {object} [input.draftReadinessReport]
 * @param {object} [input.draftEvaluation]
 * @param {object} [input.resolutionResult]
 * @param {object} [input.resolutionReport]
 * @param {object} [input.rollback]
 * @param {object} [input.backup]
 * @param {string} [input.readinessId]
 * @param {string} [input.platformVersion]
 * @param {string} [input.evaluationTimestamp]
 * @param {string[]} [input.requiredApprovals]
 * @param {string[]} [input.recordedApprovals]
 * @param {object[]} [input.outstandingRisks]
 * @param {string[]} [input.advisoryNotes]
 * @param {object} [input.pipelineSummary]
 * @param {object} [input.lifecycleSummary]
 * @param {object} [input.draftSummary]
 * @param {object} [input.resolutionSummary]
 */
function evaluatePublishReadinessAuthorization(input = {}) {
  const evaluationTimestamp =
    typeof input.evaluationTimestamp === 'string' &&
    input.evaluationTimestamp.trim()
      ? input.evaluationTimestamp.trim()
      : '1970-01-01T00:00:00.000Z';

  const gateObservations = buildGateObservationsFromInput(input);
  if (Array.isArray(input.requiredApprovals)) {
    gateObservations.requiredApprovals = input.requiredApprovals;
  }
  if (Array.isArray(input.recordedApprovals)) {
    gateObservations.recordedApprovals = input.recordedApprovals;
  }

  const gateRegistry = getDefaultAuthorizationGateRegistry();
  const gateEvaluation = evaluateAuthorizationGates(
    gateObservations,
    gateRegistry
  );

  const rollbackReadiness = verifyRollbackReadiness(input.rollback || {});
  const backupReadiness = verifyBackupReadiness(input.backup || {});

  const finalEvaluation = evaluateFinalReadiness({
    gateEvaluation,
    rollbackReadiness,
    backupReadiness,
    additionalBlockingIssues: input.additionalBlockingIssues,
    additionalPrerequisites: input.additionalPrerequisites,
  });

  const authorizationStatus =
    finalEvaluation.overallStatus === OVERALL_STATUS.NOT_READY
      ? AUTHORIZATION_STATUS.BLOCKED
      : AUTHORIZATION_STATUS.AUTHORIZED_FOR_ASSESSMENT;

  const lifecycleStatus =
    gateObservations.lifecycleCurrentState === 'PUBLISH_READY'
      ? LIFECYCLE_STATUS.PUBLISH_READY
      : finalEvaluation.overallStatus === OVERALL_STATUS.NOT_READY
        ? LIFECYCLE_STATUS.NOT_READY
        : LIFECYCLE_STATUS.IN_PROGRESS;

  const outstandingRisks = Array.isArray(input.outstandingRisks)
    ? input.outstandingRisks.slice()
    : finalEvaluation.blockingIssues.map((issue) => ({
        code: issue.code,
        severity: 'HIGH',
        message: issue.message,
      }));

  const advisoryNotes = Array.isArray(input.advisoryNotes)
    ? input.advisoryNotes.slice()
    : [
        'Authorization assessment only — no publishing.',
        'Deployment remains NOT AUTHORIZED.',
      ];

  const readinessModel = createPublishReadinessModel({
    readinessId:
      typeof input.readinessId === 'string' && input.readinessId.trim()
        ? input.readinessId.trim()
        : `READINESS_${PACKAGE_CODE}_${evaluationTimestamp}`,
    evaluationTimestamp,
    platformVersion:
      typeof input.platformVersion === 'string' && input.platformVersion.trim()
        ? input.platformVersion.trim()
        : FRAMEWORK_VERSION,
    lifecycleStatus,
    authorizationStatus,
    validationSummary: {
      valid: finalEvaluation.overallStatus !== OVERALL_STATUS.NOT_READY,
      gatePassCount: gateEvaluation.passCount,
      gateWarningCount: gateEvaluation.warningCount,
      gateBlockedCount: gateEvaluation.blockedCount,
      summary: `Overall status ${finalEvaluation.overallStatus}`,
    },
    outstandingRisks,
    advisoryNotes,
  });

  const panel = buildOperatorAuthorizationPanel({
    gateEvaluation,
    finalEvaluation,
    readinessModel,
    rollbackReadiness,
    backupReadiness,
    requiredApprovals: gateObservations.requiredApprovals,
    recordedApprovals: gateObservations.recordedApprovals,
    generatedAt: evaluationTimestamp,
  });

  const governanceReport = generateFinalGovernanceReport({
    finalEvaluation,
    gateEvaluation,
    readinessModel,
    panel,
    rollbackReadiness,
    backupReadiness,
    pipelineSummary: input.pipelineSummary,
    lifecycleSummary: input.lifecycleSummary,
    draftSummary: input.draftSummary,
    resolutionSummary: input.resolutionSummary,
    outstandingRisks,
    generatedAt: evaluationTimestamp,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    configurationDriven: true,
    readinessModel,
    gateEvaluation,
    rollbackReadiness,
    backupReadiness,
    finalEvaluation,
    panel,
    governanceReport,
    overallStatus: finalEvaluation.overallStatus,
    deploymentRecommendation: DEPLOYMENT_RECOMMENDATION.NOT_AUTHORIZED,
    effects: {
      contentPublished: false,
      softwareDeployed: false,
      automationEnabled: false,
      schedulersActivated: false,
      productionStateMutated: false,
      routesActivated: false,
      databaseWritten: false,
      featureActivated: false,
      automaticApprovalGranted: false,
      publishingExecuted: false,
      runtimeAutomationActivated: false,
      authorizationBypassed: false,
      externalApiCalled: false,
    },
  });
}

function getControlledPublishReadinessAuthorizationFrameworkIdentity() {
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

function getControlledPublishReadinessAuthorizationFramework() {
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
    package5CComplete: true,
    package5DComplete: true,
    package5EComplete: true,
    package5FComplete: true,
    program5Complete: true,
    program6Ready: true,
    deploymentAuthorized: false,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      authorizationAssessmentOnly: true,
      publishesContent: false,
      deploysSoftware: false,
      enablesAutomation: false,
      activatesSchedulers: false,
      mutatesProductionState: false,
      automaticApproval: false,
      activatesRoutes: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    contractVersion: PUBLISH_READINESS_CONTRACT_VERSION,
    authorizationGatesVersion: AUTHORIZATION_GATES_VERSION,
    rollbackReadinessVersion: ROLLBACK_READINESS_VERSION,
    backupReadinessVersion: BACKUP_READINESS_VERSION,
    finalReadinessEvaluatorVersion: FINAL_READINESS_EVALUATOR_VERSION,
    operatorAuthorizationPanelVersion: OPERATOR_AUTHORIZATION_PANEL_VERSION,
    finalGovernanceReportVersion: FINAL_GOVERNANCE_REPORT_VERSION,

    gateResults: Object.values(GATE_RESULT),
    authorizationGateIds: Object.values(AUTHORIZATION_GATE_IDS),
    overallStatuses: Object.values(OVERALL_STATUS),
    lifecycleStatuses: Object.values(LIFECYCLE_STATUS),
    authorizationStatuses: Object.values(AUTHORIZATION_STATUS),
    deploymentRecommendation: DEPLOYMENT_RECOMMENDATION.NOT_AUTHORIZED,
    reusedModules: REUSED_MODULE_IDS,
    defaultReadinessFieldCatalog: DEFAULT_READINESS_FIELD_CATALOG,
    defaultAuthorizationGateCatalog: DEFAULT_AUTHORIZATION_GATE_CATALOG,
    defaultRollbackChecks: DEFAULT_ROLLBACK_CHECKS,
    defaultBackupChecks: DEFAULT_BACKUP_CHECKS,
    rollbackCheckIds: ROLLBACK_CHECK_IDS,
    backupCheckIds: BACKUP_CHECK_IDS,

    safetyBoundaries: {
      boundariesIdentity:
        'SAFETY_PACKAGE_5F_CONTROLLED_PUBLISH_READINESS_AUTHORIZATION',
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
      monitoringExecutionDenied: true,
      publishingDenied: true,
      automaticApprovalDenied: true,
      authorizationBypassDenied: true,
      automaticPublishingDenied: true,
      runtimeActivationDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      productionWritesDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_DATABASE_WRITES',
        'DENIED_PUBLISHING',
        'DENIED_DEPLOYMENT',
        'DENIED_AUTOMATION_ENABLEMENT',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_MONITORING_EXECUTION',
        'DENIED_AUTO_APPROVAL',
        'DENIED_AUTHORIZATION_BYPASS',
        'DENIED_AUTOMATIC_PUBLISHING',
        'DENIED_RUNTIME_ACTIVATION',
        'DENIED_GITHUB',
        'DENIED_VPS',
        'DENIED_PRODUCTION_WRITES',
        'DENIED_PRODUCTION_CHANGES',
        'DENIED_ROUTE_ACTIVATION',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5F',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      monitoringExecuted: false,
      publishingExecuted: false,
      softwareDeployed: false,
      automationEnabled: false,
      automaticApprovalGranted: false,
      authorizationBypassed: false,
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
      summaryIdentity: 'SUMMARY_PACKAGE_5F',
      status: 'PUBLISH_READINESS_AUTHORIZATION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Controlled Publish Readiness & Authorization Framework so operators can evaluate controlled implementation eligibility without publishing or deploying.',
      nextPackage: 'PROGRAM_6',
      program5Complete: true,
      program6Eligible: true,
      automatesRecruitment: false,
      deploymentAuthorized: false,
      publishingAuthorized: false,
      automaticApprovalAuthorized: false,
    },

    recommendation:
      'PROGRAM_5_COMPLETE_ADVISORY_ONLY_PROGRAM_6_ELIGIBLE_DEPLOYMENT_NOT_AUTHORIZED',
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
  PUBLISH_READINESS_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  LIFECYCLE_STATUS,
  AUTHORIZATION_STATUS,
  DEFAULT_READINESS_FIELD_CATALOG,
  AUTHORIZATION_GATES_VERSION,
  GATE_RESULT,
  AUTHORIZATION_GATE_IDS,
  DEFAULT_AUTHORIZATION_GATE_CATALOG,
  ROLLBACK_READINESS_VERSION,
  ROLLBACK_CHECK_IDS,
  DEFAULT_ROLLBACK_CHECKS,
  BACKUP_READINESS_VERSION,
  BACKUP_CHECK_IDS,
  DEFAULT_BACKUP_CHECKS,
  FINAL_READINESS_EVALUATOR_VERSION,
  OVERALL_STATUS,
  OPERATOR_AUTHORIZATION_PANEL_VERSION,
  FINAL_GOVERNANCE_REPORT_VERSION,
  DEPLOYMENT_RECOMMENDATION,
  deepFreeze,
  createPublishReadinessContract,
  getDefaultPublishReadinessContract,
  createPublishReadinessModel,
  createAuthorizationGateRegistry,
  getDefaultAuthorizationGateRegistry,
  evaluateAuthorizationGates,
  verifyRollbackReadiness,
  verifyBackupReadiness,
  evaluateFinalReadiness,
  buildOperatorAuthorizationPanel,
  generateFinalGovernanceReport,
  evaluatePublishReadinessAuthorization,
  getControlledPublishReadinessAuthorizationFramework,
  getControlledPublishReadinessAuthorizationFrameworkIdentity,
};
