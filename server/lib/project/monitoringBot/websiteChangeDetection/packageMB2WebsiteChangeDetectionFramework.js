'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Website Change Detection Framework
 *
 * Detects whether a registered government source has changed.
 *
 * This package must NOT:
 *   - extract recruitment information
 *   - create review items
 *   - send Telegram messages
 *   - publish anything
 *   - schedule jobs / start workers
 *   - persist to database / Redis
 *
 * Manual invocation only. Configuration-driven. Deterministic fingerprints.
 * Reuses MB-1 registry and monitoring configuration.
 *
 * Extension points (inactive):
 *   MB-3 Recruitment Extraction, Program 6 Hardening,
 *   Program 7 Operator Analytics, Program 8 Consolidation.
 */

const {
  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
} = require('../governmentSourceRegistry');

const {
  CONTENT_TYPES,
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
} = require('../monitoringConfiguration');

const {
  createCrawlPolicy,
  createCrawlPolicyMap,
  getDefaultCrawlPolicy,
} = require('../crawlPolicy');

const {
  evaluateGovernmentSourceRegistryFramework,
  getGovernmentSourceRegistryFramework,
} = require('../packageMB1GovernmentSourceRegistryFramework');

const {
  SOURCE_FETCH_FRAMEWORK_VERSION,
  DEFAULT_USER_AGENT,
  resolveFetchOptions,
  fetchSource,
} = require('./sourceFetchFramework');

const {
  RESPONSE_METADATA_VERSION,
  collectResponseMetadata,
} = require('./responseMetadata');

const {
  CONTENT_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_ALGORITHMS,
  generateContentFingerprint,
  generateRawSha256Fingerprint,
  normalizeHtmlForFingerprint,
  normalizeXmlForFingerprint,
} = require('./contentFingerprintEngine');

const {
  CHANGE_DETECTION_ENGINE_VERSION,
  DETECTION_STATUS,
  detectChange,
  fingerprintValue,
} = require('./changeDetectionEngine');

const {
  CHANGE_CLASSIFICATION_VERSION,
  CHANGE_CLASSES,
  classifyDetectedChange,
} = require('./changeClassification');

const {
  DETECTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  generateDetectionDiagnostics,
} = require('./detectionDiagnostics');

const {
  DETECTION_RESULT_MODEL_VERSION,
  DETECTION_RESULT_STATUSES,
  createDetectionResult,
} = require('./detectionResultModel');

const {
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  RecruitmentExtractionExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,
} = require('./extensionPoints');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_MB2_WEBSITE_CHANGE_DETECTION';
const PACKAGE_NAME = 'Website Change Detection Framework';
const PACKAGE_CODE = 'MB-2';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Implement the Website Change Detection Framework so a registered government source can be manually checked for change — without extraction, review, Telegram, or publishing.';

const OUT_OF_SCOPE = Object.freeze([
  'RECRUITMENT_EXTRACTION',
  'HTML_PARSING_FOR_EXTRACTION',
  'PDF_PARSING_FOR_EXTRACTION',
  'CANDIDATE_CREATION',
  'REVIEW_QUEUE',
  'TELEGRAM',
  'PUBLISHING',
  'DATABASE_PERSISTENCE',
  'REDIS',
  'SCHEDULER',
  'CRON',
  'WORKERS',
  'AUTOMATIC_RETRIES',
]);

const PROHIBITED = Object.freeze([
  'EXPRESS_ROUTES',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
  'SQL_SCHEMA_CHANGES',
  'SCHEDULER_ACTIVATION',
  'WORKER_ACTIVATION',
  'REVIEW_GENERATION',
]);

const CAPABILITIES = Object.freeze([
  'SOURCE_FETCH_FRAMEWORK',
  'RESPONSE_METADATA_COLLECTION',
  'CONTENT_FINGERPRINT_ENGINE',
  'CHANGE_DETECTION_ENGINE',
  'CHANGE_CLASSIFICATION',
  'DETECTION_DIAGNOSTICS',
  'RUNTIME_RESULT_MODEL',
  'MANUAL_SOURCE_CHANGE_CHECK',
]);

