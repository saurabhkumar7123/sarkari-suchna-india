/**
 * Notification bell — polls existing admin APIs (no contract changes).
 * Background polls use quiet fetch so 429/transient errors do not spam the
 * global "Could not reach the server" banner. Backs off on 429.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const POLL_MS = 60000;
  const POLL_MAX_MS = 5 * 60 * 1000;
  let pollTimer = null;
  let currentPollMs = POLL_MS;
  let lastUnread = 0;
  let inFlight = false;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function isHttpError(res) {
    return Boolean(res && res.__httpError);
  }

  function scheduleNextPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    // Use timeout chain so backoff interval can change after 429.
    pollTimer = window.setTimeout(async () => {
      await refresh();
      scheduleNextPoll();
    }, currentPollMs);
  }

  async function fetchAlerts() {
    const items = [];
    let hit429 = false;

    if (window.AdminOpsNotifications) {
      window.AdminOpsNotifications.list({ limit: 8 }).forEach((n) => {
        items.push({
          type: n.type || "ops",
          text: n.text,
          href: n.href || "/admin/dashboard",
          local: true
        });
      });
    }

    const quiet = { quiet: true };
    const [queueRes, sitesRes, activityRes] = await Promise.all([
      window.adminSafeFetch("/api/admin/queue/status", quiet),
      window.adminSafeFetch("/api/admin/sites", quiet),
      window.adminSafeFetch("/api/admin/activity?limit=5&page=1", quiet)
    ]);

    [queueRes, sitesRes, activityRes].forEach((res) => {
      if (isHttpError(res) && Number(res.status) === 429) hit429 = true;
    });

    if (hit429) {
      currentPollMs = Math.min(Math.max(currentPollMs * 2, POLL_MS * 2), POLL_MAX_MS);
      return { items, hit429: true };
    }

    currentPollMs = POLL_MS;

    const failed = Number(
      queueRes && queueRes.success && queueRes.data && queueRes.data.failed != null ? queueRes.data.failed : 0
    );
    if (failed > 0) {
      items.push({
        type: "queue",
        text: `${failed} failed queue job(s)`,
        href: "/admin/monitoring/activity"
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

    return { items, hit429: false };
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

  async function refresh() {
    if (inFlight) return;
    if (typeof window.adminSafeFetch !== "function") return;
    inFlight = true;
    try {
      const result = await fetchAlerts();
      const items = result.items || [];
      const localUnread = window.AdminOpsNotifications ? window.AdminOpsNotifications.unreadCount() : 0;
      const count =
        localUnread + items.filter((i) => i.type === "queue" || i.type === "site").length;
      lastUnread = count;
      const badge = document.getElementById("adminNotifyBadge");
      updateBadge(badge, count);
      const panel = document.getElementById("adminNotifyPanel");
      if (panel && panel.classList.contains("is-open")) renderPanel(panel, items);
      return result;
    } finally {
      inFlight = false;
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

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        panel.innerHTML = '<p class="admin-notify-empty">Loading…</p>';
        const result = await fetchAlerts();
        renderPanel(panel, result.items || []);
        window.AdminOpsNotifications?.markAllRead();
        updateBadge(badge, 0);
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    refresh().finally(() => scheduleNextPoll());

    window.AdminNotifications = window.AdminNotifications || {};
    window.AdminNotifications.refresh = refresh;
    window.AdminNotifications.getUnreadCount = () => lastUnread;
  }

  window.AdminNotifications = {
    mount,
    stop: () => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  window.addEventListener("pagehide", () => {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  });

  const toolsHost = document.getElementById("adminTopbarTools");
  if (toolsHost) mount(toolsHost);
})();
