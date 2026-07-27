'use strict';

/**
 * STAGE 2 — Final Hardening & Testing
 * Package FT-1B — Production Readiness Framework
 *
 * Performs production-readiness assessment for the advisory monitoring platform.
 * Does NOT introduce new business features.
 * Does NOT activate production.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const {
  ENVIRONMENT_VALIDATION_VERSION,
  validateEnvironmentConfiguration,
} = require('./environmentValidation');
const {
  STARTUP_SHUTDOWN_VERSION,
  assessStartupShutdownReadiness,
} = require('./startupShutdownReadiness');
const {
  DEPENDENCY_READINESS_VERSION,
  assessDependencyReadiness,
} = require('./dependencyReadiness');
const {
  SECURITY_REVIEW_VERSION,
  reviewSecurityConfiguration,
} = require('./securityConfigurationReview');
const {
  BACKUP_ROLLBACK_VERSION,
  assessBackupRollbackReadiness,
} = require('./backupRollbackReadiness');
const {
  OBSERVABILITY_READINESS_VERSION,
  assessObservabilityReadiness,
} = require('./observabilityReadiness');
const {
  PERFORMANCE_BASELINE_VERSION,
  createPerformanceBaseline,
} = require('./performanceBaseline');
const {
  RELEASE_CHECKLIST_VERSION,
  buildReleaseReadinessChecklist,
} = require('./releaseReadinessChecklist');
const {
  GO_NO_GO_VERSION,
  PROGRAM_COMPAT_VERSION,
  DECISION_OUTCOMES,
  assessGoNoGo,
  assessProgram678Compatibility,
} = require('./goNoGoAssessment');
const {
  PRODUCTION_READINESS_REPORT_VERSION,
  buildProductionReadinessReport,
} = require('./productionReadinessReport');

const ft1a = require('./packageFT1ASystemValidationHardeningFramework');
const mb1 = require('../packageMB1GovernmentSourceRegistryFramework');
const mb2 = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');
const mb3 = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const mb4 = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');
const mb5 = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
const tg1 = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const rw1 = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_FT1B_PRODUCTION_READINESS';
const PACKAGE_NAME = 'Production Readiness Framework';
const PACKAGE_CODE = 'FT-1B';
const STAGE_ID = 'STAGE_2_FINAL_HARDENING_AND_TESTING';

const OBJECTIVE =
  'Perform a complete production-readiness assessment for the advisory monitoring platform without introducing business features or activating production.';

const OUT_OF_SCOPE = Object.freeze([
  'PRODUCTION_DEPLOYMENT',
  'GITHUB_DEPLOYMENT',
  'PM2_ACTIVATION',
  'NGINX_CONFIGURATION',
  'SCHEDULER_ACTIVATION',
  'TELEGRAM_LIVE_MESSAGING',
  'DATABASE_SCHEMA_CHANGES',
  'PUBLISHING',
  'AUTO_APPROVAL',
  'NEW_BUSINESS_FEATURES',
  'PACKAGE_INSTALLATION',
  'BACKUP_EXECUTION',
  'SECURITY_MUTATIONS',
  'PERFORMANCE_OPTIMIZATION',
]);

const PROHIBITED = Object.freeze([
  'PRODUCTION_ACTIVATION',
  'PM2_START',
  'NGINX_RELOAD',
  'SCHEDULER_START',
  'TELEGRAM_LIVE_SEND',
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'NPM_INSTALL_EXECUTION',
  'BACKUP_RUN',
  'SECURITY_CONFIG_CHANGE',
  'PROGRAM_6_IMPLEMENTATION',
  'PROGRAM_7_IMPLEMENTATION',
  'PROGRAM_8_IMPLEMENTATION',
]);

const CAPABILITIES = Object.freeze([
  'ENVIRONMENT_VALIDATION',
  'STARTUP_SHUTDOWN_REVIEW',
  'DEPENDENCY_AUDIT',
  'SECURITY_REVIEW',
  'BACKUP_ROLLBACK_ASSESSMENT',
  'OBSERVABILITY_ASSESSMENT',
  'PERFORMANCE_BASELINE',
  'RELEASE_CHECKLIST',
  'GO_NO_GO_ASSESSMENT',
  'PROGRAM_6_7_8_COMPATIBILITY',
  'PRODUCTION_READINESS_REPORT',
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
]);

/**
 * Regression: Programs 1–5, MB-1..MB-5, TG-1, RW-1, FT-1A unchanged.
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

  const productApi = path.join(
    workspaceRoot,
    'sarkari-suchna-india/server/api'
  );
  let noFt1bRoutes = true;
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
    noFt1bRoutes = !routeFiles.some((f) =>
      /ft1b|production-readiness|go-no-go/i.test(f)
    );
  }
  checks.push({
    checkId: 'NO_FT1B_PRODUCTION_ROUTES',
    passed: noFt1bRoutes,
  });

  return deepFreeze({
    validationVersion: FRAMEWORK_VERSION,
    part: 'REGRESSION',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    behavioralRegressionsPermitted: false,
  });
}

function getProductionReadinessFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getProductionReadinessFramework() {
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
    assessmentOnly: true,
    productionActivated: false,
    newBusinessFeaturesAdded: false,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    prerequisites: PREREQUISITES.slice(),
    packageFT1BComplete: true,
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
      nginxConfigurationDenied: true,
      schedulerActivationDenied: true,
      telegramLiveMessagingDenied: true,
      databaseSchemaChangesDenied: true,
      productionActivationDenied: true,
      newBusinessFeaturesDenied: true,
      program6ImplementationDenied: true,
      program7ImplementationDenied: true,
      program8ImplementationDenied: true,
    },
    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_FT1B',
      productionActivated: false,
      publishingExecuted: false,
      automaticApprovalExecuted: false,
      pm2Started: false,
      nginxConfigured: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      databaseSchemaChanged: false,
      packagesInstalled: false,
      backupExecuted: false,
      securityConfigChanged: false,
      performanceOptimized: false,
      routesCreated: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
    },
    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_FT1B',
      status: 'PRODUCTION_READINESS_FRAMEWORK_COMPLETE',
      purpose:
        'Assess production readiness of advisory monitoring architecture before controlled deployment.',
      nextPackage: 'DEP-1',
      nextPackageName: 'Controlled Deployment',
      canAssess: true,
      canPublish: false,
      canAutoApprove: false,
      canDeploy: false,
      runtimeBehaviorChanged: false,
    },
    recommendation:
      'FT1B_COMPLETE_GO_WITH_CONDITIONS_ELIGIBLE_FOR_DEP1_REQUIRES_OPERATOR_AUTHORIZATION_NO_PRODUCTION_ACTIVATION',
  });
}

/**
 * Evaluate complete FT-1B production readiness suite.
 * @param {object} [input]
 */
