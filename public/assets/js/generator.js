const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");
const contentImportId = params.get("importId");

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getActionBtnLabel(btn) {
  if (!btn) return "";
  const mobile = btn.querySelector(".action-btn__label--mobile");
  const desktop = btn.querySelector(".action-btn__label--desktop");
  if (window.matchMedia("(max-width: 768px)").matches && mobile) {
    return mobile.textContent.trim();
  }
  if (desktop) return desktop.textContent.trim();
  const any = btn.querySelector(".action-btn__label");
  if (any) return any.textContent.trim();
  return btn.textContent.trim();
}

function setActionBtnLabel(btn, text) {
  if (!btn) return;
  const labels = btn.querySelectorAll(".action-btn__label");
  if (labels.length) {
    labels.forEach((el) => {
      el.textContent = text;
    });
    return;
  }
  btn.textContent = text;
}

function restoreActionBtnLabels(btn) {
  if (!btn) return;
  const desktop = btn.querySelector(".action-btn__label--desktop");
  const mobile = btn.querySelector(".action-btn__label--mobile");
  if (desktop && btn.dataset.labelDesktop) desktop.textContent = btn.dataset.labelDesktop;
  if (mobile && btn.dataset.labelMobile) mobile.textContent = btn.dataset.labelMobile;
  if (!desktop && !mobile) {
    const fallback = btn.dataset.labelDesktop || btn.dataset.labelMobile;
    if (fallback) setActionBtnLabel(btn, fallback);
  }
}

function setDeleteButtonVisible(visible) {
  const delBtn = document.getElementById("deleteBtn");
  if (delBtn) delBtn.classList.toggle("is-hidden", !visible);
}

function setPageUrlLocked(locked) {
  const url = document.getElementById("pageUrl");
  const modeBadge = document.getElementById("generatorModeBadge");
  const modeHint = document.getElementById("urlModeHint");
  if (!url) return;
  url.readOnly = !!locked;
  url.setAttribute("aria-readonly", locked ? "true" : "false");
  url.title = locked
    ? "URL slug cannot be changed after publish. Delete (→ Trash) and create a new page for a new URL."
    : "";
  if (modeBadge) {
    modeBadge.classList.toggle("is-edit", !!locked);
    modeBadge.classList.toggle("is-create", !locked);
    modeBadge.textContent = locked ? "Edit Mode - URL locked" : "Create Mode - URL editable";
  }
  if (modeHint) {
    modeHint.textContent = locked
      ? "Edit mode: URL is locked to prevent broken links."
      : "Create mode: URL can be edited before first save.";
  }
}

function setGeneratorFeedback(type, message, options = {}) {
  const box = document.getElementById("result");
  if (!box) return;
  const safeType = String(type || "info").toLowerCase();
  const colorMap = {
    success: { bg: "#ecfdf5", border: "#bbf7d0", text: "#065f46" },
    error: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" }
  };
  const palette = colorMap[safeType] || colorMap.info;
  const details = options.detailsHtml ? `<div class="feedback-details">${options.detailsHtml}</div>` : "";
  box.style.display = "block";
  box.style.background = palette.bg;
  box.style.borderColor = palette.border;
  box.style.color = palette.text;
  box.innerHTML = `<strong>${String(message || "").trim()}</strong>${details}`;
  if (safeType === "error") bumpAdminMetric("actionsFailed");
}

let allPages = [];
let pagesLoaded = false;
let recentPages = JSON.parse(localStorage.getItem("recentPages") || "[]");
let categoryTags = [];
let eventDate = "";
let eventTime = "";

function parseEventDateTimeValue(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return { date: "", time: "" };
  const [date = "", time = ""] = raw.replace(" ", "T").split("T");
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    time: /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : ""
  };
}

function syncEventDateTimeState(rawValue) {
  console.log("RAW INPUT:", String(rawValue || ""));
  const parsed = parseEventDateTimeValue(rawValue);
  eventDate = parsed.date;
  eventTime = parsed.time;
  const eventDateTime = eventDate && eventTime ? `${eventDate}T${eventTime}` : "";
  console.log("Date:", eventDate);
  console.log("Time:", eventTime);
  console.log("FINAL SENT:", eventDateTime);
  return eventDateTime;
}

function setEventTimeInputValue(rawValue) {
  const input = document.getElementById("eventTime");
  const normalized = syncEventDateTimeState(rawValue);
  if (input) input.value = normalized;
}

// ================= SAFE FETCH =================
/** Always resolves: use .ok / .status / .body (JSON or text). */
async function safeFetch(url, options = {}) {
  try {
    const hdrs = { ...(options.headers || {}) };
    if (String(url).includes("/api/admin") && typeof window.getAdminCsrfToken === "function") {
      try {
        hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
      } catch (err) {
        console.error("[CSRF]", err);
      }
    }
    if (typeof options.body === "string" && !hdrs["Content-Type"]) {
      hdrs["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: hdrs
    });
    const status = res.status;
    const ct = res.headers.get("content-type") || "";
    let body = null;
    if (ct.includes("application/json")) {
      try {
        body = await res.json();
      } catch (e) {
        console.error("[safeFetch] JSON parse error", url, e);
        body = null;
      }
    } else if (options.parse === "text") {
      body = await res.text();
    } else {
      body = await res.text();
    }
    if (!res.ok) {
      console.error("API error:", status, url, body);
    }
    return { ok: res.ok, status, body };
  } catch (err) {
    console.error("Fetch error:", err);
    return { ok: false, status: 0, body: null, networkError: err && err.message ? String(err.message) : "network" };
  }
}

const DRAFT_STORAGE_KEY = "generatorDraft_v1";
const ADMIN_METRICS_KEY = "adminUxMetrics_v1";

function readAdminUxMetrics() {
  try {
    const raw = localStorage.getItem(ADMIN_METRICS_KEY);
    if (!raw) return { publishesSuccess: 0, actionsFailed: 0 };
    const parsed = JSON.parse(raw);
    return {
      publishesSuccess: Number(parsed && parsed.publishesSuccess) || 0,
      actionsFailed: Number(parsed && parsed.actionsFailed) || 0
    };
  } catch {
    return { publishesSuccess: 0, actionsFailed: 0 };
  }
}

function writeAdminUxMetrics(next) {
  try {
    localStorage.setItem(
      ADMIN_METRICS_KEY,
      JSON.stringify({
        publishesSuccess: Math.max(0, Number(next && next.publishesSuccess) || 0),
        actionsFailed: Math.max(0, Number(next && next.actionsFailed) || 0)
      })
    );
  } catch {
    // ignore
  }
}

function bumpAdminMetric(key) {
  const current = readAdminUxMetrics();
  current[key] = (Number(current[key]) || 0) + 1;
  writeAdminUxMetrics(current);
}

function setInlineFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}Error`);
  const input = document.getElementById(fieldId);
  if (errorEl) errorEl.textContent = String(message || "").trim();
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateFieldNow(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return true;
  const val = String(el.value || "").trim();
  if (fieldId === "title") {
    if (!val || val.length < 5) {
      setInlineFieldError("title", "Minimum 5 characters required.");
      return false;
    }
    setInlineFieldError("title", "");
    return true;
  }
  if (fieldId === "pageUrl") {
    const oldSlug = String(document.getElementById("oldSlug")?.value || "").trim();
    if (!oldSlug) {
      setInlineFieldError("pageUrl", "");
      return true;
    }
    if (!val || !/^\/?[a-z0-9-]+(\.html)?$/i.test(val)) {
      setInlineFieldError("pageUrl", "Edit mode: keep existing URL format.");
      return false;
    }
    setInlineFieldError("pageUrl", "");
    return true;
  }
  if (fieldId === "lastDate") {
    if (val && !isValidLastDateInput(val)) {
      setInlineFieldError("lastDate", "Use valid DD/MM/YYYY or YYYY-MM-DD.");
      return false;
    }
    setInlineFieldError("lastDate", "");
    return true;
  }
  return true;
}

function updateBreakingOrderVisibility() {
  const breaking = document.getElementById("breaking");
  const group = document.getElementById("breakingOrderGroup");
  const card = document.getElementById("breakingToggleCard");
  const input = document.getElementById("breakingOrder");
  if (!breaking || !group || !input) return;
  const enabled = !!breaking.checked;
  group.style.opacity = enabled ? "1" : ".55";
  if (card) card.classList.toggle("is-disabled", !enabled);
  input.disabled = !enabled;
  if (!enabled) input.value = "";
}

let smallBoxSlotOccupancy = {};

function isDesktopOnlySmallBoxSlot(slot) {
  const n = Number(slot);
  return Number.isInteger(n) && n >= 7 && n <= 8;
}

function defaultSmallBoxSlotHint() {
  return "Desktop shows 8 boxes (4×2). Mobile shows slots 1–6 only (3×2). Slots 7–8 are desktop only. Choosing a slot replaces the current occupant.";
}

function setSmallBoxSlotFormValue(slot) {
  const el = document.getElementById("smallBoxSlot");
  if (!el) return;
  if (slot == null || slot === "" || slot === "normal") {
    el.value = "";
  } else {
    el.value = String(slot);
  }
  updateSmallBoxSlotHint();
}

async function loadSmallBoxSlotOccupancy() {
  try {
    const res = await fetch("/api/admin/small-box-slots", { credentials: "include" });
    if (!res.ok) return;
    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];
    smallBoxSlotOccupancy = {};
    rows.forEach((row) => {
      if (row && row.slot != null) {
        smallBoxSlotOccupancy[String(row.slot)] = row.title || row.slug || "";
      }
    });
    updateSmallBoxSlotHint();
  } catch (err) {
    console.warn("small box slot occupancy load failed", err);
  }
}

function updateSmallBoxSlotHint() {
  const hint = document.getElementById("smallBoxSlotHint");
  const select = document.getElementById("smallBoxSlot");
  if (!hint || !select) return;
  const slot = select.value;
  if (!slot) {
    hint.textContent = defaultSmallBoxSlotHint();
    return;
  }
  const occupant = smallBoxSlotOccupancy[slot];
  const currentSlug = (document.getElementById("oldSlug")?.value || "").trim();
  const currentTitle = (document.getElementById("title")?.value || "").trim();
  const isSelf =
    occupant &&
    currentTitle &&
    String(occupant).trim().toLowerCase() === currentTitle.trim().toLowerCase();
  if (occupant && !isSelf) {
    hint.textContent = `Slot ${slot} is currently: ${occupant}. Saving will move it to Normal.`;
  } else if (isDesktopOnlySmallBoxSlot(slot)) {
    hint.textContent = `Slot ${slot} is desktop only (hidden on mobile).`;
  } else {
    hint.textContent = `Slot ${slot} will appear in homepage small boxes.`;
  }
}

/**
 * Merge server/AI output into #data without wiping good text with empty/short junk.
 * If textarea was empty, allow shorter pasted/extract content (≥1 non-whitespace).
 */
function safeSet(el, val) {
  if (!el) return "";
  const prev = String(el.value ?? "").trim();
  const next = typeof val === "string" ? val.trim() : "";
  if (!next) return prev;
  if (!prev) return next;
  if (next.length < 20) return prev;
  return next;
}

function setDataFromServer(el, val) {
  if (!el) return;
  const next = typeof val === "string" ? val.trim() : "";
  if (!next) {
    console.error("[PDF extract] Refusing to set #data — empty text from API");
    return;
  }
  el.value = next;
}

let aiConvertInProgress = false;

function normalizeSlugKey(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.html$/i, "")
    .toLowerCase();
}

function normalizeTagValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function syncCategoryHiddenInput() {
  const hidden = document.getElementById("category");
  if (!hidden) return;
  hidden.value = categoryTags.join(", ");
}

function renderCategoryTags() {
  const host = document.getElementById("tagChips");
  if (!host) return;
  host.innerHTML = "";
  categoryTags.forEach((tag) => {
    const pill = document.createElement("span");
    pill.className = "tag-chip";
    pill.textContent = tag;

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "tag-chip-remove";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${tag}`);
    rm.addEventListener("click", () => {
      categoryTags = categoryTags.filter((t) => t !== tag);
      renderCategoryTags();
      syncCategoryHiddenInput();
    });

    pill.appendChild(rm);
    host.appendChild(pill);
  });
}

function setCategoryTagsFromString(value) {
  categoryTags = Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map(normalizeTagValue)
        .filter(Boolean)
    )
  );
  renderCategoryTags();
  syncCategoryHiddenInput();
}

function setupCategoryTagInput() {
  const input = document.getElementById("categoryTagInput");
  const hidden = document.getElementById("category");
  if (!input || !hidden) return;

  setCategoryTagsFromString(hidden.value || "");

  const commitInputTag = () => {
    const v = normalizeTagValue(input.value);
    if (!v) return;
    if (!categoryTags.includes(v)) {
      categoryTags.push(v);
      renderCategoryTags();
      syncCategoryHiddenInput();
    }
    input.value = "";
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInputTag();
    }
    if (e.key === "Backspace" && !input.value && categoryTags.length) {
      categoryTags.pop();
      renderCategoryTags();
      syncCategoryHiddenInput();
    }
  });

  input.addEventListener("blur", commitInputTag);
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.setItem("generatorPendingDrafts", "0");
  } catch {
    // ignore
  }
}

function resetGeneratorForm() {
  if (aiConvertInProgress) return;
  const setVal = (id, val = "") => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal("title", "");
  setVal("post_name", "");
  setVal("total_posts", "");
  setVal("data", "");
  setVal("status", "");
  setVal("customStatus", "");
  setVal("category", "");
  setVal("structuredQualification", "");
  setVal("structuredState", "");
  setVal("structuredDepartment", "");
  setVal("pageUrl", "");
  setVal("pageId", "");
  setVal("oldSlug", "");
  setVal("breakingOrder", "");
  setEventTimeInputValue("");
  setVal("lastDate", "");
  setSmallBoxSlotFormValue("");
  const breaking = document.getElementById("breaking");
  if (breaking) breaking.checked = false;
  setDeleteButtonVisible(false);
  const frame = document.getElementById("previewFrame");
  if (frame) frame.srcdoc = "";
  setPageUrlLocked(false);
  updateSlugPreview();
  syncAiConvertButton();
  setCategoryTagsFromString("");
  applyBadgesToForm([]);
  updateEditorStats();
  updateBreakingOrderVisibility();
}

