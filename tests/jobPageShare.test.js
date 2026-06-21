"use strict";

const { normalizeJobPageShareInHtml } = require("../server/lib/jobPageShare");

describe("jobPageShare", () => {
  it("injects share script and removes legacy tools.js on job pages", () => {
    const html = `<section class="social-share-bar"></section><script src="/js/tools.js"></script></body>`;
    const out = normalizeJobPageShareInHtml(html);
    expect(out).toContain('src="/js/job-page-share.js?v=3"');
    expect(out).not.toContain("/js/tools.js");
  });

  it("restores join channel links when buttons use share URLs", () => {
    const html = `
      <section class="social-share-bar">
        <a href="https://wa.me/?text=hello" class="social-btn whatsapp" aria-label="Share on WhatsApp"></a>
        <a href="https://t.me/share/url?url=x" class="social-btn telegram" aria-label="Share on Telegram"></a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=x" class="social-btn facebook" aria-label="Share on Facebook"></a>
      </section>
    `;
    const out = normalizeJobPageShareInHtml(html);
    expect(out).toContain('href="https://whatsapp.com/channel/0029VbCtmOJIiRoqIP4wgN1n"');
    expect(out).toContain('href="https://t.me/sarkarisuchnaindia"');
    expect(out).toContain('href="https://www.facebook.com/share/1cQMwV2STp/"');
    expect(out).toContain('aria-label="Join WhatsApp Channel"');
  });
});
