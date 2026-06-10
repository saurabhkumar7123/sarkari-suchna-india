"use strict";

const { buildTable } = require("../generator/builders/tableBuilder");
const { renderTableCellContent } = require("../generator/lib/tableCellLink");
const { normalizeBadgeCode, renderHomepageBadgesHtml, renderHomeCardBadgesHtml } = require("../server/lib/homepageBadges");

describe("table cell [list] support", () => {
  test("renders explicit [list] block inside a cell", () => {
    const cell = `[list]
Aadhaar Card
Passport Photo
Signature
[/list]`;
    const html = renderTableCellContent(cell);
    expect(html).toContain('<ul class="content-list">');
    expect(html).toContain("<li>Aadhaar Card</li>");
    expect(html).toContain("<li>Passport Photo</li>");
    expect(html).toContain("<li>Signature</li>");
    expect(html).not.toContain("[list]");
    expect(html).not.toContain("[/list]");
  });

  test("mixed plain text and [list] in one cell", () => {
    const cell = `Required Documents:
[list]
Photo
Signature
[/list]`;
    const html = renderTableCellContent(cell);
    expect(html).toContain("Required Documents:");
    expect(html).toContain('<ul class="content-list">');
    expect(html).toContain("<li>Photo</li>");
    expect(html).toContain("<li>Signature</li>");
    expect(html).toContain("Required Documents:<br><ul");
    expect(html).not.toContain("[list]");
  });

  test("rich color tags inside list items", () => {
    const cell = `[list]
[color=red]Photo[/color]
Signature
[/list]`;
    const html = renderTableCellContent(cell);
    expect(html).toContain("rt-color--red");
    expect(html).toContain("Photo");
    expect(html).toContain("<li>Signature</li>");
    expect(html).not.toContain("[color=red]");
  });

  test("plain cells without [list] line remain unchanged", () => {
    const plain = "Rs. 500";
    expect(renderTableCellContent(plain)).toBe(plain);

    const inlineMention = "See [list] section of the notification";
    const mentionHtml = renderTableCellContent(inlineMention);
    expect(mentionHtml).toBe(inlineMention);
    expect(mentionHtml).not.toContain("content-list");
  });

  test("Label=url cells unchanged", () => {
    const html = buildTable("Resource,Link\nApply Online,Apply Online=https://example.com/apply");
    expect(html).toContain('class="table-cell-link"');
    expect(html).toContain('href="https://example.com/apply"');
    expect(html).toContain(">Apply Online</a>");
    expect(html).not.toContain("Apply Online=https://");
  });

  test("rich inline without [list] unchanged in table", () => {
    const html = buildTable("Fee,Amount\nGeneral,[color=red][b]Rs. 100[/b][/color]");
    expect(html).toContain("rt-color--red");
    expect(html).toContain("rt-bold");
    expect(html).not.toContain("[color=red]");
    expect(html).not.toContain("content-list");
  });

  test("DECLARED as plain table cell text is unchanged", () => {
    const html = buildTable("Status,Note\nDECLARED,Result published");
    expect(html).toContain("DECLARED");
    expect(html).toContain("Result published");
    expect(html).not.toContain("content-list");
    expect(html).not.toContain("home-badge");
  });

  test("buildTable with quoted multiline list cell (TABLE_PARSER_V2)", () => {
    const prev = process.env.TABLE_PARSER_V2;
    process.env.TABLE_PARSER_V2 = "1";
    try {
      const html = buildTable(
        'Item,Details\nDocuments,"[list]\nAadhaar Card\nPassport Photo\nSignature\n[/list]"'
      );
      expect(html).toContain('<ul class="content-list">');
      expect(html).toContain("<li>Aadhaar Card</li>");
      expect(html).toContain("<li>Passport Photo</li>");
      expect(html).toContain("<li>Signature</li>");
      expect(html).not.toContain("[list]");
    } finally {
      if (prev === undefined) delete process.env.TABLE_PARSER_V2;
      else process.env.TABLE_PARSER_V2 = prev;
    }
  });
});

describe("DECLARED badge regression (unchanged)", () => {
  test("normalizeBadgeCode maps DECLARED to OUT", () => {
    expect(normalizeBadgeCode("DECLARED")).toBe("OUT");
  });

  test("homepage DECLARED badge still maps to OUT", () => {
    const html = renderHomepageBadgesHtml(["DECLARED"]);
    expect(html).toContain("OUT");
    expect(html).not.toContain("DECLARED");
  });

  test("home card DECLARED badge still maps to OUT pill", () => {
    const html = renderHomeCardBadgesHtml(["DECLARED"]);
    expect(html).toContain("home-badge--out");
    expect(html).not.toContain("DECLARED");
  });
});
