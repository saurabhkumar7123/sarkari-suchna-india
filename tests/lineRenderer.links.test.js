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

  test("full section build integrates Important Links status rows", () => {
    const text = `[Section: ImportantLinks]
Apply Online Registration Link : Link Activate Soon
Official Website=https://ssc.gov.in`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain("link-box-status");
    expect(html).toContain("Link Activate Soon");
    expect(html).toContain("Click Here");
  });
});
