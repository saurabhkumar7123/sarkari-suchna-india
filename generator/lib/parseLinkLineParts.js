"use strict";

/** Legacy link-box rows without `label|button=url` pipe syntax. */
const LEGACY_LINK_BOX_BUTTON = "Click Here";

/**
 * Parse the left side of a `label=url` or `label|button=url` content line.
 * First `=` split is handled by the caller.
 *
 * Without `|`: button text stays {@link LEGACY_LINK_BOX_BUTTON} (backward compatible).
 * With `|`: button text is the segment after the first `|`.
 *
 * @param {string} leftOfEq — text before the first "="
 * @param {{ fallbackLabel?: string }} [options]
 * @returns {{ displayLabel: string, buttonText: string }}
 */
function parseLinkLineParts(leftOfEq, options = {}) {
  const fallback = String(options.fallbackLabel || "Link").trim() || "Link";
  const raw = String(leftOfEq ?? "").trim();

  if (!raw) {
    return { displayLabel: fallback, buttonText: LEGACY_LINK_BOX_BUTTON };
  }

  const pipeIdx = raw.indexOf("|");
  if (pipeIdx === -1) {
    return { displayLabel: raw, buttonText: LEGACY_LINK_BOX_BUTTON };
  }

  const displayLabel = raw.slice(0, pipeIdx).trim() || fallback;
  const buttonText = raw.slice(pipeIdx + 1).trim() || displayLabel;
  return { displayLabel, buttonText };
}

module.exports = {
  LEGACY_LINK_BOX_BUTTON,
  parseLinkLineParts
};
