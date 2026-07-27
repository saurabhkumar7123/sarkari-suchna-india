"use strict";

/**
 * Package 4F — Unit tests for SEO & content pipeline completion.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

const { staticPaths } = require("../server/lib/sitemapGenerator");
const {
  listQualificationHubPaths,
  listStateHubPaths,
  listDepartmentHubPaths,
  listExpectedSitemapCoverage
} = require("../server/lib/seo/sitemapCoverage");
const { validateSitemapCoverage } = require("../server/lib/seo/sitemapValidation");
const { validateContentPipeline } = require("../server/lib/seo/contentPipelineValidation");
const { buildEditorialChecklist } = require("../server/lib/seo/editorialChecklist");
const { buildInternalLinkSuggestions } = require("../server/lib/seo/internalLinkingAssistant");
const { buildContentFreshnessIndicator } = require("../server/lib/seo/contentFreshnessStatus");
const {
  buildSeoDiagnosticsPanel,
  findDuplicateTitles
} = require("../server/lib/seo/seoDiagnostics");
const { generateFeatureCompletionReport } = require("../server/lib/seo/featureCompletionReport");

describe("Package 4F sitemap coverage", () => {
  const baseUrl = "https://www.example.com";

  test("staticPaths includes qualification, state, and department hubs", () => {
    const locs = staticPaths(baseUrl).map((e) => e.loc);
    for (const hub of listDepartmentHubPaths()) {
      expect(locs).toContain(`${baseUrl}${hub.path}`);
    }
    for (const hub of listQualificationHubPaths()) {
      expect(locs).toContain(`${baseUrl}${hub.path}`);
    }
    for (const hub of listStateHubPaths()) {
      expect(locs).toContain(`${baseUrl}${hub.path}`);
    }
    expect(locs).toContain(`${baseUrl}/categories`);
    expect(locs).toContain(`${baseUrl}/privacy-policy`);
  });

  test("staticPaths includes topic hubs from categories", () => {
    const locs = staticPaths(baseUrl, { topicCategories: ["SSC CGL", "Railway NTPC"] }).map(
      (e) => e.loc
    );
    expect(locs.some((loc) => loc.includes("/topic/"))).toBe(true);
  });

  test("sitemap validation detects duplicates and missing hubs", () => {
    const expected = listExpectedSitemapCoverage({});
    const partial = expected.slice(0, 5).map((item) => `${baseUrl}${item.path}`);
    partial.push(partial[0]);
    const report = validateSitemapCoverage({
      locs: partial,
      baseUrl
    });
    expect(report.advisory).toBe(true);
    expect(report.summary.duplicateCount).toBeGreaterThanOrEqual(1);
    expect(report.summary.missingCount).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  test("full static coverage validates cleanly", () => {
    const locs = staticPaths(baseUrl).map((e) => e.loc);
    const report = validateSitemapCoverage({ locs, baseUrl });
    expect(report.summary.missingCount).toBe(0);
    expect(report.summary.duplicateCount).toBe(0);
    expect(report.ok).toBe(true);
  });
});

describe("Package 4F content pipeline validation", () => {
  test("flags missing sections and metadata advisories without auto-correct", () => {
    const result = validateContentPipeline({
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026",
      status: "Latest Job",
      rawText: "Short body only",
      seoTitle: "Short",
      metaDescription: "Too short",
      canonicalUrl: "https://www.example.com/ssc-cgl-2026",
      structuredData: false
    });
    expect(result.advisory).toBe(true);
    expect(result.autoCorrect).toBe(false);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.id === "seo_title" && !c.ok)).toBe(true);
  });

  test("passes richer structured content", () => {
    const rawText = `
[Section: Short Information]
SSC CGL recruitment overview.
[Section: Important Dates]
Last Date: 30-12-2026
[Section: Eligibility]
Graduation required.
[Section: Vacancy]
Total Posts: 1000
[Section: Selection Process]
Written test and interview.
[Section: How to Apply]
Apply online on official website.
[Section: Important Links]
https://ssc.gov.in
`;
    const result = validateContentPipeline({
      title: "SSC CGL Recruitment 2026 Apply Online",
      slug: "ssc-cgl-2026",
      status: "Latest Job",
      rawText,
      content: '<a href="/latest-job">Jobs</a><script type="application/ld+json">{"@type":"JobPosting"}</script>',
      seoTitle: "SSC CGL Recruitment 2026 Apply Online | Sarkari Suchna India",
      metaDescription:
        "SSC CGL recruitment update. Check apply online process, last date, eligibility, vacancy details and important links.",
      canonicalUrl: "https://www.example.com/ssc-cgl-2026",
      structuredData: true,
      publishReadyHint: true
    });
    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
  });
});

describe("Package 4F editorial checklist", () => {
  test("reports completion progress for operators", () => {
    const checklist = buildEditorialChecklist({
      rawText: `
[Section: Short Information]
Info
[Section: Important Dates]
Last Date 01-01-2027
[Section: Eligibility]
Graduate
[Section: Vacancy]
100 posts
[Section: Selection Process]
CBT
[Section: How to Apply]
Apply online
[Section: Important Links]
https://example.gov.in
`,
      content: '<img src="/assets/image/logo/favicon.svg" alt="logo">',
      totalPosts: "100",
      lastDate: "2027-01-01",
      qualification: "graduation"
    });
    expect(checklist.advisory).toBe(true);
    expect(checklist.autoCorrect).toBe(false);
    expect(checklist.total).toBe(8);
    expect(checklist.completed).toBeGreaterThanOrEqual(6);
    expect(checklist.percent).toBeGreaterThanOrEqual(70);
    expect(checklist.progressLabel).toMatch(/complete/);
  });
});

describe("Package 4F internal linking assistant", () => {
  test("returns suggestions only and never auto-inserts", () => {
    const result = buildInternalLinkSuggestions({
      page: {
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        department: "ssc",
        qualification: "graduation",
        state: "central",
        category: "SSC CGL"
      },
      candidatePages: [
        { title: "SSC CHSL 2026", slug: "ssc-chsl-2026", department: "ssc" },
        { title: "Railway NTPC", slug: "railway-ntpc", department: "railway" }
      ],
      candidateRecruitments: [
        { id: 9, title: "SSC CGL Cycle", slug: "ssc-cgl-cycle", department: "ssc" }
      ],
      limit: 5
    });
    expect(result.autoInsert).toBe(false);
    expect(result.advisory).toBe(true);
    expect(result.suggestions.relatedDepartments[0].href).toContain("/department/ssc");
    expect(result.suggestions.relatedQualifications[0].href).toContain("/qualification/");
    expect(result.suggestions.relatedStates[0].href).toContain("/state/");
    expect(result.suggestions.relatedTopics.length).toBeGreaterThan(0);
    expect(result.suggestions.relatedPages.some((p) => p.slug === "ssc-chsl-2026")).toBe(true);
  });
});

describe("Package 4F freshness indicators", () => {
  test("exposes created, updated, last review, and status without auto update", () => {
    const freshness = buildContentFreshnessIndicator({
      createdAt: "2026-01-01",
      updatedAt: "2026-06-01",
      contentUpdatedAt: "2026-06-01",
      lastReviewDate: "2026-07-01",
      now: "2026-07-10"
    });
    expect(freshness.autoUpdate).toBe(false);
    expect(freshness.createdDate).toBe("2026-01-01");
    expect(freshness.updatedDate).toBe("2026-06-01");
    expect(freshness.lastReviewDate).toBe("2026-07-01");
    expect(freshness.freshnessStatus).toBe("fresh");
    expect(freshness.freshnessLabel).toBe("Fresh");
  });

  test("marks stale content beyond aging threshold", () => {
    const freshness = buildContentFreshnessIndicator({
      createdAt: "2025-01-01",
      contentUpdatedAt: "2025-01-01",
      now: "2026-07-10"
    });
    expect(freshness.freshnessStatus).toBe("stale");
  });
});

describe("Package 4F SEO diagnostics", () => {
  test("builds operator panel with duplicate titles and validation summary", () => {
    const panel = buildSeoDiagnosticsPanel({
      pages: [
        {
          title: "Same Title",
          slug: "one",
          status: "Latest Job",
          raw_text: "tiny",
          content: "",
          created_at: "2026-01-01",
          updated_at: "2026-01-02"
        },
        {
          title: "Same Title",
          slug: "two",
          status: "Result",
          raw_text: "tiny",
          content: "",
          created_at: "2026-01-01",
          updated_at: "2026-01-02"
        }
      ],
      sitemapLocs: staticPaths("https://www.example.com").map((e) => e.loc),
      baseUrl: "https://www.example.com",
      now: "2026-07-10T00:00:00.000Z"
    });
    expect(panel.externalServices).toBe(false);
    expect(panel.advisory).toBe(true);
    expect(panel.duplicateTitles.length).toBeGreaterThanOrEqual(1);
    expect(panel.validationSummary.scanned).toBe(2);
    expect(panel.summary.duplicateTitleCount).toBeGreaterThanOrEqual(1);
    expect(findDuplicateTitles([{ title: "A" }, { title: "A" }]).length).toBe(1);
  });
});

describe("Package 4F Feature Completion Report", () => {
  test("generates advisory report without authorizing deployment", () => {
    const report = generateFeatureCompletionReport({
      now: "2026-07-19T00:00:00.000Z"
    });
    expect(report.advisory).toBe(true);
    expect(report.authorizesDeployment).toBe(false);
    expect(report.authorizesProgram5).toBe(false);
    expect(report.program4.complete).toBe(true);
    expect(report.completedPackages.map((p) => p.packageCode)).toEqual(
      expect.arrayContaining(["4A", "4B", "4C", "4D", "4E", "4F"])
    );
    expect(report.program5ReadinessRecommendation.locked).toBe(true);
    expect(report.program5ReadinessRecommendation.deploymentAuthorized).toBe(false);
    expect(report.disclaimer).toMatch(/advisory/i);
  });
});

describe("Package 4F content review metadata store", () => {
  test("stores last review date without SQL", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg4f-review-"));
    const storePath = path.join(tmpDir, "reviews.json");
    const original = process.env.CONTENT_REVIEW_METADATA_PATH;
    process.env.CONTENT_REVIEW_METADATA_PATH = storePath;
    jest.resetModules();
    const repo = require("../server/repositories/contentReviewMetadata.repository");
    const row = repo.setLastReviewDate("demo-slug", "2026-07-19", "tester");
    expect(row.lastReviewDate).toBe("2026-07-19");
    expect(repo.getLastReviewDate("demo-slug")).toBe("2026-07-19");
    if (original == null) delete process.env.CONTENT_REVIEW_METADATA_PATH;
    else process.env.CONTENT_REVIEW_METADATA_PATH = original;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
