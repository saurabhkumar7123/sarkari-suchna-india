"use strict";

const fs = require("fs");
const path = require("path");

describe("invalidatePageCaches board hub coverage", () => {
  it("scans pages:board:* keys in Redis invalidation loop", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../server/services/cache.services.js"),
      "utf8"
    );
    expect(source).toMatch(/MATCH:\s*"pages:board:\*"/);
    expect(source).toMatch(/pages:board:\*/);
    expect(source).toMatch(/home:taxonomy-stats:v1/);
  });
});
