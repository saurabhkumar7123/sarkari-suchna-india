'use strict';

/**
 * Package AMP-1 — Integration regression: no production surfaces changed.
 *
 * Confirms AMP-1 did not wire runtime routes, activate pipeline,
 * or alter existing admin pages / APIs.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package AMP-1 does not change production surfaces', () => {
  test('recruitment-intelligence-brain route is not activated', async () => {
    const response = await request(app).get('/admin/recruitment-intelligence-brain');
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, 'private/admin-recruitment-intelligence-brain.html'))
    ).toBe(false);
  });

  test('prior Program 5 advisory routes remain unwired', async () => {
    const pipeline = await request(app).get('/admin/pipeline-health');
    expect([404, 302, 401]).toContain(pipeline.status);

    const draft = await request(app).get('/admin/draft-preparation');
    expect([404, 302, 401]).toContain(draft.status);
  });

  test('admin nav does not expose AMP-1 routes', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).not.toContain('/admin/recruitment-intelligence-brain');
    expect(nav).not.toContain('/admin/pipeline-health');
    expect(nav).not.toContain('/admin/draft-preparation');
  });

  test('advisory module exists without express wiring', () => {
    const indexSrc = read('server/lib/recruitment/recruitmentIntelligenceBrain/index.js');
    expect(indexSrc).toMatch(/AMP-1/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getRecruitmentIntelligenceBrainFramework,
    } = require('../server/lib/recruitment/recruitmentIntelligenceBrain');
    const framework = getRecruitmentIntelligenceBrainFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.pipelineActivationDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
    expect(framework.recruitmentPipelineEnabled).toBe(false);
  });

  test('RECRUITMENT_PIPELINE_ENABLED config remains fail-safe off', () => {
    const config = require('../server/config/recruitmentPipeline');
    const enabled =
      config.RECRUITMENT_PIPELINE_ENABLED ?? config.isRecruitmentPipelineEnabled?.() ?? false;
    expect(enabled).toBe(false);
  });

  test('Package 5D and AMP-1 facades both load independently', () => {
    const {
      getDraftPreparationFramework,
    } = require('../server/lib/recruitment/draftPreparation');
    const p5d = getDraftPreparationFramework();
    expect(p5d.packageCode).toBe('5D');
    expect(p5d.advisoryOnly).toBe(true);

    const {
      getRecruitmentIntelligenceBrainFramework,
    } = require('../server/lib/recruitment/recruitmentIntelligenceBrain');
    const amp1 = getRecruitmentIntelligenceBrainFramework();
    expect(amp1.packageCode).toBe('AMP-1');
    expect(amp1.advisoryOnly).toBe(true);
  });

  test('work package spec is advisory-only', () => {
    const { buildWorkPackageSpec } = require('../server/lib/recruitment/workPackages/WP_RECRUITMENT_INTELLIGENCE_BRAIN');
    const spec = buildWorkPackageSpec();
    expect(spec.workPackageId).toBe('WP_RECRUITMENT_INTELLIGENCE_BRAIN');
    expect(spec.advisoryMetadata.productionImpact).toBe(false);
    expect(spec.advisoryMetadata.pipelineActivation).toBe(false);
    expect(spec.completionChecklist.every((c) => c.done === true)).toBe(true);
  });
});
