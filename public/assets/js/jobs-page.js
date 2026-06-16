(function () {
  "use strict";

  const DEFAULT_LIMIT = 10;
  const FILTER_CHIP_KEYS = ["qualification", "state", "department", "jobType", "status"];
  const SORT_STORAGE_KEY = "jobsPageSort";

  let currentFilters = {};
  let currentJobs = [];
  let currentPagination = null;

  function normalizeFilterValue(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getQueryFilters() {
    if (window.JobFinderUrl) {
      return window.JobFinderUrl.validateState(window.JobFinderUrl.parseUrl());
    }
    const params = new URLSearchParams(window.location.search);
    return {
      qualification: normalizeFilterValue(params.get("qualification")),
      state: normalizeFilterValue(params.get("state")),
      department: normalizeFilterValue(params.get("department")),
      jobType: normalizeFilterValue(params.get("jobType")),
      status: normalizeFilterValue(params.get("status")),
      source: normalizeFilterValue(params.get("source"))
    };
  }

  function getPaginationQuery() {
    const params = new URLSearchParams(window.location.search);
    const page = Math.max(1, parseInt(params.get("page"), 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(params.get("limit"), 10) || DEFAULT_LIMIT));
    return { page, limit };
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function normalizeJobStatus(status) {
    return String(status ?? "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function formatLastDateDdMmYyyy(lastDate) {
    if (typeof lastDate !== "string" || lastDate.length < 10) return null;
    const [year, month, day] = lastDate.slice(0, 10).split("-");
    if (
      !year ||
      !month ||
      !day ||
      year.length !== 4 ||
      !/^\d{2}$/.test(month) ||
      !/^\d{2}$/.test(day)
    ) {
      return null;
    }
    return `${day}/${month}/${year}`;
  }

  function getActiveFilterParts(filters) {
    const parts = [];
    FILTER_CHIP_KEYS.forEach((key) => {
      if (filters[key]) {
        parts.push({ key, label: titleCase(filters[key]) });
      }
    });
    return parts;
  }

  function buildContextualHeading(filters) {
    const qual = filters.qualification ? titleCase(filters.qualification) : "";
    const state = filters.state ? titleCase(filters.state) : "";
    const dept = filters.department ? titleCase(filters.department) : "";

    if (qual && state) return `${qual} Jobs in ${state}`;
    if (qual && dept) return `${qual} Jobs in ${dept}`;
    if (dept && state) return `${dept} Jobs in ${state}`;
    if (qual) return `${qual} Jobs`;
    if (dept) return `${dept} Jobs`;
    if (state) return `Jobs in ${state}`;
    if (filters.source === "finder") return "Jobs matching your search";
    return "All Jobs";
  }

  function buildCountLine(totalCount, filters) {
    const parts = getActiveFilterParts(filters);
    if (!parts.length) {
      return `<strong>${totalCount}</strong> job${totalCount === 1 ? "" : "s"} found`;
    }
    const filterText = parts.map((p) => p.label).join(" · ");
    return `<strong>${totalCount}</strong> job${totalCount === 1 ? "" : "s"} found for ${escapeHtml(filterText)}`;
  }

  function buildSeoTitle(filters) {
    const heading = buildContextualHeading(filters);
    return `${heading} | Sarkari Suchna India`;
  }

  function buildSeoDescription(filters) {
    const heading = buildContextualHeading(filters);
    return `Browse ${heading.toLowerCase()} — latest government recruitment, results and admit card updates on Sarkari Suchna India.`;
  }

  function updatePageMeta(filters) {
    const title = buildSeoTitle(filters);
    const desc = buildSeoDescription(filters);
    document.title = title;

    const titleEl = document.getElementById("jobsPageTitle");
    if (titleEl) titleEl.textContent = title;

    const descEl = document.getElementById("jobsPageDesc");
    if (descEl) descEl.setAttribute("content", desc);

    const canonicalEl = document.getElementById("jobsCanonical");
    if (canonicalEl) canonicalEl.setAttribute("href", window.location.pathname + window.location.search);
  }

  function updatePageChrome(filters) {
    const headingEl = document.getElementById("jobsHeading");
    const subEl = document.getElementById("jobsSubheading");
    const stripEl = document.getElementById("jobsFinderStrip");
    const breadcrumbEl = document.getElementById("jobsBreadcrumb");
    const inclusiveEl = document.getElementById("jobsInclusiveNote");

    const heading = buildContextualHeading(filters);
    if (headingEl) headingEl.textContent = heading;

    const parts = getActiveFilterParts(filters);
    if (subEl) {
      subEl.textContent = parts.length
        ? `Filtered by ${parts.map((p) => p.label).join(", ")}`
        : "Browse latest government job updates";
    }

    if (stripEl) {
      const showStrip = filters.source === "finder" && parts.length >= 2;
      stripEl.hidden = !showStrip;
    }

    if (breadcrumbEl) {
      const finderCrumb = filters.source === "finder"
        ? `<span class="breadcrumb__sep" aria-hidden="true">›</span><span class="breadcrumb__current">Job Finder</span>`
        : "";
      breadcrumbEl.innerHTML = `
        <a href="/" class="breadcrumb__brand"><i class="fa-solid fa-house breadcrumb__icon" aria-hidden="true"></i>Home</a>
        <span class="breadcrumb__sep" aria-hidden="true">›</span>
        ${finderCrumb}
        <span class="breadcrumb__sep" aria-hidden="true">›</span>
        <span class="breadcrumb__current">Results</span>
      `;
    }

    if (inclusiveEl) {
      inclusiveEl.hidden = !(filters.state && filters.state !== "all india");
    }

    updatePageMeta(filters);
  }

  function buildFilterChipUrl(filters, removeKey) {
    const next = { ...filters };
    if (removeKey) next[removeKey] = "";
    if (window.JobFinderUrl) {
      const validated = window.JobFinderUrl.validateState(next);
      const active = window.JobFinderUrl.countActiveFilters(validated);
      if (validated.source === "finder" && active < window.JobFinderUrl.MIN_REQUIRED_FILTERS) {
        validated.source = active >= 1 ? "finder" : "";
      }
      const query = window.JobFinderUrl.serializeUrl(validated, { fromFinder: validated.source === "finder" });
      return query ? `/jobs.html?${query}` : "/jobs.html";
    }
    const params = new URLSearchParams();
    FILTER_CHIP_KEYS.forEach((key) => {
      if (validatedKey(next, key)) params.set(key, next[key]);
    });
    if (next.source === "finder") params.set("source", "finder");
    const qs = params.toString();
    return qs ? `/jobs.html?${qs}` : "/jobs.html";

    function validatedKey(obj, key) {
      return Boolean(obj[key]);
    }
  }

  function renderFilterChips(filters) {
    const host = document.getElementById("jobsFilterChips");
    if (!host) return;

    const parts = getActiveFilterParts(filters);
    if (!parts.length) {
      host.innerHTML = "";
      return;
    }

    const chips = parts
      .map(
        (part) => `
        <span class="jobs-chip">
          <span>${escapeHtml(part.label)}</span>
          <button type="button" class="jobs-chip__remove" data-remove-filter="${part.key}" aria-label="Remove ${escapeHtml(part.label)} filter">×</button>
        </span>
      `
      )
      .join("");

    host.innerHTML = `
      ${chips}
      <button type="button" class="jobs-chip jobs-chip--add" id="jobsAddFilterChip">+ Add filter</button>
    `;

    host.querySelectorAll("[data-remove-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-remove-filter");
        window.location.href = buildFilterChipUrl(filters, key);
      });
    });

    const addBtn = document.getElementById("jobsAddFilterChip");
    if (addBtn) {
      addBtn.addEventListener("click", () => openEditSearch(filters));
    }
  }

  function renderSummary(filters, totalCount, pagination) {
    const countEl = document.getElementById("jobsCount");
    if (countEl) {
      countEl.innerHTML = buildCountLine(totalCount, filters);
    }
    renderFilterChips(filters);
    updatePageChrome(filters);

    const sortEl = document.getElementById("jobsSort");
    if (sortEl && filters.source === "finder") {
      const relevanceOpt = sortEl.querySelector('option[value="relevance"]');
      if (relevanceOpt) relevanceOpt.textContent = "Relevance (recommended)";
    }
  }

  function shouldShowAllIndiaTag(job, filters) {
    if (!filters.state || filters.state === "all india") return false;
    return normalizeFilterValue(job.state) === "all india";
  }

  function sortJobs(jobs, sortMode) {
    const list = [...jobs];
    if (sortMode === "latest") {
      return list.reverse();
    }
    if (sortMode === "closing") {
      return list.sort((a, b) => {
        const aDate = typeof a.lastDate === "string" ? a.lastDate : "";
        const bDate = typeof b.lastDate === "string" ? b.lastDate : "";
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      });
    }
    return list;
  }

  function getSortMode() {
    const sortEl = document.getElementById("jobsSort");
    return sortEl ? sortEl.value : "relevance";
  }

  function renderJobs(container, jobs, filters) {
    const sorted = sortJobs(jobs, getSortMode());

    if (!sorted.length) {
      container.innerHTML = renderEmptyState(filters);
      bindEmptyStateActions(filters);
      return;
    }

    container.innerHTML = sorted
      .map((job) => {
        const normalizedStatus = normalizeJobStatus(job.status);
        const lastDateOk = typeof job.lastDate === "string" && job.lastDate.length >= 10;
        const formattedDate = lastDateOk ? formatLastDateDdMmYyyy(job.lastDate) : null;
        const showLastDate = normalizedStatus === "new form" && formattedDate != null;
        const href = safeUrl(job.page || "#");
        const qualMeta = job.qualification ? titleCase(job.qualification) : "";
        const allIndiaTag = shouldShowAllIndiaTag(job, filters)
          ? `<span class="job-all-india-tag">Also open: All India</span>`
          : "";
        const lastDateHtml =
          showLastDate
            ? `<p class="job-date"><span class="job-last-date-badge">Last Date: ${formattedDate}</span></p>`
            : "";
        const footHtml = [allIndiaTag, lastDateHtml].filter(Boolean).join("");

        const metaParts = [
          `<span>${escapeHtml(titleCase(job.department || "General"))}</span>`,
          `<span class="job-meta-sep">•</span>`,
          `<span>${escapeHtml(titleCase(job.state || "All India"))}</span>`
        ];
        if (qualMeta) {
          metaParts.push(`<span class="job-meta-sep">•</span>`, `<span>${escapeHtml(qualMeta)}</span>`);
        }

        return `
      <article class="job-card" data-href="${escapeHtml(href)}">
        <h3 class="job-title">
          <a class="job-title-link" href="${href}">${escapeHtml(job.title)}</a>
        </h3>
        <p class="job-meta">${metaParts.join("")}</p>
        ${footHtml ? `<div class="job-card-foot">${footHtml}</div>` : ""}
      </article>
    `;
      })
      .join("");

    container.querySelectorAll(".job-card[data-href]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        const href = card.getAttribute("data-href");
        if (href && href !== "#") window.location.href = href;
      });
    });
  }

  function renderEmptyState(filters) {
    const parts = getActiveFilterParts(filters);
    const filterLine = parts.length
      ? `No jobs match <strong>${escapeHtml(parts.map((p) => p.label).join(", "))}</strong> right now.`
      : "No jobs found right now.";

    return `
      <div class="jobs-empty">
        <p class="jobs-empty__title">No jobs match these filters yet</p>
        <p class="jobs-empty__text">${filterLine} Try removing a filter, choosing <strong>All India</strong>, or search again.</p>
        <div class="jobs-empty__actions">
          <button type="button" class="jobs-btn jobs-btn--primary" id="jobsEmptyEditBtn">Search again</button>
          <a href="/" class="jobs-btn jobs-btn--ghost">Go to Home</a>
          <a href="/categories" class="jobs-btn jobs-btn--ghost">Browse Categories</a>
        </div>
      </div>
    `;
  }

  function bindEmptyStateActions(filters) {
    const btn = document.getElementById("jobsEmptyEditBtn");
    if (btn) btn.addEventListener("click", () => openEditSearch(filters));
  }

  function renderSkeleton(container) {
    container.innerHTML = `
      <div class="jobs-skeleton-list" aria-hidden="true">
        <div class="jobs-skeleton-card"></div>
        <div class="jobs-skeleton-card"></div>
        <div class="jobs-skeleton-card"></div>
        <div class="jobs-skeleton-card"></div>
      </div>
    `;
  }

  function buildJobsApiUrl(filters) {
    const { page, limit } = getPaginationQuery();
    const params = new URLSearchParams();
    if (filters.qualification) params.set("qualification", filters.qualification);
    if (filters.state) params.set("state", filters.state);
    if (filters.department) params.set("department", filters.department);
    if (filters.jobType) params.set("jobType", filters.jobType);
    if (filters.status) params.set("status", filters.status);
    if (window.JobFinderUrl) {
      const active = window.JobFinderUrl.countActiveFilters(
        window.JobFinderUrl.validateState(filters)
      );
      if (filters.source === "finder" && active >= window.JobFinderUrl.MIN_REQUIRED_FILTERS) {
        params.set("source", "finder");
      }
    } else if (filters.source === "finder") {
      params.set("source", "finder");
    }
    params.set("page", String(page));
    params.set("limit", String(limit));
    return `/api/jobs?${params.toString()}`;
  }

  function buildPageUrl(page) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(Math.max(1, page)));
    if (!params.get("limit")) params.set("limit", String(DEFAULT_LIMIT));
    return `${window.location.pathname}?${params.toString()}`;
  }

  function renderPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    sorted.forEach((p) => {
      if (p - prev > 1) out.push("…");
      out.push(p);
      prev = p;
    });
    return out;
  }

  function renderPagination(meta) {
    const host = document.getElementById("jobsPagination");
    if (!host) return;

    const currentPage = Math.max(1, Number(meta?.currentPage) || 1);
    const totalPages = Math.max(0, Number(meta?.totalPages) || 0);
    const total = Number(meta?.total) || 0;
    const limit = Number(meta?.limit) || DEFAULT_LIMIT;

    if (totalPages <= 1) {
      if (total > 0) {
        const end = Math.min(total, limit);
        host.innerHTML = `<p class="jobs-pagination__range">Showing 1–${end} of ${total}</p>`;
      } else {
        host.innerHTML = "";
      }
      return;
    }

    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, total);
    const pageItems = renderPageNumbers(currentPage, totalPages);

    const pageButtons = pageItems
      .map((item) => {
        if (item === "…") return `<span class="jobs-pagination__ellipsis">…</span>`;
        const active = item === currentPage ? " is-active" : "";
        return `<button type="button" data-page="${item}" class="jobs-page-btn${active}" ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`;
      })
      .join("");

    host.innerHTML = `
      <p class="jobs-pagination__range">Showing ${start}–${end} of ${total}</p>
      <button type="button" id="jobsPrevBtn" ${currentPage <= 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
      ${pageButtons}
      <button type="button" id="jobsNextBtn" ${currentPage >= totalPages ? "disabled" : ""} aria-label="Next page">›</button>
    `;

    const prevBtn = document.getElementById("jobsPrevBtn");
    const nextBtn = document.getElementById("jobsNextBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => { window.location.href = buildPageUrl(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener("click", () => { window.location.href = buildPageUrl(currentPage + 1); });

    host.querySelectorAll(".jobs-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.getAttribute("data-page"), 10);
        if (page && page !== currentPage) window.location.href = buildPageUrl(page);
      });
    });
  }

  async function loadJobsData(filters) {
    const apiUrl = buildJobsApiUrl(filters);
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) return { ok: true, jobs: data, pagination: null };
      if (Array.isArray(data?.jobs)) return { ok: true, jobs: data.jobs, pagination: data.pagination || null };
      throw new Error("Invalid jobs payload");
    } catch (error) {
      console.error("[JobsPage] jobs load failed", error);
      return { ok: false, jobs: [], pagination: null };
    }
  }

  function openEditSearch(filters) {
    if (typeof window.openFinderWithFilters === "function") {
      window.openFinderWithFilters(filters || currentFilters);
      return;
    }
    if (typeof window.openFinder === "function") {
      window.openFinder();
    }
  }

  async function copyShareLink() {
    const btn = document.getElementById("jobsShareBtn");
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (btn) {
        btn.classList.add("is-copied");
        const label = btn.querySelector("span");
        if (label) label.textContent = "Copied!";
        setTimeout(() => {
          btn.classList.remove("is-copied");
          if (label) label.textContent = "Share";
        }, 2000);
      }
    } catch (err) {
      console.error("[JobsPage] share copy failed", err);
    }
  }

  function bindToolbarActions(filters) {
    const editBtn = document.getElementById("jobsEditBtn");
    if (editBtn) editBtn.addEventListener("click", () => openEditSearch(filters));

    const shareBtn = document.getElementById("jobsShareBtn");
    if (shareBtn) shareBtn.addEventListener("click", copyShareLink);

    const sortEl = document.getElementById("jobsSort");
    if (sortEl) {
      const saved = sessionStorage.getItem(SORT_STORAGE_KEY);
      if (saved && sortEl.querySelector(`option[value="${saved}"]`)) {
        sortEl.value = saved;
      }
      sortEl.addEventListener("change", () => {
        sessionStorage.setItem(SORT_STORAGE_KEY, sortEl.value);
        const list = document.getElementById("jobsList");
        if (list && currentJobs.length) renderJobs(list, currentJobs, currentFilters);
      });
    }
  }

  function renderErrorState(container) {
    container.innerHTML = `
      <div class="jobs-empty">
        <p class="jobs-empty__title">Could not load jobs</p>
        <p class="jobs-empty__text">Server error — please try again in a moment.</p>
        <div class="jobs-empty__actions">
          <button type="button" class="jobs-btn jobs-btn--primary" onclick="location.reload()">Retry</button>
        </div>
      </div>
    `;
  }

  async function initJobsPage() {
    const list = document.getElementById("jobsList");
    if (!list) return;

    currentFilters = getQueryFilters();
    renderSkeleton(list);
    updatePageChrome(currentFilters);
    bindToolbarActions(currentFilters);

    const result = await loadJobsData(currentFilters);
    const jobsData = Array.isArray(result.jobs) ? result.jobs : [];
    const totalCount = Number(result.pagination?.total) ?? jobsData.length;

    currentJobs = jobsData;
    currentPagination = result.pagination;
    renderSummary(currentFilters, totalCount, result.pagination);
    renderPagination(result.pagination);

    if (!result.ok) {
      renderErrorState(list);
      return;
    }

    renderJobs(list, jobsData, currentFilters);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJobsPage);
  } else {
    initJobsPage();
  }
})();
