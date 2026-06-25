/**
 * Homepage taxonomy discovery — compact link row (departments / qualifications / states).
 * All viewports: tabs navigate to /categories; preview pills stay on categories page only.
 */
(function initTaxonomyTabs() {
  const root = document.getElementById("taxonomyDiscovery");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll("[data-taxonomy-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-taxonomy-panel]"));
  if (!tabs.length || !panels.length) return;

  root.classList.add("taxonomy-discovery--mobile-links");

  const TAB_ARIA = {
    departments: "View all departments",
    qualifications: "View all qualifications",
    states: "View all states"
  };

  function categoriesHref(tabKey) {
    if (tabKey === "departments") return "/categories";
    return `/categories?tab=${encodeURIComponent(tabKey)}`;
  }

  function syncUi() {
    tabs.forEach((tab) => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;
      tab.classList.remove("is-active");
      tab.setAttribute("aria-selected", "false");
      tab.setAttribute("aria-expanded", "false");
      if (TAB_ARIA[key]) {
        tab.setAttribute("aria-label", TAB_ARIA[key]);
      }
    });

    panels.forEach((panel) => {
      panel.classList.remove("taxonomy-panel--active");
      panel.setAttribute("aria-hidden", "true");
    });
  }

  function navigateWithTransition(href) {
    document.body.classList.remove("page-active");
    document.body.classList.add("page-exit");
    window.setTimeout(() => {
      window.location.assign(href);
    }, 400);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;
      event.preventDefault();
      navigateWithTransition(categoriesHref(key));
    });
  });

  syncUi();
})();
