"use strict";

const { isLikelyBot, isAdminTraffic } = require("../server/services/pageViews.service");

describe("pageViews.service", () => {
  test("detects common bots", () => {
    expect(isLikelyBot({ headers: { "user-agent": "Googlebot/2.1" } })).toBe(true);
    expect(isLikelyBot({ headers: { "user-agent": "Mozilla/5.0 Chrome/120" } })).toBe(false);
  });

  test("skips admin paths", () => {
    expect(isAdminTraffic({ originalUrl: "/admin/dashboard", path: "/admin/dashboard" })).toBe(true);
    expect(isAdminTraffic({ originalUrl: "/police-1", path: "/police-1" })).toBe(false);
  });
});
