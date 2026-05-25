/**
 * Unified admin shell: injects shared sidebar on standalone pages (generator/upload/trash)
 * and topbar tools on all admin pages. Reversible via adminEnhancementsOff=1.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const SIDEBAR_HTML = `
<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">☰</button>
<div class="sidebar" id="sidebar">
  <div class="sidebar-top">
    <h2>Admin Panel</h2>
    <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar">⟨⟩</button>
  </div>
  <div class="nav-group-title">Admin</div>
  <a href="/admin/dashboard"><span class="nav-ico">🏠</span><span class="nav-text">Dashboard</span></a>
  <a href="/admin/page-manager"><span class="nav-ico">📄</span><span class="nav-text">Page Manager</span></a>
  <a href="/admin/monitoring"><span class="nav-ico">📊</span><span class="nav-text">Monitoring</span></a>
  <a href="/admin/alerts"><span class="nav-ico">🔔</span><span class="nav-text">Alerts</span></a>
  <a href="/admin/csv-upload"><span class="nav-ico">📁</span><span class="nav-text">CSV Upload</span></a>
  <a href="/admin/sessions"><span class="nav-ico">🧭</span><span class="nav-text">Sessions</span></a>
  <a href="/admin/activity"><span class="nav-ico">📝</span><span class="nav-text">Activity</span></a>
  <div class="nav-group-title">Content</div>
  <a href="/generator"><span class="nav-ico">➕</span><span class="nav-text">Page Generator</span></a>
  <a href="/upload"><span class="nav-ico">📤</span><span class="nav-text">Upload PDF</span></a>
  <a href="/trash"><span class="nav-ico">🗑</span><span class="nav-text">Trash</span></a>
  <div class="nav-group-title">System</div>
  <button type="button" class="sidebar-nav-btn" id="darkModeToggle"><span class="nav-ico">🌙</span><span class="nav-text">Dark Mode</span></button>
  <a href="#" class="logout-link" id="logoutLink"><span class="nav-ico">🚪</span><span class="nav-text">Logout</span></a>
</div>`;

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

  /** Mount bell + palette hint into existing admin-header. */
  function enhanceTopbar() {
    if (document.getElementById("adminTopbarTools")) return;
    const header =
      document.querySelector(".admin-header") ||
      document.querySelector(".main .admin-header");
    if (!header) return;

    const crumbs = parseBreadcrumbs();
    if (crumbs.length && !header.querySelector(".admin-breadcrumbs")) {
      const bc = document.createElement("div");
      bc.innerHTML = renderBreadcrumbsHtml(crumbs);
      header.insertBefore(bc.firstElementChild, header.firstChild);
    }

    const tools = document.createElement("div");
    tools.id = "adminTopbarTools";
    tools.className = "admin-topbar-tools";
    tools.setAttribute("aria-label", "Admin tools");
    header.appendChild(tools);

    if (typeof window.AdminNotifications !== "undefined") {
      window.AdminNotifications.mount(tools);
    }
  }

  /** Inject sidebar on generator/upload/trash (no duplicated sidebar in HTML). */
  function mountStandaloneShell() {
    if (document.getElementById("sidebar")) {
      enhanceTopbar();
      return;
    }
    if (document.body.dataset.adminLayoutMounted === "1") return;

    const wrap = document.createElement("div");
    wrap.innerHTML = SIDEBAR_HTML.trim();
    const frag = document.createDocumentFragment();
    while (wrap.firstChild) frag.appendChild(wrap.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);

    document.body.classList.add("admin-has-sidebar");
    document.body.dataset.adminLayoutMounted = "1";

    enhanceTopbar();

    if (typeof window.AdminShellRebind === "function") {
      window.AdminShellRebind();
    }
  }

  const mode = document.body.getAttribute("data-admin-layout") || "";
  if (mode === "standalone") {
    mountStandaloneShell();
  } else if (document.getElementById("sidebar")) {
    enhanceTopbar();
  }
})();
