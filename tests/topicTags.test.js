const {
  parseCategoryTags,
  normalizeTopicSlug,
  resolveTagLinkHref,
  topicSearchTokens,
  formatTopicLabel
} = require("../server/lib/topicTags");

describe("topicTags", () => {
  test("parseCategoryTags splits comma-separated values", () => {
    expect(parseCategoryTags("ssc, cgl")).toEqual(["ssc", "cgl"]);
    expect(parseCategoryTags("rrb, technician")).toEqual(["rrb", "technician"]);
  });

  test("normalizeTopicSlug hyphenates phrases", () => {
    expect(normalizeTopicSlug("SSC CGL")).toBe("ssc-cgl");
    expect(normalizeTopicSlug("army")).toBe("army");
  });

  test("resolveTagLinkHref sends board tags to department hubs", () => {
    expect(resolveTagLinkHref("police", "police")).toBe("/department/police");
    expect(resolveTagLinkHref("ssc", "ssc")).toBe("/department/ssc");
  });

  test("resolveTagLinkHref sends non-board tags to topic pages", () => {
    expect(resolveTagLinkHref("ssc, cgl", "ssc-cgl")).toBe("/topic/ssc-cgl");
    expect(resolveTagLinkHref("army", "army")).toBe("/topic/army");
  });

  test("topicSearchTokens splits compound slugs", () => {
    expect(topicSearchTokens("ssc-cgl")).toEqual(["ssc", "cgl"]);
    expect(topicSearchTokens("army")).toEqual(["army"]);
  });

  test("formatTopicLabel title-cases slug words", () => {
    expect(formatTopicLabel("ssc-cgl")).toBe("Ssc Cgl");
  });
});
