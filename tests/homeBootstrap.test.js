"use strict";

const {
  BOOTSTRAP_VERSION,
  buildHomeBootstrap,
  serializeHomeBootstrapForHtml,
  buildHomeBootstrapScriptTag
} = require("../server/lib/homeBootstrap");
const {
  renderHomepageBadgesHtml,
  renderHomeCardBadgesHtml,
  normalizeBadgeCode,
  ALLOWED_BADGE_CODES
} = require("../server/lib/homepageBadges");
const { ALLOWED_BADGE_CODES: VALIDATION_BADGE_CODES } = require("../server/validations/admin.validation");

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

      const popularBoards = [{ slug: "railway", label: "Railway", href: "/department/railway", count: 3 }];
      const popularQualifications = [
        { slug: "graduation", label: "Graduation", href: "/qualification/graduation", count: 7 }
      ];
      const popularStates = [
        { slug: "uttar pradesh", label: "Uttar Pradesh", href: "/state/uttar-pradesh", count: 4 }
      ];

      const boot = buildHomeBootstrap({
        breakingNews,
        smallBoxes,
        trendingJobs,
        sectionDefs,
        sectionResults,
        popularBoards,
        popularQualifications,
        popularStates
      });

      expect(boot.v).toBe(BOOTSTRAP_VERSION);
      expect(boot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(boot.breakingNews).toEqual(breakingNews);
      expect(boot.smallBoxes).toEqual(smallBoxes);
      expect(boot.sections).toEqual(sectionDefs);
      expect(boot.sectionPages).toEqual(sectionResults);
      expect(boot.popularBoards).toEqual(popularBoards);
      expect(boot.popularQualifications).toEqual(popularQualifications);
      expect(boot.popularStates).toEqual(popularStates);
      expect(boot.trending).toEqual({ success: true, data: trendingJobs });
    });

    it("defaults missing arrays to empty", () => {
      const boot = buildHomeBootstrap({});
      expect(boot.breakingNews).toEqual([]);
      expect(boot.smallBoxes).toEqual([]);
      expect(boot.sections).toEqual([]);
      expect(boot.sectionPages).toEqual([]);
      expect(boot.popularBoards).toEqual([]);
      expect(boot.popularQualifications).toEqual([]);
      expect(boot.popularStates).toEqual([]);
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

describe("homepageBadges whitelist sync", () => {
  it("server badge codes match admin validation whitelist", () => {
    expect(ALLOWED_BADGE_CODES).toEqual(VALIDATION_BADGE_CODES);
    expect(ALLOWED_BADGE_CODES).toEqual(["NEW", "OUT", "START", "SOON"]);
  });
});

describe("homepageBadges normalizeBadgeCode", () => {
  it("maps legacy DECLARED to OUT", () => {
    expect(normalizeBadgeCode("DECLARED")).toBe("OUT");
    expect(normalizeBadgeCode("declared")).toBe("OUT");
  });
});

describe("homepageBadges SSR — breaking news (legacy .tag)", () => {
  it("renders NEW and OUT with legacy tag classes", () => {
    const html = renderHomepageBadgesHtml(["NEW", "OUT"]);
    expect(html).toContain('class="tag new"');
    expect(html).toContain('class="tag out"');
    expect(html).not.toContain("home-badge");
    expect(html).not.toContain("home-card-badge-sep");
  });

  it("maps DECLARED to OUT label with tag out class", () => {
    const html = renderHomepageBadgesHtml(["DECLARED"]);
    expect(html).toContain('class="tag out"');
    expect(html).toContain("OUT");
    expect(html).not.toContain("DECLARED");
  });

  it("caps at 2 badges and dedupes", () => {
    const html = renderHomepageBadgesHtml(["NEW", "OUT", "START", "NEW"]);
    expect(html).toContain("NEW");
    expect(html).toContain("OUT");
    expect(html).not.toContain("START");
    expect((html.match(/NEW/g) || []).length).toBe(1);
  });
});

describe("homepageBadges SSR — card grid (.home-badge)", () => {
  it("renders NEW with home-badge--new and en-dash separator", () => {
    const html = renderHomeCardBadgesHtml(["NEW"]);
    expect(html).toContain('class="home-card-badge-group"');
    expect(html).toContain('class="home-card-badge-sep"');
    expect(html).toContain('class="home-badge home-badge--new"');
    expect(html).toContain("NEW");
    expect(html).not.toContain('class="tag new"');
  });

  it("renders OUT with home-badge--out", () => {
    const html = renderHomeCardBadgesHtml(["OUT"]);
    expect(html).toContain('class="home-badge home-badge--out"');
    expect(html).toContain("OUT");
  });

  it("renders START with home-badge--start", () => {
    const html = renderHomeCardBadgesHtml(["START"]);
    expect(html).toContain('class="home-badge home-badge--start"');
    expect(html).toContain("START");
  });

  it("renders SOON with home-badge--soon", () => {
    const html = renderHomeCardBadgesHtml(["SOON"]);
    expect(html).toContain('class="home-badge home-badge--soon"');
    expect(html).toContain("SOON");
  });

  it("maps legacy DECLARED to OUT pill on cards", () => {
    const html = renderHomeCardBadgesHtml(["DECLARED"]);
    expect(html).toContain('class="home-badge home-badge--out"');
    expect(html).toContain("OUT");
    expect(html).not.toContain("DECLARED");
  });

  it("renders up to two card badges", () => {
    const html = renderHomeCardBadgesHtml(["START", "SOON", "NEW"]);
    expect(html).toContain("START");
    expect(html).toContain("SOON");
    expect(html).not.toContain("home-badge--new");
  });

  it("returns empty for invalid or empty codes", () => {
    expect(renderHomeCardBadgesHtml([])).toBe("");
    expect(renderHomeCardBadgesHtml(["INVALID"])).toBe("");
  });
});
