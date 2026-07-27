'use strict';

/**
 * Package DEP-1 — Integration regression: routes unwired, nav clean.
 * Static assertions only (no server/app import) to avoid Redis/BullMQ open handles.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package DEP-1 does not change production surfaces', () => {
  test('no DEP-1 controlled deployment Express route files', () => {
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
      routeFiles.some((f) => /dep1|controlled-deployment|authorization-gate/i.test(f))
    ).toBe(false);
  });

  test('editorial nav remains free of DEP-1 links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/controlled-deployment');
    expect(nav).not.toContain('/admin/authorization-gate');
    expect(nav).not.toContain('/admin/dep1');
  });

  test('advisory DEP-1 modules exist without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/controlledDeployment/index.js');
    expect(indexSrc).toMatch(/Package DEP-1/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getControlledDeploymentFramework,
    } = require('../server/lib/monitoringBot/controlledDeployment');
    const framework = getControlledDeploymentFramework();
    expect(framework.safetyBoundaries.pm2ActivationDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.productionActivationDenied).toBe(true);
    expect(framework.preparationOnly).toBe(true);
  });

  test('FT-1B facade remains present and assessment-only', () => {
    const {
      getProductionReadinessFramework,
    } = require('../server/lib/monitoringBot/productionReadiness');
    const framework = getProductionReadinessFramework();
    expect(framework.packageCode).toBe('FT-1B');
    expect(framework.assessmentOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
  });
});
