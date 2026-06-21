"use strict";

const { normalizeJobPageShareInHtml } = require("../server/lib/jobPageShare");

describe("jobPageShare", () => {
  it("injects share script and removes legacy tools.js on job pages", () => {
    const html = `<section class="social-share-bar"></section><script src="/js/tools.js"></script></body>`;
    const out = normalizeJobPageShareInHtml(html);
    expect(out).toContain('src="/js/job-page-share.js?v=2"');
    expect(out).not.toContain("/js/tools.js");
  });
});
