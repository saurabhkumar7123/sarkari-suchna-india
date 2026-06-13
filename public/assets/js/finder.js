const FINDER_FRAGMENT_URL = "/static/finder.html";

function getFinderModalEls() {
  return {
    modal: document.getElementById("jobFinderModal"),
    box: document.getElementById("jobFinderBox")
  };
}

function getFinderFormEls() {
  const box = document.getElementById("jobFinderBox");
  if (!box) return null;
  return {
    box,
    form: box.querySelector("#finderForm"),
    qualification: box.querySelector("#finderQualification"),
    state: box.querySelector("#finderState"),
    department: box.querySelector("#finderDepartment"),
    submit: box.querySelector("#finderBtn"),
    hint: box.querySelector("#finderHint")
  };
}

function readFinderFormState() {
  const els = getFinderFormEls();
  const url = window.JobFinderUrl;
  if (!els || !url) return null;
  return url.readFromInputs({
    qualification: els.qualification && els.qualification.value,
    state: els.state && els.state.value,
    department: els.department && els.department.value
  });
}

function updateFinderSubmitState() {
  const url = window.JobFinderUrl;
  const els = getFinderFormEls();
  if (!url || !els) return;

  const state = readFinderFormState();
  const count = state ? url.countActiveFilters(state) : 0;
  const valid = count >= url.MIN_REQUIRED_FILTERS;

  if (els.submit) {
    els.submit.disabled = !valid;
    els.submit.setAttribute("aria-disabled", valid ? "false" : "true");
  }

  if (els.hint) {
    els.hint.textContent = valid
      ? `${count} filters selected — ready to search.`
      : `Select at least ${url.MIN_REQUIRED_FILTERS} filters to search (${count}/${url.MIN_REQUIRED_FILTERS} selected).`;
    els.hint.classList.toggle("finder-hint--ok", valid);
    els.hint.classList.toggle("finder-hint--warn", !valid);
  }
}

function bindFinderFormValidation() {
  const els = getFinderFormEls();
  if (!els || !els.form || els.form.dataset.validationBound === "1") return;
  els.form.dataset.validationBound = "1";

  els.form.addEventListener("change", updateFinderSubmitState);
  els.form.addEventListener("input", updateFinderSubmitState);
  updateFinderSubmitState();
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
        bindFinderFormValidation();
      } catch (err) {
        console.error("[JobFinder] load failed", err);
        box.innerHTML =
          '<div class="finder-load-error" role="alert">Job Finder load failed. Please refresh and try again.</div>';
      }
    } else {
      bindFinderFormValidation();
      updateFinderSubmitState();
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("finder-modal-open");
    setFinderTriggerExpanded(true);
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

/**
 * Finder submit → jobs page with validated filter query params.
 * Requires minimum 2 filters; URL built from JobFinderUrl (no bare ?source=finder).
 */
function runFinder() {
  const url = window.JobFinderUrl;
  if (!url) {
    console.error("[JobFinder] JobFinderUrl module missing");
    return;
  }

  const raw = readFinderFormState();
  if (!raw) {
    console.error("[JobFinder] form elements not found inside #jobFinderBox");
    return;
  }

  const validated = url.validateState(raw);
  const activeCount = url.countActiveFilters(validated);

  if (activeCount < url.MIN_REQUIRED_FILTERS) {
    updateFinderSubmitState();
    return;
  }

  const target = url.buildJobsPagePath(validated);
  console.log("[JobFinder] navigate", { filters: validated, target });
  window.location.href = target;
}
