'use strict';

/**
 * FT-1B — Part A Environment Validation
 *
 * Generates a validation report only. Does not activate production,
 * load live secrets into runtime, or mutate environment.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const ENVIRONMENT_VALIDATION_VERSION = 'FT1B.1.0.0';

const REQUIRED_RUNTIME_VARIABLES = Object.freeze([
  {
    name: 'JWT_SECRET',
    category: 'AUTH',
    rules: ['REQUIRED', 'MIN_LENGTH_64', 'REJECT_PLACEHOLDER'],
  },
  {
    name: 'ADMIN_USER',
    category: 'AUTH',
    rules: ['REQUIRED', 'MIN_LENGTH_3'],
  },
  {
    name: 'ADMIN_PASS_HASH',
    category: 'AUTH',
    rules: ['REQUIRED', 'BCRYPT_HASH_FORMAT'],
  },
  {
    name: 'NODE_ENV',
    category: 'CORE',
    rules: ['REQUIRED_FOR_DEPLOYMENT', 'ENUM_development_test_production'],
  },
  {
    name: 'DB_HOST',
    category: 'DATABASE',
    rules: ['REQUIRED_FOR_DEPLOYMENT'],
  },
  {
    name: 'DB_USER',
    category: 'DATABASE',
    rules: ['REQUIRED_FOR_DEPLOYMENT'],
  },
  {
    name: 'DB_NAME',
    category: 'DATABASE',
    rules: ['REQUIRED_FOR_DEPLOYMENT'],
  },
  {
    name: 'REDIS_HOST',
    category: 'REDIS',
    rules: ['REQUIRED_IN_PRODUCTION'],
  },
  {
    name: 'REDIS_PORT',
    category: 'REDIS',
    rules: ['REQUIRED_IN_PRODUCTION', 'NUMERIC_PORT'],
  },
]);

const OPTIONAL_VARIABLES = Object.freeze([
  { name: 'PORT', category: 'CORE', defaultValue: '3000' },
  { name: 'BIND_HOST', category: 'CORE', defaultValue: '0.0.0.0' },
  { name: 'SITE_URL', category: 'CORE' },
  { name: 'TRUST_PROXY', category: 'CORE', defaultValue: '0' },
  { name: 'DB_PASSWORD', category: 'DATABASE', aliases: ['DB_PASS'] },
  { name: 'DB_POOL_LIMIT', category: 'DATABASE', defaultValue: '20' },
  { name: 'REDIS_PASSWORD', category: 'REDIS', note: 'Used by BullMQ/ioredis; node-redis cache client does not wire password' },
  { name: 'CORS_ORIGINS', category: 'HTTP' },
  { name: 'COOKIE_DOMAIN', category: 'HTTP' },
  { name: 'PRODUCTION_COOKIE_DOMAIN', category: 'HTTP' },
  { name: 'LOG_LEVEL', category: 'LOGGING', defaultValue: 'info' },
  { name: 'OPENAI_API_KEY', category: 'AI' },
  { name: 'OPENAI_MODEL', category: 'AI', defaultValue: 'gpt-4o-mini' },
  { name: 'PM2_INSTANCES', category: 'PM2' },
  { name: 'PM2_MAX_MEMORY', category: 'PM2' },
]);

const SCHEDULER_VARIABLES = Object.freeze([
  'UPDATE_CHECK_INTERVAL_MINUTES',
  'UPDATE_MIN_TITLE_LENGTH',
  'UPDATE_ALERT_COOLDOWN_MINUTES',
  'UPDATE_RETENTION_DAYS',
  'UPDATE_WORKER_CONCURRENCY',
  'SCHEDULER_LOCK_KEY',
  'SCHEDULER_LOCK_TTL_SECONDS',
  'QUEUE_WAITING_ALERT_THRESHOLD',
  'QUEUE_ALERT_COOLDOWN_MINUTES',
  'QUEUE_ALERT_LOCK_KEY',
]);

const TELEGRAM_VARIABLES = Object.freeze([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_STARTUP_TEST',
]);

const MONITORING_FEATURE_FLAGS = Object.freeze([
  {
    name: 'RECRUITMENT_PIPELINE_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED',
    expectedDefault: 'off',
    advisoryDefault: false,
  },
  {
    name: 'CONTENT_IMPORT_ENABLED',
    expectedDefault: 'documented',
    advisoryDefault: null,
  },
  {
    name: 'CSV_LEGACY_STATIC_HTML',
    expectedDefault: '0',
    advisoryDefault: false,
  },
]);

const ADVISORY_FEATURE_FLAGS = Object.freeze({
  schedulerEnabledByDefault: false,
  telegramLiveDeliveryDefault: false,
  publishingEnabled: false,
  automaticApprovalEnabled: false,
  cronEnabled: false,
  redisEnabled: false,
  expressRoutesActivated: false,
});

/**
 * Parse .env.example keys without evaluating values as live secrets.
 * @param {string} envExamplePath
 */
