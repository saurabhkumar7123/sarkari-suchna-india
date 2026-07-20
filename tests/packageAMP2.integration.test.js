'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package AMP-2 does not change production surfaces', () => {
  test('automation-workflow route is not activated', async () => {
    const response = await request(app).get('/admin/automation-workflow');
    expect([404, 302, 401]).toContain(response.status);
    expect(fs.existsSync(path.join(root, 'private/admin-automation-workflow.html'))).toBe(false);
  });

  test('admin nav does not expose AMP-2 routes', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).not.toContain('/admin/automation-workflow');
  });

  test('AMP-2 advisory module exists without express wiring', () => {
    const indexSrc = read('server/lib/recruitment/automationWorkflow/index.js');
    expect(indexSrc).toMatch(/AMP-2/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getAutomationWorkflowFramework,
    } = require('../server/lib/recruitment/automationWorkflow');
    const framework = getAutomationWorkflowFramework();
    expect(framework.safetyBoundaries.pipelineActivationDenied).toBe(true);
    expect(framework.safetyBoundaries.telegramAutoSendDenied).toBe(true);
    expect(framework.safetyBoundaries.reviewQueuePersistenceDenied).toBe(true);
    expect(framework.runtimeEffects.pipelineEnabled).toBe(false);
    expect(framework.recruitmentPipelineEnabled).toBe(false);
  });

  test('RECRUITMENT_PIPELINE_ENABLED config remains fail-safe off', () => {
    const config = require('../server/config/recruitmentPipeline');
    const enabled =
      config.RECRUITMENT_PIPELINE_ENABLED ?? config.isRecruitmentPipelineEnabled?.() ?? false;
    expect(enabled).toBe(false);
  });

  test('AMP-1 and AMP-2 facades both load independently', () => {
    const {
      getRecruitmentIntelligenceBrainFramework,
    } = require('../server/lib/recruitment/recruitmentIntelligenceBrain');
    const amp1 = getRecruitmentIntelligenceBrainFramework();
    expect(amp1.packageCode).toBe('AMP-1');
    expect(amp1.advisoryOnly).toBe(true);

    const {
      getAutomationWorkflowFramework,
    } = require('../server/lib/recruitment/automationWorkflow');
    const amp2 = getAutomationWorkflowFramework();
    expect(amp2.packageCode).toBe('AMP-2');
    expect(amp2.advisoryOnly).toBe(true);
  });

  test('work package spec is advisory-only', () => {
    const {
      buildWorkPackageSpec,
    } = require('../server/lib/recruitment/workPackages/WP_AUTOMATION_WORKFLOW');
    const spec = buildWorkPackageSpec();
    expect(spec.workPackageId).toBe('WP_AUTOMATION_WORKFLOW');
    expect(spec.advisoryMetadata.productionImpact).toBe(false);
    expect(spec.advisoryMetadata.pipelineActivation).toBe(false);
    expect(spec.advisoryMetadata.cronActivation).toBe(false);
    expect(spec.completionChecklist.every((item) => item.done === true)).toBe(true);
  });
});
