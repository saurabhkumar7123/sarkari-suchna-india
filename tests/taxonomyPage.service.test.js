"use strict";

jest.mock("../server/services/page.service", () => ({
  listPagesByDepartment: jest.fn(),
  listJobs: jest.fn()
}));

const pageService = require("../server/services/page.service");
const taxonomyPageService = require("../server/services/taxonomyPage.service");

describe("taxonomyPage.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds board hub page from department filter", async () => {
    pageService.listPagesByDepartment.mockResolvedValue({
      success: true,
      data: [{ title: "SSC CGL", slug: "ssc-cgl-2026", url: "/ssc-cgl-2026", status: "new form" }]
    });

    const html = await taxonomyPageService.buildTaxonomyPage({
      type: "board",
      slug: "railway",
      baseUrl: "https://www.example.com",
      headerHtml: "",
      footerHtml: ""
    });

    expect(pageService.listPagesByDepartment).toHaveBeenCalledWith({
      department: "railway",
      page: 1,
      limit: 25
    });
    expect(html).toContain("<h1>Railway Jobs</h1>");
    expect(html).toContain("SSC CGL");
  });

  it("builds qualification hub page from qualification filter", async () => {
    pageService.listJobs.mockResolvedValue({
      jobs: [{ title: "10th Pass Job", page: "/jobs/police-1.html", status: "new form" }],
      pagination: { total: 1, totalPages: 1, currentPage: 1, limit: 25 }
    });

    const html = await taxonomyPageService.buildTaxonomyPage({
      type: "qualification",
      slug: "10th",
      baseUrl: "",
      headerHtml: "",
      footerHtml: ""
    });

    expect(pageService.listJobs).toHaveBeenCalledWith({
      qualification: "10th",
      page: 1,
      limit: 25
    });
    expect(html).toContain("<h1>10th Jobs</h1>");
    expect(html).toContain('href="/police-1"');
  });

  it("builds state hub page from state filter", async () => {
    pageService.listJobs.mockResolvedValue({
      jobs: [{ title: "UP Police", page: "/jobs/up-police-constable-2026.html", status: "result" }],
      pagination: { total: 1, totalPages: 1, currentPage: 1, limit: 25 }
    });

    const html = await taxonomyPageService.buildTaxonomyPage({
      type: "state",
      slug: "all-india",
      baseUrl: "",
      headerHtml: "",
      footerHtml: ""
    });

    expect(pageService.listJobs).toHaveBeenCalledWith({
      state: "all india",
      page: 1,
      limit: 25
    });
    expect(html).toContain("<h1>All India Jobs</h1>");
  });

  it("returns null for unknown taxonomy slug", async () => {
    const html = await taxonomyPageService.buildTaxonomyPage({
      type: "qualification",
      slug: "not-a-real-qual",
      headerHtml: "",
      footerHtml: ""
    });
    expect(html).toBeNull();
    expect(pageService.listJobs).not.toHaveBeenCalled();
  });
});
