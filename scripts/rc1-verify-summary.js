'use strict';
const path = require('path');
const r = require(path.join(__dirname, '..', 'docs', 'release-candidate', 'RC1-MASTER-REPORT.json'));
const out = {
  assessment: r.assessment,
  blockers: r.blockers,
  deploy: r.productionRuntimeInventory.deployCount,
  reachable: r.productionRuntimeInventory.reachableCount,
  missingFromDeploy: (r.productionRuntimeInventory.reachableMissingFromDeploy || []).length,
  sampleMissing: (r.productionRuntimeInventory.reachableMissingFromDeploy || []).slice(0, 20),
  migrationOrder: r.databaseMigrationReport.orderedPath,
  envMissing: r.environmentReport.usedButMissingFromExample,
  unused: r.dependencyReport.possiblyUnusedProduction,
  outside: r.importValidationReport.outsideProductRequires.length,
  syntax: r.releaseVerificationReport.syntax.failures.length,
  classSummary: r.classificationSummary,
};
console.log(JSON.stringify(out, null, 2));
