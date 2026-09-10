"use strict";

/**
 * Resolve the canonical public page for a recruitment without schema changes.
 *
 * PRODUCT RULE: ONE RECRUITMENT → ONE CANONICAL PUBLIC PAGE (pages.slug).
 *
 * Rules:
 * - 0 linked pages → none (first Notification/new-vacancy publish may create)
 * - 1 linked page → unique canonical (safe to hydrate / update)
 * - 2+ linked pages → ambiguous (do not guess; block publish)
 */

function normalizePageRow(row) {
  if (!row || typeof row !== "object") return null;
  const id = Number(row.id);
  const slug = String(row.slug || "")
    .trim()
    .replace(/^\/+|\.html$/gi, "");
  if (!Number.isInteger(id) || id <= 0 || !slug) return null;
  return {
    id,
    slug,
    title: row.title != null ? String(row.title) : null,
    recruitment_id:
      row.recruitment_id != null ? Number(row.recruitment_id) : null,
    recruitment_event_id:
      row.recruitment_event_id != null ? Number(row.recruitment_event_id) : null
  };
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\.html$/gi, "");
}

/**
 * @param {Array<object>} pages
 * @returns {{
 *   status: 'none'|'unique'|'ambiguous',
 *   page: object|null,
 *   suggestedPage: object|null,
 *   pages: object[],
 *   ambiguous: boolean,
 *   message: string|null
 * }}
 */
function resolveCanonicalFromLinkedPages(pages) {
  const list = (Array.isArray(pages) ? pages : [])
    .map(normalizePageRow)
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  if (list.length === 0) {
    return {
      status: "none",
      page: null,
      suggestedPage: null,
      pages: [],
      ambiguous: false,
      message: null
    };
  }

  if (list.length === 1) {
    return {
      status: "unique",
      page: list[0],
      suggestedPage: list[0],
      pages: list,
      ambiguous: false,
      message: null
    };
  }

  return {
    status: "ambiguous",
    page: null,
    suggestedPage: list[0],
    pages: list,
    ambiguous: true,
    message:
      "Multiple pages linked — choose/repair canonical page before publishing. Do not create another page."
  };
}

/**
 * Guard publish against the one-canonical-page product rule.
 *
 * @param {{
 *   oldSlug?: string|null,
 *   resolution?: ReturnType<typeof resolveCanonicalFromLinkedPages>|null,
 *   isLifecycleUpdate?: boolean,
 *   eventType?: string|null
 * }} input
 */
function evaluateSamePagePublishGuard({
  oldSlug = null,
  resolution = null,
  isLifecycleUpdate = false,
  eventType = null
} = {}) {
  const slug = normalizeSlug(oldSlug);
  const hasOldSlug = Boolean(slug);
  const status = resolution && resolution.status ? resolution.status : "none";
  const type = String(eventType || "")
    .trim()
    .toLowerCase();
  const treatedAsUpdate =
    isLifecycleUpdate === true ||
    [
      "admit_card",
      "answer_key",
      "result",
      "final_result",
      "correction",
      "exam_date",
      "city_intimation",
      "objection",
      "dv",
      "medical",
      "joining"
    ].includes(type);

  if (status === "ambiguous") {
    return {
      allowed: false,
      code: "ambiguous_pages",
      message:
        (resolution && resolution.message) ||
        "Cannot publish lifecycle update because the Recruitment does not have exactly one canonical public page. Resolve page linkage first.",
      existingSlug:
        (resolution && resolution.suggestedPage && resolution.suggestedPage.slug) || null,
      generatorHref: "/admin/recruitments"
    };
  }

  if (treatedAsUpdate) {
    if (status === "none") {
      return {
        allowed: false,
        code: "missing_canonical_page",
        message:
          "Cannot publish lifecycle update because the Recruitment does not have exactly one canonical public page. Resolve page linkage first — do not create a status-only page.",
        existingSlug: null,
        generatorHref: "/admin/recruitments"
      };
    }
    if (status === "unique") {
      const canonicalSlug = resolution.page && resolution.page.slug;
      if (!hasOldSlug) {
        return {
          allowed: false,
          code: "update_requires_old_slug",
          message:
            "Lifecycle update must open the existing permanent public page (UPDATE mode). Canonical page exists — do not create a new URL.",
          existingSlug: canonicalSlug,
          generatorHref: canonicalSlug
            ? `/generator?slug=${encodeURIComponent(canonicalSlug)}`
            : "/admin/recruitments"
        };
      }
      if (canonicalSlug && slug !== canonicalSlug) {
        return {
          allowed: false,
          code: "slug_mismatch",
          message:
            "This update must use the existing permanent public page slug. Do not publish under a different URL.",
          existingSlug: canonicalSlug,
          generatorHref: `/generator?slug=${encodeURIComponent(canonicalSlug)}`
        };
      }
      return { allowed: true, code: "update", message: null, existingSlug: canonicalSlug };
    }
  }

  if (hasOldSlug) {
    if (status === "unique" && resolution.page && resolution.page.slug !== slug) {
      return {
        allowed: false,
        code: "slug_mismatch",
        message:
          "This update must use the existing permanent public page slug. Do not publish under a different URL.",
        existingSlug: resolution.page.slug,
        generatorHref: `/generator?slug=${encodeURIComponent(resolution.page.slug)}`
      };
    }
    return { allowed: true, code: "update", message: null };
  }

  if (status === "unique") {
    const existingSlug = resolution.page && resolution.page.slug;
    return {
      allowed: false,
      code: "create_blocked_existing_page",
      message:
        "This recruitment already has a published page. Open the existing page/update context before publishing.",
      existingSlug,
      generatorHref: existingSlug
        ? `/generator?slug=${encodeURIComponent(existingSlug)}`
        : "/admin/recruitments"
    };
  }

  return { allowed: true, code: "create_ok", message: null };
}

module.exports = {
  normalizePageRow,
  normalizeSlug,
  resolveCanonicalFromLinkedPages,
  evaluateSamePagePublishGuard
};
