"use strict";

const {
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_DEPARTMENTS,
  isValidBoardDepartment,
  getInvalidDepartmentReason,
  parseStateCoverageSet,
  stateCoverageMatchesFilter,
  parseQualificationSet,
  qualificationSetMatchesFilter
} = require("../server/lib/structuredFields");
const { BOARD_SLUG_SET } = require("../server/lib/boardHubs");

describe("structuredFields", () => {
  describe("ALLOWED_JOB_QUALIFICATIONS", () => {
    it("includes ITI for future multi-eligibility jobs", () => {
      expect(ALLOWED_JOB_QUALIFICATIONS.has("iti")).toBe(true);
    });

    it("retains existing graduation slug for backward compatibility", () => {
      expect(ALLOWED_JOB_QUALIFICATIONS.has("graduation")).toBe(true);
    });
  });

  describe("board department validation", () => {
    it("accepts all registered board slugs", () => {
      for (const slug of BOARD_SLUG_SET) {
        expect(isValidBoardDepartment(slug)).toBe(true);
      }
    });

    it("accepts empty department (optional field)", () => {
      expect(isValidBoardDepartment(null)).toBe(true);
      expect(isValidBoardDepartment("")).toBe(true);
    });

    it("detects invalid department without blocking semantics", () => {
      expect(getInvalidDepartmentReason("ssc")).toBeNull();
      expect(getInvalidDepartmentReason("typo-board")).toMatch(/not a registered board slug/);
    });

    it("department whitelist matches board hub registry", () => {
      expect(ALLOWED_JOB_DEPARTMENTS).toEqual(BOARD_SLUG_SET);
    });
  });

  describe("state coverage helpers (Phase 1 single-value)", () => {
    it("parseStateCoverageSet returns one normalized slug", () => {
      expect(parseStateCoverageSet("Uttar Pradesh")).toEqual(["uttar pradesh"]);
    });

    it("stateCoverageMatchesFilter uses exact slug match", () => {
      expect(stateCoverageMatchesFilter("uttar pradesh", "uttar pradesh")).toBe(true);
      expect(stateCoverageMatchesFilter("all india", "uttar pradesh")).toBe(false);
      expect(stateCoverageMatchesFilter("central", "uttar pradesh")).toBe(false);
      expect(stateCoverageMatchesFilter("bihar", "uttar pradesh")).toBe(false);
      expect(stateCoverageMatchesFilter("all india", "central")).toBe(true);
      expect(stateCoverageMatchesFilter("central", "central")).toBe(true);
    });
  });

  describe("qualification helpers (Phase 1 single-value)", () => {
    it("parseQualificationSet returns one normalized slug", () => {
      expect(parseQualificationSet("ITI")).toEqual(["iti"]);
    });

    it("qualificationSetMatchesFilter uses exact member match", () => {
      expect(qualificationSetMatchesFilter("graduation", "graduation")).toBe(true);
      expect(qualificationSetMatchesFilter("12th", "iti")).toBe(false);
    });
  });
});