function contentTypeMatchesExpected(actualContentType, expectedContentType) {
  if (!expectedContentType) return true;
  if (!actualContentType) return false;
  const actual = String(actualContentType).toLowerCase();
  const expected = String(expectedContentType).toUpperCase();

  if (expected === CONTENT_TYPES.HTML) {
    return actual.includes('html') || actual.includes('text/plain');
  }
  if (expected === CONTENT_TYPES.PDF) {
    return actual.includes('pdf') || actual.includes('octet-stream');
  }
  if (expected === CONTENT_TYPES.RSS) {
    return (
      actual.includes('rss') ||
      actual.includes('xml') ||
      actual.includes('atom')
    );
  }
  if (expected === CONTENT_TYPES.XML) {
    return actual.includes('xml');
  }
  if (expected === CONTENT_TYPES.JSON) {
    return actual.includes('json');
  }
  return actual.includes(String(expectedContentType).toLowerCase());
}

function resolveFetchUrl(source, input) {
  if (typeof input.url === 'string' && input.url.trim()) {
    return input.url.trim();
  }
  if (!source) return null;
  const prefer =
    typeof input.urlField === 'string' && input.urlField.trim()
      ? input.urlField.trim()
      : 'noticeUrl';
  if (typeof source[prefer] === 'string' && source[prefer].trim()) {
    return source[prefer].trim();
  }
  if (source.noticeUrl) return source.noticeUrl;
  if (source.recruitmentUrl) return source.recruitmentUrl;
  if (source.baseUrl) return source.baseUrl;
  if (source.rssUrl) return source.rssUrl;
  return null;
}

/**
 * Manually check a registered government source for website change.
 * Callable only — no scheduler, no worker, no routes.
 *
 * @param {object} [input]
 * @param {string} input.sourceId
 * @param {string|object} [input.previousFingerprint]
 * @param {object} [input.previousMetadata]
 * @param {string} [input.url] Override URL
 * @param {Function} [input.transport] Injectable HTTP transport (tests)
 * @param {object} [input.sourceRegistry] MB-1 registry override
 * @param {object} [input.monitoringConfiguration] MB-1 config override
 * @param {object} [input.crawlPolicy] MB-1 crawl policy override
 */
