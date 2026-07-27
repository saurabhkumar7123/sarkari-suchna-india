'use strict';

/**
 * DEP-2 — Part C Exclusion Validation
 *
 * Verify that none of the excluded classes appear in the deployment package.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const EXCLUSION_VALIDATION_VERSION = 'DEP2.1.0.0';

const EXCLUSION_RULES = Object.freeze([
  { ruleId: 'TESTS_DIR', pattern: /(^|\/)tests?\//i, description: 'tests/' },
  { ruleId: 'COVERAGE_DIR', pattern: /(^|\/)coverage(\/|$)/i, description: 'coverage/' },
  { ruleId: 'MOCKS_DIR', pattern: /(^|\/)__mocks__(\/|$)/i, description: '__mocks__/' },
  { ruleId: 'FIXTURES_DIR', pattern: /(^|\/)fixtures(\/|$)/i, description: 'fixtures/' },
  { ruleId: 'BENCHMARKS_DIR', pattern: /(^|\/)benchmarks(\/|$)/i, description: 'benchmarks/' },
  { ruleId: 'DRAFT_DIR', pattern: /(^|\/)draft(\/|$)/i, description: 'draft/' },
  { ruleId: 'NOTES_DIR', pattern: /(^|\/)notes(\/|$)/i, description: 'notes/' },
  { ruleId: 'ARCHIVE_DIR', pattern: /(^|\/)archive(\/|$)/i, description: 'archive/' },
  { ruleId: 'EXPERIMENTAL_DIR', pattern: /(^|\/)experimental(\/|$)/i, description: 'experimental/' },
  { ruleId: 'CURSOR_DIR', pattern: /(^|\/)\.cursor(\/|$)/i, description: '.cursor/' },
  { ruleId: 'VSCODE_DIR', pattern: /(^|\/)\.vscode(\/|$)/i, description: '.vscode/' },
  { ruleId: 'LOGS_DIR', pattern: /(^|\/)logs(\/|$)/i, description: 'logs/' },
  { ruleId: 'TEMP_DIR', pattern: /(^|\/)temp(\/|$)/i, description: 'temp/' },
  { ruleId: 'TMP_DIR', pattern: /(^|\/)tmp(\/|$)/i, description: 'tmp/' },
  { ruleId: 'LOG_FILES', pattern: /\.log$/i, description: '*.log' },
  { ruleId: 'COVERAGE_FILES', pattern: /\.coverage$/i, description: '*.coverage' },
  { ruleId: 'TEST_FILES', pattern: /\.(test|spec)\.js$/i, description: 'test/spec modules' },
  { ruleId: 'ENV_SECRETS', pattern: /(^|\/)\.env$/i, description: '.env secrets' },
  {
    ruleId: 'DEV_SCRIPTS',
    pattern: /^scripts\//i,
    description: 'development scripts (product root scripts/)',
  },
  {
    ruleId: 'SERVER_DEV_SCRIPTS',
    pattern: /^server\/scripts\//i,
    description: 'server development scripts',
  },
  {
    ruleId: 'GENERATOR',
    pattern: /^generator\//i,
    description: 'prototype / generator modules',
  },
  {
    ruleId: 'GENERATED',
    pattern: /^generated\//i,
    description: 'generated advisory artifacts',
  },
  {
    ruleId: 'DOCS',
    pattern: /^docs\//i,
    description: 'documentation (not runtime-required)',
  },
  {
    ruleId: 'SAMPLES',
    pattern: /^samples\//i,
    description: 'sample / experimental datasets',
  },
  {
    ruleId: 'WORKSPACE_ADVISORY',
    pattern: /^(\.\.\/)?server\/lib\/project\//i,
    description: 'workspace advisory planning frameworks',
  },
]);

/**
 * Validate exclusions against a deployment manifest.
 * @param {object} [input]
 */
function validateDeploymentExclusions(input = {}) {
  const manifest =
    input.manifest ||
    (input.partB && input.partB.manifest) ||
    null;

  const files = manifest && Array.isArray(manifest.files) ? manifest.files : [];

  const violations = [];
  const ruleResults = EXCLUSION_RULES.map((rule) => {
    const hits = files.filter((file) => rule.pattern.test(file));
    if (hits.length > 0) {
      violations.push({
        ruleId: rule.ruleId,
        description: rule.description,
        files: hits.slice(0, 20),
        hitCount: hits.length,
      });
    }
    return {
      ruleId: rule.ruleId,
      description: rule.description,
      excluded: hits.length === 0,
      hitCount: hits.length,
    };
  });

  const checks = [
    {
      checkId: 'MANIFEST_PROVIDED',
      passed: Boolean(manifest) && Array.isArray(manifest.files),
    },
    {
      checkId: 'NO_EXCLUSION_VIOLATIONS',
      passed: violations.length === 0,
    },
    {
      checkId: 'NO_TEST_DATASETS',
      passed: !files.some(
        (f) =>
          /(^|\/)fixtures(\/|$)/i.test(f) ||
          /^samples\//i.test(f) ||
          /^public\/samples(\/|$)/i.test(f) ||
          /(^|\/)benchmarks(\/|$)/i.test(f)
      ),
    },
    {
      checkId: 'NO_DEBUG_UTILITIES_IN_ROOT_SCRIPTS',
      passed: !files.some((f) => /^scripts\//i.test(f) || /tmp-/i.test(f)),
    },
    {
      checkId: 'NO_ADVISORY_PLANNING_FRAMEWORKS',
      passed: !files.some((f) => f.includes('server/lib/project/')),
    },
  ];

  return deepFreeze({
    validationVersion: EXCLUSION_VALIDATION_VERSION,
    part: 'C',
    reportId: 'DEP2_DEPLOYMENT_EXCLUSION_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    exclusionRules: EXCLUSION_RULES.map((r) => ({
      ruleId: r.ruleId,
      description: r.description,
    })),
    ruleResults,
    violations,
    scannedFileCount: files.length,
    checks,
    allPassed: checks.every((c) => c.passed === true) && violations.length === 0,
    summary:
      violations.length === 0
        ? 'Exclusion validation passed. No excluded paths are present in the deployment whitelist.'
        : `Exclusion validation failed with ${violations.length} rule violation(s).`,
  });
}

module.exports = {
  EXCLUSION_VALIDATION_VERSION,
  EXCLUSION_RULES,
  validateDeploymentExclusions,
};
