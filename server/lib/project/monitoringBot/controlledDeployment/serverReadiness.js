'use strict';

/**
 * DEP-2 — Part F Server Readiness (advisory only)
 *
 * Review VPS readiness from local artifacts.
 * Do NOT connect to VPS.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const SERVER_READINESS_VERSION = 'DEP2.1.0.0';

const REQUIRED_ENV_KEYS = Object.freeze([
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_NAME',
  'REDIS_HOST',
  'REDIS_PORT',
]);

/**
 * Assess VPS / server readiness without connecting remotely.
 * @param {object} [input]
 */
function assessServerReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const ecosystemPath = path.join(productRoot, 'ecosystem.config.js');
  const nginxPath = path.join(productRoot, 'nginx.conf');
  const envExamplePath = path.join(productRoot, '.env.example');
  const deployScriptPath = path.join(productRoot, 'deploy.sh');
  const backupDocPath = path.join(productRoot, 'docs', 'BACKUP_RESTORE.md');
  const deploymentDocPath = path.join(productRoot, 'docs', 'DEPLOYMENT.md');

  let pm2 = {
    configPresent: false,
    appsDocumented: [],
    activationPerformed: false,
  };
  if (fs.existsSync(ecosystemPath)) {
    const src = fs.readFileSync(ecosystemPath, 'utf8');
    pm2 = {
      configPresent: true,
      appsDocumented: [
        /name:\s*["']sarkari-suchna["']/.test(src) ? 'sarkari-suchna' : null,
        /name:\s*["']worker["']/.test(src) ? 'worker' : null,
      ].filter(Boolean),
      clusterModeDocumented: /exec_mode:\s*["']cluster["']/.test(src),
      activationPerformed: false,
    };
  }

  let nginx = {
    configPresent: false,
    upstreamDocumented: false,
    sslDocumented: false,
    reloadPerformed: false,
  };
  if (fs.existsSync(nginxPath)) {
    const src = fs.readFileSync(nginxPath, 'utf8');
    nginx = {
      configPresent: true,
      upstreamDocumented: /upstream\s+node_app/.test(src),
      sslDocumented: /ssl|certbot|443/i.test(src),
      reloadPerformed: false,
    };
  }

  let environment = {
    examplePresent: false,
    requiredKeysDocumented: [],
    missingKeys: [],
    secretsLoaded: false,
  };
  if (fs.existsSync(envExamplePath)) {
    const src = fs.readFileSync(envExamplePath, 'utf8');
    const documented = REQUIRED_ENV_KEYS.filter((key) =>
      new RegExp(`^${key}=`, 'm').test(src)
    );
    environment = {
      examplePresent: true,
      requiredKeysDocumented: documented,
      missingKeys: REQUIRED_ENV_KEYS.filter((k) => !documented.includes(k)),
      secretsLoaded: false,
      connectivityProbed: false,
    };
  }

  const redis = {
    hostDocumented: environment.requiredKeysDocumented.includes('REDIS_HOST'),
    portDocumented: environment.requiredKeysDocumented.includes('REDIS_PORT'),
    connectivityProbed: false,
    verifiedByOperator: input.redisVerified === true,
  };

  const mysql = {
    hostDocumented: environment.requiredKeysDocumented.includes('DB_HOST'),
    nameDocumented: environment.requiredKeysDocumented.includes('DB_NAME'),
    connectivityProbed: false,
    verifiedByOperator: input.mysqlVerified === true,
  };

  const nodeVersion = {
    localVersion: process.version || null,
    enginesFieldPresent: false,
    recommended: '>=18',
    compatible:
      typeof process.versions?.node === 'string' &&
      Number(process.versions.node.split('.')[0]) >= 18,
  };
  const pkgPath = path.join(productRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    nodeVersion.enginesFieldPresent = Boolean(pkg.engines && pkg.engines.node);
  }

  const permissions = {
    deployScriptPresent: fs.existsSync(deployScriptPath),
    advisoryOnly: true,
    remotePermissionsVerified: false,
    note: 'Remote filesystem permissions must be verified by operator on VPS.',
  };

  const diskSpace = {
    remoteChecked: false,
    advisoryOnly: true,
    note: 'Disk space must be verified by operator on VPS before deploy.',
  };

  const rollbackPackage = {
    documentationPresent:
      fs.existsSync(backupDocPath) || fs.existsSync(deploymentDocPath),
    rollbackExecuted: false,
    verifiedByOperator: input.rollbackVerified === true,
  };

  const ssl = {
    nginxSslGuidancePresent: nginx.sslDocumented,
    certificatesInstalledVerified: false,
    note: 'SSL certificate installation must be confirmed by operator; DEP-2 does not connect to VPS.',
  };

  const checks = [
    { checkId: 'PM2_CONFIG', passed: pm2.configPresent && pm2.appsDocumented.length >= 1 },
    { checkId: 'NGINX_CONFIG', passed: nginx.configPresent && nginx.upstreamDocumented },
    { checkId: 'SSL_GUIDANCE', passed: ssl.nginxSslGuidancePresent },
    {
      checkId: 'ENV_KEYS_DOCUMENTED',
      passed:
        environment.examplePresent && environment.missingKeys.length === 0,
    },
    { checkId: 'REDIS_DOCUMENTED', passed: redis.hostDocumented && redis.portDocumented },
    { checkId: 'MYSQL_DOCUMENTED', passed: mysql.hostDocumented && mysql.nameDocumented },
    { checkId: 'NODE_VERSION_LOCAL', passed: nodeVersion.compatible },
    { checkId: 'PERMISSIONS_ADVISORY', passed: permissions.deployScriptPresent },
    { checkId: 'DISK_SPACE_ADVISORY', passed: true },
    {
      checkId: 'ROLLBACK_PACKAGE_DOCUMENTED',
      passed: rollbackPackage.documentationPresent,
    },
    { checkId: 'NO_VPS_CONNECTION', passed: true },
    { checkId: 'NO_PM2_START', passed: pm2.activationPerformed === false },
    { checkId: 'NO_NGINX_RELOAD', passed: nginx.reloadPerformed === false },
  ];

  return deepFreeze({
    validationVersion: SERVER_READINESS_VERSION,
    part: 'F',
    reportId: 'DEP2_SERVER_READINESS_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    vpsConnected: false,
    pm2,
    nginx,
    ssl,
    environment,
    redis,
    mysql,
    nodeVersion,
    permissions,
    diskSpace,
    rollbackPackage,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Server readiness reviewed from local artifacts only. No VPS connection, PM2 start, or Nginx reload was performed.',
  });
}

module.exports = {
  SERVER_READINESS_VERSION,
  REQUIRED_ENV_KEYS,
  assessServerReadiness,
};
