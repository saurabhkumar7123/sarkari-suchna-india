'use strict';

/**
 * Package MB-4 / AMP-4B — Product-side Pipeline Integration facade.
 *
 * Production integration over enterprise repositories and workflow persistence.
 * Publishing remains manual-only.
 */

const path = require('path');
const { getAutomationFlags } = require('../../../config/automationFlags');
const { runProductionDetectionPipeline } = require('../../recruitment/productionRuntime');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/pipelineIntegration/packageMB4PipelineIntegrationFramework.js'
);

const framework = require(frameworkPath);

function evaluateProductPipelineIntegration(input = {}) {
  const result = framework.evaluatePipelineIntegrationFramework(input);

  return framework.deepFreeze({
    ...result,
    productReuse: {
      mb3RecruitmentExtraction: true,
      program5LifecycleEngine: true,
      program5DraftPreparation: true,
      program5CandidateResolution: true,
      program5PublishReadiness: true,
      program5MonitoringReview: true,
      program5PipelineHealth: true,
      programs1to5Complete: true,
    },
  });
}

async function integrateProductProductionPipeline(input = {}) {
  const flags = getAutomationFlags();
  const productionEnabled = flags.RECRUITMENT_PIPELINE_ENABLED === true;

  if (!productionEnabled) {
    return framework.deepFreeze({
      skipped: true,
      reason: 'recruitment_pipeline_disabled',
      productFacade: 'PIPELINE_INTEGRATION',
      publishingDenied: true,
      autoPublishDenied: flags.AUTO_PUBLISH_ENABLED !== true,
    });
  }

  const runtimeResult = await runProductionDetectionPipeline({
    notice: input.notification || input.notice || {},
    updateId: input.updateId || null,
    candidateRecruitments: input.existingRecruitments || input.candidateRecruitments || [],
    lookupSummary: input.lookupSummary || null,
    monitoredSite: input.monitoredSite || null,
  });

  return framework.deepFreeze({
    productFacade: 'PIPELINE_INTEGRATION',
    productionEnabled: true,
    publishingDenied: true,
    pageGenerationDenied: true,
    autoPublishDenied: flags.AUTO_PUBLISH_ENABLED !== true,
    runtimeResult,
  });
}

function integrateProductAdvisoryPipeline(input = {}) {
  const result = framework.runAdvisoryPipelineIntegration(input);

  return framework.deepFreeze({
    ...result,
    productFacade: 'PIPELINE_INTEGRATION',
    publishingDenied: true,
    pageGenerationDenied: true,
    deprecated: true,
    useProductionIntegration: 'integrateProductProductionPipeline',
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  EXTENSION_POINTS: framework.EXTENSION_POINTS,
  mapToAdvisoryPipelinePayload: framework.mapToAdvisoryPipelinePayload,
  generateAdvisoryPreviewPayload: framework.generateAdvisoryPreviewPayload,
  generateIntegrationDiagnostics: framework.generateIntegrationDiagnostics,
  integrateAdvisoryCandidateWithPipeline:
    framework.integrateAdvisoryCandidateWithPipeline,
  runAdvisoryPipelineIntegration: framework.runAdvisoryPipelineIntegration,
  evaluatePipelineIntegrationFramework:
    framework.evaluatePipelineIntegrationFramework,
  evaluateProductPipelineIntegration,
  integrateProductAdvisoryPipeline,
  integrateProductProductionPipeline,
  getPipelineIntegrationFramework: framework.getPipelineIntegrationFramework,
  getPipelineIntegrationFrameworkIdentity:
    framework.getPipelineIntegrationFrameworkIdentity,
};