async function detectWebsiteChange(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const timestamp =
    typeof src.timestamp === 'string' && src.timestamp.trim()
      ? src.timestamp.trim()
      : new Date().toISOString();

  const sourceId =
    typeof src.sourceId === 'string' && src.sourceId.trim()
      ? src.sourceId.trim()
      : null;

  const sourceRegistry =
    src.sourceRegistry || getDefaultGovernmentSourceRegistry();
  const monitoringConfiguration =
    src.monitoringConfiguration ||
    createMonitoringConfigurationMap({ sources: sourceRegistry.sources });

  const source = sourceId ? getGovernmentSource(sourceRegistry, sourceId) : null;
  const monitoringConfig = sourceId
    ? getSourceMonitoringConfiguration(monitoringConfiguration, sourceId)
    : null;

  const crawlPolicy =
    src.crawlPolicy ||
    (sourceId &&
      src.crawlPolicyMap &&
      src.crawlPolicyMap.bySourceId &&
      src.crawlPolicyMap.bySourceId[sourceId]) ||
    getDefaultCrawlPolicy();

  const diagCtx = {
    sourceId,
    sourceNotFound: !source,
    sourceInactive: !!(source && source.active === false),
    monitoringDisabled: !!(
      monitoringConfig && monitoringConfig.monitoringEnabled === false
    ),
  };

  if (!sourceId || !source) {
    const diagnostics = generateDetectionDiagnostics(diagCtx);
    return createDetectionResult({
      sourceId,
      detectionStatus: DETECTION_RESULT_STATUSES.SKIPPED,
      fingerprint: null,
      previousFingerprint: fingerprintValue(src.previousFingerprint),
      metadata: null,
      diagnostics,
      classification: null,
      confidence: 0,
      timestamp,
      fetchUrl: null,
      expectedContentType: monitoringConfig
        ? monitoringConfig.expectedContentType
        : null,
    });
  }

  // Operational safety: inactive / monitoring-disabled sources do not fetch
  // unless explicitly forced for controlled diagnostics.
  if (
    (diagCtx.sourceInactive || diagCtx.monitoringDisabled) &&
    src.forceFetchInactive !== true
  ) {
    const diagnostics = generateDetectionDiagnostics(diagCtx);
    return createDetectionResult({
      sourceId,
      detectionStatus: DETECTION_RESULT_STATUSES.SKIPPED,
      fingerprint: null,
      previousFingerprint: fingerprintValue(src.previousFingerprint),
      metadata: null,
      diagnostics,
      classification: null,
      confidence: 0,
      timestamp,
      fetchUrl: null,
      expectedContentType: monitoringConfig
        ? monitoringConfig.expectedContentType
        : null,
    });
  }

  const fetchUrl = resolveFetchUrl(source, src);
  if (!fetchUrl) {
    diagCtx.invalidUrl = true;
    diagCtx.url = fetchUrl;
    const diagnostics = generateDetectionDiagnostics(diagCtx);
    return createDetectionResult({
      sourceId,
      detectionStatus: DETECTION_RESULT_STATUSES.FETCH_FAILED,
      fingerprint: null,
      previousFingerprint: fingerprintValue(src.previousFingerprint),
      metadata: null,
      diagnostics,
      classification: null,
      confidence: 0,
      timestamp,
      fetchUrl: null,
      expectedContentType: monitoringConfig
        ? monitoringConfig.expectedContentType
        : null,
    });
  }

  const fetchResult = await fetchSource({
    url: fetchUrl,
    headers: src.headers,
    userAgent: src.userAgent,
    timeoutMs: src.timeoutMs,
    maximumRedirects: src.maximumRedirects,
    crawlPolicy,
    transport: src.transport,
    fetchTimestamp: timestamp,
  });

  diagCtx.timeout = fetchResult.timeout === true;
  diagCtx.timeoutMs = fetchResult.options && fetchResult.options.timeoutMs;
  diagCtx.redirectLoop = fetchResult.redirectLoop === true;
  diagCtx.redirectCount = fetchResult.redirectCount;
  diagCtx.maximumRedirects =
    fetchResult.options && fetchResult.options.maximumRedirects;
  diagCtx.networkError = fetchResult.networkError === true;
  diagCtx.networkErrorMessage =
    fetchResult.error && fetchResult.error.message
      ? fetchResult.error.message
      : null;
  diagCtx.fetchFailed = fetchResult.success !== true;
  diagCtx.fetchFailureReason =
    fetchResult.error && fetchResult.error.message
      ? fetchResult.error.message
      : null;
  diagCtx.httpStatus =
    fetchResult.metadata && fetchResult.metadata.httpStatus;
  diagCtx.httpErrorStatus =
    typeof diagCtx.httpStatus === 'number' && diagCtx.httpStatus >= 400;
  diagCtx.fetchSuccessful = fetchResult.success === true;
  diagCtx.url = fetchUrl;

  if (!fetchResult.success) {
    const diagnostics = generateDetectionDiagnostics(diagCtx);
    return createDetectionResult({
      sourceId,
      detectionStatus: DETECTION_RESULT_STATUSES.FETCH_FAILED,
      fingerprint: null,
      previousFingerprint: fingerprintValue(src.previousFingerprint),
      metadata: fetchResult.metadata,
      diagnostics,
      classification: null,
      confidence: 0,
      timestamp,
      fetchUrl,
      expectedContentType: monitoringConfig
        ? monitoringConfig.expectedContentType
        : null,
    });
  }

  const expectedContentType = monitoringConfig
    ? monitoringConfig.expectedContentType
    : CONTENT_TYPES.HTML;

  const actualContentType =
    fetchResult.metadata && fetchResult.metadata.contentType;
  diagCtx.expectedContentType = expectedContentType;
  diagCtx.actualContentType = actualContentType;
  diagCtx.invalidContentType = !contentTypeMatchesExpected(
    actualContentType,
    expectedContentType
  );

  const fingerprint = generateContentFingerprint({
    body: fetchResult.body,
    contentType: expectedContentType,
    expectedContentType,
    sourceId,
    algorithm: src.fingerprintAlgorithm,
  });

  const previousFingerprintValue = fingerprintValue(src.previousFingerprint);
  diagCtx.missingFingerprint = !previousFingerprintValue;
  diagCtx.firstObservation = !previousFingerprintValue;

  const detection = detectChange({
    sourceId,
    previousFingerprint: src.previousFingerprint,
    currentFingerprint: fingerprint,
    body: fetchResult.body,
    contentType: expectedContentType,
    expectedContentType,
    metadata: fetchResult.metadata,
    previousMetadata: src.previousMetadata,
    previousRawFingerprint: src.previousRawFingerprint,
    previousNormalizedFingerprint: src.previousNormalizedFingerprint,
    algorithm: fingerprint.algorithm,
  });

  diagCtx.hashMismatch = detection.hashMismatch === true;
  diagCtx.previousFingerprint = previousFingerprintValue;
  diagCtx.currentFingerprint = fingerprint.fingerprint;
  diagCtx.changeDetected = detection.detectionStatus === DETECTION_STATUS.CHANGED;
  diagCtx.noChangeDetected =
    detection.detectionStatus === DETECTION_STATUS.NO_CHANGE;
  diagCtx.classification =
    detection.classification && detection.classification.classification;

  const diagnostics = generateDetectionDiagnostics(diagCtx);

  return createDetectionResult({
    sourceId,
    detectionStatus: detection.detectionStatus,
    fingerprint,
    previousFingerprint: previousFingerprintValue,
    metadata: fetchResult.metadata,
    diagnostics,
    classification: detection.classification,
    confidence: detection.confidence,
    confidenceMetadata: detection.confidenceMetadata,
    timestamp,
    fetchUrl,
    expectedContentType,
  });
}

