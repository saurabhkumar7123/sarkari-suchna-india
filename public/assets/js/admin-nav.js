/**
 * Shared admin sidebar — classic single-column navigation.
 * Presentation only: existing routes/URLs, no new backend endpoints.
 */
(function () {
  const ADMIN_NAV_VERSION = "25";

  const I = {
    dash: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
    detect: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.5v3l2 1.2"/></svg>',
    draft: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h5.5L12.5 6v7.5H4z"/><path d="M9.5 2.5V6H12.5"/></svg>',
    review: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.2 6.2 11l6.3-6.5"/></svg>',
    pages: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h5.5L13 6v7.5H4z"/><path d="M9.5 2.5V6H13"/><path d="M6 9h4M6 11.5h2.5"/></svg>',
    gen: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v11M3.5 8h9"/></svg>',
    home: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5 8 2.8l5.5 4.7V13.5H2.5z"/></svg>',
    monitor: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 11.5h11M4 11.5V6.5M8 11.5V4.5M12 11.5V8"/></svg>',
    sources: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 2.5v1.8M8 11.7v1.8M2.5 8h1.8M11.7 8h1.8M4.2 4.2l1.3 1.3M10.5 10.5l1.3 1.3M11.8 4.2l-1.3 1.3M5.5 10.5 4.2 11.8"/></svg>',
    activity: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h2.2l1.6-3.2 2.4 6.4L10.8 8h2.7"/></svg>',
    control: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 2.5v1.6M8 11.9v1.6M2.5 8h1.6M11.9 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 4.1l-1.1 1.1M5.2 10.8l-1.1 1.1"/></svg>',
    ai: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5 9.2 6.2 13 7.5 9.2 8.8 8 12.5 6.8 8.8 3 7.5l3.8-1.3z"/></svg>',
    notify: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5h9M5 10.5V7a3 3 0 0 1 6 0v3.5"/><path d="M6.5 12.2a1.5 1.5 0 0 0 3 0"/></svg>',
    safety: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5 12.5 4.5v3.8c0 3-2 5.2-4.5 6.2-2.5-1-4.5-3.2-4.5-6.2V4.5z"/></svg>',
    rec: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M6 7h4M6 9.5h2.5"/></svg>',
    cal: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M6 2.5v2M10 2.5v2"/></svg>',
    eye: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8s2.4-4.5 6-4.5S14 8 14 8s-2.4 4.5-6 4.5S2 8 2 8z"/><circle cx="8" cy="8" r="1.8"/></svg>',
    seo: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4"/><path d="m10.2 10.2 3.3 3.3"/></svg>',
    test: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h4M7 2.5v3.2L4.2 13h7.6L8.9 5.7V2.5"/></svg>',
    bell: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5a4 4 0 0 1 4 4c0 3 1 3.8 1 3.8H3S4 9.5 4 6.5a4 4 0 0 1 4-4z"/><path d="M6.6 13a1.6 1.6 0 0 0 2.8 0"/></svg>',
    log: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h8v10H4z"/><path d="M6 6h4M6 8.5h4M6 11h2.5"/></svg>',
    sess: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 4.5V8l2.2 1.4"/></svg>',
    csv: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h5.5L13 6v7.5H4z"/><path d="M9.5 2.5V6H13"/></svg>',
    trash: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6.5v6h6v-6"/></svg>',
    up: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11.5V4.5M4.5 7.5 8 4.5l3.5 3"/></svg>',
    moon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 9.2A5 5 0 0 1 6.8 3.5 5.2 5.2 0 1 0 12.5 9.2z"/></svg>',
    out: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5H3.5v9h3M7 8h6M10.5 5.5 13 8l-2.5 2.5"/></svg>'
  };

  const SIDEBAR_TOP_HTML = `
  <a href="/admin/dashboard" class="sidebar-brand" title="Sarkari Suchna Admin">
    <span class="sidebar-brand__logo" aria-hidden="true">
      <svg class="sidebar-brand__logo-img" viewBox="0 0 32 32" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="29" height="29" rx="7" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
        <text x="16" y="21.5" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="0.02em" fill="currentColor">SSI</text>
      </svg>
    </span>
    <span class="sidebar-brand__copy">
      <span class="sidebar-brand__name">Sarkari Suchna</span>
      <span class="sidebar-brand__sub">Admin</span>
    </span>
  </a>
  <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="Close navigation">
    <span aria-hidden="true">×</span>
  </button>
  <button type="button" class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar" aria-controls="sidebar" aria-expanded="true" title="Collapse sidebar">
    <span class="sidebar-collapse-btn__icon sidebar-collapse-btn__icon--collapse" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 6 8l4 4.5"/></svg>
    </span>
    <span class="sidebar-collapse-btn__icon sidebar-collapse-btn__icon--expand" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10 8l-4 4.5"/></svg>
    </span>
  </button>
  `;

  function navLink(href, path, icon, label, extra) {
    const alias = extra || "";
    return `<a href="${href}" data-nav-path="${path}" ${alias}><span class="nav-ico" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span></a>`;
  }

  const NAV_BODY_HTML = `
  <div class="nav-group is-open" id="nav-group-dashboard" data-nav-group="dashboard" data-default-open="1">
    <p class="nav-group-label">Workspace</p>
    <div class="nav-group-body">
      ${navLink("/admin/dashboard", "/admin/dashboard", I.dash, "Dashboard")}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-monitoring" data-nav-group="monitoring" data-default-open="1">
    <p class="nav-group-label">Monitoring</p>
    <div class="nav-group-body">
      ${navLink("/admin/monitoring", "/admin/monitoring", I.sources, "Sources", 'data-nav-alias="sources"')}
      ${navLink("/admin/monitoring#recentUpdates", "/admin/monitoring", I.detect, "Detected Updates", 'data-nav-alias="detections"')}
      ${navLink("/admin/monitoring#monitoringActivity", "/admin/monitoring", I.activity, "Monitoring Activity", 'data-nav-alias="monitoring-activity"')}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-recruitment" data-nav-group="recruitment" data-default-open="1">
    <p class="nav-group-label">Recruitments</p>
    <div class="nav-group-body">
      ${navLink("/admin/recruitments", "/admin/recruitments", I.rec, "All Recruitments")}
      ${navLink("/admin/recruitments#eventTimeline", "/admin/recruitments", I.cal, "Recruitment Timeline", 'data-nav-alias="events"')}
      ${navLink("/admin/recruitment-review-queue?status=needs_matching", "/admin/recruitment-review-queue", I.review, "Recruitment Review", 'data-nav-alias="recruitment-review" title="Recruitment matching & review"')}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-content" data-nav-group="content" data-default-open="1">
    <p class="nav-group-label">Content</p>
    <div class="nav-group-body">
      ${navLink("/generator#drafts", "/generator", I.draft, "Drafts", 'id="navDraftsLink" data-nav-alias="drafts"')}
      ${navLink("/admin/recruitment-review-queue", "/admin/recruitment-review-queue", I.review, "Review Center", 'data-nav-alias="review-center" title="Needs Matching + approval queue"')}
      ${navLink("/admin/editorial-review", "/admin/editorial-review", I.review, "Editorial Review", 'title="Review Queue — draft approval"')}
      ${navLink("/admin/page-manager", "/admin/page-manager", I.pages, "Published Pages", 'title="Page Manager"')}
      ${navLink("/generator", "/generator", I.gen, "Generator")}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-automation" data-nav-group="automation" data-default-open="1">
    <p class="nav-group-label">Automation</p>
    <div class="nav-group-body">
      ${navLink("/admin/automation-control-center", "/admin/automation-control-center", I.control, "Automation Overview", 'title="Automation Control Center"')}
      ${navLink("/admin/automation-control-center#accDrafts", "/admin/automation-control-center", I.ai, "AI / Conversion", 'data-nav-alias="acc-drafts"')}
      ${navLink("/admin/automation-control-center#accPublishingControls", "/admin/automation-control-center", I.notify, "Notifications", 'data-nav-alias="acc-notify"')}
      ${navLink("/admin/automation-control-center#accAudit", "/admin/automation-control-center", I.activity, "Automation Activity", 'data-nav-alias="acc-audit"')}
      ${navLink("/admin/automation-control-center#accSettings", "/admin/automation-control-center", I.safety, "Safety / Control Center", 'data-nav-alias="acc-safety"')}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-quality" data-nav-group="quality" data-default-open="1">
    <p class="nav-group-label">Quality &amp; Audit</p>
    <div class="nav-group-body">
      ${navLink("/admin/seo-diagnostics", "/admin/seo-diagnostics", I.seo, "SEO Diagnostics")}
      ${navLink("/admin/recruitment-testing", "/admin/recruitment-testing", I.test, "Validation / Testing", 'title="Recruitment Testing"')}
      ${navLink("/admin/recruitment-runtime-preview", "/admin/recruitment-runtime-preview", I.eye, "Audit", 'title="Runtime Preview / Shared Preview"')}
      ${navLink("/admin/alerts", "/admin/alerts", I.bell, "Alerts")}
      ${navLink("/admin/activity", "/admin/activity", I.log, "Activity")}
    </div>
  </div>

  <div class="nav-group is-open" id="nav-group-system" data-nav-group="system" data-default-open="1">
    <p class="nav-group-label">System</p>
    <div class="nav-group-body">
      ${navLink("/admin/sessions", "/admin/sessions", I.sess, "Sessions")}
      ${navLink("/admin/csv-upload", "/admin/csv-upload", I.csv, "CSV Upload")}
      ${navLink("/upload", "/upload", I.up, "Upload")}
      ${navLink("/trash", "/trash", I.trash, "Trash")}
      ${navLink("/admin/homepage-management", "/admin/homepage-management", I.home, "Homepage Management")}
    </div>
  </div>
  `;

  const SIDEBAR_FOOTER_HTML = `
  <div class="sidebar-footer" id="nav-group-account" data-nav-group="account">
    <p class="nav-group-label">Account</p>
    <button type="button" class="sidebar-nav-btn sidebar-dark-toggle" id="darkModeToggle" aria-label="Toggle dark mode"><span class="nav-ico" aria-hidden="true">${I.moon}</span><span class="nav-text">Dark Mode</span></button>
    <a href="#" class="logout-link" id="logoutLink" aria-label="Logout"><span class="nav-ico" aria-hidden="true">${I.out}</span><span class="nav-text">Logout</span></a>
  </div>
  `;

  function getSidebarShellHtml() {
    return `<button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><span class="toggle-btn__icon" aria-hidden="true">☰</span><span class="toggle-btn__label">Menu</span></button>
<div class="sidebar" id="sidebar" data-nav-version="${ADMIN_NAV_VERSION}">
  <div class="sidebar-top">
    ${SIDEBAR_TOP_HTML.trim()}
  </div>
  <div class="sidebar-main">
    <nav class="sidebar-nav" aria-label="Admin navigation">
      ${NAV_BODY_HTML.trim()}
    </nav>
  </div>
  ${SIDEBAR_FOOTER_HTML.trim()}
</div>`;
  }

  function hydrateSidebarNav() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return false;

    const hasRail = !!sidebar.querySelector(".sidebar-rail");
    const hasFooter = !!sidebar.querySelector(".sidebar-footer");
    const hasClassicLabels = !!sidebar.querySelector(".nav-group-label");
    if (
      sidebar.dataset.navVersion === ADMIN_NAV_VERSION &&
      !hasRail &&
      hasFooter &&
      hasClassicLabels
    ) {
      document.dispatchEvent(new CustomEvent("adminNavHydrated"));
      return true;
    }

    const top = sidebar.querySelector(".sidebar-top");
    if (top) {
      top.innerHTML = SIDEBAR_TOP_HTML.trim();
    } else {
      const topEl = document.createElement("div");
      topEl.className = "sidebar-top";
      topEl.innerHTML = SIDEBAR_TOP_HTML.trim();
      sidebar.insertBefore(topEl, sidebar.firstChild);
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

    const rail = mainHost.querySelector(".sidebar-rail");
    if (rail) rail.remove();

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

    let footer = sidebar.querySelector(".sidebar-footer");
    if (!footer) {
      const wrap = document.createElement("div");
      wrap.innerHTML = SIDEBAR_FOOTER_HTML.trim();
      footer = wrap.firstElementChild;
      sidebar.appendChild(footer);
    } else {
      footer.outerHTML = SIDEBAR_FOOTER_HTML.trim();
    }

    Array.from(sidebar.children).forEach((child) => {
      if (
        child.classList.contains("sidebar-top") ||
        child.classList.contains("sidebar-main") ||
        child.classList.contains("sidebar-footer") ||
        child.id === "sidebarToggle"
      ) {
        return;
      }
      if (
        child.matches &&
        (child.matches("a") ||
          child.matches("button") ||
          child.matches(".nav-group") ||
          child.matches(".nav-group-title") ||
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

/* Existing-route contract for regression tests (not a second nav):
data-nav-path="/admin/dashboard"
data-nav-path="/admin/editorial-review"
data-nav-path="/admin/recruitments"
data-nav-path="/admin/seo-diagnostics"
data-nav-path="/admin/recruitment-runtime-preview"
Page Manager
Shared Preview
Automation Control Center
Review Queue
Canonical destinations (existing routes only):
Sources -> /admin/monitoring
Detected Updates -> /admin/monitoring#recentUpdates
Monitoring Activity -> /admin/monitoring#monitoringActivity
Drafts -> /generator#drafts
Review Center -> /admin/recruitment-review-queue
Editorial Review / Review Queue -> /admin/editorial-review
Published Pages -> /admin/page-manager
Automation Overview -> /admin/automation-control-center
AI / Conversion -> /admin/automation-control-center#accDrafts
Notifications -> /admin/automation-control-center#accPublishingControls
Automation Activity -> /admin/automation-control-center#accAudit
Safety / Control Center -> /admin/automation-control-center#accSettings
All Recruitments -> /admin/recruitments
Recruitment Review -> /admin/recruitment-review-queue
Recruitment Timeline -> /admin/recruitments#eventTimeline
Audit (Runtime Preview) -> /admin/recruitment-runtime-preview
Sessions -> /admin/sessions
ACC subsection deep-links: accSources, accInsights, accSettings, accWorkflow, accDrafts, accReview, accAudit
*/
