/**
 * Legacy entry: always rebuild through the canonical pipeline so placeholders
 * ({{POST_NAME}}, {{TOTAL_POSTS}}, etc.) are never written raw to disk.
 */
const pipeline = require("../pipeline/generatePage");

async function generateHTML(data) {
  const slug = String(data.slug || "").trim();
  if (!slug) throw new Error("htmlGenerator: slug required");

  const html = await pipeline.buildJobHtml({
    title: data.title || "",
    text: data.text || "",
    slug,
    category: data.category || "general",
    normalizedStatus: data.normalizedStatus || data.status || "general",
    postName: data.postName ?? data.post_name ?? null,
    totalPosts: data.totalPosts ?? data.total_posts ?? null,
    advertisementNo: data.advertisementNo ?? data.advertisement_no ?? null
  });

  await pipeline.writeJobHtmlFile(slug, html);
}

module.exports = generateHTML;
