const { renderLinesToHtml } = require("../generator/builders/lineRenderer");

describe("lineRenderer display capitalization", () => {
  const prev = process.env.DISPLAY_TEXT_CAPITALIZE;

  afterEach(() => {
    if (prev === undefined) delete process.env.DISPLAY_TEXT_CAPITALIZE;
    else process.env.DISPLAY_TEXT_CAPITALIZE = prev;
  });

  test("flag off leaves lowercase labels unchanged", () => {
    delete process.env.DISPLAY_TEXT_CAPITALIZE;
    const html = renderLinesToHtml(["last date: 30 january 2026"]);
    expect(html).toContain("last date");
    expect(html).toContain("30 january 2026");
  });

  test("flag on title-cases key-value rows", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    const html = renderLinesToHtml(["apply online=https://example.com"]);
    expect(html).toContain("Apply Online");
    expect(html).toContain("https://example.com");
  });
});
