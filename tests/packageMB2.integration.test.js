'use strict';

/**
 * Package MB-2 — Integration regression: Programs 1–5 / MB-1 surfaces unchanged.
 *
 * Confirms Package MB-2 did not wire runtime routes or alter Program 4/5
 * admin pages / APIs. Change detection remains manually invokable only.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package MB-2 does not change Programs 1–5 / MB-1 production surfaces', () => {
  test('website change detection route is not activated', async () => {
    const response = await request(app).get('/admin/website-change-detection');
    expect([404, 302, 401]).toContain(response.status);

    const monitoringBot = await request(app).get('/admin/monitoring-bot');
    expect([404, 302, 401]).toContain(monitoringBot.status);

    const registry = await request(app).get('/admin/government-source-registry');
    expect([404, 302, 401]).toContain(registry.status);
  });

  test('prior Program 5 advisory routes remain unwired', async () => {
    const pipeline = await request(app).get('/admin/pipeline-health');
    expect([404, 302, 401]).toContain(pipeline.status);

    const publish = await request(app).get('/admin/publish-readiness');
    expect([404, 302, 401]).toContain(publish.status);
  });

  test('Program 4 editorial nav remains free of monitoring-bot links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/website-change-detection');
    expect(nav).not.toContain('/admin/monitoring-bot');
    expect(nav).not.toContain('/admin/government-source-registry');
  });

  test('advisory MB-2 module exists without express wiring', () => {
    const indexSrc = read(
      'server/lib/monitoringBot/websiteChangeDetection/index.js'
    );
    expect(indexSrc).toMatch(/Package MB-2/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getWebsiteChangeDetectionFramework,
    } = require('../server/lib/monitoringBot/websiteChangeDetection');
    const framework = getWebsiteChangeDetectionFramework();
    expect(framework.safetyBoundaries.expressRoutesDenied).toBe(true);
    expect(framework.safetyBoundaries.recruitmentExtractionDenied).toBe(true);
    expect(framework.safetyBoundaries.telegramDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.schedulerDenied).toBe(true);
    expect(framework.safetyBoundaries.workersDenied).toBe(true);
  });

  test('MB-1 facade remains present and configuration-only', () => {
    const {
      getGovernmentSourceRegistryFramework,
    } = require('../server/lib/monitoringBot/governmentSourceRegistry');
    const mb1 = getGovernmentSourceRegistryFramework();
    expect(mb1.packageCode).toBe('MB-1');
    expect(mb1.packageMB2Activated).toBe(false);
    expect(mb1.runtimeEffects.httpRequestsPerformed).toBe(false);
    expect(mb1.safetyBoundaries.monitoringExecutionDenied).toBe(true);
  });
});
