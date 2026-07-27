'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Health Registry (Advisory / Configuration-Driven)
 *
 * Reusable registry of every major recruitment pipeline stage.
 * Configuration-driven. Deep-frozen. No execution. No monitoring jobs.
 *
 * Reuses Program 4 module identities by reference only — does not
 * duplicate Recruitment Operations, Editorial Review, Shared Preview,
 * SEO Diagnostics, or Admin Dashboard business logic.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const PIPELINE_HEALTH_REGISTRY_VERSION = '5A.1.0.0';

const PIPELINE_STAGE_IDS = Object.freeze([
  'SOURCE_DETECTION',
  'CANDIDATE_COLLECTION',
  'CLASSIFICATION',
  'NORMALIZATION',
  'DEDUPLICATION',
  'HUMAN_REVIEW',
  'DRAFT_PREPARATION',
  'SHARED_PREVIEW',
  'EDITORIAL_REVIEW',
  'SEO_VALIDATION',
  'PUBLISH_READINESS',
]);

const REUSED_MODULE_IDS = Object.freeze({
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  SEO_DIAGNOSTICS: 'SEO_DIAGNOSTICS',
  ADMIN_DASHBOARD: 'ADMIN_DASHBOARD',
});

/**
 * Default stage configuration. Order is the canonical pipeline sequence.
 * dependsOn lists logical upstream stage IDs (advisory graph edges).
 */
const DEFAULT_STAGE_CONFIG = deepFreeze([
  {
    stageId: 'SOURCE_DETECTION',
    order: 1,
    name: 'Source Detection',
    summary:
      'Detect recruitment notice sources eligible for pipeline intake.',
    reusedModules: ['RECRUITMENT_OPERATIONS'],
    dependsOn: [],
    prerequisiteHints: ['SOURCE_CATALOG_AVAILABLE'],
  },
  {
    stageId: 'CANDIDATE_COLLECTION',
    order: 2,
    name: 'Candidate Collection',
    summary: 'Collect candidate recruitment notices from detected sources.',
    reusedModules: ['RECRUITMENT_OPERATIONS'],
    dependsOn: ['SOURCE_DETECTION'],
    prerequisiteHints: ['SOURCE_DETECTION_COMPLETE'],
  },
  {
    stageId: 'CLASSIFICATION',
    order: 3,
    name: 'Classification',
    summary: 'Classify collected candidates into lifecycle and content types.',
    reusedModules: ['RECRUITMENT_OPERATIONS'],
    dependsOn: ['CANDIDATE_COLLECTION'],
    prerequisiteHints: ['CANDIDATES_AVAILABLE'],
  },
  {
    stageId: 'NORMALIZATION',
    order: 4,
    name: 'Normalization',
    summary: 'Normalize classified candidate fields into canonical shapes.',
    reusedModules: ['RECRUITMENT_OPERATIONS'],
    dependsOn: ['CLASSIFICATION'],
    prerequisiteHints: ['CLASSIFICATION_COMPLETE'],
  },
  {
    stageId: 'DEDUPLICATION',
    order: 5,
    name: 'Deduplication',
    summary: 'Identify and group duplicate recruitment candidates.',
    reusedModules: ['RECRUITMENT_OPERATIONS'],
    dependsOn: ['NORMALIZATION'],
    prerequisiteHints: ['NORMALIZED_CANDIDATES_AVAILABLE'],
  },
  {
    stageId: 'HUMAN_REVIEW',
    order: 6,
    name: 'Human Review',
    summary: 'Route ambiguous or low-confidence items for human review.',
    reusedModules: ['RECRUITMENT_OPERATIONS', 'EDITORIAL_REVIEW'],
    dependsOn: ['DEDUPLICATION'],
    prerequisiteHints: ['DEDUPLICATION_COMPLETE'],
  },
  {
    stageId: 'DRAFT_PREPARATION',
    order: 7,
    name: 'Draft Preparation',
    summary: 'Prepare generator-bound drafts for downstream preview.',
    reusedModules: ['EDITORIAL_REVIEW', 'RECRUITMENT_OPERATIONS'],
    dependsOn: ['HUMAN_REVIEW'],
    prerequisiteHints: ['HUMAN_REVIEW_COMPLETE'],
  },
  {
    stageId: 'SHARED_PREVIEW',
    order: 8,
    name: 'Shared Preview',
    summary: 'Expose shared runtime preview of prepared drafts.',
    reusedModules: ['SHARED_PREVIEW', 'ADMIN_DASHBOARD'],
    dependsOn: ['DRAFT_PREPARATION'],
    prerequisiteHints: ['DRAFT_PREPARATION_COMPLETE'],
  },
  {
    stageId: 'EDITORIAL_REVIEW',
    order: 9,
    name: 'Editorial Review',
    summary: 'Perform editorial review against shared preview output.',
    reusedModules: ['EDITORIAL_REVIEW', 'ADMIN_DASHBOARD'],
    dependsOn: ['SHARED_PREVIEW'],
    prerequisiteHints: ['SHARED_PREVIEW_AVAILABLE'],
  },
  {
    stageId: 'SEO_VALIDATION',
    order: 10,
    name: 'SEO Validation',
    summary: 'Validate SEO and content-pipeline readiness advisories.',
    reusedModules: ['SEO_DIAGNOSTICS', 'ADMIN_DASHBOARD'],
    dependsOn: ['EDITORIAL_REVIEW'],
    prerequisiteHints: ['EDITORIAL_REVIEW_COMPLETE'],
  },
  {
    stageId: 'PUBLISH_READINESS',
    order: 11,
    name: 'Publish Readiness',
    summary:
      'Assess publish readiness from SEO validation and editorial gates.',
    reusedModules: [
      'SEO_DIAGNOSTICS',
      'EDITORIAL_REVIEW',
      'ADMIN_DASHBOARD',
    ],
    dependsOn: ['SEO_VALIDATION'],
    prerequisiteHints: ['SEO_VALIDATION_COMPLETE'],
  },
]);

