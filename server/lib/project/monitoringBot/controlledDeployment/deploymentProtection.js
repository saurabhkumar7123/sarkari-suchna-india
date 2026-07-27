'use strict';

/**
 * DEP-2 — Part I Deployment Protection
 *
 * Hard denial of all automatic deployment / activation actions.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const DEPLOYMENT_PROTECTION_VERSION = 'DEP2.1.0.0';

const PROTECTED_ACTIONS = Object.freeze([
  {
    actionId: 'GITHUB_PUSH',
    description: 'Automatically push to GitHub',
    denied: true,
  },
  {
    actionId: 'VPS_CONNECT',
    description: 'Automatically connect to VPS',
    denied: true,
  },
  {
    actionId: 'FILE_UPLOAD',
    description: 'Automatically upload files',
    denied: true,
  },
  {
    actionId: 'PRODUCTION_OVERWRITE',
    description: 'Automatically overwrite production',
    denied: true,
  },
  {
    actionId: 'PM2_START',
    description: 'Automatically start PM2',
    denied: true,
  },
  {
    actionId: 'NGINX_RELOAD',
    description: 'Automatically reload Nginx',
    denied: true,
  },
  {
    actionId: 'SCHEDULER_ENABLE',
    description: 'Automatically enable Scheduler',
    denied: true,
  },
  {
    actionId: 'TELEGRAM_LIVE_TRANSPORT',
    description: 'Automatically enable Telegram live transport',
    denied: true,
  },
  {
    actionId: 'CONTENT_PUBLISH',
    description: 'Automatically publish content',
    denied: true,
  },
]);

/**
 * Evaluate deployment protection posture.
 * @param {object} [input]
 */
function evaluateDeploymentProtection(input = {}) {
  const actions = PROTECTED_ACTIONS.map((action) => ({
    ...action,
    executed: false,
    requiresExplicitOperatorApproval: true,
  }));

  const checks = [
    {
      checkId: 'ALL_ACTIONS_DENIED',
      passed: actions.every((a) => a.denied === true),
    },
    {
      checkId: 'NONE_EXECUTED',
      passed: actions.every((a) => a.executed === false),
    },
    {
      checkId: 'EXPLICIT_APPROVAL_REQUIRED',
      passed: actions.every((a) => a.requiresExplicitOperatorApproval === true),
    },
    {
      checkId: 'NINE_PROTECTIONS',
      passed: actions.length === 9,
    },
  ];

  return deepFreeze({
    validationVersion: DEPLOYMENT_PROTECTION_VERSION,
    part: 'I',
    reportId: 'DEP2_DEPLOYMENT_PROTECTION',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    protectedActions: actions,
    githubPushed: false,
    vpsConnected: false,
    filesUploaded: false,
    productionOverwritten: false,
    pm2Started: false,
    nginxReloaded: false,
    schedulerEnabled: false,
    telegramLiveEnabled: false,
    contentPublished: false,
    operatorApprovalRequired: true,
    automaticDeploymentDenied: true,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Deployment protection active. Every production action requires explicit operator approval.',
  });
}

module.exports = {
  DEPLOYMENT_PROTECTION_VERSION,
  PROTECTED_ACTIONS,
  evaluateDeploymentProtection,
};
