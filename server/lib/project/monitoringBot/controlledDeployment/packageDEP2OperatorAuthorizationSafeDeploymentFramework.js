'use strict';

/**
 * STAGE 3 — Controlled Deployment
 * Package DEP-2 — Operator Authorization & Safe Deployment Framework
 *
 * Final operator-controlled deployment preparation.
 * ONLY production-ready artifacts are eligible for GitHub and VPS deployment.
 * MUST NOT perform accidental deployment.
 * Production activation MUST require explicit operator authorization.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const {
  REPOSITORY_AUDIT_VERSION,
  auditRepositoryStructure,
} = require('./repositoryStructureAudit');
const {
  DEPLOYMENT_MANIFEST_VERSION,
  generateDeploymentManifest,
  writeDeploymentManifestFile,
} = require('./deploymentManifest');
const {
  EXCLUSION_VALIDATION_VERSION,
  validateDeploymentExclusions,
} = require('./exclusionValidation');
const {
  PRODUCTION_PACKAGE_VERSION,
  generateProductionPackageSummary,
} = require('./productionPackageSummary');
const {
  GITHUB_READINESS_VERSION,
  assessGitHubReadiness,
} = require('./githubReadiness');
const {
  SERVER_READINESS_VERSION,
  assessServerReadiness,
} = require('./serverReadiness');
const {
  SAFETY_GATES_VERSION,
  GATE_DEFINITIONS,
  evaluateDeploymentSafetyGates,
} = require('./deploymentSafetyGates');
const {
  AUTHORIZATION_WORKFLOW_VERSION,
  AUTHORIZATION_STATES,
  createOperatorAuthorizationWorkflow,
} = require('./operatorAuthorizationWorkflow');
const {
  DEPLOYMENT_PROTECTION_VERSION,
  evaluateDeploymentProtection,
} = require('./deploymentProtection');
const {
  DEP2_PROGRAM_COMPAT_VERSION,
  assessDep2Program678Compatibility,
} = require('./dep2Program678Compatibility');
const {
  DEP2_ASSESSMENT_VERSION,
  buildFinalDeploymentAuthorizationAssessment,
} = require('./dep2Assessment');

const dep1 = require('./packageDEP1ControlledDeploymentFramework');
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
const PACKAGE_ID = 'PACKAGE_DEP2_OPERATOR_AUTHORIZATION_SAFE_DEPLOYMENT';
const PACKAGE_NAME = 'Operator Authorization & Safe Deployment Framework';
const PACKAGE_CODE = 'DEP-2';
const STAGE_ID = 'STAGE_3_CONTROLLED_DEPLOYMENT';

const OBJECTIVE =
  'Perform final operator-controlled deployment preparation so only production-ready artifacts are eligible for GitHub and VPS deployment, without accidental deployment or automatic production activation.';

const OUT_OF_SCOPE = Object.freeze([
  'GITHUB_PUSH',
  'VPS_CONNECTION',
  'FILE_UPLOAD',
  'PRODUCTION_OVERWRITE',
  'PM2_ACTIVATION',
  'NGINX_RELOAD',
  'SCHEDULER_ENABLEMENT',
  'TELEGRAM_LIVE_TRANSPORT',
  'PAGE_PUBLISHING',
  'AUTOMATIC_DRAFT_APPROVAL',
  'PRODUCTION_DATABASE_MODIFICATION',
  'AUTOMATIC_STATE_TRANSITION_TO_LIVE',
  'PROGRAM_6_IMPLEMENTATION',
  'PROGRAM_7_IMPLEMENTATION',
  'PROGRAM_8_IMPLEMENTATION',
]);

const PROHIBITED = Object.freeze([
  'PRODUCTION_ACTIVATION',
  'GITHUB_PUSH',
  'VPS_DEPLOY',
  'VPS_CONNECT',
  'FILE_UPLOAD',
  'PRODUCTION_OVERWRITE',
  'PM2_START',
  'NGINX_RELOAD',
  'SCHEDULER_START',
  'TELEGRAM_LIVE_SEND',
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'DATABASE_MUTATION',
  'AUTOMATIC_LIVE_TRANSITION',
  'PROGRAM_6_IMPLEMENTATION',
  'PROGRAM_7_IMPLEMENTATION',
  'PROGRAM_8_IMPLEMENTATION',
]);

const CAPABILITIES = Object.freeze([
  'REPOSITORY_STRUCTURE_AUDIT',
  'PRODUCTION_DEPLOYMENT_MANIFEST',
  'EXCLUSION_VALIDATION',
  'PRODUCTION_PACKAGE_SUMMARY',
  'GITHUB_READINESS_REVIEW',
  'SERVER_READINESS_REVIEW',
  'DEPLOYMENT_SAFETY_GATES',
  'OPERATOR_AUTHORIZATION_WORKFLOW',
  'DEPLOYMENT_PROTECTION',
  'PROGRAM_6_7_8_COMPATIBILITY',
  'FINAL_DEPLOYMENT_AUTHORIZATION_ASSESSMENT',
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
  'FT_1B_APPROVED',
  'DEP_1_APPROVED',
  'CURRENT_STATE_READY_FOR_AUTHORIZATION',
]);

/**
 * Regression: Programs 1–5, MB-1..MB-5, TG-1, RW-1, FT-1A, FT-1B, DEP-1 unchanged.
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
      ft1bFw.assessmentOnly === true,
  });

  const dep1Fw = dep1.getControlledDeploymentFramework();
  checks.push({
    checkId: 'DEP_1',
    passed:
      dep1Fw.packageCode === 'DEP-1' &&
      dep1Fw.packageDEP1Complete === true &&
      dep1Fw.productionActivated === false &&
      dep1Fw.deploymentExecuted === false &&
      dep1Fw.preparationOnly === true,
  });

  const productApi = path.join(
    workspaceRoot,
    'sarkari-suchna-india/server/api'
  );
  let noDep2Routes = true;
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
    noDep2Routes = !routeFiles.some((f) =>
      /dep2|operator-authorization|safe-deployment|deployment-manifest/i.test(f)
    );
  }
  checks.push({
    checkId: 'NO_DEP2_PRODUCTION_ROUTES',
    passed: noDep2Routes,
  });

  return deepFreeze({
    validationVersion: FRAMEWORK_VERSION,
    part: 'REGRESSION',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    behavioralRegressionsPermitted: false,
  });
}

function getOperatorAuthorizationSafeDeploymentFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getOperatorAuthorizationSafeDeploymentFramework() {
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
    authorizationOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    automaticProductionActivation: false,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    prerequisites: PREREQUISITES.slice(),
    packageDEP2Complete: true,
    packageDEP1Unchanged: true,
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
      vpsConnectionDenied: true,
      githubPushDenied: true,
      fileUploadDenied: true,
      productionOverwriteDenied: true,
      automaticLiveTransitionDenied: true,
      program6ImplementationDenied: true,
      program7ImplementationDenied: true,
      program8ImplementationDenied: true,
    },
    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_DEP2',
      productionActivated: false,
      deploymentExecuted: false,
      publishingExecuted: false,
      automaticApprovalExecuted: false,
      pm2Started: false,
      nginxReloaded: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      databaseModified: false,
      vpsDeployed: false,
      vpsConnected: false,
      githubPushed: false,
      filesUploaded: false,
      productionOverwritten: false,
      routesCreated: false,
      productionImpact: false,
      live: false,
    },
    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_DEP2',
      status: 'OPERATOR_AUTHORIZATION_SAFE_DEPLOYMENT_FRAMEWORK_COMPLETE',
      purpose:
        'Finalize operator-controlled deployment package eligibility with whitelist manifest and authorization workflow without activating production.',
      nextPackage: 'PROGRAM_6',
      nextPackageName: 'Production Hardening',
      nextStep: 'AWAIT_EXPLICIT_OPERATOR_DEPLOYMENT_APPROVAL',
      canPrepare: true,
      canAuthorize: false,
      canDeploy: false,
      canPublish: false,
      canAutoApprove: false,
      runtimeBehaviorChanged: false,
    },
    recommendation:
      'DEP2_COMPLETE_DEPLOYMENT_PACKAGE_READY_PRODUCTION_REMAINS_INACTIVE_AWAIT_OPERATOR_APPROVAL',
  });
}

/**
 * Evaluate complete DEP-2 operator authorization & safe deployment suite.
 * @param {object} [input]
 */
