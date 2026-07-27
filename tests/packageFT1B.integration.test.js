'use strict';

/**
 * Package FT-1B — Integration regression: routes unwired, nav clean.
 * Static assertions only (no server/app import) to avoid Redis/BullMQ open handles.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package FT-1B does not change production surfaces', () => {
  test('no FT-1B production readiness Express route files', () => {
    const apiDir = path.join(root, 'server/api');
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let files = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(walk(full));
        else files.push(full);
      }
      return files;
    };
    const routeFiles = walk(apiDir);
    expect(
      routeFiles.some((f) => /ft1b|production-readiness|go-no-go/i.test(f))
    ).toBe(false);
  });

  test('editorial nav remains free of FT-1B links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/production-readiness');
    expect(nav).not.toContain('/admin/go-no-go');
    expect(nav).not.toContain('/admin/ft1b');
  });

  test('advisory FT-1B modules exist without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/productionReadiness/index.js');
    expect(indexSrc).toMatch(/Package FT-1B/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getProductionReadinessFramework,
    } = require('../server/lib/monitoringBot/productionReadiness');
    const framework = getProductionReadinessFramework();
    expect(framework.safetyBoundaries.pm2ActivationDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.productionActivationDenied).toBe(true);
    expect(framework.assessmentOnly).toBe(true);
  });

  test('FT-1A facade remains present and validation-only', () => {
    const {
      getSystemValidationHardeningFramework,
    } = require('../server/lib/monitoringBot/systemValidation');
    const framework = getSystemValidationHardeningFramework();
    expect(framework.packageCode).toBe('FT-1A');
    expect(framework.validationOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
  });
});