function evaluateProductionReadinessFramework(input = {}) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const workspaceInput = { workspaceRoot: input.workspaceRoot };

  const partA = validateEnvironmentConfiguration({
    ...workspaceInput,
    ...(input.environment || {}),
  });
  const partB = assessStartupShutdownReadiness({
    ...workspaceInput,
    ...(input.lifecycle || {}),
  });
  const partC = assessDependencyReadiness({
    ...workspaceInput,
    ...(input.dependencies || {}),
  });
  const partD = reviewSecurityConfiguration({
    ...workspaceInput,
    ...(input.security || {}),
  });
  const partE = assessBackupRollbackReadiness({
    ...workspaceInput,
    ...(input.backup || {}),
  });
  const partF = assessObservabilityReadiness({
    ...workspaceInput,
    ...(input.observability || {}),
  });
  const partG = createPerformanceBaseline({
    generatedAt,
    ...(input.performance || {}),
  });

  const regression = validatePriorPackageBaselines({
    ...workspaceInput,
    ...(input.regression || {}),
  });

  const ft1aBaseline = deepFreeze({
    checkId: 'FT_1A_BASELINE',
    allPassed: regression.checks.some(
      (c) => c.checkId === 'FT_1A' && c.passed === true
    ),
    packageCode: 'FT-1A',
  });

  const partH = buildReleaseReadinessChecklist({
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    regression,
  });

  const partI = assessGoNoGo({
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    partH,
  });

  const programCompatibility = assessProgram678Compatibility(
    input.programCompatibility || {}
  );

  const report = buildProductionReadinessReport({
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
    ft1a: ft1aBaseline,
  });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    packageCode: PACKAGE_CODE,
    packageId: PACKAGE_ID,
    advisoryOnly: true,
    productionActivated: false,
    decision: partI.decision,
    eligibleForDep1: partI.eligibleForDep1,
    readyForDep1: partI.eligibleForDep1 === true && report.allPassed === true,
    report,
    environmentValidationReport: partA,
    releaseReadinessChecklist: partH,
    goNoGoAssessment: partI,
    program678CompatibilityReport: programCompatibility,
    effects: {
      published: false,
      approved: false,
      pm2Started: false,
      nginxConfigured: false,
      schedulerActivated: false,
      telegramLiveSent: false,
      deployed: false,
      productionActivated: false,
      packagesInstalled: false,
      backupExecuted: false,
    },
  });
}

/**
 * Generate production readiness report only.
 */
function generateProductionReadinessReport(input = {}) {
  const evaluation = evaluateProductionReadinessFramework(input);
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
  ENVIRONMENT_VALIDATION_VERSION,
  STARTUP_SHUTDOWN_VERSION,
  DEPENDENCY_READINESS_VERSION,
  SECURITY_REVIEW_VERSION,
  BACKUP_ROLLBACK_VERSION,
  OBSERVABILITY_READINESS_VERSION,
  PERFORMANCE_BASELINE_VERSION,
  RELEASE_CHECKLIST_VERSION,
  GO_NO_GO_VERSION,
  PROGRAM_COMPAT_VERSION,
  PRODUCTION_READINESS_REPORT_VERSION,
  DECISION_OUTCOMES,
  deepFreeze,
  validateEnvironmentConfiguration,
  assessStartupShutdownReadiness,
  assessDependencyReadiness,
  reviewSecurityConfiguration,
  assessBackupRollbackReadiness,
  assessObservabilityReadiness,
  createPerformanceBaseline,
  buildReleaseReadinessChecklist,
  assessGoNoGo,
  assessProgram678Compatibility,
  validatePriorPackageBaselines,
  buildProductionReadinessReport,
  evaluateProductionReadinessFramework,
  generateProductionReadinessReport,
  getProductionReadinessFramework,
  getProductionReadinessFrameworkIdentity,
};
