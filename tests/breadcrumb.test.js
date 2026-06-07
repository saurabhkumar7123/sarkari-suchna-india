"use strict";

const { renderBreadcrumbHtml, SITE_NAME } = require("../server/lib/breadcrumb");

describe("breadcrumb", () => {
  it("renders standard site breadcrumb with home link and page title", () => {
    const html = renderBreadcrumbHtml("UP Police Constable Exam City Details 2026");

    expect(html).toContain('class="breadcrumb"');
    expect(html).toContain(`href="/" class="breadcrumb__brand"`);
    expect(html).toContain(SITE_NAME);
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
});
