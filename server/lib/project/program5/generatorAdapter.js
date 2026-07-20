'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Generator Adapter
 *
 * Transforms a prepared draft into the format expected by the existing
 * Generator (Package 4C generator draft payload contract).
 *
 * Reuses the current Generator contract.
 * Does NOT duplicate generator logic.
 * Does NOT save drafts automatically.
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./draftPreparationContract');

const GENERATOR_ADAPTER_VERSION = '5D.1.0.0';

/**
 * Generator draft payload field contract — identity reuse with
 * collectGeneratorDraftPayload() / generatorDraft.service.saveDraft.
 */
const GENERATOR_PAYLOAD_FIELDS = Object.freeze([
  'title',
  'post_name',
  'total_posts',
  'advertisement_no',
  'status',
  'customStatus',
  'category',
  'structuredQualification',
  'structuredState',
  'structuredDepartment',
  'pageUrl',
  'data',
  'breaking',
  'breakingOrder',
  'eventTime',
  'lastDate',
  'smallBoxSlot',
  'badges',
]);

function pickString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function formatImportantDates(dates) {
  if (!Array.isArray(dates) || !dates.length) return '';
  return dates
    .map((d) => {
      if (!d || typeof d !== 'object') return String(d || '');
      const label = pickString(d.label) || 'Date';
      const date = pickString(d.date) || '';
      return date ? `${label}: ${date}` : label;
    })
    .filter(Boolean)
    .join('\n');
}

function buildContentBody(recruitment) {
  const parts = [];
  if (recruitment.title) parts.push(`# ${recruitment.title}`);
  if (recruitment.department) parts.push(`Department: ${recruitment.department}`);
  if (recruitment.qualification) {
    parts.push(`Qualification: ${recruitment.qualification}`);
  }
  if (recruitment.state) parts.push(`State: ${recruitment.state}`);
  if (Array.isArray(recruitment.importantDates) && recruitment.importantDates.length) {
    parts.push('Important Dates:');
    parts.push(formatImportantDates(recruitment.importantDates));
  }
  if (recruitment.eligibility) {
    parts.push('Eligibility:');
    parts.push(String(recruitment.eligibility));
  }
  if (recruitment.selectionProcess) {
    parts.push('Selection Process:');
    parts.push(String(recruitment.selectionProcess));
  }
  if (recruitment.applicationProcess) {
    parts.push('Application Process:');
    parts.push(String(recruitment.applicationProcess));
  }
  return parts.join('\n\n');
}

function resolveLastDate(importantDates) {
  if (!Array.isArray(importantDates)) return '';
  const end = importantDates.find((d) => {
    if (!d || typeof d !== 'object') return false;
    const label = pickString(d.label).toLowerCase();
    return (
      label.includes('application_end') ||
      label.includes('last date') ||
      label.includes('closing')
    );
  });
  if (end) return pickString(end.date);
  const withDate = importantDates.find((d) => d && pickString(d.date));
  return withDate ? pickString(withDate.date) : '';
}

/**
 * Adapt a prepared draft into the existing Generator draft payload shape.
 *
 * @param {object} [input]
 * @param {object} [input.assembly]
 * @param {object} [input.draft]
 * @param {object} [input.validation]
 * @param {object} [input.overrides] optional field overrides (still advisory)
 */
