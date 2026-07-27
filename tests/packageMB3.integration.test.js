'use strict';

/**
 * Package MB-3 — Integration regression: routes unwired, priors unchanged.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package MB-3 does not change production surfaces', () => {
  test('recruitment extraction route is not activated', async () => {
    const response = await request(app).get('/admin/recruitment-extraction');
    expect([404, 302, 401]).toContain(response.status);

    const monitoringBot = await request(app).get('/admin/monitoring-bot');
    expect([404, 302, 401]).toContain(monitoringBot.status);
  });

  test('editorial nav remains free of MB-3 links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/recruitment-extraction');
    expect(nav).not.toContain('/admin/monitoring-bot');
  });

  test('advisory MB-3 module exists without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/recruitmentExtraction/index.js');
    expect(indexSrc).toMatch(/Package MB-3/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getRecruitmentExtractionFramework,
    } = require('../server/lib/monitoringBot/recruitmentExtraction');
    const framework = getRecruitmentExtractionFramework();
    expect(framework.safetyBoundaries.expressRoutesDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.telegramDenied).toBe(true);
    expect(framework.safetyBoundaries.schedulerDenied).toBe(true);
  });

  test('MB-1 and MB-2 facades remain advisory/manual', () => {
    const {
      getGovernmentSourceRegistryFramework,
    } = require('../server/lib/monitoringBot/governmentSourceRegistry');
    const mb1 = getGovernmentSourceRegistryFramework();
    expect(mb1.packageMB2Activated).toBe(false);

    const {
      getWebsiteChangeDetectionFramework,
    } = require('../server/lib/monitoringBot/websiteChangeDetection');
    const mb2 = getWebsiteChangeDetectionFramework();
    expect(mb2.packageMB3Activated).toBe(false);
    expect(mb2.safetyBoundaries.recruitmentExtractionDenied).toBe(true);
  });
});
