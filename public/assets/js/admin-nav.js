/**
 * Shared admin sidebar navigation — Navigation Rail + Menu Panel (Option E).
 * Presentation only: same routes/URLs, premium IA chrome.
 */
(function () {
  const ADMIN_NAV_VERSION = "18";

  const SIDEBAR_TOP_HTML = `
  <a href="/admin/dashboard" class="sidebar-brand" title="Sarkari Suchna Admin">
    <span class="sidebar-brand__logo" aria-hidden="true">
      <svg class="sidebar-brand__logo-img" viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="currentColor" stroke-width="1.5" opacity="0.28"/>
        <text x="16" y="21.5" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="0.02em" fill="currentColor">SSI</text>
      </svg>
    </span>
    <span class="sidebar-brand__copy">
      <span class="sidebar-brand__name">Sarkari Suchna</span>
      <span class="sidebar-brand__sub">Admin Control Center</span>
    </span>
  </a>
  <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar" aria-controls="sidebar" aria-expanded="true" title="Collapse sidebar">
    <span class="sidebar-collapse-btn__icon sidebar-collapse-btn__icon--collapse" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 6 8l4 4.5"/></svg>
    </span>
    <span class="sidebar-collapse-btn__icon sidebar-collapse-btn__icon--expand" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10 8l-4 4.5"/></svg>
    </span>
  </button>
  `;

  const SIDEBAR_RAIL_HTML = `
  <div class="sidebar-rail" role="tablist" aria-label="Admin sections">
    <button type="button" class="sidebar-rail__item" role="tab" data-rail-group="dashboard" aria-controls="nav-group-dashboard" aria-label="Section 1 Dashboard" title="Dashboard">
      <span class="sidebar-rail__num" aria-hidden="true">1</span>
      <span class="sidebar-rail__ico" aria-hidden="true">🏠</span>
    </button>
    <button type="button" class="sidebar-rail__item" role="tab" data-rail-group="content" aria-controls="nav-group-content" aria-label="Section 2 Content" title="Content">
      <span class="sidebar-rail__num" aria-hidden="true">2</span>
      <span class="sidebar-rail__ico" aria-hidden="true">📄</span>
    </button>
    <button type="button" class="sidebar-rail__item" role="tab" data-rail-group="recruitment" aria-controls="nav-group-recruitment" aria-label="Section 3 Recruitment" title="Recruitment">
      <span class="sidebar-rail__num" aria-hidden="true">3</span>
      <span class="sidebar-rail__ico" aria-hidden="true">🗂</span>
    </button>
    <button type="button" class="sidebar-rail__item" role="tab" data-rail-group="monitoring" aria-controls="nav-group-monitoring" aria-label="Section 4 Monitoring" title="Monitoring">
      <span class="sidebar-rail__num" aria-hidden="true">4</span>
      <span class="sidebar-rail__ico" aria-hidden="true">📊</span>
    </button>
    <button type="button" class="sidebar-rail__item" role="tab" data-rail-group="system" aria-controls="nav-group-system" aria-label="Section 5 System" title="System">
      <span class="sidebar-rail__num" aria-hidden="true">5</span>
      <span class="sidebar-rail__ico" aria-hidden="true">🧭</span>
    </button>
    <button type="button" class="sidebar-rail__item sidebar-rail__item--account" role="tab" data-rail-group="account" aria-controls="nav-group-account" aria-label="Section 6 Account" title="Account">
      <span class="sidebar-rail__num" aria-hidden="true">6</span>
      <span class="sidebar-rail__ico" aria-hidden="true">👤</span>
    </button>
  </div>
  `;

  const NAV_BODY_HTML = `
  <div class="nav-group" id="nav-group-dashboard" data-nav-group="dashboard" data-nav-index="1" data-default-open="1">
    <button type="button" class="nav-group-toggle" aria-expanded="true" data-nav-group-toggle="dashboard">
      <span class="nav-group-heading">
        <span class="nav-group-title">Dashboard</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <a href="/admin/dashboard" data-nav-path="/admin/dashboard"><span class="nav-ico" aria-hidden="true">🏠</span><span class="nav-text">Dashboard</span></a>
      <a href="/" class="sidebar-view-site" target="_blank" rel="noopener noreferrer"><span class="nav-ico" aria-hidden="true">↗</span><span class="nav-text">View website</span></a>
    </div>
  </div>

  <div class="nav-group" id="nav-group-content" data-nav-group="content" data-nav-index="2" data-default-open="0">
    <button type="button" class="nav-group-toggle" aria-expanded="false" data-nav-group-toggle="content">
      <span class="nav-group-heading">
        <span class="nav-group-title">Content</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <a href="/generator" data-nav-path="/generator"><span class="nav-ico" aria-hidden="true">➕</span><span class="nav-text">Generator</span></a>
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
      <a href="/admin/page-manager" data-nav-path="/admin/page-manager"><span class="nav-ico" aria-hidden="true">📄</span><span class="nav-text">Page Manager</span></a>
      <a href="/admin/homepage-management" data-nav-path="/admin/homepage-management"><span class="nav-ico" aria-hidden="true">🌐</span><span class="nav-text">Homepage Management</span></a>
      <a href="/admin/csv-upload" data-nav-path="/admin/csv-upload"><span class="nav-ico" aria-hidden="true">📁</span><span class="nav-text">CSV Upload</span></a>
      <a href="/upload" data-nav-path="/upload"><span class="nav-ico" aria-hidden="true">📤</span><span class="nav-text">Upload</span></a>
      <a href="/trash" data-nav-path="/trash"><span class="nav-ico" aria-hidden="true">🗑</span><span class="nav-text">Trash</span></a>
    </div>
  </div>

  <div class="nav-group" id="nav-group-recruitment" data-nav-group="recruitment" data-nav-index="3" data-default-open="0">
    <button type="button" class="nav-group-toggle" aria-expanded="false" data-nav-group-toggle="recruitment">
      <span class="nav-group-heading">
        <span class="nav-group-title">Recruitment</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <a href="/admin/recruitments" data-nav-path="/admin/recruitments"><span class="nav-ico" aria-hidden="true">🗂</span><span class="nav-text">Recruitments</span></a>
      <a href="/admin/recruitment-review-queue" data-nav-path="/admin/recruitment-review-queue"><span class="nav-ico" aria-hidden="true">📋</span><span class="nav-text">Review Queue</span></a>
      <a href="/admin/editorial-review" data-nav-path="/admin/editorial-review"><span class="nav-ico" aria-hidden="true">✅</span><span class="nav-text">Editorial Review</span></a>
      <a href="/admin/recruitment-runtime-preview" data-nav-path="/admin/recruitment-runtime-preview"><span class="nav-ico" aria-hidden="true">👁</span><span class="nav-text">Runtime Preview</span></a>
      <a href="/admin/recruitment-testing" data-nav-path="/admin/recruitment-testing"><span class="nav-ico" aria-hidden="true">🧪</span><span class="nav-text">Recruitment Testing</span></a>
      <a href="/admin/recruitments#eventTimeline" data-nav-path="/admin/recruitments" data-nav-alias="events"><span class="nav-ico" aria-hidden="true">📅</span><span class="nav-text">Event Timeline</span></a>
    </div>
  </div>

  <div class="nav-group" id="nav-group-monitoring" data-nav-group="monitoring" data-nav-index="4" data-default-open="0">
    <button type="button" class="nav-group-toggle" aria-expanded="false" data-nav-group-toggle="monitoring">
      <span class="nav-group-heading">
        <span class="nav-group-title">Monitoring</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <a href="/admin/monitoring" data-nav-path="/admin/monitoring"><span class="nav-ico" aria-hidden="true">📊</span><span class="nav-text">Monitoring</span></a>
      <a href="/admin/alerts" data-nav-path="/admin/alerts"><span class="nav-ico" aria-hidden="true">🔔</span><span class="nav-text">Alerts</span></a>
      <a href="/admin/seo-diagnostics" data-nav-path="/admin/seo-diagnostics"><span class="nav-ico" aria-hidden="true">🔎</span><span class="nav-text">SEO Diagnostics</span></a>
    </div>
  </div>

  <div class="nav-group" id="nav-group-system" data-nav-group="system" data-nav-index="5" data-default-open="0">
    <button type="button" class="nav-group-toggle" aria-expanded="false" data-nav-group-toggle="system">
      <span class="nav-group-heading">
        <span class="nav-group-title">System</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <a href="/admin/activity" data-nav-path="/admin/activity"><span class="nav-ico" aria-hidden="true">📝</span><span class="nav-text">Activity</span></a>
      <a href="/admin/sessions" data-nav-path="/admin/sessions"><span class="nav-ico" aria-hidden="true">🧭</span><span class="nav-text">Sessions</span></a>
    </div>
  </div>

  <div class="nav-group nav-group--account" id="nav-group-account" data-nav-group="account" data-nav-index="6" data-default-open="0">
    <button type="button" class="nav-group-toggle" aria-expanded="false" data-nav-group-toggle="account">
      <span class="nav-group-heading">
        <span class="nav-group-title">Account</span>
      </span>
      <span class="nav-group-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="nav-group-body">
      <button type="button" class="sidebar-nav-btn sidebar-dark-toggle" id="darkModeToggle" aria-label="Toggle dark mode"><span class="nav-ico" aria-hidden="true">🌙</span><span class="nav-text">Dark Mode</span></button>
      <a href="#" class="logout-link" id="logoutLink" aria-label="Logout"><span class="nav-ico" aria-hidden="true">🚪</span><span class="nav-text">Logout</span></a>
    </div>
  </div>
  `;

  function getSidebarShellHtml() {
    return `<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><span class="toggle-btn__icon" aria-hidden="true">☰</span><span class="toggle-btn__label">Menu</span></button>
<div class="sidebar" id="sidebar" data-nav-version="${ADMIN_NAV_VERSION}">
  <div class="sidebar-top">
    ${SIDEBAR_TOP_HTML.trim()}
  </div>
  <div class="sidebar-main">
    ${SIDEBAR_RAIL_HTML.trim()}
    <nav class="sidebar-nav" aria-label="Admin navigation">
      ${NAV_BODY_HTML.trim()}
    </nav>
  </div>
</div>`;
  }

  function hydrateSidebarNav() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return false;

    const panel = document.getElementById("sidebarGeneratorDrafts");
    const needsDraftsPanel = !panel;
    const needsAccordionUpgrade = !!(panel && !panel.querySelector("[data-draft-toggle]"));
    const needsGroupUpgrade = !sidebar.querySelector(".nav-group[data-nav-group]");
    const needsRailUpgrade = !sidebar.querySelector(".sidebar-rail");
    if (
      sidebar.dataset.navVersion === ADMIN_NAV_VERSION &&
      !needsDraftsPanel &&
      !needsAccordionUpgrade &&
      !needsGroupUpgrade &&
      !needsRailUpgrade
    ) {
      document.dispatchEvent(new CustomEvent("adminNavHydrated"));
      return true;
    }

    const top = sidebar.querySelector(".sidebar-top");
    if (top) {
      top.innerHTML = SIDEBAR_TOP_HTML.trim();
    }

    let mainHost = sidebar.querySelector(".sidebar-main");
    if (!mainHost) {
      mainHost = document.createElement("div");
      mainHost.className = "sidebar-main";
      const afterTop = sidebar.querySelector(".sidebar-top");
      if (afterTop && afterTop.nextSibling) {
        sidebar.insertBefore(mainHost, afterTop.nextSibling);
      } else {
        sidebar.appendChild(mainHost);
      }
    }

    let railHost = mainHost.querySelector(".sidebar-rail");
    if (!railHost) {
      railHost = document.createElement("div");
      railHost.className = "sidebar-rail";
      mainHost.insertBefore(railHost, mainHost.firstChild);
    }
    railHost.outerHTML = SIDEBAR_RAIL_HTML.trim();
    railHost = mainHost.querySelector(".sidebar-rail");

    let navHost = mainHost.querySelector(".sidebar-nav") || sidebar.querySelector(".sidebar-nav");
    if (!navHost) {
      navHost = document.createElement("nav");
      navHost.className = "sidebar-nav";
      navHost.setAttribute("aria-label", "Admin navigation");
      mainHost.appendChild(navHost);
    } else if (navHost.parentElement !== mainHost) {
      mainHost.appendChild(navHost);
    }

    navHost.innerHTML = NAV_BODY_HTML.trim();

    Array.from(sidebar.children).forEach((child) => {
      if (child === top || child === mainHost || child.id === "sidebarToggle") return;
      if (
        child.matches &&
        (child.matches("a") ||
          child.matches("button") ||
          child.matches(".nav-group") ||
          child.matches(".nav-group-title") ||
          child.matches(".sidebar-footer") ||
          child.matches(".sidebar-nav") ||
          child.matches(".sidebar-rail") ||
          child.matches(".sidebar-drafts"))
      ) {
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
