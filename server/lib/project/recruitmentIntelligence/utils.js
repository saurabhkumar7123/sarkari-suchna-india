'use strict';

/**
 * AMP-1 Recruitment Intelligence Brain — shared utilities.
 * Pure helpers. No side effects. No I/O.
 */

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

function pickString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeText(value) {
  return pickString(value)
    .toLowerCase()
    .replace(/[^\w\s/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  const raw = pickString(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return normalizeText(raw);
  }
}

function normalizeAdvertisementNo(value) {
  return pickString(value)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([/\\-])\s*/g, '$1')
    .trim();
}

function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter((t) => t.length > 1);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size && !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function stableHash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function uniqueArray(values) {
  const seen = Object.create(null);
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const item = values[i];
    const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
    if (seen[key]) continue;
    seen[key] = true;
    result.push(item);
  }
  return result;
}

function mergeObjects(base, patch) {
  const result = { ...(isPlainObject(base) ? base : {}) };
  if (!isPlainObject(patch)) return result;
  const keys = Object.keys(patch);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const patchValue = patch[key];
    const baseValue = result[key];
    if (Array.isArray(patchValue)) {
      result[key] = uniqueArray([...(Array.isArray(baseValue) ? baseValue : []), ...patchValue]);
    } else if (isPlainObject(patchValue) && isPlainObject(baseValue)) {
      result[key] = mergeObjects(baseValue, patchValue);
    } else if (patchValue != null && patchValue !== '') {
      result[key] = patchValue;
    }
  }
  return result;
}

module.exports = {
  isPlainObject,
  deepFreeze,
  pickString,
  normalizeText,
  normalizeUrl,
  normalizeAdvertisementNo,
  tokenize,
  jaccardSimilarity,
  stableHash,
  uniqueArray,
  mergeObjects,
};
