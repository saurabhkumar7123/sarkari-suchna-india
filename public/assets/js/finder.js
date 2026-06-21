const FINDER_FRAGMENT_VERSION = "4";
const FINDER_FRAGMENT_URL = `/static/finder.html?v=${FINDER_FRAGMENT_VERSION}`;

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

function updateFinderSelectAppearance() {
  const els = getFinderFormEls();
  if (!els) return;
  [els.qualification, els.state, els.department].forEach((sel) => {
    if (!sel) return;
    sel.classList.toggle("finder-input--empty", !String(sel.value || "").trim());
    const trigger = sel.parentElement?.querySelector(".finder-select-trigger");
    if (trigger) syncFinderSelectTrigger(trigger, sel);
  });
}

let finderPickerActiveTrigger = null;

function syncFinderSelectTrigger(trigger, select) {
  const option = select.options[select.selectedIndex];
  trigger.textContent = option ? option.textContent : "";
  trigger.classList.toggle("finder-input--empty", !String(select.value || "").trim());
}

function ensureFinderPickerSheet() {
  if (document.getElementById("finderPickerSheet")) return;

  const sheet = document.createElement("div");
  sheet.id = "finderPickerSheet";
  sheet.className = "finder-picker-sheet";
  sheet.setAttribute("aria-hidden", "true");
  sheet.innerHTML = `
    <div class="finder-picker-backdrop" data-finder-picker-close></div>
    <div class="finder-picker-panel" role="dialog" aria-modal="true" aria-labelledby="finderPickerTitle">
      <div class="finder-picker-handle" aria-hidden="true"></div>
      <div class="finder-picker-header">
        <p class="finder-picker-title" id="finderPickerTitle"></p>
        <button type="button" class="finder-picker-done" data-finder-picker-close>Done</button>
      </div>
      <ul class="finder-picker-list" role="listbox"></ul>
    </div>
  `;
  document.body.appendChild(sheet);

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-finder-picker-close]")) {
      closeFinderPickerSheet();
    }
  });
}

function closeFinderPickerSheet() {
  const sheet = document.getElementById("finderPickerSheet");
  if (!sheet) return;
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  if (finderPickerActiveTrigger) {
    finderPickerActiveTrigger.setAttribute("aria-expanded", "false");
    finderPickerActiveTrigger = null;
  }
}

function openFinderPickerSheet(select, trigger) {
  ensureFinderPickerSheet();
  const sheet = document.getElementById("finderPickerSheet");
  const title = sheet.querySelector(".finder-picker-title");
  const list = sheet.querySelector(".finder-picker-list");
  const fieldLabel = select.closest(".finder-field")?.querySelector(".finder-label")?.textContent?.trim();
  const placeholderOption = Array.from(select.options).find((opt) => !String(opt.value || "").trim());

  title.textContent = fieldLabel || "Select";
  list.innerHTML = "";

  Array.from(select.options).forEach((opt) => {
    const item = document.createElement("li");
    item.className = "finder-picker-option";
    item.setAttribute("role", "option");
    item.dataset.value = opt.value;
    item.textContent = opt.textContent;
    if (!String(opt.value || "").trim()) {
      item.classList.add("is-placeholder");
    }
    if (opt.value === select.value) {
      item.classList.add("is-selected");
      item.setAttribute("aria-selected", "true");
    }
    item.addEventListener("click", () => {
      select.value = opt.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncFinderSelectTrigger(trigger, select);
      closeFinderPickerSheet();
    });
    list.appendChild(item);
  });

  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");
  finderPickerActiveTrigger = trigger;

  const selected = list.querySelector(".finder-picker-option.is-selected") ||
    list.querySelector(".finder-picker-option.is-placeholder");
  if (selected) {
    selected.scrollIntoView({ block: "nearest" });
  }

  if (!select.value && placeholderOption) {
    title.textContent = placeholderOption.textContent.trim();
  }
}

