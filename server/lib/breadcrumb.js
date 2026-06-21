"use strict";

const BREADCRUMB_HOME_LABEL = "Home";
const BREADCRUMB_CSS_VERSION = 5;
const SITE_HOME_ICON = "🏠";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Standard site breadcrumb: 🏠 Home / [Page Title]
 * @param {string} pageTitle
 * @returns {string}
 */
function renderBreadcrumbHtml(pageTitle) {
  const title = String(pageTitle || "").trim();
  if (!title) return "";

  return `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/" class="breadcrumb__home"><span class="breadcrumb__icon" aria-hidden="true">${SITE_HOME_ICON}</span> ${escapeHtml(BREADCRUMB_HOME_LABEL)}</a><span class="breadcrumb__sep" aria-hidden="true"> / </span><span class="breadcrumb__current" aria-current="page">${escapeHtml(title)}</span></nav>`;
}

/**
 * Upgrade legacy breadcrumbs in saved HTML (Sarkari Suchna India → Home).
 * @param {string} html
 * @returns {string}
 */
function normalizeBreadcrumbInHtml(html) {
  let out = String(html || "");
  if (!out.includes('class="breadcrumb"')) return out;

  const currentMatch = out.match(
    /<span class="breadcrumb__current"[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/span>/i
  ) || out.match(/<span class="breadcrumb__current"[^>]*>([\s\S]*?)<\/span>/i);

  if (!currentMatch) return out;

  const title = decodeHtmlEntities(currentMatch[1]).replace(/<[^>]+>/g, "").trim();
  if (!title) return out;

  const breadcrumb = renderBreadcrumbHtml(title);
  const replaced = out.replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/i, breadcrumb);
  if (replaced === out) return out;

  out = replaced;
  out = out.replace(
    /\/css\/components\/breadcrumb\.css\?v=\d+/g,
    `/css/components/breadcrumb.css?v=${BREADCRUMB_CSS_VERSION}`
  );
  return out;
}

module.exports = {
  BREADCRUMB_HOME_LABEL,
  BREADCRUMB_CSS_VERSION,
  SITE_HOME_ICON,
  escapeHtml,
  decodeHtmlEntities,
  renderBreadcrumbHtml,
  normalizeBreadcrumbInHtml
};
