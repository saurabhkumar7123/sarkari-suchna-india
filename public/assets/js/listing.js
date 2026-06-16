// =============================
// Listing pages: /new-form, /result, /admit-card, …
// Fetches ONLY the active section via ?section=… (DB-filtered, not client-filtered)
// =============================
(function () {
  "use strict";

  const EVENT_LIVE_PHASE_MS = 30 * 60 * 1000;
  const PAGE_SIZE = 20;
  /**
   * Phase 5: Listing pages no longer render status/freshness badges.
   * Flip to `true` to instantly restore the old badge column without redeploy
   * if a regression is reported.
   */
  const RENDER_BADGES_IN_LISTINGS = false;

  const LISTING_PATH_TO_SECTION = {
    "/new-form": "new form",
    "/admission": "admission",
    "/result": "result",
    "/admit-card": "admit card",
    "/answer-key": "answer key",
    "/syllabus": "syllabus",
    "/document": "document"
  };

  /** API ?section= slug (matches backend SECTION_STATUS_GROUPS keys) */
  const PATH_TO_SECTION_SLUG = {
    "/new-form": "new-form",
    "/admission": "admission",
    "/result": "result",
    "/admit-card": "admit-card",
    "/answer-key": "answer-key",
    "/syllabus": "syllabus",
    "/document": "document"
  };

  const state = {
    path: null,
    want: null,
    sectionSlug: null,
    page: 1
  };

  function normalizePathname() {
    let p = window.location.pathname || "/";
    p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
    return p === "" ? "/" : p;
  }

  function listingRouteKey() {
    return normalizePathname().toLowerCase();
  }

  function isNewFormRibbonStatus(status) {
    const t = String(status || "").trim().toLowerCase();
    return t === "new form" || t.startsWith("new form ");
  }

  function getRibbonClass(status) {
    const s = String(status || "").toLowerCase().trim();
    if (s === "new form" || s.startsWith("new form ")) return "navy-ribbon";
    if (s === "admission" || s.startsWith("admission ")) return "navy-ribbon";
    if (s.includes("admit card") || s === "admit") return "orange-ribbon";
    if (s.includes("answer key") || s === "answer") return "purple-ribbon";
    if (s.includes("result")) return "green-ribbon";
    if (s.includes("syllabus")) return "darkblue-ribbon";
    if (s.includes("document")) return "orange-ribbon";
    if (/\bnew\b/.test(s)) return "blue-ribbon";
    return "green-ribbon";
  }

  function getBadge(status, eventTime, date) {
    const normalizedStatus = String(status || "").toLowerCase().trim();
    const created = date ? new Date(date) : null;
    const hasValidDate = created && !isNaN(created.getTime());
    if (!hasValidDate) {
      return fallbackStatusBadge(normalizedStatus, status);
    }

    const now = new Date();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return "";

    if (eventTime) {
      const event = new Date(eventTime);
      if (!isNaN(event.getTime())) {
        const diff = event - now;
        if (diff > 0) return `<span class="tag coming">COMING SOON</span>`;
        const since = now - event;
        if (since >= 0 && since < EVENT_LIVE_PHASE_MS) {
          return `<span class="tag live">LIVE NOW</span>`;
        }
        if (since >= EVENT_LIVE_PHASE_MS && normalizedStatus === "result") {
          return `<span class="tag declared">DECLARED</span>`;
        }
      }
    }

    return fallbackStatusBadge(normalizedStatus, status);
  }

  function fallbackStatusBadge(normalizedStatus, status) {
    if (normalizedStatus === "new form" || normalizedStatus.includes("new form")) {
      return `<span class="tag new">NEW</span>`;
    }
    if (normalizedStatus.includes("new")) return `<span class="tag new">NEW</span>`;
    if (status === "new") return `<span class="tag new">NEW</span>`;
    if (
      normalizedStatus === "admit card" ||
      normalizedStatus.includes("admit card") ||
      status === "admit"
    ) {
      return `<span class="tag out">OUT</span>`;
    }
    if (normalizedStatus === "result") return `<span class="tag declared">DECLARED</span>`;
    if (
      normalizedStatus === "answer key" ||
      normalizedStatus.includes("answer key") ||
      status === "answer"
    ) {
      return `<span class="tag answer">KEY</span>`;
    }
    if (status === "syllabus") return `<span class="tag syllabus">SYLLABUS</span>`;
    if (status === "admission") return `<span class="tag admission">OPEN</span>`;
    if (status === "document") return `<span class="tag document">DOC</span>`;
    return "";
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeUrl(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "#") return "#";
    const colonIdx = s.indexOf(":");
    if (colonIdx !== -1) {
      const proto = s.slice(0, colonIdx).toLowerCase();
      if (proto === "javascript" || proto === "data" || proto === "vbscript" || proto === "file") return "#";
    }
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
        return u.href;
      } catch {
        return "#";
      }
    }
    if (s.startsWith("//")) return "#";
    if (s.startsWith("/")) return s;
    return "#";
  }

  async function fetchSectionPage(sectionSlug, page, limit) {
    const n = Math.min(Math.max(parseInt(limit, 10) || PAGE_SIZE, 1), 50);
    const p = Math.max(1, parseInt(page, 10) || 1);
    const url = `/api/pages?section=${encodeURIComponent(sectionSlug)}&page=${p}&limit=${n}`;
    try {
      const res = await fetch(url, { cache: "default" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        console.error("[listing] API error", res.status, url);
        return { ok: false, data: [], pagination: null, error: `HTTP ${res.status}` };
      }
      if (!ct.includes("application/json")) {
        return { ok: false, data: [], pagination: null, error: "Bad response" };
      }
      const json = await res.json();
      const data = json && Array.isArray(json.data) ? json.data : [];
      const pagination = json && json.pagination ? json.pagination : null;
      console.log("[listing] loaded section=%s page=%s type=%s items=%s", sectionSlug, p, typeof json.data, data.length);
      return { ok: true, data, pagination, error: null };
    } catch (e) {
      console.error("[listing] fetch failed", url, e);
      return { ok: false, data: [], pagination: null, error: "Network error" };
    }
  }

  function formatRibbonLabelText(status) {
    const line = String(status ?? "").trim() || "SECTION";
    const upper = line.toUpperCase();
    if (upper.endsWith("S")) return upper;
    return `${upper}S`;
  }

  function buildRibbonTitleNodes(want) {
    const frag = document.createDocumentFragment();
    if (isNewFormRibbonStatus(want)) {
      const badge = document.createElement("span");
      badge.className = "mini-badge";
      badge.textContent = "New";
      frag.appendChild(badge);
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = "FORMS";
      frag.appendChild(title);
      return frag;
    }
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = formatRibbonLabelText(want);
    frag.appendChild(title);
    return frag;
  }

  function renderListingCard(container, want, items) {
    const ribbonClass = getRibbonClass(want);
    const div = document.createElement("div");
    div.className = "card";

    const ribbon = document.createElement("div");
    ribbon.className = `ribbon ${ribbonClass}${isNewFormRibbonStatus(want) ? " form-ribbon" : ""}`;
    ribbon.appendChild(buildRibbonTitleNodes(want));

    const content = document.createElement("div");
    content.className = "card-content";
    const ul = document.createElement("ul");
    ul.className = "job-list";

    items.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      const url = item && item.url != null ? String(item.url).trim() : "";
      const slug = item && item.slug != null ? String(item.slug).trim() : "";
      const bad = (s) => !s || s === "undefined" || s === "null";
      let href = !bad(url) ? url : !bad(slug) ? `/${slug.replace(/^\/+/, "")}` : "#";
      if (href === "/undefined") href = "#";
      a.href = safeUrl(href);
      a.textContent = (item && item.title) || slug || "Untitled";
      li.appendChild(a);

      if (RENDER_BADGES_IN_LISTINGS) {
        const badgeWrap = document.createElement("span");
        badgeWrap.innerHTML = getBadge(item.status, item.eventTime, item.date);
        li.appendChild(badgeWrap);
      }
      ul.appendChild(li);
    });

    content.appendChild(ul);
    div.appendChild(ribbon);
    div.appendChild(content);
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

    const { currentPage, totalPages, total, limit } = pagination;
    const cur = currentPage || state.page;
    const last = totalPages || 1;

    pager.hidden = false;
    pager.innerHTML = `
      <div class="listing-pager-inner">
        <button type="button" class="pager-btn pager-prev" ${cur <= 1 ? "disabled" : ""} aria-label="Previous page">Prev</button>
        <span class="pager-meta">Page ${cur} of ${last} · ${total} items · ${limit || PAGE_SIZE}/page</span>
        <button type="button" class="pager-btn pager-next" ${cur >= last ? "disabled" : ""} aria-label="Next page">Next</button>
      </div>`;

    const prev = pager.querySelector(".pager-prev");
    const next = pager.querySelector(".pager-next");
    if (prev && !prev.disabled) {
      prev.addEventListener("click", () => loadListingPage(state.path, cur - 1));
    }
    if (next && !next.disabled) {
      next.addEventListener("click", () => loadListingPage(state.path, cur + 1));
    }
  }

  async function loadListingPage(path, pageNum) {
    const want = LISTING_PATH_TO_SECTION[path];
    const sectionSlug = PATH_TO_SECTION_SLUG[path];
    const container = document.getElementById("dynamicSections");

    if (!container || !want || !sectionSlug) return;

    state.path = path;
    state.want = want;
    state.sectionSlug = sectionSlug;
    state.page = pageNum || 1;

    container.innerHTML =
      `<div class="card"><div class="card-content"><p class="listing-loading">Loading...</p></div></div>`;

    const pager = document.getElementById("listingPager");
    if (pager) {
      pager.hidden = true;
      pager.innerHTML = "";
    }

    const { ok, data, pagination, error } = await fetchSectionPage(sectionSlug, state.page, PAGE_SIZE);

    if (!ok) {
      container.innerHTML = `<div class="card"><div class="card-content"><p class="listing-error">Could not load data. ${escapeAttr(error)} - please try again later.</p></div></div>`;
      return;
    }

    if (!data.length) {
      container.innerHTML =
        `<div class="card"><div class="card-content"><p class="listing-empty">No updates found in this section yet.</p></div></div>`;
      renderPager(null);
      return;
    }

    renderListingCard(container, want, data);
    renderPager(pagination);
  }

  function initListingPage() {
    try {
      const path = listingRouteKey();

      const seoMap = {
        "/admit-card": {
          title: "Admit Card 2026 - Download",
          desc: "Latest admit cards download links and updates"
        },
        "/result": {
          title: "Latest Results 2026",
          desc: "Check all latest result updates and scorecards"
        },
        "/new-form": {
          title: "Latest Govt Jobs 2026",
          desc: "All new job forms and recruitment updates"
        },
        "/answer-key": {
          title: "Answer Key 2026",
          desc: "Download all latest answer keys"
        },
        "/syllabus": {
          title: "Syllabus 2026",
          desc: "Check exam syllabus and pattern"
        },
        "/admission": {
          title: "Admission 2026",
          desc: "Latest admission forms and updates"
        },
        "/document": {
          title: "Important Documents",
          desc: "All document related updates"
        }
      };

      const pageTitleEl = document.getElementById("pageTitle");
      const metaDescEl = document.getElementById("metaDesc");
      const canonicalEl = document.getElementById("canonicalLink");
      const ogTitleEl = document.getElementById("ogTitle");
      const ogDescEl = document.getElementById("ogDesc");
      const ogUrlEl = document.getElementById("ogUrl");

      if (seoMap[path]) {
        const m = seoMap[path];
        if (pageTitleEl) pageTitleEl.textContent = m.title;
        if (metaDescEl) metaDescEl.setAttribute("content", m.desc);
        if (ogTitleEl) ogTitleEl.setAttribute("content", m.title);
        if (ogDescEl) ogDescEl.setAttribute("content", m.desc);
        const h = document.getElementById("listingHeading");
        const sub = document.getElementById("listingSub");
        if (h) h.textContent = m.title;
        if (sub) sub.textContent = m.desc;
      } else if (LISTING_PATH_TO_SECTION[path]) {
        const section = LISTING_PATH_TO_SECTION[path];
        const fallbackTitle = `${section === "new form" ? "New form" : section} listings`;
        if (pageTitleEl) pageTitleEl.textContent = fallbackTitle;
        const h = document.getElementById("listingHeading");
        if (h) h.textContent = fallbackTitle;
      }

      if (canonicalEl) {
        const absoluteUrl = window.location.origin + (window.location.pathname || "/");
        canonicalEl.setAttribute("href", absoluteUrl);
        if (ogUrlEl) ogUrlEl.setAttribute("content", absoluteUrl);
      }

      if (LISTING_PATH_TO_SECTION[path]) {
        loadListingPage(path, 1);
      } else {
        const c = document.getElementById("dynamicSections");
        if (c) {
          c.innerHTML =
            `<div class="card"><div class="card-content"><p class="listing-error">This section is not available for this URL.</p></div></div>`;
        }
        console.warn("listing.js: no route for pathname", window.location.pathname);
      }
    } catch (err) {
      console.error("listing.js:", err);
      const c = document.getElementById("dynamicSections");
      if (c) {
        c.innerHTML =
          `<div class="card"><div class="card-content"><p class="listing-error">Page load failed. Please refresh and try again.</p></div></div>`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initListingPage);
  } else {
    initListingPage();
  }
})();
