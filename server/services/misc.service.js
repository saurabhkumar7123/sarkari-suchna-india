const pageRepository = require("../repositories/page.repository");
const { parseBadges } = require("./page.service");
const { getRelatedPagesForSlug } = require("./relatedPages.service");
const {
  buildHomepageSectionDefs,
  isPredefinedSectionStatus
} = require("../lib/homeSectionOrder");
const { formatEventTimeForClient } = require("../lib/eventTimeFormat");

function mapCountdownEventRow(p) {
  return {
    title: p.title,
    url: "/" + p.slug,
    slug: p.slug,
    status: (p.status || "").toLowerCase(),
    eventTime: formatEventTimeForClient(p.eventTime),
    date: p.date
  };
}

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
    eventTime: formatEventTimeForClient(p.eventTime),
    date: p.date
  }));
}

async function getCountdownEvents() {
  const rows = await pageRepository.selectUpcomingCountdownPages();
  return rows.map(mapCountdownEventRow).filter((row) => row.eventTime);
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
  getCountdownEvents,
  getPagesByTag,
  getSitemapRows,
  getRelatedPages,
  getHomepageSections
};
