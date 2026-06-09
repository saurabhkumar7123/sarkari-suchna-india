const { validatePageContentIdentity } = require("../generator/analysis/contentQualityGuard");
const { renderLinesToHtml, isPlaceholderDateValue, dateValueClassName } = require("../generator/builders/lineRenderer");
const { buildJobHtml } = require("../generator/pipeline/generatePage");

describe("contentQualityGuard", () => {
  test("blocks SSC page containing Railway RRB ALP copy-paste text", () => {
    const result = validatePageContentIdentity({
      title: "SSC CGL Online Form 2026",
      postName: "SSC CGL",
      department: "SSC",
      text: `[Section: ShortInfo]
Staff Selection Commission has released notification. Candidates are advised to check complete details for the Railway RRB ALP Recruitment 2026.

[Section: ImportantDates]
Last Date: 22 June 2026`
    });

    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.marker.includes("railway") || v.marker.includes("rrb"))).toBe(true);
  });

  test("allows SSC page with only SSC-related content", () => {
    const result = validatePageContentIdentity({
      title: "SSC CGL Online Form 2026",
      postName: "SSC CGL",
      department: "SSC",
      text: `[Section: ShortInfo]
Staff Selection Commission (SSC) has released SSC CGL notification for 2026.

[Section: ImportantDates]
Online Apply Last Date: 22 June 2026`
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("allows UP Police admit card page with UP Police references", () => {
    const result = validatePageContentIdentity({
      title: "UP Police Constable Admit Card 2026",
      postName: "CONSTABLE",
      department: "UP Police",
      text: `[Section: ShortInfo]
Uttar Pradesh Police Recruitment and Promotion Board has released UP Police Constable admit card.

[Section: ImportantDates]
Exam Date: 08 June 2026`
    });

    expect(result.ok).toBe(true);
  });

  test("allows result page when identity cannot be inferred", () => {
    const result = validatePageContentIdentity({
      title: "Latest Update",
      postName: "",
      text: "[Section: ShortInfo]\nGeneral update for candidates."
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("blocks SSC contamination on UPSSSC pages (upsssc must not match ssc substring)", () => {
    const result = validatePageContentIdentity({
      title: "UPSSSC PET Exam 2026",
      postName: "PET",
      department: "UPSSSC",
      slug: "upsssc-pet-2026",
      text: `[Section: ShortInfo]
UPSSSC PET 2026 notification. Apply for SSC CGL before the last date.

[Section: ImportantDates]
Last Date: 20 July 2026`
    });

    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.marker === "ssc cgl" || v.marker === "ssc")).toBe(true);
  });

  test("UPSSSC slug does not inherit SSC identity", () => {
    const { detectPrimaryFamilies, normalizeHaystack } = require("../generator/analysis/contentQualityGuard");
    const families = detectPrimaryFamilies(
      normalizeHaystack("UPSSSC PET Exam 2026 PET UPSSSC upsssc-pet-2026")
    );
    expect(families).toContain("upsssc");
    expect(families).not.toContain("ssc_general");
    expect(families).not.toContain("ssc");
  });
});

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
  test("highlight banner appears after Important Links and uses normalized key facts lookup", async () => {
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
      normalizedStatus: "new form",
      postName: "SSC CGL",
      totalPosts: "12256"
    });

    const bannerIdx = html.indexOf('class="highlight-banner-root"');
    const linksIdx = html.indexOf('class="link-box"');
    const faqIdx = html.indexOf("Sample question");
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(-1);
    expect(faqIdx).toBeGreaterThan(bannerIdx);
    expect(linksIdx).toBeLessThan(bannerIdx);
    expect(html).toContain('normalizeSectionKey("important dates")');
    expect(html).not.toContain('byLabel["ImportantDates"]');
    expect(html).toContain("vacancy-details.css?v=14");
  });
});
