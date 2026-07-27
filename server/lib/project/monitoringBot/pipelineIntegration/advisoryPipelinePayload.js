'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-4
 * Advisory Pipeline Payload (Program 5 Compatible Mapping)
 *
 * Maps extracted recruitment / advisory candidate into Program 5 format.
 * Maintain compatibility. No publishing. No page generation.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  createMonitoringCandidate,
} = require('../../program5/monitoringCandidateContract');

const ADVISORY_PIPELINE_PAYLOAD_VERSION = 'MB4.1.0.0';

function asStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/**
 * Map MB-3 advisory candidate / structured recruitment into Program 5 payload.
 * @param {object} [input]
 */
function mapToAdvisoryPipelinePayload(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const candidateIn = src.candidate || null;
  const recruitment =
    src.recruitment ||
    (candidateIn && candidateIn.structuredRecruitment) ||
    null;
  const extraction = src.extraction || null;
  const duplicate =
    src.duplicate ||
    (extraction && extraction.duplicate) ||
    (candidateIn && candidateIn.duplicateStatus
      ? { duplicateStatus: candidateIn.duplicateStatus }
      : null);

  const meta =
    candidateIn && candidateIn.normalizedMetadata
      ? candidateIn.normalizedMetadata
      : {};

  const mappedCandidateInput = {
    candidateId:
      (candidateIn && candidateIn.candidateId) || src.candidateId || null,
    source:
      (candidateIn && candidateIn.source) ||
      (recruitment && recruitment.sourceId) ||
      null,
    sourceUrl:
      (candidateIn && candidateIn.sourceUrl) ||
      (recruitment && recruitment.officialUrl) ||
      null,
    detectionTime:
      (candidateIn && candidateIn.detectionTime) ||
      (recruitment && recruitment.extractionTimestamp) ||
      src.detectionTime ||
      null,
    recruitmentType:
      (candidateIn && candidateIn.recruitmentType) || 'notification',
    confidence:
      (candidateIn && candidateIn.confidence) != null
        ? candidateIn.confidence
        : recruitment && recruitment.confidenceScore != null
          ? recruitment.confidenceScore
          : null,
    validationStatus:
      (candidateIn && candidateIn.validationStatus) || 'pending',
    title:
      meta.title ||
      (recruitment && recruitment.recruitmentTitle) ||
      null,
    department:
      meta.department || (recruitment && recruitment.department) || null,
    qualification:
      meta.qualification ||
      (recruitment && recruitment.qualification) ||
      null,
    recruitmentCategory:
      meta.recruitmentCategory ||
      (recruitment && recruitment.category) ||
      null,
    importantDates: meta.importantDates || [],
    advertisementNo:
      meta.advertisementNo ||
      (recruitment && recruitment.advertisementNumber) ||
      null,
    postName:
      meta.postName ||
      (recruitment && recruitment.recruitmentTitle) ||
      null,
    rawFingerprint:
      meta.rawFingerprint ||
      (recruitment && recruitment.rawSourceReference) ||
      null,
    advisoryNotes:
      (candidateIn && candidateIn.advisoryNotes) ||
      [
        'MB-4 advisory pipeline payload',
        'No publishing',
        'No page generation',
      ],
    extensions: {
      ...(meta.extensions || {}),
      organization:
        (meta.extensions && meta.extensions.organization) ||
        (recruitment && recruitment.organization) ||
        null,
      applicationMode:
        (meta.extensions && meta.extensions.applicationMode) ||
        (recruitment && recruitment.applicationMode) ||
        null,
      age:
        (meta.extensions && meta.extensions.age) ||
        (recruitment && recruitment.age) ||
        null,
      vacancyCount:
        (meta.extensions && meta.extensions.vacancyCount) ||
        (recruitment && recruitment.vacancyCount) ||
        null,
      attachments:
        (meta.extensions && meta.extensions.attachments) ||
        (recruitment && recruitment.attachments) ||
        [],
      mb3Source: true,
      mb4Mapped: true,
      duplicateStatus:
        (duplicate && duplicate.duplicateStatus) ||
        (candidateIn && candidateIn.duplicateStatus) ||
        null,
      extractionStatus:
        (extraction && extraction.extractionStatus) || null,
    },
  };

  const program5Candidate = createMonitoringCandidate(mappedCandidateInput);

  const mapping = {
    sourceId: program5Candidate.source,
    title: program5Candidate.normalizedMetadata.title,
    advertisementNo: program5Candidate.normalizedMetadata.advertisementNo,
    department: program5Candidate.normalizedMetadata.department,
    qualification: program5Candidate.normalizedMetadata.qualification,
    officialUrl: program5Candidate.sourceUrl,
    confidence: program5Candidate.confidence,
    importantDatesCount: Array.isArray(
      program5Candidate.normalizedMetadata.importantDates
    )
      ? program5Candidate.normalizedMetadata.importantDates.length
      : 0,
  };

  const missingMappedFields = [];
  if (!mapping.sourceId) missingMappedFields.push('source');
  if (!mapping.title) missingMappedFields.push('title');
  if (!mapping.officialUrl) missingMappedFields.push('sourceUrl');
  if (mapping.confidence == null) missingMappedFields.push('confidence');
  if (!program5Candidate.candidateId) missingMappedFields.push('candidateId');
  if (!program5Candidate.detectionTime) {
    missingMappedFields.push('detectionTime');
  }

  return deepFreeze({
    payloadVersion: ADVISORY_PIPELINE_PAYLOAD_VERSION,
    advisoryOnly: true,
    program5Compatible: true,
    publishingDenied: true,
    pageGenerationDenied: true,
    candidate: program5Candidate,
    structuredRecruitment: recruitment,
    mapping,
    missingMappedFields,
    duplicateStatus:
      (duplicate && duplicate.duplicateStatus) ||
      asStringOrNull(
        program5Candidate.normalizedMetadata.extensions.duplicateStatus
      ),
    extractionStatus: (extraction && extraction.extractionStatus) || null,
    confidence:
      typeof program5Candidate.confidence === 'number'
        ? program5Candidate.confidence
        : 0,
  });
}

module.exports = {
  ADVISORY_PIPELINE_PAYLOAD_VERSION,
  mapToAdvisoryPipelinePayload,
};
