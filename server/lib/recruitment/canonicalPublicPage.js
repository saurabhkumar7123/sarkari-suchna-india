"use strict";

/**
 * Resolve the canonical public page for a recruitment without schema changes.
 *
 * Rules:
 * - 0 linked pages → none (first publish may create)
 * - 1 linked page → unique canonical (safe to hydrate / update)
 * - 2+ linked pages → ambiguous (do not guess; block create-publish)
 *
 * pages.slug remains the authoritative public URL.
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
      "Multiple public pages are linked to this recruitment. Keep one primary page/slug before publishing an update — do not create another page."
  };
}

/**
 * Guard create-publish when a recruitment already has a linked public page.
 *
 * @param {{
 *   oldSlug?: string|null,
 *   resolution?: ReturnType<typeof resolveCanonicalFromLinkedPages>|null
 * }} input
 */
function evaluateSamePagePublishGuard({ oldSlug = null, resolution = null } = {}) {
  const hasOldSlug = Boolean(
    String(oldSlug || "")
      .trim()
      .replace(/^\/+|\.html$/gi, "")
  );
  const status = resolution && resolution.status ? resolution.status : "none";

  if (hasOldSlug) {
    const slug = String(oldSlug)
      .trim()
      .replace(/^\/+|\.html$/gi, "");
    if (status === "unique" && resolution.page && resolution.page.slug !== slug) {
      return {
        allowed: false,
        code: "slug_mismatch",
        message:
          "This update must use the existing permanent public page slug. Do not publish under a different URL."
      };
    }
    if (status === "ambiguous") {
      const known = (resolution.pages || []).some((p) => p.slug === slug);
      if (!known) {
        return {
          allowed: false,
          code: "ambiguous_pages",
          message:
            resolution.message ||
            "Multiple public pages are linked to this recruitment. Open the correct existing page before publishing."
        };
      }
    }
    return { allowed: true, code: "update", message: null };
  }

  if (status === "unique" || status === "ambiguous") {
    const existingSlug =
      (resolution.page && resolution.page.slug) ||
      (resolution.suggestedPage && resolution.suggestedPage.slug) ||
      null;
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
  resolveCanonicalFromLinkedPages,
  evaluateSamePagePublishGuard
};
