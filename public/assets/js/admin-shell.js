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
    const collapsed = sidebar.classList.contains("collapsed");
    sidebar.querySelectorAll("a[href], .sidebar-nav-btn").forEach((el) => {
      const label = el.querySelector(".nav-text")?.textContent?.trim();
      if (collapsed && label) {
        el.setAttribute("title", label);
      } else {
        el.removeAttribute("title");
      }
    });
  }

  function syncSidebarCollapseButton() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("sidebarCollapseBtn");
    if (!sidebar || !btn) return;
    const collapsed = sidebar.classList.contains("collapsed");
    btn.textContent = collapsed ? "☰" : "⟨⟩";
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }

  function toggleSidebarCollapsed() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed", sidebar.classList.contains("collapsed"));
    localStorage.setItem("dashboardSidebarCollapsed", sidebar.classList.contains("collapsed") ? "1" : "0");
    syncSidebarCollapseButton();
    syncCollapsedNavTooltips();
  }

  function applySidebarStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (localStorage.getItem("dashboardSidebarCollapsed") === "1") {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    }
    syncSidebarCollapseButton();
    syncCollapsedNavTooltips();
  }

  function normalizeNavPath(value) {
    return String(value || "").toLowerCase().replace(/\/$/, "") || "/";
  }

  function isNavLinkActive(href, path) {
    const h = normalizeNavPath(href);
    const p = normalizeNavPath(path);
    if (!h || h === "#") return false;
    if (h === p) return true;
    if (h === "/admin/dashboard" && p === "/dashboard") return true;
    if (h === "/admin/alerts" && p === "/notification") return true;
    return false;
  }

  function markActiveSidebarLink() {
    const links = Array.from(document.querySelectorAll("#sidebar a[href]"));
    const path = window.location.pathname;
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      a.classList.toggle("active", isNavLinkActive(href, path));
      if (isNavLinkActive(href, path)) {
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
    markActiveSidebarLink();
    syncCollapsedNavTooltips();
    syncDarkModeToggleButton();
    syncMobileToggleButton();
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

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const cmd = document.getElementById("adminCmdOverlay");
    if (cmd && cmd.classList.contains("is-open")) return;
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    setSidebarOpen(false);
  });

  dashboardMobileMq.addEventListener("change", () => {
    if (!isMobileSidebarMode()) setSidebarOpen(false);
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
})();
