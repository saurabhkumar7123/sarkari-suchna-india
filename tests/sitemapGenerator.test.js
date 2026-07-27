"use strict";

const { staticPaths } = require("../server/lib/sitemapGenerator");
const { allBoardHubs } = require("../server/lib/boardHubs");
const {
  listQualificationHubPaths,
  listStateHubPaths
} = require("../server/lib/seo/sitemapCoverage");

describe("sitemapGenerator.staticPaths", () => {
  const baseUrl = "https://www.example.com";
  const entries = staticPaths(baseUrl);
  const locs = entries.map((e) => e.loc);

  it("includes the categories browse page", () => {
    expect(locs).toContain(`${baseUrl}/categories`);
  });

  it("includes every registered board hub URL", () => {
    for (const hub of allBoardHubs()) {
      expect(locs).toContain(`${baseUrl}/department/${hub.slug}`);
    }
  });

  it("includes qualification and state hub URLs", () => {
    for (const hub of listQualificationHubPaths()) {
      expect(locs).toContain(`${baseUrl}${hub.path}`);
    }
    for (const hub of listStateHubPaths()) {
      expect(locs).toContain(`${baseUrl}${hub.path}`);
    }
  });

  it("keeps core static listing routes unchanged", () => {
    expect(locs).toContain(`${baseUrl}/`);
    expect(locs).toContain(`${baseUrl}/search`);
    expect(locs).toContain(`${baseUrl}/latest-job`);
  });
});
