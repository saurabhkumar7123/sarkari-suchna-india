"use strict";

jest.mock("../server/repositories/page.repository", () => ({
  clearSmallBoxSlotForPage: jest.fn().mockResolvedValue(undefined),
  displaceSmallBoxSlot: jest.fn().mockResolvedValue([]),
  setSmallBoxSlotForPage: jest.fn().mockResolvedValue(undefined)
}));

const pageRepository = require("../server/repositories/page.repository");
const { assignSmallBoxSlot } = require("../server/services/smallBox.service");

describe("smallBox.service assignSmallBoxSlot", () => {
  const conn = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears slot when null (remove from small boxes)", async () => {
    await assignSmallBoxSlot({ pageId: 10, slot: null, conn });
    expect(pageRepository.clearSmallBoxSlotForPage).toHaveBeenCalledWith(10, conn);
    expect(pageRepository.displaceSmallBoxSlot).not.toHaveBeenCalled();
    expect(pageRepository.setSmallBoxSlotForPage).not.toHaveBeenCalled();
  });

  it("displaces then assigns when slot 2 is requested", async () => {
    await assignSmallBoxSlot({ pageId: 99, slot: 2, conn });
    expect(pageRepository.displaceSmallBoxSlot).toHaveBeenCalledWith(2, 99, conn);
    expect(pageRepository.setSmallBoxSlotForPage).toHaveBeenCalledWith(99, 2, conn);
    expect(pageRepository.clearSmallBoxSlotForPage).not.toHaveBeenCalled();
  });

  it("same-page reassignment to slot 2 excludes self in displacement", async () => {
    await assignSmallBoxSlot({ pageId: 5, slot: 2, conn });
    expect(pageRepository.displaceSmallBoxSlot).toHaveBeenCalledWith(2, 5, conn);
  });

  it("edit slot 2 to slot 3 runs displacement for slot 3 only", async () => {
    await assignSmallBoxSlot({ pageId: 7, slot: 3, conn });
    expect(pageRepository.displaceSmallBoxSlot).toHaveBeenCalledWith(3, 7, conn);
    expect(pageRepository.setSmallBoxSlotForPage).toHaveBeenCalledWith(7, 3, conn);
  });

  it("rejects invalid slot numbers", async () => {
    await expect(assignSmallBoxSlot({ pageId: 1, slot: 9, conn })).rejects.toThrow(/1–8/);
  });
});