function createSlugFromTitle(title) {
  return String(title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function updateSlugPreview() {
  const el = document.getElementById("slugPreview");
  const title = document.getElementById("title");
  if (!el || !title) return;
  const oldSlug = (document.getElementById("oldSlug") && document.getElementById("oldSlug").value.trim()) || "";
  if (oldSlug) {
    el.textContent = oldSlug;
    return;
  }
  const s = createSlugFromTitle(title.value);
  el.textContent = s || "—";
}

function saveDraftToStorage() {
  try {
    const oldSlugValue = normalizeSlugKey(document.getElementById("oldSlug")?.value || "");
    const pageIdValue = String(document.getElementById("pageId")?.value || "").trim();
    const payload = {
      scope: oldSlugValue || pageIdValue ? "edit" : "new",
      oldSlug: oldSlugValue,
      pageId: pageIdValue,
      title: document.getElementById("title") && document.getElementById("title").value,
      post_name: document.getElementById("post_name") && document.getElementById("post_name").value,
      total_posts: document.getElementById("total_posts") && document.getElementById("total_posts").value,
      data: document.getElementById("data") && document.getElementById("data").value,
      status: document.getElementById("status") && document.getElementById("status").value,
      customStatus: document.getElementById("customStatus") && document.getElementById("customStatus").value,
      category: document.getElementById("category") && document.getElementById("category").value,
      structuredQualification:
        document.getElementById("structuredQualification") &&
        document.getElementById("structuredQualification").value,
      structuredState: document.getElementById("structuredState") && document.getElementById("structuredState").value,
      structuredDepartment:
        document.getElementById("structuredDepartment") &&
        document.getElementById("structuredDepartment").value,
      eventTime: document.getElementById("eventTime") && document.getElementById("eventTime").value,
      lastDate: document.getElementById("lastDate") && document.getElementById("lastDate").value,
      pageUrl: document.getElementById("pageUrl") && document.getElementById("pageUrl").value,
      badges: collectBadgesFromForm(),
      savedAt: Date.now()
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem("generatorPendingDrafts", "1");
  } catch (e) {
    console.warn("draft save failed", e);
  }
}

function restoreDraftFromStorage() {
  if (slug) return false;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return false;
    const draftScope = String(d.scope || "").toLowerCase();
    const draftOldSlug = normalizeSlugKey(d.oldSlug || "");
    if (!(draftScope === "new" && !draftOldSlug)) {
      clearDraftStorage();
      return false;
    }
    if (document.getElementById("title") && d.title) document.getElementById("title").value = d.title;
    if (document.getElementById("post_name") && d.post_name != null)
      document.getElementById("post_name").value = d.post_name;
    if (document.getElementById("total_posts") && d.total_posts != null)
      document.getElementById("total_posts").value = d.total_posts;
    if (document.getElementById("data") && d.data) document.getElementById("data").value = d.data;
    syncAiConvertButton();
    if (document.getElementById("category")) {
      document.getElementById("category").value = d.category || "";
      setCategoryTagsFromString(d.category || "");
    }
    setNormalizedSelectValue("structuredQualification", d.structuredQualification);
    setNormalizedSelectValue("structuredState", d.structuredState);
    setNormalizedSelectValue("structuredDepartment", d.structuredDepartment);
    setEventTimeInputValue(d.eventTime || "");
    if (document.getElementById("lastDate") && d.lastDate) document.getElementById("lastDate").value = d.lastDate;
    if (document.getElementById("pageUrl") && d.pageUrl) document.getElementById("pageUrl").value = d.pageUrl;
    if (d.customStatus && document.getElementById("customStatus")) {
      document.getElementById("customStatus").value = d.customStatus;
    }
    if (d.status && document.getElementById("status")) {
      document.getElementById("status").value = d.status;
    }
    applyStatusToForm(d.customStatus || d.status || "");
    applyBadgesToForm(d.badges);
    updateSlugPreview();
    return true;
  } catch (e) {
    console.warn("draft restore failed", e);
    clearDraftStorage();
    return false;
  }
}

setInterval(saveDraftToStorage, 5000);

window.addEventListener("DOMContentLoaded", async () => {
  const pdfExtractForm = document.getElementById("pdfExtractForm");
  if (pdfExtractForm) {
    pdfExtractForm.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  }
  setupPdfUploadUi();

  const dataTa = document.querySelector("#data");
  if (dataTa) {
    dataTa.addEventListener("input", () => {
      syncAiConvertButton();
      updateEditorStats();
      scheduleContentAnalysis();
    });
  }
  syncAiConvertButton();
  updateEditorStats();

  const t = document.getElementById("title");
  if (t) {
    t.addEventListener("input", () => {
      updateSlugPreview();
      validateFieldNow("title");
    });
  }
  const pu = document.getElementById("pageUrl");
  if (pu) {
    pu.addEventListener("input", () => {
      updateSlugPreview();
      validateFieldNow("pageUrl");
    });
  }
  const lastDateInput = document.getElementById("lastDate");
  if (lastDateInput) {
    lastDateInput.addEventListener("input", () => validateFieldNow("lastDate"));
  }
  const eventTimeInput = document.getElementById("eventTime");
  if (eventTimeInput) {
    const syncEventField = () => {
      const normalized = syncEventDateTimeState(eventTimeInput.value);
      if (eventTimeInput.value !== normalized) eventTimeInput.value = normalized;
    };
    eventTimeInput.addEventListener("input", syncEventField);
    eventTimeInput.addEventListener("change", syncEventField);
    syncEventField();
  }
  const breaking = document.getElementById("breaking");
  if (breaking) {
    breaking.addEventListener("change", updateBreakingOrderVisibility);
  }
  updateBreakingOrderVisibility();
  const smallBoxSlot = document.getElementById("smallBoxSlot");
  if (smallBoxSlot) {
    smallBoxSlot.addEventListener("change", updateSmallBoxSlotHint);
  }
  await loadSmallBoxSlotOccupancy();
  setupCategoryTagInput();
  setupBadgeCheckboxes();

  if (slug) {
    await loadPageFromURL();
    return;
  }

  const importLoaded = await loadContentImportFromURL();
  if (importLoaded) {
    scheduleContentAnalysis();
    return;
  }

  const restored = restoreDraftFromStorage();
  if (!restored) {
    resetGeneratorForm();
  }
  scheduleContentAnalysis();
});

function updateEditorStats() {
  const ta = document.getElementById("data");
  const wordsEl = document.getElementById("wordCount");
  const charsEl = document.getElementById("charCount");
  if (!ta) return;
  const text = String(ta.value || "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (wordsEl) wordsEl.textContent = `${words} words`;
  if (charsEl) charsEl.textContent = `${text.length} chars`;
}

function setEditorActionsBusy(busy) {
  const ids = ["savePageBtn", "aiConvertBtn", "previewBtn"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !!busy;
  });
}

const PREDEFINED_STATUSES = new Set([
  "latest job",
  "admit card",
  "result",
  "answer key",
  "document",
  "admission",
  "syllabus"
]);

function applyStatusToForm(raw) {
  const select = document.getElementById("status");
  const customIn = document.getElementById("customStatus");
  if (!select || !customIn) return;
  let s = String(raw ?? "").trim().toLowerCase();
  if (s === "new form") s = "latest job";
  if (PREDEFINED_STATUSES.has(s)) {
    select.value = s;
    customIn.value = "";
    return;
  }
  if (s && s !== "other") {
    select.value = "__custom__";
    customIn.value = String(raw).trim();
  } else {
    select.value = "";
    customIn.value = "";
  }
}

/** Sends raw selection to server; server normalizes to canonical DB value. */
function resolveStatusForSave() {
  const custom = document.getElementById("customStatus").value.trim();
  const sel = document.getElementById("status").value;
  if (custom) return custom;
  if (sel === "__custom__") return "";
  return sel.trim();
}

/** Phase 3: Manual homepage badges. Server whitelist enforces final values. */
const ALLOWED_BADGE_CODES = ["NEW", "OUT", "START", "SOON"];
const BADGE_CODE_ALIASES = { DECLARED: "OUT" };
const MAX_BADGES_PER_PAGE = 2;

function normalizeBadgeCodeForForm(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return "";
  return BADGE_CODE_ALIASES[c] || c;
}

function collectBadgesFromForm() {
  const boxes = document.querySelectorAll(".badge-checkbox");
  const out = [];
  const seen = new Set();
  boxes.forEach((box) => {
    if (!box.checked) return;
    const code = String(box.value || "").trim().toUpperCase();
    if (!code || seen.has(code)) return;
    if (!ALLOWED_BADGE_CODES.includes(code)) return;
    if (out.length >= MAX_BADGES_PER_PAGE) return;
    seen.add(code);
    out.push(code);
  });
  return out;
}

function syncBadgesHiddenInput() {
  const hidden = document.getElementById("badgesJson");
  if (!hidden) return;
  hidden.value = JSON.stringify(collectBadgesFromForm());
}

function applyBadgesToForm(value) {
  let arr = [];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  }
  const wanted = new Set(
    arr
      .map((c) => normalizeBadgeCodeForForm(c))
      .filter((c) => ALLOWED_BADGE_CODES.includes(c))
      .slice(0, MAX_BADGES_PER_PAGE)
  );
  document.querySelectorAll(".badge-checkbox").forEach((box) => {
    box.checked = wanted.has(String(box.value || "").trim().toUpperCase());
  });
  syncBadgesHiddenInput();
}

function enforceBadgesMaxLimit() {
  const boxes = Array.from(document.querySelectorAll(".badge-checkbox"));
  const checked = boxes.filter((b) => b.checked);
  if (checked.length > MAX_BADGES_PER_PAGE) {
    const overflow = checked.slice(MAX_BADGES_PER_PAGE);
    overflow.forEach((b) => (b.checked = false));
  }
  syncBadgesHiddenInput();
}

function setupBadgeCheckboxes() {
  document.querySelectorAll(".badge-checkbox").forEach((box) => {
    box.addEventListener("change", enforceBadgesMaxLimit);
  });
  syncBadgesHiddenInput();
}

function normalizeOptionalSelectValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function normalizeSelectKey(value) {
  return String(value || "").trim().toLowerCase();
}

/** Match server generator normalizeStatus: strip ZW*, NBSP → space, lower, collapse spaces. */
function normalizeClientStatus(raw) {
  return String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isLatestJobStatusValue(rawStatus) {
  const s = normalizeClientStatus(rawStatus);
  return s === "latest job" || s === "new form";
}

/** Matches server parseLastDateInputToIso: DD/MM/YYYY (flexible digits), YYYY-MM-DD, unicode slashes. */
function isValidLastDateInput(value) {
  let raw = String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!raw) return false;
  raw = raw.replace(/[\u2044\u2215\uff0f／]/g, "/");
  raw = raw.replace(/\./g, "/");
  raw = raw.replace(/\s+/g, "");

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  }

  const parts = raw.split("/");
  if (parts.length !== 3) return false;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** DD/MM/YYYY (or existing YYYY-MM-DD) → YYYY-MM-DD for `<input type="date">`. */
function lastDateDdMmYyyyToIso(value) {
  if (value == null || value === "") return "";
  const raw = String(value).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const norm = raw.replace(/[\u2044\u2215\uff0f／]/g, "/").replace(/\./g, "/").replace(/\s+/g, "");
  const parts = norm.split("/");
  if (parts.length !== 3) return "";
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function setNormalizedSelectValue(selectId, rawValue) {
  const select = document.getElementById(selectId);
  if (!select) return;

  let normalized = normalizeSelectKey(rawValue);
  if (selectId === "structuredState" && normalized === "all india") {
    normalized = "central";
  }
  if (!normalized) {
    select.value = "";
    return;
  }

  const matchingOption = Array.from(select.options).find(
    (option) => normalizeSelectKey(option.value) === normalized
  );
  select.value = matchingOption ? matchingOption.value : "";
}

// ================= LOAD PAGES =================
async function loadExistingPages() {
  try {
    const json = await safeFetch("/api/admin/pages?page=1&limit=100");
    allPages = json.ok && json.body && json.body.data ? json.body.data : [];
  } catch (err) {
    console.error("Pages load error:", err);
    allPages = [];
  } finally {
    pagesLoaded = true;
  }
}

loadExistingPages();

// ================= CONTENT IMPORT (CSV queue — #data only) =================
async function loadContentImportFromURL() {
  const importId = contentImportId || new URLSearchParams(window.location.search).get("importId");
  if (!importId) return false;

  try {
    const data = await safeFetch(
      "/api/admin/content-imports/" + encodeURIComponent(importId) + "?markOpened=1"
    );
    if (!data.ok || !data.body || !data.body.success || !data.body.data) {
      setGeneratorFeedback("error", "Could not load imported content", {
        detailsHtml: (data.body && data.body.message) || "Import not found or import queue unavailable."
      });
      return false;
    }

    const row = data.body.data;
    clearDraftStorage();
    resetGeneratorForm();
    const ta = document.getElementById("data");
    if (ta) ta.value = String(row.content || "");
    setPageUrlLocked(false);
    syncAiConvertButton();
    updateEditorStats();

    const src = row.sourceFile ? ` (${row.sourceFile})` : "";
    setGeneratorFeedback(
      "info",
      `Imported draft #${row.id}${src} — content only. Fill title, status, and other fields, then publish manually.`
    );
    return true;
  } catch (err) {
    console.error("Content import load error:", err);
    setGeneratorFeedback("error", "Failed to load imported content");
    return false;
  }
}

// ================= AUTO LOAD =================
async function loadPageFromURL(){

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if(!slug) return;

  try{
    const data = await safeFetch("/api/admin/pages/" + encodeURIComponent(slug));

    if (!data.ok || !data.body || !data.body.success || !data.body.data) return;

    const page = data.body.data;

    console.log("lastDate from API:", page.lastDate);

    document.getElementById("title").value = page.title || "";
    const postNameEl = document.getElementById("post_name");
    if (postNameEl) postNameEl.value = page.post_name != null ? String(page.post_name) : "";
    const totalPostsEl = document.getElementById("total_posts");
    if (totalPostsEl) totalPostsEl.value = page.total_posts != null ? String(page.total_posts) : "";
    applyStatusToForm(page.status || "");
    document.getElementById("category").value = page.category || "";
    setCategoryTagsFromString(page.category || "");
    setNormalizedSelectValue("structuredQualification", page.qualification);
    setNormalizedSelectValue("structuredState", page.state);
    setNormalizedSelectValue("structuredDepartment", page.department);
    document.getElementById("pageUrl").value = page.url || "";
    document.getElementById("data").value = page.rawText || "";
    document.getElementById("oldSlug").value = (page.slug || "").replace(/^\//, "");
    document.getElementById("pageId").value = page.id || "";

    document.getElementById("breaking").checked = !!page.breaking;
    document.getElementById("breakingOrder").value = page.breakingOrder || "";
    setEventTimeInputValue(page.eventTime || "");
    const lastDateInput = document.querySelector('input[name="lastDate"]');
    if (lastDateInput) lastDateInput.value = lastDateDdMmYyyyToIso(page.lastDate);
    setSmallBoxSlotFormValue(page.smallBoxSlot != null ? page.smallBoxSlot : "");
    applyBadgesToForm(page.badges);

    setDeleteButtonVisible(true);
    setPageUrlLocked(true);
    updateSlugPreview();
    syncAiConvertButton();
    updateBreakingOrderVisibility();
    await loadSmallBoxSlotOccupancy();

  }catch(err){
    console.error("Auto load error:", err);
  }
}

// ================= SEARCH =================
const pageSearchInput = document.getElementById("pageSearch");
const pageSuggestionBox = document.getElementById("pageSuggestions");
let pageActiveIndex = -1;
let searchTimeout;

function highlightText(text, query){
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, "gi");
  return text.replace(regex, `<mark>$1</mark>`);
}

if (pageSearchInput && pageSuggestionBox) {
  pageSearchInput.addEventListener("input", function(){

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(()=>{

      if(!pagesLoaded){
        pageSuggestionBox.innerHTML = "<div style='padding:8px'>Loading pages...</div>";
        pageSuggestionBox.style.display = "block";
        return;
      }

      const value = pageSearchInput.value.toLowerCase().trim();
      pageSuggestionBox.innerHTML = "";
      pageActiveIndex = -1;

      if(!value){
        if(recentPages.length){

          const title = document.createElement("div");
          title.textContent = "Recent Pages";
          title.style.fontWeight = "bold";
          title.style.padding = "6px 10px";
          pageSuggestionBox.appendChild(title);

          recentPages.forEach(p=>{
            const div = document.createElement("div");
            div.textContent = p.title;
            div.onclick = ()=>selectPage(p);
            pageSuggestionBox.appendChild(div);
          });

          pageSuggestionBox.style.display = "block";
        } else {
          pageSuggestionBox.style.display = "none";
        }
        return;
      }

      let filtered = allPages.filter(p=>{
        const text = (p.title || p.name || p.slug || "").toLowerCase();
        return text.includes(value);
      });

      filtered.sort((a,b)=>{

        const aTitle = (a.title || a.name || a.slug || "").toLowerCase();
        const bTitle = (b.title || b.name || b.slug || "").toLowerCase();

        if(aTitle === value && bTitle !== value) return -1;
        if(bTitle === value && aTitle !== value) return 1;

        if(aTitle.startsWith(value) && !bTitle.startsWith(value)) return -1;
        if(bTitle.startsWith(value) && !aTitle.startsWith(value)) return 1;

        return 0;
      });

      if(filtered.length === 0){
        pageSuggestionBox.innerHTML = "<div style='padding:8px'>No matches found. Try a title or slug keyword.</div>";
        pageSuggestionBox.style.display = "block";
        return;
      }

      filtered.slice(0,20).forEach(p=>{
        const div = document.createElement("div");

        const title = p.title || p.name || p.slug || "No title";
        const slugText = p.slug || (p.url ? String(p.url).replace(/^\/+/, "") : "n/a");
        const statusText = String(p.status || "unknown").toLowerCase();
        const updatedRaw = p.updated_at || p.updatedAt || p.date || p.created_at || p.createdAt || "";
        const updatedDate = updatedRaw ? new Date(updatedRaw) : null;
        const updatedText =
          updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toLocaleDateString() : "n/a";
        div.className = "suggest-item";
        div.innerHTML = `
          <div class="suggest-main">${highlightText(title, value)}</div>
          <div class="suggest-meta">slug: ${escapeAttr(slugText)} | status: ${escapeAttr(statusText)} | updated: ${escapeAttr(updatedText)}</div>
        `;

        div.onclick = ()=>selectPage(p);
        pageSuggestionBox.appendChild(div);
      });

      pageSuggestionBox.style.display = "block";

    }, 280);
  });

  document.addEventListener("click", function(e){
    if(!e.target.closest(".search-select")){
      pageSuggestionBox.style.display = "none";
    }
  });

  pageSearchInput.addEventListener("focus", function(){
    if(!this.value && recentPages.length){

      pageSuggestionBox.innerHTML = "";

      recentPages.forEach(p=>{
        const div = document.createElement("div");
        div.textContent = p.title || p.slug;
        div.onclick = ()=>selectPage(p);
        pageSuggestionBox.appendChild(div);
      });

      pageSuggestionBox.style.display = "block";
    }
  });
}

// ================= SELECT PAGE =================
async function selectPage(p){

 document.getElementById("pageSearch").value = p.title || p.slug;
  pageSuggestionBox.style.display = "none";
  setTimeout(()=>{
  pageSuggestionBox.style.display = "none";
}, 0);

  const fileName =
    p.slug ||
    (p.url ? String(p.url).split("/").filter(Boolean).pop().replace(/\.html$/i, "") : "");

  const dataRes = await safeFetch("/api/admin/pages/" + encodeURIComponent(fileName));

  if (dataRes.ok && dataRes.body && dataRes.body.success && dataRes.body.data) {
    const page = dataRes.body.data;

    console.log("lastDate from API:", page.lastDate);

    document.getElementById("title").value = page.title || "";
    const postNameEl = document.getElementById("post_name");
    if (postNameEl) postNameEl.value = page.post_name != null ? String(page.post_name) : "";
    const totalPostsEl = document.getElementById("total_posts");
    if (totalPostsEl) totalPostsEl.value = page.total_posts != null ? String(page.total_posts) : "";
    applyStatusToForm(page.status || "");
    document.getElementById("category").value = page.category || "";
    setCategoryTagsFromString(page.category || "");
    setNormalizedSelectValue("structuredQualification", page.qualification);
    setNormalizedSelectValue("structuredState", page.state);
    setNormalizedSelectValue("structuredDepartment", page.department);
    document.getElementById("pageUrl").value = page.url || "";
    document.getElementById("data").value = page.rawText || "";
    document.getElementById("oldSlug").value = (page.slug || "").replace(/^\//, "");
    document.getElementById("pageId").value = page.id || "";
    document.getElementById("breaking").checked = !!page.breaking;
    document.getElementById("breakingOrder").value = page.breakingOrder || "";
    setEventTimeInputValue(page.eventTime || "");
    const lastDateInputEdit = document.querySelector('input[name="lastDate"]');
    if (lastDateInputEdit) lastDateInputEdit.value = lastDateDdMmYyyyToIso(page.lastDate);
    setSmallBoxSlotFormValue(page.smallBoxSlot != null ? page.smallBoxSlot : "");
    applyBadgesToForm(page.badges);
    setDeleteButtonVisible(true);
    setPageUrlLocked(true);
    syncAiConvertButton();
    updateBreakingOrderVisibility();
    await loadSmallBoxSlotOccupancy();
  }

  recentPages = recentPages.filter(r => r.url !== p.url);
  recentPages.unshift(p);
  if(recentPages.length > 5) recentPages = recentPages.slice(0,5);

  localStorage.setItem("recentPages", JSON.stringify(recentPages));
}

function getStatusColor(status){
  const s = (status || "").toLowerCase();

  if (s === "latest job" || s.includes("latest job") || s === "new form" || s.includes("new form")) return "#1e3c72";
  if (s === "admission" || s.startsWith("admission")) return "#dc2626";
  if (s.includes("result")) return "#2563eb";
  if (s.includes("admit card") || s === "admit") return "#f59e0b";
  if (s.includes("answer key") || s === "answer") return "#9333ea";
  if (s.includes("syllabus")) return "#0ea5e9";
  if (s.includes("document")) return "#ea580c";

  return "#6b7280";
}

function inputValueById(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : "";
}

// ================= GENERATE PAGE =================
async function generatePage(){
  const titleOk = validateFieldNow("title");
  const lastDateOk = validateFieldNow("lastDate");
  const pageUrlOk = validateFieldNow("pageUrl");
  if (!titleOk || !lastDateOk || !pageUrlOk) {
    setGeneratorFeedback("error", "Validation failed", {
      detailsHtml: "Please fix highlighted fields."
    });
    return;
  }

  const rawStatus = resolveStatusForSave();
  if (!rawStatus || !String(rawStatus).trim()) {
    setGeneratorFeedback("error", "Validation failed", {
      detailsHtml: "Please select a section or enter a custom status."
    });
    return;
  }

  const lastDateInput = (document.getElementById("lastDate").value || "").trim() || null;
  const statusNormalized = normalizeClientStatus(rawStatus);

  const contentValue = document.getElementById("data").value.trim();
  const pageUrlValue = document.getElementById("pageUrl").value.trim();
  const qualificationValue = normalizeOptionalSelectValue(document.getElementById("structuredQualification").value);
  const stateValue = normalizeOptionalSelectValue(document.getElementById("structuredState").value);
  const departmentValue = normalizeOptionalSelectValue(document.getElementById("structuredDepartment").value);
  const breakingOrderRaw = document.getElementById("breakingOrder").value;
  const eventTimeRaw = syncEventDateTimeState(document.getElementById("eventTime").value);

  const payload = {
    title: document.getElementById("title").value.trim(),
    slug: pageUrlValue || "",
    post_name: String(document.getElementById("post_name")?.value ?? ""),
    total_posts: String(document.getElementById("total_posts")?.value ?? ""),
    status: rawStatus,
    category: document.getElementById("category").value.trim(),
    qualification: qualificationValue || null,
    state: stateValue || null,
    department: departmentValue || null,
    pageUrl: pageUrlValue || "",
    content: contentValue,
    text: contentValue,
    smallBoxSlot: document.getElementById("smallBoxSlot")?.value ?? "",
    breaking: document.getElementById("breaking").checked,
    breakingOrder: breakingOrderRaw === "" ? 0 : Number(breakingOrderRaw) || 0,
    eventTime: eventTimeRaw || null,
    lastDate: lastDateInput || null,
    badges: collectBadgesFromForm(),
    id: document.getElementById("pageId").value.trim(),
    oldSlug: document.getElementById("oldSlug").value.trim()
  };

  // ✅ strong validation
  if(!payload.title || payload.title.length < 5){
    setInlineFieldError("title", "Minimum 5 characters required.");
    setGeneratorFeedback("error", "Validation failed", {
      detailsHtml: "Title minimum 5 characters required."
    });
    return;
  }

  if(!payload.content || payload.content.length < 20){
    setGeneratorFeedback("error", "Validation failed", {
      detailsHtml: "Content too short (minimum 20 characters)."
    });
    return;
  }

  if (payload.lastDate && !isValidLastDateInput(payload.lastDate)) {
    setInlineFieldError("lastDate", "Use valid DD/MM/YYYY or YYYY-MM-DD.");
    setGeneratorFeedback("error", "Validation failed", {
      detailsHtml: "Last Date must be a valid date (DD/MM/YYYY or YYYY-MM-DD)."
    });
    return;
  }
  if (statusNormalized !== "latest job" && statusNormalized !== "new form") {
    payload.lastDate = null;
  }

  console.log("FRONTEND PAYLOAD:", payload);
  console.warn("FRONTEND STATUS FLOW:", {
    selectedStatus: document.getElementById("status")?.value,
    resolvedStatus: rawStatus,
    sentStatus: payload.status
  });
  console.warn("FRONTEND POSITION FLOW:", {
    selectedSmallBoxSlot: document.getElementById("smallBoxSlot")?.value,
    sentSmallBoxSlot: payload.smallBoxSlot
  });
  console.log("Submitting lastDate:", payload.lastDate);
  console.log("Submitting post_name / total_posts:", payload.post_name, payload.total_posts);
  console.log("Submitting status (raw):", JSON.stringify(rawStatus), "normalized:", JSON.stringify(statusNormalized));
  console.log("[generator] save payload keys:", Object.keys(payload));

  const btn = document.getElementById("savePageBtn");
  const aiBtn = document.getElementById("aiConvertBtn");
  const previewBtn = document.getElementById("previewBtn");
  if (btn) {
    btn.disabled = true;
    setActionBtnLabel(btn, "Saving…");
  }
  if (aiBtn) aiBtn.disabled = true;
  if (previewBtn) previewBtn.disabled = true;

  try {
    const fetchRes = await safeFetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
      const b = fetchRes.body && typeof fetchRes.body === "object" ? fetchRes.body : {};
      console.error("FULL ERROR:", b);
      if (Array.isArray(b.errors) && b.errors.length) {
        setGeneratorFeedback("error", "Save failed", {
          detailsHtml: b.errors
            .map((e) => `${e.field}: ${e.message}`)
            .join("<br>")
        });
      } else {
        const msg = String(b.message || b.error || fetchRes.networkError || "").trim();
        setGeneratorFeedback("error", "Save failed", {
          detailsHtml: msg || `Request failed (${fetchRes.status})`
        });
      }
      return;
    }

    const dataRes = fetchRes.body;
    const resolvedUrl = String(dataRes?.url || dataRes?.data?.url || "").trim();
    const resolvedId = dataRes?.id != null ? dataRes.id : dataRes?.data?.id;
    const parserWarnings = Array.isArray(dataRes?.warnings)
      ? dataRes.warnings
      : Array.isArray(dataRes?.data?.warnings)
        ? dataRes.data.warnings
        : [];
    const savedAnalysis = dataRes?.contentAnalysis || dataRes?.data?.contentAnalysis;
    if (savedAnalysis) {
      renderContentAnalysis(savedAnalysis);
    }

    if (!dataRes || !resolvedUrl) {
      console.error("FULL RESPONSE:", fetchRes);
      let errMsg = "";
      if (dataRes && typeof dataRes === "object") {
        errMsg = String(dataRes.message || dataRes.error || "").trim();
      }
      setGeneratorFeedback("error", "Save failed", {
        detailsHtml: errMsg || "Error: Invalid response"
      });
      return;
    }

    const isCreate = !payload.oldSlug;
    clearDraftStorage();

    if (isCreate) {
      bumpAdminMetric("publishesSuccess");
      showSuccess(resolvedUrl, payload.status);
      await loadSmallBoxSlotOccupancy();
      if (parserWarnings.length) {
        setGeneratorFeedback("info", "Saved with parsing warnings", {
          detailsHtml: parserWarnings.map((w) => `• ${escapeAttr(String(w))}`).join("<br>")
        });
      }
      resetGeneratorForm();
      return;
    }

    const newSlug = String(resolvedUrl).replace(/^\//, "").replace(/\.html$/i, "");
    document.getElementById("oldSlug").value = newSlug;
    document.getElementById("pageUrl").value = resolvedUrl.startsWith("/") ? resolvedUrl : "/" + resolvedUrl;
    if (resolvedId != null && resolvedId !== "") document.getElementById("pageId").value = String(resolvedId);
    setDeleteButtonVisible(true);
    setPageUrlLocked(true);
    updateSlugPreview();

    showSuccess(resolvedUrl, payload.status);
    await loadSmallBoxSlotOccupancy();
    if (window.AdminUI && window.AdminUI.toastSuccess) {
      window.AdminUI.toastSuccess("Action completed successfully");
    }
    bumpAdminMetric("publishesSuccess");
    if (parserWarnings.length) {
      setGeneratorFeedback("info", "Saved with parsing warnings", {
        detailsHtml: parserWarnings.map((w) => `• ${escapeAttr(String(w))}`).join("<br>")
      });
    }
  } catch (err) {
    console.error("GENERATOR ERROR:", err);
    if (window.AdminUI && window.AdminUI.toastError) {
      window.AdminUI.toastError("Something went wrong");
    }
    setGeneratorFeedback("error", "Save failed", {
      detailsHtml: "Server error while saving page."
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      restoreActionBtnLabels(btn);
    }
    if (previewBtn) previewBtn.disabled = false;
    syncAiConvertButton();
  }
}

// ================= SUCCESS MESSAGE =================  
function showSuccess(url, status){
  const color = getStatusColor(status);
  setGeneratorFeedback("success", "Page saved successfully", {
    detailsHtml: `
      <b>Status:</b>
      <span style="background:${color};color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;">
        ${(status || "N/A").toUpperCase()}
      </span>
      URL:<div class="filename">${url}</div>
      <a href="${url}" target="_blank" rel="noopener">Open Page</a>
    `
  });
}

// ================= DELETE =================
document.getElementById("deleteBtn").addEventListener("click", async function () {
  const oldSlug = (document.getElementById("oldSlug") && document.getElementById("oldSlug").value) || "";
  const pageUrl = document.getElementById("pageUrl").value || "";
  const slug =
    String(oldSlug)
      .trim()
      .replace(/^\/+|\.html$/gi, "") ||
    String(pageUrl)
      .split("/")
      .filter(Boolean)
      .pop()
      .replace(/\.html$/i, "")
      .trim();

  if (!slug) {
    setGeneratorFeedback("error", "Delete failed", {
      detailsHtml: "No page selected."
    });
    return;
  }

  const canDelete = await (window.AdminUI && window.AdminUI.simpleConfirm
    ? window.AdminUI.simpleConfirm({
        title: "Move page to trash",
        warnText: "This action cannot be undone",
        details: "Move this page to trash?"
      })
    : Promise.resolve(confirm("Move this page to Trash? (You can restore from Trash later.)")));
  if (!canDelete) return;

  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}`, {
    method: "DELETE"
  });

  if (data.ok && data.body && data.body.success) {
    window.AdminUI?.toastSuccess("Action completed successfully");
    setGeneratorFeedback("success", "Page moved to Trash.");
    window.location.href = "/generator";
  } else {
    window.AdminUI?.toastError("Something went wrong");
    const b = data.body && typeof data.body === "object" ? data.body : {};
    setGeneratorFeedback("error", "Delete failed", {
      detailsHtml: String(b.message || b.error || "").trim() || "Could not move to trash"
    });
  }
});

// ================= CONTENT ANALYSIS (Phase 1 — same rules as publish) =================
let contentAnalysisTimer = null;
let contentAnalysisRequestId = 0;

function renderModeLabel(mode) {
  const map = {
    table_forced: "Table (forced | table)",
    table_auto_safe: "Table (auto CSV)",
    table_auto_numbered: "Table (auto numbered)",
    mixed_blocks: "Mixed (text + table blocks)",
    lines: "Lines (paragraph / key-value / links)"
  };
  return map[mode] || mode;
}

function renderContentAnalysis(analysis) {
  const panel = document.getElementById("contentAnalysisPanel");
  const body = document.getElementById("contentAnalysisBody");
  const summaryEl = document.getElementById("contentAnalysisSummary");
  if (!panel || !body) return;

  if (!analysis || !analysis.sections) {
    panel.hidden = true;
    return;
  }

  const summary = analysis.summary || {};
  if (summaryEl) {
    const pv = analysis.parserVersion ? ` · parser ${analysis.parserVersion}` : "";
    const mx =
      summary.mixedSectionCount > 0 ? ` · ${summary.mixedSectionCount} mixed` : "";
    const mb = analysis.mixedBlocksEnabled ? " · mixed blocks on" : "";
    summaryEl.textContent = `${summary.sectionCount || 0} section(s), ${summary.tableSectionCount || 0} table(s), ${summary.forcedTableCount || 0} forced${mx}${pv}${mb}`;
  }

  const globalWarnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
  let html = "";

  for (const sec of analysis.sections) {
    const badges = [];
    if (sec.forceTable) badges.push('<span class="content-analysis-badge content-analysis-badge--forced">| table</span>');
    if (sec.isMixedSection) {
      badges.push('<span class="content-analysis-badge content-analysis-badge--mixed">mixed</span>');
    } else if (sec.willRenderAsTable) {
      badges.push('<span class="content-analysis-badge content-analysis-badge--table">table</span>');
    } else {
      badges.push('<span class="content-analysis-badge content-analysis-badge--lines">lines</span>');
    }

    const tableInfo = sec.table
      ? `Rows: ${sec.table.rowCount}, Cols: ${sec.table.columnCount}`
      : "";

    html += `<div class="content-analysis-section">
      <h4>${escapeAttr(sec.name || "Section")}</h4>
      <div class="content-analysis-meta">
        <span>Mode: <strong>${escapeAttr(renderModeLabel(sec.renderMode))}</strong></span>
        ${tableInfo ? `<span>${escapeAttr(tableInfo)}</span>` : ""}
        ${sec.blockCount ? `<span>${sec.blockCount} block(s)</span>` : ""}
        <span>${badges.join(" ")}</span>
      </div>`;

    if (Array.isArray(sec.blocks) && sec.blocks.length) {
      html += `<ul class="content-analysis-blocks">`;
      for (const b of sec.blocks) {
        const label = b.type === "table" ? "table" : "text";
        const detail =
          b.type === "table"
            ? ` (${b.rowCount || 0} rows × ${b.columnCount || 0} cols)`
            : ` (${b.lineCount || 0} lines)`;
        html += `<li><span class="content-analysis-badge content-analysis-badge--${label}">${escapeAttr(label)}</span>${escapeAttr(detail)}</li>`;
      }
      html += `</ul>`;
    }

    if (sec.table && sec.table.rowIssues && sec.table.rowIssues.length) {
      html += `<ul class="content-analysis-warnings">`;
      for (const issue of sec.table.rowIssues) {
        html += `<li class="severity-warn">${escapeAttr(issue.message)}</li>`;
      }
      html += `</ul>`;
    }
    html += `</div>`;
  }

  if (globalWarnings.length) {
    html += `<ul class="content-analysis-warnings">`;
    for (const w of globalWarnings) {
      const sev = w.severity === "error" ? "error" : w.severity === "info" ? "info" : "warn";
      const prefix = w.section ? `[${w.section}] ` : "";
      html += `<li class="severity-${sev}">${escapeAttr(prefix + w.message)}</li>`;
    }
    html += `</ul>`;
  }

  body.innerHTML = html || '<p class="content-analysis-meta">No issues detected.</p>';
  panel.hidden = false;
}

async function runContentAnalysis() {
  const ta = document.getElementById("data");
  const text = ta ? String(ta.value || "").trim() : "";
  const panel = document.getElementById("contentAnalysisPanel");
  if (!text) {
    if (panel) panel.hidden = true;
    return;
  }

  const reqId = ++contentAnalysisRequestId;
  try {
    const hdrs = { "Content-Type": "application/json" };
    if (typeof window.getAdminCsrfToken === "function") {
      hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
    }
    const res = await fetch("/api/admin/pages/analyze-content", {
      method: "POST",
      credentials: "include",
      headers: hdrs,
      body: JSON.stringify({ text })
    });
    if (reqId !== contentAnalysisRequestId) return;
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.success) return;
    renderContentAnalysis(body.data);
  } catch (err) {
    console.error("Content analysis error:", err);
  }
}

function scheduleContentAnalysis() {
  clearTimeout(contentAnalysisTimer);
  contentAnalysisTimer = setTimeout(() => runContentAnalysis(), 550);
}

// ================= PREVIEW =================
let previewTimer;

function updatePreview(){

  clearTimeout(previewTimer);
  const previewBtn = document.getElementById("previewBtn");
  if (previewBtn) {
    previewBtn.disabled = true;
    setActionBtnLabel(previewBtn, "Rendering...");
  }

  previewTimer = setTimeout(async ()=>{

    const payload = {
      title: document.getElementById("title").value.trim(),
      post_name: String(document.getElementById("post_name")?.value ?? ""),
      total_posts: String(document.getElementById("total_posts")?.value ?? ""),
      text: document.getElementById("data").value.trim()
    };

    try{

      const res = await fetch("/api/preview-page",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
        },
        credentials: "include",
        body:JSON.stringify(payload)
      });

      const html = await res.text();
      document.getElementById("previewFrame").srcdoc = html;

    }catch(err){
      console.error("Preview error:", err);
    } finally {
      if (previewBtn) {
        previewBtn.disabled = false;
        restoreActionBtnLabels(previewBtn);
      }
    }

  }, 400);
}


// ================= AI =================
/** Keep AI button always clickable: disabled buttons do not fire click — users saw "Convert with AI" dead. Use guards inside aiConvert(). */
function syncAiConvertButton() {
  const btn = document.getElementById("aiConvertBtn");
  const ta = document.querySelector("#data");
  if (!btn || !ta) return;
  if (aiConvertInProgress) {
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  const hasText = String(ta.value || "").trim().length > 0;
  btn.title = hasText ? "" : "Add content first (minimum 50 characters) before AI conversion.";
  btn.classList.toggle("ai-convert-needs-text", !hasText);
}

const AI_MIN_INPUT_LEN = 20;
const AI_REQUIRED_BEFORE_AI = 50;
const AI_ACCEPT_MIN_LEN = 50;

/**
 * Normalize section blocks (same logic as server finalize).
 * Bugfix: previously anything without [Section: Eligibility] dumped the entire textarea into ShortInfo.
 */
function ensureSections(text) {
  const t = String(text || "")
    .replace(/\{\{TEXT\}\}/gi, "")
    .replace(/\$\{text\}/gi, "")
    .trim();
  const u = typeof window !== "undefined" && window.__jobSectionUtil;
  if (u && typeof u.finalizeStructuredJobOutput === "function") {
    return u.finalizeStructuredJobOutput(t, t);
  }
  if (!t) {
    return `[Section: ShortInfo]
—
—

[Section: Eligibility]
Qualification: —
Age Limit: —
State: —

[Section: ImportantDates]
—

[Section: SelectionProcess]
—

[Section: Vacancy]
—

[Section: ImportantLinks]
—

[Section: अक्सर पूछे जाने वाले प्रश्न]
—
`;
  }
  if (/\[Section:\s*Eligibility\]/i.test(t) || /\[Section:/i.test(t)) return t;
  const body = t.length ? t : "—";
  return `[Section: ShortInfo]
${body}

[Section: Eligibility]
Qualification: —
Age Limit: —
State: —

[Section: ImportantDates]
—

[Section: SelectionProcess]
—

[Section: Vacancy]
—

[Section: ImportantLinks]
—

[Section: अक्सर पूछे जाने वाले प्रश्न]
—
`;
}

async function aiConvert() {
  console.log("[AI] aiConvert() invoked");
  const ta = document.getElementById("data");
  const rawText = ta ? ta.value : "";
  const payloadText = String(rawText)
    .replace(/\{\{TEXT\}\}/gi, "")
    .replace(/\$\{text\}/gi, "")
    .trim();

  console.log("[AI] BEFORE length:", payloadText.length);

  if (!payloadText || payloadText.length < AI_REQUIRED_BEFORE_AI) {
    console.error("❌ Empty/weak text before AI — length:", payloadText.length);
    setGeneratorFeedback("error", "AI conversion blocked", {
      detailsHtml: payloadText
        ? "Add at least 50 characters in Page Content before AI conversion."
        : "Extract or paste PDF text first."
    });
    return;
  }

  const prompt = `
You are a highly accurate job data extraction engine.

GOAL:
Extract ALL real information from RAW TEXT and fill structured sections completely.

----------------------------------------

CRITICAL RULES:

1. DO NOT leave "—" if ANY related data exists
2. SEARCH entire text deeply before marking "—"
3. EXTRACT even if data is scattered
4. DO NOT summarize — extract exact values
5. DO NOT generate fake data

----------------------------------------

EXTRACTION LOGIC:

- Advertisement No → find patterns like "Advt", "Advertisement No"
- Qualification → find education lines
- Age Limit → find numbers with years
- Dates → find all date patterns (dd/mm/yyyy, words, etc.)
- Vacancy → find numbers + categories
- Selection → find steps like exam, test, interview
- Links → find URLs

----------------------------------------

OUTPUT FORMAT (STRICT):

[Section: ShortInfo]
<brief real summary>

[Section: Eligibility]
Qualification: <must extract>
Age Limit: <must extract>
State: <must extract if mentioned>

[Section: ImportantDates]
Notification Date: <extract>
Application Start Date: <extract>
Last Date: <extract>
Exam Date: <extract>

[Section: SelectionProcess]
<extract steps line by line>

[Section: Vacancy]
<extract real numbers and categories>

[Section: ImportantLinks]
<extract real URLs>

[Section: अक्सर पूछे जाने वाले प्रश्न]
<extract if present>

----------------------------------------

STRICT:

- If data exists anywhere → MUST extract it
- Only use "—" when truly absent
- Read entire text before output

----------------------------------------

RAW TEXT:
"""
${payloadText}
"""
`;
  console.log("🔥 FINAL PROMPT PREVIEW:", prompt.slice(0, 300));
  console.log("[AI] SENT length:", payloadText.length);

  const prev = payloadText;
  const aiBtn = document.getElementById("aiConvertBtn");

  aiConvertInProgress = true;
  setEditorActionsBusy(true);
  if (aiBtn) setActionBtnLabel(aiBtn, "Converting...");
  try {
    const body = JSON.stringify({
      text: payloadText,
      content: payloadText
    });
    console.log("[AI] POST /api/ai-parse keys: text+content same length:", payloadText.length);

    const res = await fetch("/api/ai-parse", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[AI] HTTP error:", res.status, errBody);
      setGeneratorFeedback("error", "AI conversion failed");
      return;
    }

    const data = await res.json();
    let aiOut =
      data && typeof data.result === "string" ? data.result.trim() : data && typeof data.text === "string"
        ? data.text.trim()
        : "";

    console.log("[AI] RESPONSE length:", aiOut.length);
    if (data && typeof data === "object") {
      console.log("[AI] response keys:", Object.keys(data));
    }

    if (/^(Input too short|No usable data found)$/i.test(String(aiOut || "").trim())) {
      aiOut = "";
    }

    const sourceForSections = aiOut && aiOut.length > 0 ? aiOut : prev;
    const next = ensureSections(sourceForSections);

    ta.value = safeSet(ta, next);
    if (!aiOut || aiOut.length <= AI_ACCEPT_MIN_LEN) {
      console.warn("[AI] Weak or empty API text — structured sections merged from input");
    }
    console.log("[AI] FINAL length:", String(ta.value || "").trim().length);
    syncAiConvertButton();
    updateEditorStats();
  } catch (err) {
    console.error("[AI] error:", err);
    setGeneratorFeedback("error", "AI conversion failed");
  } finally {
    aiConvertInProgress = false;
    if (aiBtn) {
      restoreActionBtnLabels(aiBtn);
    }
    setEditorActionsBusy(false);
    syncAiConvertButton();
  }
}

window.aiConvert = aiConvert;

// ================= PDF =================
// Open app via nginx (e.g. http://localhost:8080/generator) so POST /api/... goes through proxy — not :3000 directly.
// PDF extract is POST-only (multipart). Do not open this URL in a browser tab — GET is not defined (404 is normal).
// Backend: app.use("/api/admin", file.routes) + POST "/pdf/extract" → full path must be /api/admin/pdf/extract
const PDF_EXTRACT_URL = "/api/admin/pdf/extract";

function setPdfUploadStatus(message, isError = false) {
  const status = document.getElementById("pdfUploadStatus");
  if (!status) return;
  status.textContent = String(message || "").trim();
  status.classList.toggle("is-error", Boolean(isError));
}

function formatPdfFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function updatePdfSelectedFileName(file) {
  const nameEl = document.getElementById("pdfSelectedName");
  const sizeEl = document.getElementById("pdfFileSize");
  const bar = document.getElementById("pdfExtractBar");
  if (bar) bar.classList.toggle("pdf-extract-bar--has-file", Boolean(file));
  if (!nameEl) return;
  if (!file) {
    nameEl.textContent = "No file selected";
    if (sizeEl) sizeEl.textContent = "—";
    return;
  }
  nameEl.textContent = file.name;
  nameEl.title = file.name;
  if (sizeEl) sizeEl.textContent = formatPdfFileSize(file.size);
}

function setupPdfUploadUi() {
  const input = document.getElementById("pdfFile");
  const zone = document.getElementById("pdfDropZone");
  const bar = document.getElementById("pdfExtractBar");
  if (!input || !zone) return;

  const setDragActive = (on) => {
    zone.classList.toggle("drag-active", on);
    bar?.classList.toggle("drag-active", on);
  };

  input.addEventListener("change", () => {
    updatePdfSelectedFileName(input.files && input.files[0] ? input.files[0] : null);
    setPdfUploadStatus("");
  });

  const bindDrag = (el) => {
    if (!el) return;
    ["dragenter", "dragover"].forEach((evt) => {
      el.addEventListener(evt, (e) => {
        e.preventDefault();
        setDragActive(true);
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      el.addEventListener(evt, (e) => {
        e.preventDefault();
        setDragActive(false);
      });
    });
    el.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      const file = dt.files[0];
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        setPdfUploadStatus("PDF only", true);
        return;
      }
      input.files = dt.files;
      updatePdfSelectedFileName(file);
      setPdfUploadStatus("Ready to extract");
    });
  };

  bindDrag(zone);
  bindDrag(bar);
}

async function extractPDF() {
  const file = document.getElementById("pdfFile").files[0];
  const uploadBtn = document.getElementById("pdfUploadBtn");
  if (!file) {
    setGeneratorFeedback("error", "PDF extract failed", { detailsHtml: "Choose a PDF first." });
    setPdfUploadStatus("Choose PDF first", true);
    return;
  }

  const runExtract = async () => {
  const formData = new FormData();
  formData.append("pdf", file);

  console.info("Uploading PDF, size:", file.size);
  setPdfUploadStatus("Extracting…");
  if (uploadBtn) uploadBtn.disabled = true;

  try {
    const hdrs = {};
    if (typeof window.getAdminCsrfToken === "function") {
      hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
    }
    const res = await fetch(PDF_EXTRACT_URL, {
      method: "POST",
      credentials: "include",
      body: formData,
      headers: hdrs
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    let data = {};
    const looksJson = contentType.includes("application/json");
    const rawTrim = raw ? raw.trim() : "";
    if (rawTrim.startsWith("{") || (looksJson && raw)) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }
    }

    const backendMsg = [data.error, data.message].find((s) => typeof s === "string" && s.trim());

    if (res.status === 413) {
      setGeneratorFeedback("error", "PDF upload blocked", {
        detailsHtml: backendMsg || "Upload blocked by server/proxy size limit"
      });
      setPdfUploadStatus(backendMsg || "Upload blocked by size limit", true);
      return;
    }

    if (res.status === 401) {
      setGeneratorFeedback("error", "Login required", {
        detailsHtml: "Please login at /login and reopen the generator (session/cookie missing)."
      });
      setPdfUploadStatus("Login required", true);
      return;
    }

    const rawExtract =
      typeof data.text === "string"
        ? data.text
        : typeof data.result === "string"
          ? data.result
          : typeof data.data === "string"
            ? data.data
            : "";
    const text = String(rawExtract || "").trim();
    if (!res.ok || !text) {
      if (backendMsg) {
        setGeneratorFeedback("error", "PDF extract failed", { detailsHtml: backendMsg });
        setPdfUploadStatus(backendMsg, true);
        return;
      }
      if (!looksJson && res.status === 413) {
        setGeneratorFeedback("error", "PDF upload blocked", {
          detailsHtml: "Upload blocked by server/proxy size limit"
        });
        setPdfUploadStatus("Upload blocked by size limit", true);
        return;
      }
      setGeneratorFeedback("error", "PDF extract failed", {
        detailsHtml: looksJson
          ? "No readable text found. Please try another PDF."
          : "Server returned a non-JSON response — status " + res.status
      });
      setPdfUploadStatus("Extraction failed", true);
      return;
    }

    const dataEl = document.getElementById("data");
    if (dataEl && text) {
      setDataFromServer(dataEl, text);
    } else if (!text) {
      console.error("[PDF extract] No text in response — keys:", Object.keys(data));
    }
    console.log("[PDF extract] assigned to #data, length:", dataEl ? String(dataEl.value || "").length : 0);
    syncAiConvertButton();
    setPdfUploadStatus("Extracted ✓");
    if (data.extractionNote) {
      console.info("[PDF extract]", data.extractionNote);
    }
    document.getElementById("data")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.AdminUI?.toastSuccess?.("PDF text added to editor");
  } catch (e) {
    console.error(e);
    setGeneratorFeedback("error", "Network error", {
      detailsHtml: "Network error. Please try again."
    });
    setPdfUploadStatus("Network error", true);
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
  }
  };

  if (window.AdminUI && window.AdminUI.withLoading && uploadBtn) {
    await window.AdminUI.withLoading(uploadBtn, runExtract, "Extracting…");
  } else {
    await runExtract();
  }
}

/* CSP: wire action bar + PDF button without inline handlers */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("previewBtn")?.addEventListener("click", () => updatePreview());
  document.getElementById("aiConvertBtn")?.addEventListener("click", () => aiConvert());
  document.getElementById("savePageBtn")?.addEventListener("click", () => generatePage());
  document.getElementById("pdfUploadBtn")?.addEventListener("click", () => extractPDF());
});
