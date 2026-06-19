(function () {
  const dashboardMobileMq = window.matchMedia("(max-width: 768px)");

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

  async function adminSafeFetch(url, options = {}) {
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
      if (!res.ok) {
        lastFetchFailure = { url, status: res.status, retry: null };
        showGlobalErrorBanner({ status: res.status, url });
        return null;
      }
      hideGlobalErrorBanner();
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
  }

  function applySidebarStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (localStorage.getItem("dashboardSidebarCollapsed") === "1") {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    }
    syncSidebarCollapseButton();
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
  }

  async function logout() {
    await adminSafeFetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  /** Re-bind sidebar controls after admin-layout injects sidebar on standalone pages. */
  function bindShellEvents() {
    if (window.AdminNav && typeof window.AdminNav.hydrate === "function") {
      window.AdminNav.hydrate();
    }
    const toggle = document.getElementById("sidebarToggle");
    if (toggle && toggle.dataset.shellBound !== "1") {
      toggle.dataset.shellBound = "1";
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
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
  }

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }

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
  });

  document.getElementById("sidebar")?.addEventListener("click", (e) => {
    if (!isMobileSidebarMode()) return;
    const link = e.target.closest("a[href]");
    if (!link) return;
    setSidebarOpen(false);
  });

  applySidebarStateFromStorage();
  bindShellEvents();

  window.adminSafeFetch = adminSafeFetch;
  window.AdminShellRebind = bindShellEvents;
  window.showGlobalErrorBanner = showGlobalErrorBanner;
  window.hideGlobalErrorBanner = hideGlobalErrorBanner;
})();
