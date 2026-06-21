"use strict";

/** Legacy link-box rows without `label|button=url` pipe syntax. */
const LEGACY_LINK_BOX_BUTTON = "Click Here";

function isUrlLike(value) {
  return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
}

/**
 * Parse `label|btn1=url1|btn2=url2` (multi) or `label|btn=url` (single custom button).
 * Returns null when pipe segments are not all `text=url` pairs (falls back to legacy parser).
 *
 * @param {string} rawLine
 * @returns {{ displayLabel: string, actions: Array<{ buttonText: string, href: string }> } | null}
 */
function parsePipeLinkLine(rawLine) {
  const raw = String(rawLine ?? "").trim();
  if (!raw.includes("|")) return null;

  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const displayLabel = parts[0];
  const actions = [];

  for (let i = 1; i < parts.length; i += 1) {
    const segment = parts[i];
    const eqIdx = segment.indexOf("=");
    if (eqIdx <= 0) return null;

    const buttonText = segment.slice(0, eqIdx).trim();
    const href = segment.slice(eqIdx + 1).trim();
    if (!buttonText || !isUrlLike(href)) return null;

    actions.push({ buttonText, href });
  }

  if (!displayLabel || !actions.length) return null;
  return { displayLabel, actions };
}

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
  parseLinkLineParts,
  parsePipeLinkLine,
  isUrlLike
};
