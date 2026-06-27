/**
 * Shared admin sidebar navigation — single source for all admin pages.
 */
(function () {
  const ADMIN_NAV_VERSION = "6";

  const SIDEBAR_TOP_HTML = `
  <a href="/admin/dashboard" class="sidebar-brand" title="Admin dashboard">
    <span class="sidebar-brand__mark" aria-hidden="true">SS</span>
    <span class="sidebar-brand__copy">
      <span class="sidebar-brand__name">Sarkari Admin</span>
      <span class="sidebar-brand__sub">Control panel</span>
    </span>
  </a>
  <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar">⟨⟩</button>
  `;

  const NAV_BODY_HTML = `
  <div class="nav-group-title">Overview</div>
  <a href="/admin/dashboard" data-nav-path="/admin/dashboard"><span class="nav-ico">🏠</span><span class="nav-text">Dashboard</span></a>
  <a href="/admin/page-manager" data-nav-path="/admin/page-manager"><span class="nav-ico">📄</span><span class="nav-text">Page Manager</span></a>
  <a href="/admin/monitoring" data-nav-path="/admin/monitoring"><span class="nav-ico">📊</span><span class="nav-text">Monitoring</span></a>
  <a href="/admin/alerts" data-nav-path="/admin/alerts"><span class="nav-ico">🔔</span><span class="nav-text">PDF Alerts</span></a>
  <a href="/admin/csv-upload" data-nav-path="/admin/csv-upload"><span class="nav-ico">📁</span><span class="nav-text">Content Import</span></a>
  <a href="/admin/sessions" data-nav-path="/admin/sessions"><span class="nav-ico">🧭</span><span class="nav-text">Sessions</span></a>
  <a href="/admin/activity" data-nav-path="/admin/activity"><span class="nav-ico">📝</span><span class="nav-text">Activity</span></a>
  <a href="/" class="sidebar-view-site" target="_blank" rel="noopener noreferrer"><span class="nav-ico">↗</span><span class="nav-text">View website</span></a>
  <div class="nav-group-title">Publish</div>
  <a href="/generator" data-nav-path="/generator"><span class="nav-ico">➕</span><span class="nav-text">Page Generator</span></a>
  <div class="sidebar-drafts" id="sidebarGeneratorDrafts" aria-label="Generator parked drafts">
    <div class="sidebar-drafts__head">
      <span class="sidebar-drafts__title">Parked drafts</span>
      <span class="sidebar-drafts__count" id="sidebarDraftCount">Total 0</span>
    </div>
    <div class="sidebar-drafts__section" data-draft-section="draft">
      <button type="button" class="sidebar-drafts__toggle" data-draft-toggle="draft" aria-expanded="false">
        <span class="sidebar-drafts__toggle-label">Unpublished</span>
        <span class="sidebar-drafts__badge" id="sidebarDraftBadgeDraft">0</span>
        <span class="sidebar-drafts__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="sidebar-drafts__body" id="sidebarDraftBodyDraft" hidden>
        <ul class="sidebar-drafts__list" id="sidebarDraftListDraft" role="list"></ul>
        <p class="sidebar-drafts__section-empty" id="sidebarDraftEmptyDraft" hidden>No unpublished drafts.</p>
      </div>
    </div>
    <div class="sidebar-drafts__section sidebar-drafts__section--published" data-draft-section="published">
      <button type="button" class="sidebar-drafts__toggle" data-draft-toggle="published" aria-expanded="false">
        <span class="sidebar-drafts__toggle-label">Published</span>
        <span class="sidebar-drafts__badge is-muted" id="sidebarDraftBadgePublished">0</span>
        <span class="sidebar-drafts__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="sidebar-drafts__body" id="sidebarDraftBodyPublished" hidden>
        <ul class="sidebar-drafts__list" id="sidebarDraftListPublished" role="list"></ul>
        <p class="sidebar-drafts__section-empty" id="sidebarDraftEmptyPublished" hidden>No published-from-draft pages yet.</p>
      </div>
    </div>
    <p class="sidebar-drafts__empty" id="sidebarDraftsEmpty">No parked drafts yet. Use <strong>Save draft</strong> in the generator.</p>
  </div>
  <a href="/upload" data-nav-path="/upload"><span class="nav-ico">📤</span><span class="nav-text">Upload PDF</span></a>
  <a href="/trash" data-nav-path="/trash"><span class="nav-ico">🗑</span><span class="nav-text">Trash</span></a>
  <div class="nav-group-title">Homepage</div>
  <a href="/admin/homepage-management" data-nav-path="/admin/homepage-management"><span class="nav-ico">🌐</span><span class="nav-text">Homepage Management</span></a>
  <div class="sidebar-footer">
    <div class="nav-group-title sidebar-footer__label">System</div>
    <button type="button" class="sidebar-nav-btn" id="darkModeToggle"><span class="nav-ico">🌙</span><span class="nav-text">Dark Mode</span></button>
    <a href="#" class="logout-link" id="logoutLink"><span class="nav-ico">🚪</span><span class="nav-text">Logout</span></a>
  </div>
  `;

  function getSidebarShellHtml() {
    return `<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Open navigation"><span class="toggle-btn__icon" aria-hidden="true">☰</span><span class="toggle-btn__label">Menu</span></button>
<div class="sidebar" id="sidebar" data-nav-version="${ADMIN_NAV_VERSION}">
  <div class="sidebar-top">
    ${SIDEBAR_TOP_HTML.trim()}
  </div>
  <nav class="sidebar-nav" aria-label="Admin navigation">
    ${NAV_BODY_HTML.trim()}
  </nav>
</div>`;
  }

  function hydrateSidebarNav() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return false;

    const panel = document.getElementById("sidebarGeneratorDrafts");
    const needsDraftsPanel = !panel;
    const needsAccordionUpgrade = !!(panel && !panel.querySelector("[data-draft-toggle]"));
    if (sidebar.dataset.navVersion === ADMIN_NAV_VERSION && !needsDraftsPanel && !needsAccordionUpgrade) {
      document.dispatchEvent(new CustomEvent("adminNavHydrated"));
      return true;
    }

    const top = sidebar.querySelector(".sidebar-top");
    if (top) {
      top.innerHTML = SIDEBAR_TOP_HTML.trim();
    }

    let navHost = sidebar.querySelector(".sidebar-nav");
    if (!navHost) {
      navHost = document.createElement("nav");
      navHost.className = "sidebar-nav";
      navHost.setAttribute("aria-label", "Admin navigation");
      const afterTop = sidebar.querySelector(".sidebar-top");
      if (afterTop && afterTop.nextSibling) {
        sidebar.insertBefore(navHost, afterTop.nextSibling);
      } else {
        sidebar.appendChild(navHost);
      }
    }

    navHost.innerHTML = NAV_BODY_HTML.trim();

    Array.from(sidebar.children).forEach((child) => {
      if (child === top || child === navHost || child.id === "sidebarToggle") return;
      if (child.matches && (child.matches("a") || child.matches("button") || child.matches(".nav-group-title") || child.matches(".sidebar-footer"))) {
        child.remove();
      }
    });

    sidebar.dataset.navVersion = ADMIN_NAV_VERSION;
    document.dispatchEvent(new CustomEvent("adminNavHydrated"));
    return true;
  }

  window.AdminNav = {
    VERSION: ADMIN_NAV_VERSION,
    getSidebarShellHtml,
    getNavBodyHtml: () => NAV_BODY_HTML,
    hydrate: hydrateSidebarNav
  };
})();
