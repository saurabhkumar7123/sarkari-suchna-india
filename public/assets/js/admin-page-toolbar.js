/**
 * Shared admin page toolbar — last updated label + refresh wiring.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  let lastUpdatedAt = null;

  function formatUpdated(d) {
    if (!d) return "Not loaded yet";
    return `Updated ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }

  function ensureLastUpdatedEl() {
    let el = document.getElementById("adminLastUpdated");
    if (el) return el;
    const host = document.querySelector(".admin-header-actions") || document.querySelector(".admin-right");
    if (!host) return null;
    el = document.createElement("span");
    el.id = "adminLastUpdated";
    el.className = "admin-last-updated";
    el.setAttribute("aria-live", "polite");
    host.insertBefore(el, host.firstChild);
    return el;
  }

  function markUpdated() {
    lastUpdatedAt = new Date();
    const el = ensureLastUpdatedEl();
    if (el) el.textContent = formatUpdated(lastUpdatedAt);
    window.AdminIdleSession?.touch?.();
  }

  function wireRefreshButtons() {
    const selectors = [
      "#dashboardRefreshBtn",
      "#refreshSitesBtn",
      "#trashRefreshBtn",
    "#trashRefreshBtn2",
    "#refreshActivityBtn",
    "#managerRefreshBtn",
    "#homepageMgmtRefreshBtn",
    "#refreshImportsBtn",
    "#pdfAlertsRefresh",
    ".header-action-btn[data-admin-refresh]"
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.dataset.toolbarBound === "1") return;
        btn.dataset.toolbarBound = "1";
        btn.addEventListener("click", () => {
          setTimeout(markUpdated, 0);
        });
      });
    });
  }

  function init() {
    ensureLastUpdatedEl();
    wireRefreshButtons();
    if (typeof window.adminPageRefreshHandler === "function") {
      markUpdated();
    }
  }

  window.AdminPageToolbar = {
    markUpdated,
    init,
    wireRefreshButtons
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
