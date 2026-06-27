"use strict";

const mockConn = {
  beginTransaction: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  release: jest.fn()
};

jest.mock("../server/config/db", () => ({
  getConnection: jest.fn().mockResolvedValue(mockConn)
}));

jest.mock("../server/repositories/page.repository", () => ({
  findActiveIdBySlug: jest.fn()
}));

jest.mock("../server/services/smallBox.service", () => ({
  parseSmallBoxSlot: jest.requireActual("../server/lib/smallBoxSlots").parseSmallBoxSlot,
  assignSmallBoxSlot: jest.fn().mockResolvedValue({ slot: 2, displaced: [] }),
  getSmallBoxSlotMap: jest.fn()
}));

const pageRepository = require("../server/repositories/page.repository");
const smallBoxService = require("../server/services/smallBox.service");
const { updateSmallBoxSlotPlacement } = require("../server/services/homepagePlacement.service");

describe("homepagePlacement small box slot replace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pageRepository.findActiveIdBySlug.mockResolvedValue({ id: 42 });
    smallBoxService.getSmallBoxSlotMap.mockResolvedValue([
      { slot: 2, slug: "old-page", title: "Old" }
    ]);
  });

  it("replaces the occupant of a slot with a new slug", async () => {
    const result = await updateSmallBoxSlotPlacement(2, "new-page");

    expect(result).toMatchObject({
      slot: 2,
      slug: "new-page",
      previousSlug: "old-page",
      smallBoxSlot: 2
    });
    expect(smallBoxService.assignSmallBoxSlot).toHaveBeenCalledWith({
      pageId: 42,
      slot: 2,
      conn: mockConn
    });
  });

  it("clears a slot by slot number", async () => {
    smallBoxService.assignSmallBoxSlot.mockResolvedValueOnce({ slot: null, displaced: [] });

    const result = await updateSmallBoxSlotPlacement(2, null);

    expect(result).toMatchObject({
      slot: 2,
      slug: null,
      previousSlug: "old-page",
      smallBoxSlot: null
    });
    expect(smallBoxService.assignSmallBoxSlot).toHaveBeenCalledWith({
      pageId: 42,
      slot: null,
      conn: mockConn
    });
  });
});
