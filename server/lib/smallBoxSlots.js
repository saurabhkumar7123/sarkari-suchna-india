"use strict";

const MIN_SLOT = 1;
const MAX_SLOT = 8;
/** Slots 1–6 appear on mobile (3×2); 7–8 are desktop-only (4×2). */
const MOBILE_MAX_SLOT = 6;

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
 * @param {number | null | undefined} slot
 * @returns {boolean}
 */
function isDesktopOnlySmallBoxSlot(slot) {
  const n = Number(slot);
  return Number.isInteger(n) && n > MOBILE_MAX_SLOT && n <= MAX_SLOT;
}

/**
 * Color index for homepage .cat tiles (cycles 4 palette classes).
 * @param {number | null | undefined} slot
 * @param {number} fallbackIndex
 */
function colorIndexForSlot(slot, fallbackIndex = 0) {
  if (Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT) {
    return (slot - 1) % 4;
  }
  return fallbackIndex % 4;
}

module.exports = {
  MIN_SLOT,
  MAX_SLOT,
  MOBILE_MAX_SLOT,
  parseSmallBoxSlot,
  positionFromSlot,
  isDesktopOnlySmallBoxSlot,
  colorIndexForSlot
};
