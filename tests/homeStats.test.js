"use strict";

jest.mock("../server/repositories/page.repository", () => ({
  selectDepartmentCounts: jest.fn()
}));

jest.mock("../server/services/cache.services", () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  delCache: jest.fn()
}));

const pageRepository = require("../server/repositories/page.repository");
const cacheServices = require("../server/services/cache.services");
const homeStats = require("../server/services/homeStats.service");

describe("homeStats.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheServices.getCache.mockResolvedValue(null);
    cacheServices.setCache.mockResolvedValue(undefined);
  });

  it("returns only whitelist boards with count > 0, sorted by count desc", async () => {
    pageRepository.selectDepartmentCounts.mockResolvedValue([
      { slug: "railway", page_count: 3 },
      { slug: "ssc", page_count: 2 },
      { slug: "teaching", page_count: 2 },
      { slug: "police", page_count: 1 },
      { slug: "upsc", page_count: 0 },
      { slug: "typo-board", page_count: 99 }
    ]);

    const boards = await homeStats.recomputeTaxonomyStats();

    expect(boards.boards.map((b) => b.slug)).toEqual(["railway", "ssc", "teaching", "police"]);
    expect(boards.boards[0]).toMatchObject({
      slug: "railway",
      label: "Railway",
      href: "/tag/railway",
      count: 3
    });
    expect(cacheServices.setCache).toHaveBeenCalledWith(
      homeStats.CACHE_KEY,
      expect.objectContaining({ boards: expect.any(Array) }),
      homeStats.TTL_SEC
    );
  });

  it("serves cached taxonomy stats without querying the database", async () => {
    const cached = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      boards: [{ slug: "ssc", label: "SSC", href: "/tag/ssc", count: 5 }]
    };
    cacheServices.getCache.mockResolvedValue(JSON.stringify(cached));

    const stats = await homeStats.getTaxonomyStats();

    expect(stats).toEqual(cached);
    expect(pageRepository.selectDepartmentCounts).not.toHaveBeenCalled();
  });

  it("getPopularBoards returns boards array from stats", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [{ slug: "bank", label: "Bank", href: "/tag/bank", count: 1 }]
      })
    );

    const boards = await homeStats.getPopularBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].slug).toBe("bank");
  });
});
