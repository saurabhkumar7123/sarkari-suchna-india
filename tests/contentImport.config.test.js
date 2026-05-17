const {
  isContentImportEnabled,
  isLegacyCsvStaticHtmlEnabled
} = require("../server/config/contentImport");

describe("contentImport feature flags", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  test("content import enabled by default when unset", () => {
    delete process.env.CONTENT_IMPORT_ENABLED;
    expect(isContentImportEnabled()).toBe(true);
  });

  test("legacy static HTML off by default when unset", () => {
    delete process.env.CSV_LEGACY_STATIC_HTML;
    expect(isLegacyCsvStaticHtmlEnabled()).toBe(false);
  });

  test("legacy static HTML on when CSV_LEGACY_STATIC_HTML=1", () => {
    process.env.CSV_LEGACY_STATIC_HTML = "1";
    expect(isLegacyCsvStaticHtmlEnabled()).toBe(true);
  });
});
