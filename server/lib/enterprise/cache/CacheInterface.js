"use strict";

/**
 * In-memory cache interface with future Redis compatibility.
 * No caching is enabled in AMP-4A — interface only.
 */

const memoryStore = new Map();

function buildKey(namespace, key) {
  return `${String(namespace)}:${String(key)}`;
}

async function get(namespace, key) {
  const fullKey = buildKey(namespace, key);
  const entry = memoryStore.get(fullKey);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return null;
  }
  return entry.value;
}

async function set(namespace, key, value, ttlSeconds = 0) {
  const fullKey = buildKey(namespace, key);
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(fullKey, { value, expiresAt });
  return true;
}

async function del(namespace, key) {
  return memoryStore.delete(buildKey(namespace, key));
}

async function clearNamespace(namespace) {
  const prefix = `${String(namespace)}:`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

module.exports = {
  get,
  set,
  del,
  clearNamespace
};
