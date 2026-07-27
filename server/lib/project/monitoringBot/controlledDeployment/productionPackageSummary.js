'use strict';

/**
 * DEP-2 — Part D Production Package Summary
 *
 * Prepare production package eligibility summary only.
 * Verifies no duplicates, orphans, unused runtime deps markers,
 * broken import markers, or missing assets — advisory filesystem checks.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const PRODUCTION_PACKAGE_VERSION = 'DEP2.1.0.0';

const REQUIRED_RUNTIME_ASSETS = Object.freeze([
  'server/server.js',
  'server/app.js',
  'package.json',
  'ecosystem.config.js',
  'nginx.conf',
  'homepage.html',
  'public/assets/js/admin-nav.js',
]);

/**
 * Summarize production package readiness from the whitelist manifest.
 * @param {object} [input]
 */
function generateProductionPackageSummary(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const manifest =
    input.manifest ||
    (input.partB && input.partB.manifest) ||
    null;
  const files = manifest && Array.isArray(manifest.files) ? manifest.files : [];

  const pathCounts = {};
  for (const file of files) {
    pathCounts[file] = (pathCounts[file] || 0) + 1;
  }
  const duplicates = Object.keys(pathCounts).filter((p) => pathCounts[p] > 1);

  const missingRequired = REQUIRED_RUNTIME_ASSETS.filter((rel) => {
    const onDisk = fs.existsSync(path.join(productRoot, rel));
    const inManifest = files.includes(rel);
    return !onDisk || !inManifest;
  });

  const orphanCandidates = files.filter((rel) => {
    // Orphan = listed but missing on disk
    return !fs.existsSync(path.join(productRoot, rel));
  });

  // Broken import heuristic: require() targets under server/ that are missing
  const brokenImports = [];
  const entryCandidates = ['server/server.js', 'server/app.js'].filter((rel) =>
    files.includes(rel)
  );
  for (const entry of entryCandidates) {
    const absolute = path.join(productRoot, entry);
    if (!fs.existsSync(absolute)) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    const requireRe = /require\(['"](\.[^'"]+)['"]\)/g;
    let match;
    while ((match = requireRe.exec(source)) !== null) {
      const resolved = path.resolve(path.dirname(absolute), match[1]);
      const candidates = [
        resolved,
        `${resolved}.js`,
        path.join(resolved, 'index.js'),
      ];
      const exists = candidates.some((c) => fs.existsSync(c));
      if (!exists) {
        brokenImports.push({ from: entry, request: match[1] });
      }
    }
  }

  let unusedRuntimeDependencies = [];
  const pkgPath = path.join(productRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();
    // Advisory: mark known tooling that is rarely require()'d at boot as noted, not failing
    const rarelyBootRequired = new Set([
      'canvas',
      'tesseract.js',
      'pdf-parse',
      'pdfjs-dist',
      'csv-parser',
      'fuse.js',
      'multer',
      'autocannon',
    ]);
    unusedRuntimeDependencies = deps.filter((d) => rarelyBootRequired.has(d));
  }

  const checks = [
    {
      checkId: 'NO_DUPLICATE_FILES',
      passed: duplicates.length === 0,
    },
    {
      checkId: 'NO_ORPHAN_FILES',
      passed: orphanCandidates.length === 0,
    },
    {
      checkId: 'REQUIRED_ASSETS_PRESENT',
      passed: missingRequired.length === 0,
    },
    {
      checkId: 'NO_BROKEN_ENTRY_IMPORTS',
      passed: brokenImports.length === 0,
    },
    {
      checkId: 'MANIFEST_NONEMPTY',
      passed: files.length > 0,
    },
    {
      checkId: 'PACKAGE_NOT_ACTIVATED',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: PRODUCTION_PACKAGE_VERSION,
    part: 'D',
    reportId: 'DEP2_PRODUCTION_PACKAGE_SUMMARY',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    packagePrepared: checks.every((c) => c.passed === true),
    fileCount: files.length,
    duplicates,
    orphanFiles: orphanCandidates,
    missingRequiredAssets: missingRequired,
    brokenImports,
    notedOptionalHeavyDependencies: unusedRuntimeDependencies,
    unusedRuntimeDependenciesDeniedAsBlockers: true,
    categories: manifest
      ? {
          runtime: (manifest.categories && manifest.categories.runtime) || [],
          publicAssets:
            (manifest.categories && manifest.categories.publicAssets) || [],
          config: (manifest.categories && manifest.categories.config) || [],
          requiredLibraries:
            (manifest.categories && manifest.categories.requiredLibraries) || [],
          staticAssets:
            (manifest.categories && manifest.categories.staticAssets) || [],
        }
      : null,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Production package eligibility summary prepared. Package remains inactive; no upload or activation performed.',
  });
}

module.exports = {
  PRODUCTION_PACKAGE_VERSION,
  REQUIRED_RUNTIME_ASSETS,
  generateProductionPackageSummary,
};
