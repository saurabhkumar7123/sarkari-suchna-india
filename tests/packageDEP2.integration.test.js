'use strict';

/**
 * Package DEP-2 — Integration regression: routes unwired, nav clean.
 * Static assertions only (no server/app import) to avoid Redis/BullMQ open handles.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Package DEP-2 does not change production surfaces', () => {
  test('no DEP-2 operator authorization Express route files', () => {
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
      routeFiles.some((f) =>
        /dep2|operator-authorization|safe-deployment|deployment-manifest/i.test(f)
      )
    ).toBe(false);
  });

  test('editorial nav remains free of DEP-2 links', () => {
    const nav = read('public/assets/js/admin-nav.js');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).not.toContain('/admin/operator-authorization');
    expect(nav).not.toContain('/admin/safe-deployment');
    expect(nav).not.toContain('/admin/dep2');
  });

  test('advisory DEP-2 modules exist without express wiring', () => {
    const indexSrc = read('server/lib/monitoringBot/operatorAuthorization/index.js');
    expect(indexSrc).toMatch(/Package DEP-2/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getOperatorAuthorizationSafeDeploymentFramework,
    } = require('../server/lib/monitoringBot/operatorAuthorization');
    const framework = getOperatorAuthorizationSafeDeploymentFramework();
    expect(framework.safetyBoundaries.githubPushDenied).toBe(true);
    expect(framework.safetyBoundaries.publishingDenied).toBe(true);
    expect(framework.safetyBoundaries.productionActivationDenied).toBe(true);
    expect(framework.authorizationOnly).toBe(true);
  });

  test('DEP-1 facade remains present and preparation-only', () => {
    const {
      getControlledDeploymentFramework,
    } = require('../server/lib/monitoringBot/controlledDeployment');
    const framework = getControlledDeploymentFramework();
    expect(framework.packageCode).toBe('DEP-1');
    expect(framework.preparationOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
  });
});
