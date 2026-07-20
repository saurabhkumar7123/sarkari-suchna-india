'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DYNAMIC = /path\.resolve\s*\(\s*__dirname\s*,\s*(['"])([^'"]+)\1\s*\)/;

const facades = [
  'server/lib/recruitment/automationWorkflow/index.js',
  'server/lib/recruitment/recruitmentIntelligenceBrain/index.js',
  'server/lib/recruitment/pipelineHealth/index.js',
  'server/lib/recruitment/draftPreparation/index.js',
  'server/lib/recruitment/controlledLifecycleEngine/index.js',
  'server/lib/recruitment/monitoringReviewIntegration/index.js',
  'server/lib/recruitment/controlledCandidateResolution/index.js',
  'server/lib/recruitment/publishReadinessAuthorization/index.js',
  'server/lib/monitoringBot/pipelineIntegration/index.js',
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

let outside = 0;
for (const f of facades) {
  const abs = path.join(REPO, f);
  const src = fs.readFileSync(abs, 'utf8');
  const m = src.match(DYNAMIC);
  if (!m) {
    console.log('NO_PATH_RESOLVE', f);
    outside += 1;
    continue;
  }
  const resolved = path.resolve(path.dirname(abs), m[2]);
  const inside = resolved.startsWith(REPO + path.sep);
  const exists = fs.existsSync(resolved);
  if (!inside || !exists) outside += 1;
  console.log(
    `${inside && exists ? 'INSIDE' : 'BAD'}  ${f} -> ${path.relative(REPO, resolved)}`
  );
}

console.log(JSON.stringify({ outsideCount: outside, facadesChecked: facades.length }));
process.exit(outside ? 1 : 0);