function parseEnvExampleKeys(envExamplePath) {
  if (!fs.existsSync(envExamplePath)) {
    return { exists: false, keys: [], rawLines: 0 };
  }
  const text = fs.readFileSync(envExamplePath, 'utf8');
  const keys = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keys.push(match[1]);
  }
  return { exists: true, keys, rawLines: lines.length };
}

/**
 * Validate required runtime configuration catalog (report only).
 * @param {object} [input]
 */
function validateEnvironmentConfiguration(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const envExamplePath = path.join(productRoot, '.env.example');
  const serverJsPath = path.join(productRoot, 'server', 'server.js');
  const redisConfigPath = path.join(productRoot, 'server', 'config', 'redis.js');
  const siteQueuePath = path.join(
    productRoot,
    'server',
    'services',
    'queue',
    'siteQueue.js'
  );

  const envExample = parseEnvExampleKeys(envExamplePath);
  const exampleKeySet = new Set(envExample.keys);

  const checks = [];
  const missingFromExample = [];
  const invalidCatalogNotes = [];
  const findings = [];

  for (const variable of REQUIRED_RUNTIME_VARIABLES) {
    const inExample = exampleKeySet.has(variable.name);
    if (!inExample && variable.name !== 'NODE_ENV') {
      // NODE_ENV is set by npm scripts; may still appear in example
      missingFromExample.push(variable.name);
    }
    checks.push({
      checkId: `REQUIRED_${variable.name}`,
      category: variable.category,
      passed: variable.name === 'NODE_ENV' ? true : inExample,
      rules: variable.rules.slice(),
      documentedInEnvExample: inExample,
    });
  }

  // Startup gate presence
  let startupGatePresent = false;
  if (fs.existsSync(serverJsPath)) {
    const serverSrc = fs.readFileSync(serverJsPath, 'utf8');
    startupGatePresent =
      serverSrc.includes('assertCriticalAuthSecrets') &&
      serverSrc.includes('JWT_SECRET') &&
      serverSrc.includes('ADMIN_PASS_HASH');
    checks.push({
      checkId: 'STARTUP_AUTH_SECRET_GATE',
      passed: startupGatePresent,
      detail:
        'server.js refuses weak JWT_SECRET / invalid ADMIN_PASS_HASH outside test',
    });
  } else {
    checks.push({
      checkId: 'STARTUP_AUTH_SECRET_GATE',
      passed: false,
      detail: 'server.js missing',
    });
  }

  // Redis password asymmetry
  let redisPasswordAsymmetry = false;
  if (fs.existsSync(redisConfigPath) && fs.existsSync(siteQueuePath)) {
    const redisSrc = fs.readFileSync(redisConfigPath, 'utf8');
    const queueSrc = fs.readFileSync(siteQueuePath, 'utf8');
    const cacheIgnoresPassword = !redisSrc.includes('REDIS_PASSWORD');
    const bullmqUsesPassword = queueSrc.includes('REDIS_PASSWORD');
    redisPasswordAsymmetry = cacheIgnoresPassword && bullmqUsesPassword;
    if (redisPasswordAsymmetry) {
      findings.push({
        findingId: 'ENV_REDIS_PASSWORD_ASYMMETRY',
        severity: 'HIGH',
        detail:
          'REDIS_PASSWORD is consumed by BullMQ/ioredis but not by server/config/redis.js (node-redis). Password-protected Redis may break cache/rate-limit while queues authenticate.',
      });
      invalidCatalogNotes.push(
        'REDIS_PASSWORD wiring inconsistent between cache client and queue client'
      );
    }
    checks.push({
      checkId: 'REDIS_PASSWORD_ASYMMETRY_SURFACED',
      passed: true,
      asymmetryDetected: redisPasswordAsymmetry,
      detail:
        'Asymmetry is reported as a DEP-1 condition when detected; catalog validation still passes.',
    });
  }

  // Scheduler / Telegram / monitoring documentation
  const schedulerDocumented = SCHEDULER_VARIABLES.every((name) =>
    exampleKeySet.has(name)
  );
  checks.push({
    checkId: 'SCHEDULER_CONFIGURATION_DOCUMENTED',
    passed: schedulerDocumented,
    variables: SCHEDULER_VARIABLES.slice(),
  });

  const telegramDocumented = TELEGRAM_VARIABLES.filter(
    (n) => n !== 'TELEGRAM_STARTUP_TEST'
  ).every((name) => exampleKeySet.has(name));
  checks.push({
    checkId: 'TELEGRAM_CONFIGURATION_DOCUMENTED',
    passed: telegramDocumented,
    variables: TELEGRAM_VARIABLES.slice(),
    note: 'TELEGRAM_STARTUP_TEST is optional and commented by default',
  });

  const monitoringFlagsDocumented = MONITORING_FEATURE_FLAGS.every((flag) => {
    const text = fs.existsSync(envExamplePath)
      ? fs.readFileSync(envExamplePath, 'utf8')
      : '';
    return text.includes(flag.name);
  });
  checks.push({
    checkId: 'MONITORING_FEATURE_FLAGS_DOCUMENTED',
    passed: monitoringFlagsDocumented,
    flags: MONITORING_FEATURE_FLAGS.map((f) => f.name),
  });

  // Optional variables inventory
  const optionalStatus = OPTIONAL_VARIABLES.map((variable) => ({
    name: variable.name,
    category: variable.category,
    documentedInEnvExample: exampleKeySet.has(variable.name),
    defaultValue: variable.defaultValue || null,
    note: variable.note || null,
  }));

  const allPassed =
    checks.every((c) => c.passed === true) && missingFromExample.length === 0;

  return deepFreeze({
    validationVersion: ENVIRONMENT_VALIDATION_VERSION,
    part: 'A',
    reportId: 'FT1B_ENVIRONMENT_VALIDATION_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    envExampleExists: envExample.exists,
    envExampleKeyCount: envExample.keys.length,
    requiredVariables: REQUIRED_RUNTIME_VARIABLES.slice(),
    optionalVariables: optionalStatus,
    schedulerConfiguration: {
      variables: SCHEDULER_VARIABLES.slice(),
      documented: schedulerDocumented,
      note:
        'Product site-update scheduler is distinct from advisory MB-5 controlled scheduler (disabled by default).',
    },
    telegramConfiguration: {
      variables: TELEGRAM_VARIABLES.slice(),
      documented: telegramDocumented,
      liveDeliveryDefault: false,
      note:
        'Product Telegram notifier is separate from TG-1 advisory null/memory transport.',
    },
    monitoringConfiguration: {
      featureFlags: MONITORING_FEATURE_FLAGS.slice(),
      documented: monitoringFlagsDocumented,
      recruitmentPipelineDefaultOff: true,
    },
    advisoryFeatureFlags: ADVISORY_FEATURE_FLAGS,
    missingVariables: missingFromExample,
    invalidValueCatalog: invalidCatalogNotes,
    findings,
    checks,
    allPassed,
    summary: allPassed
      ? 'Environment catalog and startup gates validated; optional Redis password asymmetry may still appear as a finding when present.'
      : 'Environment validation incomplete — resolve failing checks before DEP-1.',
  });
}

module.exports = {
  ENVIRONMENT_VALIDATION_VERSION,
  REQUIRED_RUNTIME_VARIABLES,
  OPTIONAL_VARIABLES,
  SCHEDULER_VARIABLES,
  TELEGRAM_VARIABLES,
  MONITORING_FEATURE_FLAGS,
  ADVISORY_FEATURE_FLAGS,
  validateEnvironmentConfiguration,
};
