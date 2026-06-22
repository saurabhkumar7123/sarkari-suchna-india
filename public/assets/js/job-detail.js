(function () {
  "use strict";

  function getJobIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function renderNotFound(container) {
    container.innerHTML = '<p class="job-not-found">Job not found</p>';
  }

  function formatLastDateDisplay(lastDate) {
    if (!lastDate) return null;
    const m = String(lastDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function isLatestJobStatus(status) {
    const s = String(status || "").trim().toLowerCase();
    return s === "latest job" || s === "new form";
  }

  function renderJob(container, job) {
    const formattedLastDate = formatLastDateDisplay(job.lastDate);
    container.innerHTML = `
      <article class="job-detail-card">
        <h1 class="job-detail-title">${job.title}</h1>
        <ul class="job-detail-list">
          <li class="job-detail-item"><span class="job-detail-label">Department:</span><span>${job.department}</span></li>
          <li class="job-detail-item"><span class="job-detail-label">Qualification:</span><span>${job.qualification}</span></li>
          <li class="job-detail-item"><span class="job-detail-label">State:</span><span>${job.state}</span></li>
          <li class="job-detail-item"><span class="job-detail-label">Job Type:</span><span>${job.jobType}</span></li>
          <li class="job-detail-item"><span class="job-detail-label">Status:</span><span>${job.status}</span></li>
          ${
            isLatestJobStatus(job.status) && formattedLastDate
              ? `<li class="job-detail-item"><span class="job-detail-label">Last Date:</span><span class="job-last-date-badge">${formattedLastDate}</span></li>`
              : ""
          }
        </ul>
      </article>
    `;
  }

  async function loadJob(jobId) {
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  async function initJobDetailPage() {
    const container = document.getElementById("jobDetailContainer");
    if (!container) return;

    const jobId = getJobIdFromQuery();
    if (!jobId) {
      renderNotFound(container);
      return;
    }

    const job = await loadJob(jobId);
    if (!job) {
      renderNotFound(container);
      return;
    }

    renderJob(container, job);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJobDetailPage);
  } else {
    initJobDetailPage();
  }
})();