function normalizeStageConfig(stages) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return DEFAULT_STAGE_CONFIG.map((s) => ({ ...s, dependsOn: s.dependsOn.slice(), reusedModules: s.reusedModules.slice(), prerequisiteHints: s.prerequisiteHints.slice() }));
  }

  return stages.map((stage, index) => {
    const stageId =
      typeof stage.stageId === 'string' && stage.stageId.trim()
        ? stage.stageId.trim()
        : `CUSTOM_STAGE_${index + 1}`;
    const dependsOn = Array.isArray(stage.dependsOn)
      ? stage.dependsOn.filter((d) => typeof d === 'string' && d.trim()).map((d) => d.trim())
      : [];
    const reusedModules = Array.isArray(stage.reusedModules)
      ? stage.reusedModules.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim())
      : [];
    const prerequisiteHints = Array.isArray(stage.prerequisiteHints)
      ? stage.prerequisiteHints
          .filter((p) => typeof p === 'string' && p.trim())
          .map((p) => p.trim())
      : [];

    return {
      stageId,
      order:
        typeof stage.order === 'number' && Number.isFinite(stage.order)
          ? stage.order
          : index + 1,
      name:
        typeof stage.name === 'string' && stage.name.trim()
          ? stage.name.trim()
          : stageId,
      summary:
        typeof stage.summary === 'string' ? stage.summary.trim() : '',
      reusedModules,
      dependsOn,
      prerequisiteHints,
    };
  });
}

/**
 * Build a reusable, configuration-driven pipeline health registry.
 * @param {object} [options]
 * @param {Array<object>} [options.stages] Optional stage configuration override.
 */
function createPipelineHealthRegistry(options = {}) {
  const stages = normalizeStageConfig(options && options.stages);
  const byId = {};
  for (let i = 0; i < stages.length; i += 1) {
    byId[stages[i].stageId] = stages[i];
  }

  const ordered = stages.slice().sort((a, b) => a.order - b.order || a.stageId.localeCompare(b.stageId));

  return deepFreeze({
    registryVersion: PIPELINE_HEALTH_REGISTRY_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    reusable: true,
    automaticRecovery: false,
    executionEngine: false,
    stageCount: ordered.length,
    stageIds: ordered.map((s) => s.stageId),
    stages: ordered,
    byId,
    reusedModuleIds: { ...REUSED_MODULE_IDS },
    defaultStageIds: PIPELINE_STAGE_IDS.slice(),
  });
}

function getDefaultPipelineHealthRegistry() {
  return createPipelineHealthRegistry();
}

function getPipelineStage(registry, stageId) {
  if (!registry || !registry.byId || typeof stageId !== 'string') {
    return null;
  }
  return registry.byId[stageId] || null;
}

function listPipelineStages(registry) {
  if (!registry || !Array.isArray(registry.stages)) {
    return [];
  }
  return registry.stages.slice();
}

module.exports = {
  PIPELINE_HEALTH_REGISTRY_VERSION,
  PIPELINE_STAGE_IDS,
  REUSED_MODULE_IDS,
  DEFAULT_STAGE_CONFIG,
  createPipelineHealthRegistry,
  getDefaultPipelineHealthRegistry,
  getPipelineStage,
  listPipelineStages,
};
