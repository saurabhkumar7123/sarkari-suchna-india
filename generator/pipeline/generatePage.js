"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  applyTemplatePlaceholders,
  assertJobBannerPlaceholdersResolved,
  buildJobTemplateVariables,
  createSlug
} = require("../../server/utils/templatePlaceholders");
const logger = require("../../server/utils/logger");

const JOBS_DIR = path.join(process.cwd(), "generated", "jobs");
const TEMPLATE_PATH = path.join(__dirname, "../../server/templates/template.html");

/**
 * Build final HTML for a job page (DB + disk). Does not touch the database.
 * @param {{
 *   title: string,
 *   text: string,
 *   slug: string,
 *   category?: string,
 *   normalizedStatus: string,
 *   postName?: string | null,
 *   totalPosts?: string | null,
 *   advertisementNo?: string | null
 * }} input
 * @returns {Promise<string>}
 */
async function buildJobHtml({
  title,
  text,
  slug,
  category,
  normalizedStatus,
  postName = null,
  totalPosts = null,
  advertisementNo = null
}) {
  let template;
  try {
    template = await fs.readFile(TEMPLATE_PATH, "utf8");
  } catch (err) {
    logger.error("generatePage: template read failed", { path: TEMPLATE_PATH, message: err.message });
    const e = new Error("TEMPLATE_READ_FAILED");
    e.cause = err;
    throw e;
  }

  const variables = buildJobTemplateVariables({
    title,
    text,
    slug,
    category,
    normalizedStatus,
    postName,
    totalPosts,
    advertisementNo
  });

  const html = applyTemplatePlaceholders(template, variables);
  assertJobBannerPlaceholdersResolved(html);
  console.log("FINAL HTML HAS PLACEHOLDER:", html.includes("{{POST_NAME}}"));
  return html;
}

/**
 * Write HTML to generated/jobs/{slug}.html
 * @param {string} slug
 * @param {string} html
 */
async function writeJobHtmlFile(slug, html) {
  try {
    await fs.mkdir(JOBS_DIR, { recursive: true });
    const filePath = path.join(JOBS_DIR, `${slug}.html`);
    await fs.writeFile(filePath, html, "utf8");
  } catch (err) {
    logger.error("generatePage: write job HTML failed", { slug, message: err.message });
    const e = new Error("JOB_HTML_WRITE_FAILED");
    e.cause = err;
    throw e;
  }
}

/**
 * Remove old file when slug changes after update.
 */
async function removeOldJobFile(oldSlug, newSlug) {
  if (!oldSlug || oldSlug === newSlug) return;
  try {
    await fs.unlink(path.join(JOBS_DIR, `${oldSlug}.html`));
  } catch {
    // ignore missing file
  }
}

module.exports = {
  buildJobHtml,
  writeJobHtmlFile,
  removeOldJobFile,
  createSlug,
  JOBS_DIR,
  applyTemplatePlaceholders,
  buildJobTemplateVariables
};
