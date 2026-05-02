const FINDER_FRAGMENT_URL = "/static/finder.html";

function getFinderModalEls() {
  return {
    modal: document.getElementById("jobFinderModal"),
    box: document.getElementById("jobFinderBox"),
  };
}

function setFinderTriggerExpanded(expanded) {
  const t = document.getElementById("openFinder");
  if (t) t.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function closeFinder() {
  const { modal } = getFinderModalEls();
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("finder-modal-open");
  setFinderTriggerExpanded(false);
}

window.closeFinder = closeFinder;

async function openFinder() {
  try {
    const { modal, box } = getFinderModalEls();
    if (!modal || !box) {
      console.error("[JobFinder] jobFinderModal or jobFinderBox missing");
      return;
    }

    if (!box.innerHTML.trim()) {
      try {
        const res = await fetch(FINDER_FRAGMENT_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        box.innerHTML = await res.text();
        ensureFinderHostDelegation();
      } catch (err) {
        console.error("[JobFinder] load failed", err);
        box.innerHTML =
          `<div class="finder-load-error" role="alert">Job Finder load failed. Please refresh and try again.</div>`;
      }
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("finder-modal-open");
    setFinderTriggerExpanded(true);
    console.log("[JobFinder] modal opened");
  } catch (e) {
    console.error("[JobFinder] openFinder error", e);
  }
}

window.openFinder = openFinder;

function ensureFinderHostDelegation() {
  const host = document.getElementById("jobFinderBox");
  if (!host || host.dataset.bound === "1") return;
  host.dataset.bound = "1";

  host.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest(".finder-close")) {
      e.preventDefault();
      closeFinder();
    }
  });

  host.addEventListener("submit", (e) => {
    const form = e.target.closest("form");
    if (!form) return;
    e.preventDefault();
    runFinder();
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#openFinder");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  openFinder();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("jobFinderModal");
    if (modal && modal.classList.contains("active")) {
      e.preventDefault();
      closeFinder();
    }
    return;
  }
  const el = e.target;
  if (el && el.id === "openFinder" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openFinder();
  }
});

document.addEventListener("click", (e) => {
  const modal = document.getElementById("jobFinderModal");
  if (!modal || !modal.classList.contains("active")) return;
  if (e.target === modal) closeFinder();
});

function normalizeFinderStateForJobs(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeFinderValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Finder submit -> redirect to jobs page with query params.
 * Keeps UI unchanged, only connects finder with /jobs.html.
 */
function runFinder() {
  const qualification = normalizeFinderValue(document.getElementById("finderQualification")?.value);
  const state = normalizeFinderStateForJobs(document.getElementById("finderState")?.value);
  const department = normalizeFinderValue(document.getElementById("finderDepartment")?.value);

  console.log("[JobFinder] selected values", {
    qualification,
    state,
    department
  });

  const params = new URLSearchParams();
  if (qualification) params.set("qualification", qualification);
  if (state) params.set("state", state);
  if (department) params.set("department", department);
  params.set("source", "finder");

  const query = params.toString();
  const target = query ? `/jobs.html?${query}` : "/jobs.html";
  window.location.href = target;
}

