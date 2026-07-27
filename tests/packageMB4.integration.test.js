'use strict';

/**
 * Package MB-4 — Integration regression: routes unwired, priors unchanged.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package MB-4 does not change production surfaces', () => {
  test('pipeline integration route is not activated', async () => {
    const response = await request(app).get('/admin/pipeline-integration');
    expect([404, 302, 401]).toContain(response.status);

    const extraction = await request(app).get('/admin/recruitment-extraction');
    expect([404, 302, 401]).toContain(extraction.status);
  });

  test('Program 5 advisory routes remain unwired', async () => {
    const pipeline = await request(app).get('/admin/pipeline-health');
    expect([404, 302, 401]).toContain(pipeline.status);

    const publish = await request(app).get('/admin/publish-readiness');
    expect([404, 302, 401]).toContain(publish.status);
  });

  test('editorial nav remains free of MB-4 links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/pipeline-integration');
    expect(nav).not.toContain('/admin/recruitment-extraction');
  });

  test('advisory MB-4 module exists without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/pipelineIntegration/index.js');
    expect(indexSrc).toMatch(/Package MB-4/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getPipelineIntegrationFramework,
    } = require('../server/lib/monitoringBot/pipelineIntegration');
    const framework = getPipelineIntegrationFramework();
    expect(framework.safetyBoundaries.expressRoutesDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.pageGenerationDenied).toBe(true);
    expect(framework.safetyBoundaries.runtimeActivationDenied).toBe(true);
    expect(framework.safetyBoundaries.schedulerDenied).toBe(true);
  });
});
