"use strict";

const {
  hasMarkdownInlineLinks,
  renderParagraphWithInlineMarkdownLinks
} = require("../generator/lib/inlineMarkdownLinks");
const { renderLinesToHtml } = require("../generator/builders/lineRenderer");
const { buildTable } = require("../generator/builders/tableBuilder");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

describe("inline Markdown links (paragraph-only)", () => {
  test("single inline https link", () => {
    const inner = renderParagraphWithInlineMarkdownLinks(
      "Visit [Official Website](https://example.com) for details."
    );
    expect(inner).toContain('class="inline-markdown-link"');
    expect(inner).toContain('href="https://example.com/"');
    expect(inner).toContain("Official Website");
    expect(inner).toContain("Visit ");
    expect(inner).toContain(" for details.");
    expect(inner).not.toContain("[Official Website]");
  });

  test("multiple inline links in one line", () => {
    const inner = renderParagraphWithInlineMarkdownLinks(
      "Download [Notification](https://example.com/a.pdf) and [Apply Online](https://example.com/apply)."
    );
    expect(inner.match(/inline-markdown-link/g)).toHaveLength(2);
    expect(inner).toContain("Notification");
    expect(inner).toContain("Apply Online");
    expect(inner).toContain("https://example.com/a.pdf");
    expect(inner).toContain("https://example.com/apply");
  });

  test("relative URL path", () => {
    const inner = renderParagraphWithInlineMarkdownLinks(
      "See [Notice](/files/notice.pdf) here."
    );
    expect(inner).toContain('href="/files/notice.pdf"');
    expect(inner).toContain("Notice");
  });

  test("http scheme supported", () => {
    const inner = renderParagraphWithInlineMarkdownLinks("Go [Here](http://example.com/path)");
    expect(inner).toContain("http://example.com/path");
  });

  test("unsafe javascript URL renders escaped literal, no anchor", () => {
    const inner = renderParagraphWithInlineMarkdownLinks(
      "Bad [Click](javascript:alert(1)) now"
    );
    expect(inner).not.toContain("inline-markdown-link");
    expect(inner).toContain("javascript:alert(1)");
    expect(inner).not.toMatch(/<script/i);
  });

  test("HTML in link label is escaped", () => {
    const inner = renderParagraphWithInlineMarkdownLinks(
      "See [Bad<script>](https://example.com) end"
    );
    expect(inner).toContain("Bad&lt;script&gt;");
    expect(inner).not.toMatch(/<script>/i);
    expect(inner).toContain('href="https://example.com/"');
  });

  test("text without markdown uses escapeBodyDisplayText only", () => {
    const plain = renderParagraphWithInlineMarkdownLinks("Plain paragraph text.");
    expect(plain).toBe("Plain paragraph text.");
    expect(plain).not.toContain("<a ");
    expect(hasMarkdownInlineLinks("Plain paragraph text.")).toBe(false);
  });

  test("renderLinesToHtml paragraph integrates inline link", () => {
    const html = renderLinesToHtml(
      ["Released by [UPPRPB](https://uppbpb.gov.in) today."],
      { sectionName: "Short Information" }
    );
    expect(html).toContain("<p>");
    expect(html).toContain('class="inline-markdown-link"');
    expect(html).toContain("UPPRPB");
    expect(html).not.toContain('class="link-box"');
  });

  test("Label=url line unchanged (link-box)", () => {
    const html = renderLinesToHtml(["Official Website=https://example.com"], {
      sectionName: "Application Fee"
    });
    expect(html).toContain('class="link-box"');
    expect(html).toContain("Click Here");
    expect(html).not.toContain("inline-markdown-link");
  });

  test("Important Links section unchanged", () => {
    const status = renderLinesToHtml(["Apply Online : Link Activate Soon"], {
      sectionName: "Important Links"
    });
    expect(status).toContain("link-box-status");
    expect(status).not.toContain("inline-markdown-link");

    const urlLine = renderLinesToHtml(["Official Website=https://ssc.gov.in"], {
      sectionName: "ImportantLinks"
    });
    expect(urlLine).toContain("Click Here");
    expect(urlLine).not.toContain("inline-markdown-link");
  });

  test("FAQ Q and A unchanged", () => {
    const html = renderLinesToHtml(
      ["Q: Apply [here](https://example.com)?", "A: See [site](https://example.com)"],
      { sectionName: "FAQ" }
    );
    expect(html).toContain("faq-item");
    expect(html).not.toContain("inline-markdown-link");
    expect(html).toContain("[here]");
    expect(html).toContain("[site]");
  });

  test("full-line URL unchanged", () => {
    const html = renderLinesToHtml(["https://example.com"], { sectionName: "Notes" });
    expect(html).toContain('class="link-box"');
    expect(html).toContain("Click Here");
    expect(html).not.toContain("inline-markdown-link");
  });

  test("date-row colon line unchanged", () => {
    const html = renderLinesToHtml(["Last Date : 22 June 2026"], {
      sectionName: "Important Dates"
    });
    expect(html).toContain("date-row");
    expect(html).not.toContain("inline-markdown-link");
  });

  test("markdown line with https colon is not split as date-row", () => {
    const html = renderLinesToHtml(
      ["Visit [Official Notification](https://example.com/notification.pdf) before applying."],
      { sectionName: "How To Apply" }
    );
    expect(html).toContain("<p>");
    expect(html).toContain("inline-markdown-link");
    expect(html).not.toContain("date-row");
  });

  test("table cell Label=url unchanged", () => {
    const html = buildTable("Resource,Link\nResult,Result=https://example.com/file.pdf");
    expect(html).toContain('class="table-cell-link"');
    expect(html).not.toContain("inline-markdown-link");
    expect(html).toContain(">Result</a>");
  });

  test("table merge markers unchanged", () => {
    const html = buildTable("Post,Action\nConstable,Apply Online=https://example.com\n-,Result=https://example.com/result");
    expect(html).toContain('rowspan="2"');
    expect(html).not.toContain("inline-markdown-link");
  });

  test("buildDynamicSections mixed paragraph and link-box", () => {
    const text = `[Section: How To Apply]
Visit [Official Notification](https://example.com/notification.pdf) before applying.
Official Website=https://example.com`;
    const { html } = buildDynamicSectionsWithWarnings(text);
    expect(html).toContain("inline-markdown-link");
    expect(html).toContain("Official Notification");
    expect(html).toContain("link-box");
    expect(html).toContain("Click Here");
  });
});
