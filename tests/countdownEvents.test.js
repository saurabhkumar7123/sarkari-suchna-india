"use strict";

const { formatEventTimeForClient } = require("../server/lib/eventTimeFormat");

describe("eventTimeFormat", () => {
  it("formats Date objects for countdown clients", () => {
    expect(formatEventTimeForClient(new Date("2026-08-01T14:30:00"))).toBe("2026-08-01T14:30");
  });

  it("normalizes MySQL datetime strings", () => {
    expect(formatEventTimeForClient("2026-08-01 14:30:00")).toBe("2026-08-01T14:30");
  });

  it("keeps datetime-local strings", () => {
    expect(formatEventTimeForClient("2026-08-01T14:30")).toBe("2026-08-01T14:30");
  });

  it("returns null for empty values", () => {
    expect(formatEventTimeForClient(null)).toBeNull();
    expect(formatEventTimeForClient("")).toBeNull();
  });
});
