/**
 * Unified admin shell: sidebar on standalone pages + topbar tools.
 * Standalone content is wrapped in #standaloneAdminShell to avoid dashboard layout leaks.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const SIDEBAR_HTML = window.AdminNav
    ? window.AdminNav.getSidebarShellHtml()
    : `<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">☰</button><div class="sidebar" id="sidebar"></div>`;

  function detectStandalonePageClass() {
    const p = String(window.location.pathname || "").toLowerCase();
    if (p.includes("/generator")) return "generator-page";
    if (p.includes("/upload")) return "upload-page";
    if (p.includes("/trash")) return "trash-page";
    return "";
  }

  function applyStandaloneBodyClasses() {
    document.body.classList.add("standalone-admin-page");
    const pageClass = detectStandalonePageClass();
    if (pageClass) document.body.classList.add(pageClass);
  }

  function parseBreadcrumbs() {
    const raw = document.body.getAttribute("data-admin-breadcrumbs") || "";
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function renderBreadcrumbsHtml(crumbs) {
    if (!crumbs.length) return "";
    const parts = crumbs.map((label, i) => {
      if (i === crumbs.length - 1) return `<span>${label}</span>`;
      return `<span>${label}</span><span aria-hidden="true">›</span>`;
    });
    return `<nav class="admin-breadcrumbs" aria-label="Breadcrumb">${parts.join("")}</nav>`;
  }

  function enhanceTopbar() {
    if (document.getElementById("adminTopbarTools")) return;
    const header = document.querySelector("#adminAppTopbar .admin-header") || document.querySelector("#standaloneAdminShell .admin-header") || document.querySelector(".admin-header");
    if (!header) return;

    const crumbs = parseBreadcrumbs();
    if (crumbs.length && !header.querySelector(".admin-breadcrumbs")) {
      const bc = document.createElement("div");
      bc.innerHTML = renderBreadcrumbsHtml(crumbs);
      header.insertBefore(bc.firstElementChild, header.firstChild);
    }

    const toolsHost = header.querySelector(".admin-right") || header;
    const tools = document.createElement("div");
    tools.id = "adminTopbarTools";
    tools.className = "admin-topbar-tools";
    tools.setAttribute("aria-label", "Admin tools");
    toolsHost.appendChild(tools);

    if (typeof window.AdminNotifications !== "undefined") {
      window.AdminNotifications.mount(tools);
    }
  }

  /**
   * Wrap header + main-container so sidebar offset applies once (original page widths inside).
   */
  function wrapStandaloneContent() {
    if (document.getElementById("standaloneAdminShell")) return;
    const header = document.querySelector(".admin-header");
    const main = document.querySelector(".main-container");
    if (!main || main.closest("#standaloneAdminShell")) return;

    const shell = document.createElement("div");
    shell.id = "standaloneAdminShell";
    shell.className = "standalone-admin-content";

    const anchor = header && header.parentNode === main.parentNode ? header : main;
    const parent = anchor.parentNode;
    parent.insertBefore(shell, anchor);
    if (header && !header.closest("#adminAppTopbar") && header.parentNode === parent) {
      shell.appendChild(header);
    }
    shell.appendChild(main);
  }

  function mountStandaloneShell() {
    applyStandaloneBodyClasses();

    if (!document.getElementById("sidebar")) {
      if (document.body.dataset.adminLayoutMounted === "1") return;
      const wrap = document.createElement("div");
      wrap.innerHTML = SIDEBAR_HTML.trim();
      const frag = document.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      document.body.insertBefore(frag, document.body.firstChild);
      document.body.dataset.adminLayoutMounted = "1";
    }

    wrapStandaloneContent();
    enhanceTopbar();

    if (typeof window.AdminShellRebind === "function") {
      window.AdminShellRebind();
    }
    if (typeof window.refreshGeneratorDraftsSidebar === "function") {
      window.refreshGeneratorDraftsSidebar();
    }
  }

  const mode = document.body.getAttribute("data-admin-layout") || "";
  if (mode === "standalone") {
    mountStandaloneShell();
  } else if (document.getElementById("sidebar")) {
    enhanceTopbar();
  }
})();
