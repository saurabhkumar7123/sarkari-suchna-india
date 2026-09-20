"use strict";

/**
 * Preparation Pipeline — update merge context for existing canonical pages.
 *
 * Existing page = merge base. New Draft = update package + merge metadata.
 * Do NOT blindly replace the entire page with a partial Admit Card/Result PDF.
 */

const { resolveCanonicalFromLinkedPages } = require("../canonicalPublicPage");
const { isDownstreamEvent, isAnnouncementEvent } = require("../lifecycleSafety");

const GENERATOR_MODES = Object.freeze({
  CREATE: "CREATE",
  UPDATE: "UPDATE"
});

/**
 * Build recommended draft title from recruitment title + event (product rule 17).
 */
function buildEventDraftTitle(recruitmentTitle, eventType) {
  const base = String(recruitmentTitle || "")
    .replace(/\s+/g, " ")
    .trim();
  const type = String(eventType || "")
    .trim()
    .toLowerCase();
  const labels = {
    notification: "Notification",
    short_notification: "Notification",
    admit_card: "Admit Card",
    answer_key: "Answer Key",
    result: "Result",
    final_result: "Result",
    correction: "Correction",
    exam_date: "Exam Date",
    city_intimation: "City Intimation",
    objection: "Objection",
    dv: "Document Verification",
    medical: "Medical",
    joining: "Joining"
  };
  const label = labels[type] || "Update";
  if (!base) return label;
  // Notification drafts may reuse the permanent Recruitment title.
  if (type === "notification" || type === "short_notification") {
    return base;
  }
  if (new RegExp(`\\b${label.replace(/\s+/g, "\\s+")}\\b`, "i").test(base)) return base;
  return `${base} — ${label}`;
}

/**
 * @param {{
 *   recruitment?: object|null,
 *   eventType?: string|null,
 *   event?: object|null,
 *   draft?: object|null,
 *   linkedPages?: Array<object>,
 *   existingPageContent?: string|null,
 *   existingPageVersion?: string|number|null,
 *   sourceDocument?: object|null,
 *   extraction?: object|null,
 *   validation?: object|null,
 *   structuredSections?: Array<object>|null
 * }} input
 */
function buildUpdateMergeContext(input = {}) {
  const canonical = resolveCanonicalFromLinkedPages(input.linkedPages || []);
  const eventType = String(input.eventType || (input.event && input.event.event_type) || "").toLowerCase();
  const recruitment = input.recruitment || null;
  const recruitmentTitle =
    (recruitment && (recruitment.title || recruitment.recruitment_name || recruitment.name)) || null;

  const downstream = isDownstreamEvent(eventType);
  const announcement = isAnnouncementEvent(eventType);

  let mode = GENERATOR_MODES.CREATE;
  let blockUpdatePublish = false;
  let blockReason = null;

  if (canonical.status === "unique") {
    mode = GENERATOR_MODES.UPDATE;
  } else if (canonical.status === "ambiguous") {
    mode = GENERATOR_MODES.UPDATE;
    blockUpdatePublish = true;
    blockReason = "multiple_canonical_pages_ambiguous";
  } else if (downstream) {
    mode = GENERATOR_MODES.UPDATE;
    blockUpdatePublish = true;
    blockReason = "downstream_missing_canonical_page";
  } else if (announcement && canonical.status === "none") {
    mode = GENERATOR_MODES.CREATE;
  }

  const draftTitle = buildEventDraftTitle(recruitmentTitle, eventType);

  return Object.freeze({
    version: 1,
    generatorMode: mode,
    slugLocked: mode === GENERATOR_MODES.UPDATE && canonical.status === "unique",
    recruitment: recruitment
      ? Object.freeze({
          id: recruitment.id != null ? Number(recruitment.id) : null,
          title: recruitmentTitle
        })
      : null,
    event: Object.freeze({
      id: input.event && input.event.id != null ? Number(input.event.id) : null,
      type: eventType || null,
      label: draftTitle
    }),
    draft: Object.freeze({
      id: input.draft && input.draft.id != null ? Number(input.draft.id) : null,
      title: draftTitle,
      note: "Draft title describes the publish attempt; Recruitment title is permanent vacancy identity."
    }),
    canonicalPage: Object.freeze({
      status: canonical.status,
      slug: canonical.page ? canonical.page.slug : null,
      pageId: canonical.page ? canonical.page.id : null,
      ambiguous: canonical.ambiguous,
      suggestedSlug: canonical.suggestedPage ? canonical.suggestedPage.slug : null,
      message: canonical.message
    }),
    mergeBase: Object.freeze({
      strategy: mode === GENERATOR_MODES.UPDATE ? "preserve_existing_plus_new_sections" : "create_new_page",
      existingPageContentAvailable: Boolean(
        input.existingPageContent && String(input.existingPageContent).trim()
      ),
      existingPageVersion: input.existingPageVersion != null ? input.existingPageVersion : null,
      doNotBlindReplace: true,
      humanMustDecideFinalContent: true
    }),
    sourceDocument: input.sourceDocument || null,
    extraction: input.extraction || null,
    validation: input.validation || null,
    structuredSections: input.structuredSections || null,
    publishGate: Object.freeze({
      humanPublishOnly: true,
      autoPublishImpossible: true,
      blockUpdatePublish,
      blockReason,
      createPageAllowedAfterHumanPublish: mode === GENERATOR_MODES.CREATE && announcement
    })
  });
}

