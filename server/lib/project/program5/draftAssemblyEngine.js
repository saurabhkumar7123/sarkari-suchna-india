'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Assembly Engine (Deterministic / Configuration-Driven)
 *
 * Assembles draft-ready recruitment artifacts from approved Human Review
 * payloads. Reuses Recruitment Operations and Editorial Review identities.
 *
 * No AI generation. No external APIs. No production draft creation.
 */

const {
  deepFreeze,
  REUSED_MODULE_IDS,
  DRAFT_LIFECYCLE_STATES,
  createDraftPreparationModel,
} = require('./draftPreparationContract');

const DRAFT_ASSEMBLY_ENGINE_VERSION = '5D.1.0.0';

/**
 * Default section assembly map — configuration-driven.
 */
const DEFAULT_ASSEMBLY_SECTION_CONFIG = deepFreeze([
  { sectionId: 'title', label: 'Title', required: true, source: 'contentSummary.title' },
  { sectionId: 'department', label: 'Department', required: true, source: 'contentSummary.department' },
  { sectionId: 'qualification', label: 'Qualification', required: true, source: 'contentSummary.qualification' },
  { sectionId: 'state', label: 'State', required: true, source: 'contentSummary.state' },
  { sectionId: 'importantDates', label: 'Important Dates', required: true, source: 'contentSummary.importantDates' },
  { sectionId: 'eligibility', label: 'Eligibility', required: false, source: 'sections.eligibility' },
  { sectionId: 'selectionProcess', label: 'Selection Process', required: false, source: 'sections.selectionProcess' },
  { sectionId: 'applicationProcess', label: 'Application Process', required: false, source: 'sections.applicationProcess' },
  { sectionId: 'recruitmentMetadata', label: 'Recruitment Metadata', required: true, source: 'recruitment' },
  { sectionId: 'seoMetadata', label: 'SEO Metadata', required: false, source: 'seo' },
]);

function pickString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function resolveContentSummary(reviewPayload) {
  if (!reviewPayload || typeof reviewPayload !== 'object') return {};
  if (reviewPayload.contentSummary && typeof reviewPayload.contentSummary === 'object') {
    return reviewPayload.contentSummary;
  }
  return {};
}

function resolveProvenance(reviewPayload) {
  if (!reviewPayload || typeof reviewPayload !== 'object') return {};
  return reviewPayload.monitoringProvenance || {};
}

function resolveEditorial(reviewPayload) {
  if (!reviewPayload || typeof reviewPayload !== 'object') return {};
  return reviewPayload.editorialReview || {};
}

function resolveSections(input = {}) {
  const sections = input.sections && typeof input.sections === 'object' ? input.sections : {};
  const content = resolveContentSummary(input.reviewPayload);
  return {
    eligibility:
      pickString(sections.eligibility) ||
      pickString(content.eligibility) ||
      pickString(content.qualification),
    selectionProcess:
      pickString(sections.selectionProcess) ||
      pickString(content.selectionProcess),
    applicationProcess:
      pickString(sections.applicationProcess) ||
      pickString(content.applicationProcess),
  };
}

function slugify(title) {
  if (!title) return null;
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || null;
}

/**
 * Create a configuration-driven assembly engine definition.
 *
 * @param {object} [options]
 * @param {object[]} [options.sections]
 * @param {string} [options.version]
 */
function createDraftAssemblyDefinition(options = {}) {
  const sections =
    Array.isArray(options.sections) && options.sections.length
      ? options.sections.map((s) => ({
          sectionId: String(s.sectionId),
          label: s.label != null ? String(s.label) : String(s.sectionId),
          required: Boolean(s.required),
          source: s.source != null ? String(s.source) : '',
        }))
      : DEFAULT_ASSEMBLY_SECTION_CONFIG.map((s) => ({ ...s }));

  return deepFreeze({
    assemblyVersion: options.version || DRAFT_ASSEMBLY_ENGINE_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    deterministic: true,
    aiGeneration: false,
    externalApis: false,
    sectionCount: sections.length,
    sectionIds: sections.map((s) => s.sectionId),
    sections,
    reusedModules: [
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
    ],
  });
}

function getDefaultDraftAssemblyDefinition() {
  return createDraftAssemblyDefinition();
}

/**
 * Deterministically assemble a draft preparation artifact from an approved
 * Human Review payload.
 *
 * @param {object} [input]
 * @param {object} [input.reviewPayload] approved Human Review payload (5B shape)
 * @param {object} [input.sections] optional section overrides
 * @param {object} [input.seoHints]
 * @param {object} [input.assemblyOptions]
 * @param {string} [input.generatedTimestamp]
 * @param {string} [input.draftId]
 * @param {string} [input.lifecycleStateHint] controlled lifecycle state hint
 */
