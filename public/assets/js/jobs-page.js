(function () {
  "use strict";
  const DEFAULT_LIMIT = 10;

  function normalizeFilterValue(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getQueryFilters() {
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

  /**
   * Status match for Last Date row: lowercase, trim, collapse spaces (handles "New Form", "new  form").
   */
  function normalizeJobStatus(status) {
    return String(status ?? "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  /**
   * API lastDate is YYYY-MM-DD. DD/MM/YYYY via slice + split only (no Date parsing).
   */
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

  function renderJobs(container, jobs) {
    if (!jobs.length) {
      container.innerHTML = '<p class="jobs-empty">No jobs found</p>';
      return;
    }

    container.innerHTML = jobs
      .map(
        (job) => {
          console.log("JOB:", job.title, job.status, job.lastDate);
          const normalizedStatus = normalizeJobStatus(job.status);
          const lastDateOk =
            typeof job.lastDate === "string" && job.lastDate.length >= 10;
          const formattedDate = lastDateOk ? formatLastDateDdMmYyyy(job.lastDate) : null;
          const showLastDate = normalizedStatus === "new form" && formattedDate != null;
          return `
      <article class="job-card">
        <div class="job-card-head job-title-box">
          <h3 class="job-title">
            <a class="job-title-link" href="${safeUrl(job.page || "#")}">${job.title}</a>
          </h3>
        </div>
        <p class="job-meta">
          <span>${titleCase(job.department || "General")}</span>
          <span class="job-meta-sep">•</span>
          <span>${titleCase(job.state || "All India")}</span>
        </p>
        ${
          showLastDate
            ? `<p class="job-date"><span class="job-last-date-badge"> Apply Last Date: ${formattedDate}</span></p>`
            : ""
        }
      </article>
    `;
        }
      )
      .join("");
  }

  function renderSummary(filters, totalCount) {
    const countEl = document.getElementById("jobsCount");
    const activeEl = document.getElementById("jobsActiveFilters");
    if (!countEl || !activeEl) return;

    countEl.textContent = `${totalCount} Jobs Found`;

    const parts = [];
    if (filters.qualification) parts.push(titleCase(filters.qualification));
    if (filters.state) parts.push(titleCase(filters.state));
    if (filters.department) parts.push(titleCase(filters.department));
    if (filters.jobType) parts.push(titleCase(filters.jobType));
    if (filters.status) parts.push(titleCase(filters.status));

    activeEl.textContent = parts.length
      ? `Showing: ${parts.join(" | ")}`
      : "Showing: All";
  }

  function buildJobsApiUrl(filters) {
    const { page, limit } = getPaginationQuery();
    const params = new URLSearchParams();
    if (filters.qualification) params.set("qualification", filters.qualification);
    if (filters.state) params.set("state", filters.state);
    if (filters.department) params.set("department", filters.department);
    if (filters.jobType) params.set("jobType", filters.jobType);
    if (filters.status) params.set("status", filters.status);
    if (filters.source === "finder") params.set("source", "finder");
    params.set("page", String(page));
    params.set("limit", String(limit));
    const query = params.toString();
    return query ? `/api/jobs?${query}` : "/api/jobs";
  }

  function renderPagination(meta) {
    const host = document.getElementById("jobsPagination");
    if (!host) return;
    const currentPage = Math.max(1, Number(meta?.currentPage) || 1);
    const totalPages = Math.max(0, Number(meta?.totalPages) || 0);

    if (totalPages <= 1) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = `
      <button type="button" id="jobsPrevBtn" ${currentPage <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button type="button" id="jobsNextBtn" ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
    `;

    const prevBtn = document.getElementById("jobsPrevBtn");
    const nextBtn = document.getElementById("jobsNextBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => updatePageInUrl(currentPage - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => updatePageInUrl(currentPage + 1));
    }
  }

  function updatePageInUrl(page) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(Math.max(1, page)));
    if (!params.get("limit")) params.set("limit", String(DEFAULT_LIMIT));
    window.location.search = params.toString();
  }

  async function loadJobsData(filters) {
    const apiUrl = buildJobsApiUrl(filters);
    console.log("[JobsPage] selected values", {
      qualification: filters.qualification,
      state: filters.state,
      department: filters.department
    });
    console.log("[JobsPage] API request payload", {
      url: apiUrl,
      payload: {
        qualification: filters.qualification,
        state: filters.state,
        department: filters.department,
        jobType: filters.jobType,
        status: filters.status,
        ...getPaginationQuery()
      }
    });
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[JobsPage] API response data", data);
      if (Array.isArray(data?.jobs)) {
        console.log("[JobsPage] API lastDate verification", data.jobs.slice(0, 12).map((job) => ({
          title: job.title,
          status: job.status,
          lastDate: job.lastDate
        })));
        console.log("[JobsPage] formatted lastDate verification", data.jobs.slice(0, 12).map((job) => ({
          title: job.title,
          status: job.status,
          normalizedStatus: normalizeJobStatus(job.status),
          apiLastDate: job.lastDate,
          formattedLastDate: formatLastDateDdMmYyyy(
            typeof job.lastDate === "string" && job.lastDate.length >= 10 ? job.lastDate : ""
          )
        })));
      }
      if (Array.isArray(data)) return { ok: true, jobs: data, pagination: null };
      if (Array.isArray(data?.jobs)) return { ok: true, jobs: data.jobs, pagination: data.pagination || null };
      throw new Error("Invalid jobs payload");
    } catch (error) {
      console.error("[JobsPage] jobs load failed", error);
      return { ok: false, jobs: [], pagination: null };
    }
  }

  async function initJobsPage() {
    const list = document.getElementById("jobsList");
    if (!list) return;

    list.innerHTML = '<p class="jobs-empty">Loading jobs...</p>';

    const filters = getQueryFilters();
    const result = await loadJobsData(filters);
    const jobsData = Array.isArray(result.jobs) ? result.jobs : [];
    const totalCount = Number(result.pagination?.total) || jobsData.length;
    renderSummary(filters, totalCount);
    renderPagination(result.pagination);

    if (!result.ok) {
      list.innerHTML = '<p class="jobs-empty">Server error, please try again</p>';
      return;
    }

    if (!jobsData.length) {
      list.innerHTML = '<p class="jobs-empty">No jobs found</p>';
      return;
    }

    console.log("[JobsPage] rendering jobs", {
      count: jobsData.length,
      sample: jobsData.slice(0, 5).map((job) => ({
        title: job.title,
        qualification: normalizeFilterValue(job.qualification),
        state: normalizeFilterValue(job.state),
        department: normalizeFilterValue(job.department)
      }))
    });
    renderJobs(list, jobsData);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJobsPage);
  } else {
    initJobsPage();
  }
})();
