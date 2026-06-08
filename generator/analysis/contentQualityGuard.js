"use strict";

/**
 * Recruitment families used to detect cross-page content contamination.
 * Each family has distinctive markers that should not appear unless the page identity matches.
 */
const RECRUITMENT_FAMILIES = [
  {
    id: "ssc",
    label: "SSC / Staff Selection Commission",
    markers: ["staff selection commission", "ssc cgl", "ssc chsl", "ssc gd", "ssc mts", "ssc je"]
  },
  {
    id: "ssc_general",
    label: "SSC",
    markers: ["ssc"]
  },
  {
    id: "railway",
    label: "Railway / RRB",
    markers: ["railway rrb", "rrb alp", "rrb ntpc", "rrb technician", "railway recruitment"]
  },
  {
    id: "railway_general",
    label: "Railway / RRB",
    markers: ["rrb", "railway"]
  },
  {
    id: "up_police",
    label: "UP Police",
    markers: ["up police", "upprpb", "uppbpb", "uttar pradesh police"]
  },
  {
    id: "upsssc",
    label: "UPSSSC",
    markers: ["upsssc", "uttar pradesh subordinate"]
  },
  {
    id: "uppsc",
    label: "UPPSC",
    markers: ["uppsc", "uttar pradesh public service"]
  },
  {
    id: "upsc",
    label: "UPSC",
    markers: ["upsc", "union public service commission", "cds exam", "capf exam"]
  },
  {
    id: "ibps",
    label: "Banking / IBPS",
    markers: ["ibps", "sbi po", "sbi clerk", "rbi grade"]
  },
  {
    id: "ctet",
    label: "CTET / Teacher",
    markers: ["ctet", "central teacher eligibility"]
  },
  {
    id: "crpf",
    label: "CRPF / CAPF",
    markers: ["crpf", "bsf recruitment", "cisf recruitment", "itbp recruitment"]
  }
];

/** Families checked in order — more specific ids first to reduce false positives. */
const FAMILY_CHECK_ORDER = [
  "ssc",
  "railway",
  "up_police",
  "upsssc",
  "uppsc",
  "upsc",
  "ibps",
  "ctet",
  "crpf",
  "ssc_general",
  "railway_general"
];

const FAMILY_BY_ID = Object.fromEntries(RECRUITMENT_FAMILIES.map((f) => [f.id, f]));

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match marker with token/phrase boundaries — avoids "upsssc" matching "ssc".
 * @param {string} haystack — normalized lowercase text
 * @param {string} marker
 */
function containsMarker(haystack, marker) {
  const m = normalizeHaystack(marker);
  if (!m || !haystack) return false;

  if (m.includes(" ")) {
    const parts = m.split(/\s+/).filter(Boolean).map(escapeRegExp);
    const re = new RegExp(`(?:^|[^a-z0-9])${parts.join("\\s+")}(?:[^a-z0-9]|$)`);
    return re.test(haystack);
  }

  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(m)}(?:[^a-z0-9]|$)`);
  return re.test(haystack);
}

function normalizeHaystack(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value) {
  return normalizeHaystack(value).replace(/[^a-z0-9]/g, "");
}

function buildIdentityHaystack({ title, postName, department, category, slug }) {
  return normalizeHaystack([title, postName, department, category, slug].filter(Boolean).join(" "));
}

function detectPrimaryFamilies(identityHaystack) {
  const matched = [];
  for (const id of FAMILY_CHECK_ORDER) {
    const family = FAMILY_BY_ID[id];
    if (!family) continue;
    for (const marker of family.markers) {
      if (containsMarker(identityHaystack, marker)) {
        matched.push(id);
        break;
      }
    }
  }
  return matched;
}

function familyIdsRelated(a, b) {
  if (a === b) return true;
  const pairs = [
    ["ssc", "ssc_general"],
    ["railway", "railway_general"]
  ];
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function findMarkerInContent(contentHaystack, marker) {
  const m = normalizeHaystack(marker);
  if (!containsMarker(contentHaystack, m)) return null;

  if (m.includes(" ")) {
    const parts = m.split(/\s+/).filter(Boolean).map(escapeRegExp);
    const re = new RegExp(`(?:^|[^a-z0-9])${parts.join("\\s+")}(?:[^a-z0-9]|$)`);
    const match = contentHaystack.match(re);
    if (!match) return m;
    const idx = match.index ?? contentHaystack.indexOf(m);
    const start = Math.max(0, idx - 40);
    const end = Math.min(contentHaystack.length, idx + m.length + 40);
    return contentHaystack.slice(start, end).trim();
  }

  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(m)}(?:[^a-z0-9]|$)`);
  const match = contentHaystack.match(re);
  const idx = match ? match.index : contentHaystack.indexOf(m);
  const start = Math.max(0, idx - 40);
  const end = Math.min(contentHaystack.length, idx + m.length + 40);
  return contentHaystack.slice(start, end).trim();
}

