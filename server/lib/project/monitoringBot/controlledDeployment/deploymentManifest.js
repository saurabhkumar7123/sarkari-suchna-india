'use strict';

/**
 * DEP-2 — Part B Production Deployment Manifest
 *
 * Whitelist-only. Every deployed file must be explicitly listed.
 * Nothing outside the whitelist may be deployed.
 * Generates deployment-manifest.json content (advisory; does not upload).
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const DEPLOYMENT_MANIFEST_VERSION = 'DEP2.1.0.0';

/** Root-level files allowed in production package (relative to product root). */
const ROOT_WHITELIST_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'ecosystem.config.js',
  'nginx.conf',
  '.env.example',
  'homepage.html',
  'mobile-homepage.html',
]);

/** Directory trees allowed in production package (relative to product root). */
const DIRECTORY_WHITELIST = Object.freeze([
  { relativePath: 'server', category: 'runtime' },
  { relativePath: 'public', category: 'publicAssets' },
  { relativePath: 'private', category: 'staticAssets' },
  { relativePath: 'db', category: 'config' },
  { relativePath: 'nginx', category: 'config' },
  { relativePath: 'storage', category: 'staticAssets' },
]);

/** Paths under whitelisted trees that must still be excluded. */
const INNER_EXCLUSION_PATTERNS = Object.freeze([
  /^server\/scripts(\/|$)/i,
  /^server\/data\//i,
  /^storage\/temp(\/|$)/i,
  /^storage\/uploads(\/|$)/i,
  /^public\/samples(\/|$)/i,
  /(^|\/)__mocks__(\/|$)/i,
  /(^|\/)fixtures(\/|$)/i,
  /(^|\/)coverage(\/|$)/i,
  /(^|\/)tests?(\/|$)/i,
  /\.test\.js$/i,
  /\.spec\.js$/i,
  /\.log$/i,
  /\.coverage$/i,
  /(^|\/)\.env$/i,
  /(^|\/)\.DS_Store$/i,
]);

function walkFiles(absoluteDir, relativeBase) {
  if (!fs.existsSync(absoluteDir)) return [];
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    const full = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkFiles(full, rel));
    } else {
      files.push(rel.replace(/\\/g, '/'));
    }
  }
  return files;
}

function isInnerExcluded(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return INNER_EXCLUSION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function categorizeFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('public/')) return 'publicAssets';
  if (normalized.startsWith('private/')) return 'staticAssets';
  if (
    normalized.startsWith('storage/') ||
    normalized === 'homepage.html' ||
    normalized === 'mobile-homepage.html'
  ) {
    return 'staticAssets';
  }
  if (
    normalized.startsWith('db/') ||
    normalized.startsWith('nginx/') ||
    normalized === 'ecosystem.config.js' ||
    normalized === 'nginx.conf' ||
    normalized === '.env.example' ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json'
  ) {
    return 'config';
  }
  if (normalized.startsWith('server/lib/')) return 'requiredLibraries';
  return 'runtime';
}

/**
 * Build whitelist-only deployment manifest.
 * @param {object} [input]
 */
