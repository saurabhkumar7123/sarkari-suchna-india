"use strict";

const {
  parseSmallBoxSlot,
  positionFromSlot,
  colorIndexForSlot,
  isDesktopOnlySmallBoxSlot,
  MIN_SLOT,
  MAX_SLOT,
  MOBILE_MAX_SLOT
} = require("../server/lib/smallBoxSlots");

describe("smallBoxSlots", () => {
  describe("parseSmallBoxSlot", () => {
    it("accepts null and empty as not in small box", () => {
      expect(parseSmallBoxSlot(null)).toEqual({ ok: true, value: null });
      expect(parseSmallBoxSlot("")).toEqual({ ok: true, value: null });
      expect(parseSmallBoxSlot("normal")).toEqual({ ok: true, value: null });
    });

    it("accepts slots 1–8 as integers or strings", () => {
      expect(parseSmallBoxSlot(2)).toEqual({ ok: true, value: 2 });
      expect(parseSmallBoxSlot("3")).toEqual({ ok: true, value: 3 });
      expect(parseSmallBoxSlot(8)).toEqual({ ok: true, value: 8 });
      expect(parseSmallBoxSlot("7")).toEqual({ ok: true, value: 7 });
    });

    it("rejects invalid slot values", () => {
      expect(parseSmallBoxSlot(0)).toEqual({ ok: true, value: null });
      expect(parseSmallBoxSlot(9).ok).toBe(false);
      expect(parseSmallBoxSlot("slot-2").ok).toBe(false);
    });
  });

  describe("positionFromSlot", () => {
    it("maps slot to small position flag", () => {
      expect(positionFromSlot(1)).toBe("small");
      expect(positionFromSlot(8)).toBe("small");
      expect(positionFromSlot(null)).toBe("normal");
    });
  });

  describe("isDesktopOnlySmallBoxSlot", () => {
    it("marks slots 7–8 as desktop only", () => {
      expect(isDesktopOnlySmallBoxSlot(6)).toBe(false);
      expect(isDesktopOnlySmallBoxSlot(7)).toBe(true);
      expect(isDesktopOnlySmallBoxSlot(8)).toBe(true);
    });
  });

  describe("colorIndexForSlot", () => {
    it("uses slot-1 modulo four palette classes", () => {
      expect(colorIndexForSlot(1, 0)).toBe(0);
      expect(colorIndexForSlot(4, 0)).toBe(3);
      expect(colorIndexForSlot(5, 0)).toBe(0);
      expect(colorIndexForSlot(8, 0)).toBe(3);
    });

    it("falls back to loop index when slot missing", () => {
      expect(colorIndexForSlot(null, 2)).toBe(2);
    });
  });

  it("documents slot bounds", () => {
    expect(MIN_SLOT).toBe(1);
    expect(MAX_SLOT).toBe(8);
    expect(MOBILE_MAX_SLOT).toBe(6);
  });
});
