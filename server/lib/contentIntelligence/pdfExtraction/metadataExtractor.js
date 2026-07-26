"use strict";

const { normalizeWhitespace } = require("./normalization");

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    return normalizeWhitespace(value) || null;
  }
  if (typeof value === "object" && value.year) {
    const date = new Date(
      Date.UTC(value.year, (value.month || 1) - 1, value.day || 1, value.hours || 0, value.minutes || 0, value.seconds || 0)
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function extractMetadata(pdf, metaResult, pageCount, options = {}) {
  const info = (metaResult && metaResult.info) || {};
  const metadata = (metaResult && metaResult.metadata) || null;
  const warnings = [];

  const title =
    normalizeWhitespace(info.Title) ||
    normalizeWhitespace(metadata && metadata.get && metadata.get("dc:title")) ||
    null;
  const author = normalizeWhitespace(info.Author) || null;
  const subject = normalizeWhitespace(info.Subject) || null;
  const keywords = normalizeWhitespace(info.Keywords) || null;
  const creator = normalizeWhitespace(info.Creator) || null;
  const producer = normalizeWhitespace(info.Producer) || null;
  const language =
    normalizeWhitespace(info.Language) ||
    normalizeWhitespace(options.language) ||
    null;

  return {
    metadata: {
      pageTitle: title,
      title,
      author,
      subject,
      keywords,
      creator,
      producer,
      language,
      description: subject,
      canonicalUrl: null,
      creationDate: toIsoDate(info.CreationDate),
      modificationDate: toIsoDate(info.ModDate),
      pageCount,
      pdfVersion: pdf.pdfInfo && pdf.pdfInfo.PDFFormatVersion ? String(pdf.pdfInfo.PDFFormatVersion) : null,
      isEncrypted: Boolean(pdf.encryptPassword || (pdf._transport && pdf._transport.encrypt)),
      metaTags: [],
      structuredData: [],
      sourceUrl: options.sourceUrl || null,
      baseUrl: options.baseUrl || options.sourceUrl || null,
      sourceProfileFormatId: options.sourceProfile?.formatId || null
    },
    warnings
  };
}

module.exports = {
  extractMetadata,
  toIsoDate
};
