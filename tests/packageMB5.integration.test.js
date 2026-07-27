'use strict';

/**
 * Package MB-5 — Integration regression: routes unwired, priors unchanged.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server/app');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package MB-5 does not change production surfaces', () => {
  test('controlled scheduler route is not activated', async () => {
    const response = await request(app).get('/admin/controlled-scheduler');
    expect([404, 302, 401]).toContain(response.status);

    const telegram = await request(app).get('/admin/telegram-notification');
    expect([404, 302, 401]).toContain(telegram.status);

    const review = await request(app).get('/admin/review-queue-wiring');
    expect([404, 302, 401]).toContain(review.status);
  });

  test('prior MB and Program 5 advisory routes remain unwired', async () => {
    const pipeline = await request(app).get('/admin/pipeline-integration');
    expect([404, 302, 401]).toContain(pipeline.status);

    const publish = await request(app).get('/admin/publish-readiness');
    expect([404, 302, 401]).toContain(publish.status);
  });

  test('editorial nav remains free of MB-5/TG-1/RW-1 links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/controlled-scheduler');
    expect(nav).not.toContain('/admin/telegram-notification');
    expect(nav).not.toContain('/admin/review-queue-wiring');
  });

  test('advisory MB-5 modules exist without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/controlledScheduler/index.js');
    expect(indexSrc).toMatch(/Package MB-5/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const tgSrc = read('server/lib/monitoringBot/telegramNotification/index.js');
    expect(tgSrc).toMatch(/Package TG-1/);
    expect(tgSrc).not.toMatch(/\bexpress\b/);

    const rwSrc = read('server/lib/monitoringBot/reviewQueueWiring/index.js');
    expect(rwSrc).toMatch(/Package RW-1/);
    expect(rwSrc).not.toMatch(/\bexpress\b/);

    const {
      getControlledSchedulerFramework,
    } = require('../server/lib/monitoringBot/controlledScheduler');
    const framework = getControlledSchedulerFramework();
    expect(framework.safetyBoundaries.expressRoutesDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.cronDenied).toBe(true);
    expect(framework.safetyBoundaries.redisDenied).toBe(true);
    expect(framework.schedulerDisabledByDefault).toBe(true);
  });
});
