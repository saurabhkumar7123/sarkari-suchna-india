/**
 * Board hub pages: /tag/ssc, /tag/railway, …
 * Lists pages where pages.department = board slug (not page_tags).
 */
(function () {
  "use strict";

  const PAGE_SIZE = 20;

  const state = {
    slug: null,
    page: 1
  };

  function normalizePathname() {
    let p = window.location.pathname || "/";
    p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
    return p === "" ? "/" : p;
  }

  function parseBoardSlugFromPath() {
    const m = normalizePathname().match(/^\/tag\/([^/]+)$/i);
    return m ? decodeURIComponent(m[1]).trim().toLowerCase() : "";
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeUrl(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "#") return "#";
    if (s.startsWith("/")) return s;
    return "#";
  }

  function boardLabelFromSlug(slug) {
    const s = String(slug || "").trim();
    if (!s) return "Jobs";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function renderListingCard(container, label, items) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="ribbon navy-ribbon">
        <span class="title">${escapeHtml(String(label || "Jobs").toUpperCase())}</span>
      </div>
      <div class="card-content">
        <ul class="job-list"></ul>
      </div>`;
    const ul = div.querySelector(".job-list");
    items.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      const url = item && item.url != null ? String(item.url).trim() : "";
      const slug = item && item.slug != null ? String(item.slug).trim() : "";
      const bad = (v) => !v || v === "undefined" || v === "null";
      let href = !bad(url) ? url : !bad(slug) ? `/${slug.replace(/^\/+/, "")}` : "#";
      a.href = safeUrl(href);
      a.textContent = (item && item.title) || slug || "Untitled";
      li.appendChild(a);
      ul.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(div);
  }

  function renderPager(pagination) {
    const pager = document.getElementById("listingPager");
    if (!pager) return;

    if (!pagination || pagination.totalPages <= 1) {
      pager.hidden = true;
      pager.innerHTML = "";
      return;
    }

    const cur = pagination.currentPage || state.page;
    const last = pagination.totalPages || 1;
    const total = pagination.total || 0;
    const limit = pagination.limit || PAGE_SIZE;

    pager.hidden = false;
    pager.innerHTML = `
      <div class="listing-pager-inner">
        <button type="button" class="pager-btn pager-prev" ${cur <= 1 ? "disabled" : ""} aria-label="Previous page">Prev</button>
        <span class="pager-meta">Page ${cur} of ${last} · ${total} items · ${limit}/page</span>
        <button type="button" class="pager-btn pager-next" ${cur >= last ? "disabled" : ""} aria-label="Next page">Next</button>
      </div>`;

    const prev = pager.querySelector(".pager-prev");
    const next = pager.querySelector(".pager-next");
    if (prev && !prev.disabled) {
      prev.addEventListener("click", () => navigatePage(cur - 1));
    }
    if (next && !next.disabled) {
      next.addEventListener("click", () => navigatePage(cur + 1));
    }
  }

  function navigatePage(pageNum) {
    const p = Math.max(1, pageNum);
    const params = new URLSearchParams(window.location.search);
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const q = params.toString();
    const base = `/tag/${encodeURIComponent(state.slug)}`;
    window.location.href = q ? `${base}?${q}` : base;
  }

  async function fetchBoardPage(slug, pageNum) {
    const params = new URLSearchParams({
      department: slug,
      page: String(pageNum),
      limit: String(PAGE_SIZE)
    });
    const res = await fetch(`/api/pages?${params.toString()}`, { cache: "default" });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      ok: true,
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination || null
    };
  }

  async function loadBoardHubPage(pageNum) {
    const container = document.getElementById("dynamicSections");
    if (!container || !state.slug) return;

    state.page = pageNum || 1;
    container.innerHTML =
      '<div class="card"><div class="card-content"><p class="listing-loading">Loading…</p></div></div>';

    const pager = document.getElementById("listingPager");
    if (pager) {
      pager.hidden = true;
      pager.innerHTML = "";
    }

    const { ok, data, pagination, error } = await fetchBoardPage(state.slug, state.page);

    if (!ok) {
      container.innerHTML = `<div class="card"><div class="card-content"><p class="listing-error">Could not load data. ${escapeAttr(error)}</p></div></div>`;
      return;
    }

    if (!data.length) {
      container.innerHTML =
        '<div class="card"><div class="card-content"><p class="listing-empty">No updates found for this category yet.</p></div></div>';
      renderPager(null);
      return;
    }

    renderListingCard(container, boardLabelFromSlug(state.slug), data);
    renderPager(pagination);
  }

  function initBoardHubPage() {
    const path = normalizePathname();
    if (!/^\/tag\/[^/]+$/i.test(path)) return;

    state.slug =
      typeof window.__BOARD_HUB_SLUG__ === "string" && window.__BOARD_HUB_SLUG__
        ? window.__BOARD_HUB_SLUG__.trim().toLowerCase()
        : parseBoardSlugFromPath();

    if (!state.slug) return;

    const params = new URLSearchParams(window.location.search);
    const initialPage = Math.max(1, parseInt(params.get("page"), 10) || 1);
    state.page = initialPage;

    if (initialPage <= 1 && window.__BOARD_HUB_PAGINATION__) {
      renderPager(window.__BOARD_HUB_PAGINATION__);
    }

    if (initialPage > 1) {
      loadBoardHubPage(initialPage);
    }
  }

  document.addEventListener("DOMContentLoaded", initBoardHubPage);
})();
