"use strict";

const SITE_NAME = "Sarkari Suchna India";
const SITE_HOME_ICON = "🏠";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Standard site breadcrumb: 🏠 Sarkari Suchna India / [Page Title]
 * @param {string} pageTitle
 * @returns {string}
 */
function renderBreadcrumbHtml(pageTitle) {
  const title = String(pageTitle || "").trim();
  if (!title) return "";

  return `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/" class="breadcrumb__brand"><span class="breadcrumb__icon" aria-hidden="true">${SITE_HOME_ICON}</span> ${escapeHtml(SITE_NAME)}</a><span class="breadcrumb__sep" aria-hidden="true"> / </span><span class="breadcrumb__current" aria-current="page">${escapeHtml(title)}</span></nav>`;
}

module.exports = {
  SITE_NAME,
  SITE_HOME_ICON,
  escapeHtml,
  renderBreadcrumbHtml
};
