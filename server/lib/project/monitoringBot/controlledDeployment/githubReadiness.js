'use strict';

/**
 * DEP-2 — Part E GitHub Readiness (advisory)
 *
 * Review GitHub readiness. DO NOT push. DO NOT create commits.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const GITHUB_READINESS_VERSION = 'DEP2.1.0.0';

/**
 * Assess GitHub readiness without performing git operations that mutate remotes.
 * @param {object} [input]
 */
function assessGitHubReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const gitignorePath = path.join(productRoot, '.gitignore');
  const gitignorePresent = fs.existsSync(gitignorePath);
  let gitignoreContent = '';
  if (gitignorePresent) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  const gitignoreChecks = {
    ignoresNodeModules: /node_modules\//.test(gitignoreContent),
    ignoresEnv: /^\.env$/m.test(gitignoreContent) || /\.env/.test(gitignoreContent),
    ignoresLogs: /logs\//.test(gitignoreContent),
    ignoresTempUploads: /storage\/temp\//.test(gitignoreContent) || /storage\/uploads\//.test(gitignoreContent),
  };

  const manifestPresent =
    Boolean(input.partB && input.partB.manifest) ||
    fs.existsSync(path.join(__dirname, 'deployment-manifest.json'));

  const productGitPresent = fs.existsSync(path.join(productRoot, '.git'));
  const workspaceGitPresent = fs.existsSync(path.join(workspaceRoot, '.git'));

  // Cleanliness: flag known temp artifacts that should not ship
  const dirtyMarkers = [];
  const productEntries = fs.existsSync(productRoot)
    ? fs.readdirSync(productRoot)
    : [];
  for (const name of productEntries) {
    if (name.startsWith('tmp-') || name.endsWith('.log')) {
      dirtyMarkers.push(`sarkari-suchna-india/${name}`);
    }
  }
  if (fs.existsSync(path.join(productRoot, 'logs'))) {
    dirtyMarkers.push('sarkari-suchna-india/logs/');
  }

  const releaseBranchReadiness = {
    advisoryOnly: true,
    recommendedBranch: 'release/controlled-deployment',
    pushPerformed: false,
    commitCreated: false,
    remoteUpdated: false,
    note:
      'Release branch readiness is advisory. Operator must create/push branches explicitly.',
  };

  const checks = [
    {
      checkId: 'GITIGNORE_PRESENT',
      passed: gitignorePresent,
    },
    {
      checkId: 'GITIGNORE_NODE_MODULES',
      passed: gitignoreChecks.ignoresNodeModules,
    },
    {
      checkId: 'GITIGNORE_ENV',
      passed: gitignoreChecks.ignoresEnv,
    },
    {
      checkId: 'GITIGNORE_LOGS',
      passed: gitignoreChecks.ignoresLogs,
    },
    {
      checkId: 'DEPLOYMENT_MANIFEST_AVAILABLE',
      passed: manifestPresent,
    },
    {
      checkId: 'NO_AUTOMATIC_PUSH',
      passed: true,
    },
    {
      checkId: 'NO_AUTOMATIC_COMMIT',
      passed: true,
    },
    {
      checkId: 'REPOSITORY_CLEANLINESS_REVIEWED',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: GITHUB_READINESS_VERSION,
    part: 'E',
    reportId: 'DEP2_GITHUB_READINESS_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    pushPerformed: false,
    commitCreated: false,
    gitignorePresent,
    gitignoreChecks,
    manifestPresent,
    productGitPresent,
    workspaceGitPresent,
    releaseBranchReadiness,
    dirtyMarkers,
    cleanlinessNote:
      dirtyMarkers.length > 0
        ? 'Local temp/log markers observed; ensure they remain gitignored and outside the deployment whitelist.'
        : 'No obvious unignored temp markers at product root.',
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'GitHub readiness reviewed. No push and no automatic commits were performed.',
  });
}

module.exports = {
  GITHUB_READINESS_VERSION,
  assessGitHubReadiness,
};
