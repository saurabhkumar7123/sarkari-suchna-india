/**
 * Homepage taxonomy discovery — accordion tabs (Departments / Qualifications / States).
 * activeTab: selected tab + arrow (▼). panelOpen: content visibility only.
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
  let panelOpen = true;

  function getArrow(tabKey) {
    return tabKey === activeTab ? "▼" : "";
  }

  function syncTabArrow(tab, tabKey) {
    const arrow = getArrow(tabKey);
    let chevron = tab.querySelector(".taxonomy-tabs__chevron");

    if (arrow) {
      if (!chevron) {
        chevron = document.createElement("span");
        chevron.className = "taxonomy-tabs__chevron";
        chevron.setAttribute("aria-hidden", "true");
        tab.appendChild(chevron);
      }
      chevron.textContent = arrow;
    } else if (chevron) {
      chevron.remove();
    }
  }

  function syncUi() {
    tabs.forEach((tab) => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;
      const isActive = key === activeTab;
      const isExpanded = isActive && panelOpen;

      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      syncTabArrow(tab, key);
    });

    panels.forEach((panel) => {
      const key = panel.dataset.taxonomyPanel;
      const isVisible = key === activeTab && panelOpen;
      panel.classList.toggle("taxonomy-panel--active", isVisible);
      panel.setAttribute("aria-hidden", isVisible ? "false" : "true");
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.taxonomyTab;
      if (!key) return;

      if (key === activeTab) {
        if (key === "departments") {
          panelOpen = !panelOpen;
        }
      } else {
        activeTab = key;
        panelOpen = true;
      }

      syncUi();
    });
  });

  syncUi();
})();
