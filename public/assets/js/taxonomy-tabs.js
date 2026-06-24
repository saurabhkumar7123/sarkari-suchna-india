/**
 * Homepage taxonomy discovery.
 * Desktop: accordion tabs (first panel open).
 * Mobile: tap tab → /categories (with ?tab= when needed).
 */
(function initTaxonomyTabs() {
  const root = document.getElementById("taxonomyDiscovery");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll("[data-taxonomy-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-taxonomy-panel]"));
  if (!tabs.length || !panels.length) return;

  const mobileMq = window.matchMedia("(max-width: 768px)");

  function isMobileHome() {
    return mobileMq.matches && document.body.classList.contains("page-home");
  }

  function categoriesHref(tabKey) {
    if (tabKey === "departments") return "/categories";
    return `/categories?tab=${encodeURIComponent(tabKey)}`;
  }

  function defaultDesktopTab() {
    return (
      (tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0]).dataset
        .taxonomyTab || "departments"
    );
  }

  let activeTab = isMobileHome() ? null : defaultDesktopTab();

  const MOBILE_LINK_ARIA = {
    departments: "View all departments",
    qualifications: "View all qualifications",
    states: "View all states"
  };

  function syncUi() {
    root.classList.toggle("taxonomy-discovery--mobile-links", isMobileHome());

    tabs.forEach((tab) => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;

      if (isMobileHome()) {
        tab.classList.remove("is-active");
        tab.setAttribute("aria-selected", "false");
        tab.setAttribute("aria-expanded", "false");
        if (MOBILE_LINK_ARIA[key]) {
          tab.setAttribute("aria-label", MOBILE_LINK_ARIA[key]);
        }
        return;
      }

      tab.removeAttribute("aria-label");

      const isActive = Boolean(activeTab) && key === activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("aria-expanded", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const key = panel.dataset.taxonomyPanel;
      const isVisible = !isMobileHome() && Boolean(activeTab) && key === activeTab;
      panel.classList.toggle("taxonomy-panel--active", isVisible);
      panel.setAttribute("aria-hidden", isVisible ? "false" : "true");
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

      if (isMobileHome()) {
        event.preventDefault();
        navigateWithTransition(categoriesHref(key));
        return;
      }

      if (key === activeTab) return;
      activeTab = key;
      syncUi();
    });
  });

  mobileMq.addEventListener("change", () => {
    if (!isMobileHome() && activeTab === null) {
      activeTab = defaultDesktopTab();
    }
    if (isMobileHome()) {
      activeTab = null;
    }
    syncUi();
  });

  syncUi();
})();
