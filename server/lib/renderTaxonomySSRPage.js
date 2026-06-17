"use strict";

const { renderBreadcrumbHtml } = require("./breadcrumb");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeItemHref(item) {
  if (!item || typeof item !== "object") return "#";
  const rawUrl = item.url != null ? String(item.url).trim() : "";
  const rawSlug = item.slug != null ? String(item.slug).trim() : "";
  if (rawUrl && rawUrl !== "undefined" && rawUrl !== "null" && rawUrl !== "#") return rawUrl;
  if (rawSlug && rawSlug !== "undefined" && rawSlug !== "null") {
    return `/${rawSlug.replace(/^\/+/, "")}`;
  }
  return "#";
}

function renderJobListHtml(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="listing-empty">No updates found in this category yet.</p>';
  }

  const rows = items
    .map((item) => {
      const title = escapeHtml(item.title || "Untitled");
      const href = escapeHtml(safeItemHref(item));
      return `<li><a href="${href}">${title}</a></li>`;
    })
    .join("");

  return `
    <div class="cards card-grid taxonomy-hub__cards">
      <div class="card">
        <div class="card-content">
          <ul class="job-list">${rows}</ul>
        </div>
      </div>
    </div>`;
}

/**
 * Full SSR taxonomy hub page — shared site chrome scripts for header/search/footer.
 * @param {{
 *   title: string,
 *   description: string,
 *   h1: string,
 *   sub?: string,
 *   canonicalPath: string,
 *   baseUrl?: string,
 *   headerHtml?: string,
 *   footerHtml?: string,
 *   items: Array<{ title: string, slug?: string, url?: string, status?: string }>
 * }} opts
 */
function renderTaxonomySSRPage(opts) {
  const title = String(opts.title || "Government Jobs | Sarkari Suchna India");
  const description = String(opts.description || "");
  const h1 = String(opts.h1 || title);
  const sub = String(opts.sub || description);
  const canonicalPath = String(opts.canonicalPath || "/");
  const baseUrl = String(opts.baseUrl || "").replace(/\/$/, "");
  const absoluteUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
  const headerHtml = String(opts.headerHtml || "");
  const footerHtml = String(opts.footerHtml || "");
  const breadcrumbHtml = renderBreadcrumbHtml(h1);
  const listHtml = renderJobListHtml(opts.items);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(absoluteUrl)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(absoluteUrl)}">
<meta property="og:image" content="/assets/image/logo/favicon.png">
<meta name="robots" content="index, follow">
<link rel="preload" href="/css/main.min.css?v=5" as="style">
<link rel="stylesheet" href="/css/main.min.css?v=5">
<link rel="stylesheet" href="/css/pages/listing-layout.css?v=2">
<link rel="stylesheet" href="/css/components/breadcrumb.css?v=3">
<link rel="stylesheet" href="/css/pages/home.css?v=5">
<link rel="stylesheet" href="/css/pages/taxonomy-hub.css?v=2">
<link rel="stylesheet" href="/css/components/search-overlay.css?v=2">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="listing-page page-section taxonomy-page">
${headerHtml}
<div class="main-container taxonomy-hub">
  ${breadcrumbHtml}
  <header class="listing-hero taxonomy-hub__hero" aria-label="Category">
    <h1>${escapeHtml(h1)}</h1>
    <p>${escapeHtml(sub)}</p>
  </header>
  <section class="taxonomy-hub__list" aria-label="Job updates">
    ${listHtml}
  </section>
</div>
${footerHtml}
<script src="/js/search.js" defer></script>
<script src="/js/header.js" defer></script>
<script src="/js/footer.js" defer></script>
</body>
</html>`;
}

module.exports = {
  renderTaxonomySSRPage,
  escapeHtml,
  safeItemHref,
  renderJobListHtml
};
