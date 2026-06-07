"use strict";

jest.mock("../server/repositories/page.repository", () => ({
  selectDepartmentCounts: jest.fn(),
  selectQualificationCounts: jest.fn(),
  selectStateCounts: jest.fn()
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
    pageRepository.selectStateCounts.mockResolvedValue([]);
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
      expect.objectContaining({
        boards: expect.any(Array),
        qualifications: expect.any(Array),
        states: expect.any(Array)
      }),
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
  });

  it("returns only whitelist states with count > 0, sorted by count desc", async () => {
    pageRepository.selectDepartmentCounts.mockResolvedValue([]);
    pageRepository.selectStateCounts.mockResolvedValue([
      { slug: "all india", page_count: 6 },
      { slug: "uttar pradesh", page_count: 4 },
      { slug: "bihar", page_count: 0 },
      { slug: "invalid-state", page_count: 99 }
    ]);

    const stats = await homeStats.recomputeTaxonomyStats();

    expect(stats.states.map((s) => s.slug)).toEqual(["all india", "uttar pradesh"]);
    expect(stats.states[0]).toMatchObject({
      slug: "all india",
      label: "All India",
      href: "/jobs.html?state=all%20india",
      count: 6
    });
    expect(stats.states[1]).toMatchObject({
      slug: "uttar pradesh",
      label: "Uttar Pradesh",
      href: "/jobs.html?state=uttar%20pradesh",
      count: 4
    });
  });

  it("encodes spaced slugs in jobs.html hrefs", () => {
    expect(homeStats.buildQualificationHref("post graduation")).toBe(
      "/jobs.html?qualification=post%20graduation"
    );
    expect(homeStats.buildStateHref("uttar pradesh")).toBe("/jobs.html?state=uttar%20pradesh");
  });

  it("serves cached taxonomy stats without querying the database", async () => {
    const cached = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      boards: [{ slug: "ssc", label: "SSC", href: "/tag/ssc", count: 5 }],
      qualifications: [{ slug: "graduation", label: "Graduation", href: "/jobs.html?qualification=graduation", count: 3 }],
      states: [{ slug: "delhi", label: "Delhi", href: "/jobs.html?state=delhi", count: 2 }]
    };
    cacheServices.getCache.mockResolvedValue(JSON.stringify(cached));

    const stats = await homeStats.getTaxonomyStats();

    expect(stats).toEqual(cached);
    expect(pageRepository.selectDepartmentCounts).not.toHaveBeenCalled();
    expect(pageRepository.selectQualificationCounts).not.toHaveBeenCalled();
    expect(pageRepository.selectStateCounts).not.toHaveBeenCalled();
  });

  it("recomputes when cached payload lacks states array", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [{ slug: "ssc", label: "SSC", href: "/tag/ssc", count: 5 }],
        qualifications: [{ slug: "graduation", label: "Graduation", href: "/jobs.html?qualification=graduation", count: 2 }]
      })
    );
    pageRepository.selectDepartmentCounts.mockResolvedValue([{ slug: "ssc", page_count: 5 }]);
    pageRepository.selectQualificationCounts.mockResolvedValue([{ slug: "graduation", page_count: 2 }]);
    pageRepository.selectStateCounts.mockResolvedValue([{ slug: "uttar pradesh", page_count: 3 }]);

    const stats = await homeStats.getTaxonomyStats();

    expect(pageRepository.selectStateCounts).toHaveBeenCalled();
    expect(stats.states).toHaveLength(1);
    expect(stats.states[0].slug).toBe("uttar pradesh");
  });

  it("getPopularStates returns states array from stats", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [],
        qualifications: [],
        states: [{ slug: "bihar", label: "Bihar", href: "/jobs.html?state=bihar", count: 2 }]
      })
    );

    const states = await homeStats.getPopularStates();
    expect(states).toHaveLength(1);
    expect(states[0].slug).toBe("bihar");
  });

  it("getPopularQualifications returns qualifications array from stats", async () => {
    cacheServices.getCache.mockResolvedValue(
      JSON.stringify({
        generatedAt: "2026-01-01T00:00:00.000Z",
        boards: [],
        qualifications: [{ slug: "iti", label: "ITI", href: "/jobs.html?qualification=iti", count: 4 }],
        states: []
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
        qualifications: [],
        states: []
      })
    );

    const boards = await homeStats.getPopularBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].slug).toBe("bank");
  });
});
