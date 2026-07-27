"use strict";

/**
 * Phase AI-2 — Content analysis intake.
 *
 * Accepts whatever a government source hands us (HTML page, extracted PDF text,
 * or plain text) and produces one normalized view that every downstream engine
 * reads from. Reuses the Phase AI-1 normalizer so PDF text quality fixes are not
 * reimplemented here.
 */

const { advancedNormalize } = require("../generatorIntelligence/textNormalization");
const { SOURCE_FORMATS } = require("./types");
const { collapse, detectLanguage, toLines, toText, uniqueBy } = require("./textUtils");

const BLOCK_CLOSE_TAGS =
  /<\/(?:p|div|section|article|header|footer|li|ul|ol|tr|table|h1|h2|h3|h4|h5|h6|td|th|blockquote|figcaption|dd|dt|label|span)>/gi;
const SELF_CLOSING_BREAKS = /<br\s*\/?>|<hr\s*\/?>/gi;
const DROP_TAGS = "script, style, noscript, svg, iframe, template";
const PDF_LIKE_HREF = /\.pdf(?:[?#].*)?$/i;

/**
 * Turn markup into line-structured text before parsing so that headings and
 * table rows survive as separate lines.
 * @param {string} html
 * @returns {string}
 */
function preserveBlockBoundaries(html) {
  return toText(html)
    .replace(SELF_CLOSING_BREAKS, "\n")
    .replace(BLOCK_CLOSE_TAGS, (match) => `${match}\n`);
}

/**
 * Last-resort HTML → text when cheerio cannot parse the document.
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return preserveBlockBoundaries(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * @param {string} html
 * @returns {{
 *   text: string,
 *   documentTitle: string|null,
 *   metaTitle: string|null,
 *   metaDescription: string|null,
 *   htmlHeadings: Array<object>,
 *   links: Array<object>,
 *   parsed: boolean
 * }}
 */
function parseHtml(html) {
  const source = toText(html);
  const empty = {
    text: "",
    documentTitle: null,
    metaTitle: null,
    metaDescription: null,
    htmlHeadings: [],
    links: [],
    parsed: false
  };
  if (!source.trim()) return empty;

  let cheerio;
  try {
    cheerio = require("cheerio");
  } catch {
    return { ...empty, text: stripTags(source) };
  }

  try {
    const $ = cheerio.load(preserveBlockBoundaries(source));
    $(DROP_TAGS).remove();

    const htmlHeadings = [];
    $("h1, h2, h3, h4, h5, h6").each((index, element) => {
      const node = $(element);
      const value = collapse(node.text());
      if (!value) return;
      const tag = String(element.tagName || element.name || "h6").toLowerCase();
      htmlHeadings.push({
        text: value,
        level: Number(tag.replace("h", "")) || 6,
        tag,
        order: index,
        source: `html_${tag}`
      });
    });

    // Table captions and heading cells are how many boards mark up notice sections.
    $("caption, th").each((index, element) => {
      const value = collapse($(element).text());
      if (!value || value.length > 90) return;
      htmlHeadings.push({
        text: value,
        level: 4,
        tag: String(element.tagName || element.name || "th").toLowerCase(),
        order: htmlHeadings.length + index,
        source: "html_table_heading"
      });
    });

    // Standalone bold/strong lines are the most common "fake heading" pattern.
    $("strong, b").each((index, element) => {
      const node = $(element);
      const value = collapse(node.text());
      if (!value || value.length > 90 || value.length < 3) return;
      const parentText = collapse(node.parent().text());
      if (parentText && parentText !== value) return;
      htmlHeadings.push({
        text: value,
        level: 4,
        tag: String(element.tagName || element.name || "strong").toLowerCase(),
        order: htmlHeadings.length + index,
        source: "html_emphasis"
      });
    });

    const links = [];
    $("a[href]").each((index, element) => {
      const node = $(element);
      const href = collapse(node.attr("href"));
      if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;
      links.push({
        text: collapse(node.text()),
        href,
        isPdf: PDF_LIKE_HREF.test(href),
        order: index
      });
    });

    return {
      text: $.root().text(),
      documentTitle: collapse($("title").first().text()) || null,
      metaTitle: collapse($('meta[property="og:title"]').attr("content")) || null,
      metaDescription:
        collapse($('meta[name="description"]').attr("content")) ||
        collapse($('meta[property="og:description"]').attr("content")) ||
        null,
      htmlHeadings,
      links: uniqueBy(links, (link) => `${link.href}|${link.text.toLowerCase()}`),
      parsed: true
    };
  } catch {
    return { ...empty, text: stripTags(source) };
  }
}

/**
 * Pull bare URLs out of plain-text / PDF content so link signals still work.
 * @param {string} text
 * @returns {Array<object>}
 */
function extractTextLinks(text) {
  const links = [];
  const pattern = /(https?:\/\/[^\s<>"')\]]+)/gi;
  const lines = toLines(text);
  lines.forEach((line, index) => {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line)) !== null) {
      const href = match[1].replace(/[.,;]$/, "");
      const label = collapse(line.slice(0, match.index).replace(/[=:|-]+$/, ""));
      links.push({
        text: label,
        href,
        isPdf: PDF_LIKE_HREF.test(href),
        order: index
      });
    }
  });
  return uniqueBy(links, (link) => `${link.href}|${link.text.toLowerCase()}`);
}

/**
 * @param {object} input
 * @returns {string}
 */
function resolveSourceFormat(input) {
  if (input.html && toText(input.html).trim()) return SOURCE_FORMATS.HTML;
  if (input.pdfText && toText(input.pdfText).trim()) return SOURCE_FORMATS.PDF;
  if (input.pdf && toText(input.pdf.text || input.pdf).trim()) return SOURCE_FORMATS.PDF;
  if (toText(input.text || input.content).trim()) return SOURCE_FORMATS.TEXT;
  return SOURCE_FORMATS.EMPTY;
}

/**
 * Extra documents attached to a monitoring event (linked PDFs already extracted).
 * @param {object} input
 * @returns {{ text: string, count: number }}
 */
function collectAttachedDocuments(input) {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const parts = [];
  for (const doc of documents) {
    if (!doc) continue;
    const body = toText(typeof doc === "string" ? doc : doc.text || doc.content);
    const heading = collapse(typeof doc === "object" ? doc.title : "");
    if (heading) parts.push(heading);
    if (body.trim()) parts.push(body);
  }
  return { text: parts.join("\n"), count: documents.length };
}

/**
 * Build the normalized content view shared by all AI-2 engines.
 *
 * @param {{
 *   html?: string,
 *   pdfText?: string,
 *   pdf?: object|string,
 *   text?: string,
 *   content?: string,
 *   title?: string,
 *   url?: string,
 *   sourceUrl?: string,
 *   contentType?: string,
 *   documents?: Array<object>
 * }} input
 * @returns {object}
 */
function analyzeContent(input = {}) {
  const safeInput = input && typeof input === "object" ? input : {};
  const sourceFormat = resolveSourceFormat(safeInput);
  const html = toText(safeInput.html);
  const pdfText = toText(
    safeInput.pdfText || (safeInput.pdf && (safeInput.pdf.text || safeInput.pdf)) || ""
  );
  const plainText = toText(safeInput.text || safeInput.content);
  const attached = collectAttachedDocuments(safeInput);

  const htmlParsed = sourceFormat === SOURCE_FORMATS.HTML ? parseHtml(html) : parseHtml("");
  const bodyParts = [htmlParsed.text, pdfText, plainText, attached.text].filter((part) =>
    toText(part).trim()
  );
  const rawBody = bodyParts.join("\n");
  const normalizedText = advancedNormalize(rawBody);
  const lines = toLines(normalizedText);

  const links = uniqueBy(
    [...htmlParsed.links, ...extractTextLinks(normalizedText)],
    (link) => `${link.href}|${(link.text || "").toLowerCase()}`
  );

  const providedTitle = collapse(safeInput.title);
  const firstHtmlHeading = htmlParsed.htmlHeadings.find((heading) => heading.level <= 2) || null;
  const titleCandidates = [
    providedTitle ? { text: providedTitle, source: "input_title", weight: 1 } : null,
    htmlParsed.metaTitle ? { text: htmlParsed.metaTitle, source: "meta_og_title", weight: 0.9 } : null,
    firstHtmlHeading
      ? { text: firstHtmlHeading.text, source: firstHtmlHeading.source, weight: 0.88 }
      : null,
    htmlParsed.documentTitle
      ? { text: htmlParsed.documentTitle, source: "html_title", weight: 0.7 }
      : null,
    lines.length ? { text: lines[0], source: "first_line", weight: 0.5 } : null
  ].filter(Boolean);

  const url = collapse(safeInput.sourceUrl || safeInput.url) || null;
  const { language, stats } = detectLanguage(`${titleCandidates[0]?.text || ""}\n${normalizedText}`);

  return {
    sourceFormat,
    contentType: collapse(safeInput.contentType) || null,
    url,
    text: normalizedText,
    lines,
    lineCount: lines.length,
    characterCount: normalizedText.length,
    wordCount: normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0,
    htmlHeadings: htmlParsed.htmlHeadings,
    htmlParsed: htmlParsed.parsed,
    documentTitle: htmlParsed.documentTitle,
    metaTitle: htmlParsed.metaTitle,
    metaDescription: htmlParsed.metaDescription,
    attachedDocumentCount: attached.count,
    links,
    pdfLinkCount: links.filter((link) => link.isPdf).length,
    titleCandidates,
    language,
    languageStats: stats,
    isEmpty: !normalizedText.trim()
  };
}

module.exports = {
  analyzeContent,
  parseHtml,
  extractTextLinks,
  preserveBlockBoundaries,
  stripTags
};
