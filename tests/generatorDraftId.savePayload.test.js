"use strict";

const fs = require("fs");
const path = require("path");
const { adminPagePayloadSchema } = require("../server/validations/admin.validation");

/**
 * Mirrors public/assets/js/generator.js buildGeneratorDraftIdPayloadField.
 * Client must omit generatorDraftId when unset — Joi rejects null.
 */
function buildGeneratorDraftIdPayloadField(draftId) {
  const id =
    draftId == null || draftId === ""
      ? null
      : Number.isInteger(draftId)
        ? draftId
        : parseInt(String(draftId).trim(), 10);
  if (Number.isInteger(id) && id > 0) {
    return { generatorDraftId: id };
  }
  return {};
}

function collectRecruitmentContext(recruitmentId, eventId) {
  if (!recruitmentId) return {};
  const rid = parseInt(String(recruitmentId), 10);
  const out = {
    recruitment_id: Number.isInteger(rid) && rid > 0 ? rid : String(recruitmentId).trim()
  };
  if (eventId) {
    const eid = parseInt(String(eventId), 10);
    out.recruitment_event_id =
      Number.isInteger(eid) && eid > 0 ? eid : String(eventId).trim();
  }
  return out;
}

function basePagePayload(extra) {
  return {
    title: "UP Police Constable Recruitment 2026",
    content: "[Section: Short Information]\nOfficial notice body for publish validation.",
    status: "latest job",
    smallBoxSlot: "",
    ...extra
  };
}

describe("generatorDraftId save payload (recruitment binding)", () => {
  test("null generatorDraftId is rejected by server schema (root cause)", () => {
    const { error } = adminPagePayloadSchema.validate(
      basePagePayload({ generatorDraftId: null }),
      { abortEarly: false }
    );
    expect(error).toBeTruthy();
    expect(String(error.message)).toMatch(/generatorDraftId.*number.*string/i);
  });

  test("omitted generatorDraftId is accepted", () => {
    const { error, value } = adminPagePayloadSchema.validate(basePagePayload({}));
    expect(error).toBeUndefined();
    expect(value.generatorDraftId).toBeUndefined();
  });

  test("numeric generatorDraftId is accepted", () => {
    const { error, value } = adminPagePayloadSchema.validate(
      basePagePayload({ generatorDraftId: 104 })
    );
    expect(error).toBeUndefined();
    expect(value.generatorDraftId).toBe(104);
  });

  test("client helper omits invalid / missing draft ids", () => {
    expect(buildGeneratorDraftIdPayloadField(null)).toEqual({});
    expect(buildGeneratorDraftIdPayloadField("")).toEqual({});
    expect(buildGeneratorDraftIdPayloadField("generatorDraftId")).toEqual({});
    expect(buildGeneratorDraftIdPayloadField(0)).toEqual({});
    expect(buildGeneratorDraftIdPayloadField(-3)).toEqual({});
  });

  test("client helper sends positive integer draft id", () => {
    expect(buildGeneratorDraftIdPayloadField(42)).toEqual({ generatorDraftId: 42 });
    expect(buildGeneratorDraftIdPayloadField("99")).toEqual({ generatorDraftId: 99 });
  });

  test("recruitment + no event save payload validates", () => {
    const payload = basePagePayload({
      ...buildGeneratorDraftIdPayloadField(null),
      ...collectRecruitmentContext(23, null)
    });
    expect(payload).not.toHaveProperty("generatorDraftId");
    expect(payload.recruitment_id).toBe(23);
    expect(payload).not.toHaveProperty("recruitment_event_id");
    const { error } = adminPagePayloadSchema.validate(payload);
    expect(error).toBeUndefined();
  });

  test("recruitment + event save payload validates", () => {
    const payload = basePagePayload({
      ...buildGeneratorDraftIdPayloadField(null),
      ...collectRecruitmentContext(23, 7)
    });
    expect(payload.recruitment_id).toBe(23);
    expect(payload.recruitment_event_id).toBe(7);
    const { error } = adminPagePayloadSchema.validate(payload);
    expect(error).toBeUndefined();
  });

  test("existing draft + recruitment save payload validates", () => {
    const payload = basePagePayload({
      ...buildGeneratorDraftIdPayloadField(104),
      ...collectRecruitmentContext(23, null)
    });
    expect(payload.generatorDraftId).toBe(104);
    const { error } = adminPagePayloadSchema.validate(payload);
    expect(error).toBeUndefined();
  });

  test("existing draft + recruitment + event save payload validates", () => {
    const payload = basePagePayload({
      ...buildGeneratorDraftIdPayloadField(104),
      ...collectRecruitmentContext(23, 9)
    });
    const { error, value } = adminPagePayloadSchema.validate(payload);
    expect(error).toBeUndefined();
    expect(value.generatorDraftId).toBe(104);
    expect(value.recruitment_id).toBe(23);
    expect(value.recruitment_event_id).toBe(9);
  });

  test("no recruitment + no event continues to work", () => {
    const payload = basePagePayload({
      ...buildGeneratorDraftIdPayloadField(null),
      ...collectRecruitmentContext(null, null)
    });
    expect(payload).not.toHaveProperty("generatorDraftId");
    expect(payload).not.toHaveProperty("recruitment_id");
    const { error } = adminPagePayloadSchema.validate(payload);
    expect(error).toBeUndefined();
  });

  test("generator.js contains omit helper and publish confirmation context", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../public/assets/js/generator.js"),
      "utf8"
    );
    expect(src).toContain("function buildGeneratorDraftIdPayloadField");
    expect(src).toContain("...buildGeneratorDraftIdPayloadField(getGeneratorDraftId())");
    expect(src).toContain("confirmManualPublishSummary");
    expect(src).toContain("Public Page Title");
    expect(src).toContain("updateRecruitmentContextCard");
    expect(src).toContain("setSaveState");
  });

  test("recruitments UI shows human-readable section guidance and success copy", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../private/admin-recruitments.html"),
      "utf8"
    );
    const js = fs.readFileSync(
      path.join(__dirname, "../public/assets/js/admin-recruitment-operations.js"),
      "utf8"
    );
    expect(html).toContain("rom-section-purpose");
    expect(html).toContain("Binding does not publish");
    expect(html).toContain("One recruitment = one permanent public page");
    expect(js).toContain("Draft linked successfully");
    expect(js).toContain("Draft detached successfully");
    expect(js).toContain("Page linked successfully");
    expect(js).toContain("Event added successfully");
    expect(js).toContain("Recruitment created successfully");
    expect(js).toMatch(/draft\.title \|\| \"Untitled\"/);
    expect(js).toContain("/generator?draftId=");
    expect(html).toContain("openBoundDraftGeneratorBtn");
    expect(html).toContain("manualUpdateOpenGenerator");
  });

  test("generator HTML distinguishes public page title and context card", () => {
    const html = fs.readFileSync(path.join(__dirname, "../private/generator.html"), "utf8");
    expect(html).toContain("Public page title");
    expect(html).toContain("generatorContextCard");
    expect(html).toContain("generatorSaveState");
    expect(html).toContain("generatorBindingVisual");
    expect(html).toContain("Local browser backup only");
  });
});
