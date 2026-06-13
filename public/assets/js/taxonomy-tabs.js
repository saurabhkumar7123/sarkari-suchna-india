/**
 * Homepage taxonomy discovery — compact accordion tabs.
 * One tab active; content row is always single-line (2 preview pills + View All).
 */
(function initTaxonomyTabs() {
  const root = document.getElementById("taxonomyDiscovery");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll("[data-taxonomy-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-taxonomy-panel]"));
  if (!tabs.length || !panels.length) return;

  let activeTab =
    (tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0]).dataset.taxonomyTab ||
    "departments";

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
      syncUi();
    });
  });

  syncUi();
})();
