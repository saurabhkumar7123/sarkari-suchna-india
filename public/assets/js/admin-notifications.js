/**
 * Notification bell — polls existing admin APIs (no contract changes).
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const POLL_MS = 60000;
  let pollTimer = null;
  let lastUnread = 0;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchAlerts() {
    const items = [];
    const [queueRes, sitesRes, activityRes] = await Promise.all([
      window.adminSafeFetch("/api/admin/queue/status"),
      window.adminSafeFetch("/api/admin/sites"),
      window.adminSafeFetch("/api/admin/activity?limit=5&page=1")
    ]);

    const failed = Number(
      queueRes && queueRes.success && queueRes.data && queueRes.data.failed != null ? queueRes.data.failed : 0
    );
    if (failed > 0) {
      items.push({
        type: "queue",
        text: `${failed} failed queue job(s)`,
        href: "/admin/monitoring"
      });
    }

    const sites = sitesRes && sitesRes.success && Array.isArray(sitesRes.data) ? sitesRes.data : [];
    const broken = sites.filter((s) => Number(s && s.broken) === 1).length;
    if (broken > 0) {
      items.push({
        type: "site",
        text: `${broken} broken monitored site(s)`,
        href: "/admin/monitoring"
      });
    }

    const acts = activityRes && activityRes.success && Array.isArray(activityRes.data) ? activityRes.data : [];
    acts.slice(0, 3).forEach((a) => {
      items.push({
        type: "activity",
        text: `${a.admin || "admin"}: ${a.action || "action"}`,
        href: "/admin/activity"
      });
    });

    return items;
  }

  function renderPanel(panel, items) {
    if (!items.length) {
      panel.innerHTML = '<p class="admin-notify-empty">No alerts right now.</p>';
      return;
    }
    panel.innerHTML = items
      .map(
        (it) =>
          `<div class="admin-notify-item"><a href="${esc(it.href)}">${esc(it.text)}</a></div>`
      )
      .join("");
  }

  function updateBadge(badge, count) {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.classList.add("is-visible");
    } else {
      badge.textContent = "";
      badge.classList.remove("is-visible");
    }
  }

  function mount(host) {
    if (!host || host.querySelector(".admin-notify-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "admin-notify-wrap";
    wrap.innerHTML = `
      <button type="button" class="admin-notify-btn" id="adminNotifyBtn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">🔔
        <span class="admin-notify-badge" id="adminNotifyBadge"></span>
      </button>
      <div class="admin-notify-panel" id="adminNotifyPanel" role="region" aria-label="Notifications"></div>
    `;
    host.appendChild(wrap);

    const btn = wrap.querySelector("#adminNotifyBtn");
    const panel = wrap.querySelector("#adminNotifyPanel");
    const badge = wrap.querySelector("#adminNotifyBadge");

    async function refresh() {
      const items = await fetchAlerts();
      const count = items.filter((i) => i.type === "queue" || i.type === "site").length;
      lastUnread = count;
      updateBadge(badge, count);
      if (panel.classList.contains("is-open")) renderPanel(panel, items);
    }

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        panel.innerHTML = '<p class="admin-notify-empty">Loading…</p>';
        const items = await fetchAlerts();
        renderPanel(panel, items);
        updateBadge(badge, 0);
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    refresh();
    pollTimer = window.setInterval(refresh, POLL_MS);

    window.AdminNotifications = window.AdminNotifications || {};
    window.AdminNotifications.refresh = refresh;
    window.AdminNotifications.getUnreadCount = () => lastUnread;
  }

  window.AdminNotifications = { mount, stop: () => clearInterval(pollTimer) };

  window.addEventListener("pagehide", () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  });

  const toolsHost = document.getElementById("adminTopbarTools");
  if (toolsHost) mount(toolsHost);
})();