function evaluateOperatorAuthorizationSafeDeploymentFramework(input = {}) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const workspaceInput = { workspaceRoot: input.workspaceRoot };

  const partA = auditRepositoryStructure({
    ...workspaceInput,
    ...(input.repositoryAudit || {}),
  });
  const partB = generateDeploymentManifest({
    ...workspaceInput,
    ...(input.manifest || {}),
  });
  const partC = validateDeploymentExclusions({
    partB,
    manifest: partB.manifest,
    ...(input.exclusions || {}),
  });
  const partD = generateProductionPackageSummary({
    ...workspaceInput,
    partB,
    manifest: partB.manifest,
    ...(input.packageSummary || {}),
  });
  const partE = assessGitHubReadiness({
    ...workspaceInput,
    partB,
    ...(input.github || {}),
  });
  const partF = assessServerReadiness({
    ...workspaceInput,
    ...(input.server || {}),
  });
  const partI = evaluateDeploymentProtection({
    ...(input.protection || {}),
  });

  const partG = evaluateDeploymentSafetyGates({
    partA,
    partB,
    partC,
    partF,
    ...(input.safetyGates || {}),
  });

  const regression = validatePriorPackageBaselines({
    ...workspaceInput,
    ...(input.regression || {}),
  });

  const partH = createOperatorAuthorizationWorkflow({
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    partI,
    allSafetyGatesPassed: partG.allGatesPassed === true,
    ...(input.authorization || {}),
  });

  const programCompatibility = assessDep2Program678Compatibility(
    input.programCompatibility || {}
  );

  // Persist advisory deployment-manifest.json only when explicitly requested
  const manifestWrite = writeDeploymentManifestFile({
    ...workspaceInput,
    write: input.writeManifest === true,
  });

  const report = buildFinalDeploymentAuthorizationAssessment({
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
    authorizationOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    authorizationState: partH.authorizationState,
    deploymentPackageReady:
      partH.authorizationState ===
        AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY ||
      partH.authorizationState === AUTHORIZATION_STATES.WAITING_FOR_OPERATOR ||
      partH.authorizationState === AUTHORIZATION_STATES.AUTHORIZED ||
      partH.authorizationState === AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED,
    productionActivationAllowed: false,
    report,
    repositoryStructureReport: partA,
    deploymentManifest: partB,
    deploymentExclusionReport: partC,
    productionPackageSummary: partD,
    githubReadinessReport: partE,
    serverReadinessReport: partF,
    deploymentSafetyGatesReport: partG,
    operatorAuthorizationWorkflow: partH,
    deploymentProtection: partI,
    program678CompatibilityReport: programCompatibility,
    manifestWrite,
    effects: {
      published: false,
      approved: false,
      pm2Started: false,
      nginxReloaded: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      deployed: false,
      productionActivated: false,
      vpsConnected: false,
      githubPushed: false,
      filesUploaded: false,
      live: false,
    },
  });
}

