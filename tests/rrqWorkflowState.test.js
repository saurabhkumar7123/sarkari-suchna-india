"use strict";

/**
 * Unit tests for Review Queue workflow phase reconstruction (no DB).
 */

const {
  resolvePhase,
  normalizeIntent,
  readIntentFromSearch,
  writeIntentIntoSearch,
  INTENT_PARAM
} = require("../public/assets/js/admin-rrq-workflow-state.js");

describe("rrqWorkflowState.resolvePhase", () => {
  test("needs_matching without intent → relation", () => {
    expect(resolvePhase({ status: "needs_matching" }, null)).toBe("relation");
  });

  test("needs_matching + yes → attach; + no → alternate", () => {
    expect(resolvePhase({ status: "needs_matching" }, "yes")).toBe("attach");
    expect(resolvePhase({ status: "needs_matching" }, "no")).toBe("alternate");
  });

  test("after Attach (under_review + recruitment) never returns to relation", () => {
    expect(
      resolvePhase({ status: "under_review", recruitment_id: 44 }, "yes")
    ).toBe("review");
    expect(
      resolvePhase({ status: "under_review", recruitment_id: 44 }, null)
    ).toBe("review");
  });

  test("standalone under_review without recruitment → standalone_review", () => {
    expect(resolvePhase({ status: "under_review", recruitment_id: null }, "no")).toBe(
      "standalone_review"
    );
  });

  test("rejected / frozen / approved / published phases", () => {
    expect(resolvePhase({ status: "rejected" }, "yes")).toBe("rejected");
    expect(resolvePhase({ status: "frozen" }, "no")).toBe("frozen");
    expect(resolvePhase({ status: "approved", recruitment_id: 1 }, null)).toBe("approved");
    expect(
      resolvePhase(
        { status: "approved", linked_draft: { status: "published" } },
        null
      )
    ).toBe("published");
  });

  test("URL match_intent round-trip", () => {
    expect(normalizeIntent("YES")).toBe("yes");
    expect(readIntentFromSearch("?update_id=12&match_intent=yes")).toBe("yes");
    expect(writeIntentIntoSearch("?update_id=12", "no")).toContain(`${INTENT_PARAM}=no`);
    expect(writeIntentIntoSearch("?update_id=12&match_intent=yes", null)).not.toContain(
      INTENT_PARAM
    );
  });
});
