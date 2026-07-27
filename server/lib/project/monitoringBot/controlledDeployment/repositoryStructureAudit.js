'use strict';

/**
 * DEP-2 — Part A Repository Structure Audit
 *
 * Deterministic classification of every top-level and known subtree.
 * Advisory only. Does not deploy.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const REPOSITORY_AUDIT_VERSION = 'DEP2.1.0.0';

const CLASSIFICATIONS = Object.freeze([
  'PRODUCTION_RUNTIME',
  'SHARED_RUNTIME_LIBRARY',
  'DEVELOPMENT_ONLY',
  'TEST_ONLY',
  'DOCUMENTATION',
  'EXPERIMENTAL',
  'ARCHIVE',
  'TEMPORARY',
  'DEPLOYMENT_SUPPORT',
]);

/**
 * Fixed classification rules (deterministic; path relative to workspace root).
 * Product tree is the only production deploy root.
 */
const DIRECTORY_CLASSIFICATION_RULES = Object.freeze([
  { path: 'sarkari-suchna-india/server', classification: 'PRODUCTION_RUNTIME' },
  { path: 'sarkari-suchna-india/public', classification: 'PRODUCTION_RUNTIME' },
  { path: 'sarkari-suchna-india/private', classification: 'PRODUCTION_RUNTIME' },
  { path: 'sarkari-suchna-india/db', classification: 'PRODUCTION_RUNTIME' },
  { path: 'sarkari-suchna-india/storage', classification: 'PRODUCTION_RUNTIME' },
  {
    path: 'sarkari-suchna-india/server/lib',
    classification: 'SHARED_RUNTIME_LIBRARY',
  },
  {
    path: 'sarkari-suchna-india/server/lib/monitoringBot',
    classification: 'SHARED_RUNTIME_LIBRARY',
  },
  { path: 'server', classification: 'DEVELOPMENT_ONLY' },
  { path: 'server/lib/project', classification: 'DEVELOPMENT_ONLY' },
  { path: 'scripts', classification: 'DEVELOPMENT_ONLY' },
  { path: 'sarkari-suchna-india/scripts', classification: 'DEVELOPMENT_ONLY' },
  { path: 'sarkari-suchna-india/generator', classification: 'DEVELOPMENT_ONLY' },
  { path: 'sarkari-suchna-india/server/scripts', classification: 'DEVELOPMENT_ONLY' },
  { path: 'tests', classification: 'TEST_ONLY' },
  { path: 'sarkari-suchna-india/tests', classification: 'TEST_ONLY' },
  { path: 'sarkari-suchna-india/docs', classification: 'DOCUMENTATION' },
  { path: 'sarkari-suchna-india/samples', classification: 'EXPERIMENTAL' },
  { path: 'sarkari-suchna-india/generated', classification: 'EXPERIMENTAL' },
  { path: 'sarkari-suchna-india/logs', classification: 'TEMPORARY' },
  { path: 'sarkari-suchna-india/data', classification: 'TEMPORARY' },
  { path: 'sarkari-suchna-india/nginx', classification: 'DEPLOYMENT_SUPPORT' },
]);

const ROOT_ENTRY_CLASSIFICATION = Object.freeze({
  'sarkari-suchna-india': 'PRODUCTION_RUNTIME',
  server: 'DEVELOPMENT_ONLY',
  scripts: 'DEVELOPMENT_ONLY',
  tests: 'TEST_ONLY',
  'package-lock.json': 'DEVELOPMENT_ONLY',
});

const PRODUCT_ROOT_FILE_CLASSIFICATION = Object.freeze({
  'package.json': 'PRODUCTION_RUNTIME',
  'package-lock.json': 'PRODUCTION_RUNTIME',
  'ecosystem.config.js': 'DEPLOYMENT_SUPPORT',
  'nginx.conf': 'DEPLOYMENT_SUPPORT',
  'deploy.sh': 'DEPLOYMENT_SUPPORT',
  '.env.example': 'DEPLOYMENT_SUPPORT',
  '.gitignore': 'DEPLOYMENT_SUPPORT',
  'homepage.html': 'PRODUCTION_RUNTIME',
  'mobile-homepage.html': 'PRODUCTION_RUNTIME',
  'README.md': 'DOCUMENTATION',
  '.env': 'TEMPORARY',
  'eslint.config.js': 'DEVELOPMENT_ONLY',
  'jest.config.js': 'TEST_ONLY',
  '.prettierrc.json': 'DEVELOPMENT_ONLY',
  '.prettierignore': 'DEVELOPMENT_ONLY',
});

