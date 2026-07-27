'use strict';

/**
 * STAGE 3 — Controlled Deployment
 * Package DEP-1 — Controlled Deployment Framework
 *
 * Prepares the system for controlled production deployment.
 * Deployment artifacts may be created.
 * Production MUST remain inactive.
 * No automatic production activation.
 * Explicit operator authorization remains mandatory.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const {
  DEPLOYMENT_VALIDATION_VERSION,
  validateDeploymentReadiness,
} = require('./deploymentValidation');
const {
  ENVIRONMENT_PREPARATION_VERSION,
  prepareDeploymentEnvironment,
} = require('./environmentPreparation');
const {
  SERVICE_READINESS_VERSION,
  validateServiceReadiness,
} = require('./serviceReadiness');
const {
  DATABASE_SAFETY_VERSION,
  prepareDatabaseSafetyChecklist,
} = require('./databaseSafety');
const {
  DEPLOYMENT_CHECKLIST_VERSION,
  buildDeploymentChecklist,
} = require('./deploymentChecklist');
const {
  HEALTH_VERIFICATION_VERSION,
  prepareHealthVerificationPlan,
} = require('./healthVerificationPlan');
const {
  SMOKE_TEST_PLAN_VERSION,
  prepareSmokeTestPlan,
} = require('./smokeTestPlan');
const {
  ROLLBACK_PACKAGE_VERSION,
  generateRollbackPackage,
} = require('./rollbackPackage');
const {
  AUTHORIZATION_GATE_VERSION,
  DEPLOYMENT_STATES,
  ACTIVATION_REQUIREMENTS,
  createAuthorizationGate,
} = require('./authorizationGate');
const {
  PROGRAM_COMPAT_VERSION,
  assessProgram678Compatibility,
} = require('./program678Compatibility');
const {
  DEPLOYMENT_ASSESSMENT_VERSION,
  buildFinalDeploymentAssessment,
} = require('./deploymentAssessment');

const ft1a = require('../finalHardening/packageFT1ASystemValidationHardeningFramework');
const ft1b = require('../finalHardening/packageFT1BProductionReadinessFramework');
const mb1 = require('../packageMB1GovernmentSourceRegistryFramework');
const mb2 = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');
const mb3 = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const mb4 = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');
const mb5 = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
const tg1 = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const rw1 = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_DEP1_CONTROLLED_DEPLOYMENT';
const PACKAGE_NAME = 'Controlled Deployment Framework';
const PACKAGE_CODE = 'DEP-1';
const STAGE_ID = 'STAGE_3_CONTROLLED_DEPLOYMENT';

const OBJECTIVE =
  'Prepare the system for a controlled production deployment without activating production or performing automatic activation.';

const OUT_OF_SCOPE = Object.freeze([
  'PM2_ACTIVATION',
  'NGINX_RELOAD',
  'SCHEDULER_ENABLEMENT',
  'TELEGRAM_LIVE_SENDING',
  'PAGE_PUBLISHING',
  'AUTOMATIC_DRAFT_APPROVAL',
  'PRODUCTION_DATABASE_MODIFICATION',
  'VPS_DEPLOYMENT',
  'GITHUB_PUSH',
  'BACKUP_EXECUTION',
  'PROGRAM_6_IMPLEMENTATION',
  'PROGRAM_7_IMPLEMENTATION',
  'PROGRAM_8_IMPLEMENTATION',
]);

const PROHIBITED = Object.freeze([
  'PRODUCTION_ACTIVATION',
  'PM2_START',
  'NGINX_RELOAD',
  'SCHEDULER_START',
  'TELEGRAM_LIVE_SEND',
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'DATABASE_MUTATION',
  'VPS_DEPLOY',
  'GITHUB_PUSH',
  'BACKUP_RUN',
  'AUTOMATIC_PRODUCTION_ACTIVATION',
  'PROGRAM_6_IMPLEMENTATION',
  'PROGRAM_7_IMPLEMENTATION',
  'PROGRAM_8_IMPLEMENTATION',
]);

const CAPABILITIES = Object.freeze([
  'DEPLOYMENT_VALIDATION',
  'ENVIRONMENT_PREPARATION',
  'SERVICE_READINESS',
  'DATABASE_SAFETY_CHECKLIST',
  'DEPLOYMENT_CHECKLIST',
  'HEALTH_VERIFICATION_PLAN',
  'SMOKE_TEST_PLAN',
  'ROLLBACK_PACKAGE',
  'AUTHORIZATION_GATE',
  'PROGRAM_6_7_8_COMPATIBILITY',
  'FINAL_DEPLOYMENT_ASSESSMENT',
]);

const PREREQUISITES = Object.freeze([
  'PROGRAMS_1_TO_5_APPROVED',
  'MB_1_APPROVED',
  'MB_2_APPROVED',
  'MB_3_APPROVED',
  'MB_4_APPROVED',
  'MB_5_APPROVED',
  'TG_1_APPROVED',
  'RW_1_APPROVED',
  'FT_1A_APPROVED',
  'FT_1B_APPROVED_GO_WITH_CONDITIONS',
]);

/**
 * Regression: Programs 1–5, MB-1..MB-5, TG-1, RW-1, FT-1A, FT-1B unchanged.
 */
