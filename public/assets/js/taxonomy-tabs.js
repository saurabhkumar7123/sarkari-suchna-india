/**
 * Homepage taxonomy discovery — tab switcher (Departments / Qualifications / States).
 * All viewports: one active panel; links remain SSR-rendered in inactive panels.
 */
(function initTaxonomyTabs() {
  const root = document.getElementById("taxonomyDiscovery");
  if (!root) return;

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
      const tabKey = tab.dataset.taxonomyTab;
      if (!tabKey) return;
      setActiveTab(tabKey);
    });
  });

  const current = tabs.find((tab) => tab.classList.contains("is-active"));
  setActiveTab(current && current.dataset.taxonomyTab ? current.dataset.taxonomyTab : defaultTab);
})();
