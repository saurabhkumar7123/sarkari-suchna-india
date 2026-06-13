/**
 * /categories — URL-driven tab state (?tab=departments|qualifications|states).
 */
(function initCategoriesTabs() {
  "use strict";

  const VALID_TABS = new Set(["departments", "qualifications", "states"]);
  const root = document.getElementById("categoriesBrowse");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll("[data-taxonomy-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-taxonomy-panel]"));
  if (!tabs.length || !panels.length) return;

  function parseTabFromUrl() {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const normalized = String(tab || "")
      .trim()
      .toLowerCase();
    return VALID_TABS.has(normalized) ? normalized : "departments";
  }

  function buildUrl(tab) {
    const params = new URLSearchParams(window.location.search);
    if (tab === "departments") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    return query ? `${window.location.pathname}?${query}` : window.location.pathname;
  }

  let activeTab = parseTabFromUrl();

  function syncUi() {
    tabs.forEach((tab) => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;
      const isActive = key === activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("aria-expanded", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const key = panel.dataset.taxonomyPanel;
      const isVisible = key === activeTab;
      panel.classList.toggle("taxonomy-panel--active", isVisible);
      panel.setAttribute("aria-hidden", isVisible ? "false" : "true");
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.taxonomyTab;
      if (!key || key === activeTab) return;
      activeTab = key;
      window.history.pushState(null, "", buildUrl(activeTab));
      syncUi();
    });
  });

  window.addEventListener("popstate", () => {
    activeTab = parseTabFromUrl();
    syncUi();
  });

  syncUi();
})();
