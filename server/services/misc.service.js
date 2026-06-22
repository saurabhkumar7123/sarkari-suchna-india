const pageRepository = require("../repositories/page.repository");
const { parseBadges } = require("./page.service");
const { getRelatedPagesForSlug } = require("./relatedPages.service");
const {
  buildHomepageSectionDefs,
  isPredefinedSectionStatus
} = require("../lib/homeSectionOrder");

async function getSmallBoxes() {
  return pageRepository.selectSmallBoxes();
}

async function getBreakingNews() {
  const rows = await pageRepository.selectBreakingNews();
  return rows.map((p) => ({
    title: p.title,
    url: "/" + p.slug,
    status: (p.status || "").toLowerCase(),
    badges: parseBadges(p.badges),
    eventTime: p.eventTime,
    date: p.date
  }));
}

async function getPagesByTag(tag) {
  return pageRepository.selectByCategory(tag);
}

async function getSitemapRows() {
  return pageRepository.selectAllSlugsPublic();
}

async function getRelatedPages(slug) {
  return getRelatedPagesForSlug(slug, 6);
}

async function getHomepageSections() {
  const rows = await pageRepository.selectDistinctStatuses();

  const customStatuses = rows
    .map((r) => String(r.status || "").trim().toLowerCase())
    .filter((s) => s && !isPredefinedSectionStatus(s));

  return buildHomepageSectionDefs(customStatuses);
}

module.exports = {
  getSmallBoxes,
  getBreakingNews,
  getPagesByTag,
  getSitemapRows,
  getRelatedPages,
  getHomepageSections
};
