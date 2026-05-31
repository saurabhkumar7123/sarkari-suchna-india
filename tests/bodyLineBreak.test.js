"use strict";

const {
  escapeDisplayText,
  escapeBodyDisplayText
} = require("../generator/lib/displayTextNormalize");
const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildTable } = require("../generator/builders/tableBuilder");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("body [br] line breaks", () => {
  const prevCapitalize = process.env.DISPLAY_TEXT_CAPITALIZE;

  afterEach(() => {
    if (prevCapitalize === undefined) delete process.env.DISPLAY_TEXT_CAPITALIZE;
    else process.env.DISPLAY_TEXT_CAPITALIZE = prevCapitalize;
  });

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

  describe("with DISPLAY_TEXT_CAPITALIZE=1", () => {
    beforeEach(() => {
      process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    });

    test("escapeBodyDisplayText paragraph with [br] renders br element", () => {
      const out = escapeBodyDisplayText("Line One[br]Line Two");
      expect(out).toBe("Line One<br>Line Two");
      expect(out).not.toContain("[br]");
      expect(out).not.toContain("[Br]");
    });

    test("escapeBodyDisplayText table-style cell with [br]", () => {
      const out = escapeBodyDisplayText("18 Years[br]40 Years", { mode: "title" });
      expect(out).toBe("18 Years<br>40 Years");
    });

    test("escapeBodyDisplayText multiple [br] tokens", () => {
      const out = escapeBodyDisplayText("A[br]B[br]C");
      expect(out).toBe("A<br>B<br>C");
    });

    test("escapeBodyDisplayText URL and [br] in same content", () => {
      const out = escapeBodyDisplayText(
        "apply at https://example.com/path[br]before deadline"
      );
      expect(out).toContain("https://example.com/path<br>");
      expect(out).toContain("Apply At");
      expect(out).toContain("Deadline");
      expect(out).not.toContain("[br]");
      expect(out).not.toMatch(/\u0000[UB]\d+\u0000/);
    });

    test("escapeDisplayText title path unchanged (no br element, no placeholder leak)", () => {
      const out = escapeDisplayText("Important Dates[br]2026", { mode: "title" });
      expect(out).toContain("[Br]");
      expect(out).not.toContain("<br");
      expect(out).not.toMatch(/\u0000[UB]\d+\u0000/);
    });

    test("buildTable and renderLinesToHtml with [br] under capitalize", () => {
      const table = buildTable("Field,Value\nAge Limit,18 Years[br]40 Years");
      expect(table).toContain("18 Years<br>40 Years");
      expect(table).not.toContain("[Br]");

      const lines = renderLinesToHtml(["Line One[br]Line Two"], { sectionName: "Test" });
      expect(lines).toContain("Line One<br>Line Two");
      expect(lines).not.toMatch(/\u0000[UB]\d+\u0000/);
    });

    test("no visible placeholder leakage in body output", () => {
      const out = escapeBodyDisplayText("Fee[br]Rs 100[br]+ GST");
      expect(out).not.toMatch(/\u0000/);
      expect(out).not.toContain("[br]");
    });
  });
});
