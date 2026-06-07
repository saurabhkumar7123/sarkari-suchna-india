"use strict";

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

function renderJobCardsHtml(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="taxonomy-empty">No updates found in this category yet.</p>';
  }

  return items
    .map((item) => {
      const title = escapeHtml(item.title || "Untitled");
      const href = escapeHtml(safeItemHref(item));
      const status = String(item.status || "").trim();
      const statusHtml = status
        ? `<span class="taxonomy-job-status">${escapeHtml(status)}</span>`
        : "";
      return `
        <article class="taxonomy-job-card">
          <h2 class="taxonomy-job-title"><a href="${href}">${title}</a></h2>
          ${statusHtml}
        </article>`;
    })
    .join("");
}

/**
 * Full SSR taxonomy hub page — no client JS, no Finder, no API calls.
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
  const cardsHtml = renderJobCardsHtml(opts.items);

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
<link rel="preload" href="/css/main.min.css?v=2" as="style">
<link rel="stylesheet" href="/css/main.min.css?v=2">
<link rel="stylesheet" href="/css/pages/listing-layout.css?v=2">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
.taxonomy-hub { max-width: 960px; margin: 0 auto; padding: 1.25rem 1rem 2.5rem; }
.taxonomy-hub__intro { margin-bottom: 1.5rem; }
.taxonomy-hub__intro h1 { margin: 0 0 0.5rem; font-size: 1.75rem; line-height: 1.25; }
.taxonomy-hub__intro p { margin: 0; color: #4b5563; }
.taxonomy-job-list { display: grid; gap: 0.75rem; }
.taxonomy-job-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.1rem; background: #fff; }
.taxonomy-job-title { margin: 0 0 0.35rem; font-size: 1.05rem; line-height: 1.35; }
.taxonomy-job-title a { color: #1d4ed8; text-decoration: none; }
.taxonomy-job-title a:hover { text-decoration: underline; }
.taxonomy-job-status { display: inline-block; font-size: 0.8rem; font-weight: 600; color: #374151; background: #f3f4f6; border-radius: 999px; padding: 0.15rem 0.55rem; text-transform: capitalize; }
.taxonomy-empty { margin: 0; padding: 1rem; border: 1px dashed #d1d5db; border-radius: 8px; color: #6b7280; }
</style>
</head>
<body class="listing-page page-section taxonomy-page">
${headerHtml}
<main class="main-container taxonomy-hub">
  <header class="taxonomy-hub__intro" aria-label="Category">
    <h1>${escapeHtml(h1)}</h1>
    <p>${escapeHtml(sub)}</p>
  </header>
  <section class="taxonomy-job-list" aria-label="Job updates">
    ${cardsHtml}
  </section>
</main>
${footerHtml}
</body>
</html>`;
}

module.exports = {
  renderTaxonomySSRPage,
  escapeHtml,
  safeItemHref,
  renderJobCardsHtml
};
