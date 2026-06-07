"use strict";

const BOOTSTRAP_VERSION = 1;

/**
 * @param {{
 *   breakingNews: unknown[],
 *   smallBoxes: unknown[],
 *   trendingJobs: unknown[],
 *   sectionDefs: unknown[],
 *   sectionResults: { def: object, payload: object | null }[],
 *   popularBoards?: { slug: string, label: string, href: string, count: number }[]
 * }} input
 */
function buildHomeBootstrap(input) {
  const {
    breakingNews = [],
    smallBoxes = [],
    trendingJobs = [],
    sectionDefs = [],
    sectionResults = [],
    popularBoards = []
  } = input || {};

  return {
    v: BOOTSTRAP_VERSION,
    generatedAt: new Date().toISOString(),
    breakingNews: Array.isArray(breakingNews) ? breakingNews : [],
    smallBoxes: Array.isArray(smallBoxes) ? smallBoxes : [],
    sections: Array.isArray(sectionDefs) ? sectionDefs : [],
    sectionPages: Array.isArray(sectionResults) ? sectionResults : [],
    popularBoards: Array.isArray(popularBoards) ? popularBoards : [],
    trending: {
      success: true,
      data: Array.isArray(trendingJobs) ? trendingJobs : []
    }
  };
}

/**
 * Prevent script-breakout from user content in JSON.
 * @param {unknown} obj
 */
function serializeHomeBootstrapForHtml(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/**
 * @param {ReturnType<typeof buildHomeBootstrap>} bootstrap
 */
function buildHomeBootstrapScriptTag(bootstrap) {
  const json = serializeHomeBootstrapForHtml(bootstrap);
  return `<script type="application/json" id="home-bootstrap" data-home-bootstrap-v="${BOOTSTRAP_VERSION}">${json}</script>`;
}

module.exports = {
  BOOTSTRAP_VERSION,
  buildHomeBootstrap,
  serializeHomeBootstrapForHtml,
  buildHomeBootstrapScriptTag
};
