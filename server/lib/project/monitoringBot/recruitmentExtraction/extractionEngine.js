'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Extraction Engine (Modular / Parser-Registry Driven)
 *
 * Consumes MB-2 change detection context + MB-1 parser registry.
 * Produces structured recruitment + diagnostics + advisory candidate.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
} = require('../governmentSourceRegistry');
const {
  CONTENT_TYPES,
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
} = require('../monitoringConfiguration');
const {
  createParserRegistry,
  getParserRegistration,
} = require('../parserRegistry');
const {
  createStructuredRecruitment,
  validateStructuredRecruitment,
} = require('./structuredRecruitmentModel');
const { extractByContentType } = require('./extractionParsers');
const { generateExtractionDiagnostics } = require('./extractionDiagnostics');
const { detectAdvisoryDuplicate } = require('./duplicateDetection');
const { buildAdvisoryCandidate } = require('./candidateBuilder');

const EXTRACTION_ENGINE_VERSION = 'MB3.1.0.0';

const EXTRACTION_STATUSES = Object.freeze({
  EXTRACTED: 'EXTRACTED',
  PARTIAL: 'PARTIAL',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
  PDF_INTERFACE_ONLY: 'PDF_INTERFACE_ONLY',
});

function resolveContentType(input, monitoringConfig, parserRegistration) {
  if (typeof input.contentType === 'string' && input.contentType.trim()) {
    return input.contentType.trim().toUpperCase();
  }
  if (monitoringConfig && monitoringConfig.expectedContentType) {
    return monitoringConfig.expectedContentType;
  }
  if (
    parserRegistration &&
    Array.isArray(parserRegistration.supportedFormats) &&
    parserRegistration.supportedFormats.length > 0
  ) {
    return parserRegistration.supportedFormats[0];
  }
  return CONTENT_TYPES.HTML;
}

function resolveBody(input) {
  if (input.body != null) return input.body;
  if (input.content != null) return input.content;
  if (input.html != null) return input.html;
  if (input.xml != null) return input.xml;
  if (
    input.detectionResult &&
    input.detectionResult.metadata &&
    input.detectionResult.metadata.body != null
  ) {
    return input.detectionResult.metadata.body;
  }
  return null;
}

/**
 * Extract recruitment information from source content.
 * Manual / advisory only.
 *
 * @param {object} [input]
 */
