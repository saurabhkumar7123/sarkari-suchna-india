'use strict';

/**
 * Scan runtime entry points for dependencies that resolve outside the product repo.
 * Usage: node scripts/scan-runtime-external-deps.js
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK_ROOT = path.resolve(REPO_ROOT, '..');

const ENTRY_POINTS = [
  'server/server.js',
  'server/app.js',
  'server/services/workers/siteWorker.js',
  'server/lib/recruitment/automationWorkflow/index.js',
  'server/lib/enterprise/notificationGateway/index.js',
  'server/services/automationControlCenter.service.js',
  'server/lib/recruitment/productionRuntime/index.js',
  'server/services/updates/updateScheduler.js',
  'server/lib/monitoringBot/pipelineIntegration/index.js',
  'server/lib/recruitment/recruitmentIntelligenceBrain/index.js',
  'server/lib/recruitment/pipelineHealth/index.js',
  'server/lib/recruitment/draftPreparation/index.js',
  'server/lib/recruitment/controlledLifecycleEngine/index.js',
  'server/lib/recruitment/monitoringReviewIntegration/index.js',
  'server/lib/recruitment/controlledCandidateResolution/index.js',
  'server/lib/recruitment/publishReadinessAuthorization/index.js',
  'server/lib/monitoringBot/controlledScheduler/index.js',
  'server/lib/monitoringBot/governmentSourceRegistry/index.js',
  'server/lib/monitoringBot/websiteChangeDetection/index.js',
  'server/lib/monitoringBot/recruitmentExtraction/index.js',
  'server/lib/monitoringBot/telegramNotification/index.js',
  'server/lib/monitoringBot/reviewQueueWiring/index.js',
  'server/lib/monitoringBot/systemValidation/index.js',
  'server/lib/monitoringBot/productionReadiness/index.js',
  'server/lib/monitoringBot/controlledDeployment/index.js',
  'server/lib/monitoringBot/operatorAuthorization/index.js',
];

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJs(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const extra = [
  ...walkJs(path.join(REPO_ROOT, 'server/lib/recruitment')),
  ...walkJs(path.join(REPO_ROOT, 'server/lib/monitoringBot')),
  ...walkJs(path.join(REPO_ROOT, 'server/lib/enterprise')),
  ...walkJs(path.join(REPO_ROOT, 'server/services')),
].map((p) => path.relative(REPO_ROOT, p).split(path.sep).join('/'));

const allEntries = [...new Set([...ENTRY_POINTS, ...extra])];

const REQUIRE_RE = /require\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const DYNAMIC_PATH_RE = /path\.resolve\s*\(\s*__dirname\s*,\s*(['"])([^'"]+)\1\s*\)/g;

const visited = new Set();
const external = new Map();
const missing = [];
const graph = [];
const internals = new Set();

function isBuiltin(id) {
  if (typeof id !== 'string') return false;
  return Module.builtinModules.includes(id) || id.startsWith('node:');
}

function tryResolve(fromFile, req) {
  try {
    return require.resolve(req, { paths: [path.dirname(fromFile)] });
  } catch {
    return null;
  }
}

function classify(abs) {
  const norm = path.resolve(abs);
  const repoPrefix = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;
  if (norm === REPO_ROOT || norm.startsWith(repoPrefix)) return 'internal';
  if (norm.includes(`${path.sep}node_modules${path.sep}`)) return 'node_modules';
  return 'external';
}

function resolveFileGuess(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  if (fs.existsSync(`${base}.js`)) return `${base}.js`;
  if (fs.existsSync(path.join(base, 'index.js'))) return path.join(base, 'index.js');
  if (fs.existsSync(`${base}.json`)) return `${base}.json`;
  return null;
}

function extractRequires(file) {
  const src = fs.readFileSync(file, 'utf8');
  const reqs = new Set();
  let m;
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(src))) {
    reqs.add(m[2]);
  }
  DYNAMIC_PATH_RE.lastIndex = 0;
  while ((m = DYNAMIC_PATH_RE.exec(src))) {
    const resolved = path.resolve(path.dirname(file), m[2]);
    // Only treat path.resolve targets as module deps when they look like JS modules.
    // Workspace-root resolves (../../../../..) are filesystem audit roots, not requires.
    if (
      resolved.endsWith('.js') ||
      resolved.endsWith('.json') ||
      fs.existsSync(`${resolved}.js`) ||
      (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
    ) {
      reqs.add(resolved);
    }
  }
  return [...reqs];
}

function scan(file, fromEntry) {
  const abs = path.resolve(file);
  if (visited.has(abs)) return;
  visited.add(abs);

  const cls = classify(abs);
  if (cls === 'node_modules') return;
  if (cls === 'external') {
    external.set(abs, { from: fromEntry, kind: 'runtime' });
  } else {
    internals.add(abs);
  }

  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (!stat.isFile()) return;
  if (!abs.endsWith('.js') && !abs.endsWith('.json')) return;
  if (abs.endsWith('.json')) return;

  let reqs;
  try {
    reqs = extractRequires(abs);
  } catch {
    return;
  }

  for (const req of reqs) {
    if (isBuiltin(req)) continue;

    let resolved = null;
    if (path.isAbsolute(req)) {
      resolved = resolveFileGuess(req);
      if (!resolved) {
        missing.push({ from: abs, req });
        continue;
      }
    } else if (req.startsWith('.')) {
      resolved = tryResolve(abs, req) || resolveFileGuess(path.resolve(path.dirname(abs), req));
      if (!resolved) {
        missing.push({ from: path.relative(REPO_ROOT, abs), req });
        continue;
      }
    } else {
      resolved = tryResolve(abs, req);
      if (!resolved) continue;
      if (classify(resolved) === 'node_modules') continue;
    }

    const rcls = classify(resolved);
    graph.push({
      from: path.relative(CHECK_ROOT, abs).split(path.sep).join('/'),
      to: path.relative(CHECK_ROOT, resolved).split(path.sep).join('/'),
      class: rcls,
    });
    if (rcls === 'external') {
      external.set(path.resolve(resolved), {
        from: path.relative(REPO_ROOT, abs).split(path.sep).join('/'),
        kind: 'runtime',
      });
    }
    if (rcls === 'external' || rcls === 'internal') {
      scan(resolved, fromEntry);
    }
  }
}

for (const ep of allEntries) {
  const full = path.join(REPO_ROOT, ep);
  if (!fs.existsSync(full)) {
    missing.push({ from: 'ENTRY', req: ep });
    continue;
  }
  scan(full, ep);
}

const extList = [...external.keys()].sort();
const report = {
  entriesConsidered: allEntries.length,
  internalModulesVisited: internals.size,
  externalRuntimeModules: extList.length,
  missingResolves: missing.length,
  external: extList.map((e) => ({
    path: path.relative(CHECK_ROOT, e).split(path.sep).join('/'),
    from: external.get(e).from,
  })),
  missing: missing.slice(0, 50),
};

console.log(JSON.stringify(report, null, 2));
process.exit(extList.length === 0 ? 0 : 1);
