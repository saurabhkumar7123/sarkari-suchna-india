(function () {
  const dashboardMobileMq = window.matchMedia("(max-width: 768px)");
  let sidebarBackdropEl = null;

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
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
      return await res.text();
    } catch (err) {
      console.error("fetch failed", url, err);
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

  function toggleSidebarCollapsed() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed", sidebar.classList.contains("collapsed"));
    localStorage.setItem("dashboardSidebarCollapsed", sidebar.classList.contains("collapsed") ? "1" : "0");
  }

  function applySidebarStateFromStorage() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (localStorage.getItem("dashboardSidebarCollapsed") === "1") {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    }
  }

  function markActiveSidebarLink() {
    const links = Array.from(document.querySelectorAll("#sidebar a"));
    const path = window.location.pathname.toLowerCase();
    links.forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href && href !== "#" && href === path) a.classList.add("active");
      else a.classList.remove("active");
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

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }

  document.getElementById("sidebarToggle")?.addEventListener("click", (e) => {
    e.preventDefault();
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    setSidebarOpen(!sidebar.classList.contains("active"));
  });
  document.getElementById("sidebarCollapseBtn")?.addEventListener("click", () => toggleSidebarCollapsed());
  document.getElementById("darkModeToggle")?.addEventListener("click", () => toggleDarkMode());
  document.getElementById("logoutLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

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
  markActiveSidebarLink();

  window.adminSafeFetch = adminSafeFetch;
})();