function validatePriorPackageBaselines(input = {}) {
  const checks = [];
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');

  try {
    const p1 = require('../../../recruitment/implementation/package1AArchitectureFreezeAndSingleSourceOfTruth.js');
    const report = p1.getPackage1AArchitectureFreezeAndSingleSourceOfTruth();
    checks.push({
      checkId: 'PROGRAM_1',
      passed:
        report.architectureFrozen === true && report.runtimeActivated === false,
    });
  } catch (error) {
    checks.push({ checkId: 'PROGRAM_1', passed: false, detail: error.message });
  }

  try {
    const p4 = require('../../program4/featureCompletionBaselineFramework.js');
    const framework = p4.getFeatureCompletionBaselineFramework();
    checks.push({
      checkId: 'PROGRAM_4',
      passed:
        framework.advisoryOnly === true &&
        framework.runtimeEffects.program5Started === false,
    });
  } catch (error) {
    checks.push({ checkId: 'PROGRAM_4', passed: false, detail: error.message });
  }

  try {
    const p5a = require('../../program5/package5APipelineHealthAndDiagnosticsFramework.js');
    const p5f = require('../../program5/package5FControlledPublishReadinessAuthorizationFramework.js');
    checks.push({
      checkId: 'PROGRAM_5',
      passed:
        p5a.getPipelineHealthAndDiagnosticsFramework().advisoryOnly === true &&
        p5f.getControlledPublishReadinessAuthorizationFramework().runtimeEffects
          .publishingExecuted === false,
    });
  } catch (error) {
    checks.push({ checkId: 'PROGRAM_5', passed: false, detail: error.message });
  }

  checks.push({
    checkId: 'MB_1',
    passed:
      mb1.getGovernmentSourceRegistryFramework().packageCode === 'MB-1' &&
      mb1.getGovernmentSourceRegistryFramework().advisoryOnly === true,
  });
  checks.push({
    checkId: 'MB_2',
    passed:
      mb2.getWebsiteChangeDetectionFramework().packageCode === 'MB-2' &&
      mb2.getWebsiteChangeDetectionFramework().manualInvocationOnly === true,
  });
  checks.push({
    checkId: 'MB_3',
    passed:
      mb3.getRecruitmentExtractionFramework().packageCode === 'MB-3' &&
      mb3.getRecruitmentExtractionFramework().packageMB4Activated === false,
  });
  checks.push({
    checkId: 'MB_4',
    passed:
      mb4.getPipelineIntegrationFramework().packageCode === 'MB-4' &&
      mb4.getPipelineIntegrationFramework().packageMB5Activated === false,
  });

  const mb5Fw = mb5.getControlledSchedulerFramework();
  checks.push({
    checkId: 'MB_5',
    passed:
      mb5Fw.packageCode === 'MB-5' &&
      mb5Fw.schedulerDisabledByDefault === true &&
      mb5Fw.safetyBoundaries.publishingDenied === true,
  });

  checks.push({
    checkId: 'TG_1',
    passed:
      tg1.getTelegramNotificationFramework().packageCode === 'TG-1' &&
      tg1.getTelegramNotificationFramework().safetyBoundaries
        .automaticSendingDenied === true,
  });

  checks.push({
    checkId: 'RW_1',
    passed:
      rw1.getReviewQueueWiringFramework().packageCode === 'RW-1' &&
      rw1.getReviewQueueWiringFramework().safetyBoundaries.databaseWritesDenied ===
        true &&
      rw1.getReviewQueueWiringFramework().safetyBoundaries.publishingDenied ===
        true,
  });

  const ft1aFw = ft1a.getSystemValidationHardeningFramework();
  checks.push({
    checkId: 'FT_1A',
    passed:
      ft1aFw.packageCode === 'FT-1A' &&
      ft1aFw.packageFT1AComplete === true &&
      ft1aFw.productionActivated === false &&
      ft1aFw.validationOnly === true,
  });

  const ft1bFw = ft1b.getProductionReadinessFramework();
  checks.push({
    checkId: 'FT_1B',
    passed:
      ft1bFw.packageCode === 'FT-1B' &&
      ft1bFw.packageFT1BComplete === true &&
      ft1bFw.productionActivated === false &&
      ft1bFw.assessmentOnly === true &&
      ft1bFw.packageSummary.nextPackage === 'DEP-1',
  });

  const productApi = path.join(
    workspaceRoot,
    'sarkari-suchna-india/server/api'
  );
  let noDep1Routes = true;
  if (fs.existsSync(productApi)) {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let files = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(walk(full));
        else files.push(full);
      }
      return files;
    };
    const routeFiles = walk(productApi);
    noDep1Routes = !routeFiles.some((f) =>
      /dep1|controlled-deployment|authorization-gate/i.test(f)
    );
  }
  checks.push({
    checkId: 'NO_DEP1_PRODUCTION_ROUTES',
    passed: noDep1Routes,
  });

  return deepFreeze({
    validationVersion: FRAMEWORK_VERSION,
    part: 'REGRESSION',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    behavioralRegressionsPermitted: false,
  });
}

function getControlledDeploymentFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getControlledDeploymentFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    preparationOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    automaticProductionActivation: false,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    prerequisites: PREREQUISITES.slice(),
    packageDEP1Complete: true,
    packageFT1BUnchanged: true,
    packageFT1AUnchanged: true,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Unchanged: true,
    packageMB4Unchanged: true,
    packageMB5Unchanged: true,
    packageTG1Unchanged: true,
    packageRW1Unchanged: true,
    safetyBoundaries: {
      publishingDenied: true,
      automaticApprovalDenied: true,
      pm2ActivationDenied: true,
      nginxReloadDenied: true,
      schedulerActivationDenied: true,
      telegramLiveMessagingDenied: true,
      databaseModificationDenied: true,
      productionActivationDenied: true,
      vpsDeploymentDenied: true,
      githubPushDenied: true,
      backupExecutionDenied: true,
      automaticProductionActivationDenied: true,
      program6ImplementationDenied: true,
      program7ImplementationDenied: true,
      program8ImplementationDenied: true,
    },
    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_DEP1',
      productionActivated: false,
      deploymentExecuted: false,
      publishingExecuted: false,
      automaticApprovalExecuted: false,
      pm2Started: false,
      nginxReloaded: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      databaseModified: false,
      backupExecuted: false,
      vpsDeployed: false,
      githubPushed: false,
      routesCreated: false,
      productionImpact: false,
    },
    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_DEP1',
      status: 'CONTROLLED_DEPLOYMENT_FRAMEWORK_COMPLETE',
      purpose:
        'Prepare controlled deployment artifacts and authorization gate without activating production.',
      nextPackage: 'PROGRAM_6',
      nextPackageName: 'Production Hardening',
      nextStep: 'OPERATOR_AUTHORIZATION',
      canPrepare: true,
      canAuthorize: false,
      canDeploy: false,
      canPublish: false,
      canAutoApprove: false,
      runtimeBehaviorChanged: false,
    },
    recommendation:
      'DEP1_COMPLETE_DEPLOYMENT_PREPARED_READY_FOR_AUTHORIZATION_PRODUCTION_REMAINS_INACTIVE',
  });
}