function adaptPreparedDraftToGenerator(input = {}) {
  const assembly = input.assembly || null;
  const draft =
    (assembly && assembly.assembled) ||
    input.draft ||
    null;
  const validation = input.validation || null;
  const overrides =
    input.overrides && typeof input.overrides === 'object' ? input.overrides : {};

  const recruitment = (draft && draft.recruitmentMetadata) || {};
  const seo = (draft && draft.seoMetadata) || {};
  const editorial = (draft && draft.editorialMetadata) || {};

  const dataBody = buildContentBody(recruitment);

  const generatorPayload = {
    title: pickString(overrides.title) || pickString(recruitment.title),
    post_name:
      pickString(overrides.post_name) || pickString(recruitment.postName),
    total_posts: pickString(overrides.total_posts) || '',
    advertisement_no:
      pickString(overrides.advertisement_no) ||
      pickString(recruitment.advertisementNo),
    status: pickString(overrides.status) || 'draft',
    customStatus: pickString(overrides.customStatus) || '',
    category:
      pickString(overrides.category) ||
      pickString(recruitment.recruitmentCategory) ||
      '',
    structuredQualification:
      pickString(overrides.structuredQualification) ||
      pickString(recruitment.qualification),
    structuredState:
      pickString(overrides.structuredState) || pickString(recruitment.state),
    structuredDepartment:
      pickString(overrides.structuredDepartment) ||
      pickString(recruitment.department),
    pageUrl:
      pickString(overrides.pageUrl) ||
      pickString(seo.slugHint) ||
      pickString(seo.canonicalPath) ||
      '',
    data: pickString(overrides.data) || dataBody,
    breaking:
      overrides.breaking != null ? Boolean(overrides.breaking) : false,
    breakingOrder: pickString(overrides.breakingOrder) || '',
    eventTime: pickString(overrides.eventTime) || '',
    lastDate:
      pickString(overrides.lastDate) ||
      resolveLastDate(recruitment.importantDates),
    smallBoxSlot: pickString(overrides.smallBoxSlot) || '',
    badges: Array.isArray(overrides.badges) ? overrides.badges.slice() : [],
  };

  const populatedFields = GENERATOR_PAYLOAD_FIELDS.filter((field) => {
    const value = generatorPayload[field];
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.length > 0;
    return pickString(value).length > 0;
  });

  const missingCritical = [];
  if (pickString(generatorPayload.title).length < 3) {
    missingCritical.push('title');
  }
  if (
    pickString(generatorPayload.data).length < 20 &&
    pickString(generatorPayload.title).length < 3
  ) {
    missingCritical.push('data');
  }

  const compatible =
    missingCritical.length === 0 &&
    (!validation || validation.valid !== false);

  return deepFreeze({
    adapterVersion: GENERATOR_ADAPTER_VERSION,
    advisoryOnly: true,
    reusedModule: REUSED_MODULE_IDS.GENERATOR,
    reuseMode: 'contract_shape_only',
    duplicatesGeneratorLogic: false,
    draftSaved: false,
    automaticSaveDenied: true,
    productionDraftCreated: false,
    published: false,
    compatible,
    ready: compatible,
    populatedFields,
    missingCritical,
    generatorContractFields: GENERATOR_PAYLOAD_FIELDS.slice(),
    generatorPayload,
    bindingHints: {
      recruitmentId:
        editorial.recruitmentId != null ? editorial.recruitmentId : null,
      draftBindingId:
        editorial.draftBindingId != null ? editorial.draftBindingId : null,
      sourceDraftId: draft && draft.draftId ? draft.draftId : null,
      sourceCandidateId:
        draft && draft.sourceCandidateId ? draft.sourceCandidateId : null,
    },
    mappingSummary: {
      titleMapped: Boolean(generatorPayload.title),
      departmentMapped: Boolean(generatorPayload.structuredDepartment),
      qualificationMapped: Boolean(generatorPayload.structuredQualification),
      stateMapped: Boolean(generatorPayload.structuredState),
      seoSlugMapped: Boolean(generatorPayload.pageUrl),
      contentBodyMapped: Boolean(generatorPayload.data),
    },
    effects: {
      draftSaved: false,
      productionDraftInserted: false,
      generatorInvoked: false,
      contentPublished: false,
    },
  });
}

module.exports = {
  GENERATOR_ADAPTER_VERSION,
  GENERATOR_PAYLOAD_FIELDS,
  adaptPreparedDraftToGenerator,
};
