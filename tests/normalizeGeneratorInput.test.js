const {
  normalizeGeneratorScalar,
  normalizeGeneratorPageContent,
  normalizeGeneratorBodyTextFields,
  normalizeSectionHeaderName
} = require("../generator/lib/normalizeGeneratorInput");

describe("normalizeGeneratorInput", () => {
  test("title case on scalar fields", () => {
    expect(normalizeGeneratorScalar("up police bharti 2026")).toBe("Up Police Bharti 2026");
    expect(normalizeGeneratorScalar("official WEBSITE")).toBe("Official Website");
  });

  test("section headers title-case name and preserve | table", () => {
    expect(normalizeSectionHeaderName("important dates")).toBe("Important Dates");
    expect(normalizeSectionHeaderName("vacancy | table")).toBe("Vacancy | table");
    expect(normalizeSectionHeaderName("importantLinks")).toBe("Important Links");
  });

  test("content lines preserve URLs", () => {
    const text = `[Section: Important Links]
apply online=https://ssc.nic.in/apply
official website|click here=https://example.com/path
visit https://example.com now`;
    const out = normalizeGeneratorPageContent(text);
    expect(out).toContain("Apply Online=https://ssc.nic.in/apply");
    expect(out).toContain("Official Website|Click Here=https://example.com/path");
    expect(out).toContain("Visit https://example.com Now");
  });

  test("FAQ, dates, and lists are title-cased", () => {
    const text = `[Section: FAQ]
Q: when is the exam?
A: in june 2026
- eligibility criteria
1. graduate degree required
apply start : 1 jan 2026`;
    const out = normalizeGeneratorPageContent(text);
    expect(out).toContain("Q: When Is The Exam?");
    expect(out).toContain("A: In June 2026");
    expect(out).toContain("- Eligibility Criteria");
    expect(out).toContain("1. Graduate Degree Required");
    expect(out).toContain("Apply Start: 1 Jan 2026");
  });

  test("table rows title-case text cells, preserve link URLs", () => {
    const text = `[Section: Vacancy | table]
post name, category, count
clerk, ur, 100
apply=https://example.com/apply`;
    const out = normalizeGeneratorPageContent(text);
    expect(out).toContain("Post Name, Category, Count");
    expect(out).toContain("Clerk, Ur, 100");
    expect(out).toContain("Apply=https://example.com/apply");
  });

  test("normalizeGeneratorBodyTextFields skips slug and url", () => {
    const body = {
      title: "ssc cgl recruitment 2026",
      pageUrl: "ssc-cgl-2026",
      slug: "ssc-cgl-2026",
      post_name: "combined graduate level",
      category: "central government",
      content: `[Section: ShortInfo]
this is a short intro.`,
      status: "latest job"
    };
    normalizeGeneratorBodyTextFields(body);
    expect(body.title).toBe("Ssc Cgl Recruitment 2026");
    expect(body.pageUrl).toBe("ssc-cgl-2026");
    expect(body.slug).toBe("ssc-cgl-2026");
    expect(body.post_name).toBe("Combined Graduate Level");
    expect(body.category).toBe("Central Government");
    expect(body.content).toContain("This Is A Short Intro.");
    expect(body.status).toBe("latest job");
  });

  test("markdown link labels are title-cased, href unchanged", () => {
    const text = `read [apply online](https://example.com) here`;
    expect(normalizeGeneratorPageContent(text)).toBe(
      "Read [Apply Online](https://example.com) Here"
    );
  });
});