/**
 * Synchronous fingerprint/compare helper (no network).
 * Useful for unit tests and offline comparison.
 */
function compareFingerprints(input = {}) {
  return detectChange(input);
}

function getWebsiteChangeDetectionFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getWebsiteChangeDetectionFramework() {
  const mb1 = getGovernmentSourceRegistryFramework();

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    extensionPoints: EXTENSION_POINTS,

    packageMB1PrerequisiteComplete: true,
    packageMB1Unchanged: true,
    packageMB2Complete: true,
    packageMB3Ready: true,
    packageMB3Activated: false,

    mb1Identity: {
      packageCode: mb1.packageCode,
      packageMB1Complete: mb1.packageMB1Complete,
      packageMB2Activated: mb1.packageMB2Activated,
    },

    safetyBoundaries: {
      recruitmentExtractionDenied: true,
      htmlParsingForExtractionDenied: true,
      pdfParsingForExtractionDenied: true,
      candidateCreationDenied: true,
      reviewQueueDenied: true,
      telegramDenied: true,
      publishingDenied: true,
      databasePersistenceDenied: true,
      redisDenied: true,
      schedulerDenied: true,
      cronDenied: true,
      workersDenied: true,
      automaticRetriesDenied: true,
      expressRoutesDenied: true,
      sqlSchemaChangesDenied: true,
      githubDeploymentDenied: true,
      vpsDeploymentDenied: true,
      runtimeActivationDenied: true,
      productionWiringDenied: true,
      backgroundExecutionDenied: true,
      hardDeniedActions: [
        'DENIED_RECRUITMENT_EXTRACTION',
        'DENIED_CANDIDATE_CREATION',
        'DENIED_REVIEW_QUEUE',
        'DENIED_TELEGRAM',
        'DENIED_PUBLISHING',
        'DENIED_DATABASE_PERSISTENCE',
        'DENIED_REDIS',
        'DENIED_SCHEDULER',
        'DENIED_WORKERS',
        'DENIED_AUTOMATIC_RETRIES',
        'DENIED_EXPRESS_ROUTES',
        'DENIED_SQL_SCHEMA_CHANGES',
        'DENIED_DEPLOYMENT',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_MB2',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      recruitmentExtracted: false,
      reviewItemCreated: false,
      telegramSent: false,
      publishingExecuted: false,
      filesystemWritten: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      backgroundWorkerStarted: false,
      automaticRetryEnabled: false,
      // Manual detectWebsiteChange may perform HTTP when explicitly invoked.
      manualHttpAuthorized: true,
      schedulerHttpAuthorized: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_MB2',
      status: 'WEBSITE_CHANGE_DETECTION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a manually invokable Website Change Detection Framework that can determine whether a registered government source changed — without extraction, review, Telegram, or publishing.',
      nextPackage: 'MB-3',
      nextPackageName: 'Recruitment Extraction',
      canDetectChange: true,
      canExtractJobs: false,
      canCreateCandidates: false,
      canNotifyOperators: false,
      canPublish: false,
      runtimeBehaviorChanged: false,
    },

    recommendation:
      'MB2_COMPLETE_MANUAL_CHANGE_DETECTION_ONLY_READY_FOR_MB3_NO_EXTRACTION_NO_REVIEW_NO_TELEGRAM',
  });
}

