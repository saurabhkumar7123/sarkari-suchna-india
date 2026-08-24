"use strict";

const { adminPagePayloadSchema } = require("../server/validations/admin.validation");

const UPSC_TITLE =
  "Important Notice regarding filling up of Caste Serial No. by OBC Candidates in CAF for the Posts of Principal and Vice Principal (Special Advt. No. 51 - 2026)";

function basePayload(title) {
  return {
    title,
    content: "[Section: Short Information]\nOfficial notice body for publish validation.",
    status: "document",
    smallBoxSlot: ""
  };
}

describe("page title length compatibility", () => {
  test("158-character official title is accepted and not truncated", () => {
    expect(UPSC_TITLE.length).toBe(158);
    const { error, value } = adminPagePayloadSchema.validate(basePayload(UPSC_TITLE), {
      abortEarly: false
    });
    expect(error).toBeUndefined();
    expect(value.title).toBe(UPSC_TITLE);
    expect(value.title.length).toBe(158);
  });

  test("existing titles of 150 characters or fewer still work", () => {
    const shortTitle = "SSC Combined Hindi Translators Examination 2026";
    expect(shortTitle.length).toBeLessThanOrEqual(150);
    const { error, value } = adminPagePayloadSchema.validate(basePayload(shortTitle));
    expect(error).toBeUndefined();
    expect(value.title).toBe(shortTitle);
  });

  test("titles longer than 500 characters are still rejected", () => {
    const tooLong = "A".repeat(501);
    const { error } = adminPagePayloadSchema.validate(basePayload(tooLong));
    expect(error).toBeTruthy();
  });
});
