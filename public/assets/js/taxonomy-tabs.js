/**
 * Homepage taxonomy discovery — mobile tab switcher (Departments / Qualifications / States).
 * Desktop: all panels remain visible; tabs hidden via CSS.
 */
(function initTaxonomyTabs() {
  const root = document.getElementById("taxonomyDiscovery");
  if (!root) return;

  const mobileQuery = window.matchMedia("(max-width: 768px)");
  const tabs = Array.from(root.querySelectorAll("[data-taxonomy-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-taxonomy-panel]"));
  if (!tabs.length || !panels.length) return;

  const defaultTab = tabs[0] && tabs[0].dataset.taxonomyTab ? tabs[0].dataset.taxonomyTab : "departments";

  function setActiveTab(tabKey) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.taxonomyTab === tabKey;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.taxonomyPanel === tabKey;
      panel.classList.toggle("taxonomy-panel--active", isActive);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (!mobileQuery.matches) return;
      const tabKey = tab.dataset.taxonomyTab;
      if (!tabKey) return;
      setActiveTab(tabKey);
    });
  });

  function syncForViewport() {
    if (mobileQuery.matches) {
      const current = tabs.find((tab) => tab.classList.contains("is-active"));
      setActiveTab(current && current.dataset.taxonomyTab ? current.dataset.taxonomyTab : defaultTab);
      return;
    }
    panels.forEach((panel) => panel.classList.add("taxonomy-panel--active"));
  }

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncForViewport);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(syncForViewport);
  }

  syncForViewport();
})();
