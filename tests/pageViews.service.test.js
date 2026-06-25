"use strict";

const { isLikelyBot, isAdminTraffic, dailyViewsKey } = require("../server/services/pageViews.service");

describe("pageViews.service", () => {
  test("dailyViewsKey uses UTC date", () => {
    const key = dailyViewsKey(new Date("2026-06-25T18:30:00.000Z"));
    expect(key).toBe("pageviews:daily:2026-06-25");
  });

  test("detects common bots", () => {
    expect(isLikelyBot({ headers: { "user-agent": "Googlebot/2.1" } })).toBe(true);
    expect(isLikelyBot({ headers: { "user-agent": "Mozilla/5.0 Chrome/120" } })).toBe(false);
  });

  test("skips admin paths", () => {
    expect(isAdminTraffic({ originalUrl: "/admin/dashboard", path: "/admin/dashboard" })).toBe(true);
    expect(isAdminTraffic({ originalUrl: "/police-1", path: "/police-1" })).toBe(false);
  });
});
