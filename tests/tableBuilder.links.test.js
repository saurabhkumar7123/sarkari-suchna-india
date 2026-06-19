"use strict";

const { buildTable } = require("../generator/builders/tableBuilder");
const { parseTableCellLink, renderTableCellContent } = require("../generator/lib/tableCellLink");

describe("tableBuilder table cell links", () => {
  test("normal text cell has no anchor", () => {
    const html = buildTable("Post,Count\nClerk,100");
    expect(html).toContain("Clerk");
    expect(html).not.toContain("table-cell-link");
    expect(html).not.toContain("<a ");
  });

  test("valid link cell renders label as anchor text with sanitized href", () => {
    const html = buildTable(
      "Resource,Link\nApply Online=https://example.com/apply\nDownload Notification=https://example.com/notify.pdf"
    );
    expect(html).toContain('class="table-cell-link"');
    expect(html).toContain('href="https://example.com/apply"');
    expect(html).toContain('href="https://example.com/notify.pdf"');
    expect(html).toContain(">Apply Online</a>");
    expect(html).toContain(">Download Notification</a>");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("Apply Online=https://");
  });

  test("invalid URL falls back to escaped plain text", () => {
    const html = buildTable("Link\nResult=javascript:alert(1)");
    expect(html).not.toContain("table-cell-link");
    expect(html).toContain("Result=javascript:alert(1)");
  });

  test("empty URL falls back to escaped plain text", () => {
    const html = buildTable("Link\nResult=");
    expect(html).not.toContain("table-cell-link");
    expect(html).toContain("Result=");
  });

  test("rowspan and colspan with link cells preserve structure", () => {
    const html = buildTable(
      "Post,Action\nConstable,Apply Online=https://example.com\n-,Result=https://example.com/result"
    );
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('class="table-cell-link"');
    expect(html).toContain(">Apply Online</a>");
    expect(html).toContain(">Result</a>");
    expect(html).toContain('href="https://example.com/result"');
  });

  test("duplicate cell values without merge markers stay separate", () => {
    const html = buildTable("Post,Category\nConstable,General\nConstable,OBC");
    expect(html).not.toContain("rowspan=");
    expect(html).not.toContain("colspan=");
    expect(html.match(/Constable/g)).toHaveLength(2);
  });

  test("colspan applies only with = marker", () => {
    const html = buildTable("Post,Category,Posts\nConstable,General,100");
    expect(html).not.toContain("colspan=");

    const merged = buildTable("Post,Category,Posts\nConstable,General,=\n-,OBC,50");
    expect(merged).toContain("colspan=");
    expect(merged).toContain("General");
    expect(merged).toContain("OBC");
  });
});

describe("tableCellLink helpers", () => {
  test("parseTableCellLink accepts root-relative paths", () => {
    expect(parseTableCellLink("Download=/files/notice.pdf")).toEqual({
      label: "Download",
      safeHref: "/files/notice.pdf"
    });
  });

  test("renderTableCellContent escapes label in link cells", () => {
    const out = renderTableCellContent("Bad<script>=https://example.com");
    expect(out).toContain("table-cell-link");
    expect(out).toContain("Bad&lt;script&gt;");
    expect(out).not.toMatch(/<script>/i);
  });
});
