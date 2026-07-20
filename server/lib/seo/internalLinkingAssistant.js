"use strict";

/**
 * Package 4F — Internal linking assistant (suggestions only).
 *
 * Suggests related recruitments, departments, qualifications, states, and topics.
 * Does NOT insert links automatically.
 */

const { allBoardHubs, isBoardSlug, normalizeBoardSlug } = require("../boardHubs");
const {
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES,
  normalizeStateSlug,
  normalizeStructuredFieldValue
} = require("../structuredFields");
const {
  buildDepartmentPath,
  buildQualificationPath,
  buildStatePath
} = require("../taxonomySlugs");
const { parseCategoryTags, normalizeTopicSlug, formatTopicLabel } = require("../topicTags");

function scoreOverlap(a, b) {
  const left = String(a || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const right = new Set(
    String(b || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3)
  );
  if (!left.length || !right.size) return 0;
  let hit = 0;
  for (const token of left) {
    if (right.has(token)) hit += 1;
  }
  return hit;
}

/**
 * @param {object} input
 * @param {object} [input.page]
 * @param {Array<object>} [input.candidatePages]
 * @param {Array<object>} [input.candidateRecruitments]
 * @param {number} [input.limit]
 */
function buildInternalLinkSuggestions(input = {}) {
  const page = input.page && typeof input.page === "object" ? input.page : {};
  const limit = Math.max(1, Math.min(12, Number(input.limit) || 6));
  const title = String(page.title || "").trim();
  const department = normalizeBoardSlug(page.department || "");
  const qualification = normalizeStructuredFieldValue(page.qualification || "");
  const state = normalizeStateSlug(page.state || "");
  const category = String(page.category || "").trim();
  const slug = String(page.slug || "")
    .trim()
    .replace(/\.html$/i, "");

  const relatedRecruitments = [];
  for (const row of input.candidateRecruitments || []) {
    const id = row.id != null ? Number(row.id) : null;
    const rTitle = String(row.title || "").trim();
    const rSlug = String(row.slug || "").trim();
    if (!rTitle && !rSlug) continue;
    if (rSlug && slug && rSlug === slug) continue;
    const score =
      scoreOverlap(title, rTitle) * 3 +
      (department && normalizeBoardSlug(row.department || "") === department ? 4 : 0) +
      (state && normalizeStateSlug(row.state || "") === state ? 2 : 0) +
      (qualification &&
      normalizeStructuredFieldValue(row.qualification || "") === qualification
        ? 2
        : 0);
    if (score <= 0) continue;
    relatedRecruitments.push({
      type: "recruitment",
      id,
      title: rTitle || rSlug,
      slug: rSlug || null,
      href: rSlug ? `/${rSlug}` : id ? `/admin/recruitments?id=${id}` : null,
      score,
      reason: "Related recruitment overlap"
    });
  }
  relatedRecruitments.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));

  const relatedPages = [];
  for (const row of input.candidatePages || []) {
    const pSlug = String(row.slug || "")
      .trim()
      .replace(/\.html$/i, "");
    if (!pSlug || (slug && pSlug === slug)) continue;
    const pTitle = String(row.title || pSlug).trim();
    const score =
      scoreOverlap(title, pTitle) * 2 +
      (department && normalizeBoardSlug(row.department || "") === department ? 5 : 0) +
      (state && normalizeStateSlug(row.state || "") === state ? 3 : 0) +
      (qualification &&
      normalizeStructuredFieldValue(row.qualification || "") === qualification
        ? 3
        : 0);
    if (score <= 0) continue;
    relatedPages.push({
      type: "recruitment_page",
      title: pTitle,
      slug: pSlug,
      href: `/${pSlug}`,
      score,
      reason: "Related page / recruitment content"
    });
  }
  relatedPages.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

  const relatedDepartments = [];
  if (department && isBoardSlug(department)) {
    const hub = allBoardHubs().find((h) => h.slug === department);
    relatedDepartments.push({
      type: "department",
      label: hub ? hub.label : department,
      slug: department,
      href: buildDepartmentPath(department),
      score: 10,
      reason: "Page department hub"
    });
  } else {
    for (const hub of allBoardHubs()) {
      const score = scoreOverlap(title + " " + category, hub.label + " " + hub.slug);
      if (score <= 0) continue;
      relatedDepartments.push({
        type: "department",
        label: hub.label,
        slug: hub.slug,
        href: buildDepartmentPath(hub.slug),
        score,
        reason: "Department keyword overlap"
      });
    }
    relatedDepartments.sort((a, b) => b.score - a.score);
  }

  const relatedQualifications = [];
  if (qualification && ALLOWED_JOB_QUALIFICATIONS.has(qualification)) {
    relatedQualifications.push({
      type: "qualification",
      label: qualification,
      slug: qualification,
      href: buildQualificationPath(qualification),
      score: 10,
      reason: "Page qualification hub"
    });
  } else {
    for (const q of ALLOWED_JOB_QUALIFICATIONS) {
      if (scoreOverlap(title + " " + String(page.raw_text || "").slice(0, 400), q) > 0) {
        relatedQualifications.push({
          type: "qualification",
          label: q,
          slug: q,
          href: buildQualificationPath(q),
          score: 2,
          reason: "Qualification keyword overlap"
        });
      }
    }
  }

  const relatedStates = [];
  if (state && ALLOWED_JOB_STATES.has(state)) {
    relatedStates.push({
      type: "state",
      label: state,
      slug: state,
      href: buildStatePath(state),
      score: 10,
      reason: "Page state hub"
    });
  } else {
    for (const s of ALLOWED_JOB_STATES) {
      if (scoreOverlap(title + " " + category, s) > 0) {
        relatedStates.push({
          type: "state",
          label: s,
          slug: s,
          href: buildStatePath(s),
          score: 2,
          reason: "State keyword overlap"
        });
      }
    }
  }

  const relatedTopics = [];
  const tags = parseCategoryTags(category);
  for (const tag of tags) {
    const topicSlug = normalizeTopicSlug(tag);
    if (!topicSlug) continue;
    relatedTopics.push({
      type: "topic",
      label: formatTopicLabel(topicSlug) || tag,
      slug: topicSlug,
      href: `/topic/${encodeURIComponent(topicSlug)}`,
      score: 8,
      reason: "Category topic hub"
    });
  }

  return {
    advisory: true,
    autoInsert: false,
    page: {
      slug: slug || null,
      title: title || null,
      department: department || null,
      qualification: qualification || null,
      state: state || null
    },
    suggestions: {
      relatedRecruitments: relatedRecruitments.slice(0, limit),
      relatedPages: relatedPages.slice(0, limit),
      relatedDepartments: relatedDepartments.slice(0, limit),
      relatedQualifications: relatedQualifications.slice(0, limit),
      relatedStates: relatedStates.slice(0, limit),
      relatedTopics: relatedTopics.slice(0, limit)
    },
    note: "Suggestions only — operators must insert links manually. No automatic insertion."
  };
}

module.exports = {
  buildInternalLinkSuggestions,
  scoreOverlap
};
