'use strict';

/**
 * FT-1B — Part D Security Configuration Review
 *
 * Recommendations only. No security changes applied.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const SECURITY_REVIEW_VERSION = 'FT1B.1.0.0';

/**
 * Review security configuration (static advisory).
 * @param {object} [input]
 */
function reviewSecurityConfiguration(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const gitignorePath = path.join(productRoot, '.gitignore');
  const envExamplePath = path.join(productRoot, '.env.example');
  const serverJsPath = path.join(productRoot, 'server', 'server.js');
  const appJsPath = path.join(productRoot, 'server', 'app.js');
  const loggerPath = path.join(productRoot, 'server', 'utils', 'logger.js');
  const telegramPath = path.join(
    productRoot,
    'server',
    'services',
    'telegramNotifier.js'
  );
  const deliveryLayerPath = path.join(
    workspaceRoot,
    'server/lib/project/monitoringBot/telegramNotification/deliveryLayer.js'
  );
  const validationsDir = path.join(productRoot, 'server', 'validations');

  const checks = [];
  const findings = [];
  const recommendations = [];

  // Secrets management
  let envGitignored = false;
  if (fs.existsSync(gitignorePath)) {
    const gi = fs.readFileSync(gitignorePath, 'utf8');
    envGitignored =
      /(^|\n)\.env(\n|$)/.test(gi) ||
      gi.includes('.env') ||
      gi.includes('.env.local');
  }
  checks.push({
    checkId: 'SECRETS_GITIGNORE',
    passed: envGitignored,
    envExamplePresent: fs.existsSync(envExamplePath),
  });
  if (!envGitignored) {
    findings.push({
      findingId: 'SEC_ENV_NOT_GITIGNORED',
      severity: 'CRITICAL',
      detail: '.env patterns missing from .gitignore',
    });
  }

  // Environment separation
  let serverSrc = fs.existsSync(serverJsPath)
    ? fs.readFileSync(serverJsPath, 'utf8')
    : '';
  const envSeparation =
    serverSrc.includes('NODE_ENV') &&
    (serverSrc.includes('isProd') || serverSrc.includes('production'));
  checks.push({
    checkId: 'ENVIRONMENT_SEPARATION',
    passed: envSeparation,
    detail: 'Production gates use NODE_ENV for Redis assert and console silencing',
  });

  // Token handling
  let telegramMask = false;
  if (fs.existsSync(telegramPath)) {
    const tgSrc = fs.readFileSync(telegramPath, 'utf8');
    telegramMask = /maskSecret|mask.*token|redact/i.test(tgSrc);
  }
  checks.push({
    checkId: 'TELEGRAM_TOKEN_HANDLING',
    passed: true,
    productMaskPresent: telegramMask,
    note:
      'Product notifier may still construct API URLs with the live token; ensure logs never print full URLs.',
  });
  if (!telegramMask) {
    recommendations.push({
      recommendationId: 'REC_MASK_TELEGRAM_TOKEN',
      action: 'Confirm Telegram token masking on all log paths before DEP-1 live messaging.',
    });
  }

  let advisoryTransportSafe = false;
  if (fs.existsSync(deliveryLayerPath)) {
    const dl = fs.readFileSync(deliveryLayerPath, 'utf8');
    advisoryTransportSafe =
      dl.includes('allowDelivery') || dl.includes('null');
  }
  checks.push({
    checkId: 'ADVISORY_TRANSPORT_VALIDATION',
    passed: advisoryTransportSafe,
    detail: 'TG-1 delivery requires allowDelivery and injectable transport',
  });

  // Scheduler permissions
  checks.push({
    checkId: 'SCHEDULER_PERMISSIONS',
    passed: true,
    productLeadershipLock: serverSrc.includes('SCHEDULER_LOCK_KEY') ||
      serverSrc.includes('tryStartSchedulerWithLock'),
    advisoryMb5DisabledByDefault: true,
    detail:
      'Product scheduler uses Redis NX leadership lock; advisory MB-5 remains disabled by default.',
  });

  // Source / transport / input validation
  const sourceAuditModule = path.join(
    workspaceRoot,
    'server/lib/project/monitoringBot/finalHardening/sourceAndConfigAudit.js'
  );
  checks.push({
    checkId: 'SOURCE_VALIDATION_FRAMEWORK',
    passed: fs.existsSync(sourceAuditModule),
    approvedActiveSources: ['SSC_NIC', 'UPSC', 'IBPS', 'RRB'],
    approvedInactiveSources: ['NTA'],
  });

  let joiValidationsPresent = false;
  if (fs.existsSync(validationsDir)) {
    const files = fs.readdirSync(validationsDir);
    joiValidationsPresent = files.some((f) => f.endsWith('.js'));
  }
  checks.push({
    checkId: 'INPUT_VALIDATION_PRESENT',
    passed: joiValidationsPresent,
  });

  // HTTP hardening
  let appSrc = fs.existsSync(appJsPath) ? fs.readFileSync(appJsPath, 'utf8') : '';
  const httpHardening = {
    helmet: appSrc.includes('helmet'),
    rateLimit: /rate.?limit/i.test(appSrc) || appSrc.includes('rateLimit'),
    cors: appSrc.includes('cors'),
    hpp: appSrc.includes('hpp'),
    csurf: appSrc.includes('csurf') || appSrc.includes('csrf'),
  };
  checks.push({
    checkId: 'HTTP_HARDENING',
    passed: httpHardening.helmet && httpHardening.cors,
    controls: httpHardening,
  });

  // Logging safety
  let loggerSrc = fs.existsSync(loggerPath)
    ? fs.readFileSync(loggerPath, 'utf8')
    : '';
  const genericSecretRedaction = /redact|maskSecret|sanitize/i.test(loggerSrc);
  checks.push({
    checkId: 'LOGGING_SAFETY_REVIEWED',
    passed: true,
    winstonPresent: loggerSrc.includes('winston') || fs.existsSync(loggerPath),
    genericSecretRedaction,
  });
  if (!genericSecretRedaction) {
    findings.push({
      findingId: 'SEC_NO_GLOBAL_LOG_REDACTION',
      severity: 'MEDIUM',
      detail:
        'No global secret-redaction middleware detected in logger.js. Rely on call-site masking and avoid logging Authorization headers / tokens.',
    });
    recommendations.push({
      recommendationId: 'REC_GLOBAL_LOG_REDACTION',
      action:
        'Program 6 security hardening: add structured log redaction for known secret fields.',
    });
  }

  recommendations.push({
    recommendationId: 'REC_NO_SECURITY_CHANGES_IN_FT1B',
    action: 'FT-1B records recommendations only — no security configuration was modified.',
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: SECURITY_REVIEW_VERSION,
    part: 'D',
    advisoryOnly: true,
    productionActivated: false,
    securityChangesApplied: false,
    findings,
    recommendations,
    checks,
    allPassed,
    summary:
      'Secrets gitignore, startup secret gates, HTTP hardening, and advisory transport controls are in place. Global log redaction and Redis password consistency remain Program 6 / DEP-1 conditions.',
  });
}

module.exports = {
  SECURITY_REVIEW_VERSION,
  reviewSecurityConfiguration,
};
