'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Registry Validation & Diagnostics (Advisory Only)
 *
 * Validates source registry configuration and generates diagnostics.
 * No remediation. No runtime activation.
 */

const { deepFreeze } = require('./governmentSourceRegistry');
const { validateCrawlPolicyShape } = require('./crawlPolicy');

const REGISTRY_VALIDATION_VERSION = 'MB1.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

const DIAGNOSTIC_CODES = Object.freeze({
  DUPLICATE_SOURCE_ID: 'DUPLICATE_SOURCE_ID',
  INVALID_URL: 'INVALID_URL',
  MISSING_PARSER_ID: 'MISSING_PARSER_ID',
  MISSING_PARSER_REGISTRATION: 'MISSING_PARSER_REGISTRATION',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  INVALID_CRAWL_POLICY: 'INVALID_CRAWL_POLICY',
  INACTIVE_SOURCE_MONITORING_ENABLED: 'INACTIVE_SOURCE_MONITORING_ENABLED',
});

const REQUIRED_SOURCE_FIELDS = Object.freeze([
  'sourceId',
  'displayName',
  'organization',
  'department',
  'category',
  'baseUrl',
  'recruitmentUrl',
  'resultUrl',
  'noticeUrl',
]);

const URL_FIELDS = Object.freeze([
  'baseUrl',
  'recruitmentUrl',
  'resultUrl',
  'noticeUrl',
  'rssUrl',
]);

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function pushDiagnostic(list, diagnostic) {
  list.push({
    diagnosticId: diagnostic.diagnosticId,
    code: diagnostic.code,
    severity: diagnostic.severity,
    sourceId: diagnostic.sourceId || null,
    field: diagnostic.field || null,
    message: diagnostic.message,
    detail: diagnostic.detail || null,
    informationalOnly: true,
    autoRemediation: false,
  });
}

/**
 * Validate government source registry and related configuration maps.
 * Generates diagnostics only — never mutates configuration.
 *
 * @param {object} [input]
 * @param {object} [input.sourceRegistry]
 * @param {object} [input.monitoringConfiguration]
 * @param {object} [input.parserRegistry]
 * @param {object} [input.crawlPolicyMap]
 */