/**
 * Evaluate complete DEP-1 controlled deployment suite.
 * @param {object} [input]
 */
function evaluateControlledDeploymentFramework(input = {}) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const workspaceInput = { workspaceRoot: input.workspaceRoot };

  const partA = validateDeploymentReadiness({
    ...workspaceInput,
    ...(input.deploymentValidation || {}),
  });
  const partB = prepareDeploymentEnvironment({
    ...workspaceInput,
    ...(input.environment || {}),
  });
  const partC = validateServiceReadiness({
    ...workspaceInput,
    ...(input.services || {}),
  });
  const partD = prepareDatabaseSafetyChecklist({
    ...workspaceInput,
    ...(input.database || {}),
  });
  const partE = buildDeploymentChecklist({
    partA,
    partB,
    partC,
    partD,
    ...(input.checklist || {}),
  });
  const partF = prepareHealthVerificationPlan({
    generatedAt,
    ...(input.health || {}),
  });
  const partG = prepareSmokeTestPlan({
    generatedAt,
    ...(input.smoke || {}),
  });
  const partH = generateRollbackPackage({
    generatedAt,
    ...(input.rollback || {}),
  });

  const regression = validatePriorPackageBaselines({
    ...workspaceInput,
    ...(input.regression || {}),
  });

  const partI = createAuthorizationGate({
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    partH,
    ...(input.authorization || {}),
  });

  const programCompatibility = assessProgram678Compatibility(
    input.programCompatibility || {}
  );

  const report = buildFinalDeploymentAssessment({
    generatedAt,
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    partH,
    partI,
    programCompatibility,
    regression,
  });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    packageCode: PACKAGE_CODE,
    packageId: PACKAGE_ID,
    advisoryOnly: true,
    preparationOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    deploymentState: partI.deploymentState,
    readyForAuthorization:
      partI.deploymentState === DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION ||
      partI.deploymentState === DEPLOYMENT_STATES.AUTHORIZED,
    productionActivationAllowed: partI.productionActivationAllowed === true,
    report,
    deploymentReadinessReport: partA,
    deploymentChecklist: partE,
    healthVerificationPlan: partF,
    smokeTestPlan: partG,
    rollbackPackage: partH,
    authorizationGate: partI,
    program678CompatibilityReport: programCompatibility,
    effects: {
      published: false,
      approved: false,
      pm2Started: false,
      nginxReloaded: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      deployed: false,
      productionActivated: false,
      backupExecuted: false,
      databaseModified: false,
      githubPushed: false,
    },
  });
}

/**
 * Generate final deployment assessment only.
 */
function generateFinalDeploymentAssessment(input = {}) {
  const evaluation = evaluateControlledDeploymentFramework(input);
  return evaluation.report;
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  STAGE_ID,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  PREREQUISITES,
  DEPLOYMENT_VALIDATION_VERSION,
  ENVIRONMENT_PREPARATION_VERSION,
  SERVICE_READINESS_VERSION,
  DATABASE_SAFETY_VERSION,
  DEPLOYMENT_CHECKLIST_VERSION,
  HEALTH_VERIFICATION_VERSION,
  SMOKE_TEST_PLAN_VERSION,
  ROLLBACK_PACKAGE_VERSION,
  AUTHORIZATION_GATE_VERSION,
  PROGRAM_COMPAT_VERSION,
  DEPLOYMENT_ASSESSMENT_VERSION,
  DEPLOYMENT_STATES,
  ACTIVATION_REQUIREMENTS,
  deepFreeze,
  validateDeploymentReadiness,
  prepareDeploymentEnvironment,
  validateServiceReadiness,
  prepareDatabaseSafetyChecklist,
  buildDeploymentChecklist,
  prepareHealthVerificationPlan,
  prepareSmokeTestPlan,
  generateRollbackPackage,
  createAuthorizationGate,
  assessProgram678Compatibility,
  validatePriorPackageBaselines,
  buildFinalDeploymentAssessment,
  evaluateControlledDeploymentFramework,
  generateFinalDeploymentAssessment,
  getControlledDeploymentFramework,
  getControlledDeploymentFrameworkIdentity,
};
