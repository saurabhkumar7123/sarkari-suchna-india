const pageRepository = require("../repositories/page.repository");
const { parseBadges } = require("./page.service");
const { getRelatedPagesForSlug } = require("./relatedPages.service");

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
  const predefined = [
    { key: "new-form", label: "new form", href: "/new-form" },
    { key: "result", label: "result", href: "/result" },
    { key: "admit-card", label: "admit card", href: "/admit-card" },
    { key: "answer-key", label: "answer key", href: "/answer-key" },
    { key: "syllabus", label: "syllabus", href: "/syllabus" },
    { key: "admission", label: "admission", href: "/admission" },
    { key: "document", label: "document", href: "/document" }
  ];

  const rows = await pageRepository.selectDistinctStatuses();

  const predefinedStatusSet = new Set(predefined.map((s) => s.label));
  const customStatuses = rows
    .map((r) => String(r.status || "").trim().toLowerCase())
    .filter((s) => s && !predefinedStatusSet.has(s))
    .sort((a, b) => a.localeCompare(b));

  return [
    ...predefined.map((s) => ({
      section: s.key,
      ribbonStatus: s.label,
      href: s.href,
      queryMode: "section",
      queryValue: s.key
    })),
    ...customStatuses.map((status) => ({
      section: `custom:${status}`,
      ribbonStatus: status,
      href: `/result?status=${encodeURIComponent(status)}`,
      queryMode: "status",
      queryValue: status
    }))
  ];
}

module.exports = {
  getSmallBoxes,
  getBreakingNews,
  getPagesByTag,
  getSitemapRows,
  getRelatedPages,
  getHomepageSections
};
