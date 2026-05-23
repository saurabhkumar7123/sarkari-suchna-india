const {
  buildSignature,
  normalizeStoredBaseline,
  isStoredFingerprint,
  itemMatchesBaseline
} = require("../server/services/updates/siteChecker");

describe("siteChecker monitoring baseline", () => {
  test("isStoredFingerprint detects sig format", () => {
    const fp = buildSignature("hello world");
    expect(isStoredFingerprint(fp)).toBe(true);
    expect(isStoredFingerprint("plain text")).toBe(false);
  });

  test("normalizeStoredBaseline uses direct sig or legacy text", () => {
    const fp = buildSignature("Post Title https://example.com");
    const fromSig = normalizeStoredBaseline(fp);
    expect(fromSig.hasBaseline).toBe(true);
    expect(fromSig.fingerprint).toBe(fp);

    const fromText = normalizeStoredBaseline("Post Title https://example.com");
    expect(fromText.hasBaseline).toBe(true);
    expect(fromText.fingerprint).toBe(fp);
  });

  test("itemMatchesBaseline compares without re-hash", () => {
    const fp = buildSignature("Same Title");
    const baseline = normalizeStoredBaseline(fp);
    expect(itemMatchesBaseline(fp, baseline)).toBe(true);
    expect(itemMatchesBaseline(buildSignature("Other Title"), baseline)).toBe(false);
  });

  test("empty last_content has no baseline", () => {
    const baseline = normalizeStoredBaseline("");
    expect(baseline.hasBaseline).toBe(false);
  });
});
