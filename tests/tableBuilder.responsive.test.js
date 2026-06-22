"use strict";

const { buildTable } = require("../generator/builders/tableBuilder");

describe("buildTable responsive classes", () => {
  it("uses default table classes for narrow tables", () => {
    const html = buildTable("Post,Category,Posts\nConstable,General,100");
    expect(html).toContain('class="table-responsive"');
    expect(html).toContain('class="table"');
    expect(html).not.toContain("table--wide");
  });

  it("does not emit leading or trailing whitespace inside table cells", () => {
    const html = buildTable("POSTS, ELIGIBILITY\nTET Primary,TET rules");
    expect(html).toContain("<th>POSTS</th>");
    expect(html).toContain("<th>ELIGIBILITY</th>");
    expect(html).toContain("<td>TET Primary</td>");
    expect(html).not.toMatch(/<th>\s+POSTS/);
    expect(html).not.toMatch(/<th>ELIGIBILITY\s+<\/th>/);
    expect(html).not.toMatch(/<td>\s+TET/);
  });

  it("marks wide tables with table--wide when 5+ columns", () => {
    const html = buildTable("A,B,C,D,E\n1,2,3,4,5");
    expect(html).toContain("table-responsive--wide");
    expect(html).toContain("table--wide");
  });
});
