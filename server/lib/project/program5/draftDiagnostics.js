'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Diagnostics (Read-Only)
 *
 * Surfaces:
 *   - Assembly status
 *   - Validation status
 *   - Generator compatibility
 *   - Preview availability
 *   - Remaining gates
 *
 * No automatic corrections.
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./draftPreparationContract');

const DRAFT_DIAGNOSTICS_VERSION = '5D.1.0.0';

const REMAINING_GATES = Object.freeze([
  'HUMAN_APPROVAL',
  'REQUIRED_METADATA',
  'EDITORIAL_CHECKLIST',
  'SEO_VALIDATION',
  'SHARED_PREVIEW_AVAILABILITY',
  'GENERATOR_COMPATIBILITY',
]);

/**
 * Build read-only draft preparation diagnostics.
 *
 * @param {object} [input]
 * @param {object} [input.assembly]
 * @param {object} [input.validation]
 * @param {object} [input.generatorAdapter]
 * @param {object} [input.preview]
 * @param {object} [input.readiness]
 * @param {string[]} [input.satisfiedGates]
 * @param {string[]} [input.availablePrerequisites]
 */
function buildDraftDiagnostics(input = {}) {
  const assembly = input.assembly || null;
  const validation = input.validation || null;
  const generatorAdapter = input.generatorAdapter || null;
  const preview = input.preview || null;
  const readiness = input.readiness || null;

  const satisfied = new Set(
    (Array.isArray(input.satisfiedGates) ? input.satisfiedGates : []).map(String)
  );

  if (validation && validation.reviewApproved) {
    satisfied.add('HUMAN_APPROVAL');
  }
  if (validation && validation.missingMetadata && validation.missingMetadata.length === 0) {
    satisfied.add('REQUIRED_METADATA');
  }
  if (validation && validation.editorialReady) {
    satisfied.add('EDITORIAL_CHECKLIST');
  }
  if (validation && validation.seoReady) {
    satisfied.add('SEO_VALIDATION');
  }
  if (preview && preview.ready) {
    satisfied.add('SHARED_PREVIEW_AVAILABILITY');
  }
  if (generatorAdapter && generatorAdapter.compatible) {
    satisfied.add('GENERATOR_COMPATIBILITY');
  }

  const remainingGates = REMAINING_GATES.filter((g) => !satisfied.has(g));

  const prerequisites = Object.freeze([
    'PACKAGE_5A_PIPELINE_HEALTH',
    'PACKAGE_5B_MONITORING_REVIEW_INTEGRATION',
    'PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE',
    'RECRUITMENT_OPERATIONS',
    'EDITORIAL_REVIEW',
    'SHARED_PREVIEW',
    'SEO_DIAGNOSTICS',
    'GENERATOR',
  ]);

  const available = new Set(
    (Array.isArray(input.availablePrerequisites)
      ? input.availablePrerequisites
      : prerequisites
    ).map(String)
  );
  const missingPrerequisites = prerequisites.filter((p) => !available.has(p));

  const warnings = [];
  if (assembly && !assembly.ready) {
    warnings.push({
      code: 'ASSEMBLY_INCOMPLETE',
      message: 'Draft assembly is incomplete',
      automaticCorrection: false,
    });
  }
  if (validation && !validation.valid) {
    warnings.push({
      code: 'VALIDATION_FAILED',
      message: 'Draft validation reported errors',
      automaticCorrection: false,
    });
  }
  if (generatorAdapter && !generatorAdapter.compatible) {
    warnings.push({
      code: 'GENERATOR_INCOMPATIBLE',
      message: 'Prepared draft is not Generator-compatible',
      automaticCorrection: false,
    });
  }
  if (preview && !preview.ready) {
    warnings.push({
      code: 'PREVIEW_UNAVAILABLE',
      message: 'Draft preview is not available',
      automaticCorrection: false,
    });
  }
  if (remainingGates.length) {
    warnings.push({
      code: 'REMAINING_GATES',
      message: `Remaining gates: ${remainingGates.join(', ')}`,
      automaticCorrection: false,
    });
  }
  if (missingPrerequisites.length) {
    warnings.push({
      code: 'MISSING_PREREQUISITES',
      message: `Missing prerequisites: ${missingPrerequisites.join(', ')}`,
      automaticCorrection: false,
    });
  }

  return deepFreeze({
    diagnosticsVersion: DRAFT_DIAGNOSTICS_VERSION,
    advisoryOnly: true,
    readOnly: true,
    automaticCorrection: false,
    productionDraftCreated: false,
    published: false,
    assemblyStatus: {
      ready: Boolean(assembly && assembly.ready),
      deterministic: Boolean(assembly && assembly.deterministic),
      aiGeneration: false,
      missingRequired: (assembly && assembly.missingRequired) || [],
      presentSections: (assembly && assembly.presentSections) || [],
    },
    validationStatus: {
      valid: validation ? Boolean(validation.valid) : null,
      status: validation ? validation.status : 'pending',
      errorCount: validation ? validation.errorCount : 0,
      warningCount: validation ? validation.warningCount : 0,
      diagnosticsOnly: true,
      dataModified: false,
    },
    generatorCompatibility: {
      compatible: generatorAdapter ? Boolean(generatorAdapter.compatible) : null,
      ready: generatorAdapter ? Boolean(generatorAdapter.ready) : null,
      draftSaved: false,
      automaticSaveDenied: true,
      missingCritical: (generatorAdapter && generatorAdapter.missingCritical) || [],
      reusedModule: REUSED_MODULE_IDS.GENERATOR,
    },
    previewAvailability: {
      ready: preview ? Boolean(preview.ready) : false,
      previewOnly: true,
      persisted: false,
      reusedModule: REUSED_MODULE_IDS.SHARED_PREVIEW,
    },
    remainingGates,
    satisfiedGates: [...satisfied],
    missingPrerequisites,
    warnings,
    readinessHint: readiness
      ? {
          recommendedNextStep:
            readiness.recommendedNextStep && readiness.recommendedNextStep.code
              ? readiness.recommendedNextStep.code
              : null,
          completenessScore:
            readiness.draftCompleteness &&
            readiness.draftCompleteness.score != null
              ? readiness.draftCompleteness.score
              : null,
        }
      : null,
    reusedModules: [
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.SHARED_PREVIEW,
      REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
      REUSED_MODULE_IDS.GENERATOR,
    ],
  });
}

module.exports = {
  DRAFT_DIAGNOSTICS_VERSION,
  REMAINING_GATES,
  buildDraftDiagnostics,
};
