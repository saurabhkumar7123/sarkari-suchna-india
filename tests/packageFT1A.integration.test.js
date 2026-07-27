'use strict';

/**
 * Package FT-1A — Integration regression: routes unwired, priors unchanged.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package FT-1A does not change production surfaces', () => {
  test('system validation route is not activated', async () => {
    const response = await request(app).get('/admin/system-validation');
    expect([404, 302, 401]).toContain(response.status);

    const hardening = await request(app).get('/admin/final-hardening');
    expect([404, 302, 401]).toContain(hardening.status);
  });

  test('prior MB-5 / TG-1 / RW-1 routes remain unwired', async () => {
    const scheduler = await request(app).get('/admin/controlled-scheduler');
    expect([404, 302, 401]).toContain(scheduler.status);

    const telegram = await request(app).get('/admin/telegram-notification');
    expect([404, 302, 401]).toContain(telegram.status);
  });

  test('editorial nav remains free of FT-1A links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/system-validation');
    expect(nav).not.toContain('/admin/final-hardening');
  });

  test('advisory FT-1A modules exist without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/systemValidation/index.js');
    expect(indexSrc).toMatch(/Package FT-1A/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getSystemValidationHardeningFramework,
    } = require('../server/lib/monitoringBot/systemValidation');
    const framework = getSystemValidationHardeningFramework();
    expect(framework.safetyBoundaries.expressRoutesDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.productionActivationDenied).toBe(true);
    expect(framework.validationOnly).toBe(true);
  });
});
