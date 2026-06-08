"use strict";

const pageRepository = require("../repositories/page.repository");
const { parseSmallBoxSlot } = require("../lib/smallBoxSlots");

/**
 * Assign or clear a homepage small-box slot inside an open transaction.
 * Step A: remove slot N from any other active page (not deleted).
 * Step B: assign slot N to target page, or clear slot when null.
 *
 * @param {{ pageId: number, slot: number | null, conn: import("mysql2/promise").PoolConnection }} params
 */
async function assignSmallBoxSlot({ pageId, slot, conn }) {
  if (!pageId) {
    throw new Error("assignSmallBoxSlot: pageId is required");
  }
  if (!conn) {
    throw new Error("assignSmallBoxSlot: database connection is required");
  }

  const parsed = parseSmallBoxSlot(slot);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const normalizedSlot = parsed.value;

  if (normalizedSlot === null) {
    await pageRepository.clearSmallBoxSlotForPage(pageId, conn);
    return { slot: null, displaced: [] };
  }

  const displaced = await pageRepository.displaceSmallBoxSlot(normalizedSlot, pageId, conn);
  await pageRepository.setSmallBoxSlotForPage(pageId, normalizedSlot, conn);
  return { slot: normalizedSlot, displaced };
}

async function getSmallBoxSlotMap() {
  return pageRepository.selectSmallBoxSlotMap();
}

module.exports = {
  assignSmallBoxSlot,
  getSmallBoxSlotMap,
  parseSmallBoxSlot
};
