const { renderLinesToHtml, isPlaceholderDateValue, dateValueClassName } = require("../generator/builders/lineRenderer");
const { buildJobHtml } = require("../generator/pipeline/generatePage");

describe("lineRenderer date styling classes", () => {
  test("real dates use date-value class without placeholder modifier", () => {
    expect(isPlaceholderDateValue("22 June 2026")).toBe(false);
    expect(dateValueClassName("22 June 2026")).toBe("date-value");
  });

  test("placeholder dates use date-value--placeholder class", () => {
    expect(isPlaceholderDateValue("Will Be Update Here Soon")).toBe(true);
    expect(isPlaceholderDateValue("Available Soon")).toBe(true);
    expect(dateValueClassName("Will Be Updated Soon")).toBe("date-value date-value--placeholder");
  });

  test("rendered HTML includes placeholder modifier for pending dates", () => {
    const html = renderLinesToHtml(["Result Date: Will Be Updated Soon"]);
    expect(html).toContain('class="date-value date-value--placeholder"');
    expect(html).toContain("Will Be Updated Soon");
  });

  test("rendered HTML uses standard date-value for concrete dates", () => {
    const html = renderLinesToHtml(["Online Apply Last Date: 24 July 2026"]);
    expect(html).toMatch(/class="date-value"/);
    expect(html).not.toContain("date-value--placeholder");
  });
});

describe("template phase 1 layout", () => {
  test("highlight banner appears after Important Links", async () => {
    const html = await buildJobHtml({
      title: "SSC CGL Online Form 2026",
      text: `[Section: ShortInfo]
SSC Combined Graduate Level notification.

[Section: ImportantDates]
Online Apply Last Date: 22 June 2026
Exam Date: August 2026

[Section: ImportantLinks]
Apply Online=https://example.com/apply

[Section: FAQ]
Q: Sample question?
A: Sample answer.`,
      slug: "ssc-cgl-2026-test",
      category: "ssc cgl",
      normalizedStatus: "latest job",
      postName: "SSC CGL",
      totalPosts: "12256"
    });

    const bannerIdx = html.indexOf("highlight-banner-root");
    const linksIdx = html.indexOf('class="link-box"');
    const faqIdx = html.indexOf("Sample question");
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(-1);
    expect(faqIdx).toBeGreaterThan(bannerIdx);
    expect(linksIdx).toBeLessThan(bannerIdx);
    expect(html).toContain("/topic/ssc-cgl");
    expect(html).toContain("advt-summary-row");
    expect(html).toContain("Total Posts");
    expect(html).toContain("meta-item--tag");
    expect(html).not.toContain("keyFactsSection");
    expect(html).toContain("vacancy-details.css?v=86");
    expect(html).toContain("job-page-share.js?v=3");
    expect(html).toContain("highlight-banner-theme.js?v=2");
    expect(html).toContain("Apply Online");
    expect(html).toContain("highlight-banner-action");
    expect(html).toContain("Last Date: 22 June 2026");
    expect(html).toContain("main.min.css?v=19");
    expect(html).toContain('<body class="page-vacancy">');
  });
});
