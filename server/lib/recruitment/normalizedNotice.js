"use strict";

/**
 * Common inbound notice shape for every official source adapter.
 * Adapters fetch/normalize only. They never decide recruitment creation.
 */

const { normalizeCanonicalUrl } = require("./lifecycleDocumentIdentity");

function pickString(...values) {
  for (const value of values) {
    const text = String(value == null ? "" : value).trim();
    if (text) return text;
  }
  return null;
}

function normalizeInboundNotice(input = {}) {
  const title = pickString(input.title, input.sourceTitle);
  const canonicalUrl = normalizeCanonicalUrl(
    input.canonicalUrl || input.url || input.documentUrl || input.link || input.pageUrl
  );
  return Object.freeze({
    sourceId: pickString(input.sourceId, input.source_id) || null,
    organization: pickString(input.organization, input.department, input.board) || null,
    title,
    canonicalUrl,
    publishedAt: pickString(input.publishedAt, input.published_at) || null,
    documentUrl: normalizeCanonicalUrl(input.documentUrl || input.pdfUrl || canonicalUrl),
    documentHash: pickString(input.documentHash, input.document_hash) || null,
    rawContent: pickString(input.rawContent, input.content, input.text, title) || null
  });
}

function toPipelineNotice(normalized) {
  const notice = normalized && normalized.canonicalUrl ? normalized : normalizeInboundNotice(normalized);
  return {
    title: notice.title || "Official update",
    content: notice.rawContent || notice.title || "",
    url: notice.documentUrl || notice.canonicalUrl || "",
    organization: notice.organization || null,
    sourceId: notice.sourceId
  };
}

module.exports = {
  normalizeInboundNotice,
  toPipelineNotice
};
