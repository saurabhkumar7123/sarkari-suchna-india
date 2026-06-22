"use strict";

const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("lineRenderer Important Links status rows", () => {
  test("Case 1: Label=url renders Click Here link-box", () => {
    const html = renderLinesToHtml(["Apply Online Registration Link=https://ssc.gov.in"], {
      sectionName: "ImportantLinks"
    });
    expect(html).toContain('class="link-box"');
    expect(html).toContain("https://ssc.gov.in");
    expect(html).toContain("Click Here");
    expect(html).not.toContain("link-box-status");
  });

  test("Case 2: colon syntax in Important Links renders link-box status text", () => {
    const html = renderLinesToHtml(["Apply Online Registration Link : Link Activate Soon"], {
      sectionName: "Important Links"
    });
    expect(html).toContain('class="link-box"');
    expect(html).toContain('class="link-box-status"');
    expect(html).toContain("Apply Online Registration Link");
    expect(html).toContain("Link Activate Soon");
    expect(html).not.toContain("Click Here");
    expect(html).not.toContain("date-row");
  });

  test("Case 3: other URL links unchanged", () => {
    const html = renderLinesToHtml(["Official Website=https://ssc.gov.in"], {
      sectionName: "ImportantLinks"
    });
    expect(html).toContain("Official Website");
    expect(html).toContain("Click Here");
    expect(html).toContain("https://ssc.gov.in");
  });

  test("Case 4: Important Dates colon lines stay date-row", () => {
    const html = renderLinesToHtml(["Online Apply Last Date : 22 June 2026"], {
      sectionName: "ImportantDates"
    });
    expect(html).toContain('class="date-row"');
    expect(html).not.toContain('class="link-box"');
    expect(html).not.toContain("link-box-status");
  });

  test("Case 5: FAQ section unchanged", () => {
    const html = renderLinesToHtml(["Q: When will apply start?", "A: 21 May 2026"], {
      sectionName: "Important Question"
    });
    expect(html).toContain('class="faq-item"');
    expect(html).not.toContain('class="link-box"');
  });

  test("Important Link singular section name supported", () => {
    const html = renderLinesToHtml(["Apply Online : Link Activate Soon"], {
      sectionName: "Important Link"
    });
    expect(html).toContain("link-box-status");
  });

  test("colon status row uses link-box when same block has url links", () => {
    const html = renderLinesToHtml(
      [
        "Check Exam City : Link Activate Soon",
        "Apply Online=https://example.com/apply"
      ],
      { sectionName: "Uttar Pradesh TET Recruitment 2026 : Vacancy Details" }
    );
    expect(html).toContain('class="link-box"');
    expect(html).toContain('class="link-box-status"');
    expect(html).toContain("Check Exam City");
    expect(html).toContain("Link Activate Soon");
    expect(html).not.toContain('class="date-row"');
  });

  test("full section build integrates Important Links status rows", () => {
    const text = `[Section: ImportantLinks]
Apply Online Registration Link : Link Activate Soon
Official Website=https://ssc.gov.in`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain("link-box-status");
    expect(html).toContain("Link Activate Soon");
    expect(html).toContain("Click Here");
  });

  test("legacy format keeps Click Here button", () => {
    const official = renderLinesToHtml(["Official Website=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(official).toContain('<div class="left-text">Official Website</div>');
    expect(official).toContain(">Click Here</a>");
    expect(official).not.toContain(">Official Website</a>");

    const apply = renderLinesToHtml(["Apply Online=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(apply).toContain('<div class="left-text">Apply Online</div>');
    expect(apply).toContain(">Click Here</a>");
  });

  test("pipe format uses custom button text", () => {
    const apply = renderLinesToHtml(["Apply Online|Apply Now=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(apply).toContain('<div class="left-text">Apply Online</div>');
    expect(apply).toContain(">Apply Now</a>");
    expect(apply).not.toContain(">Click Here</a>");

    const official = renderLinesToHtml(["Official Website|Visit Site=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(official).toContain('<div class="left-text">Official Website</div>');
    expect(official).toContain(">Visit Site</a>");
    expect(official).not.toContain(">Click Here</a>");
  });

  test("dual-button pipe syntax renders two links in one row", () => {
    const html = renderLinesToHtml(
      ["Download Syllabus|Hindi=https://hindi.com|English=https://english.com"],
      { sectionName: "ImportantLinks" }
    );
    expect(html).toContain('<div class="left-text">Download Syllabus</div>');
    expect(html).toContain('class="right-link link-box-actions"');
    expect(html).toContain('href="https://hindi.com/');
    expect(html).toContain('href="https://english.com/');
    expect(html).toContain(">Hindi</a>");
    expect(html).toContain(">English</a>");
  });

  test("legacy pipe-in-label row still uses single Click Here button", () => {
    const html = renderLinesToHtml(["A|B|C=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(html).toContain('<div class="left-text">A</div>');
    expect(html).toContain(">B|C</a>");
    expect(html).not.toContain("link-box-actions");
  });
});
