"use strict";

/**
 * PWP Phase 1 — Content adapters for orchestration only.
 * Converts existing module outputs between stages. No extraction engines created.
 */

function collapseWhitespace(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";
  const lines = [];
  let sawHeading = false;
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const text = collapseWhitespace(
      block.text || block.originalContent || block.normalizedContent
    );
    if (!text) continue;
    const isHeading = block.type === "heading" || block.blockType === "heading";
    if (isHeading) {
      if (!sawHeading) {
        // Treat first heading as document title, not a section wrapper.
        lines.push(text);
        sawHeading = true;
      } else {
        lines.push(`[Section: ${text}]`);
      }
      continue;
    }
    lines.push(text);
  }
  return lines.join("\n");
}

function normalizedDocumentToText(doc) {
  if (!doc || typeof doc !== "object") return "";
  if (typeof doc.text === "string" && doc.text.trim()) return doc.text;
  if (typeof doc.generatorText === "string" && doc.generatorText.trim()) return doc.generatorText;

  if (Array.isArray(doc.pages) && doc.pages.length) {
    const pageText = doc.pages
      .map((p) => (p && typeof p.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n\n");
    if (pageText.trim()) return pageText;
  }

  if (Array.isArray(doc.contentBlocks) && doc.contentBlocks.length) {
    const blockText = blocksToText(doc.contentBlocks);
    if (blockText.trim()) return blockText;
  }

  const title =
    (doc.metadata && (doc.metadata.title || doc.metadata.pageTitle)) ||
    doc.title ||
    "";
  return collapseWhitespace(title);
}

function correlationToText(correlation) {
  if (!correlation || typeof correlation !== "object") return "";
  const views =
    (Array.isArray(correlation.documents) && correlation.documents) ||
    (Array.isArray(correlation.documentViews) && correlation.documentViews) ||
    [];
  if (views.length) {
    return views
      .map((view) => {
        const nested = view.document || view.normalizedDocument || view;
        const role = view.role || view.documentRole || "document";
        const text = normalizedDocumentToText(nested);
        const title =
          (nested && nested.metadata && nested.metadata.title) || view.title || role;
        return [`[Document: ${title}]`, text].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }
  if (correlation.primaryDocument) {
    return normalizedDocumentToText(correlation.primaryDocument);
  }
  return "";
}

function resolveProgram1Text(payload = {}) {
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text;
  if (payload.correlation) {
    const fromCorrelation = correlationToText(payload.correlation);
    if (fromCorrelation.trim()) return fromCorrelation;
  }
  const docs = Array.isArray(payload.extractedDocuments) ? payload.extractedDocuments : [];
  if (docs.length) {
    return docs.map((d) => normalizedDocumentToText(d)).filter(Boolean).join("\n\n");
  }
  return "";
}

function buildPassThroughAiResponse(payload, extras = {}) {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  return {
    document: {
      documentType: payload.documentType,
      documentTypeLabel: payload.documentTypeLabel || payload.documentType,
      language: payload.language || "en",
      title: extras.title || (payload.normalizedMetadata && payload.normalizedMetadata.title) || null,
      pageStatusHint: payload.pageStatusHint || null
    },
    metadata: payload.normalizedMetadata || null,
    sections: sections.map((s) => ({
      order: s.order,
      sectionType: s.sectionType,
      title: s.title,
      generatorTitle: s.generatorTitle,
      blocks: (s.blocks || []).map((b) => ({
        order: b.order,
        blockType: b.blockType,
        originalContent: b.originalContent,
        normalizedContent: b.normalizedContent
      }))
    })),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.slice() : [],
    notes: Array.isArray(extras.notes) ? extras.notes.slice() : [],
    confidence: Object.prototype.hasOwnProperty.call(extras, "confidence")
      ? extras.confidence
      : 0.9
  };
}

function buildGeneratorDraftFromCanonical(canonicalPackage, context = {}) {
  const ready =
    (canonicalPackage && canonicalPackage.generatorReadyDocument) || canonicalPackage || {};
  const metadata = ready.metadata || ready.generatorMetadata || {};
  const title =
    collapseWhitespace(metadata.title) ||
    collapseWhitespace(context.title) ||
    "Untitled recruitment draft";

  return {
    title,
    post_name: collapseWhitespace(context.postName) || "",
    total_posts: collapseWhitespace(context.totalPosts) || "",
    advertisement_no: collapseWhitespace(context.advertisementNo) || "",
    status: "draft",
    customStatus: "",
    category: "",
    structuredQualification: "",
    structuredState: "",
    structuredDepartment: collapseWhitespace(metadata.organization) || "",
    pageUrl: collapseWhitespace(context.sourceUrl) || "",
    data: typeof ready.generatorText === "string" ? ready.generatorText : "",
    breaking: false,
    breakingOrder: null,
    eventTime: null,
    lastDate:
      (metadata.importantDates &&
        (metadata.importantDates.lastDate || metadata.importantDates.applicationEnd)) ||
      "",
    smallBoxSlot: null,
    badges: [],
    canonicalRecruitmentPackage: ready,
    formatId: ready.formatId || "cip_generator_ready_document_v1",
    workflowId: context.workflowId || null,
    recruitmentId: context.recruitmentId || null
  };
}

module.exports = {
  collapseWhitespace,
  normalizedDocumentToText,
  correlationToText,
  resolveProgram1Text,
  buildPassThroughAiResponse,
  buildGeneratorDraftFromCanonical
};
