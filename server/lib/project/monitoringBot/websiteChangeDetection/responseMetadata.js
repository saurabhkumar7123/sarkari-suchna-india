'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Response Metadata Collection (Advisory Runtime Objects Only)
 *
 * Collects fetch metadata. No database writes.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const RESPONSE_METADATA_VERSION = 'MB2.1.0.0';

function asHeaderMap(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    if (value == null) return;
    out[String(key).toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : String(value);
  });
  return out;
}

function pickHeader(headerMap, name) {
  if (!headerMap || typeof headerMap !== 'object') return null;
  const value = headerMap[String(name).toLowerCase()];
  return value == null || value === '' ? null : String(value);
}

function parseContentLength(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Collect advisory response metadata from a fetch outcome.
 * @param {object} [input]
 */
function collectResponseMetadata(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const headerMap = asHeaderMap(src.headers || src.responseHeaders);

  const bodyLength =
    typeof src.bodyLength === 'number' && Number.isFinite(src.bodyLength)
      ? Math.floor(src.bodyLength)
      : Buffer.isBuffer(src.body)
        ? src.body.length
        : typeof src.body === 'string'
          ? Buffer.byteLength(src.body, 'utf8')
          : null;

  const headerContentLength = parseContentLength(
    pickHeader(headerMap, 'content-length')
  );

  const fetchTimestamp =
    typeof src.fetchTimestamp === 'string' && src.fetchTimestamp.trim()
      ? src.fetchTimestamp.trim()
      : typeof src.timestamp === 'string' && src.timestamp.trim()
        ? src.timestamp.trim()
        : new Date().toISOString();

  const responseTimeMs =
    typeof src.responseTimeMs === 'number' && Number.isFinite(src.responseTimeMs)
      ? Math.max(0, Math.floor(src.responseTimeMs))
      : null;

  return deepFreeze({
    metadataVersion: RESPONSE_METADATA_VERSION,
    advisoryOnly: true,
    runtimeObjectOnly: true,
    databaseWriteDenied: true,
    persistenceDenied: true,

    httpStatus:
      typeof src.httpStatus === 'number' && Number.isFinite(src.httpStatus)
        ? Math.floor(src.httpStatus)
        : typeof src.statusCode === 'number' && Number.isFinite(src.statusCode)
          ? Math.floor(src.statusCode)
          : null,
    responseTimeMs,
    contentType: pickHeader(headerMap, 'content-type'),
    contentLength:
      headerContentLength != null
        ? headerContentLength
        : bodyLength != null
          ? bodyLength
          : null,
    bodyLength,
    lastModified: pickHeader(headerMap, 'last-modified'),
    etag: pickHeader(headerMap, 'etag'),
    fetchTimestamp,
    finalUrl:
      typeof src.finalUrl === 'string' && src.finalUrl.trim()
        ? src.finalUrl.trim()
        : typeof src.url === 'string' && src.url.trim()
          ? src.url.trim()
          : null,
    redirectCount:
      typeof src.redirectCount === 'number' && Number.isFinite(src.redirectCount)
        ? Math.max(0, Math.floor(src.redirectCount))
        : 0,
    headers: deepFreeze({ ...headerMap }),
  });
}

module.exports = {
  RESPONSE_METADATA_VERSION,
  collectResponseMetadata,
  asHeaderMap,
  pickHeader,
};
