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
    const isOpen = Boolean(open);
    sidebar.classList.toggle("active", isOpen);
    document.body.classList.toggle("dashboard-sidebar-open", isOpen && isMobileSidebarMode());
    if (isMobileSidebarMode()) {
      const backdrop = ensureSidebarBackdrop();
      backdrop.classList.toggle("active", isOpen);
    } else if (sidebarBackdropEl) {
      sidebarBackdropEl.classList.remove("active");
      document.body.classList.remove("dashboard-sidebar-open");
    }
    syncMobileToggleButton();
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
    const openGroup = sidebar.querySelector(".nav-group:not(.is-collapsed)[data-nav-group]");
    const openKey = (openGroup && openGroup.getAttribute("data-nav-group")) || "";
    const activeLink = sidebar.querySelector("a.active");
    const activeLinkKey =
      (activeLink && activeLink.closest(".nav-group") && activeLink.closest(".nav-group").getAttribute("data-nav-group")) ||
      "";
    const railKey = openKey || activeLinkKey;
    sidebar.querySelectorAll(".sidebar-rail__item[data-rail-group]").forEach((btn) => {
      const key = btn.getAttribute("data-rail-group");
      const isActive = Boolean(key && key === railKey);
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    sidebar.querySelectorAll(".nav-group[data-nav-group]").forEach((group) => {
      const key = group.getAttribute("data-nav-group");
      group.classList.toggle("is-open", Boolean(key && key === openKey));
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

  function setNavGroupOpen(group, open, options) {
    if (!group) return;
    const isOpen = Boolean(open);
    const exclusive = !options || options.exclusive !== false;
    const persist = !options || options.persist !== false;
    const sidebar = group.closest("#sidebar") || document.getElementById("sidebar");

    if (isOpen && exclusive && sidebar) {
      sidebar.querySelectorAll(".nav-group[data-nav-group]").forEach((other) => {
        if (other === group) return;
        other.classList.add("is-collapsed");
        other.classList.remove("is-open");
        const otherToggle = other.querySelector("[data-nav-group-toggle]");
        if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
      });
    }

    group.classList.toggle("is-collapsed", !isOpen);
    group.classList.toggle("is-open", isOpen);
    const toggle = group.querySelector("[data-nav-group-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    const key = group.getAttribute("data-nav-group");
    if (key && persist) {
      try {
        if (isOpen) {
          localStorage.setItem("adminNavOpenGroup", key);
        } else {
          const current = localStorage.getItem("adminNavOpenGroup");
          if (current === key) localStorage.removeItem("adminNavOpenGroup");
        }
        localStorage.setItem("adminNavGroup:" + key, isOpen ? "1" : "0");
      } catch (_) {
        /* ignore */
      }
    }
    syncRailActiveState();
  }

  function applyNavGroupStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    let preferred = null;
    try {
      preferred = localStorage.getItem("adminNavOpenGroup");
    } catch (_) {
      preferred = null;
    }
    const groups = Array.from(sidebar.querySelectorAll(".nav-group[data-nav-group]"));
    let openKey = preferred;
    if (!openKey || !groups.some((g) => g.getAttribute("data-nav-group") === openKey)) {
      const defaultGroup = groups.find((g) => g.getAttribute("data-default-open") === "1");
      openKey = defaultGroup ? defaultGroup.getAttribute("data-nav-group") : "dashboard";
    }
    groups.forEach((group) => {
      const key = group.getAttribute("data-nav-group");
      setNavGroupOpen(group, key === openKey, { exclusive: false, persist: false });
    });
    try {
      if (openKey) localStorage.setItem("adminNavOpenGroup", openKey);
    } catch (_) {
      /* ignore */
    }
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
    sidebar.addEventListener("click", (e) => {
      const railBtn = e.target.closest(".sidebar-rail__item[data-rail-group]");
      if (railBtn && sidebar.contains(railBtn)) {
        e.preventDefault();
        const key = railBtn.getAttribute("data-rail-group");
        const group = sidebar.querySelector('.nav-group[data-nav-group="' + key + '"]');
        if (!group) return;
        expandSidebarFromRailIfNeeded();
        setNavGroupOpen(group, true);
        return;
      }
      const toggle = e.target.closest("[data-nav-group-toggle]");
      if (!toggle || !sidebar.contains(toggle)) return;
      e.preventDefault();
      const group = toggle.closest(".nav-group");
      if (!group) return;
      const isOpen = toggle.getAttribute("aria-expanded") !== "false";
      if (isOpen) {
        setNavGroupOpen(group, false);
      } else {
        setNavGroupOpen(group, true);
      }
    });
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
    if (linkEl.classList.contains("sidebar-view-site") || href === "/") return false;
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
    const btn = document.getElementById("darkModeToggle");
    if (!btn) return;
    const isDark = document.body.classList.contains("dark");
    const ico = btn.querySelector(".nav-ico");
    const label = btn.querySelector(".nav-text");
    if (ico) ico.textContent = isDark ? "☀️" : "🌙";
    if (label) label.textContent = isDark ? "Light Mode" : "Dark Mode";
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
    const header = document.querySelector(".admin-header");
    if (!header) return;
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
    if (header.parentElement !== bar) {
      bar.appendChild(header);
    }
    document.body.classList.add("admin-has-topbar");
  }

  function bindRailKeyboard() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || sidebar.dataset.railKeysBound === "1") return;
    sidebar.dataset.railKeysBound = "1";
    sidebar.addEventListener("keydown", (e) => {
      const items = Array.from(sidebar.querySelectorAll(".sidebar-rail__item[data-rail-group]"));
      const current = document.activeElement;
      const index = items.indexOf(current);
      if (index < 0) return;
      let next = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % items.length;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      if (next < 0) return;
      e.preventDefault();
      items[next].focus();
      items[next].click();
    });
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
    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink && logoutLink.dataset.shellBound !== "1") {
      logoutLink.dataset.shellBound = "1";
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    }
    hoistAdminTopbar();
    markActiveSidebarLink();
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
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const cmd = document.getElementById("adminCmdOverlay");
    if (cmd && cmd.classList.contains("is-open")) return;
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    setSidebarOpen(false);
    const toggle = document.getElementById("sidebarToggle");
    if (toggle) toggle.focus();
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