/**
 * Assemble an MB-2 framework snapshot (configuration + identity).
 * Does not perform HTTP unless detectWebsiteChange is called separately.
 */
function evaluateWebsiteChangeDetectionFramework(input = {}) {
  const mb1Evaluation =
    input.mb1Evaluation ||
    evaluateGovernmentSourceRegistryFramework({
      sources: input.sources,
      sourceRegistry: input.sourceRegistry,
      monitoringConfigurations: input.monitoringConfigurations,
      monitoringConfiguration: input.monitoringConfiguration,
      crawlPolicies: input.crawlPolicies,
      crawlPolicyMap: input.crawlPolicyMap,
    });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,

    mb1Evaluation,
    sourceRegistry: mb1Evaluation.sourceRegistry,
    monitoringConfiguration: mb1Evaluation.monitoringConfiguration,
    crawlPolicyMap: mb1Evaluation.crawlPolicyMap,

    extensionPoints: EXTENSION_POINTS,
    capabilities: CAPABILITIES.slice(),

    effects: {
      recruitmentExtracted: false,
      reviewItemCreated: false,
      telegramSent: false,
      published: false,
      databaseWritten: false,
      redisUsed: false,
      schedulerStarted: false,
      workerStarted: false,
      routeActivated: false,
      sqlSchemaChanged: false,
      deployed: false,
      automaticRetry: false,
    },

    readyForMB3: true,
    mb3Activated: false,
    packageMB1Unchanged: true,
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  STAGE_ID,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,

  SOURCE_FETCH_FRAMEWORK_VERSION,
  DEFAULT_USER_AGENT,
  RESPONSE_METADATA_VERSION,
  CONTENT_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_ALGORITHMS,
  CHANGE_DETECTION_ENGINE_VERSION,
  DETECTION_STATUS,
  CHANGE_CLASSIFICATION_VERSION,
  CHANGE_CLASSES,
  DETECTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  DETECTION_RESULT_MODEL_VERSION,
  DETECTION_RESULT_STATUSES,
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  CONTENT_TYPES,

  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
  createCrawlPolicy,
  createCrawlPolicyMap,
  getDefaultCrawlPolicy,

  resolveFetchOptions,
  fetchSource,
  collectResponseMetadata,
  generateContentFingerprint,
  generateRawSha256Fingerprint,
  normalizeHtmlForFingerprint,
  normalizeXmlForFingerprint,
  detectChange,
  compareFingerprints,
  fingerprintValue,
  classifyDetectedChange,
  generateDetectionDiagnostics,
  createDetectionResult,

  RecruitmentExtractionExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,

  detectWebsiteChange,
  evaluateWebsiteChangeDetectionFramework,
  getWebsiteChangeDetectionFramework,
  getWebsiteChangeDetectionFrameworkIdentity,
};
