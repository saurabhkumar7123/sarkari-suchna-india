/**
 * Command palette (Ctrl+K) — lightweight fuzzy match, no extra dependencies.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const ROUTES = [
    { label: "Dashboard", href: "/admin/dashboard", group: "Go to" },
    { label: "Page Manager", href: "/admin/page-manager", group: "Go to" },
    { label: "Monitoring", href: "/admin/monitoring", group: "Go to" },
    { label: "Activity Log", href: "/admin/activity", group: "Go to" },
    { label: "CSV Upload", href: "/admin/csv-upload", group: "Go to" },
    { label: "Page Generator", href: "/generator", group: "Go to" },
    { label: "Upload Files", href: "/upload", group: "Go to" },
    { label: "Trash", href: "/trash", group: "Go to" },
    { label: "New job page", href: "/generator", group: "Actions" },
    { label: "Run site check", href: "/admin/monitoring", group: "Actions" }
  ];

  let overlayEl = null;
  let inputEl = null;
  let resultsEl = null;
  let activeIndex = 0;
  let currentItems = [];

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

  function buildItems(query) {
    const items = [];
    ROUTES.forEach((r) => {
      const s = score(query, r.label);
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
    return items.sort((a, b) => b.score - a.score).slice(0, 12);
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
      groups[g].forEach((it, idx) => {
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

  function navigate(item) {
    if (!item || !item.href) return;
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
        <input type="text" class="admin-cmd-input" id="adminCmdInput" placeholder="Search pages, go to…" autocomplete="off" aria-label="Command search">
        <div class="admin-cmd-results" id="adminCmdResults"></div>
        <p class="admin-cmd-hint">↑↓ navigate · Enter open · Esc close</p>
      </div>
    `;
    document.body.appendChild(overlayEl);
    inputEl = overlayEl.querySelector("#adminCmdInput");
    resultsEl = overlayEl.querySelector("#adminCmdResults");

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) close();
    });
    inputEl.addEventListener("input", () => renderResults(buildItems(inputEl.value)));
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
