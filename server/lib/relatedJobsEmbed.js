"use strict";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} sourceSlug
 * @param {{ title: string, slug: string }[]} items
 */
function renderRelatedJobsSectionHtml(sourceSlug, items) {
  if (!Array.isArray(items) || !items.length) return "";
  const from = escapeHtml(String(sourceSlug || "").trim());
  const cards = items
    .map((item) => {
      const slug = String(item.slug || "").trim();
      const href = slug ? `/${encodeURIComponent(slug)}` : "#";
      const title = escapeHtml(item.title || slug);
      return `<div class="related-card"><a href="${href}" data-related-to="${escapeHtml(slug)}">${title}</a></div>`;
    })
    .join("");

  return `
<div class="related-section" data-related-embedded="1" data-related-from="${from}">
<div class="related-header">
<h2>Related Jobs</h2>
</div>
<div class="related-grid">
${cards}
</div>
</div>`;
}

/**
 * Embed related jobs into generated job HTML (publish-time / restore-time).
 * @param {string} html
 * @param {string} sourceSlug
 * @param {{ title: string, slug: string }[]} items
 */
function embedRelatedJobsInJobHtml(html, sourceSlug, items) {
  const block = renderRelatedJobsSectionHtml(sourceSlug, items);
  if (!block || !String(html || "").includes('id="related-posts"')) {
    return html;
  }

  const wrapped = `<div id="related-posts" data-related-embedded="1">${block}</div>`;

  if (/<div id="related-posts"[^>]*data-related-embedded="1"/i.test(html)) {
    return html.replace(/<div id="related-posts"[^>]*>[\s\S]*?<\/div>/i, wrapped);
  }

  if (/<div id="related-posts"><\/div>/i.test(html)) {
    return html.replace(/<div id="related-posts"><\/div>/i, wrapped);
  }

  return html.replace(/<div id="related-posts"[^>]*>\s*<\/div>/i, wrapped);
}

module.exports = {
  renderRelatedJobsSectionHtml,
  embedRelatedJobsInJobHtml
};
