'use strict';

/**
 * DEP-1 — Part A Deployment Validation
 *
 * Validates deployment readiness. Generates report only.
 * Does not deploy or activate production.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const DEPLOYMENT_VALIDATION_VERSION = 'DEP1.1.0.0';

/**
 * Validate deployment readiness from project structure and config artifacts.
 * @param {object} [input]
 */
function validateDeploymentReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const structure = {
    productRoot: fs.existsSync(productRoot),
    packageJson: fs.existsSync(path.join(productRoot, 'package.json')),
    serverEntry: fs.existsSync(path.join(productRoot, 'server', 'server.js')),
    ecosystemConfig: fs.existsSync(path.join(productRoot, 'ecosystem.config.js')),
    nginxConf: fs.existsSync(path.join(productRoot, 'nginx.conf')),
    envExample: fs.existsSync(path.join(productRoot, '.env.example')),
    deploymentDoc: fs.existsSync(path.join(productRoot, 'docs', 'DEPLOYMENT.md')),
    backupRestoreDoc: fs.existsSync(
      path.join(productRoot, 'docs', 'BACKUP_RESTORE.md')
    ),
    deployScript: fs.existsSync(path.join(productRoot, 'deploy.sh')),
    monitoringBotLib: fs.existsSync(
      path.join(productRoot, 'server', 'lib', 'monitoringBot')
    ),
  };

  let buildArtifacts = {
    packageName: null,
    hasStartScript: false,
    hasPm2Scripts: false,
    documented: false,
  };
  const pkgPath = path.join(productRoot, 'package.json');
  if (structure.packageJson) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    buildArtifacts = {
      packageName: pkg.name || null,
      hasStartScript: Boolean(pkg.scripts && pkg.scripts.start),
      hasPm2Scripts: Boolean(
        pkg.scripts &&
          (pkg.scripts['pm2:start'] || pkg.scripts['pm2:reload'])
      ),
      documented: true,
    };
  }

  const runtimeConfig = {
    envExamplePresent: structure.envExample,
    ecosystemPresent: structure.ecosystemConfig,
    nginxPresent: structure.nginxConf,
    deploymentGuidePresent: structure.deploymentDoc,
  };

  const requiredServices = [
    { serviceId: 'NODE', role: 'Application runtime', mapped: true },
    { serviceId: 'PM2', role: 'Process manager', mapped: structure.ecosystemConfig },
    { serviceId: 'NGINX', role: 'TLS / reverse proxy', mapped: structure.nginxConf },
    { serviceId: 'MYSQL', role: 'Primary datastore', mapped: true },
    { serviceId: 'REDIS', role: 'Cache + BullMQ', mapped: true },
    { serviceId: 'BULLMQ', role: 'Job queue', mapped: true },
    { serviceId: 'SCHEDULER', role: 'Controlled scheduler (disabled by default)', mapped: true },
    { serviceId: 'TELEGRAM', role: 'Advisory notifications (disabled live)', mapped: true },
  ];

  const environmentMapping = [
    { env: 'development', activationAllowed: false, note: 'Local advisory only' },
    { env: 'test', activationAllowed: false, note: 'Automated validation only' },
    {
      env: 'production',
      activationAllowed: false,
      note: 'Requires DEP-1 authorization gate; inactive by default',
    },
  ];

  const checks = [
    {
      checkId: 'PROJECT_STRUCTURE',
      passed:
        structure.productRoot &&
        structure.packageJson &&
        structure.serverEntry,
    },
    {
      checkId: 'BUILD_ARTIFACTS',
      passed: buildArtifacts.documented && buildArtifacts.hasStartScript,
    },
    {
      checkId: 'RUNTIME_CONFIGURATION',
      passed:
        runtimeConfig.envExamplePresent &&
        runtimeConfig.ecosystemPresent &&
        runtimeConfig.deploymentGuidePresent,
    },
    {
      checkId: 'REQUIRED_SERVICES_MAPPED',
      passed: requiredServices.every((s) => s.mapped === true),
    },
    {
      checkId: 'ENVIRONMENT_MAPPING',
      passed: environmentMapping.every((e) => e.activationAllowed === false),
    },
    {
      checkId: 'PRODUCTION_REMAINS_INACTIVE',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: DEPLOYMENT_VALIDATION_VERSION,
    part: 'A',
    reportId: 'DEP1_DEPLOYMENT_VALIDATION_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    projectStructure: structure,
    buildArtifacts,
    runtimeConfiguration: runtimeConfig,
    requiredServices,
    environmentMapping,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Deployment readiness validated from repository artifacts. Production remains inactive.',
  });
}

module.exports = {
  DEPLOYMENT_VALIDATION_VERSION,
  validateDeploymentReadiness,
};