function generateDeploymentManifest(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const files = [];

  for (const name of ROOT_WHITELIST_FILES) {
    const absolute = path.join(productRoot, name);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      files.push({
        path: name,
        category: categorizeFile(name),
        whitelisted: true,
      });
    }
  }

  for (const dir of DIRECTORY_WHITELIST) {
    const absolute = path.join(productRoot, dir.relativePath);
    const walked = walkFiles(absolute, dir.relativePath);
    for (const rel of walked) {
      if (isInnerExcluded(rel)) continue;
      files.push({
        path: rel,
        category: categorizeFile(rel),
        whitelisted: true,
      });
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Deduplicate by path (deterministic first-wins after sort)
  const seen = new Set();
  const uniqueFiles = [];
  for (const file of files) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    uniqueFiles.push(file);
  }

  const byCategory = {
    runtime: [],
    publicAssets: [],
    config: [],
    requiredLibraries: [],
    staticAssets: [],
  };
  for (const file of uniqueFiles) {
    if (!byCategory[file.category]) byCategory[file.category] = [];
    byCategory[file.category].push(file.path);
  }

  let productionDependencies = [];
  const pkgPath = path.join(productRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    productionDependencies = Object.keys(pkg.dependencies || {}).sort();
  }

  const manifest = {
    manifestVersion: DEPLOYMENT_MANIFEST_VERSION,
    packageCode: 'DEP-2',
    approach: 'WHITELIST_ONLY',
    productRoot: 'sarkari-suchna-india',
    generatedFor: 'GITHUB_AND_VPS_DEPLOYMENT_ELIGIBILITY',
    deploymentAllowed: false,
    automaticDeployDenied: true,
    categories: {
      runtime: byCategory.runtime.slice(),
      publicAssets: byCategory.publicAssets.slice(),
      config: byCategory.config.slice(),
      requiredLibraries: byCategory.requiredLibraries.slice(),
      staticAssets: byCategory.staticAssets.slice(),
    },
    productionDependencies,
    files: uniqueFiles.map((f) => f.path),
    fileCount: uniqueFiles.length,
    rootWhitelist: ROOT_WHITELIST_FILES.slice(),
    directoryWhitelist: DIRECTORY_WHITELIST.map((d) => d.relativePath),
    notes: [
      'Only explicitly listed files are eligible for deployment.',
      'node_modules is installed on target from package-lock.json; not copied from source tree.',
      '.env secrets are never included; operator supplies production environment separately.',
      'Manifest generation does not upload, push, or activate production.',
    ],
  };

  const checks = [
    {
      checkId: 'WHITELIST_APPROACH',
      passed: manifest.approach === 'WHITELIST_ONLY',
    },
    {
      checkId: 'RUNTIME_PRESENT',
      passed: byCategory.runtime.some((p) => p === 'server/server.js'),
    },
    {
      checkId: 'PUBLIC_ASSETS_PRESENT',
      passed: byCategory.publicAssets.length > 0,
    },
    {
      checkId: 'CONFIG_PRESENT',
      passed:
        byCategory.config.includes('package.json') &&
        byCategory.config.includes('ecosystem.config.js'),
    },
    {
      checkId: 'NO_ENV_SECRETS',
      passed: !uniqueFiles.some((f) => f.path === '.env' || f.path.endsWith('/.env')),
    },
    {
      checkId: 'NO_TESTS_IN_MANIFEST',
      passed: !uniqueFiles.some(
        (f) =>
          /(^|\/)tests?\//i.test(f.path) ||
          /\.test\.js$/i.test(f.path) ||
          /\.spec\.js$/i.test(f.path)
      ),
    },
    {
      checkId: 'DETERMINISTIC_SORT',
      passed: uniqueFiles.every((f, i, arr) =>
        i === 0 ? true : arr[i - 1].path <= f.path
      ),
    },
    {
      checkId: 'DEPLOYMENT_NOT_ALLOWED_BY_MANIFEST',
      passed: manifest.deploymentAllowed === false,
    },
  ];

  return deepFreeze({
    validationVersion: DEPLOYMENT_MANIFEST_VERSION,
    part: 'B',
    reportId: 'DEP2_DEPLOYMENT_MANIFEST',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    manifest,
    deploymentManifestJson: JSON.stringify(manifest, null, 2),
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Whitelist-only deployment manifest generated. Nothing outside the whitelist is eligible for deployment.',
  });
}

/**
 * Persist deployment-manifest.json beside the framework (advisory artifact only).
 * Does not upload or deploy. Overwrites local advisory copy only when requested.
 * @param {object} [input]
 */
function writeDeploymentManifestFile(input = {}) {
  const partB = generateDeploymentManifest(input);
  const target =
    input.outputPath ||
    path.join(__dirname, 'deployment-manifest.json');
  if (input.write === true) {
    fs.writeFileSync(target, partB.deploymentManifestJson + '\n', 'utf8');
  }
  return deepFreeze({
    written: input.write === true,
    outputPath: target,
    fileCount: partB.manifest.fileCount,
    deploymentAllowed: false,
  });
}

module.exports = {
  DEPLOYMENT_MANIFEST_VERSION,
  ROOT_WHITELIST_FILES,
  DIRECTORY_WHITELIST,
  INNER_EXCLUSION_PATTERNS,
  generateDeploymentManifest,
  writeDeploymentManifestFile,
};
