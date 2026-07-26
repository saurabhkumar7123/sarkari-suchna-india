'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Content Fingerprint Engine (Deterministic)
 *
 * Generates reproducible fingerprints for change detection.
 * Supports SHA-256, normalized HTML, PDF binary, and RSS/XML hashes.
 *
 * Normalization is for fingerprinting only — not recruitment extraction
 * and not document parsing for content fields.
 */

const crypto = require('crypto');
const { deepFreeze } = require('../governmentSourceRegistry');
const { CONTENT_TYPES } = require('../monitoringConfiguration');

const CONTENT_FINGERPRINT_ENGINE_VERSION = 'MB2.1.0.0';

const FINGERPRINT_ALGORITHMS = Object.freeze({
  SHA256: 'SHA-256',
  NORMALIZED_HTML: 'NORMALIZED_HTML_SHA-256',
  PDF_BINARY: 'PDF_BINARY_SHA-256',
  RSS_XML: 'RSS_XML_SHA-256',
});

function toBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body == null) return Buffer.alloc(0);
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body instanceof Uint8Array) return Buffer.from(body);
  return Buffer.from(String(body), 'utf8');
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normalize HTML for fingerprint reproducibility.
 * Strips comments/scripts/styles and collapses whitespace.
 * Does not extract recruitment fields.
 */
function normalizeHtmlForFingerprint(htmlText) {
  let text = String(htmlText);
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/>\s+</g, '><');
  text = text.replace(/>\s+/g, '>');
  text = text.replace(/\s+</g, '<');
  text = text.replace(/[ \t\f\v]+/g, ' ');
  text = text.replace(/\n+/g, '\n');
  text = text.trim().toLowerCase();
  return text;
}

/**
 * Normalize RSS/XML text for fingerprint reproducibility.
 * Collapses insignificant whitespace between tags. No feed parsing.
 */
function normalizeXmlForFingerprint(xmlText) {
  let text = String(xmlText);
  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/>\s+</g, '><');
  text = text.replace(/[ \t\f\v]+/g, ' ');
  text = text.trim();
  return text;
}

function resolveFingerprintAlgorithm(contentType, override) {
  if (
    typeof override === 'string' &&
    Object.values(FINGERPRINT_ALGORITHMS).includes(override)
  ) {
    return override;
  }

  const type =
    typeof contentType === 'string' ? contentType.trim().toUpperCase() : '';

  if (type === CONTENT_TYPES.PDF || type === 'APPLICATION/PDF') {
    return FINGERPRINT_ALGORITHMS.PDF_BINARY;
  }
  if (
    type === CONTENT_TYPES.RSS ||
    type === CONTENT_TYPES.XML ||
    type.includes('XML') ||
    type.includes('RSS') ||
    type.includes('ATOM')
  ) {
    return FINGERPRINT_ALGORITHMS.RSS_XML;
  }
  if (
    type === CONTENT_TYPES.HTML ||
    type.includes('HTML') ||
    type.includes('TEXT/HTML')
  ) {
    return FINGERPRINT_ALGORITHMS.NORMALIZED_HTML;
  }
  return FINGERPRINT_ALGORITHMS.SHA256;
}

/**
 * Generate a deterministic content fingerprint.
 * @param {object} [input]
 * @param {Buffer|string} [input.body]
 * @param {string} [input.contentType] Monitoring content type or MIME
 * @param {string} [input.algorithm] Optional algorithm override
 * @param {string} [input.sourceId]
 */
function generateContentFingerprint(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const body = toBuffer(src.body);
  const algorithm = resolveFingerprintAlgorithm(
    src.contentType || src.expectedContentType,
    src.algorithm
  );

  let hashInput = body;
  let normalized = false;

  if (algorithm === FINGERPRINT_ALGORITHMS.NORMALIZED_HTML) {
    const normalizedText = normalizeHtmlForFingerprint(body.toString('utf8'));
    hashInput = Buffer.from(normalizedText, 'utf8');
    normalized = true;
  } else if (algorithm === FINGERPRINT_ALGORITHMS.RSS_XML) {
    const normalizedText = normalizeXmlForFingerprint(body.toString('utf8'));
    hashInput = Buffer.from(normalizedText, 'utf8');
    normalized = true;
  } else if (algorithm === FINGERPRINT_ALGORITHMS.PDF_BINARY) {
    hashInput = body;
    normalized = false;
  } else {
    hashInput = body;
    normalized = false;
  }

  const hash = sha256Hex(hashInput);

  return deepFreeze({
    fingerprintEngineVersion: CONTENT_FINGERPRINT_ENGINE_VERSION,
    deterministic: true,
    reproducible: true,
    algorithm,
    hashAlgorithm: 'SHA-256',
    hash,
    fingerprint: `${algorithm}:${hash}`,
    byteLength: body.length,
    normalizedByteLength: hashInput.length,
    normalized,
    sourceId:
      typeof src.sourceId === 'string' && src.sourceId.trim()
        ? src.sourceId.trim()
        : null,
    contentType:
      typeof src.contentType === 'string' && src.contentType.trim()
        ? src.contentType.trim()
        : typeof src.expectedContentType === 'string'
          ? src.expectedContentType
          : null,
    extractionPerformed: false,
    parsingPerformed: false,
  });
}

/**
 * Generate raw SHA-256 hash of body bytes (always, regardless of type).
 */
function generateRawSha256Fingerprint(body, sourceId) {
  return generateContentFingerprint({
    body,
    algorithm: FINGERPRINT_ALGORITHMS.SHA256,
    sourceId,
    contentType: null,
  });
}

module.exports = {
  CONTENT_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_ALGORITHMS,
  toBuffer,
  sha256Hex,
  normalizeHtmlForFingerprint,
  normalizeXmlForFingerprint,
  resolveFingerprintAlgorithm,
  generateContentFingerprint,
  generateRawSha256Fingerprint,
};
