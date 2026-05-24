"use strict";

const { buildTable } = require("../generator/builders/tableBuilder");

describe("buildTable responsive classes", () => {
  it("uses default table classes for narrow tables", () => {
    const html = buildTable("Post,Category,Posts\nConstable,General,100");
    expect(html).toContain('class="table-responsive"');
    expect(html).toContain('class="table"');
    expect(html).not.toContain("table--wide");
  });

  it("marks wide tables with table--wide when 5+ columns", () => {
    const html = buildTable("A,B,C,D,E\n1,2,3,4,5");
    expect(html).toContain("table-responsive--wide");
    expect(html).toContain("table--wide");
  });
});
