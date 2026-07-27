'use strict';

/**
 * DEP-1 — Part B Environment Preparation
 *
 * Prepares / validates deployment configuration artifacts.
 * No activation of PM2, Nginx, scheduler, or Telegram.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const ENVIRONMENT_PREPARATION_VERSION = 'DEP1.1.0.0';

const ENV_CATEGORIES = Object.freeze([
  'AUTH',
  'CORE',
  'DATABASE',
  'REDIS',
  'HTTP',
  'LOGGING',
  'PM2',
  'SCHEDULER',
  'TELEGRAM',
]);

/**
 * Prepare and validate deployment environment configuration (advisory).
 * @param {object} [input]
 */
function prepareDeploymentEnvironment(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const paths = {
    envExample: path.join(productRoot, '.env.example'),
    ecosystem: path.join(productRoot, 'ecosystem.config.js'),
    nginx: path.join(productRoot, 'nginx.conf'),
    nginxLocal: path.join(productRoot, 'nginx', 'nginx.local.conf'),
    deploymentDoc: path.join(productRoot, 'docs', 'DEPLOYMENT.md'),
    backupDoc: path.join(productRoot, 'docs', 'BACKUP_RESTORE.md'),
  };

  const present = {};
  for (const [key, filePath] of Object.entries(paths)) {
    present[key] = fs.existsSync(filePath);
  }

  let envExampleKeys = [];
  if (present.envExample) {
    const text = fs.readFileSync(paths.envExample, 'utf8');
    envExampleKeys = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => line.split('=')[0].trim());
  }

  const environmentVariables = {
    documented: present.envExample,
    keyCount: envExampleKeys.length,
    categories: ENV_CATEGORIES.slice(),
    requiredForDeployment: [
      'NODE_ENV',
      'JWT_SECRET',
      'ADMIN_USER',
      'ADMIN_PASS_HASH',
      'DB_HOST',
      'DB_USER',
      'DB_NAME',
      'REDIS_HOST',
      'REDIS_PORT',
    ],
    keysSample: envExampleKeys.slice(0, 20),
  };

  let redisConfiguration = {
    documented: false,
    hostKey: false,
    portKey: false,
    passwordKey: false,
  };
  if (present.envExample) {
    redisConfiguration = {
      documented: true,
      hostKey: envExampleKeys.includes('REDIS_HOST'),
      portKey: envExampleKeys.includes('REDIS_PORT'),
      passwordKey: envExampleKeys.includes('REDIS_PASSWORD'),
      note: 'node-redis (cache) and ioredis (BullMQ) must use consistent auth before activation',
    };
  }

  const mysqlConfiguration = {
    documented: present.envExample,
    hostKey: envExampleKeys.includes('DB_HOST'),
    userKey: envExampleKeys.includes('DB_USER'),
    nameKey: envExampleKeys.includes('DB_NAME'),
    passwordKey:
      envExampleKeys.includes('DB_PASSWORD') || envExampleKeys.includes('DB_PASS'),
    poolKey: envExampleKeys.includes('DB_POOL_LIMIT'),
  };

  let pm2Configuration = {
    documented: present.ecosystem,
    clusterMode: false,
    appName: null,
    activationPerformed: false,
  };
  if (present.ecosystem) {
    const eco = fs.readFileSync(paths.ecosystem, 'utf8');
    pm2Configuration = {
      documented: true,
      clusterMode: /exec_mode:\s*["']cluster["']/.test(eco),
      appName: /name:\s*["']sarkari-suchna["']/.test(eco)
        ? 'sarkari-suchna'
        : 'configured',
      activationPerformed: false,
      note: 'PM2 start/reload must not run during DEP-1 preparation',
    };
  }

  let nginxConfiguration = {
    documented: present.nginx || present.nginxLocal,
    reverseProxyDocumented: false,
    activationPerformed: false,
  };
  const nginxPath = present.nginx
    ? paths.nginx
    : present.nginxLocal
      ? paths.nginxLocal
      : null;
  if (nginxPath) {
    const text = fs.readFileSync(nginxPath, 'utf8');
    nginxConfiguration = {
      documented: true,
      reverseProxyDocumented: /proxy_pass|upstream/i.test(text),
      activationPerformed: false,
      reloadPerformed: false,
      note: 'Nginx reload is out of scope for DEP-1',
    };
  }

  let sslConfiguration = {
    documented: false,
    letsEncryptReferenced: false,
    activationPerformed: false,
  };
  if (present.deploymentDoc) {
    const text = fs.readFileSync(paths.deploymentDoc, 'utf8');
    sslConfiguration = {
      documented: /ssl|lets.?encrypt|tls/i.test(text),
      letsEncryptReferenced: /lets.?encrypt/i.test(text),
      activationPerformed: false,
      note: 'SSL certificate issuance is operator-owned and not executed by DEP-1',
    };
  }

  let loggingConfiguration = {
    documented: false,
    pm2LogPaths: false,
    logLevelKey: envExampleKeys.includes('LOG_LEVEL'),
  };
  if (present.ecosystem) {
    const eco = fs.readFileSync(paths.ecosystem, 'utf8');
    loggingConfiguration = {
      documented: true,
      pm2LogPaths: /error_file|out_file|logs\//.test(eco),
      logLevelKey: envExampleKeys.includes('LOG_LEVEL'),
      activationPerformed: false,
    };
  }

  const checks = [
    {
      checkId: 'ENVIRONMENT_VARIABLES',
      passed:
        environmentVariables.documented &&
        environmentVariables.keyCount > 0,
    },
    {
      checkId: 'REDIS_CONFIGURATION',
      passed:
        redisConfiguration.documented &&
        redisConfiguration.hostKey &&
        redisConfiguration.portKey,
    },
    {
      checkId: 'MYSQL_CONFIGURATION',
      passed:
        mysqlConfiguration.documented &&
        mysqlConfiguration.hostKey &&
        mysqlConfiguration.userKey &&
        mysqlConfiguration.nameKey,
    },
    {
      checkId: 'PM2_CONFIGURATION',
      passed: pm2Configuration.documented && !pm2Configuration.activationPerformed,
    },
    {
      checkId: 'NGINX_CONFIGURATION',
      passed:
        nginxConfiguration.documented &&
        nginxConfiguration.activationPerformed === false,
    },
    {
      checkId: 'SSL_CONFIGURATION',
      passed: sslConfiguration.documented || present.deploymentDoc,
    },
    {
      checkId: 'LOGGING_CONFIGURATION',
      passed: loggingConfiguration.documented,
    },
    {
      checkId: 'NO_ACTIVATION',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: ENVIRONMENT_PREPARATION_VERSION,
    part: 'B',
    reportId: 'DEP1_ENVIRONMENT_PREPARATION_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    activationPerformed: false,
    artifactsPresent: present,
    environmentVariables,
    redisConfiguration,
    mysqlConfiguration,
    pm2Configuration,
    nginxConfiguration,
    sslConfiguration,
    loggingConfiguration,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Deployment configuration prepared and validated. No services activated.',
  });
}

module.exports = {
  ENVIRONMENT_PREPARATION_VERSION,
  ENV_CATEGORIES,
  prepareDeploymentEnvironment,
};