function assembleDraftFromReviewPayload(input = {}) {
  const definition = createDraftAssemblyDefinition(input.assemblyOptions || {});
  const reviewPayload = input.reviewPayload || null;
  const content = resolveContentSummary(reviewPayload);
  const provenance = resolveProvenance(reviewPayload);
  const editorial = resolveEditorial(reviewPayload);
  const sections = resolveSections(input);
  const generatedTimestamp =
    input.generatedTimestamp || '1970-01-01T00:00:00.000Z';

  const title = pickString(content.title);
  const department = pickString(content.department);
  const qualification = pickString(content.qualification);
  const state = pickString(content.state);
  const importantDates = Array.isArray(content.importantDates)
    ? content.importantDates.map((d) =>
        d && typeof d === 'object'
          ? {
              label: pickString(d.label),
              date: pickString(d.date),
            }
          : { label: null, date: pickString(d) }
      )
    : [];

  const recruitmentMetadata = {
    title,
    department,
    qualification,
    state,
    recruitmentCategory: pickString(content.recruitmentCategory),
    importantDates,
    advertisementNo: pickString(content.advertisementNo),
    postName: pickString(content.postName),
    cycleYear: content.cycleYear != null ? content.cycleYear : null,
    eligibility: sections.eligibility,
    selectionProcess: sections.selectionProcess,
    applicationProcess: sections.applicationProcess,
  };

  const seoHints = input.seoHints && typeof input.seoHints === 'object' ? input.seoHints : {};
  const seoMetadata = {
    metaTitle: pickString(seoHints.metaTitle) || title,
    metaDescription:
      pickString(seoHints.metaDescription) ||
      (title && department
        ? `${title} — ${department} recruitment notification`
        : title),
    slugHint: pickString(seoHints.slugHint) || slugify(title),
    canonicalPath: pickString(seoHints.canonicalPath) || null,
    keywords: Array.isArray(seoHints.keywords)
      ? seoHints.keywords.map(String)
      : [department, state, qualification].filter(Boolean),
  };

  const workflowState = pickString(editorial.workflowState);
  const approved =
    input.approved === true ||
    workflowState === 'approved' ||
    Boolean(input.reviewApproved);

  const editorialMetadata = {
    workflowState,
    approved,
    recruitmentId:
      editorial.recruitmentId != null ? Number(editorial.recruitmentId) : null,
    draftBindingId:
      editorial.draftId != null ? Number(editorial.draftId) : null,
    checklistHints: Array.isArray(input.editorialChecklistHints)
      ? input.editorialChecklistHints.map(String)
      : [],
    reusedModule: REUSED_MODULE_IDS.EDITORIAL_REVIEW,
  };

  const sourceCandidateId =
    pickString(provenance.candidateId) ||
    pickString(input.sourceCandidateId) ||
    null;

  const draftId =
    pickString(input.draftId) ||
    (sourceCandidateId
      ? `draft-prep-${sourceCandidateId}`
      : `draft-prep-${generatedTimestamp}`);

  const assembledSections = {
    title,
    department,
    qualification,
    state,
    importantDates,
    eligibility: sections.eligibility,
    selectionProcess: sections.selectionProcess,
    applicationProcess: sections.applicationProcess,
    recruitmentMetadata,
    seoMetadata,
  };

  const presentSections = definition.sectionIds.filter((id) => {
    const value = assembledSections[id];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim().length > 0;
  });

  const missingRequired = definition.sections
    .filter((s) => s.required && !presentSections.includes(s.sectionId))
    .map((s) => s.sectionId);

  const advisoryNotes = [
    'Assembled deterministically from approved Human Review payload.',
    'No AI generation performed.',
    'No production draft created.',
  ];
  if (!approved) {
    advisoryNotes.push('Review payload is not marked approved; assembly remains advisory.');
  }
  if (missingRequired.length) {
    advisoryNotes.push(`Missing required sections: ${missingRequired.join(', ')}`);
  }

  const model = createDraftPreparationModel({
    draftId,
    sourceCandidateId,
    lifecycleState: DRAFT_LIFECYCLE_STATES.ASSEMBLED,
    reviewReference: {
      candidateId: sourceCandidateId,
      workflowState,
      recruitmentId: editorialMetadata.recruitmentId,
      draftBindingId: editorialMetadata.draftBindingId,
      approved,
    },
    recruitmentMetadata,
    seoMetadata,
    editorialMetadata,
    validationSummary: {
      status: 'pending',
      errorCount: 0,
      warningCount: 0,
      issues: [],
    },
    generatedTimestamp,
    advisoryNotes,
    extensions: {
      assembledSections,
      presentSections,
      missingRequired,
      controlledLifecycleHint: pickString(input.lifecycleStateHint),
    },
  });

  return deepFreeze({
    assemblyVersion: DRAFT_ASSEMBLY_ENGINE_VERSION,
    advisoryOnly: true,
    deterministic: true,
    aiGeneration: false,
    externalApis: false,
    productionDraftCreated: false,
    published: false,
    definition,
    ready: missingRequired.length === 0 && Boolean(title),
    approved,
    presentSections,
    missingRequired,
    assembled: model,
    effects: {
      productionDraftCreated: false,
      draftSaved: false,
      contentPublished: false,
      runtimeAutomationActivated: false,
      aiGenerated: false,
      externalApiCalled: false,
    },
  });
}

module.exports = {
  DRAFT_ASSEMBLY_ENGINE_VERSION,
  DEFAULT_ASSEMBLY_SECTION_CONFIG,
  createDraftAssemblyDefinition,
  getDefaultDraftAssemblyDefinition,
  assembleDraftFromReviewPayload,
};
