"use strict";

const MIN_SLOT = 1;
const MAX_SLOT = 4;

/**
 * Parse admin/API small box slot input.
 * @param {unknown} raw
 * @returns {{ ok: true, value: number | null } | { ok: false, error: string }}
 */
function parseSmallBoxSlot(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "normal" || raw === 0 || raw === "0") {
    return { ok: true, value: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_SLOT || n > MAX_SLOT) {
    return {
      ok: false,
      error: `smallBoxSlot must be ${MIN_SLOT}–${MAX_SLOT} or empty (not in small boxes)`
    };
  }
  return { ok: true, value: n };
}

/**
 * @param {number | null | undefined} slot
 * @returns {'small' | 'normal'}
 */
function positionFromSlot(slot) {
  return slot >= MIN_SLOT && slot <= MAX_SLOT ? "small" : "normal";
}

/**
 * Color index for homepage .cat tiles (0–3).
 * @param {number | null | undefined} slot
 * @param {number} fallbackIndex
 */
function colorIndexForSlot(slot, fallbackIndex = 0) {
  if (Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT) {
    return slot - 1;
  }
  return fallbackIndex % MAX_SLOT;
}

module.exports = {
  MIN_SLOT,
  MAX_SLOT,
  parseSmallBoxSlot,
  positionFromSlot,
  colorIndexForSlot
};
