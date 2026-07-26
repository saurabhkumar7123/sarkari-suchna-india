'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Detection Diagnostics (Advisory / No Auto-Recovery)
 *
 * Generates diagnostics for fetch and change-detection outcomes.
 * No retries. No automatic recovery.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const DETECTION_DIAGNOSTICS_VERSION = 'MB2.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

const DIAGNOSTIC_CODES = Object.freeze({
  FETCH_SUCCESSFUL: 'FETCH_SUCCESSFUL',
  TIMEOUT: 'TIMEOUT',
  REDIRECT_LOOP: 'REDIRECT_LOOP',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  HASH_MISMATCH: 'HASH_MISMATCH',
  MISSING_FINGERPRINT: 'MISSING_FINGERPRINT',
  FETCH_FAILED: 'FETCH_FAILED',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  SOURCE_INACTIVE: 'SOURCE_INACTIVE',
  MONITORING_DISABLED: 'MONITORING_DISABLED',
  INVALID_URL: 'INVALID_URL',
  NETWORK_ERROR: 'NETWORK_ERROR',
  HTTP_ERROR_STATUS: 'HTTP_ERROR_STATUS',
  FIRST_OBSERVATION: 'FIRST_OBSERVATION',
  NO_CHANGE_DETECTED: 'NO_CHANGE_DETECTED',
  CHANGE_DETECTED: 'CHANGE_DETECTED',
});

function createDiagnostic(code, severity, message, details) {
  return deepFreeze({
    code,
    severity,
    message: typeof message === 'string' ? message : String(code),
    details:
      details && typeof details === 'object' ? { ...details } : undefined,
    advisoryOnly: true,
    autoRecovery: false,
    retryPerformed: false,
  });
}

/**
 * Build an ordered diagnostics list from detection/fetch context.
 * @param {object} [input]
 */
function generateDetectionDiagnostics(input = {}) {
  const diagnostics = [];
  const ctx = input && typeof input === 'object' ? input : {};

  if (ctx.sourceNotFound) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.SOURCE_NOT_FOUND,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Registered source was not found in the MB-1 registry.',
        { sourceId: ctx.sourceId || null }
      )
    );
  }

  if (ctx.sourceInactive) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.SOURCE_INACTIVE,
        DIAGNOSTIC_SEVERITY.WARNING,
        'Source is registered as inactive.',
        { sourceId: ctx.sourceId || null }
      )
    );
  }

  if (ctx.monitoringDisabled) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.MONITORING_DISABLED,
        DIAGNOSTIC_SEVERITY.WARNING,
        'Monitoring is disabled for this source in MB-1 configuration.',
        { sourceId: ctx.sourceId || null }
      )
    );
  }

  if (ctx.invalidUrl) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.INVALID_URL,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Source URL is missing or not a valid HTTP(S) URL.',
        { url: ctx.url || null }
      )
    );
  }

  if (ctx.timeout) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.TIMEOUT,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Fetch timed out before a complete response was received.',
        { timeoutMs: ctx.timeoutMs != null ? ctx.timeoutMs : null }
      )
    );
  }

  if (ctx.redirectLoop) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.REDIRECT_LOOP,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Redirect limit exceeded (redirect loop or too many redirects).',
        {
          redirectCount: ctx.redirectCount != null ? ctx.redirectCount : null,
          maximumRedirects:
            ctx.maximumRedirects != null ? ctx.maximumRedirects : null,
        }
      )
    );
  }

  if (ctx.networkError) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.NETWORK_ERROR,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Network error occurred during fetch.',
        { errorMessage: ctx.networkErrorMessage || null }
      )
    );
  }

  if (ctx.fetchFailed && !ctx.timeout && !ctx.redirectLoop && !ctx.networkError) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.FETCH_FAILED,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Fetch failed.',
        { reason: ctx.fetchFailureReason || null }
      )
    );
  }

  if (ctx.httpErrorStatus) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.HTTP_ERROR_STATUS,
        DIAGNOSTIC_SEVERITY.WARNING,
        `HTTP response status indicates an error: ${ctx.httpStatus}`,
        { httpStatus: ctx.httpStatus != null ? ctx.httpStatus : null }
      )
    );
  }

  if (ctx.invalidContentType) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.INVALID_CONTENT_TYPE,
        DIAGNOSTIC_SEVERITY.WARNING,
        'Response content type does not match expected monitoring content type.',
        {
          expectedContentType: ctx.expectedContentType || null,
          actualContentType: ctx.actualContentType || null,
        }
      )
    );
  }

  if (ctx.fetchSuccessful) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.FETCH_SUCCESSFUL,
        DIAGNOSTIC_SEVERITY.INFO,
        'Fetch completed successfully.',
        { httpStatus: ctx.httpStatus != null ? ctx.httpStatus : null }
      )
    );
  }

  if (ctx.missingFingerprint) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.MISSING_FINGERPRINT,
        DIAGNOSTIC_SEVERITY.WARNING,
        'Previous fingerprint was not provided; first observation only.',
        { sourceId: ctx.sourceId || null }
      )
    );
  }

  if (ctx.firstObservation) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.FIRST_OBSERVATION,
        DIAGNOSTIC_SEVERITY.INFO,
        'No previous fingerprint available; treating as first observation.',
        { sourceId: ctx.sourceId || null }
      )
    );
  }

  if (ctx.hashMismatch) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.HASH_MISMATCH,
        DIAGNOSTIC_SEVERITY.INFO,
        'Current fingerprint differs from previous fingerprint.',
        {
          previousFingerprint: ctx.previousFingerprint || null,
          currentFingerprint: ctx.currentFingerprint || null,
        }
      )
    );
  }

  if (ctx.changeDetected) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.CHANGE_DETECTED,
        DIAGNOSTIC_SEVERITY.INFO,
        'Change detection engine reported Changed.',
        { classification: ctx.classification || null }
      )
    );
  }

  if (ctx.noChangeDetected) {
    diagnostics.push(
      createDiagnostic(
        DIAGNOSTIC_CODES.NO_CHANGE_DETECTED,
        DIAGNOSTIC_SEVERITY.INFO,
        'Change detection engine reported No Change.',
        null
      )
    );
  }

  if (Array.isArray(ctx.extraDiagnostics)) {
    for (let i = 0; i < ctx.extraDiagnostics.length; i += 1) {
      const extra = ctx.extraDiagnostics[i];
      if (extra && typeof extra === 'object' && extra.code) {
        diagnostics.push(
          createDiagnostic(
            extra.code,
            extra.severity || DIAGNOSTIC_SEVERITY.INFO,
            extra.message,
            extra.details
          )
        );
      }
    }
  }

  const errorCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.ERROR
  ).length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.WARNING
  ).length;

  return deepFreeze({
    diagnosticsVersion: DETECTION_DIAGNOSTICS_VERSION,
    advisoryOnly: true,
    autoRecovery: false,
    retriesDenied: true,
    diagnosticCount: diagnostics.length,
    errorCount,
    warningCount,
    codes: diagnostics.map((d) => d.code),
    diagnostics,
  });
}

module.exports = {
  DETECTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  createDiagnostic,
  generateDetectionDiagnostics,
};
