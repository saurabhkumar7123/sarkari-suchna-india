"use strict";

const { normalizeWhitespace, normalizeUrl, isHidden } = require("./normalization");

function extractMetadata($, baseUrl) {
  const metaTags = [];
  $("head meta").each((index, element) => {
    const node = $(element);
    const attributes = {};
    for (const name of ["name", "property", "http-equiv", "charset", "content"]) {
      const value = node.attr(name);
      if (value !== undefined) attributes[name] = normalizeWhitespace(value);
    }
    if (Object.keys(attributes).length) metaTags.push({ order: index, attributes });
  });

  const structuredData = [];
  const warnings = [];
  $('script[type="application/ld+json"]').each((index, element) => {
    if (isHidden($, element)) return;
    const raw = $(element).html() || "";
    try {
      structuredData.push({ order: index, data: JSON.parse(raw) });
    } catch {
      warnings.push(`Invalid JSON-LD ignored at index ${index}.`);
    }
  });

  const html = $("html").first();
  const canonical = $('link[rel~="canonical"]').first().attr("href");
  const descriptionNode = $('meta[name="description" i]').first();

  return {
    metadata: {
      pageTitle: normalizeWhitespace($("head title").first().text()) || null,
      language: normalizeWhitespace(html.attr("lang")) || null,
      canonicalUrl: normalizeUrl(canonical, baseUrl),
      description: normalizeWhitespace(descriptionNode.attr("content")) || null,
      metaTags,
      structuredData
    },
    warnings
  };
}

module.exports = { extractMetadata };
