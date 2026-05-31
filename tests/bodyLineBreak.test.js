"use strict";

const {
  escapeDisplayText,
  escapeBodyDisplayText
} = require("../generator/lib/displayTextNormalize");
const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildTable } = require("../generator/builders/tableBuilder");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("body [br] line breaks", () => {
  test("escapeDisplayText does not convert [br] (section titles)", () => {
    const out = escapeDisplayText("Important Dates[br]2026", { mode: "title" });
    expect(out).toContain("[br]");
    expect(out).not.toContain("<br");
  });

  test("escapeBodyDisplayText converts [br] to br element", () => {
    const out = escapeBodyDisplayText("Line one[br]Line two");
    expect(out).toBe("Line one<br>Line two");
  });

  test("escapeBodyDisplayText escapes HTML in segments", () => {
    const out = escapeBodyDisplayText("Safe[br]<script>alert(1)</script>");
    expect(out).toBe("Safe<br>&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toMatch(/<script/i);
  });

  test("text without [br] matches escapeDisplayText output", () => {
    const text = "Application Fee : Rs 500";
    expect(escapeBodyDisplayText(text, { mode: "title" })).toBe(
      escapeDisplayText(text, { mode: "title" })
    );
  });

  test("FAQ and date-row body lines support [br]", () => {
    const faq = renderLinesToHtml(["Q: When apply?[br]Soon", "A: 21 May[br]2026"], {
      sectionName: "FAQ"
    });
    expect(faq).toContain("When apply?<br>Soon");
    expect(faq).toContain("21 May<br>2026");

    const dates = renderLinesToHtml(["Last Date : 22 June[br]2026"], {
      sectionName: "ImportantDates"
    });
    expect(dates).toContain("22 June<br>2026");
    expect(dates).toContain('class="date-row"');
  });

  test("table cells support [br]", () => {
    const html = buildTable("Note,Detail\nFee,Rs 100[br]+ GST");
    expect(html).toContain("Rs 100<br>+ GST");
    expect(html).not.toContain("[br]");
  });

  test("section title in buildDynamicSections does not render [br] in h2", () => {
    const text = `[Section: Important Dates]
Last Date : 22 June[br]2026`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    const titleMatch = html.match(/<h2 class="section-title">\s*([\s\S]*?)\s*<span class="section-icon">/);
    expect(titleMatch).toBeTruthy();
    expect(titleMatch[1]).not.toContain("<br");
    expect(titleMatch[1]).toContain("Important Dates");
    expect(html).toContain("22 June<br>2026");
  });

  test("link-box label supports [br]", () => {
    const html = renderLinesToHtml(["Apply Online[br]Registration=https://example.com"], {
      sectionName: "ImportantLinks"
    });
    expect(html).toContain("Apply Online<br>Registration");
    expect(html).toContain("https://example.com");
  });
});
