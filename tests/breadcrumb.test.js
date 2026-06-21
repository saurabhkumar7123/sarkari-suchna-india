"use strict";

const {
  renderBreadcrumbHtml,
  normalizeBreadcrumbInHtml,
  BREADCRUMB_HOME_LABEL
} = require("../server/lib/breadcrumb");

describe("breadcrumb", () => {
  it("renders standard site breadcrumb with home link and page title", () => {
    const html = renderBreadcrumbHtml("UP Police Constable Exam City Details 2026");

    expect(html).toContain('class="breadcrumb"');
    expect(html).toContain(`href="/" class="breadcrumb__home"`);
    expect(html).toContain(BREADCRUMB_HOME_LABEL);
    expect(html).toContain(" Home</a>");
    expect(html).toContain("🏠");
    expect(html).toContain('aria-current="page">UP Police Constable Exam City Details 2026</span>');
    expect(html).toContain('aria-hidden="true"> / </span>');
    expect(html).not.toContain("You are here");
    expect(html).not.toContain(" > ");
  });

  it("escapes HTML in page title", () => {
    const html = renderBreadcrumbHtml('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("returns empty string when page title is missing", () => {
    expect(renderBreadcrumbHtml("")).toBe("");
  });

  it("normalizes legacy Sarkari Suchna India breadcrumb to Home", () => {
    const legacy = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/" class="breadcrumb__brand"><span class="breadcrumb__icon" aria-hidden="true">🏠</span> Sarkari Suchna India</a><span class="breadcrumb__sep" aria-hidden="true"> / </span><span class="breadcrumb__current" aria-current="page">UP Police Constable 2026</span></nav>`;
    const html = normalizeBreadcrumbInHtml(legacy);

    expect(html).toContain('class="breadcrumb__home"');
    expect(html).toContain(" Home</a>");
    expect(html).not.toContain("Sarkari Suchna India");
    expect(html).toContain('aria-current="page">UP Police Constable 2026</span>');
  });
});
