"use strict";

const {
  ALLOWED_COLORS,
  hasRichInlineTags,
  renderRichBodyDisplayHtml
} = require("../generator/lib/richInlineText");
const {
  escapeBodyDisplayText,
  escapeDisplayText
} = require("../generator/lib/displayTextNormalize");
const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildTable } = require("../generator/builders/tableBuilder");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("rich inline text", () => {
  test("hasRichInlineTags ignores [br] and markdown-only", () => {
    expect(hasRichInlineTags("Line one[br]Line two")).toBe(false);
    expect(hasRichInlineTags("See [Site](https://example.com)")).toBe(false);
    expect(hasRichInlineTags("[b]Bold[/b]")).toBe(true);
    expect(hasRichInlineTags("[color=red]x[/color]")).toBe(true);
  });

  test("[b] renders strong.rt-bold", () => {
    const html = renderRichBodyDisplayHtml("Apply [b]before deadline[/b] today.");
    expect(html).toContain('<strong class="rt-bold">');
    expect(html).toContain("before deadline");
    expect(html).toContain("Apply ");
    expect(html).not.toContain("[b]");
  });

  test("[color=red] renders span.rt-color--red", () => {
    const html = renderRichBodyDisplayHtml("Last Date: [color=red]22 June 2026[/color]");
    expect(html).toContain('class="rt-color rt-color--red"');
    expect(html).toContain("22 June 2026");
    expect(html).not.toContain("[color=red]");
  });

  test("[highlight] renders mark.rt-highlight", () => {
    const html = renderRichBodyDisplayHtml("[highlight]Apply Before The Deadline[/highlight]");
    expect(html).toContain('<mark class="rt-highlight">');
    expect(html).toContain("Apply Before The Deadline");
  });

  test("nested [color=red][b]…[/b][/color]", () => {
    const html = renderRichBodyDisplayHtml(
      "[color=red][b]Important Notice[/b][/color]"
    );
    expect(html).toContain('class="rt-color rt-color--red"');
    expect(html).toContain('<strong class="rt-bold">');
    expect(html).toContain("Important Notice");
    expect(html).toMatch(/rt-color[^>]*>[\s\S]*<strong class="rt-bold">/);
  });

  test("nested [highlight][b]…[/b][/highlight]", () => {
    const html = renderRichBodyDisplayHtml(
      "[highlight][b]Apply Before Last Date[/b][/highlight]"
    );
    expect(html).toContain("rt-highlight");
    expect(html).toContain("rt-bold");
    expect(html).toContain("Apply Before Last Date");
  });

  test.each(ALLOWED_COLORS.filter((c) => c !== "red"))(
    "[color=%s] renders span.rt-color--%s",
    (color) => {
      const html = renderRichBodyDisplayHtml(`[color=${color}]Sample text[/color]`);
      expect(html).toContain(`class="rt-color rt-color--${color}"`);
      expect(html).toContain("Sample text");
      expect(html).not.toContain(`[color=${color}]`);
    }
  );

  test("invalid color values render as plain escaped literal", () => {
    const invalid = [
      "[color=#ff0000]Text[/color]",
      "[color=rgb(255,0,0)]Text[/color]",
      "[color=black]Text[/color]",
      "[color=cyan]Text[/color]",
      "[color=random]Text[/color]"
    ];
    for (const input of invalid) {
      const html = renderRichBodyDisplayHtml(input);
      expect(html).not.toContain("rt-color");
      expect(html).toContain("Text");
      expect(html).toMatch(/\[color=/);
    }
  });

  test("nested [color=green][highlight]Application Started[/highlight][/color]", () => {
    const html = renderRichBodyDisplayHtml(
      "[color=green][highlight]Application Started[/highlight][/color]"
    );
    expect(html).toContain("rt-color--green");
    expect(html).toContain("rt-highlight");
    expect(html).toContain("Application Started");
  });

  test("colors work in important dates, fee, FAQ, table, and links", () => {
    const dates = renderLinesToHtml(
      ["Last Date: [color=orange][b]22 June 2026[/b][/color]"],
      { sectionName: "Important Dates" }
    );
    expect(dates).toContain("rt-color--orange");

    const fee = renderLinesToHtml(
      ["For General: [color=purple]Rs. 100/-[/color]"],
      { sectionName: "Application Fee" }
    );
    expect(fee).toContain("rt-color--purple");

    const faq = renderLinesToHtml(
      ["Q: [color=blue][b]Last date[/b][/color]?", "A: [color=gray]22 June 2026[/color]"],
      { sectionName: "FAQ" }
    );
    expect(faq).toContain("rt-color--blue");
    expect(faq).toContain("rt-color--gray");

    const table = buildTable("Fee,Amount\nGeneral,[color=yellow][b]Rs. 50[/b][/color]");
    expect(table).toContain("rt-color--yellow");

    const links = renderLinesToHtml(
      ["Apply Online: [color=green]Link Active[/color]"],
      { sectionName: "Important Links" }
    );
    expect(links).toContain("rt-color--green");
  });

  test("unclosed [b] treats remainder as plain escaped text", () => {
    const html = renderRichBodyDisplayHtml("[b]Open only");
    expect(html).toContain("rt-bold");
    expect(html).not.toContain("[b]");
  });

  test("XSS in plain text is escaped", () => {
    const html = renderRichBodyDisplayHtml("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script/i);
  });

  test("XSS in tag body is escaped", () => {
    const html = renderRichBodyDisplayHtml("[b]<img onerror=alert(1)>[/b]");
    expect(html).toContain("&lt;img");
    expect(html).not.toMatch(/<img/i);
  });

  test("[br] still works with rich tags", () => {
    const html = renderRichBodyDisplayHtml("Line[br][b]Bold[/b]");
    expect(html).toContain("Line<br>");
    expect(html).toContain("rt-bold");
  });

  test("markdown link with rich label and surrounding rich", () => {
    const html = renderRichBodyDisplayHtml(
      "Read [color=red][Notice](https://example.com/n.pdf)[/color] now."
    );
    expect(html).toContain("inline-markdown-link");
    expect(html).toContain("rt-color");
    expect(html).toContain("https://example.com/n.pdf");
  });

  test("backward compat: plain text matches legacy escapeBodyDisplayText", () => {
    const plain = "Last Date: 22 June 2026";
    expect(renderRichBodyDisplayHtml(plain)).toBe(escapeBodyDisplayText(plain, { mode: "title" }));
    expect(hasRichInlineTags(plain)).toBe(false);
    expect(escapeBodyDisplayText(plain, { mode: "title" })).toBe("Last Date: 22 June 2026");
  });

  test("backward compat: [br] only matches legacy", () => {
    const text = "Line one[br]Line two";
    expect(hasRichInlineTags(text)).toBe(false);
    expect(escapeBodyDisplayText(text)).toBe("Line one<br>Line two");
  });

  test("date row value with rich tags", () => {
    const html = renderLinesToHtml(
      ["Last Date: [color=red][b]22 June 2026[/b][/color]"],
      { sectionName: "Important Dates" }
    );
    expect(html).toContain("date-row");
    expect(html).toContain("rt-color--red");
    expect(html).toContain("rt-bold");
    expect(html).toContain("22 June 2026");
  });

  test("application fee style rows", () => {
    const html = renderLinesToHtml(
      ["For General: [color=red]Rs. 100/-[/color]"],
      { sectionName: "Application Fee" }
    );
    expect(html).toContain("date-row");
    expect(html).toContain("rt-color--red");
  });

  test("important links status with highlight", () => {
    const html = renderLinesToHtml(
      ["Apply Online: [highlight]Closing Soon[/highlight]"],
      { sectionName: "Important Links" }
    );
    expect(html).toContain("link-box-status");
    expect(html).toContain("rt-highlight");
  });

  test("FAQ question and answer with rich text", () => {
    const html = renderLinesToHtml(
      [
        "Q: What is the [b]last date[/b]?",
        "A: The date is [color=red]22 June 2026[/color]."
      ],
      { sectionName: "FAQ" }
    );
    expect(html).toContain("faq-item");
    expect(html).toContain("rt-bold");
    expect(html).toContain("rt-color--red");
    expect(html).toContain("<strong>");
  });

  test("table cell with rich text", () => {
    const html = buildTable("Fee,Amount\nGeneral,[color=red][b]Rs. 100[/b][/color]");
    expect(html).toContain("rt-color--red");
    expect(html).toContain("rt-bold");
    expect(html).not.toContain("[color=red]");
  });

  test("table merge markers unchanged with rich cell", () => {
    const html = buildTable(
      "Post,Fee\nClerk,[b]Rs. 500[/b]\n-,Result"
    );
    expect(html).toContain('rowspan="2"');
    expect(html).toContain("rt-bold");
  });

  test("paragraph in buildDynamicSections", () => {
    const text = `[Section: Short Information]
[highlight]Apply Before The Deadline[/highlight]`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain("rt-highlight");
    expect(html).toContain("<p>");
  });

  test("paragraph with markdown and rich uses unified path", () => {
    const html = renderLinesToHtml(
      ["Visit [b][Official Site](/apply)[/b] today."],
      { sectionName: "Short Information" }
    );
    expect(html).toContain("rt-bold");
    expect(html).toContain("inline-markdown-link");
    expect(html).toContain("<p>");
  });

  test("section title does not parse rich tags", () => {
    const text = `[Section: Important Dates]
Last Date: [b]1 Jan 2026[/b]`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    const titleMatch = html.match(/<h2 class="section-title">\s*([\s\S]*?)\s*<span class="section-icon">/);
    expect(titleMatch[1]).toContain("Important Dates");
    expect(titleMatch[1]).not.toContain("rt-bold");
    expect(html).toContain("rt-bold");
  });

  test("escapeDisplayText never applies rich tags", () => {
    const out = escapeDisplayText("[b]Title[/b]");
    expect(out).toBe("[b]Title[/b]");
  });
});
