"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  normalizeHighlightBannerInHtml,
  extractBannerContextFromHtml
} = require("../server/lib/highlightBannerHtml");
const { buildHighlightBannerFields } = require("../server/lib/highlightBanner");
const {
  bannerStatusBadge,
  bannerOrgName,
  shortBannerTitle,
  extractBannerFact,
  formatPostsWithCommas,
  bannerAdvtDisplay,
  bannerThemeClass
} = require("../server/lib/highlightBanner");

describe("highlightBanner", () => {
  test("status badge maps vacancy type", () => {
    expect(bannerStatusBadge("new form", "SSC CGL Online Form 2026")).toBe("Apply Online");
    expect(bannerStatusBadge("admit card", "UP Police SI Admit Card 2026")).toBe("Admit Card");
    expect(bannerStatusBadge("result", "UP PGT Result 2026")).toBe("Result Declared");
    expect(bannerStatusBadge("general", "SSC GD Answer Key 2026")).toBe("Answer Key");
  });

  test("org name detects recruiting body", () => {
    expect(bannerOrgName("SSC CGL Online Form 2026", "ssc cgl", "")).toBe("SSC");
    expect(bannerOrgName("RRB NTPC 2026", "railway", "")).toBe("RRB");
    expect(bannerOrgName("UP Police Constable 2026", "police", "")).toBe("UP Police");
  });

  test("short title trims action words and post counts", () => {
    expect(shortBannerTitle("SSC CGL Online Form 2026 (12256 Posts)", "SSC CGL")).toBe("SSC CGL 2026");
    expect(shortBannerTitle("UP Police SI DV & PST Admit Card 2026", "SUB INSPECTOR")).toContain("2026");
  });

  test("banner fact prefers last date from section text", () => {
    const text = `[Section: ImportantDates]
Online Apply Last Date: 22 June 2026
Exam Date: August 2026`;
    expect(extractBannerFact(text)).toBe("Last Date: 22 June 2026");
  });

  test("formats posts with Indian commas", () => {
    expect(formatPostsWithCommas("12256")).toBe("12,256");
    expect(formatPostsWithCommas("25487")).toBe("25,487");
  });

  test("advt fallback uses org when missing", () => {
    expect(bannerAdvtDisplay("-", "SSC")).toBe("SSC");
    expect(bannerAdvtDisplay("Advt No. 3/2026", "SSC")).toBe("Advt No. 3/2026");
  });

  test("theme class for categories", () => {
    expect(bannerThemeClass("SSC CGL 2026", "ssc", "new form")).toBe("theme-ssc");
    expect(bannerThemeClass("RRB ALP 2026", "railway", "new form")).toBe("theme-railway");
    expect(bannerThemeClass("CTET September 2026", "ctet", "new form")).toBe("theme-teaching");
  });

  test("buildHighlightBannerFields returns poster fields", () => {
    const fields = buildHighlightBannerFields({
      title: "SSC CGL Online Form 2026 (12256 Posts)",
      text: `[Section: ImportantDates]
Online Apply Last Date: 22 June 2026`,
      category: "ssc cgl",
      normalizedStatus: "new form",
      postName: "SSC CGL",
      totalPosts: "12256",
      advertisementNo: "-"
    });

    expect(fields.BANNER_STATUS_BADGE).toBe("Apply Online");
    expect(fields.BANNER_ORG).toBe("SSC");
    expect(fields.BANNER_TITLE_SHORT).toBe("SSC CGL 2026");
    expect(fields.BANNER_ACTION).toBe("Online Form Started");
    expect(fields.BANNER_FACT).toBe("Last Date: 22 June 2026");
    expect(fields.TOTAL_POSTS_FORMATTED).toBe("12,256");
    expect(fields.BANNER_THEME_CLASS).toBe("theme-ssc");
  });

  test("normalizeHighlightBannerInHtml resolves placeholders from saved job HTML", async () => {
    const fixturePath = path.join(__dirname, "..", "generated", "jobs", "police-1.html");
    const html = await fs.readFile(fixturePath, "utf8");
    if (!html.includes("{{BANNER_")) return;

    const out = normalizeHighlightBannerInHtml(html);
    expect(out).not.toContain("{{BANNER_ADVT_DISPLAY}}");
    expect(out).not.toContain("{{BANNER_TITLE_SHORT}}");
    expect(out).not.toContain("{{BANNER_STATUS_BADGE}}");
    expect(out).toContain("10/2026");
    expect(out).toMatch(/uttar pradesh police|UP Police/i);
  });

  test("extractBannerContextFromHtml reads title and advt from job page", async () => {
    const fixturePath = path.join(__dirname, "..", "generated", "jobs", "police-1.html");
    const html = await fs.readFile(fixturePath, "utf8");
    const ctx = extractBannerContextFromHtml(html);
    expect(ctx.title).toMatch(/uttar pradesh police/i);
    expect(ctx.advertisementNo).toBe("10/2026");
    expect(ctx.totalPosts).toBe("50000");
  });
});
