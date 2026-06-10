"use strict";

const { renderTaxonomySSRPage } = require("../server/lib/renderTaxonomySSRPage");
const { renderHomeCardBadgesHtml } = require("../server/lib/homepageBadges");

describe("taxonomy row alignment — title-only, no homepage badges", () => {
  const baseOpts = {
    title: "SSC Jobs | Sarkari Suchna India",
    description: "SSC updates.",
    h1: "SSC Jobs",
    sub: "Browse SSC updates.",
    canonicalPath: "/department/ssc",
    baseUrl: "https://www.example.com",
    headerHtml: "",
    footerHtml: ""
  };

  test("department-style row renders dot + title only", () => {
    const html = renderTaxonomySSRPage({
      ...baseOpts,
      items: [{ title: "SSC CGL 2026 Online Form", slug: "ssc-cgl-2026", status: "new form" }]
    });
    expect(html).toContain("<li><a href=\"/ssc-cgl-2026\">SSC CGL 2026 Online Form</a></li>");
    expect(html).not.toContain("taxonomy-hub__status");
    expect(html).not.toContain("home-badge");
    expect(html).not.toContain("home-card-badge");
    expect(html).not.toContain("–");
    expect(html).not.toContain("new form");
  });

  test("qualification and state pages use same title-only row markup", () => {
    const qualHtml = renderTaxonomySSRPage({
      ...baseOpts,
      canonicalPath: "/qualification/12th",
      h1: "12th Jobs",
      items: [{ title: "12th Pass Constable Form", slug: "constable-12th", status: "OUT" }]
    });
    const stateHtml = renderTaxonomySSRPage({
      ...baseOpts,
      canonicalPath: "/state/uttar-pradesh",
      h1: "Uttar Pradesh Jobs",
      items: [{ title: "UP Police Constable 2026", slug: "up-police-2026", status: "NEW" }]
    });

    for (const html of [qualHtml, stateHtml]) {
      expect(html).not.toContain("taxonomy-hub__status");
      expect(html).not.toContain("home-badge");
      expect(html).not.toContain("home-card-badge-sep");
    }
  });

  test("homepage badge helper unchanged (scope protection)", () => {
    const badgeHtml = renderHomeCardBadgesHtml(["NEW"]);
    expect(badgeHtml).toContain("home-card-badge-sep");
    expect(badgeHtml).toContain("home-badge--new");
    expect(badgeHtml).toContain("NEW");
  });
});
