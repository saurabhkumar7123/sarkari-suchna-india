(function () {
  const dashboardMobileMq = window.matchMedia("(max-width: 768px)");

  if (document.body) {
    document.body.classList.add("admin-saas-v2");
  }

  /** Feature flag: set localStorage.adminEnhancementsOff=1 to disable new UX modules. */
  window.AdminEnhancements = {
    isEnabled() {
      return window.__ADMIN_ENHANCEMENTS_ENABLED !== false && localStorage.getItem("adminEnhancementsOff") !== "1";
    }
  };

  let sidebarBackdropEl = null;
  let lastFetchFailure = null;
  let errorBannerEl = null;

  function ensureErrorBanner() {
    if (errorBannerEl && document.body.contains(errorBannerEl)) return errorBannerEl;
    const main =
      document.getElementById("standaloneAdminShell") ||
      document.querySelector(".main") ||
      document.querySelector(".main-container") ||
      document.body;
    errorBannerEl = document.createElement("div");
    errorBannerEl.id = "adminGlobalErrorBanner";
    errorBannerEl.className = "admin-global-error-banner";
    errorBannerEl.setAttribute("role", "alert");
    errorBannerEl.innerHTML = `
      <span class="admin-global-error-banner__msg" id="adminGlobalErrorMsg"></span>
      <div class="admin-global-error-banner__actions">
        <button type="button" id="adminGlobalErrorRetry">Retry</button>
        <button type="button" id="adminGlobalErrorDismiss">Dismiss</button>
      </div>
    `;
    main.insertBefore(errorBannerEl, main.firstChild);
    document.getElementById("adminGlobalErrorDismiss")?.addEventListener("click", hideGlobalErrorBanner);
    document.getElementById("adminGlobalErrorRetry")?.addEventListener("click", () => {
      hideGlobalErrorBanner();
      if (lastFetchFailure && typeof lastFetchFailure.retry === "function") {
        lastFetchFailure.retry();
      } else {
        window.location.reload();
      }
    });
    return errorBannerEl;
  }

  function showGlobalErrorBanner(opts) {
    if (!window.AdminEnhancements.isEnabled()) return;
    const status = opts && opts.status ? Number(opts.status) : 0;
    const url = opts && opts.url ? String(opts.url) : "";
    let msg =
      "Could not reach the server. Check your connection and try again.";
    if (status === 401 || status === 403) {
      msg = "Session may have expired. Please log in again, then retry.";
    } else if (status >= 500) {
      msg = "Server error. Try again in a moment or check logs.";
    }
    const banner = ensureErrorBanner();
    const msgEl = document.getElementById("adminGlobalErrorMsg");
    if (msgEl) msgEl.textContent = msg;
    banner.classList.add("is-visible");
    console.warn("[admin] API request failed", { status, url });
  }

  function hideGlobalErrorBanner() {
    if (errorBannerEl) errorBannerEl.classList.remove("is-visible");
  }

  async function tryRefreshSession() {
    if (typeof window.getAdminCsrfToken !== "function") return false;
    try {
      const token = await window.getAdminCsrfToken();
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": token }
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function adminSafeFetch(url, options = {}, _retried) {
    try {
      const headers = { ...(options.headers || {}) };
      if (String(url).includes("/api/admin") && typeof window.getAdminCsrfToken === "function") {
        try {
          headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
        } catch (err) {
          console.error("[CSRF]", err);
        }
      }
      if (typeof options.body === "string" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(url, {
        credentials: "include",
        ...options,
        headers
      });
      if (res.status === 401 && !_retried && String(url).includes("/api/admin")) {
        const refreshed = await tryRefreshSession();
        if (refreshed) return adminSafeFetch(url, options, true);
        window.location.href = "/login?reason=expired";
        return null;
      }
      if (!res.ok) {
        lastFetchFailure = { url, status: res.status, retry: null };
        showGlobalErrorBanner({ status: res.status, url });
        return null;
      }
      hideGlobalErrorBanner();
      window.AdminIdleSession?.touch?.();
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
      return await res.text();
    } catch (err) {
      console.error("fetch failed", url, err);
      lastFetchFailure = { url, status: 0, retry: null };
      showGlobalErrorBanner({ status: 0, url });
      return null;
    }
  }

  function isMobileSidebarMode() {
    return dashboardMobileMq.matches;
  }

  function ensureSidebarBackdrop() {
    if (sidebarBackdropEl && document.body.contains(sidebarBackdropEl)) return sidebarBackdropEl;
    const el = document.createElement("div");
    el.id = "dashboardSidebarBackdrop";
    el.className = "dashboard-sidebar-backdrop";
    el.setAttribute("aria-hidden", "true");
    el.addEventListener("click", () => setSidebarOpen(false));
    document.body.appendChild(el);
    sidebarBackdropEl = el;
    return sidebarBackdropEl;
  }

  function syncMobileToggleButton() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    if (!toggle || !sidebar) return;
    const open = sidebar.classList.contains("active");
    const mobile = isMobileSidebarMode();
    const icon = toggle.querySelector(".toggle-btn__icon");
    const label = toggle.querySelector(".toggle-btn__label");
    if (mobile) {
      if (icon) icon.textContent = open ? "✕" : "☰";
      if (label) label.textContent = open ? "Close" : "Menu";
    } else if (icon && !icon.textContent.trim()) {
      icon.textContent = "☰";
    }
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setSidebarOpen(open) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const wasOpen = sidebar.classList.contains("active");
    const isOpen = Boolean(open);
    const mobile = isMobileSidebarMode();
    sidebar.classList.toggle("active", isOpen);
    const lock = isOpen && mobile;
    document.body.classList.toggle("dashboard-sidebar-open", lock);
    document.documentElement.classList.toggle("dashboard-sidebar-open", lock);
    if (mobile) {
      sidebar.setAttribute("aria-hidden", isOpen ? "false" : "true");
      const backdrop = ensureSidebarBackdrop();
      backdrop.classList.toggle("active", isOpen);
    } else {
      sidebar.removeAttribute("aria-hidden");
      if (sidebarBackdropEl) sidebarBackdropEl.classList.remove("active");
      document.body.classList.remove("dashboard-sidebar-open");
      document.documentElement.classList.remove("dashboard-sidebar-open");
    }
    syncMobileToggleButton();
    if (!isOpen && wasOpen && mobile) {
      const toggle = document.getElementById("sidebarToggle");
      if (toggle) toggle.focus();
    }
  }

  function syncCollapsedNavTooltips() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const collapsed = sidebar.classList.contains("collapsed") && !isMobileSidebarMode();
    sidebar.querySelectorAll("a[href], .sidebar-nav-btn").forEach((el) => {
      const label = el.querySelector(".nav-text")?.textContent?.trim();
      if (collapsed && label) {
        el.setAttribute("title", label);
        el.setAttribute("aria-label", label);
      } else {
        el.removeAttribute("title");
        if (el.id !== "darkModeToggle" && el.id !== "logoutLink" && el.id !== "sidebarCollapseBtn") {
          el.removeAttribute("aria-label");
        }
      }
    });
  }

  function syncRailActiveState() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.querySelectorAll(".nav-group[data-nav-group]").forEach((group) => {
      group.classList.add("is-open");
      group.classList.remove("is-collapsed");
    });
  }

  function expandSidebarFromRailIfNeeded() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || isMobileSidebarMode()) return;
    if (!sidebar.classList.contains("collapsed")) return;
    setSidebarCollapsed(false);
  }

  function ensureActiveVisibleInCollapsed() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const active = sidebar.querySelector("a.active");
    if (!active) return;
    const group = active.closest(".nav-group");
    if (group) setNavGroupOpen(group, true);
    if (typeof active.scrollIntoView === "function") {
      try {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (_) {
        /* ignore */
      }
    }
  }

  /** Lightweight swipe-left to close mobile drawer. */
  function bindSidebarSwipeClose() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || sidebar.dataset.swipeBound === "1") return;
    sidebar.dataset.swipeBound = "1";
    let startX = 0;
    let startY = 0;
    let tracking = false;

    sidebar.addEventListener(
      "touchstart",
      (e) => {
        if (!isMobileSidebarMode() || !sidebar.classList.contains("active")) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      },
      { passive: true }
    );

    sidebar.addEventListener(
      "touchend",
      (e) => {
        if (!tracking) return;
        tracking = false;
        if (!isMobileSidebarMode() || !sidebar.classList.contains("active")) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (dx < -56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          setSidebarOpen(false);
        }
      },
      { passive: true }
    );
  }

  function setNavGroupOpen(group, open) {
    if (!group) return;
    group.classList.toggle("is-collapsed", !open);
    group.classList.toggle("is-open", Boolean(open));
  }

  function applyNavGroupStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.querySelectorAll(".nav-group[data-nav-group]").forEach((group) => {
      setNavGroupOpen(group, true);
    });
    syncRailActiveState();
  }

  function expandNavGroupForActiveLink() {
    const active = document.querySelector("#sidebar a.active");
    if (!active) return;
    const group = active.closest(".nav-group");
    if (group) setNavGroupOpen(group, true);
  }

  function bindNavGroupToggles() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (sidebar.dataset.navGroupsBound === "1") return;
    sidebar.dataset.navGroupsBound = "1";
    const closeBtn = document.getElementById("sidebarCloseBtn");
    if (closeBtn && closeBtn.dataset.shellBound !== "1") {
      closeBtn.dataset.shellBound = "1";
      closeBtn.addEventListener("click", () => setSidebarOpen(false));
    }
  }

  function syncSidebarCollapseButton() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("sidebarCollapseBtn");
    if (!sidebar || !btn) return;
    const collapsed = sidebar.classList.contains("collapsed");
    btn.classList.toggle("is-collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }

  function setSidebarCollapsed(collapsed) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (isMobileSidebarMode()) return;
    const next = Boolean(collapsed);
    sidebar.classList.toggle("collapsed", next);
    document.body.classList.toggle("sidebar-collapsed", next);
    try {
      localStorage.setItem("dashboardSidebarCollapsed", next ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    syncSidebarCollapseButton();
    syncCollapsedNavTooltips();
    if (next) ensureActiveVisibleInCollapsed();
  }

  function toggleSidebarCollapsed() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
  }

  function applySidebarStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    let stored = "0";
    try {
      stored = localStorage.getItem("dashboardSidebarCollapsed") || "0";
    } catch (_) {
      stored = "0";
    }
    if (!isMobileSidebarMode() && stored === "1") {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    } else {
      sidebar.classList.remove("collapsed");
      document.body.classList.remove("sidebar-collapsed");
    }
    syncSidebarCollapseButton();
    syncCollapsedNavTooltips();
  }

  function normalizeNavPath(value) {
    return String(value || "").toLowerCase().replace(/\/$/, "") || "/";
  }

  function currentLocationHash() {
    return String(window.location.hash || "").replace(/^#/, "");
  }

  function splitHref(href) {
    const raw = String(href || "");
    const idx = raw.indexOf("#");
    if (idx < 0) return { path: raw, hash: "" };
    return { path: raw.slice(0, idx), hash: raw.slice(idx + 1) };
  }

  function isNavLinkActive(linkEl, path) {
    const href = linkEl.getAttribute("href") || "";
    if (linkEl.classList.contains("sidebar-view-site") || linkEl.classList.contains("sidebar-account-link") || href === "/") return false;
    const parts = splitHref(href);
    const h = normalizeNavPath(parts.path);
    const p = normalizeNavPath(path);
    if (!h || h === "#") return false;
    if (h === "/admin/dashboard" && p === "/dashboard") return true;
    if (h === "/admin/alerts" && p === "/notification") return true;
    if (h !== p) return false;
    const hash = currentLocationHash();
    if (parts.hash) return hash === parts.hash;
    const sidebar = linkEl.closest("#sidebar");
    if (sidebar && hash) {
      const claimed = Array.from(sidebar.querySelectorAll("a[href*='#']")).some((other) => {
        if (other === linkEl) return false;
        const otherParts = splitHref(other.getAttribute("href") || "");
        return normalizeNavPath(otherParts.path) === p && otherParts.hash === hash;
      });
      if (claimed) return false;
    }
    return true;
  }

  function applyWorkspaceHash() {
    const hash = currentLocationHash();
    document.body.setAttribute("data-admin-hash", hash);
    document.querySelectorAll(".admin-workspace-target").forEach((el) => {
      el.classList.remove("admin-workspace-target");
    });
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.classList.add("admin-workspace-target");
    window.setTimeout(() => {
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }, 40);
  }

  function markActiveSidebarLink() {
    const links = Array.from(document.querySelectorAll("#sidebar a[href]"));
    const path = window.location.pathname;
    links.forEach((a) => {
      const active = isNavLinkActive(a, path);
      a.classList.toggle("active", active);
      if (active) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  function toggleDarkMode() {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
    syncDarkModeToggleButton();
  }

  function syncDarkModeToggleButton() {
    const isDark = document.body.classList.contains("dark");
    const btn = document.getElementById("darkModeToggle");
    if (btn) {
      const label = btn.querySelector(".nav-text");
      if (label) label.textContent = isDark ? "Light Mode" : "Dark Mode";
      btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }
    const topBtn = document.getElementById("topbarDarkModeToggle");
    if (topBtn) {
      topBtn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      topBtn.setAttribute("title", isDark ? "Light mode" : "Dark mode");
      topBtn.textContent = isDark ? "Light" : "Dark";
    }
  }

  async function logout() {
    await adminSafeFetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function upgradeMobileToggleButton() {
    const toggle = document.getElementById("sidebarToggle");
    if (!toggle || toggle.dataset.shellUpgraded === "1") return;
    toggle.dataset.shellUpgraded = "1";
    toggle.innerHTML = '<span class="toggle-btn__icon" aria-hidden="true">☰</span><span class="toggle-btn__label">Menu</span>';
    toggle.setAttribute("aria-label", "Open navigation");
  }

  function hoistAdminTopbar() {
    if (!document.getElementById("sidebar") && !document.getElementById("sidebarToggle")) return;
    let bar = document.getElementById("adminAppTopbar");
    if (!bar) {
      bar = document.createElement("header");
      bar.id = "adminAppTopbar";
      bar.className = "admin-app-topbar";
      bar.setAttribute("role", "banner");
      document.body.insertBefore(bar, document.body.firstChild);
    }
    const toggle = document.getElementById("sidebarToggle");
    if (toggle && toggle.parentElement !== bar) {
      bar.insertBefore(toggle, bar.firstChild);
    }
    let identity = document.getElementById("adminTopbarIdentity");
    if (!identity) {
      identity = document.createElement("div");
      identity.id = "adminTopbarIdentity";
    }
    if (identity.parentElement !== bar) {
      const afterToggle = toggle && toggle.parentElement === bar ? toggle.nextSibling : bar.firstChild;
      bar.insertBefore(identity, afterToggle);
    }
    document.body.classList.add("admin-has-topbar");
  }

  function bindRailKeyboard() {
    /* Classic sidebar: no numbered rail keyboard surface. */
  }

  /** Re-bind sidebar controls after admin-layout injects sidebar on standalone pages. */
  function bindShellEvents() {
    upgradeMobileToggleButton();
    if (window.AdminNav && typeof window.AdminNav.hydrate === "function") {
      window.AdminNav.hydrate();
    }
    const toggle = document.getElementById("sidebarToggle");
    if (toggle && toggle.dataset.shellBound !== "1") {
      toggle.dataset.shellBound = "1";
      toggle.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sidebar = document.getElementById("sidebar");
        if (!sidebar) return;
        setSidebarOpen(!sidebar.classList.contains("active"));
      });
    }
    const closeBtn = document.getElementById("sidebarCloseBtn");
    if (closeBtn && closeBtn.dataset.shellBound !== "1") {
      closeBtn.dataset.shellBound = "1";
      closeBtn.addEventListener("click", () => setSidebarOpen(false));
    }
    const collapse = document.getElementById("sidebarCollapseBtn");
    if (collapse && collapse.dataset.shellBound !== "1") {
      collapse.dataset.shellBound = "1";
      collapse.addEventListener("click", () => toggleSidebarCollapsed());
    }
    const dark = document.getElementById("darkModeToggle");
    if (dark && dark.dataset.shellBound !== "1") {
      dark.dataset.shellBound = "1";
      dark.addEventListener("click", () => toggleDarkMode());
    }
    const topDark = document.getElementById("topbarDarkModeToggle");
    if (topDark && topDark.dataset.shellBound !== "1") {
      topDark.dataset.shellBound = "1";
      topDark.addEventListener("click", () => toggleDarkMode());
    }
    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink && logoutLink.dataset.shellBound !== "1") {
      logoutLink.dataset.shellBound = "1";
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    }
    hoistAdminTopbar();
    if (isMobileSidebarMode()) {
      const sidebar = document.getElementById("sidebar");
      if (sidebar && !sidebar.classList.contains("active")) {
        sidebar.setAttribute("aria-hidden", "true");
      }
    }
    markActiveSidebarLink();
    applyWorkspaceHash();
    applyNavGroupStateFromStorage();
    expandNavGroupForActiveLink();
    bindNavGroupToggles();
    bindRailKeyboard();
    bindSidebarSwipeClose();
    syncSidebarCollapseButton();
    syncCollapsedNavTooltips();
    ensureActiveVisibleInCollapsed();
    syncRailActiveState();
    syncDarkModeToggleButton();
    syncMobileToggleButton();
    if (typeof window.refreshGeneratorDraftsSidebar === "function") {
      window.refreshGeneratorDraftsSidebar();
    }
    if (typeof window.AdminShellRebind === "function" && bindShellEvents._rebindPending) {
      bindShellEvents._rebindPending = false;
    }
  }

  bindShellEvents._rebindPending = false;

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }
  syncDarkModeToggleButton();

  document.addEventListener("pointerdown", (e) => {
    if (!isMobileSidebarMode()) return;
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    const target = e.target;
    if (sidebar.contains(target) || (toggle && toggle.contains(target))) return;
    setSidebarOpen(false);
  });

  window.addEventListener("hashchange", () => {
    markActiveSidebarLink();
    expandNavGroupForActiveLink();
    syncRailActiveState();
    applyWorkspaceHash();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const cmd = document.getElementById("adminCmdOverlay");
    if (cmd && cmd.classList.contains("is-open")) return;
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    setSidebarOpen(false);
  });

  dashboardMobileMq.addEventListener("change", () => {
    if (!isMobileSidebarMode()) {
      setSidebarOpen(false);
      applySidebarStateFromStorage();
    } else {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.classList.remove("collapsed");
        document.body.classList.remove("sidebar-collapsed");
      }
      syncSidebarCollapseButton();
      syncCollapsedNavTooltips();
    }
    syncMobileToggleButton();
  });

  document.addEventListener("click", (e) => {
    if (!isMobileSidebarMode()) return;
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    const link = e.target.closest("#sidebar a[href]");
    if (!link) return;
    setSidebarOpen(false);
  });

  applySidebarStateFromStorage();
  bindShellEvents();
  syncMobileToggleButton();

  window.adminSafeFetch = adminSafeFetch;
  window.AdminShellRebind = bindShellEvents;
  window.AdminHoistTopbar = hoistAdminTopbar;
  window.showGlobalErrorBanner = showGlobalErrorBanner;
  window.hideGlobalErrorBanner = hideGlobalErrorBanner;

  (function loadGeneratorDraftsSidebar() {
    if (!document.getElementById("sidebar")) return;
    if (document.getElementById("adminGeneratorDraftsScript")) return;
    const s = document.createElement("script");
    s.id = "adminGeneratorDraftsScript";
    s.src = "/js/admin-generator-drafts.js?v=4";
    s.defer = true;
    s.onload = () => {
      if (typeof window.refreshGeneratorDraftsSidebar === "function") {
        window.refreshGeneratorDraftsSidebar();
      }
    };
    document.body.appendChild(s);
  })();
})();
