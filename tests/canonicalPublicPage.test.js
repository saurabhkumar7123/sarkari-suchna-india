"use strict";

const {
  resolveCanonicalFromLinkedPages,
  evaluateSamePagePublishGuard
} = require("../server/lib/recruitment/canonicalPublicPage");

describe("canonicalPublicPage — same-page lifecycle guards", () => {
  test("A: unique linked page resolves as canonical", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    expect(resolution.status).toBe("unique");
    expect(resolution.page.slug).toBe("up-police-constable-2026");
    expect(resolution.ambiguous).toBe(false);
  });

  test("B: no linked pages allows create", () => {
    const resolution = resolveCanonicalFromLinkedPages([]);
    expect(resolution.status).toBe("none");
    const guard = evaluateSamePagePublishGuard({ oldSlug: "", resolution });
    expect(guard.allowed).toBe(true);
    expect(guard.code).toBe("create_ok");
  });

  test("F: create blocked when unique canonical page exists", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({ oldSlug: null, resolution });
    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe("create_blocked_existing_page");
    expect(guard.existingSlug).toBe("up-police-constable-2026");
    expect(guard.generatorHref).toContain("slug=up-police-constable-2026");
  });

  test("G: update with matching oldSlug is allowed and keeps slug", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({
      oldSlug: "up-police-constable-2026",
      resolution
    });
    expect(guard.allowed).toBe(true);
    expect(guard.code).toBe("update");
  });

  test("G: update with mismatched slug is blocked", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 10, slug: "up-police-constable-2026", recruitment_id: 1 }
    ]);
    const guard = evaluateSamePagePublishGuard({
      oldSlug: "some-other-slug",
      resolution
    });
    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe("slug_mismatch");
  });

  test("ambiguous multi-page set does not pick silently", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 2, slug: "newer-page", recruitment_id: 1 },
      { id: 1, slug: "older-page", recruitment_id: 1 }
    ]);
    expect(resolution.status).toBe("ambiguous");
    expect(resolution.page).toBeNull();
    expect(resolution.suggestedPage.slug).toBe("older-page");
    expect(resolution.pages).toHaveLength(2);

    const createGuard = evaluateSamePagePublishGuard({ oldSlug: "", resolution });
    expect(createGuard.allowed).toBe(false);
    expect(createGuard.code).toBe("create_blocked_existing_page");
  });

  test("ambiguous update allowed only when oldSlug is one of the linked pages", () => {
    const resolution = resolveCanonicalFromLinkedPages([
      { id: 1, slug: "page-a", recruitment_id: 1 },
      { id: 2, slug: "page-b", recruitment_id: 1 }
    ]);
    expect(
      evaluateSamePagePublishGuard({ oldSlug: "page-b", resolution }).allowed
    ).toBe(true);
    expect(
      evaluateSamePagePublishGuard({ oldSlug: "page-c", resolution }).allowed
    ).toBe(false);
  });
});
