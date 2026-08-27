/**
 * Command palette (Ctrl+K) — navigation, actions, page search.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const ROUTES = [
    { label: "Automation Control Center", href: "/admin/automation-control-center", group: "Go to", keywords: "dashboard automation control center acc overview publishing scheduler telegram" },
    { label: "Dashboard", href: "/admin/dashboard", group: "Go to", keywords: "home operator attention kpi" },
    { label: "Page Manager", href: "/admin/page-manager", group: "Go to", keywords: "pages edit list published" },
    { label: "Published Pages", href: "/admin/page-manager", group: "Go to", keywords: "live public page manager" },
    { label: "Monitoring", href: "/admin/monitoring", group: "Go to", keywords: "queue sites health" },
    { label: "Detected Updates", href: "/admin/monitoring/updates", group: "Go to", keywords: "detections change official" },
    { label: "Monitoring Activity", href: "/admin/monitoring/activity", group: "Go to", keywords: "failed jobs retry queue activity" },
    { label: "Alerts", href: "/admin/alerts", group: "Go to", keywords: "notifications pdf system" },
    { label: "PDF Alerts", href: "/admin/alerts", group: "Go to", keywords: "notifications pdf" },
    { label: "CSV Upload", href: "/admin/csv-upload", group: "Go to", keywords: "csv import" },
    { label: "Content Import", href: "/admin/csv-upload", group: "Go to", keywords: "csv import" },
    { label: "Sessions", href: "/admin/sessions", group: "Go to", keywords: "login devices" },
    { label: "Activity Log", href: "/admin/activity", group: "Go to", keywords: "audit history" },
    { label: "Homepage Management", href: "/admin/homepage-management", group: "Go to", keywords: "breaking badges" },
    { label: "Drafts", href: "/generator#drafts", group: "Go to", keywords: "unpublished parked generator drafts" },
    { label: "Create Draft", href: "/generator", group: "Quick actions", keywords: "draft park generator" },
    { label: "Create Recruitment", href: "/admin/recruitments", group: "Quick actions", keywords: "new recruitment ops" },
    { label: "Open Editorial Review", href: "/admin/editorial-review", group: "Quick actions", keywords: "review inbox approve" },
    { label: "Open Shared Preview", href: "/admin/recruitment-runtime-preview", group: "Quick actions", keywords: "preview runtime" },
    { label: "Open Events", href: "/admin/recruitments#eventTimeline", group: "Quick actions", keywords: "timeline events" },
    { label: "Search Recruitments", href: "/admin/recruitments", group: "Quick actions", keywords: "find filter search" },
    { label: "Open Source Manager", href: "/admin/automation-control-center/sources", group: "Quick actions", keywords: "official sources domains crawl manager" },
    { label: "Open AI Insights", href: "/admin/automation-control-center/insights", group: "Quick actions", keywords: "analytics confidence recommendation" },
    { label: "Recruitment Operations", href: "/admin/recruitments", group: "Go to", keywords: "recruitments events links" },
    { label: "Editorial Review", href: "/admin/editorial-review", group: "Go to", keywords: "draft binding review queue" },
    { label: "Review Queue", href: "/admin/editorial-review", group: "Go to", keywords: "editorial review queue content" },
    { label: "Recruitment Review", href: "/admin/recruitment-review-queue", group: "Go to", keywords: "review queue recruitment" },
    { label: "Runtime Preview", href: "/admin/recruitment-runtime-preview", group: "Go to", keywords: "preview runtime Shared Preview" },
    { label: "SEO Diagnostics", href: "/admin/seo-diagnostics", group: "Go to", keywords: "seo metadata schema freshness checklist" },
    { label: "Feature Completion Report", href: "/admin/seo-diagnostics#featureCompletionReport", group: "Go to", keywords: "program 4 complete report" },
    { label: "Validation / Diagnostics", href: "/admin/recruitment-testing", group: "Go to", keywords: "recruitment testing validation" },
    { label: "Upload PDF", href: "/upload", group: "Go to", keywords: "files pdf extract" },
    { label: "Trash", href: "/trash", group: "Go to", keywords: "deleted restore" },
    { label: "Official Sources", href: "/admin/automation-control-center/sources", group: "Go to", keywords: "acc official sources registry" },
    { label: "Recruitment Snapshot", href: "/admin/automation-control-center/recruitments", group: "Go to", keywords: "acc recruitment snapshot" },
    { label: "Review Snapshot", href: "/admin/automation-control-center/reviews", group: "Go to", keywords: "acc review snapshot" },
    { label: "Queue Snapshot", href: "/admin/automation-control-center/queue", group: "Go to", keywords: "acc workflow queue" },
    { label: "Health Snapshot", href: "/admin/automation-control-center/health", group: "Go to", keywords: "acc health snapshot" },
    { label: "Automation Logs", href: "/admin/automation-control-center/logs", group: "Go to", keywords: "audit automation activity logs" },
    { label: "Control Flags", href: "/admin/automation-control-center/controls", group: "Go to", keywords: "publishing scheduler telegram flags safety" },
    { label: "Draft Snapshot", href: "/admin/automation-control-center/drafts", group: "Go to", keywords: "acc drafts conversion" },
    { label: "Run site check now", href: "__action_run_check__", group: "Actions", keywords: "monitor queue" },
    { label: "Retry failed queue jobs", href: "__action_retry_failed__", group: "Actions", keywords: "monitor error" }
  ];

  let overlayEl = null;
  let inputEl = null;
  let resultsEl = null;
  let activeIndex = 0;
  let currentItems = [];
  let pageSearchTimer = null;

  function score(q, text) {
    const query = String(q || "").trim().toLowerCase();
    const t = String(text || "").toLowerCase();
    if (!query) return 1;
    if (t.includes(query)) return 2;
    const words = query.split(/\s+/);
    if (words.every((w) => t.includes(w))) return 1;
    return 0;
  }

  function getRecentPages() {
    try {
      const raw = localStorage.getItem("recentPages");
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr.slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  async function searchPagesRemote(query) {
    const q = String(query || "").trim();
    if (q.length < 2 || typeof window.adminSafeFetch !== "function") return [];
    window.AdminOpsSearch?.rememberSearch(q, "global");
    const [pagesRes, recrRes] = await Promise.all([
      window.adminSafeFetch(`/api/admin/pages?page=1&limit=6&q=${encodeURIComponent(q)}`),
      window.adminSafeFetch(`/api/admin/recruitments?page=1&limit=6&search=${encodeURIComponent(q)}`)
    ]);
    const pageItems =
      pagesRes && pagesRes.success && Array.isArray(pagesRes.data)
        ? pagesRes.data.map((p) => ({
            label: p.title || p.slug,
            href: `/admin/page-manager?q=${encodeURIComponent(p.slug || p.title || "")}`,
            group: "Search pages",
            score: 3,
            kind: "search"
          }))
        : [];
    const recrItems =
      recrRes && recrRes.success && Array.isArray(recrRes.data)
        ? recrRes.data.map((r) => ({
            label: r.title || r.slug,
            href: `/admin/recruitments?search=${encodeURIComponent(r.title || r.slug || "")}`,
            group: "Search recruitments",
            score: 3.2,
            kind: "search"
          }))
        : [];
    return [...recrItems, ...pageItems];
  }

  function buildItems(query) {
    const items = [];
    ROUTES.forEach((r) => {
      const hay = `${r.label} ${r.keywords || ""}`;
      const s = score(query, hay);
      if (s) items.push({ ...r, score: s, kind: "route" });
    });
    getRecentPages().forEach((p) => {
      const title = typeof p === "string" ? p : p.title || p.slug || "";
      const slug = typeof p === "object" && p.slug ? p.slug : "";
      if (!title && !slug) return;
      const label = title || slug;
      const s = score(query, label);
      if (s && slug) {
        items.push({
          label,
          href: `/generator?slug=${encodeURIComponent(slug)}`,
          group: "Recent pages",
          score: s + 0.5,
          kind: "page"
        });
      }
    });
    if (window.AdminOpsSearch && !String(query || "").trim()) {
      window.AdminOpsSearch.recentSearches(6).forEach((r) => {
        items.push({
          label: r.query,
          href: `/admin/recruitments?search=${encodeURIComponent(r.query)}`,
          group: "Recent searches",
          score: 1.2,
          kind: "recent"
        });
      });
    }
    return items.sort((a, b) => b.score - a.score).slice(0, 14);
  }

  function renderResults(items) {
    currentItems = items;
    activeIndex = 0;
    if (!resultsEl) return;
    if (!items.length) {
      resultsEl.innerHTML = '<p class="admin-cmd-hint">No matches</p>';
      return;
    }
    const groups = {};
    items.forEach((it) => {
      const g = it.group || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(it);
    });
    let html = "";
    Object.keys(groups).forEach((g) => {
      html += `<div class="admin-cmd-group-title">${g}</div>`;
      groups[g].forEach((it) => {
        const globalIdx = items.indexOf(it);
        html += `<button type="button" class="admin-cmd-item${globalIdx === 0 ? " is-active" : ""}" data-idx="${globalIdx}">${it.label}</button>`;
      });
    });
    resultsEl.innerHTML = html;
    resultsEl.querySelectorAll(".admin-cmd-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-idx"));
        navigate(items[i]);
      });
    });
  }

  async function runPaletteAction(action) {
    if (typeof window.adminSafeFetch !== "function") return;
    if (action === "__action_run_check__") {
      close();
      window.AdminUI?.toastSuccess?.("Running site check…");
      const res = await window.adminSafeFetch("/api/admin/run-check", { method: "POST" });
      if (res && res.success) {
        window.AdminUI?.toastSuccess?.("Check triggered");
        window.location.href = "/admin/monitoring";
      } else {
        window.AdminUI?.toastError?.("Could not run check");
      }
      return;
    }
    if (action === "__action_retry_failed__") {
      close();
      const res = await window.adminSafeFetch("/api/admin/queue/retry", { method: "POST" });
      if (res && res.success) {
        window.AdminUI?.toastSuccess?.("Retry queued");
        window.location.href = "/admin/monitoring";
      } else {
        window.AdminUI?.toastError?.("Retry failed");
      }
    }
  }

  function navigate(item) {
    if (!item || !item.href) return;
    if (String(item.href).startsWith("__action_")) {
      runPaletteAction(item.href);
      return;
    }
    close();
    window.location.href = item.href;
  }

  function setActive(idx) {
    activeIndex = idx;
    resultsEl.querySelectorAll(".admin-cmd-item").forEach((el, i) => {
      el.classList.toggle("is-active", i === activeIndex);
    });
  }

  function open() {
    if (!overlayEl) ensureDom();
    overlayEl.classList.add("is-open");
    inputEl.value = "";
    renderResults(buildItems(""));
    inputEl.focus();
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function ensureDom() {
    overlayEl = document.createElement("div");
    overlayEl.className = "admin-cmd-overlay";
    overlayEl.id = "adminCmdOverlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("aria-label", "Command palette");
    overlayEl.innerHTML = `
      <div class="admin-cmd-modal">
        <input type="text" class="admin-cmd-input" id="adminCmdInput" placeholder="Search pages, go to admin… (Ctrl+K)" autocomplete="off" aria-label="Command search">
        <div class="admin-cmd-results" id="adminCmdResults"></div>
        <p class="admin-cmd-hint">↑↓ navigate · Enter open · Esc close · Ctrl+K anytime</p>
      </div>
    `;
    document.body.appendChild(overlayEl);
    inputEl = overlayEl.querySelector("#adminCmdInput");
    resultsEl = overlayEl.querySelector("#adminCmdResults");

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) close();
    });
    inputEl.addEventListener("input", () => {
      const q = inputEl.value;
      const base = buildItems(q);
      renderResults(base);
      if (pageSearchTimer) clearTimeout(pageSearchTimer);
      if (String(q).trim().length >= 2) {
        pageSearchTimer = setTimeout(async () => {
          const remote = await searchPagesRemote(q);
          if (inputEl.value !== q) return;
          const merged = [...remote, ...buildItems(q)].sort((a, b) => b.score - a.score).slice(0, 14);
          renderResults(merged);
        }, 280);
      }
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, currentItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        navigate(currentItems[activeIndex]);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    const isK = e.key === "k" && (e.ctrlKey || e.metaKey);
    if (isK) {
      e.preventDefault();
      open();
      return;
    }
    if (e.key === "Escape" && overlayEl && overlayEl.classList.contains("is-open")) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  window.AdminCommandPalette = { open, close };
})();
