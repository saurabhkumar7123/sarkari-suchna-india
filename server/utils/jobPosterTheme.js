"use strict";

/**
 * @param {string} tag
 * @param {string} title
 * @returns {"police"|"railway"|"defence"|"default"}
 */
function detectPosterThemeKey(tag, title) {
  const s = `${String(tag || "")} ${String(title || "")}`.toLowerCase();
  if (/\brailway\b/.test(s) || /\brrb\b/.test(s)) return "railway";
  if (/\bssb\b/.test(s) || /\barmy\b/.test(s) || /\bdefence\b/.test(s) || /\bdefense\b/.test(s)) return "defence";
  if (/\bpolice\b/.test(s)) return "police";
  return "default";
}

/**
 * @param {string} tag
 * @param {string} title
 * @returns {string} e.g. theme-railway
 */
function posterThemeClassName(tag, title) {
  const k = detectPosterThemeKey(tag, title);
  if (k === "police") return "theme-police";
  if (k === "railway") return "theme-railway";
  if (k === "defence") return "theme-defence";
  return "";
}

const OG_THEMES = {
  default: {
    bgTop: "#111827",
    bgBottom: "#030712",
    accent: "#facc15",
    titleColor: "#ffffff",
    tagColor: "#cbd5e1",
    postsBox: "#b91c1c",
    postsGlow: "#facc15",
    postsLabel: "#fef9c3"
  },
  railway: {
    bgTop: "#166534",
    bgBottom: "#052e16",
    accent: "#4ade80",
    titleColor: "#ecfccb",
    tagColor: "#bbf7d0",
    postsBox: "#15803d",
    postsGlow: "#86efac",
    postsLabel: "#ecfccb"
  },
  defence: {
    bgTop: "#3f3f1e",
    bgBottom: "#1c1917",
    accent: "#ca8a04",
    titleColor: "#fefce8",
    tagColor: "#d6d3d1",
    postsBox: "#57534e",
    postsGlow: "#fbbf24",
    postsLabel: "#fef3c7"
  },
  police: {
    bgTop: "#1e3a8a",
    bgBottom: "#0f172a",
    accent: "#38bdf8",
    titleColor: "#f8fafc",
    tagColor: "#bae6fd",
    postsBox: "#1d4ed8",
    postsGlow: "#fde047",
    postsLabel: "#fef08a"
  }
};

/**
 * @param {string} tag
 * @param {string} title
 */
function getOgTheme(tag, title) {
  const k = detectPosterThemeKey(tag, title);
  return OG_THEMES[k] || OG_THEMES.default;
}

module.exports = {
  detectPosterThemeKey,
  posterThemeClassName,
  getOgTheme
};
