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
    if (typeof window.AdminHoistTopbar === "function") {
      window.AdminHoistTopbar();
    }
    if (document.getElementById("adminTopbarTools")) return;
    const bar = document.getElementById("adminAppTopbar");
    if (!bar) return;

    let identity = document.getElementById("adminTopbarIdentity");
    if (!identity) {
      identity = document.createElement("div");
      identity.id = "adminTopbarIdentity";
      const toggle = document.getElementById("sidebarToggle");
      if (toggle && toggle.parentElement === bar) {
        bar.insertBefore(identity, toggle.nextSibling);
      } else {
        bar.insertBefore(identity, bar.firstChild);
      }
    }

    const crumbs = parseBreadcrumbs();
    if (crumbs.length && !identity.querySelector(".admin-breadcrumbs")) {
      identity.innerHTML = renderBreadcrumbsHtml(crumbs);
    }

    const tools = document.createElement("div");
    tools.id = "adminTopbarTools";
    tools.className = "admin-topbar-tools";
    tools.setAttribute("aria-label", "Admin tools");

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "admin-topbar-search";
    searchBtn.id = "adminTopbarSearchBtn";
    searchBtn.setAttribute("aria-label", "Search admin pages");
    searchBtn.textContent = "Search";
    searchBtn.addEventListener("click", () => {
      if (window.AdminCommandPalette && typeof window.AdminCommandPalette.open === "function") {
        window.AdminCommandPalette.open();
      }
    });
    tools.appendChild(searchBtn);

    bar.appendChild(tools);

    if (typeof window.AdminNotifications !== "undefined") {
      window.AdminNotifications.mount(tools);
    }

    const darkBtn = document.createElement("button");
    darkBtn.type = "button";
    darkBtn.className = "admin-topbar-iconbtn";
    darkBtn.id = "topbarDarkModeToggle";
    darkBtn.setAttribute("aria-label", "Toggle dark mode");
    darkBtn.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
    tools.appendChild(darkBtn);

    const account = document.createElement("a");
    account.href = "/admin/sessions";
    account.className = "admin-topbar-iconbtn";
    account.setAttribute("aria-label", "Account and sessions");
    account.textContent = "Account";
    account.style.textDecoration = "none";
    tools.appendChild(account);

    if (typeof window.AdminShellRebind === "function") {
      window.AdminShellRebind();
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
    if (typeof window.AdminHoistTopbar === "function") {
      window.AdminHoistTopbar();
    } else if (typeof window.AdminShellRebind === "function") {
      window.AdminShellRebind();
    }
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
    if (typeof window.AdminHoistTopbar === "function") {
      window.AdminHoistTopbar();
    }
    enhanceTopbar();
  }
})();