function extractRecruitment(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const timestamp =
    typeof src.timestamp === 'string' && src.timestamp.trim()
      ? src.timestamp.trim()
      : new Date().toISOString();

  const detectionResult =
    src.detectionResult && typeof src.detectionResult === 'object'
      ? src.detectionResult
      : null;

  const sourceId =
    (typeof src.sourceId === 'string' && src.sourceId.trim()) ||
    (detectionResult && detectionResult.sourceId) ||
    null;

  const sourceRegistry =
    src.sourceRegistry || getDefaultGovernmentSourceRegistry();
  const monitoringConfiguration =
    src.monitoringConfiguration ||
    createMonitoringConfigurationMap({ sources: sourceRegistry.sources });
  const parserRegistry = src.parserRegistry || createParserRegistry();

  const source = sourceId ? getGovernmentSource(sourceRegistry, sourceId) : null;
  const monitoringConfig = sourceId
    ? getSourceMonitoringConfiguration(monitoringConfiguration, sourceId)
    : null;

  const parserId =
    (typeof src.parserId === 'string' && src.parserId.trim()) ||
    (monitoringConfig && monitoringConfig.parserId) ||
    null;
  const parserRegistration = parserId
    ? getParserRegistration(parserRegistry, parserId)
    : null;

  const detectionStatus = detectionResult
    ? detectionResult.detectionStatus
    : src.detectionStatus || null;

  const forceExtract = src.forceExtract === true;
  if (
    detectionResult &&
    detectionStatus &&
    detectionStatus !== 'CHANGED' &&
    !forceExtract
  ) {
    const diagnostics = generateExtractionDiagnostics({
      extractionSkipped: true,
      skipReason: `Detection status is ${detectionStatus}; extraction requires CHANGED (or forceExtract)`,
      parsingConfidence: 0,
    });
    return deepFreeze({
      engineVersion: EXTRACTION_ENGINE_VERSION,
      advisoryOnly: true,
      extractionStatus: EXTRACTION_STATUSES.SKIPPED,
      sourceId,
      parserId,
      contentType: monitoringConfig
        ? monitoringConfig.expectedContentType
        : null,
      recruitment: null,
      validation: null,
      parseResult: null,
      duplicate: null,
      candidate: buildAdvisoryCandidate({
        skipped: true,
        recruitment: {
          sourceId,
          recruitmentTitle: null,
          officialUrl:
            (detectionResult && detectionResult.fetchUrl) ||
            (source && source.noticeUrl) ||
            null,
          confidenceScore: 0,
        },
        diagnostics,
      }),
      diagnostics,
      timestamp,
      effects: {
        databaseWritten: false,
        reviewQueueCreated: false,
        published: false,
        telegramSent: false,
        schedulerUsed: false,
      },
    });
  }

  const body = resolveBody(src);
  if (body == null) {
    const diagnostics = generateExtractionDiagnostics({
      extractionSkipped: true,
      skipReason: 'No content body provided for extraction',
      parsingConfidence: 0,
      parserNotRegistered: parserId != null && parserRegistration == null,
      parserId,
    });
    return deepFreeze({
      engineVersion: EXTRACTION_ENGINE_VERSION,
      advisoryOnly: true,
      extractionStatus: EXTRACTION_STATUSES.FAILED,
      sourceId,
      parserId,
      contentType: null,
      recruitment: null,
      validation: null,
      parseResult: null,
      duplicate: null,
      candidate: null,
      diagnostics,
      timestamp,
      effects: {
        databaseWritten: false,
        reviewQueueCreated: false,
        published: false,
        telegramSent: false,
        schedulerUsed: false,
      },
    });
  }

  const contentType = resolveContentType(src, monitoringConfig, parserRegistration);
  const officialUrl =
    (typeof src.officialUrl === 'string' && src.officialUrl.trim()) ||
    (detectionResult && detectionResult.fetchUrl) ||
    (source && (source.noticeUrl || source.recruitmentUrl || source.baseUrl)) ||
    null;

  const parseResult = extractByContentType({
    body,
    contentType,
    officialUrl,
    sourceId,
    pdfParser: src.pdfParser,
  });

  const organizationFallback =
    parseResult.fields.organization ||
    (source && source.organization) ||
    null;
  const departmentFallback =
    parseResult.fields.department ||
    (source && source.department) ||
    null;

  const recruitment = createStructuredRecruitment({
    sourceId,
    department: departmentFallback,
    organization: organizationFallback,
    recruitmentTitle: parseResult.fields.recruitmentTitle,
    advertisementNumber: parseResult.fields.advertisementNumber,
    notificationDate: parseResult.fields.notificationDate,
    lastDate: parseResult.fields.lastDate,
    applicationMode: parseResult.fields.applicationMode,
    qualification: parseResult.fields.qualification,
    age: parseResult.fields.age,
    vacancyCount: parseResult.fields.vacancyCount,
    category: parseResult.fields.category || (source && source.category),
    officialUrl: parseResult.fields.officialUrl || officialUrl,
    attachments: parseResult.fields.attachments,
    rawSourceReference:
      (detectionResult &&
        detectionResult.fingerprint &&
        (detectionResult.fingerprint.fingerprint ||
          detectionResult.fingerprint.hash)) ||
      src.rawSourceReference ||
      null,
    confidenceScore: parseResult.confidenceScore,
    extractedFields: parseResult.extractedFields,
    parserId,
    contentType,
    extractionTimestamp: timestamp,
  });

  const validation = validateStructuredRecruitment(recruitment);

  const duplicate = detectAdvisoryDuplicate({
    recruitment,
    existingFingerprints: src.existingFingerprints,
    existingRecruitments: src.existingRecruitments,
  });

  const diagnostics = generateExtractionDiagnostics({
    recruitment,
    ambiguousFields: parseResult.ambiguousFields,
    duplicateSections: parseResult.duplicateSections,
    parsingConfidence: parseResult.confidenceScore,
    pdfParserUnavailable: parseResult.parserAvailable === false,
    parserNotRegistered: parserId != null && parserRegistration == null,
    parserId,
    contentTypeUnsupported: false,
  });

  const candidate = buildAdvisoryCandidate({
    recruitment,
    duplicate,
    diagnostics,
    detectionTime:
      (detectionResult && detectionResult.timestamp) || timestamp,
  });

  let extractionStatus = EXTRACTION_STATUSES.EXTRACTED;
  if (parseResult.parserAvailable === false) {
    extractionStatus = EXTRACTION_STATUSES.PDF_INTERFACE_ONLY;
  } else if (!validation.valid || parseResult.confidenceScore < 0.5) {
    extractionStatus = EXTRACTION_STATUSES.PARTIAL;
  }

  return deepFreeze({
    engineVersion: EXTRACTION_ENGINE_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    deterministic: true,
    extractionStatus,
    sourceId,
    parserId,
    parserRegistration: parserRegistration
      ? {
          parserId: parserRegistration.parserId,
          parserVersion: parserRegistration.parserVersion,
          supportedFormats: parserRegistration.supportedFormats.slice(),
        }
      : null,
    contentType,
    recruitment,
    validation,
    parseResult,
    duplicate,
    candidate,
    diagnostics,
    timestamp,
    effects: {
      databaseWritten: false,
      reviewQueueCreated: false,
      published: false,
      telegramSent: false,
      schedulerUsed: false,
    },
  });
}

module.exports = {
  EXTRACTION_ENGINE_VERSION,
  EXTRACTION_STATUSES,
  extractRecruitment,
};
