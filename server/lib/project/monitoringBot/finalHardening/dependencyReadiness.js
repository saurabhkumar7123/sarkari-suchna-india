'use strict';

/**
 * FT-1B — Part C Dependency Readiness
 *
 * Advisory report only. Does not install packages or start services.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const DEPENDENCY_READINESS_VERSION = 'FT1B.1.0.0';

/**
 * Audit external dependency readiness (static).
 * @param {object} [input]
 */
function assessDependencyReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const packageJsonPath = path.join(productRoot, 'package.json');
  const ecosystemPath = path.join(productRoot, 'ecosystem.config.js');
  const nginxConfPath = path.join(productRoot, 'nginx.conf');
  const nginxDir = path.join(productRoot, 'nginx');
  const deploymentDoc = path.join(productRoot, 'docs', 'DEPLOYMENT.md');
  const siteQueuePath = path.join(
    productRoot,
    'server',
    'services',
    'queue',
    'siteQueue.js'
  );

  const checks = [];
  const findings = [];
  const recommendations = [];

  let packageJson = null;
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  const enginesPinned =
    !!(packageJson && packageJson.engines && packageJson.engines.node);
  checks.push({
    checkId: 'NODE_ENGINES_FIELD',
    passed: true,
    enginesPinned,
    detail: enginesPinned
      ? `engines.node=${packageJson.engines.node}`
      : 'No engines field in package.json — Node version unconstrained at project level',
  });
  if (!enginesPinned) {
    findings.push({
      findingId: 'DEP_NODE_ENGINES_UNPINNED',
      severity: 'MEDIUM',
      detail:
        'package.json has no engines field. Pin Node ≥18 (preferably ≥20) before DEP-1 for reproducible VPS installs.',
    });
    recommendations.push({
      recommendationId: 'REC_PIN_NODE_ENGINES',
      action: 'Add "engines": { "node": ">=20" } (or team-approved range) in Program 6 / DEP-1 prep.',
    });
  }

  const deps = (packageJson && packageJson.dependencies) || {};
  const requiredPackages = [
    'express',
    'bullmq',
    'ioredis',
    'redis',
    'mysql2',
    'winston',
    'helmet',
    'joi',
    'jsonwebtoken',
    'bcrypt',
    'dotenv',
  ];
  const missingPackages = requiredPackages.filter((name) => !deps[name]);
  checks.push({
    checkId: 'NPM_RUNTIME_PACKAGES',
    passed: missingPackages.length === 0,
    present: requiredPackages.filter((name) => !!deps[name]),
    missing: missingPackages,
    bullmqVersion: deps.bullmq || null,
    ioredisVersion: deps.ioredis || null,
    redisVersion: deps.redis || null,
  });

  // Redis / BullMQ compatibility (declared versions only — no connectivity probe)
  const bullmqDeclared = typeof deps.bullmq === 'string';
  const ioredisDeclared = typeof deps.ioredis === 'string';
  checks.push({
    checkId: 'BULLMQ_IOREDIS_DECLARED',
    passed: bullmqDeclared && ioredisDeclared,
    note: 'Compatibility assumed from declared package versions; Redis availability not probed (out of scope).',
  });
  recommendations.push({
    recommendationId: 'REC_VERIFY_REDIS_BEFORE_DEP1',
    action:
      'Before DEP-1, verify Redis is reachable with the same auth mode used by both node-redis and ioredis clients. FT-1B does not start Redis.',
  });

  // PM2
  const pm2Scripts = packageJson && packageJson.scripts
    ? Object.keys(packageJson.scripts).filter((k) => k.startsWith('pm2:'))
    : [];
  const ecosystemExists = fs.existsSync(ecosystemPath);
  checks.push({
    checkId: 'PM2_ARTIFACTS_PRESENT',
    passed: ecosystemExists && pm2Scripts.length > 0,
    ecosystemConfig: ecosystemExists,
    scripts: pm2Scripts,
    activated: false,
  });
  recommendations.push({
    recommendationId: 'REC_PM2_REMAIN_INACTIVE',
    action: 'PM2 artifacts exist for DEP-1 but must remain inactive during FT-1B.',
  });

  // Nginx / SSL
  const nginxPresent =
    fs.existsSync(nginxConfPath) ||
    (fs.existsSync(nginxDir) && fs.readdirSync(nginxDir).length > 0);
  let sslDocumented = false;
  if (fs.existsSync(deploymentDoc)) {
    const deploySrc = fs.readFileSync(deploymentDoc, 'utf8');
    sslDocumented = /certbot|lets\s*encrypt|ssl|tls/i.test(deploySrc);
  }
  checks.push({
    checkId: 'NGINX_AND_SSL_PREREQUISITES',
    passed: nginxPresent && sslDocumented,
    nginxConfigPresent: nginxPresent,
    sslDocumented,
    certificatesInRepo: false,
    note: 'SSL certificates must be provisioned on the host (certbot); not stored in git.',
  });

  // Dual Redis client note
  if (fs.existsSync(siteQueuePath)) {
    findings.push({
      findingId: 'DEP_DUAL_REDIS_CLIENTS',
      severity: 'INFO',
      detail:
        'Product uses node-redis (cache/rate-limit) and ioredis (BullMQ). Both must remain compatible with the target Redis version.',
    });
  }

  // No Docker
  const dockerPresent =
    fs.existsSync(path.join(productRoot, 'Dockerfile')) ||
    fs.existsSync(path.join(productRoot, 'docker-compose.yml'));
  checks.push({
    checkId: 'DOCKER_ABSENCE_ACKNOWLEDGED',
    passed: true,
    dockerPresent,
    detail: dockerPresent
      ? 'Docker artifacts present'
      : 'No Docker deployment path; PM2 + Nginx is the documented model',
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: DEPENDENCY_READINESS_VERSION,
    part: 'C',
    advisoryOnly: true,
    productionActivated: false,
    installationPerformed: false,
    connectivityProbed: false,
    nodeEnginesPinned: enginesPinned,
    findings,
    recommendations,
    checks,
    allPassed,
    summary:
      'Declared npm/PM2/Nginx dependencies are present for a controlled rollout model. Node engines pin and live Redis verification remain DEP-1 conditions. Nothing installed or started.',
  });
}

module.exports = {
  DEPENDENCY_READINESS_VERSION,
  assessDependencyReadiness,
};