/**
 * Validate page content against title/post/department identity.
 * @param {{ title?: string, text?: string, postName?: string, department?: string, category?: string, slug?: string }} input
 * @returns {{ ok: boolean, message?: string, violations: Array<{ code: string, marker: string, foreignFamily: string, foreignLabel: string, excerpt: string }>, warnings: string[] }}
 */
function validatePageContentIdentity(input = {}) {
  const contentHaystack = normalizeHaystack(input.text);
  const identityHaystack = buildIdentityHaystack(input);
  const violations = [];
  const warnings = [];

  if (!contentHaystack || contentHaystack.length < 20) {
    return { ok: true, violations, warnings };
  }

  const primaryFamilies = detectPrimaryFamilies(identityHaystack);

  if (!primaryFamilies.length) {
    warnings.push(
      "Could not infer recruitment identity from title/post name — cross-content check skipped."
    );
    return { ok: true, violations, warnings };
  }

  for (const id of FAMILY_CHECK_ORDER) {
    const family = FAMILY_BY_ID[id];
    if (!family) continue;

    const isOwnFamily = primaryFamilies.some((pf) => familyIdsRelated(pf, id));
    if (isOwnFamily) continue;

    for (const marker of family.markers) {
      if (!containsMarker(contentHaystack, marker)) continue;
      if (containsMarker(identityHaystack, marker)) continue;

      violations.push({
        code: "CROSS_RECRUITMENT_REFERENCE",
        marker,
        foreignFamily: id,
        foreignLabel: family.label,
        excerpt: findMarkerInContent(contentHaystack, marker) || marker
      });
    }
  }

  const postNorm = normalizeToken(input.postName);
  const titleNorm = normalizeToken(input.title);

  if (postNorm && titleNorm && postNorm.length >= 4) {
    if (!titleNorm.includes(postNorm) && !postNorm.includes(titleNorm.slice(0, Math.min(8, titleNorm.length)))) {
      const postWords = normalizeHaystack(input.postName).split(/\s+/).filter((w) => w.length >= 4);
      const missingInContent = postWords.filter((w) => !contentHaystack.includes(w));
      if (missingInContent.length === postWords.length && postWords.length > 0) {
        warnings.push(`Post name "${input.postName}" does not appear in page content.`);
      }
    }
  }

  const uniqueViolations = [];
  const seen = new Set();
  for (const v of violations) {
    const key = `${v.foreignFamily}:${v.marker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueViolations.push(v);
  }

  if (!uniqueViolations.length) {
    return { ok: true, violations: [], warnings };
  }

  const first = uniqueViolations[0];
  const message =
    `Content quality check failed: page appears to reference "${first.foreignLabel}" ` +
    `(found "${first.marker}") but title/post identity is ` +
    `[${primaryFamilies.map((id) => FAMILY_BY_ID[id]?.label || id).join(", ")}]. ` +
    "Remove cross-exam copy-paste text before publishing.";

  return {
    ok: false,
    message,
    violations: uniqueViolations,
    warnings
  };
}

module.exports = {
  validatePageContentIdentity,
  RECRUITMENT_FAMILIES,
  normalizeHaystack,
  detectPrimaryFamilies,
  containsMarker
};
