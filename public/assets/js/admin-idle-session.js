/**
 * Admin idle session — warn at 45 min, logout at 60 min; refresh token on activity.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;
  if (document.body.classList.contains("login-page")) return;

  const WARN_MS = 45 * 60 * 1000;
  const LOGOUT_MS = 60 * 60 * 1000;
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

  let lastActivity = Date.now();
  let warnShown = false;
  let modalEl = null;
  let lastRefreshAt = 0;

  function touchActivity() {
    lastActivity = Date.now();
    if (warnShown) hideWarnModal();
    maybeRefreshSession();
  }

  async function maybeRefreshSession() {
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_INTERVAL_MS) return;
    if (typeof window.getAdminCsrfToken !== "function") return;
    lastRefreshAt = now;
    try {
      const token = await window.getAdminCsrfToken();
      await fetch("/api/admin/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": token }
      });
    } catch {
      /* non-blocking */
    }
  }

  function ensureWarnModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.id = "adminIdleWarnModal";
    modalEl.className = "admin-idle-modal";
    modalEl.setAttribute("role", "alertdialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-labelledby", "adminIdleWarnTitle");
    modalEl.innerHTML = `
      <div class="admin-idle-modal__card">
        <h3 id="adminIdleWarnTitle">Session expiring soon</h3>
        <p>You have been idle for a while. For security, you will be signed out in 15 minutes unless you continue.</p>
        <div class="admin-idle-modal__actions">
          <button type="button" class="header-action-btn" id="adminIdleStayBtn">Stay signed in</button>
          <button type="button" class="header-action-btn" id="adminIdleLogoutBtn">Sign out now</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.querySelector("#adminIdleStayBtn")?.addEventListener("click", () => {
      touchActivity();
      hideWarnModal();
    });
    modalEl.querySelector("#adminIdleLogoutBtn")?.addEventListener("click", () => {
      window.location.href = "/login";
    });
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) touchActivity();
    });
    return modalEl;
  }

  function showWarnModal() {
    warnShown = true;
    ensureWarnModal().classList.add("is-open");
  }

  function hideWarnModal() {
    warnShown = false;
    modalEl?.classList.remove("is-open");
  }

  async function forceLogout() {
    if (typeof window.adminSafeFetch === "function") {
      await window.adminSafeFetch("/api/admin/logout", { method: "POST" });
    }
    window.location.href = "/login?reason=idle";
  }

  function tickIdle() {
    const idle = Date.now() - lastActivity;
    if (idle >= LOGOUT_MS) {
      forceLogout();
      return;
    }
    if (idle >= WARN_MS && !warnShown) showWarnModal();
  }

  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => {
    document.addEventListener(ev, touchActivity, { passive: true });
  });

  window.AdminIdleSession = { touch: touchActivity };
  setInterval(tickIdle, 30000);
})();
