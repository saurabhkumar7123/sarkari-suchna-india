/**
 * Phase 6 live verification (read-only). Does not modify .env or PM2.
 * Usage: node scripts/verify-ssc-api-integration.js
 */
process.env.SSC_USE_API = "1";

const { checkSite, buildSignature } = require("../server/services/updates/siteChecker");
const { extractSscNoticeItems } = require("../server/services/updates/sscNoticeChecker");

const helpers = {
  buildSignature,
  normalizeText: (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
};

(async () => {
  console.log("=== A. Live SSC API extract ===");
  const extracted = await extractSscNoticeItems({ id: 1, name: "SSC" }, helpers);
  if (extracted.invalid) {
    console.log("FAIL", extracted.reason);
    process.exit(1);
  }
  console.log("OK notices:", extracted.items.length);
  const sample = extracted.items[0];
  console.log("sample title:", sample.title.slice(0, 100));
  console.log("sample link:", sample.link);
  console.log("sample fingerprint:", sample.fingerprint.slice(0, 60) + "...");

  console.log("\n=== B. Mapped item fields ===");
  const required = ["title", "link", "fingerprint"];
  const missing = required.filter((k) => !sample[k]);
  console.log(missing.length ? "FAIL missing " + missing.join(",") : "OK all fields present");

  console.log("\n=== C/D. checkSite baseline (no alert) ===");
  const baselineResult = await checkSite({
    id: 1,
    name: "SSC",
    url: "https://ssc.gov.in/",
    selector: 'a[href*="Notice"]',
    lastContent: ""
  });
  console.log(JSON.stringify({
    establishBaseline: baselineResult.establishBaseline,
    shouldNotify: baselineResult.shouldNotify,
    reason: baselineResult.reason,
    changed: baselineResult.changed,
    invalid: baselineResult.invalid
  }, null, 2));

  console.log("\n=== E. UPSC HTML path (flag on, non-SSC host) ===");
  delete process.env.SSC_USE_API;
  const upscResult = await checkSite({
    id: 2,
    name: "UPSC",
    url: "https://upsc.gov.in/",
    selector: 'a[href*="notice"]',
    lastContent: ""
  }).catch((err) => ({ error: err.message }));
  console.log(JSON.stringify({
    invalid: upscResult.invalid,
    reason: upscResult.reason,
    establishBaseline: upscResult.establishBaseline,
    error: upscResult.error
  }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
