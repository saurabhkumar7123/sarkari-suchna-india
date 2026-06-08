"use strict";

describe("selectSmallBoxes query contract", () => {
  it("orders by small_box_slot ascending with legacy fallback", () => {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../server/repositories/page.repository.js"),
      "utf8"
    );
    expect(source).toMatch(/small_box_slot AS smallBoxSlot/);
    expect(source).toMatch(/ORDER BY[\s\S]*small_box_slot IS NOT NULL THEN small_box_slot ELSE 100 END ASC/);
    expect(source).toMatch(/LIMIT 4/);
    expect(source).not.toMatch(/SELECT title, slug FROM pages WHERE position='small' AND deleted=0 LIMIT 4/);
  });
});