function shouldUseFinderMobileSelects() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function enhanceFinderMobileSelects() {
  const els = getFinderFormEls();
  if (!els || !els.form || !shouldUseFinderMobileSelects()) return;
  if (els.form.dataset.mobileSelectsEnhanced === "1") return;
  els.form.dataset.mobileSelectsEnhanced = "1";

  ensureFinderPickerSheet();

  [els.qualification, els.department, els.state].forEach((select) => {
    if (!select || select.dataset.mobileEnhanced === "1") return;
    select.dataset.mobileEnhanced = "1";

    const field = select.closest(".finder-field");
    if (field) field.classList.add("finder-field--mobile-select");

    const wrap = document.createElement("div");
    wrap.className = "finder-select-wrap";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("finder-input-native");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "finder-select-trigger finder-input";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    syncFinderSelectTrigger(trigger, select);
    wrap.appendChild(trigger);

    trigger.addEventListener("click", () => {
      openFinderPickerSheet(select, trigger);
    });
  });
}

function updateFinderSubmitState() {
  const url = window.JobFinderUrl;
  const els = getFinderFormEls();
  if (!url || !els) return;

  updateFinderSelectAppearance();

  const state = readFinderFormState();
  const count = state ? url.countActiveFilters(state) : 0;
  const valid = count >= url.MIN_REQUIRED_FILTERS;

  if (els.submit) {
    els.submit.disabled = !valid;
    els.submit.setAttribute("aria-disabled", valid ? "false" : "true");
  }

  if (els.hint) {
    if (valid) {
      els.hint.textContent = `Ready — ${count} filters selected.`;
    } else if (count === 1) {
      els.hint.textContent = "1 more filter needed.";
    } else {
      els.hint.textContent = "Choose any 2 filters to find matching jobs.";
    }

    els.hint.classList.toggle("finder-hint--ok", valid);
    els.hint.classList.toggle("finder-hint--pending", !valid && count === 1);
    els.hint.classList.toggle("finder-hint--neutral", !valid && count === 0);
    els.hint.classList.toggle("finder-hint--warn", false);
  }
}

function bindFinderFormValidation() {
  const els = getFinderFormEls();
  if (!els || !els.form || els.form.dataset.validationBound === "1") return;
  els.form.dataset.validationBound = "1";

  els.form.addEventListener("change", updateFinderSubmitState);
  els.form.addEventListener("input", updateFinderSubmitState);
  enhanceFinderMobileSelects();
  updateFinderSubmitState();
}

function applyFinderFilters(filters) {
  const url = window.JobFinderUrl;
  const els = getFinderFormEls();
  if (!url || !els) return;

  const validated = url.validateState(filters || {});
  if (els.qualification) {
    els.qualification.value = validated.qualification || "";
  }
  if (els.state) {
    els.state.value = validated.state || "";
  }
  if (els.department) {
    els.department.value = validated.department || "";
  }
  updateFinderSubmitState();
}

function setFinderTriggerExpanded(expanded) {
  const t = document.getElementById("openFinder");
  if (t) t.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function closeFinder() {
  closeFinderPickerSheet();
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

    const needLoad =
      !box.innerHTML.trim() || box.dataset.finderVersion !== FINDER_FRAGMENT_VERSION;

    if (needLoad) {
      try {
        const res = await fetch(FINDER_FRAGMENT_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        box.innerHTML = await res.text();
        box.dataset.finderVersion = FINDER_FRAGMENT_VERSION;
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
    if (window.matchMedia("(max-width: 768px)").matches) {
      window.scrollTo(0, 0);
    }
  } catch (e) {
    console.error("[JobFinder] openFinder error", e);
  }
}

window.openFinder = openFinder;

async function openFinderWithFilters(filters) {
  await openFinder();
  applyFinderFilters(filters);
}

window.openFinderWithFilters = openFinderWithFilters;

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
    const picker = document.getElementById("finderPickerSheet");
    if (picker && picker.classList.contains("is-open")) {
      e.preventDefault();
      closeFinderPickerSheet();
      return;
    }
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
