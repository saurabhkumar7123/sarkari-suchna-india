'use strict';

/**
 * STAGE 2 — Final Hardening & Testing
 * Package FT-1A — System Validation & Hardening Framework
 *
 * Validates the complete advisory monitoring workflow.
 * Does NOT add business features.
 * Does NOT activate production.
 *
 * Focus: validation, reliability, configuration auditing,
 * regression, and operational safety.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const {
  END_TO_END_VALIDATION_VERSION,
  WORKFLOW_STAGES,
  validateEndToEndAdvisoryFlow,
  validateSchedulerControls,
  validateTelegramSafety,
  validateReviewWorkflow,
} = require('./endToEndValidation');
const {
  SOURCE_CONFIG_AUDIT_VERSION,
  APPROVED_ACTIVE_SOURCE_IDS,
  APPROVED_INACTIVE_SOURCE_IDS,
  auditGovernmentSources,
  auditConfiguration,
} = require('./sourceAndConfigAudit');
const {
  FAILURE_INJECTION_VERSION,
  validateFailureInjection,
} = require('./failureInjectionValidation');
const {
  OPEN_HANDLE_INVESTIGATION_VERSION,
  investigateOpenHandles,
} = require('./openHandleInvestigation');
const {
  VALIDATION_REPORT_VERSION,
  buildSystemValidationReport,
} = require('./validationReport');

const mb1 = require('../packageMB1GovernmentSourceRegistryFramework');
const mb2 = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');
const mb3 = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const mb4 = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');
const mb5 = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
const tg1 = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const rw1 = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_FT1A_SYSTEM_VALIDATION_HARDENING';
const PACKAGE_NAME = 'System Validation & Hardening Framework';
const PACKAGE_CODE = 'FT-1A';
const STAGE_ID = 'STAGE_2_FINAL_HARDENING_AND_TESTING';

const OBJECTIVE =
  'Perform complete system validation of the advisory monitoring workflow without adding business features or activating production.';

const OUT_OF_SCOPE = Object.freeze([
  'DEPLOYMENT',
  'PUBLISHING',
  'AUTO_APPROVAL',
  'CRON',
  'OS_SERVICES',
  'WORKERS',
  'REDIS',
  'EXPRESS_ACTIVATION',
  'NEW_BUSINESS_FEATURES',
  'PRODUCTION_ACTIVATION',
]);

const PROHIBITED = Object.freeze([
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'CRON_INSTALLATION',
  'OS_SERVICE_INSTALLATION',
  'WORKER_ACTIVATION',
  'EXPRESS_ROUTES',
  'REDIS_DEPENDENCY',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
  'PRODUCTION_ACTIVATION',
]);

const CAPABILITIES = Object.freeze([
  'END_TO_END_VALIDATION',
  'REGRESSION_VALIDATION',
  'SCHEDULER_VALIDATION',
  'TELEGRAM_VALIDATION',
  'REVIEW_VALIDATION',
  'SOURCE_AUDIT',
  'CONFIGURATION_AUDIT',
  'FAILURE_INJECTION',
  'OPEN_HANDLE_INVESTIGATION',
  'VALIDATION_REPORT',
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
]);

/**
 * Part B — Regression validation for Programs 1–5, MB-1..MB-5, TG-1, RW-1.
 */
function validateRegressionBaselines(input = {}) {
  const checks = [];
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');

  // Program 1
  try {
    const p1 = require('../../../recruitment/implementation/package1AArchitectureFreezeAndSingleSourceOfTruth.js');
    const report = p1.getPackage1AArchitectureFreezeAndSingleSourceOfTruth();
    checks.push({
      checkId: 'PROGRAM_1',
      passed:
        report.architectureFrozen === true && report.runtimeActivated === false,
    });
  } catch (error) {
    checks.push({
      checkId: 'PROGRAM_1',
      passed: false,
      detail: error.message,
    });
  }

  // Program 4
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

  // Program 5A–5F
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

  const mb1Fw = mb1.getGovernmentSourceRegistryFramework();
  checks.push({
    checkId: 'MB_1',
    passed: mb1Fw.packageCode === 'MB-1' && mb1Fw.advisoryOnly === true,
  });

  const mb2Fw = mb2.getWebsiteChangeDetectionFramework();
  checks.push({
    checkId: 'MB_2',
    passed:
      mb2Fw.packageCode === 'MB-2' && mb2Fw.manualInvocationOnly === true,
  });

  const mb3Fw = mb3.getRecruitmentExtractionFramework();
  checks.push({
    checkId: 'MB_3',
    passed: mb3Fw.packageCode === 'MB-3' && mb3Fw.packageMB4Activated === false,
  });

  const mb4Fw = mb4.getPipelineIntegrationFramework();
  checks.push({
    checkId: 'MB_4',
    passed:
      mb4Fw.packageCode === 'MB-4' &&
      mb4Fw.packageMB5Activated === false &&
      mb4Fw.safetyBoundaries.publishingDenied === true,
  });

  const mb5Fw = mb5.getControlledSchedulerFramework();
  checks.push({
    checkId: 'MB_5',
    passed:
      mb5Fw.packageCode === 'MB-5' &&
      mb5Fw.schedulerDisabledByDefault === true &&
      mb5Fw.safetyBoundaries.publishingDenied === true &&
      mb5Fw.safetyBoundaries.automaticApprovalDenied === true,
  });

  const tgFw = tg1.getTelegramNotificationFramework();
  checks.push({
    checkId: 'TG_1',
    passed:
      tgFw.packageCode === 'TG-1' &&
      tgFw.safetyBoundaries.automaticSendingDenied === true,
  });

  const rwFw = rw1.getReviewQueueWiringFramework();
  checks.push({
    checkId: 'RW_1',
    passed:
      rwFw.packageCode === 'RW-1' &&
      rwFw.safetyBoundaries.databaseWritesDenied === true &&
      rwFw.safetyBoundaries.publishingDenied === true,
  });

  // No new Express routes for FT-1A
  const productApi = path.join(
    workspaceRoot,
    'sarkari-suchna-india/server/api'
  );
  let noFt1aRoutes = true;
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
    noFt1aRoutes = !routeFiles.some((f) =>
      /ft1a|system-validation|final-hardening/i.test(f)
    );
  }
  checks.push({
    checkId: 'NO_FT1A_PRODUCTION_ROUTES',
    passed: noFt1aRoutes,
  });

  return deepFreeze({
    validationVersion: FRAMEWORK_VERSION,
    part: 'B',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    behavioralRegressionsPermitted: false,
  });
}

function getSystemValidationHardeningFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getSystemValidationHardeningFramework() {
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
    validationOnly: true,
    productionActivated: false,
    newBusinessFeaturesAdded: false,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    prerequisites: PREREQUISITES.slice(),
    workflowStages: WORKFLOW_STAGES.slice(),
    packageFT1AComplete: true,
    packageMB1Unchanged: true,
    packageMB2HardenedInactiveSkipOnly: true,
    packageMB3Unchanged: true,
    packageMB4Unchanged: true,
    packageMB5HardenedInactiveSkipOnly: true,
    packageTG1Unchanged: true,
    packageRW1Unchanged: true,
    safetyBoundaries: {
      publishingDenied: true,
      automaticApprovalDenied: true,
      cronDenied: true,
      osServicesDenied: true,
      workerActivationDenied: true,
      expressRoutesDenied: true,
      redisDenied: true,
      productionActivationDenied: true,
      newBusinessFeaturesDenied: true,
    },
    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_FT1A',
      productionActivated: false,
      publishingExecuted: false,
      automaticApprovalExecuted: false,
      cronInstalled: false,
      osServiceStarted: false,
      workerStarted: false,
      routesCreated: false,
      redisUsed: false,
      databaseWritten: false,
      telegramAutoSent: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
    },
    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_FT1A',
      status: 'SYSTEM_VALIDATION_HARDENING_FRAMEWORK_COMPLETE',
      purpose:
        'Validate advisory monitoring workflow reliability and operational safety before production readiness.',
      nextPackage: 'FT-1B',
      nextPackageName: 'Production Readiness',
      canValidate: true,
      canPublish: false,
      canAutoApprove: false,
      canDeploy: false,
      runtimeBehaviorChanged: false,
    },
    recommendation:
      'FT1A_COMPLETE_READY_FOR_FT1B_PRODUCTION_READINESS_NO_PRODUCTION_ACTIVATION',
  });
}

/**
 * Evaluate / run the complete FT-1A validation suite and produce a report.
 * @param {object} [input]
 */
async function evaluateSystemValidationHardeningFramework(input = {}) {
  const generatedAt = input.generatedAt || new Date().toISOString();

  const partA = await validateEndToEndAdvisoryFlow(input.endToEnd || {});
  const partB = validateRegressionBaselines(input.regression || {});
  const partC = await validateSchedulerControls(input.scheduler || {});
  const partD = await validateTelegramSafety(input.telegram || {});
  const partE = validateReviewWorkflow(input.review || {});
  const partF = await auditGovernmentSources(input.sourceAudit || {});
  const partG = auditConfiguration(input.configAudit || {});
  const partH = await validateFailureInjection(input.failureInjection || {});
  const partI = investigateOpenHandles(input.openHandles || {});

  const report = buildSystemValidationReport({
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
  });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    packageCode: PACKAGE_CODE,
    packageId: PACKAGE_ID,
    advisoryOnly: true,
    productionActivated: false,
    readyForFT1B: report.allPassed === true,
    report,
    effects: {
      published: false,
      approved: false,
      cronInstalled: false,
      deployed: false,
      productionActivated: false,
      databaseWritten: false,
      telegramAutoSent: false,
    },
  });
}

/**
 * Generate validation report only (alias for evaluate).
 */
async function generateSystemValidationReport(input = {}) {
  const evaluation = await evaluateSystemValidationHardeningFramework(input);
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
  END_TO_END_VALIDATION_VERSION,
  SOURCE_CONFIG_AUDIT_VERSION,
  FAILURE_INJECTION_VERSION,
  OPEN_HANDLE_INVESTIGATION_VERSION,
  VALIDATION_REPORT_VERSION,
  WORKFLOW_STAGES,
  APPROVED_ACTIVE_SOURCE_IDS,
  APPROVED_INACTIVE_SOURCE_IDS,
  deepFreeze,
  validateEndToEndAdvisoryFlow,
  validateRegressionBaselines,
  validateSchedulerControls,
  validateTelegramSafety,
  validateReviewWorkflow,
  auditGovernmentSources,
  auditConfiguration,
  validateFailureInjection,
  investigateOpenHandles,
  buildSystemValidationReport,
  evaluateSystemValidationHardeningFramework,
  generateSystemValidationReport,
  getSystemValidationHardeningFramework,
  getSystemValidationHardeningFrameworkIdentity,
};
