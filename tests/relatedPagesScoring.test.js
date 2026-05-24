"use strict";

const {
  pickRelatedPages,
  buildPageSignals,
  normalizeStatusGroup
} = require("../server/lib/relatedPagesScoring");

function row(overrides) {
  return {
    title: "",
    slug: "",
    status: "",
    category: "",
    views: 0,
    created_at: "2026-05-01T00:00:00.000Z",
    department: null,
    qualification: null,
    state: null,
    post_name: null,
    ...overrides
  };
}

describe("normalizeStatusGroup", () => {
  it("maps canonical statuses", () => {
    expect(normalizeStatusGroup("new form")).toBe("form");
    expect(normalizeStatusGroup("Admit Card")).toBe("admit");
    expect(normalizeStatusGroup("result")).toBe("result");
  });
});

describe("pickRelatedPages", () => {
  const sscCgl = row({
    title: "SSC CGL Online Form (12256 Posts)",
    slug: "ssc-cgl-2026",
    status: "new form",
    category: "ssc, cgl",
    created_at: "2026-05-24T11:44:20.000Z"
  });

  const sscChsl = row({
    title: "SSC CHSL Online Form 2026",
    slug: "ssc-chsl-2026",
    status: "new form",
    category: "ssc, chsl",
    created_at: "2026-05-23T10:00:00.000Z"
  });

  const police1 = row({
    title: "police 1",
    slug: "police-1",
    status: "admit card",
    category: "police",
    created_at: "2026-05-10T08:09:15.000Z"
  });

  const police6 = row({
    title: "police 6",
    slug: "police-6",
    status: "admit card",
    category: "police",
    created_at: "2026-05-23T17:08:02.000Z"
  });

  const crpfResult = row({
    title: "CRPF Constable Form (9195) posts",
    slug: "crpf-constable-form-9195-posts",
    status: "result",
    category: "crpf, constable",
    created_at: "2026-05-16T06:09:40.000Z"
  });

  const homeGuardResult = row({
    title: "up home guard 2026 answer key",
    slug: "up-home-guard-2026",
    status: "result",
    category: "home guard, police",
    created_at: "2026-05-10T11:18:22.000Z"
  });

  const all = [sscChsl, police1, police6, crpfResult, homeGuardResult];

  it("SSC form page prefers SSC and form peers over unrelated police", () => {
    const picked = pickRelatedPages(sscCgl, all, 6);
    const slugs = picked.map((p) => p.slug);
    expect(slugs).toContain("ssc-chsl-2026");
    expect(slugs).not.toContain("police-1");
    expect(slugs).not.toContain("police-6");
  });

  it("police admit page prefers police admit over SSC form", () => {
    const picked = pickRelatedPages(police1, [sscCgl, sscChsl, police6, crpfResult, homeGuardResult], 4);
    const slugs = picked.map((p) => p.slug);
    expect(slugs[0]).toBe("police-6");
    expect(slugs).not.toContain("ssc-cgl-2026");
  });

  it("result page prefers result peers before unrelated forms", () => {
    const picked = pickRelatedPages(crpfResult, [sscCgl, police1, homeGuardResult, police6], 4);
    const slugs = picked.map((p) => p.slug);
    expect(slugs).toContain("up-home-guard-2026");
    expect(slugs).not.toContain("ssc-cgl-2026");
  });

  it("excludes current slug", () => {
    const picked = pickRelatedPages(police1, [police1, police6], 6);
    expect(picked.every((p) => p.slug !== "police-1")).toBe(true);
  });

  it("buildPageSignals detects SSC org from title", () => {
    const sig = buildPageSignals(sscCgl);
    expect(sig.orgs.has("ssc")).toBe(true);
    expect(sig.exams.has("cgl")).toBe(true);
    expect(sig.statusGroup).toBe("form");
  });
});
