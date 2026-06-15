const {
  buildHomeViewMoreLabel,
  buildHomeViewMoreAriaLabel,
  getHomeViewMoreAccentClass,
  buildHomeViewMoreLinkHtml
} = require("../server/lib/homeViewMore");

describe("homeViewMore", () => {
  test("buildHomeViewMoreLabel uses count when more items exist", () => {
    expect(buildHomeViewMoreLabel("new form", 7, 42)).toBe("View all 42 New Forms");
    expect(buildHomeViewMoreLabel("result", 7, 7)).toBe("View all Results");
    expect(buildHomeViewMoreLabel("admit card", 5, null)).toBe("View all Admit Cards");
  });

  test("accent class follows ribbon section", () => {
    expect(getHomeViewMoreAccentClass("new form")).toBe("view-more--navy");
    expect(getHomeViewMoreAccentClass("result")).toBe("view-more--green");
    expect(getHomeViewMoreAccentClass("admit card")).toBe("view-more--orange");
  });

  test("buildHomeViewMoreLinkHtml renders ghost CTA markup", () => {
    const html = buildHomeViewMoreLinkHtml(
      { ribbonStatus: "result", href: "/result" },
      { data: new Array(7).fill({}), pagination: { total: 19 } },
      (v) => String(v)
    );

    expect(html).toContain('href="/result"');
    expect(html).toContain("View all 19 Results");
    expect(html).toContain('class="view-more view-more--green"');
    expect(html).toContain('view-more__arrow');
  });

  test("buildHomeViewMoreAriaLabel adds updates suffix", () => {
    expect(buildHomeViewMoreAriaLabel("result", 7, 19)).toBe(
      "View all 19 Results updates"
    );
  });
});
