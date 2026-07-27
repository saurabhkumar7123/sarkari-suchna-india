'use strict';

/**
 * Vendor runtime-required external modules into the product repo and rewrite facades.
 * Usage: node scripts/vendor-runtime-deps.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK_ROOT = path.resolve(REPO_ROOT, '..');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// Re-run scan logic inline to get fresh external list
const scan = spawnSync(process.execPath, [path.join(__dirname, 'scan-runtime-external-deps.js')], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(scan.stdout);
} catch (err) {
  console.error('Failed to parse scan output');
  console.error(scan.stdout);
  console.error(scan.stderr);
  process.exit(1);
}

const externalPaths = report.external.map((e) => e.path);
console.log(`Vendoring ${externalPaths.length} runtime modules...`);

const copied = [];
const skipped = [];

for (const rel of externalPaths) {
  const src = path.join(CHECK_ROOT, rel);
  const dest = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(src)) {
    skipped.push({ rel, reason: 'source_missing' });
    continue;
  }
  if (fs.existsSync(dest)) {
    // overwrite to keep in sync
  }
  copyFile(src, dest);
  copied.push(rel);
}

// Also vendor the deployment manifest JSON referenced by controlled deployment
const extraAssets = [
  'server/lib/project/monitoringBot/controlledDeployment/deployment-manifest.json',
];

for (const rel of extraAssets) {
  const src = path.join(CHECK_ROOT, rel);
  const dest = path.join(REPO_ROOT, rel);
  if (fs.existsSync(src)) {
    copyFile(src, dest);
    copied.push(rel);
  }
}

// Rewrite facade imports: ../../../../../server/lib/project/ → ../../project/
const FACADE_DIRS = [
  path.join(REPO_ROOT, 'server/lib/recruitment'),
  path.join(REPO_ROOT, 'server/lib/monitoringBot'),
];

const OLD_PATTERNS = [
  /(['"])\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/server\/lib\/project\//g,
];

let filesRewritten = 0;
let importsRewritten = 0;

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJs(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

for (const dir of FACADE_DIRS) {
  for (const file of walkJs(dir)) {
    let src = fs.readFileSync(file, 'utf8');
    let changed = false;
    let count = 0;
    for (const pat of OLD_PATTERNS) {
      src = src.replace(pat, (match, quote) => {
        changed = true;
        count += 1;
        return `${quote}../../project/`;
      });
    }
    if (changed) {
      fs.writeFileSync(file, src, 'utf8');
      filesRewritten += 1;
      importsRewritten += count;
      console.log(`Rewrote ${path.relative(REPO_ROOT, file)} (${count} import(s))`);
    }
  }
}

console.log(
  JSON.stringify(
    {
      filesVendored: copied.length,
      skipped: skipped.length,
      filesRewritten,
      importsRewritten,
      skippedDetails: skipped,
    },
    null,
    2
  )
);
