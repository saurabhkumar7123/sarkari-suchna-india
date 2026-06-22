const SECTION_DISPLAY_NAMES = {
  "latest job": "Latest Jobs",
  "new form": "Latest Jobs",
  "admit card": "Admit Cards",
  result: "Results",
  "answer key": "Answer Keys",
  syllabus: "Syllabus",
  admission: "Admission",
  document: "Documents"
};

function normalizeRibbonKey(status) {
  return String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function titleCaseWords(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getHomeSectionDisplayName(ribbonStatus) {
  const key = normalizeRibbonKey(ribbonStatus);
  if (SECTION_DISPLAY_NAMES[key]) return SECTION_DISPLAY_NAMES[key];
  return titleCaseWords(key);
}

function getHomeViewMoreAccentClass(ribbonStatus) {
  const s = normalizeRibbonKey(ribbonStatus);

  if (s === "latest job" || s.startsWith("latest job ")) return "view-more--navy";
  if (s === "new form" || s.startsWith("new form ")) return "view-more--navy";
  if (s === "admission" || s.startsWith("admission ")) return "view-more--navy";
  if (s.includes("admit card") || s === "admit") return "view-more--orange";
  if (s.includes("answer key") || s === "answer") return "view-more--purple";
  if (s.includes("result")) return "view-more--green";
  if (s.includes("syllabus")) return "view-more--blue";
  if (s.includes("document")) return "view-more--orange";
  if (/\bnew\b/.test(s)) return "view-more--blue";

  return "view-more--green";
}

function buildHomeViewMoreLabel(ribbonStatus, shownCount, total) {
  const name = getHomeSectionDisplayName(ribbonStatus);
  const shown = Math.max(0, Number(shownCount) || 0);
  const totalNum = Number(total);

  if (Number.isFinite(totalNum) && totalNum > shown) {
    return `View all ${totalNum} ${name}`;
  }

  return `View all ${name}`;
}

function buildHomeViewMoreAriaLabel(ribbonStatus, shownCount, total) {
  const label = buildHomeViewMoreLabel(ribbonStatus, shownCount, total);
  return `${label} updates`;
}

function buildHomeViewMoreLinkHtml(def, payload, escapeHtml) {
  const escape = typeof escapeHtml === "function" ? escapeHtml : (v) => String(v ?? "");
  const shown = Array.isArray(payload && payload.data) ? payload.data.length : 0;
  const total =
    payload && payload.pagination && payload.pagination.total != null
      ? payload.pagination.total
      : null;

  const ribbonStatus = def && def.ribbonStatus ? def.ribbonStatus : "";
  const href = def && def.href ? def.href : "#";
  const label = buildHomeViewMoreLabel(ribbonStatus, shown, total);
  const ariaLabel = buildHomeViewMoreAriaLabel(ribbonStatus, shown, total);
  const accent = getHomeViewMoreAccentClass(ribbonStatus);

  return `<div class="card-view-more"><a href="${escape(href)}" class="view-more ${accent}" aria-label="${escape(ariaLabel)}"><span class="view-more__text">${escape(label)}</span><span class="view-more__arrow" aria-hidden="true">→</span></a></div>`;
}

module.exports = {
  getHomeSectionDisplayName,
  getHomeViewMoreAccentClass,
  buildHomeViewMoreLabel,
  buildHomeViewMoreAriaLabel,
  buildHomeViewMoreLinkHtml
};
