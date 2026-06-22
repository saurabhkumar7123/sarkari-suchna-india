"use strict";

const { SECTION_STATUS_GROUPS } = require("../repositories/page.repository");
const DESKTOP_SECTION_KEYS = [
  "result",
  "admit-card",
  "latest-job",
  "answer-key",
  "document",
  "admission",
  "syllabus"
];

/** Predefined homepage dynamic section keys — mobile visual order. */
const MOBILE_SECTION_KEYS = [
  "result",
  "latest-job",
  "answer-key",
  "admit-card",
  "document",
  "admission",
  "syllabus"
];

const PREDEFINED_SECTION_META = {
  "latest-job": { label: "latest job", href: "/latest-job" },
  result: { label: "result", href: "/result" },
  "admit-card": { label: "admit card", href: "/admit-card" },
  "answer-key": { label: "answer key", href: "/answer-key" },
  syllabus: { label: "syllabus", href: "/syllabus" },
  admission: { label: "admission", href: "/admission" },
  document: { label: "document", href: "/document" }
};

/** Custom status sections sort after all predefined sections (A–Z). */
const CUSTOM_ORDER_BASE = 8;

/** DB status values already covered by a predefined homepage section (incl. legacy aliases). */
const PREDEFINED_SECTION_STATUSES = (() => {
  const set = new Set();
  for (const group of Object.values(SECTION_STATUS_GROUPS)) {
    for (const status of group) {
      set.add(String(status).trim().toLowerCase());
    }
  }
  for (const meta of Object.values(PREDEFINED_SECTION_META)) {
    set.add(meta.label);
  }
  return set;
})();

function isPredefinedSectionStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return Boolean(s) && PREDEFINED_SECTION_STATUSES.has(s);
}

function orderIndexForKey(sectionKey, platform) {
  const list = platform === "mobile" ? MOBILE_SECTION_KEYS : DESKTOP_SECTION_KEYS;
  const idx = list.indexOf(sectionKey);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * @param {string[]} customStatuses Lowercased custom status strings (non-predefined).
 */
function buildHomepageSectionDefs(customStatuses) {
  const customs = [...customStatuses]
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => s && !isPredefinedSectionStatus(s))
    .sort((a, b) => a.localeCompare(b));

  const predefined = DESKTOP_SECTION_KEYS.map((key) => {
    const meta = PREDEFINED_SECTION_META[key];
    return {
      section: key,
      ribbonStatus: meta.label,
      href: meta.href,
      queryMode: "section",
      queryValue: key,
      orderDesktop: orderIndexForKey(key, "desktop"),
      orderMobile: orderIndexForKey(key, "mobile")
    };
  });

  const customDefs = customs.map((status, index) => ({
      section: `custom:${status}`,
      ribbonStatus: status,
      href: `/result?status=${encodeURIComponent(status)}`,
      queryMode: "status",
      queryValue: status,
      orderDesktop: CUSTOM_ORDER_BASE + index,
      orderMobile: CUSTOM_ORDER_BASE + index
    }));

  return [...predefined, ...customDefs];
}

function escapeHtmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** SSR card wrapper attributes for CSS grid `order` (desktop vs mobile). */
function buildHomeSectionCardAttrs(def) {
  const section = String(def?.section || "");
  const orderDesktop = Number(def?.orderDesktop) > 0 ? Number(def.orderDesktop) : 99;
  const orderMobile = Number(def?.orderMobile) > 0 ? Number(def.orderMobile) : 99;
  return `data-home-section="${escapeHtmlAttr(section)}" style="--home-order-desktop:${orderDesktop};--home-order-mobile:${orderMobile}"`;
}

/**
 * Sort homepage section results for the active platform (desktop vs mobile).
 * @param {{ def?: { orderDesktop?: number, orderMobile?: number } }[]} sectionResults
 * @param {"desktop"|"mobile"} platform
 */
function sortHomeSectionResults(sectionResults, platform) {
  const orderKey = platform === "mobile" ? "orderMobile" : "orderDesktop";
  return [...sectionResults].sort((a, b) => {
    const ao = Number(a?.def?.[orderKey]);
    const bo = Number(b?.def?.[orderKey]);
    const av = Number.isFinite(ao) && ao > 0 ? ao : 99;
    const bv = Number.isFinite(bo) && bo > 0 ? bo : 99;
    return av - bv;
  });
}

module.exports = {
  DESKTOP_SECTION_KEYS,
  MOBILE_SECTION_KEYS,
  PREDEFINED_SECTION_META,
  CUSTOM_ORDER_BASE,
  orderIndexForKey,
  buildHomepageSectionDefs,
  buildHomeSectionCardAttrs,
  sortHomeSectionResults,
  isPredefinedSectionStatus,
  PREDEFINED_SECTION_STATUSES
};
