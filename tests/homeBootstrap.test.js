"use strict";

const {
  BOOTSTRAP_VERSION,
  buildHomeBootstrap,
  serializeHomeBootstrapForHtml,
  buildHomeBootstrapScriptTag
} = require("../server/lib/homeBootstrap");
const { renderHomepageBadgesHtml } = require("../server/lib/homepageBadges");

describe("homeBootstrap", () => {
  describe("buildHomeBootstrap", () => {
    it("builds v1 payload mirroring API response shapes", () => {
      const breakingNews = [{ title: "Test", url: "/test", badges: ["NEW"] }];
      const smallBoxes = [{ title: "Box", slug: "box" }];
      const sectionDefs = [{ section: "result", ribbonStatus: "Result", href: "/result" }];
      const sectionResults = [
        {
          def: sectionDefs[0],
          payload: { success: true, data: [{ title: "Job", slug: "job" }], pagination: { page: 1 } }
        }
      ];
      const trendingJobs = [{ title: "Trend", slug: "trend" }];

      const popularBoards = [{ slug: "railway", label: "Railway", href: "/tag/railway", count: 3 }];

      const boot = buildHomeBootstrap({
        breakingNews,
        smallBoxes,
        trendingJobs,
        sectionDefs,
        sectionResults,
        popularBoards
      });

      expect(boot.v).toBe(BOOTSTRAP_VERSION);
      expect(boot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(boot.breakingNews).toEqual(breakingNews);
      expect(boot.smallBoxes).toEqual(smallBoxes);
      expect(boot.sections).toEqual(sectionDefs);
      expect(boot.sectionPages).toEqual(sectionResults);
      expect(boot.popularBoards).toEqual(popularBoards);
      expect(boot.trending).toEqual({ success: true, data: trendingJobs });
    });

    it("defaults missing arrays to empty", () => {
      const boot = buildHomeBootstrap({});
      expect(boot.breakingNews).toEqual([]);
      expect(boot.smallBoxes).toEqual([]);
      expect(boot.sections).toEqual([]);
      expect(boot.sectionPages).toEqual([]);
      expect(boot.popularBoards).toEqual([]);
      expect(boot.trending).toEqual({ success: true, data: [] });
    });
  });

  describe("serializeHomeBootstrapForHtml", () => {
    it("escapes < to prevent script breakout", () => {
      const json = serializeHomeBootstrapForHtml({ title: "</script><img onerror=alert(1)>" });
      expect(json).not.toContain("</script>");
      expect(json).toContain("\\u003c/script>");
      expect(json).toContain("\\u003cimg");
    });
  });

  describe("buildHomeBootstrapScriptTag", () => {
    it("emits application/json script with id and version attribute", () => {
      const tag = buildHomeBootstrapScriptTag(buildHomeBootstrap({}));
      expect(tag).toMatch(/^<script type="application\/json" id="home-bootstrap"/);
      expect(tag).toContain(`data-home-bootstrap-v="${BOOTSTRAP_VERSION}"`);
      expect(tag).toContain('"v":1');
      expect(tag.endsWith("</script>")).toBe(true);
    });
  });
});

describe("homepageBadges SSR", () => {
  it("renders whitelisted badge codes with existing CSS classes", () => {
    const html = renderHomepageBadgesHtml(["NEW", "OUT", "DECLARED", "NEW"]);
    expect(html).toContain('class="tag new"');
    expect(html).toContain("NEW");
    expect(html).toContain('class="tag out"');
    expect((html.match(/NEW/g) || []).length).toBe(1);
  });
});
