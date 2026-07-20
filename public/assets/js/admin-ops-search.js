/**
 * Package 4E — Operational search helpers (client-side).
 * Global search persistence, recent searches, saved filters.
 * No external search engine.
 */
(function () {
  "use strict";

  const RECENT_KEY = "adminOpsRecentSearches.v1";
  const SAVED_KEY = "adminOpsSavedFilters.v1";
  const FILTER_PREFIX = "adminOpsFilter:";
  const MAX_RECENT = 12;
  const MAX_SAVED = 20;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw || "null");
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function rememberSearch(query, context) {
    const q = String(query || "").trim();
    if (!q) return;
    const items = readJson(RECENT_KEY, []);
    const next = [
      { query: q.slice(0, 200), context: String(context || "global"), at: new Date().toISOString() },
      ...items.filter((i) => String(i.query).toLowerCase() !== q.toLowerCase())
    ].slice(0, MAX_RECENT);
    writeJson(RECENT_KEY, next);
  }

  function recentSearches(limit = 8) {
    return readJson(RECENT_KEY, []).slice(0, Math.max(1, limit));
  }

  function persistFilters(surface, filters) {
    const key = FILTER_PREFIX + String(surface || "default");
    writeJson(key, filters && typeof filters === "object" ? filters : {});
  }

  function loadFilters(surface) {
    const key = FILTER_PREFIX + String(surface || "default");
    const value = readJson(key, null);
    return value && typeof value === "object" ? value : null;
  }

  function clearFilters(surface) {
    try {
      localStorage.removeItem(FILTER_PREFIX + String(surface || "default"));
    } catch {
      /* ignore */
    }
  }

  function listSavedFilters(surface) {
    const all = readJson(SAVED_KEY, []);
    const scoped = String(surface || "");
    return (Array.isArray(all) ? all : []).filter((f) => !scoped || f.surface === scoped);
  }

  function saveFilter(name, surface, filters) {
    const label = String(name || "").trim().slice(0, 80);
    if (!label) return null;
    const all = readJson(SAVED_KEY, []);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: label,
      surface: String(surface || "recruitments"),
      filters: filters && typeof filters === "object" ? filters : {},
      savedAt: new Date().toISOString()
    };
    const next = [entry, ...(Array.isArray(all) ? all : []).filter((f) => f.name !== label || f.surface !== entry.surface)].slice(
      0,
      MAX_SAVED
    );
    writeJson(SAVED_KEY, next);
    return entry;
  }

  function deleteSavedFilter(id) {
    const all = readJson(SAVED_KEY, []);
    writeJson(
      SAVED_KEY,
      (Array.isArray(all) ? all : []).filter((f) => f.id !== id)
    );
  }

  window.AdminOpsSearch = {
    rememberSearch,
    recentSearches,
    persistFilters,
    loadFilters,
    clearFilters,
    listSavedFilters,
    saveFilter,
    deleteSavedFilter
  };
})();
