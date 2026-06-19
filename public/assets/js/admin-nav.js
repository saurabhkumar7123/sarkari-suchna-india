/**
 * Shared admin sidebar navigation — single source for all admin pages.
 */
(function () {
  const ADMIN_NAV_VERSION = "2";

  const NAV_BODY_HTML = `
  <div class="nav-group-title">Overview</div>
  <a href="/admin/dashboard" data-nav-path="/admin/dashboard"><span class="nav-ico">🏠</span><span class="nav-text">Dashboard</span></a>
  <a href="/admin/page-manager" data-nav-path="/admin/page-manager"><span class="nav-ico">📄</span><span class="nav-text">Page Manager</span></a>
  <a href="/admin/monitoring" data-nav-path="/admin/monitoring"><span class="nav-ico">📊</span><span class="nav-text">Monitoring</span></a>
  <a href="/admin/alerts" data-nav-path="/admin/alerts"><span class="nav-ico">🔔</span><span class="nav-text">PDF Alerts</span></a>
  <a href="/admin/csv-upload" data-nav-path="/admin/csv-upload"><span class="nav-ico">📁</span><span class="nav-text">Content Import</span></a>
  <a href="/admin/sessions" data-nav-path="/admin/sessions"><span class="nav-ico">🧭</span><span class="nav-text">Sessions</span></a>
  <a href="/admin/activity" data-nav-path="/admin/activity"><span class="nav-ico">📝</span><span class="nav-text">Activity</span></a>
  <div class="nav-group-title">Publish</div>
  <a href="/generator" data-nav-path="/generator"><span class="nav-ico">➕</span><span class="nav-text">Page Generator</span></a>
  <a href="/upload" data-nav-path="/upload"><span class="nav-ico">📤</span><span class="nav-text">Upload PDF</span></a>
  <a href="/trash" data-nav-path="/trash"><span class="nav-ico">🗑</span><span class="nav-text">Trash</span></a>
  <div class="nav-group-title">Homepage</div>
  <a href="/admin/homepage-management" data-nav-path="/admin/homepage-management"><span class="nav-ico">🌐</span><span class="nav-text">Homepage Management</span></a>
  <div class="nav-group-title sidebar-footer">System</div>
  <button type="button" class="sidebar-nav-btn" id="darkModeToggle"><span class="nav-ico">🌙</span><span class="nav-text">Dark Mode</span></button>
  <a href="#" class="logout-link" id="logoutLink"><span class="nav-ico">🚪</span><span class="nav-text">Logout</span></a>
  `;

  function getSidebarShellHtml() {
    return `<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">☰</button>
<div class="sidebar" id="sidebar" data-nav-version="${ADMIN_NAV_VERSION}">
  <div class="sidebar-top">
    <h2>Sarkari Admin</h2>
    <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar">⟨⟩</button>
  </div>
  ${NAV_BODY_HTML}
</div>`;
  }

  function hydrateSidebarNav() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return false;
    if (sidebar.dataset.navVersion === ADMIN_NAV_VERSION) return true;

    const top = sidebar.querySelector(".sidebar-top");
    if (!top) return false;

    let node = top.nextSibling;
    const toRemove = [];
    while (node) {
      toRemove.push(node);
      node = node.nextSibling;
    }
    toRemove.forEach((n) => n.remove());

    const wrap = document.createElement("div");
    wrap.innerHTML = NAV_BODY_HTML.trim();
    while (wrap.firstChild) sidebar.appendChild(wrap.firstChild);

    sidebar.dataset.navVersion = ADMIN_NAV_VERSION;
    return true;
  }

  window.AdminNav = {
    VERSION: ADMIN_NAV_VERSION,
    getSidebarShellHtml,
    getNavBodyHtml: () => NAV_BODY_HTML,
    hydrate: hydrateSidebarNav
  };
})();
