"use strict";

const {
  buildPageQualityFlags,
  normalizeTitleForMatch,
  titleSimilarityScore,
  isActiveJobStatus
} = require("../server/lib/pageAdminInsights");

describe("pageAdminInsights", () => {
  test("isActiveJobStatus recognizes job-like statuses", () => {
    expect(isActiveJobStatus("latest job")).toBe(true);
    expect(isActiveJobStatus("New Form")).toBe(true);
    expect(isActiveJobStatus("admit card")).toBe(false);
  });

  test("buildPageQualityFlags flags missing metadata on active jobs", () => {
    const flags = buildPageQualityFlags({
      status: "latest job",
      title: "SSC CGL",
      state: "",
      department: ""
    });
    const codes = flags.map((f) => f.code);
    expect(codes).toContain("no_last_date");
    expect(codes).toContain("no_state");
    expect(codes).toContain("no_dept");
    expect(codes).toContain("short_title");
  });

  test("buildPageQualityFlags skips last-date flag for non-job status", () => {
    const flags = buildPageQualityFlags({
      status: "result",
      title: "SSC CGL Result 2026 declared",
      state: "central",
      department: "ssc"
    });
    expect(flags.map((f) => f.code)).not.toContain("no_last_date");
  });

  test("normalizeTitleForMatch strips extensions and punctuation", () => {
    expect(normalizeTitleForMatch("SSC-CGL_2026.pdf")).toBe("ssc cgl 2026");
    expect(normalizeTitleForMatch("  UP Police   SI  ")).toBe("up police si");
  });

  test("titleSimilarityScore detects exact and partial matches", () => {
    expect(titleSimilarityScore("SSC CGL 2026", "SSC CGL 2026")).toBe(1);
    expect(titleSimilarityScore("SSC CGL 2026 Notification", "SSC CGL 2026")).toBeGreaterThanOrEqual(0.9);
    expect(titleSimilarityScore("RRB NTPC", "SSC CGL")).toBeLessThan(0.5);
  });
});
