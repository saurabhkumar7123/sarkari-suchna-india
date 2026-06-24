const { pageMatchesQuery } = require("../server/services/search.service");

describe("search query matching", () => {
  test("matches title", () => {
    expect(pageMatchesQuery({ title: "SSC CGL Form 2026", slug: "x" }, "ssc cgl")).toBe(true);
  });

  test("matches category tags", () => {
    expect(
      pageMatchesQuery(
        { title: "Some Notification", category: "ssc, cgl", slug: "some-notification" },
        "cgl"
      )
    ).toBe(true);
  });

  test("matches post_name", () => {
    expect(
      pageMatchesQuery({ title: "Form 2026", post_name: "SSC CGL", slug: "form-2026" }, "ssc cgl")
    ).toBe(true);
  });

  test("matches slug", () => {
    expect(pageMatchesQuery({ title: "X", slug: "rrb-technician-2026" }, "technician")).toBe(true);
  });
});