function validateGovernmentSourceRegistry(input = {}) {
  const diagnostics = [];
  const sourceRegistry = input.sourceRegistry || null;
  const monitoringConfiguration = input.monitoringConfiguration || null;
  const parserRegistry = input.parserRegistry || null;
  const crawlPolicyMap = input.crawlPolicyMap || null;

  const sources =
    sourceRegistry && Array.isArray(sourceRegistry.sources)
      ? sourceRegistry.sources
      : [];

  // Duplicate source IDs (check raw config if provided, else registry sources)
  const idCounts = {};
  const rawSources = Array.isArray(input.rawSources) ? input.rawSources : sources;
  for (let i = 0; i < rawSources.length; i += 1) {
    const id =
      rawSources[i] && typeof rawSources[i].sourceId === 'string'
        ? rawSources[i].sourceId.trim()
        : '';
    if (!id) continue;
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
  Object.keys(idCounts)
    .sort()
    .forEach((id) => {
      if (idCounts[id] > 1) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `DUP_${id}`,
          code: DIAGNOSTIC_CODES.DUPLICATE_SOURCE_ID,
          severity: DIAGNOSTIC_SEVERITY.ERROR,
          sourceId: id,
          message: `Duplicate source ID "${id}" appears ${idCounts[id]} times.`,
          detail: { count: idCounts[id] },
        });
      }
    });

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i] || {};
    const sourceId = source.sourceId || `INDEX_${i}`;

    for (let f = 0; f < REQUIRED_SOURCE_FIELDS.length; f += 1) {
      const field = REQUIRED_SOURCE_FIELDS[f];
      const value = source[field];
      if (typeof value !== 'string' || !value.trim()) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `${sourceId}_MISSING_${field}`,
          code: DIAGNOSTIC_CODES.MISSING_REQUIRED_FIELD,
          severity: DIAGNOSTIC_SEVERITY.ERROR,
          sourceId,
          field,
          message: `Source "${sourceId}" is missing required field "${field}".`,
        });
      }
    }

    for (let u = 0; u < URL_FIELDS.length; u += 1) {
      const field = URL_FIELDS[u];
      const value = source[field];
      if (field === 'rssUrl' && (value == null || value === '')) {
        continue;
      }
      if (!isValidHttpUrl(value)) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `${sourceId}_INVALID_URL_${field}`,
          code: DIAGNOSTIC_CODES.INVALID_URL,
          severity:
            field === 'rssUrl'
              ? DIAGNOSTIC_SEVERITY.WARNING
              : DIAGNOSTIC_SEVERITY.ERROR,
          sourceId,
          field,
          message: `Source "${sourceId}" has invalid ${field}: ${value == null ? '(empty)' : value}`,
        });
      }
    }

    const monCfg =
      monitoringConfiguration &&
      monitoringConfiguration.bySourceId &&
      monitoringConfiguration.bySourceId[sourceId]
        ? monitoringConfiguration.bySourceId[sourceId]
        : null;

    if (monCfg) {
      if (!monCfg.parserId || !String(monCfg.parserId).trim()) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `${sourceId}_MISSING_PARSER_ID`,
          code: DIAGNOSTIC_CODES.MISSING_PARSER_ID,
          severity: DIAGNOSTIC_SEVERITY.ERROR,
          sourceId,
          field: 'parserId',
          message: `Source "${sourceId}" monitoring configuration is missing parserId.`,
        });
      } else if (
        parserRegistry &&
        parserRegistry.byId &&
        !parserRegistry.byId[monCfg.parserId]
      ) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `${sourceId}_MISSING_PARSER_REG_${monCfg.parserId}`,
          code: DIAGNOSTIC_CODES.MISSING_PARSER_REGISTRATION,
          severity: DIAGNOSTIC_SEVERITY.ERROR,
          sourceId,
          field: 'parserId',
          message: `Source "${sourceId}" references unregistered parser "${monCfg.parserId}".`,
          detail: { parserId: monCfg.parserId },
        });
      }

      if (
        source.active === false &&
        monCfg.monitoringEnabled === true
      ) {
        pushDiagnostic(diagnostics, {
          diagnosticId: `${sourceId}_INACTIVE_BUT_ENABLED`,
          code: DIAGNOSTIC_CODES.INACTIVE_SOURCE_MONITORING_ENABLED,
          severity: DIAGNOSTIC_SEVERITY.WARNING,
          sourceId,
          message: `Source "${sourceId}" is inactive but monitoring is enabled.`,
        });
      }
    } else if (monitoringConfiguration) {
      pushDiagnostic(diagnostics, {
        diagnosticId: `${sourceId}_MISSING_MON_CFG`,
        code: DIAGNOSTIC_CODES.MISSING_REQUIRED_FIELD,
        severity: DIAGNOSTIC_SEVERITY.WARNING,
        sourceId,
        field: 'monitoringConfiguration',
        message: `Source "${sourceId}" has no monitoring configuration entry.`,
      });
    }

    if (crawlPolicyMap && crawlPolicyMap.bySourceId) {
      const policy = crawlPolicyMap.bySourceId[sourceId];
      if (policy) {
        const policyValidation = validateCrawlPolicyShape(policy);
        if (!policyValidation.valid) {
          for (let p = 0; p < policyValidation.issues.length; p += 1) {
            const issue = policyValidation.issues[p];
            pushDiagnostic(diagnostics, {
              diagnosticId: `${sourceId}_CRAWL_${issue.code}`,
              code: DIAGNOSTIC_CODES.INVALID_CRAWL_POLICY,
              severity: DIAGNOSTIC_SEVERITY.ERROR,
              sourceId,
              message: `Source "${sourceId}" crawl policy issue: ${issue.message}`,
              detail: issue,
            });
          }
        }
      }
    }
  }

  // Stable deterministic order
  diagnostics.sort((a, b) => {
    const byCode = String(a.code).localeCompare(String(b.code));
    if (byCode !== 0) return byCode;
    const bySource = String(a.sourceId || '').localeCompare(String(b.sourceId || ''));
    if (bySource !== 0) return bySource;
    return String(a.diagnosticId).localeCompare(String(b.diagnosticId));
  });

  const errorCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.ERROR
  ).length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.WARNING
  ).length;
  const infoCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.INFO
  ).length;

  return deepFreeze({
    validationVersion: REGISTRY_VALIDATION_VERSION,
    advisoryOnly: true,
    informationalOnly: true,
    autoRemediation: false,
    valid: errorCount === 0,
    diagnosticCount: diagnostics.length,
    errorCount,
    warningCount,
    infoCount,
    diagnostics,
    codes: { ...DIAGNOSTIC_CODES },
    severities: { ...DIAGNOSTIC_SEVERITY },
  });
}

/**
 * Generate registry diagnostics summary (alias-friendly).
 */
function generateRegistryDiagnostics(input = {}) {
  return validateGovernmentSourceRegistry(input);
}

module.exports = {
  REGISTRY_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  REQUIRED_SOURCE_FIELDS,
  URL_FIELDS,
  isValidHttpUrl,
  validateGovernmentSourceRegistry,
  generateRegistryDiagnostics,
};
