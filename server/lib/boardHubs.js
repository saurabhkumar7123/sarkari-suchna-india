"use strict";

/**
 * Board hub slugs — must match pages.department values (Job Finder whitelist).
 * Board listings use department column, not page_tags.
 */

const BOARD_HUBS = {
  ssc: {
    slug: "ssc",
    label: "SSC",
    title: "SSC Government Jobs & Updates 2026 | Sarkari Suchna India",
    description:
      "Browse latest SSC recruitment notifications, exam forms, results, admit cards and answer keys on Sarkari Suchna India.",
    h1: "SSC Jobs",
    sub: "Latest SSC recruitment forms, results, admit cards and exam updates in one place."
  },
  railway: {
    slug: "railway",
    label: "Railway",
    title: "Railway Jobs 2026 | Sarkari Suchna India",
    description:
      "Find latest Railway recruitment, RRB notifications, results and admit card updates on Sarkari Suchna India.",
    h1: "Railway Jobs",
    sub: "Latest Railway and RRB job notifications, results and hall ticket updates."
  },
  upsc: {
    slug: "upsc",
    label: "UPSC",
    title: "UPSC Jobs & Exams 2026 | Sarkari Suchna India",
    description:
      "Browse UPSC exam notifications, civil services updates, results and admit cards on Sarkari Suchna India.",
    h1: "UPSC Jobs",
    sub: "Latest UPSC recruitment and examination updates."
  },
  bank: {
    slug: "bank",
    label: "Bank",
    title: "Bank Jobs 2026 | Sarkari Suchna India",
    description:
      "Find latest bank recruitment, IBPS, SBI and other banking job notifications on Sarkari Suchna India.",
    h1: "Bank Jobs",
    sub: "Latest bank and IBPS recruitment updates."
  },
  police: {
    slug: "police",
    label: "Police",
    title: "Police Jobs 2026 | Sarkari Suchna India",
    description:
      "Browse state and central police recruitment, constable and SI notifications on Sarkari Suchna India.",
    h1: "Police Jobs",
    sub: "Latest police recruitment and constable exam updates."
  },
  teaching: {
    slug: "teaching",
    label: "Teaching",
    title: "Teaching Jobs 2026 | Sarkari Suchna India",
    description:
      "Find teaching recruitment, TET, lecturer and education department jobs on Sarkari Suchna India.",
    h1: "Teaching Jobs",
    sub: "Latest teaching and education department recruitment updates."
  },
  army: {
    slug: "army",
    label: "Army",
    title: "Army Jobs 2026 | Sarkari Suchna India",
    description:
      "Browse Indian Army, Agniveer and armed forces recruitment notifications on Sarkari Suchna India.",
    h1: "Army Jobs",
    sub: "Latest Indian Army and armed forces recruitment updates."
  },
  upsssc: {
    slug: "upsssc",
    label: "UPSSSC",
    title: "UPSSSC Jobs 2026 | Sarkari Suchna India",
    description:
      "Browse latest UPSSSC recruitment notifications, exam forms, results and admit cards on Sarkari Suchna India.",
    h1: "UPSSSC Jobs",
    sub: "Latest UPSSSC recruitment and examination updates."
  },
  health: {
    slug: "health",
    label: "Health",
    title: "Health Department Jobs 2026 | Sarkari Suchna India",
    description:
      "Find health department recruitment, medical officer and staff nurse notifications on Sarkari Suchna India.",
    h1: "Health Jobs",
    sub: "Latest health department and medical recruitment updates."
  }
};

const { LEGACY_DEPARTMENT_ALIASES } = require("./structuredFields");

const BOARD_SLUG_SET = new Set(Object.keys(BOARD_HUBS));

function normalizeBoardSlug(raw) {
  const normalized = String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  return LEGACY_DEPARTMENT_ALIASES.get(normalized) || normalized;
}

function isBoardSlug(slug) {
  return BOARD_SLUG_SET.has(normalizeBoardSlug(slug));
}

function getBoardHub(slug) {
  return BOARD_HUBS[normalizeBoardSlug(slug)] || null;
}

function allBoardHubs() {
  return Object.values(BOARD_HUBS);
}

module.exports = {
  BOARD_HUBS,
  BOARD_SLUG_SET,
  normalizeBoardSlug,
  isBoardSlug,
  getBoardHub,
  allBoardHubs
};
