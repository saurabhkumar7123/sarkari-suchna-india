'use strict';

/**
 * Package MB-1 — Integration regression: Programs 1–5 surfaces unchanged.
 *
 * Confirms Package MB-1 did not wire runtime routes or alter Program 4/5
 * admin pages / APIs. Government source registry remains configuration-only.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package MB-1 does not change Programs 1–5 production surfaces', () => {
  test('government source registry route is not activated', async () => {
    const response = await request(app).get('/admin/government-source-registry');
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, 'private/admin-government-source-registry.html'))
    ).toBe(false);

    const monitoringBot = await request(app).get('/admin/monitoring-bot');
    expect([404, 302, 401]).toContain(monitoringBot.status);
  });

  test('prior Program 5 advisory routes remain unwired', async () => {
    const pipeline = await request(app).get('/admin/pipeline-health');
    expect([404, 302, 401]).toContain(pipeline.status);

    const publish = await request(app).get('/admin/publish-readiness');
    expect([404, 302, 401]).toContain(publish.status);
  });

  test('Program 4 editorial and shared preview surfaces still present', () => {
    expect(read('private/admin-editorial-review.html')).toContain('Editorial');
    expect(
      read('private/admin-recruitment-runtime-preview.html').length
    ).toBeGreaterThan(0);
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).toContain('data-nav-path="/admin/seo-diagnostics"');
    expect(nav).not.toContain('/admin/government-source-registry');
    expect(nav).not.toContain('/admin/monitoring-bot');
    expect(nav).not.toContain('/admin/pipeline-health');
    expect(nav).not.toContain('/admin/publish-readiness');
  });

  test('advisory MB-1 module exists without express wiring', () => {
    const indexSrc = read(
      'server/lib/monitoringBot/governmentSourceRegistry/index.js'
    );
    expect(indexSrc).toMatch(/Package MB-1/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getGovernmentSourceRegistryFramework,
    } = require('../server/lib/monitoringBot/governmentSourceRegistry');
    const framework = getGovernmentSourceRegistryFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.httpRequestsDenied).toBe(true);
    expect(framework.safetyBoundaries.scrapingDenied).toBe(true);
    expect(framework.safetyBoundaries.monitoringExecutionDenied).toBe(true);
    expect(framework.safetyBoundaries.schedulingDenied).toBe(true);
  });

  test('Programs 4–5 product facades remain present', () => {
    expect(
      fs.existsSync(
        path.join(root, 'server/lib/recruitment/pipelineHealth/index.js')
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          root,
          'server/lib/recruitment/publishReadinessAuthorization/index.js'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(root, 'server/lib/recruitment/monitoringReviewIntegration/index.js')
      )
    ).toBe(true);
  });
});
