"use strict";

const {
  REVIEW_STATUS,
  REVIEW_DECISIONS,
  createReviewItem,
  validateReviewItem,
  updateReviewDecision,
  freezeReviewItem
} = require("../server/lib/recruitment/reviewQueue");

function baseInput(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    eventType: "admit_card",
    sourceUrl: "https://ssc.nic.in/admit-card-2026.pdf",
    createdAt: "2026-07-13T10:00:00.000Z",
    matchResult: {
      match: true,
      confidence: "high",
      matchedSignals: ["ORGANIZATION", "EXAM", "YEAR"],
      conflictingSignals: []
    },
    confidence: "high",
    ...overrides
  };
}

describe("reviewQueue", () => {
  describe("constants", () => {
    test("REVIEW_STATUS exposes immutable status values", () => {
      expect(REVIEW_STATUS).toEqual({
        PENDING: "pending",
        UNDER_REVIEW: "under_review",
        APPROVED: "approved",
        REJECTED: "rejected",
        FROZEN: "frozen"
      });
      expect(() => {
        REVIEW_STATUS.PENDING = "changed";
      }).toThrow();
    });

    test("REVIEW_DECISIONS exposes immutable decision values", () => {
      expect(REVIEW_DECISIONS).toEqual({
        APPROVE: "approve",
        REJECT: "reject",
        SKIP: "skip",
        NONE: "none"
      });
      expect(() => {
        REVIEW_DECISIONS.APPROVE = "changed";
      }).toThrow();
    });
  });

  describe("createReviewItem", () => {
    test("creates a pending review item with defaults", () => {
      const item = createReviewItem(baseInput({ recruitmentId: 42, notes: "Needs review" }));

      expect(item).toEqual({
        recruitmentId: 42,
        eventType: "admit_card",
        matchResult: {
          match: true,
          confidence: "high",
          matchedSignals: ["ORGANIZATION", "EXAM", "YEAR"],
          conflictingSignals: []
        },
        confidence: "high",
        sourceUrl: "https://ssc.nic.in/admit-card-2026.pdf",
        title: "SSC CGL 2026 Admit Card",
        createdAt: "2026-07-13T10:00:00.000Z",
        status: REVIEW_STATUS.PENDING,
        decision: REVIEW_DECISIONS.NONE,
        notes: "Needs review",
        frozen: false
      });
    });

    test("uses deterministic createdAt when omitted", () => {
      const item = createReviewItem({
        title: "SSC CGL Notification",
        eventType: "notification"
      });

      expect(item.createdAt).toBe("1970-01-01T00:00:00.000Z");
      expect(item.status).toBe(REVIEW_STATUS.PENDING);
      expect(item.decision).toBe(REVIEW_DECISIONS.NONE);
    });

    test("allows optional recruitmentId to be omitted", () => {
      const item = createReviewItem(baseInput({ recruitmentId: undefined }));
      expect(item.recruitmentId).toBeNull();
    });
  });

  describe("validateReviewItem", () => {
    test("returns valid for a well-formed review item", () => {
      const item = createReviewItem(baseInput());
      const result = validateReviewItem(item);

      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    test("returns sorted validation errors for missing required fields", () => {
      const result = validateReviewItem({
        title: "",
        eventType: "",
        createdAt: "",
        status: REVIEW_STATUS.PENDING,
        decision: REVIEW_DECISIONS.NONE,
        frozen: false
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        "createdAt is required",
        "eventType is required",
        "title is required"
      ]);
    });

    test("rejects invalid status and decision constants", () => {
      const item = createReviewItem(baseInput());
      item.status = "archived";
      item.decision = "defer";

      const result = validateReviewItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(["decision is invalid", "status is invalid"]);
    });

    test("rejects invalid eventType and confidence", () => {
      const item = {
        ...createReviewItem(baseInput()),
        eventType: "holiday_notice",
        confidence: "maybe",
        matchResult: null
      };

      const result = validateReviewItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(["confidence is invalid", "eventType is invalid"]);
    });

    test("rejects invalid recruitmentId and matchResult shape", () => {
      const item = {
        ...createReviewItem(baseInput()),
        recruitmentId: -1,
        matchResult: {
          match: "maybe",
          confidence: "high",
          matchedSignals: "ORGANIZATION",
          conflictingSignals: []
        }
      };

      const result = validateReviewItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        "matchResult.match is invalid",
        "matchResult.matchedSignals must be an array",
        "recruitmentId must be a positive integer"
      ]);
    });

    test("rejects inconsistent confidence between item and matchResult", () => {
      const item = createReviewItem(
        baseInput({
          confidence: "medium",
          matchResult: {
            match: true,
            confidence: "high",
            matchedSignals: [],
            conflictingSignals: []
          }
        })
      );

      const result = validateReviewItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "confidence must match matchResult.confidence when both are present"
      );
    });

    test("validates frozen state consistency", () => {
      const item = createReviewItem(baseInput());
      item.status = REVIEW_STATUS.FROZEN;
      item.frozen = false;

      const result = validateReviewItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("frozen state is inconsistent");
    });

    test("does not throw for validation failures", () => {
      expect(() => validateReviewItem(null)).not.toThrow();
      expect(validateReviewItem(null)).toEqual({
        valid: false,
        errors: ["review item must be an object"]
      });
    });
  });

  describe("updateReviewDecision", () => {
    test("approves a pending review item", () => {
      const item = createReviewItem(baseInput());
      const result = updateReviewDecision(item, REVIEW_DECISIONS.APPROVE);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.item.status).toBe(REVIEW_STATUS.APPROVED);
      expect(result.item.decision).toBe(REVIEW_DECISIONS.APPROVE);
      expect(item.status).toBe(REVIEW_STATUS.PENDING);
    });

    test("rejects a pending review item", () => {
      const result = updateReviewDecision(
        createReviewItem(baseInput()),
        REVIEW_DECISIONS.REJECT
      );

      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_STATUS.REJECTED);
      expect(result.item.decision).toBe(REVIEW_DECISIONS.REJECT);
    });

    test("marks skipped reviews as under review", () => {
      const result = updateReviewDecision(
        createReviewItem(baseInput()),
        REVIEW_DECISIONS.SKIP
      );

      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_STATUS.UNDER_REVIEW);
      expect(result.item.decision).toBe(REVIEW_DECISIONS.SKIP);
    });

    test("resets an approved item to pending when decision is cleared", () => {
      const approved = updateReviewDecision(
        createReviewItem(baseInput()),
        REVIEW_DECISIONS.APPROVE
      ).item;

      const result = updateReviewDecision(approved, REVIEW_DECISIONS.NONE);

      expect(result.success).toBe(true);
      expect(result.item.status).toBe(REVIEW_STATUS.PENDING);
      expect(result.item.decision).toBe(REVIEW_DECISIONS.NONE);
    });

    test("returns deterministic errors for invalid decisions", () => {
      const result = updateReviewDecision(createReviewItem(baseInput()), "archive");

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["decision is invalid"]);
    });

    test("does not throw for invalid updates", () => {
      expect(() => updateReviewDecision(null, REVIEW_DECISIONS.APPROVE)).not.toThrow();
    });
  });

  describe("freezeReviewItem", () => {
    test("freezes a valid review item", () => {
      const item = updateReviewDecision(
        createReviewItem(baseInput()),
        REVIEW_DECISIONS.APPROVE
      ).item;

      const result = freezeReviewItem(item);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.item.status).toBe(REVIEW_STATUS.FROZEN);
      expect(result.item.frozen).toBe(true);
      expect(Object.isFrozen(result.item)).toBe(true);
      expect(Object.isFrozen(result.item.matchResult)).toBe(true);
      expect(Object.isFrozen(result.item.matchResult.matchedSignals)).toBe(true);
    });

    test("prevents duplicate freeze operations", () => {
      const frozen = freezeReviewItem(createReviewItem(baseInput())).item;
      const result = freezeReviewItem(frozen);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["review item is already frozen"]);
      expect(result.item).toBe(frozen);
    });

    test("does not throw when freezing invalid items", () => {
      expect(() => freezeReviewItem(null)).not.toThrow();
    });
  });

  describe("immutable protection", () => {
    test("blocks decision updates after freeze", () => {
      const frozen = freezeReviewItem(createReviewItem(baseInput())).item;
      const result = updateReviewDecision(frozen, REVIEW_DECISIONS.REJECT);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["review item is frozen"]);
      expect(result.item).toBe(frozen);
      expect(frozen.status).toBe(REVIEW_STATUS.FROZEN);
      expect(frozen.decision).toBe(REVIEW_DECISIONS.NONE);
    });

    test("prevents mutation of frozen item properties", () => {
      const frozen = freezeReviewItem(createReviewItem(baseInput())).item;

      expect(() => {
        frozen.title = "Changed";
      }).toThrow();
      expect(() => {
        frozen.notes = "Changed";
      }).toThrow();
      expect(() => {
        frozen.decision = REVIEW_DECISIONS.REJECT;
      }).toThrow();
      expect(() => {
        frozen.status = REVIEW_STATUS.REJECTED;
      }).toThrow();
    });
  });

  describe("deterministic behavior", () => {
    test("returns identical validation output for identical invalid items", () => {
      const invalid = {
        title: "",
        eventType: "invalid",
        createdAt: "not-a-date",
        status: "bad",
        decision: "bad",
        frozen: false
      };

      expect(validateReviewItem(invalid)).toEqual(validateReviewItem(invalid));
    });

    test("returns identical update results for identical inputs", () => {
      const item = createReviewItem(baseInput());
      const first = updateReviewDecision(item, REVIEW_DECISIONS.APPROVE);
      const second = updateReviewDecision(item, REVIEW_DECISIONS.APPROVE);

      expect(first).toEqual(second);
    });
  });

  describe("regression cases", () => {
    test("cannot freeze an invalid review item", () => {
      const invalid = createReviewItem({
        title: "",
        eventType: "invalid"
      });

      const result = freezeReviewItem(invalid);
      expect(result.success).toBe(false);
      expect(result.valid).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("cannot update decision on invalid review item", () => {
      const invalid = createReviewItem({
        title: "",
        eventType: "invalid"
      });

      const result = updateReviewDecision(invalid, REVIEW_DECISIONS.APPROVE);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("title is required");
    });

    test("frozen validation accepts deep-frozen review items", () => {
      const frozen = freezeReviewItem(createReviewItem(baseInput())).item;
      const result = validateReviewItem(frozen);

      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    test("review item structure remains stable across operations", () => {
      const created = createReviewItem(baseInput({ recruitmentId: 7 }));
      const approved = updateReviewDecision(created, REVIEW_DECISIONS.APPROVE).item;
      const frozen = freezeReviewItem(approved).item;

      expect(Object.keys(frozen).sort()).toEqual([
        "confidence",
        "createdAt",
        "decision",
        "eventType",
        "frozen",
        "matchResult",
        "notes",
        "recruitmentId",
        "sourceUrl",
        "status",
        "title"
      ]);
    });
  });
});
