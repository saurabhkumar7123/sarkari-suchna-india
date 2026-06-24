"use strict";

const pageRepository = require("../repositories/page.repository");
const { isBoardSlug } = require("../lib/boardHubs");
const { formatTopicLabel, normalizeTopicSlug } = require("../lib/topicTags");
const { renderTaxonomySSRPage } = require("../lib/renderTaxonomySSRPage");
const { getFooterHtml } = require("./taxonomyPage.service");

function mapRowToCard(row) {
  return {
    title: row.title || "",
    slug: row.slug || "",
    url: row.slug ? `/${row.slug}` : "#",
    status: String(row.status || "").toLowerCase()
  };
}

/**
 * @param {{ slug: string, baseUrl?: string, headerHtml?: string, footerHtml?: string }} opts
 * @returns {Promise<string|null>}
 */
async function buildTopicPage(opts) {
  const topicSlug = normalizeTopicSlug(opts.slug);
  if (!topicSlug || isBoardSlug(topicSlug)) return null;

  const rows = await pageRepository.selectPublicListByTopicSlug(topicSlug, 50, 0).catch(() => []);
  const label = formatTopicLabel(topicSlug);
  const year = new Date().getFullYear();

  return renderTaxonomySSRPage({
    title: `${label} Government Jobs & Updates ${year} | Sarkari Suchna India`,
    description: `Browse latest ${label} recruitment notifications, exam forms, results and admit card updates on Sarkari Suchna India.`,
    h1: `${label} Updates`,
    sub: `Latest government job updates tagged with ${label}.`,
    canonicalPath: `/topic/${topicSlug}`,
    items: Array.isArray(rows) ? rows.map(mapRowToCard) : [],
    baseUrl: opts.baseUrl || "",
    headerHtml: opts.headerHtml || "",
    footerHtml: opts.footerHtml != null ? opts.footerHtml : getFooterHtml()
  });
}

module.exports = {
  buildTopicPage
};
