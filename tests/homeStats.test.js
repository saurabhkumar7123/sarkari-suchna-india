"use strict";

jest.mock("../server/repositories/page.repository", () => ({
  selectDepartmentCounts: jest.fn(),
  selectQualificationCounts: jest.fn()
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
    pageRepository.selectQualificationCounts.mockResolvedValue([]);
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

    const stats = await homeStats.recomputeTaxonomyStats();

    expect(stats.boards.map((b) => b.slug)).toEqual(["railway", "ssc", "teaching", "police"]);
    expect(stats.boards[0]).toMatchObject({
      slug: "railway",
      label: "Railway",
      href: "/tag/railway",
      count: 3
    });
    expect(cacheServices.setCache).toHaveBeenCalledWith(
      homeStats.CACHE_KEY,
      expect.objectContaining({ boards: expect.any(Array), qualifications: expect.any(Array) }),
      homeStats.TTL_SEC
    );
  });

  it("returns only whitelist qualifications with count > 0, sorted by count desc", async () => {
    pageRepository.selectDepartmentCounts.mockResolvedValue([]);
    pageRepository.selectQualificationCounts.mockResolvedValue([
      { slug: "graduation", page_count: 7 },
      { slug: "12th", page_count: 2 },
      { slug: "10th", page_count: 1 },
      { slug: "iti", page_count: 0 },
      { slug: "invalid-qual", page_count: 50 }
    ]);

    const stats = await homeStats.recomputeTaxonomyStats();

    expect(stats.qualifications.map((q) => q.slug)).toEqual(["graduation", "12th", "10th"]);
    expect(stats.qualifications[0]).toMatchObject({
      slug: "graduation",
      label: "Graduation",
      href: "/jobs.html?qualification=graduation",
      count: 7
    });
    expect(stats.qualifications[2]).toMatchObject({
      slug: "10th",
      href: "/jobs.html?qualification=10th"
    });
  });

  it("encodes post graduation slug in jobs.html href", () => {
    expect(homeStats.buildQualificationHref("post graduation")).toBe(
      "/jobs.html?qualification=post%20graduation"
    );
  });

  it("serves cached taxonomy stats without querying the database", async () => {
    const cached = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      boards: [{ slug: "ssc", label: "SSC", href: "/tag/ssc", count: 5 }],
      qualifications: [{ slug: "graduation", label: "Graduation", href: "/jobs.html?qualification=graduation", count: 3 }]
    };
    cacheServices.getCache.mockResolvedValue(JSON.stringify(cached));

    const stats = await homeStats.getTaxonomyStats();

    expect(stats).toEqual(cached);
    expect(pageRepository.selectDepartmentCounts).not.toHaveBeenCalled();
    expect(pageRepository.selectQualificationCounts).not.toHaveBeenCalled();
  });

  it("recomputes when cached payload lacks qualifications array", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [{ slug: "ssc", label: "SSC", href: "/tag/ssc", count: 5 }]
      })
    );
    pageRepository.selectDepartmentCounts.mockResolvedValue([{ slug: "ssc", page_count: 5 }]);
    pageRepository.selectQualificationCounts.mockResolvedValue([{ slug: "graduation", page_count: 2 }]);

    const stats = await homeStats.getTaxonomyStats();

    expect(pageRepository.selectQualificationCounts).toHaveBeenCalled();
    expect(stats.qualifications).toHaveLength(1);
  });

  it("getPopularQualifications returns qualifications array from stats", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [],
        qualifications: [{ slug: "iti", label: "ITI", href: "/jobs.html?qualification=iti", count: 4 }]
      })
    );

    const qualifications = await homeStats.getPopularQualifications();
    expect(qualifications).toHaveLength(1);
    expect(qualifications[0].slug).toBe("iti");
  });

  it("getPopularBoards returns boards array from stats", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [{ slug: "bank", label: "Bank", href: "/tag/bank", count: 1 }],
        qualifications: []
      })
    );

    const boards = await homeStats.getPopularBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].slug).toBe("bank");
  });
});
