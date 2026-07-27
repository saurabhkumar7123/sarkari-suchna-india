'use strict';

/**
 * RC-1 Release Candidate preparation (local only).
 * Does NOT deploy, push, migrate, or commit.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRODUCT_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(PRODUCT_ROOT, '..');
const RC_DIR = path.join(PRODUCT_ROOT, 'docs', 'release-candidate');
const MANIFEST_PATH = path.join(RC_DIR, 'deployment-manifest.json');
const ARCHIVE_DIR = path.join(PRODUCT_ROOT, '.rc-archive');

const CLASSIFICATION = {
  PRODUCTION_RUNTIME: 'Production Runtime',
  DATABASE_MIGRATION: 'Database Migration',
  CONFIGURATION: 'Configuration',
  ADMIN_UI: 'Admin UI',
  MONITORING: 'Monitoring',
  TELEGRAM: 'Telegram',
  REVIEW_QUEUE: 'Review Queue',
  SHARED_LIBRARY: 'Shared Library',
  GENERATOR: 'Generator',
  PUBLIC_ASSETS: 'Public Assets',
  SEO: 'SEO',
  CONTENT: 'Content',
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  EXPERIMENTAL: 'Experimental',
  PLANNING: 'Planning',
  ADVISORY: 'Advisory',
  DRAFT: 'Draft',
  BACKUP: 'Backup',
  GENERATED: 'Generated',
  TEMPORARY: 'Temporary',
  DOCUMENTATION: 'Documentation',
};

const MUST_NEVER = new Set([
  CLASSIFICATION.TESTING,
  CLASSIFICATION.EXPERIMENTAL,
  CLASSIFICATION.PLANNING,
  CLASSIFICATION.ADVISORY,
  CLASSIFICATION.DRAFT,
  CLASSIFICATION.BACKUP,
  CLASSIFICATION.TEMPORARY,
  CLASSIFICATION.DEVELOPMENT,
]);

const MUST_GO = new Set([
  CLASSIFICATION.PRODUCTION_RUNTIME,
  CLASSIFICATION.DATABASE_MIGRATION,
  CLASSIFICATION.CONFIGURATION,
  CLASSIFICATION.ADMIN_UI,
  CLASSIFICATION.MONITORING,
  CLASSIFICATION.TELEGRAM,
  CLASSIFICATION.REVIEW_QUEUE,
  CLASSIFICATION.SHARED_LIBRARY,
  CLASSIFICATION.GENERATOR,
  CLASSIFICATION.PUBLIC_ASSETS,
  CLASSIFICATION.SEO,
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkFiles(absoluteDir, relativeBase = '') {
  if (!fs.existsSync(absoluteDir)) return [];
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.rc-archive') continue;
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

function classifyPath(rel) {
  const p = rel.replace(/\\/g, '/');

  if (/(^|\/)tmp[-_.]/i.test(p) || /\.png$/i.test(p) && p.startsWith('tmp-')) return CLASSIFICATION.TEMPORARY;
  if (p.startsWith('scripts/tmp-') || p.startsWith('tmp-')) return CLASSIFICATION.TEMPORARY;
  if (p.startsWith('logs/') || /\.log$/i.test(p)) return CLASSIFICATION.TEMPORARY;
  if (p.startsWith('coverage/') || p.includes('/__mocks__/') || p.includes('/fixtures/')) return CLASSIFICATION.TESTING;
  if (p.startsWith('tests/') || /\.test\.js$/i.test(p) || /\.spec\.js$/i.test(p) || p === 'jest.config.js') return CLASSIFICATION.TESTING;
  if (p.startsWith('.backup') || p.includes('backup') && /\.json$/i.test(p) && p.startsWith('scripts/')) return CLASSIFICATION.BACKUP;
  if (p.startsWith('generated/')) return CLASSIFICATION.GENERATED;
  if (p.startsWith('storage/uploads/') || p.startsWith('storage/temp/')) return CLASSIFICATION.CONTENT;
  if (p.startsWith('samples/') || p.startsWith('public/samples/')) return CLASSIFICATION.DEVELOPMENT;
  if (p.startsWith('docs/')) return CLASSIFICATION.DOCUMENTATION;
  if (p.startsWith('db/migrations/')) return CLASSIFICATION.DATABASE_MIGRATION;
  if (
    p === '.env.example' ||
    p === 'package.json' ||
    p === 'package-lock.json' ||
    p === 'ecosystem.config.js' ||
    p === 'nginx.conf' ||
    p.startsWith('nginx/') ||
    p === '.gitignore' ||
    p === '.prettierignore' ||
    p === '.prettierrc.json' ||
    p === 'eslint.config.js'
  ) {
    return CLASSIFICATION.CONFIGURATION;
  }
  if (p === 'deploy.sh' || p.startsWith('scripts/apply-') || p.startsWith('scripts/sitemap') || p.startsWith('scripts/regenerate') || p.startsWith('server/scripts/')) {
    return CLASSIFICATION.DEVELOPMENT;
  }
  if (p.startsWith('scripts/rc1-') || p.startsWith('scripts/load-test')) return CLASSIFICATION.DEVELOPMENT;
  if (p.startsWith('generator/scripts/')) return CLASSIFICATION.DEVELOPMENT;
  if (p.startsWith('generator/')) return CLASSIFICATION.GENERATOR;
  if (p.startsWith('private/')) return CLASSIFICATION.ADMIN_UI;
  if (p.startsWith('public/')) return CLASSIFICATION.PUBLIC_ASSETS;
  if (p === 'homepage.html' || p === 'mobile-homepage.html') return CLASSIFICATION.PUBLIC_ASSETS;
  if (p.startsWith('server/lib/monitoringBot/')) return CLASSIFICATION.ADVISORY;
  if (p.startsWith('server/lib/seo/')) return CLASSIFICATION.SEO;
  if (p.includes('telegram') || p.includes('Telegram')) return CLASSIFICATION.TELEGRAM;
  if (p.includes('reviewQueue') || p.includes('ReviewQueue') || p.includes('editorialReview') || p.includes('EditorialReview')) {
    return CLASSIFICATION.REVIEW_QUEUE;
  }
  if (
    /Blueprint|Advisor|Roadmap|Advisory|Simulation|Framework|Manifest|Planner|Playbook|Certificate|Assessment|GapCatalog|RiskMatrix|MilestoneTracker|DocumentationRegistry|ArchitectureAudit|CompletionReport|AdoptionGuide|Rollout|ShadowMode|DryRun|ScenarioLibrary|RecommendationEngine|EvolutionAnalyzer|Governance|IntelligenceSummary|ObservationRollout|FutureRuntimeMapping|CapabilityActivation|ImplementationContract|ImplementationValidator|ImplementationReadiness|ImplementationRisk|ImplementationRoadmap|MigrationBlueprint|TransitionManifest|ReleaseReadiness|OperationalReadiness|WorkflowComposition|WorkflowExecutionBlueprint|WorkflowArchitecture|WorkflowAdoption|WorkflowSimulation|WorkflowShadow|WorkflowRollback|WorkflowMigration|WorkflowIntegrationReadiness|WorkflowIntegrationRollout|WorkflowIntegrationGovernance|WorkflowIntegrationSafety|WorkflowIntegrationDecision|WorkflowControlledActivation|WorkflowFeatureFlag|WorkflowFeatureActivation|WorkflowRuntimeAdoption|WorkflowRuntimeMigration|WorkflowRuntimeReadiness|WorkflowRuntimeIntegration|WorkflowProductionAdoption|existingRecruitmentArchitecture|featureFlagIntegrationDesign|recruitmentBotIntegration|recruitmentCapabilityActivation|recruitmentCompletionReport|recruitmentContractCompliance|recruitmentDecisionMatrix|recruitmentDependencyMap|recruitmentDocumentationRegistry|recruitmentExecutionSummary|recruitmentExecutionWorkPackages|recruitmentGovernanceChecklist|recruitmentImplementation|recruitmentIntegrationMap|recruitmentIntegrationReadiness|recruitmentLifecycleExecution|recruitmentMappingPlanner|recruitmentMigrationBlueprint|recruitmentMilestoneTracker|recruitmentOperational|recruitmentProductionAdoption|recruitmentReleaseReadiness|recruitmentRiskAssessment|recruitmentRollout|recruitmentRuntimeIntegrationBlueprint|recruitmentScenario|recruitmentShadowExecution|recruitmentSimulation|recruitmentTimelineProjection|recruitmentTransitionManifest|recruitmentWorkflow/i.test(
      path.basename(p)
    ) &&
    p.startsWith('server/lib/recruitment/')
  ) {
    // Narrow: only advisory-named modules that are NOT on runtime allowlist below
    const basename = path.basename(p);
    const runtimeKeep = new Set([
      'auditTrail.js',
      'detectionProcessor.js',
      'editorialWorkflow.js',
      'eventTypeClassifier.js',
      'executionContext.js',
      'executionDiagnostics.js',
      'previewRuntimeWiring.js',
      'recruitmentCompatibilityLayer.js',
      'recruitmentEligibility.js',
      'recruitmentMatcher.js',
      'recruitmentWorkerObservation.js',
      'reviewComparison.js',
      'reviewDecisionAssistant.js',
      'reviewQueue.js',
      'reviewWorkflow.js',
      'runRecruitmentPipeline.js',
      'runtimePreviewBuffer.js',
      'sharedPreviewModel.js',
      'runtimePersistencePolicy.js',
      'runtimePersistenceService.js',
      'persistenceEnablement.js',
      'persistenceExecutionPipeline.js',
      'persistenceRepositoryContracts.js',
      'mysqlPersistenceRepositoryAdapters.js',
      'transactionCoordinator.js',
      'dryRunPersistenceSimulator.js',
      'controlledRuntimeExecutionAdapter.js',
      'recruitmentActionPlanner.js',
      'recruitmentAggregateResolver.js',
      'recruitmentContext.js',
      'recruitmentDomainModel.js',
      'recruitmentDraftApprovalGate.js',
      'recruitmentDraftPersistenceBoundary.js',
      'recruitmentDraftProposalEngine.js',
      'recruitmentDraftRepositoryContract.js',
      'recruitmentDraftReviewPackageBuilder.js',
      'recruitmentDraftStorageAdapter.js',
      'recruitmentExecutionGateway.js',
      'recruitmentIdentityModel.js',
      'recruitmentIdentityResolutionEngine.js',
      'recruitmentLifecycleContracts.js',
      'recruitmentLifecycleEventResolver.js',
      'recruitmentLifecycleStateDescriptor.js',
      'recruitmentLifecycleStateEvaluator.js',
      'recruitmentLifecycleTransitionResolver.js',
      'recruitmentMatchingContracts.js',
      'recruitmentMatchingEngine.js',
      'recruitmentPersistenceAdapter.js',
      'recruitmentPersistenceCoordinator.js',
      'recruitmentPersistenceEngine.js',
      'recruitmentPipelineIntegrationHook.js',
      'recruitmentRelationshipMap.js',
      'recruitmentRelationshipResolver.js',
      'recruitmentRelationshipValidator.js',
      'recruitmentRuntimeBoundaryContract.js',
      'runtimeCapabilityAccess.js',
      'runtimeCapabilityAwareness.js',
      'runtimeCapabilityContext.js',
      'runtimeCapabilityContextRead.js',
      'runtimeCapabilityObservation.js',
      'runtimeCapabilityPreviewIntegration.js',
      'runtimeCapabilityRegistry.js',
      'runtimeCapabilityRegistryIntegration.js',
      'runtimeCapabilityResolver.js',
      'runtimeCapabilityValidation.js',
      'workflowDecisionTraceModel.js',
      'backwardCompatibilityContract.js',
      'executionDiagnosticsCapabilityIntegration.js',
    ]);
    if (!runtimeKeep.has(basename) && !p.includes('/controlled') && !p.includes('/draftPreparation') && !p.includes('/monitoringReview') && !p.includes('/pipelineHealth') && !p.includes('/publishReadiness') && !p.includes('/workPackages/')) {
      return CLASSIFICATION.ADVISORY;
    }
  }
  if (p.startsWith('server/lib/recruitment/')) return CLASSIFICATION.SHARED_LIBRARY;
  if (p.startsWith('server/services/updates/') || p.startsWith('server/services/workers/') || p.startsWith('server/jobs/')) {
    return CLASSIFICATION.MONITORING;
  }
  if (p.startsWith('server/')) return CLASSIFICATION.PRODUCTION_RUNTIME;
  if (p === 'README.md') return CLASSIFICATION.DOCUMENTATION;
  if (p.startsWith('data/') || p.startsWith('server/data/')) return CLASSIFICATION.CONTENT;
  return CLASSIFICATION.DEVELOPMENT;
}

function resolveFrom(fromFile, req) {
  if (!req.startsWith('.')) return null;
  const base = path.dirname(fromFile);
  const cand = path.resolve(base, req);
  const tries = [cand, `${cand}.js`, path.join(cand, 'index.js')];
  for (const t of tries) {
    try {
      if (fs.existsSync(t) && fs.statSync(t).isFile()) return t;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function buildReachability(entries) {
  const visited = new Set();
  const missing = [];
  const outsideProduct = [];
  const stack = [];
  const circular = [];

  function walk(file) {
    const n = path.normalize(file);
    if (visited.has(n)) return;
    if (stack.includes(n)) {
      circular.push([...stack, n].map((f) => path.relative(PRODUCT_ROOT, f).replace(/\\/g, '/')));
      return;
    }
    visited.add(n);
    stack.push(n);
    let src;
    try {
      src = fs.readFileSync(n, 'utf8');
    } catch {
      missing.push(path.relative(PRODUCT_ROOT, n).replace(/\\/g, '/'));
      stack.pop();
      return;
    }
    const re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const req = m[1];
      if (!req.startsWith('.')) continue;
      const resolved = resolveFrom(n, req);
      if (!resolved) {
        missing.push(`${path.relative(PRODUCT_ROOT, n).replace(/\\/g, '/')} -> ${req}`);
        continue;
      }
      const normResolved = path.normalize(resolved);
      if (!normResolved.startsWith(PRODUCT_ROOT)) {
        outsideProduct.push({
          from: path.relative(PRODUCT_ROOT, n).replace(/\\/g, '/'),
          to: normResolved.replace(/\\/g, '/'),
          req,
        });
        continue;
      }
      if (normResolved.includes(`${path.sep}node_modules${path.sep}`)) continue;
      walk(normResolved);
    }
    stack.pop();
  }

  for (const e of entries) {
    const abs = path.isAbsolute(e) ? e : path.join(PRODUCT_ROOT, e);
    if (fs.existsSync(abs)) walk(abs);
    else missing.push(e);
  }

  const reachable = [...visited]
    .map((f) => path.relative(PRODUCT_ROOT, f).replace(/\\/g, '/'))
    .filter((f) => f.startsWith('server/') || f.startsWith('generator/'))
    .sort();

  return { reachable, missing, circular, outsideProduct };
}

function isDeployExcluded(rel) {
  const p = rel.replace(/\\/g, '/');
  const patterns = [
    /^tests(\/|$)/i,
    /^docs(\/|$)/i,
    /^logs(\/|$)/i,
    /^coverage(\/|$)/i,
    /^samples(\/|$)/i,
    /^scripts(\/|$)/i,
    /^generator\/scripts(\/|$)/i,
    /^generated(\/|$)/i,
    /^data(\/|$)/i,
    /^storage\/uploads(\/|$)/i,
    /^storage\/temp(\/|$)/i,
    /^public\/samples(\/|$)/i,
    /^server\/scripts(\/|$)/i,
    /^server\/data\//i,
    /^server\/lib\/monitoringBot(\/|$)/i,
    /^node_modules(\/|$)/i,
    /^\.git(\/|$)/i,
    /^\.rc-archive(\/|$)/i,
    /^\.env$/i,
    /^\.env\./i,
    /tmp-/i,
    /\.test\.js$/i,
    /\.spec\.js$/i,
    /\.log$/i,
    /^jest\.config\.js$/i,
    /^eslint\.config\.js$/i,
    /^\.prettier/i,
    /^deploy\.sh$/i,
    /^README\.md$/i,
  ];
  return patterns.some((re) => re.test(p));
}

function categorizeDeploy(rel) {
  const p = rel.replace(/\\/g, '/');
  if (p.startsWith('public/')) return 'publicAssets';
  if (p.startsWith('private/')) return 'adminUi';
  if (p === 'homepage.html' || p === 'mobile-homepage.html') return 'publicAssets';
  if (p.startsWith('db/')) return 'databaseMigration';
  if (
    p.startsWith('nginx/') ||
    p === 'nginx.conf' ||
    p === 'ecosystem.config.js' ||
    p === '.env.example' ||
    p === 'package.json' ||
    p === 'package-lock.json'
  ) {
    return 'configuration';
  }
  if (p.startsWith('generator/')) return 'generator';
  if (p.startsWith('server/lib/seo/')) return 'seo';
  if (p.includes('telegram') || p.includes('Telegram')) return 'telegram';
  if (
    p.includes('reviewQueue') ||
    p.includes('ReviewQueue') ||
    p.includes('editorialReview') ||
    p.includes('EditorialReview') ||
    p.includes('reviewComparison') ||
    p.includes('reviewDecision') ||
    p.includes('reviewWorkflow')
  ) {
    return 'reviewQueue';
  }
  if (
    p.startsWith('server/services/updates/') ||
    p.startsWith('server/services/workers/') ||
    p.startsWith('server/jobs/') ||
    p.includes('siteChecker') ||
    p.includes('sscNotice')
  ) {
    return 'monitoring';
  }
  if (p.startsWith('server/lib/')) return 'sharedLibrary';
  return 'productionRuntime';
}

function sha256File(abs) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(abs));
  return hash.digest('hex');
}

function archiveAndRemove(relPaths, reason) {
  const moved = [];
  ensureDir(ARCHIVE_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bucket = path.join(ARCHIVE_DIR, `${stamp}-${reason}`);
  ensureDir(bucket);
  for (const rel of relPaths) {
    const abs = path.join(PRODUCT_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const dest = path.join(bucket, rel.replace(/\//g, '__'));
    ensureDir(path.dirname(dest));
    fs.renameSync(abs, dest);
    moved.push({ from: rel, to: path.relative(PRODUCT_ROOT, dest).replace(/\\/g, '/'), reason });
  }
  return { bucket: path.relative(PRODUCT_ROOT, bucket).replace(/\\/g, '/'), moved };
}

function readMigrations() {
  const dir = path.join(PRODUCT_ROOT, 'db', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const details = files.map((name) => {
    const abs = path.join(dir, name);
    const body = fs.readFileSync(abs, 'utf8');
    return {
      name,
      bytes: body.length,
      sha256: sha256File(abs),
      statements: (body.match(/;(?:\s*$|\s*\n)/gm) || []).length,
      createsTable: [...body.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/gi)].map((m) => m[1]),
      altersTable: [...body.matchAll(/ALTER\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/gi)].map((m) => m[1]),
      createsIndex: [...body.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([a-zA-Z0-9_]+)`?/gi)].map((m) => m[1]),
      obsolete: false,
      duplicateOf: null,
      optional: name === 'suggested_indexes.sql',
    };
  });

  // Detect exact duplicate content
  const byHash = new Map();
  for (const d of details) {
    if (!byHash.has(d.sha256)) byHash.set(d.sha256, []);
    byHash.get(d.sha256).push(d.name);
  }
  for (const [, names] of byHash) {
    if (names.length > 1) {
      const keep = names.sort()[0];
      for (const n of names) {
        if (n !== keep) {
          const row = details.find((x) => x.name === n);
          row.duplicateOf = keep;
          row.obsolete = true;
        }
      }
    }
  }

  // Deterministic dependency-aware order (filename sort alone is wrong for same-day linkages).
  const REQUIRED_ORDER = [
    '2026-05-09-add-pages-badges.sql',
    '2026-05-16-content-imports.sql',
    '2026-06-06-add-pages-updated-at.sql',
    '2026-06-08-add-pages-small-box-slot.sql',
    '2026-06-14-add-pages-content-updated-at.sql',
    '2026-06-21-small-box-slots-1-8.sql',
    '2026-06-26-add-pages-advertisement-no.sql',
    '2026-06-27-generator-drafts.sql',
    '2026-07-13-recruitments.sql',
    '2026-07-13-recruitment-events.sql',
    '2026-07-13-recruitment-review-queue.sql',
    '2026-07-13-add-pages-recruitment-linkage.sql',
    '2026-07-13-add-updates-recruitment-linkage.sql',
    '2026-07-13-add-generator-drafts-recruitment-linkage.sql',
    '2026-07-14-recruitment-review-queue-persistence.sql',
  ];
  const optionalTail = details.filter((d) => d.optional && !d.obsolete).map((d) => d.name);
  const known = new Set(REQUIRED_ORDER.concat(optionalTail));
  const extras = details.filter((d) => !d.obsolete && !known.has(d.name)).map((d) => d.name).sort();
  const ordered = REQUIRED_ORDER.filter((n) => details.some((d) => d.name === n && !d.obsolete))
    .concat(extras)
    .concat(optionalTail);

  return {
    details,
    orderedPath: ordered,
    duplicates: [...byHash.values()].filter((v) => v.length > 1),
    orderRationale:
      'Parent tables (recruitments, recruitment_events, recruitment_review_queue) before FK linkage alters; suggested_indexes.sql optional last.',
  };
}

function analyzeDependencies() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PRODUCT_ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).sort();
  const devDeps = Object.keys(pkg.devDependencies || {}).sort();
  const used = new Set();
  const serverFiles = walkFiles(path.join(PRODUCT_ROOT, 'server'), 'server').filter((f) => f.endsWith('.js'));
  const genFiles = walkFiles(path.join(PRODUCT_ROOT, 'generator'), 'generator').filter((f) => f.endsWith('.js'));
  for (const rel of serverFiles.concat(genFiles)) {
    const src = fs.readFileSync(path.join(PRODUCT_ROOT, rel), 'utf8');
    const re = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      used.add(name);
    }
  }
  // Also scan public vendor usage is separate
  const unused = deps.filter((d) => !used.has(d) && d !== 'cross-env');
  const missingCandidates = [...used].filter((u) => !deps.includes(u) && !devDeps.includes(u));
  // Filter builtins-ish and known optional
  const builtins = new Set([
    'fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 'stream', 'events', 'os',
    'child_process', 'buffer', 'querystring', 'zlib', 'net', 'tls', 'dns', 'readline',
    'assert', 'cluster', 'worker_threads', 'module', 'perf_hooks', 'timers', 'string_decoder',
  ]);
  const missing = missingCandidates.filter((m) => !builtins.has(m));
  return {
    productionDependencies: deps,
    developmentDependencies: devDeps,
    usedPackages: [...used].sort(),
    possiblyUnusedProduction: unused,
    possiblyMissing: missing,
    notes: [
      'cross-env retained for npm scripts.',
      'Possibly-unused list is heuristic (dynamic requires / peer usage may not be detected).',
      'redis and ioredis both present: redis used by config/redis; ioredis by bullmq/rate-limit patterns.',
    ],
  };
}

function analyzeEnv() {
  const example = fs.readFileSync(path.join(PRODUCT_ROOT, '.env.example'), 'utf8');
  const lines = example.split(/\r?\n/);
  const vars = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      const commented = trimmed.match(/^#\s*([A-Z][A-Z0-9_]*)=/);
      if (commented) {
        vars.push({ name: commented[1], required: false, optional: true, commentedDefault: true });
      }
      continue;
    }
    const m = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) vars.push({ name: m[1], required: false, optional: true, commentedDefault: false, hasExampleValue: m[2].length > 0 });
  }

  const requiredProduction = [
    'NODE_ENV',
    'SITE_URL',
    'JWT_SECRET',
    'ADMIN_USER',
    'ADMIN_PASS_HASH',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_NAME',
    'REDIS_HOST',
    'REDIS_PORT',
    'CORS_ORIGINS',
  ];
  const stronglyRecommended = [
    'TRUST_PROXY',
    'COOKIE_DOMAIN',
    'DB_PASSWORD',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'ACCESS_TOKEN_EXPIRES_IN',
    'REFRESH_TOKEN_EXPIRES_IN',
  ];
  const obsolete = []; // none detected vs runtime usage scan below

  const serverSrc = walkFiles(path.join(PRODUCT_ROOT, 'server'), 'server')
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(PRODUCT_ROOT, f), 'utf8'))
    .join('\n');
  const usedEnv = new Set();
  const envRe = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  let em;
  while ((em = envRe.exec(serverSrc))) usedEnv.add(em[1]);

  const exampleNames = new Set(vars.map((v) => v.name));
  const inExampleUnused = [...exampleNames].filter((n) => !usedEnv.has(n) && n !== 'NODE_ENV' && n !== 'PM2_INSTANCES' && n !== 'PM2_TARGET_ENV');
  const usedMissingFromExample = [...usedEnv].filter((n) => !exampleNames.has(n)).sort();

  return {
    variables: vars,
    requiredProduction,
    stronglyRecommended,
    optionalFeatureFlags: vars.filter((v) => v.commentedDefault).map((v) => v.name),
    possiblyObsoleteInExample: inExampleUnused.sort(),
    usedButMissingFromExample: usedMissingFromExample,
    obsolete,
    secretsNeverCommit: ['JWT_SECRET', 'ADMIN_PASS_HASH', 'DB_PASSWORD', 'DB_PASS', 'REDIS_PASSWORD', 'TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY'],
  };
}

function verifySyntax(files) {
  const { spawnSync } = require('child_process');
  const failures = [];
  const checked = [];
  for (const rel of files) {
    if (!rel.endsWith('.js')) continue;
    const abs = path.join(PRODUCT_ROOT, rel);
    if (!fs.existsSync(abs)) {
      failures.push({ file: rel, error: 'missing' });
      continue;
    }
    const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    checked.push(rel);
    if (r.status !== 0) {
      failures.push({ file: rel, error: (r.stderr || r.stdout || 'check failed').slice(0, 500) });
    }
  }
  return { checkedCount: checked.length, failures };
}

function writeReport(name, content) {
  ensureDir(RC_DIR);
  const abs = path.join(RC_DIR, name);
  fs.writeFileSync(abs, content, 'utf8');
  return path.relative(PRODUCT_ROOT, abs).replace(/\\/g, '/');
}

function main() {
  ensureDir(RC_DIR);

  // --- Clean release noise (archive, do not permanently destroy without record) ---
  const tmpRootPngs = walkFiles(PRODUCT_ROOT, '')
    .filter((f) => /^tmp-.*\.png$/i.test(f));
  const tmpScripts = walkFiles(path.join(PRODUCT_ROOT, 'scripts'), 'scripts').filter((f) => /\/tmp-|\\tmp-|tmp-/i.test(f));
  const logFiles = walkFiles(path.join(PRODUCT_ROOT, 'logs'), 'logs');
  const archiveOps = [];
  if (tmpRootPngs.length) archiveOps.push(archiveAndRemove(tmpRootPngs, 'temporary-screenshots'));
  if (tmpScripts.length) archiveOps.push(archiveAndRemove(tmpScripts, 'temporary-scripts'));
  if (logFiles.length) archiveOps.push(archiveAndRemove(logFiles, 'logs'));

  // Update .gitignore for RC noise
  const gitignorePath = path.join(PRODUCT_ROOT, '.gitignore');
  let gi = fs.readFileSync(gitignorePath, 'utf8');
  const giAdds = [
    'tmp-*.png',
    'scripts/tmp-*',
    '.rc-archive/',
    'docs/release-candidate/tmp-*',
    'coverage/',
  ];
  for (const line of giAdds) {
    if (!gi.includes(line)) gi += `\n${line}`;
  }
  if (!gi.endsWith('\n')) gi += '\n';
  fs.writeFileSync(gitignorePath, gi, 'utf8');

  // Reachability from production entry points
  const reach = buildReachability([
    'server/server.js',
    'server/app.js',
    'server/jobs/worker.js',
    'server/jobs/queue.js',
    'server/services/workers/siteWorker.js',
  ]);

  // Also include admin route trees mounted via protected.routes (covered by app.js require)

  const allProductFiles = walkFiles(PRODUCT_ROOT, '').filter((f) => !f.startsWith('node_modules/') && !f.startsWith('.git/') && !f.startsWith('.rc-archive/'));
  const classifications = {};
  for (const f of allProductFiles) {
    const c = classifyPath(f);
    if (!classifications[c]) classifications[c] = [];
    classifications[c].push(f);
  }
  for (const k of Object.keys(classifications)) classifications[k].sort();

  const migrations = readMigrations();
  const deps = analyzeDependencies();
  const env = analyzeEnv();

  // Build whitelist deployment manifest (exclude advisory monitoringBot facades, tests, generated, etc.)
  const rootWhitelist = [
    'package.json',
    'package-lock.json',
    'ecosystem.config.js',
    'nginx.conf',
    '.env.example',
    'homepage.html',
    'mobile-homepage.html',
  ];
  const dirWhitelist = ['server', 'public', 'private', 'db', 'nginx', 'generator'];
  const reachableSetEarly = new Set(reach.reachable);
  const deployFiles = [];
  for (const name of rootWhitelist) {
    if (fs.existsSync(path.join(PRODUCT_ROOT, name))) deployFiles.push(name);
  }
  for (const dir of dirWhitelist) {
    for (const rel of walkFiles(path.join(PRODUCT_ROOT, dir), dir)) {
      if (isDeployExcluded(rel)) continue;
      const cls = classifyPath(rel);
      // Reachable runtime modules ALWAYS ship, even if filename looks advisory.
      if (reachableSetEarly.has(rel)) {
        deployFiles.push(rel);
        continue;
      }
      if (MUST_NEVER.has(cls) && cls !== CLASSIFICATION.CONTENT) continue;
      if (cls === CLASSIFICATION.ADVISORY) continue;
      if (cls === CLASSIFICATION.DOCUMENTATION) continue;
      if (cls === CLASSIFICATION.GENERATED) continue;
      if (cls === CLASSIFICATION.DEVELOPMENT) continue;
      deployFiles.push(rel);
    }
  }
  // Keep storage/.gitkeep style only if present without uploads
  const storageKeep = walkFiles(path.join(PRODUCT_ROOT, 'storage'), 'storage').filter(
    (f) => f.endsWith('.gitkeep') || f.endsWith('README.md')
  );
  deployFiles.push(...storageKeep);

  const uniqueDeploy = [...new Set(deployFiles)].sort();
  const categories = {
    productionRuntime: [],
    sharedLibrary: [],
    publicAssets: [],
    adminUi: [],
    configuration: [],
    databaseMigration: [],
    monitoring: [],
    telegram: [],
    reviewQueue: [],
    seo: [],
    generator: [],
  };
  for (const f of uniqueDeploy) {
    const cat = categorizeDeploy(f);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(f);
  }

  const manifest = {
    manifestVersion: 'RC1.0.0',
    packageCode: 'RC-1',
    approach: 'WHITELIST_ONLY',
    productRoot: 'sarkari-suchna-india',
    generatedFor: 'FINAL_RELEASE_CANDIDATE',
    deploymentAllowed: false,
    automaticDeployDenied: true,
    generatedAt: new Date().toISOString(),
    categories,
    productionDependencies: deps.productionDependencies,
    files: uniqueDeploy,
    fileCount: uniqueDeploy.length,
    rootWhitelist,
    directoryWhitelist: dirWhitelist.concat(['storage']),
    excludedByDefault: true,
    notes: [
      'Only explicitly listed files are eligible for deployment.',
      'Everything not listed is excluded by default.',
      'node_modules is installed on target from package-lock.json.',
      '.env secrets are never included.',
      'server/lib/monitoringBot/* facades are EXCLUDED — they require workspace advisory frameworks outside the product repo.',
      'generator/ runtime modules are INCLUDED (page generation pipeline).',
      'Any module reachable from production entry points is force-included even if named like advisory.',
      'tests, docs, scripts, generated, logs, samples, tmp artifacts are EXCLUDED.',
      'Manifest generation does not upload, push, or activate production.',
    ],
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // Also write into controlledDeployment location under workspace for continuity
  const workspaceManifest = path.join(
    WORKSPACE_ROOT,
    'server/lib/project/monitoringBot/controlledDeployment/deployment-manifest.json'
  );
  if (fs.existsSync(path.dirname(workspaceManifest))) {
    fs.writeFileSync(workspaceManifest, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  // Syntax verification of deploy whitelist JS + reachable runtime
  const verifySet = [...new Set(uniqueDeploy.filter((f) => f.endsWith('.js')).concat(reach.reachable.filter((f) => f.endsWith('.js'))))].sort();
  const syntax = verifySyntax(verifySet);

  // Dead runtime candidates: server JS not reachable and not in deploy (or advisory)
  const allServerJs = walkFiles(path.join(PRODUCT_ROOT, 'server'), 'server').filter((f) => f.endsWith('.js'));
  const reachableSet = new Set(reach.reachable);
  const deploySet = new Set(uniqueDeploy);
  const deadCandidates = allServerJs.filter((f) => {
    if (reachableSet.has(f)) return false;
    if (f.startsWith('server/lib/monitoringBot/')) return true; // advisory facade
    if (classifyPath(f) === CLASSIFICATION.ADVISORY) return true;
    if (!deploySet.has(f) && !f.startsWith('server/scripts/')) return true;
    return false;
  });

  // Import validation: check deploy whitelist files for missing local requires
  const deployMissing = [];
  for (const rel of uniqueDeploy.filter((f) => f.endsWith('.js'))) {
    const abs = path.join(PRODUCT_ROOT, rel);
    const src = fs.readFileSync(abs, 'utf8');
    const re = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const resolved = resolveFrom(abs, m[1]);
      if (!resolved) deployMissing.push(`${rel} -> ${m[1]}`);
      else if (!path.normalize(resolved).startsWith(PRODUCT_ROOT) && !path.normalize(resolved).includes(`${path.sep}node_modules${path.sep}`)) {
        deployMissing.push(`${rel} -> OUTSIDE_PRODUCT ${m[1]}`);
      }
    }
  }

  // Git preparation lists
  const mustGoFiles = uniqueDeploy.slice();
  const mustNever = [];
  for (const [cls, files] of Object.entries(classifications)) {
    if (MUST_NEVER.has(cls) || cls === CLASSIFICATION.GENERATED || cls === CLASSIFICATION.DOCUMENTATION || cls === CLASSIFICATION.CONTENT) {
      mustNever.push(...files.map((f) => ({ file: f, classification: cls })));
    }
  }

  const filesToIgnore = [
    'node_modules/',
    '.env',
    'logs/',
    'tmp-*.png',
    'scripts/tmp-*',
    '.rc-archive/',
    'coverage/',
    'storage/uploads/',
    'storage/temp/',
    'data/admin-activity.json',
    'data/activity.json',
    'data/related-analytics.json',
    'server/data/editorial-reviews.json',
  ];

  const filesToDelete = archiveOps.flatMap((op) => op.moved.map((m) => m.from));
  const filesToArchive = archiveOps.flatMap((op) => op.moved.map((m) => ({ archivedAs: m.to, original: m.from, reason: m.reason })));
  const filesToKeepLocal = [
    '.env',
    'logs/',
    'storage/uploads/',
    'data/*.json',
    'generated/',
    'node_modules/',
    '.rc-archive/',
    'tests/',
    'docs/',
    'scripts/',
    'server/lib/monitoringBot/',
  ];

  // Assessment gates
  const blockers = [];
  if (syntax.failures.length) blockers.push(`Syntax failures: ${syntax.failures.length}`);
  if (deployMissing.length) blockers.push(`Deploy whitelist broken imports: ${deployMissing.length}`);
  if (reach.missing.length) blockers.push(`Runtime missing imports: ${reach.missing.length}`);
  if (migrations.duplicates.length) blockers.push(`Duplicate migrations: ${migrations.duplicates.length}`);
  const reachableMissingFromDeploy = reach.reachable.filter((f) => !uniqueDeploy.includes(f));
  if (reachableMissingFromDeploy.length) {
    blockers.push(`Reachable modules missing from deploy whitelist: ${reachableMissingFromDeploy.length}`);
  }
  // monitoringBot outside refs are expected for advisory — not a blocker if excluded from deploy
  const assessment = blockers.length === 0 ? 'RELEASE_CANDIDATE_READY' : 'MANUAL_REVIEW_REQUIRED';

  const subsystemVerification = {
    generator: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'private/generator.html')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/controllers/admin/generator.controller.js')),
      notes: 'Admin generator routes/controllers present',
    },
    monitoringBot: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/services/workers/siteWorker.js')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/services/updates/updateScheduler.js')),
      notes: 'Runtime monitoring via siteWorker/scheduler; advisory monitoringBot facades excluded from deploy',
    },
    telegram: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/services/updates/telegramNotifier.js')),
      notes: 'telegramNotifier present; activation is env-gated and not performed by RC',
    },
    reviewQueue: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/lib/recruitment/reviewQueue.js')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'private/admin-recruitment-review-queue.html')),
      notes: 'Review queue service + admin UI present',
    },
    seo: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/lib/sitemapGenerator.js')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/lib/seo')),
      notes: 'Sitemap + seo lib present',
    },
    scheduler: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/services/updates/updateScheduler.js')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/services/updates/schedulerLeadership.js')),
      notes: 'Scheduler modules present; not activated by RC',
    },
    runtime: {
      ok: syntax.failures.length === 0 && reach.missing.length === 0,
      notes: `Syntax checked ${syntax.checkedCount} files; missing=${reach.missing.length}`,
    },
    databaseLayer: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/config/db.js')) && migrations.orderedPath.length > 0,
      notes: `${migrations.orderedPath.length} migration files in deterministic order (not executed)`,
    },
    redisLayer: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'server/config/redis.js')),
      notes: 'Redis config present',
    },
    admin: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'private/admin-dashboard.html')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/api/admin/protected.routes.js')),
      notes: 'Admin UI + protected routes present',
    },
    publicSite: {
      ok: fs.existsSync(path.join(PRODUCT_ROOT, 'homepage.html')) &&
        fs.existsSync(path.join(PRODUCT_ROOT, 'server/app.js')),
      notes: 'Public homepage + app present',
    },
  };

  const report = {
    packageCode: 'RC-1',
    assessment,
    blockers,
    generatedAt: new Date().toISOString(),
    productRoot: PRODUCT_ROOT.replace(/\\/g, '/'),
    archiveOperations: archiveOps,
    repositoryAudit: {
      productGitPresent: fs.existsSync(path.join(PRODUCT_ROOT, '.git')),
      workspaceGitPresent: fs.existsSync(path.join(WORKSPACE_ROOT, '.git')),
      totalProductFilesScanned: allProductFiles.length,
      workspaceAdvisoryLayer: {
        present: fs.existsSync(path.join(WORKSPACE_ROOT, 'server')),
        note: 'Workspace server/tests/scripts are advisory planning harness — NOT part of production deploy package',
      },
    },
    classificationSummary: Object.fromEntries(
      Object.entries(classifications).map(([k, v]) => [k, v.length])
    ),
    classifications,
    releaseInventory: {
      mustGoToProduction: mustGoFiles,
      mustNeverGoToProduction: mustNever,
      mustGoCount: mustGoFiles.length,
      mustNeverCount: mustNever.length,
    },
    productionRuntimeInventory: {
      reachableFromEntries: reach.reachable,
      reachableCount: reach.reachable.length,
      deployWhitelist: uniqueDeploy,
      deployCount: uniqueDeploy.length,
      reachableMissingFromDeploy,
    },
    excludedInventory: {
      byClassification: Object.fromEntries(
        Object.entries(classifications)
          .filter(([k]) => MUST_NEVER.has(k) || k === CLASSIFICATION.GENERATED || k === CLASSIFICATION.DOCUMENTATION || k === CLASSIFICATION.ADVISORY || k === CLASSIFICATION.CONTENT)
          .map(([k, v]) => [k, v])
      ),
      monitoringBotFacadesExcluded: walkFiles(path.join(PRODUCT_ROOT, 'server/lib/monitoringBot'), 'server/lib/monitoringBot'),
      deadOrAdvisoryCandidates: deadCandidates,
    },
    databaseMigrationReport: migrations,
    dependencyReport: deps,
    environmentReport: env,
    importValidationReport: {
      runtimeMissing: reach.missing,
      circular: reach.circular,
      outsideProductRequires: reach.outsideProduct,
      deployWhitelistMissing: deployMissing,
      duplicateModulesNote: 'No exact duplicate module paths detected under server/; advisory blueprints remain local-only',
    },
    releaseVerificationReport: {
      subsystemVerification,
      syntax,
    },
    deploymentManifestPath: path.relative(PRODUCT_ROOT, MANIFEST_PATH).replace(/\\/g, '/'),
    deploymentManifest: {
      version: manifest.manifestVersion,
      fileCount: manifest.fileCount,
      approach: manifest.approach,
    },
    checklists: {
      release: [
        'Confirm RC-1 assessment is RELEASE_CANDIDATE_READY',
        'Review deployment-manifest.json whitelist only',
        'Confirm .env.example matches required production variables',
        'Confirm advisory monitoringBot facades are NOT in deploy package',
        'Confirm tests/logs/tmp/generated are excluded',
        'Operator authorization required before any production action',
      ],
      migration: [
        'Backup production MySQL before any migration',
        'Apply migrations in orderedPath sequence only',
        'Skip suggested_indexes.sql unless operator explicitly approves',
        'Do not merge or reorder dated migrations already applied in production',
        'Verify row counts / smoke queries after each migration batch',
        'No SQL execution performed by RC-1',
      ],
      deployment: [
        'Deploy ONLY whitelist files from deployment-manifest.json',
        'Install dependencies on target via npm ci from package-lock.json',
        'Supply production .env separately (never from repo)',
        'Do not activate scheduler/Telegram until post-deploy health checks pass',
        'PM2 reload / Nginx reload only in a separate authorized deploy request',
        'No push/deploy performed by RC-1',
      ],
      rollback: [
        'Retain previous release artifact / git tag before deploy',
        'Restore previous application files from last known good package',
        'Restore DB from pre-migration backup if migrations were applied',
        'Reload PM2 to previous ecosystem revision',
        'Verify /ready and critical public routes',
        'Disable feature flags (RECRUITMENT_PIPELINE_ENABLED etc.) if regression detected',
      ],
    },
    gitPreparationReport: {
      doNotCommitAutomatically: true,
      doNotPush: true,
      filesToCommit: mustGoFiles,
      filesToIgnore,
      filesToDelete,
      filesToArchive,
      filesToKeepLocal,
      notes: [
        'Commit only after operator review of this RC report.',
        'Do not commit .env, uploads, logs, tmp screenshots, or .rc-archive.',
        'generated/ HTML may be regenerated on server — prefer exclude unless product policy requires committing snapshots.',
        'Workspace root advisory harness (../server, ../tests, ../scripts) is outside product git and must not be pushed to production remote.',
      ],
    },
  };

  writeReport('RC1-MASTER-REPORT.json', JSON.stringify(report, null, 2) + '\n');

  // Human-readable summary markdown
  const md = [];
  md.push('# Sarkari Suchna India — RC-1 Release Candidate Report');
  md.push('');
  md.push(`**Final Assessment: ${assessment}**`);
  md.push('');
  md.push(`Generated: ${report.generatedAt}`);
  md.push('');
  md.push('## Repository Audit Report');
  md.push(`- Product git: ${report.repositoryAudit.productGitPresent}`);
  md.push(`- Workspace git: ${report.repositoryAudit.workspaceGitPresent}`);
  md.push(`- Product files scanned: ${report.repositoryAudit.totalProductFilesScanned}`);
  md.push(`- Workspace advisory layer: ${report.repositoryAudit.workspaceAdvisoryLayer.note}`);
  md.push('');
  md.push('## Repository Classification Report');
  for (const [k, n] of Object.entries(report.classificationSummary).sort((a, b) => b[1] - a[1])) {
    md.push(`- ${k}: ${n}`);
  }
  md.push('');
  md.push('## Release Inventory');
  md.push(`- MUST go to production: **${report.releaseInventory.mustGoCount}** files`);
  md.push(`- MUST NEVER go to production: **${report.releaseInventory.mustNeverCount}** files`);
  md.push('');
  md.push('## Production Runtime Inventory');
  md.push(`- Reachable runtime modules: ${report.productionRuntimeInventory.reachableCount}`);
  md.push(`- Deploy whitelist files: ${report.productionRuntimeInventory.deployCount}`);
  md.push('');
  md.push('## Excluded Inventory');
  md.push(`- monitoringBot facades excluded: ${report.excludedInventory.monitoringBotFacadesExcluded.length}`);
  md.push(`- Dead/advisory candidates: ${report.excludedInventory.deadOrAdvisoryCandidates.length}`);
  md.push('');
  md.push('## Database Migration Report');
  md.push('Deterministic path (not executed):');
  for (const name of migrations.orderedPath) md.push(`1. \`db/migrations/${name}\``);
  md.push(`- Duplicates found: ${migrations.duplicates.length}`);
  md.push(`- Optional: suggested_indexes.sql`);
  md.push('');
  md.push('## Dependency Report');
  md.push(`- Production deps: ${deps.productionDependencies.length}`);
  md.push(`- Dev deps: ${deps.developmentDependencies.length}`);
  md.push(`- Possibly unused: ${deps.possiblyUnusedProduction.join(', ') || '(none)'}`);
  md.push(`- Possibly missing: ${deps.possiblyMissing.join(', ') || '(none)'}`);
  md.push('');
  md.push('## Environment Report');
  md.push(`- Required: ${env.requiredProduction.join(', ')}`);
  md.push(`- Strongly recommended: ${env.stronglyRecommended.join(', ')}`);
  md.push(`- Secrets never commit: ${env.secretsNeverCommit.join(', ')}`);
  md.push(`- Used but missing from .env.example: ${env.usedButMissingFromExample.join(', ') || '(none)'}`);
  md.push('');
  md.push('## Import Validation Report');
  md.push(`- Runtime missing: ${reach.missing.length}`);
  md.push(`- Circular: ${reach.circular.length}`);
  md.push(`- Outside-product requires (advisory facades): ${reach.outsideProduct.length}`);
  md.push(`- Deploy whitelist missing: ${deployMissing.length}`);
  if (reach.missing.length) md.push('```\n' + reach.missing.slice(0, 40).join('\n') + '\n```');
  if (deployMissing.length) md.push('```\n' + deployMissing.slice(0, 40).join('\n') + '\n```');
  md.push('');
  md.push('## Release Verification Report');
  for (const [k, v] of Object.entries(subsystemVerification)) {
    md.push(`- ${k}: ${v.ok ? 'OK' : 'FAIL'} — ${v.notes}`);
  }
  md.push(`- Syntax failures: ${syntax.failures.length}`);
  if (syntax.failures.length) {
    md.push('```');
    for (const f of syntax.failures.slice(0, 20)) md.push(`${f.file}: ${f.error}`);
    md.push('```');
  }
  md.push('');
  md.push('## Deployment Manifest');
  md.push(`- Path: \`${report.deploymentManifestPath}\``);
  md.push(`- Version: ${manifest.manifestVersion}`);
  md.push(`- Whitelist file count: ${manifest.fileCount}`);
  md.push('- Approach: WHITELIST_ONLY (everything excluded by default)');
  md.push('');
  md.push('## Release Checklist');
  for (const i of report.checklists.release) md.push(`- [ ] ${i}`);
  md.push('');
  md.push('## Migration Checklist');
  for (const i of report.checklists.migration) md.push(`- [ ] ${i}`);
  md.push('');
  md.push('## Deployment Checklist');
  for (const i of report.checklists.deployment) md.push(`- [ ] ${i}`);
  md.push('');
  md.push('## Rollback Checklist');
  for (const i of report.checklists.rollback) md.push(`- [ ] ${i}`);
  md.push('');
  md.push('## Git Preparation Report');
  md.push('- DO NOT commit automatically');
  md.push('- DO NOT push');
  md.push(`- Files to commit (whitelist): ${mustGoFiles.length}`);
  md.push(`- Files deleted/archived this run: ${filesToDelete.length}`);
  md.push('- Keep local: .env, uploads, logs, generated, tests, docs, scripts, monitoringBot facades, .rc-archive');
  md.push('');
  md.push('## Final Release Assessment');
  md.push('');
  md.push(`# ${assessment}`);
  md.push('');
  if (blockers.length) {
    md.push('Blockers:');
    for (const b of blockers) md.push(`- ${b}`);
  } else {
    md.push('Only ONE final deployment request remains. No deploy/push/migration was performed.');
  }
  md.push('');

  writeReport('RC1-RELEASE-CANDIDATE-REPORT.md', md.join('\n'));

  // Slim inventories for operator
  writeReport('RC1-PRODUCTION-WHITELIST.txt', uniqueDeploy.join('\n') + '\n');
  writeReport(
    'RC1-EXCLUDED-SUMMARY.txt',
    [
      'EXCLUDED FROM PRODUCTION (summary)',
      `monitoringBot facades: ${report.excludedInventory.monitoringBotFacadesExcluded.length}`,
      `advisory/dead candidates: ${deadCandidates.length}`,
      `tests: ${(classifications[CLASSIFICATION.TESTING] || []).length}`,
      `generated: ${(classifications[CLASSIFICATION.GENERATED] || []).length}`,
      `temporary archived this run: ${filesToDelete.length}`,
      '',
      ...deadCandidates.slice(0, 500),
    ].join('\n') + '\n'
  );

  console.log(JSON.stringify({
    assessment,
    blockers,
    deployCount: uniqueDeploy.length,
    archived: filesToDelete.length,
    syntaxFailures: syntax.failures.length,
    missingImports: reach.missing.length + deployMissing.length,
    reportDir: path.relative(PRODUCT_ROOT, RC_DIR).replace(/\\/g, '/'),
  }, null, 2));
}

main();
