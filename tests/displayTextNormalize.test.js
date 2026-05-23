const {
  normalizeDisplayText,
  escapeDisplayText,
  isDisplayTextCapitalizeEnabled,
  isAcronymWord,
  capitalizeLatinWord
} = require("../generator/lib/displayTextNormalize");

describe("displayTextNormalize", () => {
  const prev = process.env.DISPLAY_TEXT_CAPITALIZE;

  afterEach(() => {
    if (prev === undefined) delete process.env.DISPLAY_TEXT_CAPITALIZE;
    else process.env.DISPLAY_TEXT_CAPITALIZE = prev;
  });

  test("disabled by default", () => {
    delete process.env.DISPLAY_TEXT_CAPITALIZE;
    expect(isDisplayTextCapitalizeEnabled()).toBe(false);
    expect(normalizeDisplayText("hello world")).toBe("hello world");
  });

  test("title case when enabled", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(normalizeDisplayText("eligibility criteria")).toBe("Eligibility Criteria");
    expect(normalizeDisplayText("important dates")).toBe("Important Dates");
    expect(normalizeDisplayText("apply online")).toBe("Apply Online");
    expect(normalizeDisplayText("official WEBSITE")).toBe("Official Website");
    expect(normalizeDisplayText("UP police recruitment notification")).toBe(
      "UP Police Recruitment Notification"
    );
  });

  test("preserves acronyms", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(isAcronymWord("UP")).toBe(true);
    expect(isAcronymWord("UPSC")).toBe(true);
    expect(isAcronymWord("AI")).toBe(true);
    expect(normalizeDisplayText("UPSC and SSC exams")).toBe("UPSC And SSC Exams");
  });

  test("preserves URLs and emails", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(normalizeDisplayText("apply at https://example.com/path now")).toBe(
      "Apply At https://example.com/path Now"
    );
    expect(normalizeDisplayText("contact admin@example.com today")).toBe(
      "Contact admin@example.com Today"
    );
  });

  test("does not modify Devanagari text", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    const hindi = "उत्तर प्रदेश पुलिस भर्ती";
    expect(normalizeDisplayText(hindi)).toBe(hindi);
  });

  test("mixed Hindi and English capitalizes Latin only", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(normalizeDisplayText("UP पुलिस recruitment")).toBe("UP पुलिस Recruitment");
  });

  test("idempotent on already correct text", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(normalizeDisplayText("Important Dates")).toBe("Important Dates");
    expect(normalizeDisplayText("Eligibility Criteria")).toBe("Eligibility Criteria");
  });

  test("preserves numeric content", () => {
    process.env.DISPLAY_TEXT_CAPITALIZE = "1";
    expect(normalizeDisplayText("32679 posts")).toBe("32679 Posts");
    expect(normalizeDisplayText("31 december 2025")).toBe("31 December 2025");
  });

  test("capitalizeLatinWord handles edge cases", () => {
    expect(capitalizeLatinWord("UP")).toBe("UP");
    expect(capitalizeLatinWord("WEBSITE")).toBe("Website");
    expect(capitalizeLatinWord("hello")).toBe("Hello");
  });
});
