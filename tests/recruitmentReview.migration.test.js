"use strict";

const fs = require("fs");
const path = require("path");

describe("recruitment review queue Phase 27 migration", () => {
  const sqlPath = path.join(
    __dirname,
    "../db/migrations/2026-07-14-recruitment-review-queue-persistence.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  test("migration file exists and is additive ALTER only", () => {
    expect(sql).toMatch(/ALTER TABLE `recruitment_review_queue`/);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
  });

  test("adds required persistence columns", () => {
    expect(sql).toMatch(/event_type/);
    expect(sql).toMatch(/match_result_json/);
    expect(sql).toMatch(/confidence/);
    expect(sql).toMatch(/source_url/);
    expect(sql).toMatch(/title/);
    expect(sql).toMatch(/raw_notice_json/);
    expect(sql).toMatch(/normalized_notice_json/);
    expect(sql).toMatch(/processor_output_json/);
    expect(sql).toMatch(/decision/);
    expect(sql).toMatch(/notes/);
  });

  test("expands review_status enum for Phase 22 statuses", () => {
    expect(sql).toMatch(/under_review/);
    expect(sql).toMatch(/approved/);
    expect(sql).toMatch(/rejected/);
    expect(sql).toMatch(/frozen/);
  });
});
