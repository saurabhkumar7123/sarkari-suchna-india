"use strict";

const {
  DESKTOP_SECTION_KEYS,
  MOBILE_SECTION_KEYS,
  buildHomepageSectionDefs,
  sortHomeSectionResults
} = require("../server/lib/homeSectionOrder");

describe("homeSectionOrder", () => {
  test("desktop predefined order matches product spec", () => {
    expect(DESKTOP_SECTION_KEYS).toEqual([
      "result",
      "admit-card",
      "latest-job",
      "answer-key",
      "document",
      "admission",
      "syllabus"
    ]);
  });

  test("mobile predefined order matches product spec", () => {
    expect(MOBILE_SECTION_KEYS).toEqual([
      "result",
      "latest-job",
      "answer-key",
      "admit-card",
      "document",
      "admission",
      "syllabus"
    ]);
  });

  test("section defs expose desktop and mobile order indices", () => {
    const defs = buildHomepageSectionDefs(["notification"]);
    const byKey = Object.fromEntries(defs.map((d) => [d.section, d]));

    expect(byKey.result.orderDesktop).toBe(1);
    expect(byKey.result.orderMobile).toBe(1);
    expect(byKey["admit-card"].orderDesktop).toBe(2);
    expect(byKey["admit-card"].orderMobile).toBe(4);
    expect(byKey["latest-job"].orderDesktop).toBe(3);
    expect(byKey["latest-job"].orderMobile).toBe(2);
    expect(byKey["custom:notification"].orderDesktop).toBe(8);
    expect(byKey["custom:notification"].orderMobile).toBe(8);
  });

  test("sortHomeSectionResults orders mobile differently from desktop", () => {
    const rows = [
      { def: { section: "admit-card", orderDesktop: 2, orderMobile: 4 } },
      { def: { section: "latest-job", orderDesktop: 3, orderMobile: 2 } },
      { def: { section: "result", orderDesktop: 1, orderMobile: 1 } }
    ];
    expect(sortHomeSectionResults(rows, "desktop").map((r) => r.def.section)).toEqual([
      "result",
      "admit-card",
      "latest-job"
    ]);
    expect(sortHomeSectionResults(rows, "mobile").map((r) => r.def.section)).toEqual([
      "result",
      "latest-job",
      "admit-card"
    ]);
  });
});