/**
 * Legacy title-based merge (fallback when structured mapping is unavailable).
 * Deterministic; does not call AI.
 */
function legacyMergePublisherSectionText(
  existingText,
  updateText,
  { preferUpdateTitles = [] } = {}
) {
  const SECTION_RE = /\[Section:\s*([^\]]+)\]/gi;

  function parse(text) {
    const raw = String(text || "");
    const indices = [];
    const re = new RegExp(SECTION_RE.source, "gi");
    let match;
    while ((match = re.exec(raw)) !== null) {
      indices.push({ title: match[1].trim(), start: match.index, end: match.index + match[0].length });
    }
    const map = new Map();
    const order = [];
    for (let i = 0; i < indices.length; i += 1) {
      const bodyStart = indices[i].end;
      const bodyEnd = i + 1 < indices.length ? indices[i + 1].start : raw.length;
      const title = indices[i].title;
      const key = title.toLowerCase();
      if (!map.has(key)) order.push(title);
      map.set(key, { title, body: raw.slice(bodyStart, bodyEnd).trim() });
    }
    return { map, order };
  }

  const base = parse(existingText);
  const update = parse(updateText);
  const prefer = new Set(
    (Array.isArray(preferUpdateTitles) ? preferUpdateTitles : []).map((t) => String(t).toLowerCase())
  );

  for (const title of update.order) {
    const key = title.toLowerCase();
    const row = update.map.get(key);
    if (!row || !row.body) continue;
    if (!base.map.has(key)) {
      base.order.push(row.title);
      base.map.set(key, row);
    } else if (prefer.has(key) || prefer.size === 0) {
      if (
        prefer.has(key) ||
        /admit card|answer key|result|important date|important link|short information/i.test(title)
      ) {
        base.map.set(key, row);
      }
    }
  }

  return base.order
    .map((title) => {
      const row = base.map.get(title.toLowerCase());
      return `[Section: ${row.title}]\n${row.body}`;
    })
    .join("\n\n");
}

/**
 * Merge helper: structured field-level merge when possible; title-based fallback otherwise.
 * Existing page = base. Missing fields in update are NEVER deleted.
 * Deterministic; does not call AI. Human still edits in Generator.
 *
 * @param {string} existingText
 * @param {string} updateText
 * @param {{
 *   preferUpdateTitles?: string[],
 *   eventType?: string|null,
 *   allowRemove?: boolean,
 *   structuredMerge?: boolean,
 *   collectClassifications?: object[]
 * }} [options]
 * @returns {string}
 */
