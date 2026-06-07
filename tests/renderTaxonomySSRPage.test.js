"use strict";

const { renderTaxonomySSRPage } = require("../server/lib/renderTaxonomySSRPage");

describe("renderTaxonomySSRPage", () => {
  it("renders full SSR HTML with H1, job cards, and no client scripts", () => {
    const html = renderTaxonomySSRPage({
      title: "Railway Jobs 2026 | Sarkari Suchna India",
      description: "Latest railway jobs.",
      h1: "Railway Jobs",
      sub: "Browse railway updates.",
      canonicalPath: "/department/railway",
      baseUrl: "https://www.example.com",
      headerHtml: "<header>Site</header>",
      footerHtml: "<footer>Footer</footer>",
      items: [
        { title: "RRB ALP 2026", slug: "rrb-alp-2026", status: "new form" },
        { title: "RRB Technician", slug: "rrb-technician-2026", status: "result" }
      ]
    });

    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toContain("<h1>Railway Jobs</h1>");
    expect(html).toContain('href="https://www.example.com/department/railway"');
    expect(html).toContain('href="/rrb-alp-2026"');
    expect(html).toContain("RRB ALP 2026");
    expect(html).toContain("new form");
    expect(html).not.toMatch(/index\.js/i);
    expect(html).not.toMatch(/board-hub\.js/i);
    expect(html).not.toMatch(/listing\.js/i);
    expect(html).not.toMatch(/\/api\/pages/i);
    expect(html).not.toContain("finder");
  });
});
