"use strict";

const { embedRelatedJobsInJobHtml } = require("../server/lib/relatedJobsEmbed");

describe("embedRelatedJobsInJobHtml", () => {
  test("embeds into empty related-posts placeholder", () => {
    const html = '<main><div id="related-posts"></div></main>';
    const out = embedRelatedJobsInJobHtml(html, "ssc-cgl-2026", [
      { title: "SSC CHSL", slug: "ssc-chsl" }
    ]);
    expect(out).toContain('data-related-embedded="1"');
    expect(out).toContain("SSC CHSL");
    expect(out).toContain('data-related-from="ssc-cgl-2026"');
  });

  test("replaces existing embedded block on republish", () => {
    const html =
      '<div id="related-posts" data-related-embedded="1"><div class="related-section">Old</div></div>';
    const out = embedRelatedJobsInJobHtml(html, "police-1", [{ title: "Police 2", slug: "police-2" }]);
    expect(out).toContain("Police 2");
    expect(out).not.toContain("Old");
  });
});
