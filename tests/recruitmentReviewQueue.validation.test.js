"use strict";

const {
  recruitmentReviewQueueListQuerySchema,
  recruitmentReviewQueueNotesSchema,
  recruitmentReviewQueueActionSchema
} = require("../server/validations/admin.validation");

describe("recruitment review queue validation", () => {
  test("accepts valid list query filters", () => {
    const { error, value } = recruitmentReviewQueueListQuerySchema.validate({
      page: "2",
      limit: "10",
      status: "pending",
      event_type: "admit_card",
      recruitment_id: "5",
      search: "SSC"
    });
    expect(error).toBeUndefined();
    expect(value.status).toBe("pending");
    expect(value.event_type).toBe("admit_card");
  });

  test("rejects invalid status filter", () => {
    const { error } = recruitmentReviewQueueListQuerySchema.validate({
      status: "done"
    });
    expect(error).toBeTruthy();
  });

  test("accepts needs_matching status filter", () => {
    const { error, value } = recruitmentReviewQueueListQuerySchema.validate({
      status: "needs_matching"
    });
    expect(error).toBeUndefined();
    expect(value.status).toBe("needs_matching");
  });

  test("accepts resolve-matching body", () => {
    const { recruitmentReviewQueueResolveSchema } = require("../server/validations/admin.validation");
    const { error, value } = recruitmentReviewQueueResolveSchema.validate({
      action: "attach",
      recruitment_id: 10,
      notes: "Matched to SSC CGL"
    });
    expect(error).toBeUndefined();
    expect(value.action).toBe("attach");
  });

  test("rejects invalid event type filter", () => {
    const { error } = recruitmentReviewQueueListQuerySchema.validate({
      event_type: "not_an_event"
    });
    expect(error).toBeTruthy();
  });

  test("requires notes field for notes update", () => {
    const { error } = recruitmentReviewQueueNotesSchema.validate({});
    expect(error).toBeTruthy();
  });

  test("allows empty notes string", () => {
    const { error, value } = recruitmentReviewQueueNotesSchema.validate({ notes: "" });
    expect(error).toBeUndefined();
    expect(value.notes).toBe("");
  });

  test("action body allows optional notes", () => {
    const { error } = recruitmentReviewQueueActionSchema.validate({ notes: "optional" });
    expect(error).toBeUndefined();
  });
});
