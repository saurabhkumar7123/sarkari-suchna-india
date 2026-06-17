"use strict";

const path = require("path");

const FILESYSTEM_SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i;

function normalizeFilesystemSlug(raw) {
  return String(raw || "")
    .trim()
    .replace(/\.html$/i, "");
}

function isValidFilesystemSlug(slug) {
  const value = String(slug || "").trim();
  if (!value) return false;
  return FILESYSTEM_SLUG_RE.test(value);
}

function isPathInsideRoot(filePath, rootDir) {
  const resolvedRoot = path.resolve(String(rootDir || ""));
  const resolvedFile = path.resolve(String(filePath || ""));
  if (!resolvedRoot || !resolvedFile) return false;
  if (resolvedFile === resolvedRoot) return true;
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolvedFile.startsWith(rootWithSep);
}

function resolveInsideRoot(rootDir, ...segments) {
  const resolvedRoot = path.resolve(String(rootDir || ""));
  if (!resolvedRoot) return null;

  const parts = segments
    .filter((segment) => segment != null && String(segment).length > 0)
    .map((segment) => String(segment));
  if (!parts.length) return null;

  const candidate = path.resolve(resolvedRoot, ...parts);
  if (!isPathInsideRoot(candidate, resolvedRoot)) return null;
  return candidate;
}

module.exports = {
  FILESYSTEM_SLUG_RE,
  normalizeFilesystemSlug,
  isValidFilesystemSlug,
  isPathInsideRoot,
  resolveInsideRoot
};
