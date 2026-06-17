"use strict";

const pageRepository = require("../server/repositories/page.repository");

describe("selectTopViews recency filter", () => {
  test("includes badges and recency clause when recentDays is set", async () => {
    const queries = [];
    const executor = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql, params });
        return [[{ slug: "ssc-cgl", title: "SSC CGL", views: 12, badges: '["NEW"]' }]];
      })
    };

    const rows = await pageRepository.selectTopViews(5, executor, { recentDays: 30 });

    expect(rows).toHaveLength(1);
    expect(queries[0].sql).toContain("badges");
    expect(queries[0].sql).toContain("DATE_SUB(NOW(), INTERVAL ? DAY)");
    expect(queries[0].params).toEqual([30, 5]);
  });
});