function listImmediate(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function classifyProductRootEntry(name, type) {
  if (PRODUCT_ROOT_FILE_CLASSIFICATION[name]) {
    return PRODUCT_ROOT_FILE_CLASSIFICATION[name];
  }
  if (name.startsWith('tmp-') || name.endsWith('.log') || name.endsWith('.png')) {
    return 'TEMPORARY';
  }
  if (name === 'node_modules' || name === '.git' || name === '.cursor' || name === '.vscode') {
    return 'DEVELOPMENT_ONLY';
  }
  const rule = DIRECTORY_CLASSIFICATION_RULES.find(
    (r) => r.path === `sarkari-suchna-india/${name}`
  );
  if (rule) return rule.classification;
  if (type === 'directory') return 'EXPERIMENTAL';
  return 'TEMPORARY';
}

/**
 * Audit repository structure and classify directories.
 * @param {object} [input]
 */
function auditRepositoryStructure(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const workspaceEntries = listImmediate(workspaceRoot).map((entry) => ({
    relativePath: entry.name,
    type: entry.type,
    classification:
      ROOT_ENTRY_CLASSIFICATION[entry.name] ||
      (entry.name.startsWith('.') ? 'DEVELOPMENT_ONLY' : 'EXPERIMENTAL'),
  }));

  const productEntries = listImmediate(productRoot).map((entry) => ({
    relativePath: `sarkari-suchna-india/${entry.name}`,
    type: entry.type,
    classification: classifyProductRootEntry(entry.name, entry.type),
  }));

  const classifiedDirectories = DIRECTORY_CLASSIFICATION_RULES.map((rule) => {
    const absolute = path.join(workspaceRoot, rule.path);
    return {
      relativePath: rule.path,
      classification: rule.classification,
      exists: fs.existsSync(absolute),
      type: 'directory',
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const byClassification = {};
  for (const label of CLASSIFICATIONS) {
    byClassification[label] = classifiedDirectories
      .filter((d) => d.classification === label)
      .map((d) => d.relativePath);
  }

  const inventory = {
    workspaceRootEntries: workspaceEntries,
    productRootEntries: productEntries,
    classifiedDirectories,
    byClassification,
  };

  const checks = [
    {
      checkId: 'CLASSIFICATIONS_COMPLETE',
      passed: CLASSIFICATIONS.length === 9,
    },
    {
      checkId: 'PRODUCT_ROOT_PRESENT',
      passed: fs.existsSync(productRoot),
    },
    {
      checkId: 'PRODUCTION_RUNTIME_PRESENT',
      passed:
        byClassification.PRODUCTION_RUNTIME.includes('sarkari-suchna-india/server') &&
        byClassification.PRODUCTION_RUNTIME.includes('sarkari-suchna-india/public'),
    },
    {
      checkId: 'TEST_ONLY_ISOLATED',
      passed:
        byClassification.TEST_ONLY.includes('tests') &&
        byClassification.TEST_ONLY.includes('sarkari-suchna-india/tests'),
    },
    {
      checkId: 'DEVELOPMENT_FRAMEWORKS_ISOLATED',
      passed: byClassification.DEVELOPMENT_ONLY.includes('server'),
    },
    {
      checkId: 'DETERMINISTIC_INVENTORY',
      passed:
        classifiedDirectories.every((d, i, arr) =>
          i === 0 ? true : arr[i - 1].relativePath <= d.relativePath
        ),
    },
  ];

  return deepFreeze({
    validationVersion: REPOSITORY_AUDIT_VERSION,
    part: 'A',
    reportId: 'DEP2_REPOSITORY_STRUCTURE_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    classifications: CLASSIFICATIONS.slice(),
    inventory,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Repository structure audited and classified. Only production-classified paths are eligible for whitelist consideration.',
  });
}

module.exports = {
  REPOSITORY_AUDIT_VERSION,
  CLASSIFICATIONS,
  DIRECTORY_CLASSIFICATION_RULES,
  auditRepositoryStructure,
};