/**
 * Generate final deployment authorization assessment only.
 */
function generateFinalDeploymentAuthorizationAssessment(input = {}) {
  const evaluation = evaluateOperatorAuthorizationSafeDeploymentFramework(input);
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
  REPOSITORY_AUDIT_VERSION,
  DEPLOYMENT_MANIFEST_VERSION,
  EXCLUSION_VALIDATION_VERSION,
  PRODUCTION_PACKAGE_VERSION,
  GITHUB_READINESS_VERSION,
  SERVER_READINESS_VERSION,
  SAFETY_GATES_VERSION,
  AUTHORIZATION_WORKFLOW_VERSION,
  DEPLOYMENT_PROTECTION_VERSION,
  DEP2_PROGRAM_COMPAT_VERSION,
  DEP2_ASSESSMENT_VERSION,
  AUTHORIZATION_STATES,
  GATE_DEFINITIONS,
  deepFreeze,
  auditRepositoryStructure,
  generateDeploymentManifest,
  writeDeploymentManifestFile,
  validateDeploymentExclusions,
  generateProductionPackageSummary,
  assessGitHubReadiness,
  assessServerReadiness,
  evaluateDeploymentSafetyGates,
  createOperatorAuthorizationWorkflow,
  evaluateDeploymentProtection,
  assessDep2Program678Compatibility,
  validatePriorPackageBaselines,
  buildFinalDeploymentAuthorizationAssessment,
  evaluateOperatorAuthorizationSafeDeploymentFramework,
  generateFinalDeploymentAuthorizationAssessment,
  getOperatorAuthorizationSafeDeploymentFramework,
  getOperatorAuthorizationSafeDeploymentFrameworkIdentity,
};