function mergePublisherSectionText(existingText, updateText, options = {}) {
  const preferUpdateTitles = options.preferUpdateTitles || [];
  if (options.structuredMerge === false) {
    return legacyMergePublisherSectionText(existingText, updateText, { preferUpdateTitles });
  }

  try {
    const {
      mergeStructuredPublisherDocuments
    } = require("./structuredNormalizeMerge");
    const result = mergeStructuredPublisherDocuments(existingText, updateText, {
      eventType: options.eventType || null,
      allowRemove: options.allowRemove === true
    });
    if (result && typeof result.text === "string") {
      if (Array.isArray(options.collectClassifications) && Array.isArray(result.classifications)) {
        for (const row of result.classifications) {
          options.collectClassifications.push(row);
        }
      }
      if (result.usedStructuredMerge && result.text.trim()) {
        return result.text;
      }
      if (result.usedStructuredMerge && String(existingText || "").trim()) {
        return result.text;
      }
    }
  } catch {
    /* fall through to legacy title merge */
  }

  return legacyMergePublisherSectionText(existingText, updateText, { preferUpdateTitles });
}

function parsePublisherSections(text) {
  const SECTION_RE = /\[Section:\s*([^\]]+)\]/gi;
  const raw = String(text || "");
  const indices = [];
  const re = new RegExp(SECTION_RE.source, "gi");
  let match;
  while ((match = re.exec(raw)) !== null) {
    indices.push({ title: match[1].trim(), start: match.index, end: match.index + match[0].length });
  }
  const map = new Map();
  const order = [];
  for (let i = 0; i < indices.length; i += 1) {
    const bodyStart = indices[i].end;
    const bodyEnd = i + 1 < indices.length ? indices[i + 1].start : raw.length;
    const title = indices[i].title;
    const key = title.toLowerCase();
    if (!map.has(key)) order.push(title);
    map.set(key, { title, body: raw.slice(bodyStart, bodyEnd).trim() });
  }
  return { map, order };
}

/**
 * Section-level diff for Combined Preview markers (existing vs candidate text).
 * Deterministic; does not rewrite content.
 */
function diffPublisherSections(existingText, candidateText) {
  const existing = parsePublisherSections(existingText);
  const candidate = parsePublisherSections(candidateText);
  const added = [];
  const modified = [];
  const unchanged = [];
  const removed = [];

  for (const title of candidate.order) {
    const key = title.toLowerCase();
    const next = candidate.map.get(key);
    const prev = existing.map.get(key);
    if (!prev) {
      added.push(next.title);
    } else if (String(prev.body || "").trim() !== String(next.body || "").trim()) {
      modified.push(next.title);
    } else {
      unchanged.push(next.title);
    }
  }
  for (const title of existing.order) {
    const key = title.toLowerCase();
    if (!candidate.map.has(key)) removed.push(title);
  }

  return Object.freeze({
    added: Object.freeze(added),
    modified: Object.freeze(modified),
    unchanged: Object.freeze(unchanged),
    removed: Object.freeze(removed),
    hasChanges: added.length > 0 || modified.length > 0
  });
}

/**
 * True when editor/candidate already contains every existing section title
 * (typical after mergeApplied or full-page edit). Avoids double-merge.
 */
function editorLooksFullyMerged(existingText, editorText) {
  const existing = parsePublisherSections(existingText);
  const editor = parsePublisherSections(editorText);
  if (!existing.order.length) return false;
  if (!editor.order.length) return false;
  return existing.order.every((title) => editor.map.has(title.toLowerCase()));
}

/**
 * Resolve Combined Preview text: existing published page + pending update.
 * Prefer editor when already merged; otherwise merge sections.
 */
function resolveCombinedPreviewText(existingText, editorText, options = {}) {
  const existing = String(existingText || "").trim();
  const editor = String(editorText || "").trim();
  if (!existing) return editor;
  if (!editor) return existing;
  if (options.mergeAlreadyApplied === true) return editor;
  if (options.forceMerge !== true && editorLooksFullyMerged(existing, editor)) {
    return editor;
  }
  return mergePublisherSectionText(existing, editor, {
    preferUpdateTitles: options.preferUpdateTitles,
    eventType: options.eventType || null,
    allowRemove: options.allowRemove === true,
    structuredMerge: options.structuredMerge,
    collectClassifications: options.collectClassifications
  });
}

module.exports = {
  GENERATOR_MODES,
  buildEventDraftTitle,
  buildUpdateMergeContext,
  mergePublisherSectionText,
  legacyMergePublisherSectionText,
  parsePublisherSections,
  diffPublisherSections,
  editorLooksFullyMerged,
  resolveCombinedPreviewText
};
