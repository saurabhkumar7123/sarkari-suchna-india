"use strict";

const VALID_CATEGORY_TABS = Object.freeze(["departments", "qualifications", "states"]);
const VALID_CATEGORY_TAB_SET = new Set(VALID_CATEGORY_TABS);

const CATEGORY_TAB_META = Object.freeze({
  departments: Object.freeze({
    key: "departments",
    tabLabel: "Departments",
    h1: "All Departments",
    lead: "Browse government jobs by department or recruiting board.",
    title: "All Departments | Sarkari Suchna India",
    description:
      "Browse all government job departments and boards on Sarkari Suchna India. Find Police, SSC, Railway, UPSC and more."
  }),
  qualifications: Object.freeze({
    key: "qualifications",
    tabLabel: "Qualifications",
    h1: "All Qualifications",
    lead: "Browse government jobs by education qualification.",
    title: "All Qualifications | Sarkari Suchna India",
    description:
      "Browse government jobs by qualification on Sarkari Suchna India — 10th, 12th, Graduation, Post Graduation and more."
  }),
  states: Object.freeze({
    key: "states",
    tabLabel: "States",
    h1: "All States",
    lead: "Browse government jobs by state or All India / Central.",
    title: "All States | Sarkari Suchna India",
    description:
      "Browse government jobs by state on Sarkari Suchna India — Uttar Pradesh, Bihar, Rajasthan, Central and more."
  })
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeCategoryTabParam(raw) {
  const tab = String(raw || "")
    .trim()
    .toLowerCase();
  return VALID_CATEGORY_TAB_SET.has(tab) ? tab : "departments";
}

function getCategoryTabMeta(raw) {
  const key = normalizeCategoryTabParam(raw);
  return CATEGORY_TAB_META[key];
}

function categoriesCanonicalPath(raw) {
  const key = normalizeCategoryTabParam(raw);
  return key === "departments" ? "/categories" : `/categories?tab=${key}`;
}

function categoriesHrefForTab(raw) {
  const key = normalizeCategoryTabParam(raw);
  return key === "departments" ? "/categories" : `/categories?tab=${encodeURIComponent(key)}`;
}

function renderCategoriesPanelItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class="categories-browse__empty">No categories available yet.</p>`;
  }

  return items
    .map((item) => {
      const label = String(item && item.label != null ? item.label : "").trim() || "Category";
      const href = String(item && item.href != null ? item.href : "").trim() || "#";
      const count = Number(item && item.count);
      const countHtml =
        Number.isFinite(count) && count > 0
          ? `<span class="categories-browse__count" aria-label="${escapeHtml(String(count))} jobs">${escapeHtml(
              String(count)
            )}</span>`
          : "";
      return `<a href="${escapeHtml(href)}" class="categories-browse__item"><span class="categories-browse__item-label">${escapeHtml(
        label
      )}</span>${countHtml}</a>`;
    })
    .join("");
}

/**
 * Standalone taxonomy browse markup — only the requested context list (no cross-tabs).
 * @param {unknown[]} boards
 * @param {unknown[]} qualifications
 * @param {unknown[]} states
 * @param {string} [activeTabRaw]
 */
function renderCategoriesBrowseHtml(boards, qualifications, states, activeTabRaw) {
  const activeTab = normalizeCategoryTabParam(activeTabRaw);
  const itemsByTab = {
    departments: Array.isArray(boards) ? boards : [],
    qualifications: Array.isArray(qualifications) ? qualifications : [],
    states: Array.isArray(states) ? states : []
  };
  const panelIdByTab = {
    departments: "categoriesBoards",
    qualifications: "categoriesQualifications",
    states: "categoriesStates"
  };
  const itemsHtml = renderCategoriesPanelItems(itemsByTab[activeTab]);
  const panelId = panelIdByTab[activeTab];

  return `<div class="categories-browse" id="categoriesBrowse" data-active-tab="${escapeHtml(
    activeTab
  )}"><section class="categories-browse__panel" id="${escapeHtml(
    panelId
  )}" data-taxonomy-panel="${escapeHtml(
    activeTab
  )}" aria-label="${escapeHtml(CATEGORY_TAB_META[activeTab].h1)}"><div class="categories-browse__list">${itemsHtml}</div></section></div>`;
}

module.exports = {
  VALID_CATEGORY_TABS,
  CATEGORY_TAB_META,
  normalizeCategoryTabParam,
  getCategoryTabMeta,
  categoriesCanonicalPath,
  categoriesHrefForTab,
  renderCategoriesPanelItems,
  renderCategoriesBrowseHtml
};
