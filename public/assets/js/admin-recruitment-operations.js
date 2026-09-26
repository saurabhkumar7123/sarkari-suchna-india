(function () {
  "use strict";

  const PAGE_SIZE = 20;
  const EVENT_TYPES = [
    "notification", "short_notification", "correction", "exam_date", "city_intimation",
    "admit_card", "answer_key", "objection", "result", "final_result", "dv", "medical", "joining"
  ];
  const FILTER_SURFACE = "recruitments";
  let listPage = 1;
  let listTotal = 0;
  let selected = null;
  let events = [];
  let linkedPages = [];
  let linkedUpdates = [];
  let linkedReviews = [];
  let draftBinding = null;
  const selectedIds = new Set();
  let identityEditMode = false;
  const IDENTITY_FIELD_IDS = [
    "recruitmentTitle",
    "recruitmentSlug",
    "recruitmentDepartment",
    "recruitmentPostName",
    "recruitmentAdvertisement",
    "recruitmentCycleYear",
    "recruitmentLifecycle"
  ];

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const labelize = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const statusHtml = (status) => `<span class="rom-status is-${escapeHtml(status)}">${escapeHtml(labelize(status))}</span>`;
  const truncateText = (value, max) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1))}…`;
  };
  let syncingUrl = false;
  let accordionWired = false;

  function message(text, isError) {
    const el = byId("operationsMessage");
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function notifyLocal(type, text, href) {
    window.AdminOpsNotifications?.push({ type, text, href: href || "/admin/recruitments" });
  }

  function currentFilters() {
    return {
      search: byId("recruitmentSearch").value.trim(),
      lifecycle_state: byId("recruitmentStateFilter").value,
      cycle_year: byId("recruitmentYearFilter").value
    };
  }

  function applyFiltersToForm(filters) {
    if (!filters) return;
    byId("recruitmentSearch").value = filters.search || "";
    byId("recruitmentStateFilter").value = filters.lifecycle_state || "";
    byId("recruitmentYearFilter").value = filters.cycle_year || "";
  }

  function persistCurrentFilters() {
    window.AdminOpsSearch?.persistFilters(FILTER_SURFACE, currentFilters());
  }

  function renderRecentSearches() {
    const host = byId("recruitmentRecentSearches");
    if (!host || !window.AdminOpsSearch) return;
    const recent = window.AdminOpsSearch.recentSearches(8).filter((r) => r.context === FILTER_SURFACE || r.context === "global");
    host.innerHTML = recent.map((r) => `<option value="${escapeHtml(r.query)}"></option>`).join("");
  }

  function renderSavedFilters() {
    const bar = byId("savedFiltersBar");
    const list = byId("savedFiltersList");
    if (!bar || !list || !window.AdminOpsSearch) return;
    const saved = window.AdminOpsSearch.listSavedFilters(FILTER_SURFACE);
    if (!saved.length) {
      bar.hidden = true;
      list.innerHTML = "";
      return;
    }
    bar.hidden = false;
    list.innerHTML = saved.map((f) =>
      `<span class="rom-saved-chip" data-saved-id="${escapeHtml(f.id)}">${escapeHtml(f.name)}
        <button type="button" data-delete-saved="${escapeHtml(f.id)}" aria-label="Remove saved filter">×</button>
      </span>`
    ).join("");
    list.querySelectorAll("[data-saved-id]").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        if (e.target.closest("[data-delete-saved]")) return;
        const entry = saved.find((f) => f.id === chip.dataset.savedId);
        if (!entry) return;
        applyFiltersToForm(entry.filters);
        listPage = 1;
        loadRecruitments();
      });
    });
    list.querySelectorAll("[data-delete-saved]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.AdminOpsSearch.deleteSavedFilter(btn.dataset.deleteSaved);
        renderSavedFilters();
      });
    });
  }

  function updateBulkBar() {
    const bar = byId("recruitmentBulkBar");
    const count = selectedIds.size;
    // Contextual: only show bulk toolbar when at least one row is selected.
    if (bar) bar.hidden = count === 0;
    const label = byId("bulkSelectedCount");
    if (label) label.textContent = `${count} selected`;
    const selectAll = byId("bulkSelectAll");
    if (selectAll) {
      const boxes = Array.from(document.querySelectorAll(".rom-row-check"));
      selectAll.checked = boxes.length > 0 && boxes.every((b) => b.checked);
      selectAll.indeterminate = count > 0 && !selectAll.checked;
    }
  }

  function getUiMode() {
    const detail = byId("recruitmentDetailPanel");
    const detailVisible = detail && !detail.hidden;
    if (!detailVisible) return "list";
    const hasId = Boolean(byId("recruitmentId")?.value || selected?.id);
    if (!hasId) return "create";
    if (identityEditMode) return "edit";
    return "view";
  }

  function truncateTitle(value, max) {
    const text = String(value || "").trim();
    if (!text) return "Recruitment";
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1))}…`;
  }

  function syncUiContext() {
    const mode = getUiMode();
    document.body.dataset.romMode = mode;
    document.body.classList.toggle("rom-mode-list", mode === "list");
    document.body.classList.toggle("rom-mode-create", mode === "create");
    document.body.classList.toggle("rom-mode-view", mode === "view");
    document.body.classList.toggle("rom-mode-edit", mode === "edit");

    const pageTitle = byId("romPageTitle") || document.querySelector(".admin-title");
    const pageEyebrow = byId("romPageEyebrow");
    const pageSub = byId("romPageSub");
    const newBtn = byId("newRecruitmentBtn");
    const tabs = byId("romDetailTabs");
    const detailHeader = byId("romDetailHeader");
    const editBtn = byId("editRecruitmentIdentityBtn");
    const archiveBtn = byId("archiveRecruitmentBtn");
    const cancelBtn = byId("cancelRecruitmentBtn");
    const saveBtn = byId("saveRecruitmentBtn");
    const formActions = byId("recruitmentIdentityEditActions");
    const lastUpdated = byId("adminLastUpdated");
    const closed = selected?.lifecycle_state === "closed";
    const countText = byId("recruitmentCount")?.textContent || `${listTotal} recruitment${listTotal === 1 ? "" : "s"}`;

    if (formActions) {
      formActions.hidden = true;
      formActions.setAttribute("aria-hidden", "true");
    }

    if (mode === "list") {
      if (pageEyebrow) {
        pageEyebrow.hidden = true;
        pageEyebrow.textContent = "Recruitments";
      }
      if (pageTitle) pageTitle.textContent = "Recruitments";
      if (pageSub) {
        pageSub.hidden = false;
        pageSub.textContent = countText;
      }
      if (newBtn) newBtn.hidden = false;
      if (tabs) tabs.hidden = true;
      if (detailHeader) detailHeader.hidden = true;
      if (editBtn) editBtn.hidden = true;
      if (archiveBtn) archiveBtn.hidden = true;
      if (cancelBtn) cancelBtn.hidden = true;
      if (saveBtn) saveBtn.hidden = true;
      if (lastUpdated) lastUpdated.hidden = false;
      return;
    }

    if (pageEyebrow) {
      pageEyebrow.hidden = false;
      pageEyebrow.textContent = "Recruitments";
    }
    if (newBtn) newBtn.hidden = true;
    if (lastUpdated) lastUpdated.hidden = true;
    if (detailHeader) detailHeader.hidden = false;

    if (mode === "create") {
      if (pageTitle) pageTitle.textContent = "New Recruitment";
      if (pageSub) {
        pageSub.hidden = false;
        pageSub.textContent = "Creating a new recruitment — Save or Cancel. Does not publish.";
      }
      if (tabs) tabs.hidden = true;
      if (editBtn) editBtn.hidden = true;
      if (archiveBtn) archiveBtn.hidden = true;
      if (cancelBtn) cancelBtn.hidden = false;
      if (saveBtn) {
        saveBtn.hidden = false;
        saveBtn.textContent = "Save";
      }
      openAccordionSection("overview");
      return;
    }

    const name = selected?.title || byId("romDetailTitle")?.textContent || "Recruitment";
    if (pageTitle) pageTitle.textContent = truncateTitle(name, 64);
    if (pageTitle) pageTitle.title = name;
    if (pageSub) {
      pageSub.hidden = false;
      const org = selected?.department || "—";
      const year = selected?.cycle_year || "—";
      const status = labelize(selected?.lifecycle_state || "announced");
      pageSub.textContent = `ID ${selected?.id || "—"} · ${org} · ${year} · ${status}`;
    }

    if (mode === "view") {
      if (tabs) tabs.hidden = false;
      if (editBtn) editBtn.hidden = false;
      if (archiveBtn) archiveBtn.hidden = closed;
      if (cancelBtn) cancelBtn.hidden = true;
      if (saveBtn) saveBtn.hidden = true;
      return;
    }

    // edit — identity-only; hide workflow tabs / archive / new
    if (pageSub) {
      pageSub.textContent = `Editing existing recruitment · ID ${selected?.id || "—"} — Save or Cancel`;
    }
    if (tabs) tabs.hidden = true;
    if (editBtn) editBtn.hidden = true;
    if (archiveBtn) archiveBtn.hidden = true;
    if (cancelBtn) cancelBtn.hidden = false;
    if (saveBtn) {
      saveBtn.hidden = false;
      saveBtn.textContent = "Save";
    }
    openAccordionSection("overview");
  }

  async function api(url, options) {
    const opts = { ...(options || {}) };
    const method = String(opts.method || "GET").toUpperCase();
    if (opts.body && typeof opts.body !== "string") {
      opts.headers = { ...(opts.headers || {}), "Content-Type": "application/json" };
      opts.body = JSON.stringify(opts.body);
    }
    const response = typeof window.fetchAdminWithCsrf === "function"
      ? await window.fetchAdminWithCsrf(url, opts)
      : await fetch(url, { credentials: "include", ...opts });
    if (response.status === 401) {
      window.location.href = "/login?reason=expired";
      throw new Error("Admin session expired");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.success === false) {
      throw new Error(body?.message || `Request failed (${response.status})`);
    }
    return body;
  }

  function listQuery() {
    const params = new URLSearchParams({ page: String(listPage), limit: String(PAGE_SIZE) });
    const filters = currentFilters();
    if (filters.search) params.set("search", filters.search);
    if (filters.lifecycle_state) params.set("lifecycle_state", filters.lifecycle_state);
    if (filters.cycle_year) params.set("cycle_year", filters.cycle_year);
    return params.toString();
  }

  function renderRecruitments(rows) {
    const host = byId("recruitmentRows");
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="7" class="rom-empty">No recruitments found.</td></tr>';
      updateBulkBar();
      return;
    }
    host.innerHTML = rows.map((row) => {
      const checked = selectedIds.has(Number(row.id)) ? "checked" : "";
      const titleFull = String(row.title || "");
      const titleShort = truncateText(titleFull, 72);
      return `<tr data-id="${row.id}" class="${selected?.id === row.id ? "is-selected" : ""}">
      <td><input type="checkbox" class="rom-row-check" data-bulk-id="${row.id}" ${checked} aria-label="Select ${escapeHtml(row.title)}"></td>
      <td class="rom-id-cell"><span class="rom-rec-id" title="Recruitment ID">${escapeHtml(row.id)}</span></td>
      <td><strong title="${escapeHtml(titleFull)}">${escapeHtml(titleShort || "—")}</strong><br><small>${escapeHtml(row.slug || "")}</small></td>
      <td>${escapeHtml(row.department || "—")}</td>
      <td>${escapeHtml(row.post_name || "—")}</td>
      <td>${escapeHtml(row.cycle_year || "—")}</td>
      <td>${statusHtml(row.lifecycle_state)}</td>
    </tr>`;
    }).join("");
    host.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".rom-row-check")) return;
        selectRecruitment(row.dataset.id);
      });
    });
    host.querySelectorAll(".rom-row-check").forEach((box) => {
      box.addEventListener("change", () => {
        const id = Number(box.dataset.bulkId);
        if (box.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateBulkBar();
      });
      box.addEventListener("click", (e) => e.stopPropagation());
    });
    updateBulkBar();
  }

  async function loadRecruitments() {
    try {
      const filters = currentFilters();
      if (filters.search) window.AdminOpsSearch?.rememberSearch(filters.search, FILTER_SURFACE);
      persistCurrentFilters();
      renderRecentSearches();
      const body = await api(`/api/admin/recruitments?${listQuery()}`);
      listTotal = Number(body.pagination?.total) || 0;
      renderRecruitments(body.data || []);
      const pages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
      byId("recruitmentCount").textContent = `${listTotal} recruitment${listTotal === 1 ? "" : "s"}`;
      const pageSub = byId("romPageSub");
      if (pageSub && getUiMode() === "list") pageSub.textContent = byId("recruitmentCount").textContent;
      byId("recruitmentPageLabel").textContent = `Page ${listPage} of ${pages}`;
      byId("recruitmentPrev").disabled = listPage <= 1;
      byId("recruitmentNext").disabled = listPage >= pages;
      if (getUiMode() === "list") syncUiContext();
    } catch (err) {
      message(err.message, true);
    }
  }

  async function confirmBulk(action, count) {
    const titles = {
      archive: `Archive ${count} recruitment(s)?`,
      restore: `Restore ${count} archived recruitment(s)?`,
      status_update: `Update status for ${count} recruitment(s)?`,
      category_update: `Update category/department for ${count} recruitment(s)?`,
      assignment: `Assign ${count} recruitment(s)?`,
      delete: `Permanently delete ${count} recruitment(s)? This cannot be undone.`
    };
    const title = titles[action] || `Apply ${action} to ${count} item(s)?`;
    if (window.AdminUI?.simpleConfirm) {
      return window.AdminUI.simpleConfirm({
        title: "Confirm bulk action",
        details: title,
        warnText: action === "delete" ? "Permanent action — data cannot be recovered." : "Please confirm this bulk operation.",
        confirmLabel: action === "delete" ? "Delete" : "Confirm",
        variant: action === "delete" ? "danger" : "default"
      });
    }
    if (window.AdminUI?.confirmDelete && action === "delete") {
      return window.AdminUI.confirmDelete({ title: "Confirm bulk delete", count });
    }
    return window.confirm(title);
  }

  async function applyBulkAction() {
    const action = byId("bulkActionSelect").value;
    const ids = Array.from(selectedIds);
    if (!action) {
      message("Choose a bulk action first.", true);
      return;
    }
    if (!ids.length) {
      message("Select at least one recruitment.", true);
      return;
    }

    const payload = { action, ids, confirm: true };

    if (action === "status_update") {
      const lifecycle_state = window.prompt("New status (announced, open, exam_scheduled, post_exam, results, closed):", "open");
      if (!lifecycle_state) return;
      payload.lifecycle_state = lifecycle_state.trim().toLowerCase();
    }
    if (action === "restore") {
      payload.lifecycle_state = "open";
    }
    if (action === "category_update") {
      const category = window.prompt("Category / department value:", "");
      if (category == null) return;
      payload.category = category.trim();
    }
    if (action === "assignment") {
      const assignee = window.prompt("Assignee label:", "");
      if (!assignee || !assignee.trim()) return;
      payload.assignee = assignee.trim();
    }

    const ok = await confirmBulk(action, ids.length);
    if (!ok) return;

    try {
      const body = await api("/api/admin/recruitments/bulk", { method: "POST", body: payload });
      const summary = body.data?.summary || {};
      message(`Bulk ${action}: ${summary.ok || 0} ok, ${summary.skipped || 0} skipped, ${summary.failed || 0} failed.`);
      notifyLocal(
        window.AdminOpsNotifications?.TYPES?.BULK_ACTION || "bulk_action",
        `Bulk ${action} completed (${summary.ok || 0}/${summary.requested || ids.length})`,
        "/admin/recruitments"
      );
      selectedIds.clear();
      byId("bulkActionSelect").value = "";
      if (action === "delete" && selected && ids.includes(Number(selected.id))) {
        closeRecruitmentDetail({ replaceUrl: true });
      }
      await loadRecruitments();
    } catch (err) {
      message(err.message, true);
    }
  }

  function syncListDetailChrome(detailVisible) {
    const layout = document.querySelector(".rom-layout");
    const listPanel = document.querySelector(".rom-list-panel");
    if (layout) {
      layout.classList.toggle("rom-layout--list-only", !detailVisible);
      layout.classList.toggle("rom-layout--detail-only", detailVisible);
    }
    document.body.classList.toggle("rom-recruitment-detail-active", detailVisible);
    if (listPanel) {
      listPanel.hidden = detailVisible;
      listPanel.setAttribute("aria-hidden", detailVisible ? "true" : "false");
    }
    syncUiContext();
  }

  function setEditorVisible(visible) {
    const empty = byId("recruitmentEmpty");
    const editor = byId("recruitmentEditor");
    const detail = byId("recruitmentDetailPanel") || document.querySelector(".rom-detail-panel");
    if (empty) {
      empty.hidden = true;
      empty.setAttribute("aria-hidden", "true");
    }
    if (editor) editor.hidden = !visible;
    if (detail) detail.hidden = !visible;
    syncListDetailChrome(visible);
    if (visible) {
      resetAccordionToOverview();
      const header = byId("romDetailHeader");
      if (header && !header.hidden) header.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function accordionSections() {
    return Array.from(document.querySelectorAll("#romAccordionGroup details.rom-acc[data-rom-acc]"));
  }

  function syncDetailTabs(activeName) {
    const tabs = document.querySelectorAll("#romDetailTabs [data-rom-tab]");
    tabs.forEach((tab) => {
      const on = tab.getAttribute("data-rom-tab") === activeName;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function openAccordionSection(name) {
    const sections = accordionSections();
    if (!sections.length) return;
    const target = name || "overview";
    sections.forEach((el) => {
      el.open = el.getAttribute("data-rom-acc") === target;
    });
    syncDetailTabs(target);
  }

  function resetAccordionToOverview() {
    openAccordionSection("overview");
  }

  function wireExclusiveAccordion() {
    if (accordionWired) return;
    const group = byId("romAccordionGroup");
    if (!group) return;
    accordionWired = true;
    group.addEventListener("click", (event) => {
      const summary = event.target && event.target.closest
        ? event.target.closest("summary.rom-acc__summary")
        : null;
      if (!summary || !group.contains(summary)) return;
      const section = summary.closest("details.rom-acc");
      if (!section) return;
      // Browser toggles open state after this click handler; enforce exclusivity next tick.
      setTimeout(() => {
        if (!section.open) return;
        const name = section.getAttribute("data-rom-acc") || "overview";
        accordionSections().forEach((el) => {
          if (el !== section) el.open = false;
        });
        syncDetailTabs(name);
      }, 0);
    });
  }

  function wireDetailTabs() {
    const nav = byId("romDetailTabs");
    if (!nav || nav.dataset.wired === "1") return;
    nav.dataset.wired = "1";
    nav.addEventListener("click", (event) => {
      const tab = event.target && event.target.closest ? event.target.closest("[data-rom-tab]") : null;
      if (!tab || !nav.contains(tab)) return;
      event.preventDefault();
      // Workflow tabs belong to VIEW only — not create/edit identity flows.
      if (getUiMode() !== "view") return;
      openAccordionSection(tab.getAttribute("data-rom-tab") || "overview");
    });
  }

  function syncRecruitmentUrl(id, { replace, mode } = {}) {
    if (syncingUrl) return;
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.delete("id");
      url.searchParams.delete("mode");
      url.searchParams.set("recruitment_id", String(id));
    } else if (mode === "create") {
      url.searchParams.delete("recruitment_id");
      url.searchParams.delete("id");
      url.searchParams.set("mode", "create");
    } else {
      url.searchParams.delete("recruitment_id");
      url.searchParams.delete("id");
      url.searchParams.delete("mode");
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;
    syncingUrl = true;
    try {
      const state = { recruitmentId: id || null, mode: id ? "view" : (mode || "list") };
      if (replace) window.history.replaceState(state, "", next);
      else window.history.pushState(state, "", next);
    } finally {
      syncingUrl = false;
    }
  }

  function updateDetailHeader(row) {
    const idLabel = byId("romDetailIdLabel");
    const titleEl = byId("romDetailTitle");
    const metaEl = byId("romDetailMetaLine");
    const statusEl = byId("romDetailStatusText");
    const advancedHint = byId("romAdvancedIdHint");
    if (!row?.id) {
      if (idLabel) idLabel.textContent = "New Recruitment";
      if (titleEl) titleEl.textContent = "Create recruitment record";
      if (metaEl) metaEl.textContent = "Fill identity fields below. Creating a record does not publish.";
      if (statusEl) {
        statusEl.textContent = "—";
        statusEl.className = "rom-status";
      }
      if (advancedHint) advancedHint.textContent = "—";
      return;
    }
    const org = row.department || "—";
    const post = row.post_name || "—";
    const year = row.cycle_year || "—";
    const status = labelize(row.lifecycle_state || "announced");
    if (idLabel) idLabel.textContent = `Recruitment ID: ${row.id}`;
    if (titleEl) {
      const full = row.title || `Recruitment ID: ${row.id}`;
      titleEl.textContent = full;
      titleEl.title = full;
    }
    if (metaEl) metaEl.textContent = `${org} · ${post} · ${year}`;
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = `rom-status is-${escapeHtml(row.lifecycle_state || "announced")}`;
    }
    if (advancedHint) advancedHint.textContent = String(row.id);
  }

  function closeRecruitmentDetail({ replaceUrl } = {}) {
    selected = null;
    events = [];
    linkedPages = [];
    linkedUpdates = [];
    linkedReviews = [];
    draftBinding = null;
    setEditorVisible(false);
    fillRecruitmentForm(null);
    setIdentityEditMode(false);
    renderEvents();
    renderLinks();
    renderLifecycleLinks();
    renderDraftBinding();
    if (window.AdminSharedPreview) window.AdminSharedPreview.clear();
    syncRecruitmentUrl(null, { replace: Boolean(replaceUrl) });
    loadRecruitments();
  }

  function canonicalPageResolution() {
    if (!linkedPages.length) {
      return { status: "none", page: null, message: "Not linked" };
    }
    if (linkedPages.length === 1) {
      return { status: "unique", page: linkedPages[0], message: "PUBLISHED" };
    }
    return {
      status: "ambiguous",
      page: linkedPages[0],
      message: `${linkedPages.length} pages linked — resolve canonical mapping`
    };
  }

  function selectAuthoritativeEventClient(eventList) {
    const list = Array.isArray(eventList) ? eventList.filter(Boolean) : [];
    const excluded = new Set(["superseded", "cancelled"]);
    const eligible = list.filter((e) => !excluded.has(String(e.status || "").toLowerCase()));
    const byNewest = (a, b) => {
      const sa = Number(a.sequence_order);
      const sb = Number(b.sequence_order);
      const seqA = Number.isFinite(sa) ? sa : -1;
      const seqB = Number.isFinite(sb) ? sb : -1;
      if (seqB !== seqA) return seqB - seqA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    };
    for (const preferred of ["active", "pending"]) {
      const matches = eligible
        .filter((e) => String(e.status || "").toLowerCase() === preferred)
        .sort(byNewest);
      if (matches.length) return matches[0];
    }
    return null;
  }

  function currentStageLabel() {
    const active = selectAuthoritativeEventClient(events);
    if (active) return labelize(active.event_type);
    return labelize(selected?.lifecycle_state || "announced");
  }

  function computeRepairState() {
    if (!selected?.id) return null;
    const canonical = canonicalPageResolution();
    const activeEvent = selectAuthoritativeEventClient(events);
    const unpublished = (draftBinding && draftBinding.drafts
      ? draftBinding.drafts
      : []
    ).filter((d) => String(d.status || "").toLowerCase() !== "published");

    if (canonical.status === "ambiguous") {
      return {
        reason: "ambiguous_page",
        title: "REPAIR REQUIRED — ambiguous canonical pages",
        detail:
          "Multiple pages linked. Never guess. Human must select the single canonical public page before publish/update.",
        action: "Unlink extra pages until exactly one canonical page remains.",
        recruitment: selected.title || `Recruitment ID: ${selected.id}`,
        event: activeEvent ? labelize(activeEvent.event_type) : "—",
        draft: unpublished[0] ? unpublished[0].title || `Draft ID: ${unpublished[0].id}` : "—",
        page: canonical.page ? `/${canonical.page.slug}` : "—"
      };
    }
    if (canonical.status === "none") {
      const hasDownstream = events.some((e) =>
        ["admit_card", "answer_key", "result", "final_result", "correction"].includes(
          String(e.event_type || "").toLowerCase()
        )
      );
      if (hasDownstream) {
        return {
          reason: "missing_page",
          title: "REPAIR REQUIRED — missing canonical page",
          detail:
            "Admit Card / Result / Answer Key updates are BLOCKED until the canonical Notification page is linked. Do not create a status-only page.",
          action: "Link the existing Notification public page, or create the first canonical page only for Notification.",
          recruitment: selected.title || `Recruitment ID: ${selected.id}`,
          event: activeEvent ? labelize(activeEvent.event_type) : "—",
          draft: unpublished[0] ? unpublished[0].title || `Draft ID: ${unpublished[0].id}` : "—",
          page: "Not linked"
        };
      }
    }
    return null;
  }

  function renderRepairBanner() {
    const host = byId("lifecycleRepairBanner");
    if (!host) return;
    const repair = computeRepairState();
    if (!repair) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = `
      <div class="rom-repair-banner__head"><strong>${escapeHtml(repair.title)}</strong></div>
      <p class="rom-repair-banner__reason"><strong>Reason:</strong> ${escapeHtml(repair.reason)}</p>
      <p>${escapeHtml(repair.detail)}</p>
      <div class="rom-bind">
        <div class="rom-bind__row"><span class="rom-bind__label">Current Recruitment</span><span class="rom-bind__value">${escapeHtml(repair.recruitment)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Current Event</span><span class="rom-bind__value">${escapeHtml(repair.event)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Current Draft</span><span class="rom-bind__value">${escapeHtml(repair.draft)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Current Page</span><span class="rom-bind__value">${escapeHtml(repair.page)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Required action</span><span class="rom-bind__value">${escapeHtml(repair.action)}</span></div>
      </div>`;
  }

  function renderLifecycleOverview() {
    const host = byId("recruitmentLifecycleOverview");
    if (!host) return;
    if (!selected?.id) {
      host.hidden = true;
      updateDetailHeader(null);
      return;
    }
    host.hidden = false;
    updateDetailHeader(selected);
    const titleEl = byId("lifecycleOverviewTitle");
    const metaEl = byId("lifecycleOverviewMeta");
    const statusEl = byId("lifecycleOverviewStatus");
    if (titleEl) titleEl.textContent = selected.title || "Recruitment";
    if (metaEl) {
      const org = selected.department || "—";
      const year = selected.cycle_year || "—";
      metaEl.textContent = `Organization: ${org} · Year: ${year} · Recruitment ID: ${selected.id}`;
    }
    if (statusEl) {
      statusEl.textContent = labelize(selected.lifecycle_state || "announced");
      statusEl.className = `rom-status is-${escapeHtml(selected.lifecycle_state || "announced")}`;
    }

    const canonical = canonicalPageResolution();
    const pageEl = byId("lifecycleCanonicalPage");
    const pageStatusEl = byId("lifecycleCanonicalStatus");
    const actions = byId("lifecycleCanonicalActions");
    const openPage = byId("lifecycleOpenPage");
    const editPage = byId("lifecycleEditPage");
    if (pageEl) {
      pageEl.textContent =
        canonical.status === "none"
          ? "Not linked"
          : `/${canonical.page.slug}`;
    }
    if (pageStatusEl) {
      pageStatusEl.textContent =
        canonical.status === "unique"
          ? "Status: PUBLISHED"
          : canonical.status === "ambiguous"
            ? canonical.message
            : "Status: —";
      pageStatusEl.classList.toggle("is-warn", canonical.status === "ambiguous");
    }
    if (actions) actions.hidden = canonical.status === "none";
    if (canonical.page && openPage && editPage) {
      openPage.href = `/${encodeURIComponent(canonical.page.slug)}`;
      editPage.href = `/generator?slug=${encodeURIComponent(canonical.page.slug)}`;
    }

    const stageEl = byId("lifecycleCurrentStage");
    if (stageEl) {
      const auth = selectAuthoritativeEventClient(events);
      stageEl.textContent = auth
        ? `${labelize(auth.event_type)} (Event #${auth.id} · ${auth.status})`
        : `${currentStageLabel()} (cached projection)`;
    }

    renderRepairBanner();

    const checklist = byId("lifecycleStageChecklist");
    if (checklist) {
      const milestoneTypes = ["notification", "admit_card", "answer_key", "result", "final_result"];
      const present = new Map(
        events.map((e) => [String(e.event_type || "").toLowerCase(), e])
      );
      const rows = milestoneTypes.map((type) => {
        const ev = present.get(type);
        const done = Boolean(ev);
        const mark = done ? "✓" : "○";
        const status = ev ? labelize(ev.status) : "not started";
        const idMeta = ev ? ` · Event #${ev.id}` : "";
        return `<li class="${done ? "is-done" : "is-pending"}"><span class="rom-stage-mark">${mark}</span> ${escapeHtml(labelize(type))} <small>${escapeHtml(status)}${escapeHtml(idMeta)}</small></li>`;
      });
      const extras = events.filter(
        (e) => !milestoneTypes.includes(String(e.event_type || "").toLowerCase())
      );
      extras.forEach((ev) => {
        rows.push(
          `<li class="is-done"><span class="rom-stage-mark">✓</span> ${escapeHtml(labelize(ev.event_type))} <small>${escapeHtml(labelize(ev.status))} · Event #${escapeHtml(ev.id)}</small></li>`
        );
      });
      checklist.innerHTML = rows.join("") || '<li class="rom-empty">No events yet</li>';
    }

    const binding = draftBinding || {};
    const drafts = binding.drafts || [];
    const pending = drafts.filter((d) => String(d.status || "draft").toLowerCase() === "draft");
    const published = drafts.filter((d) => String(d.status || "").toLowerCase() === "published");
    const pendingHost = byId("lifecyclePendingDrafts");
    const publishedHost = byId("lifecyclePublishedHistory");
    if (pendingHost) {
      pendingHost.innerHTML = pending.length
        ? pending
            .map((d) => {
              const event = events.find((e) => Number(e.id) === Number(d.recruitmentEventId));
              const titleFull = d.title || "Untitled draft";
              return `<article class="rom-draft-chip">
                <p class="rom-rel-ids"><span>Recruitment ID: ${escapeHtml(selected.id)}</span><span>Draft ID: ${escapeHtml(d.id)}</span>${event ? `<span>Event #${escapeHtml(event.id)}</span>` : ""}</p>
                <strong title="${escapeHtml(titleFull)}">${escapeHtml(truncateText(titleFull, 64))}</strong>
                <span>Event: ${escapeHtml(event ? labelize(event.event_type) : "—")}</span>
                <span class="rom-overview-meta">Status: ${escapeHtml(d.status || "draft")}</span>
                <a class="rom-row-btn" href="/generator?draftId=${encodeURIComponent(d.id)}" style="text-decoration:none;">Open Draft</a>
              </article>`;
            })
            .join("")
        : '<p class="rom-empty">No pending drafts</p>';
    }
    if (publishedHost) {
      publishedHost.innerHTML = published.length
        ? published
            .map((d) => {
              const titleFull = d.title || "Untitled";
              return `<article class="rom-draft-chip is-published">
                <p class="rom-rel-ids"><span>Draft ID: ${escapeHtml(d.id)}</span></p>
                <strong title="${escapeHtml(titleFull)}">${escapeHtml(truncateText(titleFull, 64))}</strong>
                <span class="rom-overview-meta">Published history</span>
              </article>`;
            })
            .join("")
        : linkedUpdates.length
          ? linkedUpdates
              .slice(0, 5)
              .map((u) => {
                const titleFull = u.title || "Update";
                const updateId = u.id != null ? u.id : u.update_id;
                return `<article class="rom-draft-chip is-published"><p class="rom-rel-ids">${updateId != null ? `<span>Update ID: ${escapeHtml(updateId)}</span>` : ""}</p><strong title="${escapeHtml(titleFull)}">${escapeHtml(truncateText(titleFull, 64))}</strong><span class="rom-overview-meta">${escapeHtml(labelize(u.recruitmentEventType || u.recruitment_event_type || "update"))}</span></article>`;
              })
              .join("")
          : '<p class="rom-empty">No published history yet</p>';
    }
  }

  function fillDraftBindEventSelect() {
    const select = byId("draftBindEventSelect");
    if (!select) return;
    select.innerHTML =
      '<option value="">Recruitment-level (no event)</option>' +
      events
        .map(
          (event) =>
            `<option value="${event.id}">${escapeHtml(labelize(event.event_type))} · ${escapeHtml(event.status || "")}</option>`
        )
        .join("");
  }

  function setIdentityEditMode(editing) {
    identityEditMode = Boolean(editing);
    const form = byId("recruitmentForm");
    const hasId = Boolean(byId("recruitmentId")?.value);
    const isCreate = !hasId;

    if (form) {
      form.classList.toggle("rom-form--readonly", !identityEditMode);
      form.dataset.identityMode = identityEditMode ? (isCreate ? "create" : "edit") : "view";
    }

    IDENTITY_FIELD_IDS.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        el.disabled = !identityEditMode;
      } else {
        el.readOnly = !identityEditMode;
      }
    });

    syncUiContext();
  }

  function enterIdentityEditMode() {
    if (!byId("recruitmentId")?.value && !selected?.id) {
      setIdentityEditMode(true);
      return;
    }
    openAccordionSection("overview");
    setIdentityEditMode(true);
    byId("recruitmentTitle")?.focus();
  }

  function cancelIdentityEdit() {
    if (selected?.id) {
      fillRecruitmentForm(selected);
      setIdentityEditMode(false);
      return;
    }
    closeRecruitmentDetail({ replaceUrl: true });
  }

  function fillRecruitmentForm(row) {
    byId("recruitmentId").value = row?.id || "";
    byId("recruitmentTitle").value = row?.title || "";
    byId("recruitmentSlug").value = row?.slug || "";
    byId("recruitmentDepartment").value = row?.department || "";
    byId("recruitmentPostName").value = row?.post_name || "";
    byId("recruitmentAdvertisement").value = row?.advertisement_no || "";
    byId("recruitmentCycleYear").value = row?.cycle_year || "";
    byId("recruitmentLifecycle").value = row?.lifecycle_state || "announced";
    byId("recruitmentFormTitle").textContent = row?.id ? "Recruitment details" : "New Recruitment";
    const purpose = byId("recruitmentFormPurpose");
    if (purpose) {
      purpose.textContent = row?.id
        ? "Read-only identity for this recruitment. Click Edit to change fields. Lifecycle updates use Manual Update in Actions — same permanent page/slug."
        : "Create a recruitment record when this vacancy does not already exist. Creating a record does not publish.";
    }
    const overview = byId("recruitmentLifecycleOverview");
    if (overview) overview.hidden = !row?.id;
    updateDetailHeader(row);
    // Existing recruitment → read-only by default. New recruitment → editable.
    setIdentityEditMode(!row?.id);
  }

  function updateWorkflow() {
    // Workflow step chrome was removed; keep a no-op so callers stay safe.
    const steps = document.querySelectorAll("[data-workflow-step]");
    if (!steps.length) return;
    let current = "recruitment";
    if (selected?.id) {
      if (!events.length) current = "events";
      else if (!linkedPages.length) current = "links";
      else if (draftBinding && draftBinding.drafts && draftBinding.drafts.length) current = "review";
      else current = "links";
    }
    const order = ["recruitment", "events", "links", "review"];
    const index = order.indexOf(current);
    steps.forEach((el) => {
      const step = el.getAttribute("data-workflow-step");
      const i = order.indexOf(step);
      el.classList.toggle("is-complete", i >= 0 && i < index);
      el.classList.toggle("is-current", i === index);
    });
  }

  function renderDraftBinding() {
    const statusEl = byId("draftBindingStatus");
    const workflowEl = byId("draftWorkflowLine");
    const rows = byId("draftBindingRows");
    const openReview = byId("openEditorialReviewBtn");
    const bindVisual = byId("romBindingVisual");
    const openGen = byId("openBoundDraftGeneratorBtn");
    fillDraftBindEventSelect();
    if (!selected?.id) {
      statusEl.textContent = "No Draft";
      statusEl.className = "rom-status";
      workflowEl.textContent = "Workflow: —";
      rows.innerHTML = '<tr><td colspan="4" class="rom-empty">Select a recruitment to manage draft binding.</td></tr>';
      openReview.href = "/admin/editorial-review";
      if (openGen) {
        openGen.href = "/generator";
        openGen.textContent = "Open in Generator";
      }
      if (bindVisual) {
        bindVisual.innerHTML = `
          <div class="rom-bind__row"><span class="rom-bind__label">Draft</span><span class="rom-bind__value">—</span></div>
          <div class="rom-bind__row"><span class="rom-bind__label">Recruitment</span><span class="rom-bind__value">—</span></div>
          <div class="rom-bind__row"><span class="rom-bind__label">Event</span><span class="rom-bind__value">—</span></div>
          <div class="rom-bind__row"><span class="rom-bind__label">Canonical Public Page</span><span class="rom-bind__value">—</span></div>
          <div class="rom-bind__row"><span class="rom-bind__label">Status</span><span class="rom-bind__value">Not linked</span></div>`;
      }
      renderLifecycleOverview();
      return;
    }
    const binding = draftBinding || {};
    const status = binding.bindingStatus || "no_draft";
    statusEl.textContent = binding.bindingStatusLabel || "No Draft";
    statusEl.className = `rom-status is-${status}`;
    workflowEl.textContent = `Workflow: ${binding.workflowStateLabel || "Draft Created"}`;
    openReview.href = `/admin/editorial-review?recruitment_id=${encodeURIComponent(selected.id)}`;

    const drafts = binding.drafts || [];
    const primary = drafts.find((d) => Number(d.id) === Number(binding.primaryDraftId)) || drafts[0];
    const canonical = canonicalPageResolution();
    const primaryEvent = primary
      ? events.find((e) => Number(e.id) === Number(primary.recruitmentEventId))
      : null;
    if (openGen) {
      if (primary && primary.id) {
        openGen.href = `/generator?draftId=${encodeURIComponent(primary.id)}`;
        openGen.textContent = "Open in Generator";
      } else {
        openGen.href = "/generator";
        openGen.textContent = "Open Generator";
      }
    }
    if (bindVisual) {
      const draftLabel = primary
        ? `${truncateText(primary.title || "Untitled", 48)} (Draft ID: ${primary.id})`
        : "—";
      const eventLabel = primaryEvent
        ? `${labelize(primaryEvent.event_type)} (Event #${primaryEvent.id})`
        : "—";
      const pageLabel =
        canonical.status === "none"
          ? "Not linked"
          : `/${canonical.page.slug}${canonical.status === "ambiguous" ? " (ambiguous)" : ""}`;
      const statusLabel = primary
        ? labelize(primary.status || "draft")
        : "Not linked";
      bindVisual.innerHTML = `
        <div class="rom-bind__row"><span class="rom-bind__label">Recruitment</span><span class="rom-bind__value">Recruitment ID: ${escapeHtml(selected.id)} · ${escapeHtml(truncateText(selected.title || "Recruitment", 48))}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Draft</span><span class="rom-bind__value" title="${escapeHtml(primary?.title || "")}">${escapeHtml(draftLabel)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Event</span><span class="rom-bind__value">${escapeHtml(eventLabel)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Canonical Public Page</span><span class="rom-bind__value">${escapeHtml(pageLabel)}</span></div>
        <div class="rom-bind__row"><span class="rom-bind__label">Status</span><span class="rom-bind__value">${escapeHtml(statusLabel)}</span></div>`;
    }

    if (!drafts.length) {
      rows.innerHTML = '<tr><td colspan="4" class="rom-empty">No drafts attached.</td></tr>';
    } else {
      rows.innerHTML = drafts.map((draft) => {
        const isPrimary = Number(draft.id) === Number(binding.primaryDraftId);
        const event = events.find((e) => Number(e.id) === Number(draft.recruitmentEventId));
        const isPublished = String(draft.status || "").toLowerCase() === "published";
        return `<tr>
          <td><strong>${escapeHtml(draft.title || "Untitled")}</strong><br><small>Draft ID: ${escapeHtml(draft.id)}${isPrimary ? " · primary" : ""}</small></td>
          <td>${escapeHtml(event ? labelize(event.event_type) : "—")}</td>
          <td>${statusHtml(draft.status || "draft")}</td>
          <td>
            ${
              isPublished
                ? `<span class="rom-overview-meta">History only</span>`
                : `<a class="rom-row-btn" href="/generator?draftId=${encodeURIComponent(draft.id)}" style="text-decoration:none;">Open in Generator</a>
            <button type="button" class="rom-row-btn is-danger" data-detach-draft="${draft.id}">Detach</button>`
            }
          </td>
        </tr>`;
      }).join("");
      rows.querySelectorAll("[data-detach-draft]").forEach((button) => {
        button.addEventListener("click", () => detachDraft(button.dataset.detachDraft));
      });
    }
    renderLifecycleOverview();
    updateWorkflow();
  }

  async function loadAvailableDrafts() {
    const select = byId("draftBindSelect");
    try {
      const body = await api("/api/admin/draft-bindings/available-drafts?limit=30");
      const drafts = body.data || [];
      select.innerHTML = '<option value="">Select an unbound draft</option>' + drafts
        .map((draft) => {
          const title = escapeHtml(draft.title || "Untitled");
          const status = escapeHtml(draft.status || "draft");
          return `<option value="${draft.id}">${title} — ${status}</option>`;
        })
        .join("");
    } catch (err) {
      select.innerHTML = '<option value="">Unable to load drafts</option>';
      message(`Failed: ${err.message}`, true);
    }
  }

  async function loadDraftBinding() {
    if (!selected?.id) {
      draftBinding = null;
      renderDraftBinding();
      return;
    }
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding`);
      draftBinding = body.data;
      renderDraftBinding();
    } catch (err) {
      draftBinding = null;
      renderDraftBinding();
      message(err.message, true);
    }
  }

  async function attachDraft(event) {
    event.preventDefault();
    if (!selected?.id) return;
    const draftId = byId("draftBindSelect").value;
    if (!draftId) return;
    const draftLabel =
      byId("draftBindSelect").selectedOptions?.[0]?.textContent?.trim() || "Draft";
    const eventId = byId("draftBindEventSelect")?.value || "";
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding/attach`, {
        method: "POST",
        body: {
          draft_id: draftId,
          ...(eventId ? { recruitment_event_id: eventId } : {})
        }
      });
      draftBinding = body.data;
      message(
        `Draft linked successfully — ${draftLabel} → ${selected.title || "recruitment"}. Open in Generator: /generator?draftId=${draftId}`
      );
      notifyLocal(
        window.AdminOpsNotifications?.TYPES?.DRAFT_ATTACHED || "draft_attached",
        `Draft linked to ${selected.title || "recruitment"}`,
        `/generator?draftId=${encodeURIComponent(draftId)}`
      );
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function replaceDraft() {
    if (!selected?.id) return;
    const draftId = byId("draftBindSelect").value;
    if (!draftId) {
      message("Failed: Select a draft to replace with.", true);
      return;
    }
    const eventId = byId("draftBindEventSelect")?.value || "";
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding/replace`, {
        method: "POST",
        body: {
          draft_id: draftId,
          previous_draft_id: draftBinding?.primaryDraftId || null,
          ...(eventId ? { recruitment_event_id: eventId } : {})
        }
      });
      draftBinding = body.data;
      message("Draft linked successfully (replaced previous link).");
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function detachDraft(draftId) {
    if (!selected?.id || !window.confirm("Detach this draft from the recruitment?")) return;
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding/detach`, {
        method: "POST",
        body: { draft_id: draftId }
      });
      draftBinding = body.data;
      message("Draft detached successfully");
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  function renderEvents() {
    const host = byId("eventTimeline");
    const eventSelect = byId("pageLinkEvent");
    eventSelect.innerHTML = '<option value="">Recruitment-level link</option>' + events
      .map((event) => `<option value="${event.id}">${escapeHtml(labelize(event.event_type))} · ${escapeHtml(event.status || "")}</option>`).join("");
    fillDraftBindEventSelect();
    if (!events.length) {
      host.innerHTML = '<li class="rom-empty">No lifecycle events yet.</li>';
      renderLifecycleOverview();
      updateWorkflow();
      return;
    }
    host.innerHTML = events.map((event) => {
      const done = ["active", "superseded"].includes(String(event.status || "").toLowerCase());
      return `<li data-event-id="${event.id}" class="${done ? "is-done" : "is-pending"}">
      <span class="rom-timeline__order">${done ? "✓" : "○"} ${escapeHtml(event.sequence_order)}</span>
      <span><strong>${escapeHtml(labelize(event.event_type))}</strong><br>${statusHtml(event.status)}<br><small class="rom-overview-meta">Event #${escapeHtml(event.id)}</small></span>
      <span class="rom-row-actions">
        <button type="button" class="rom-row-btn" data-edit-event="${event.id}">Edit</button>
        <button type="button" class="rom-row-btn is-danger" data-delete-event="${event.id}">Delete</button>
      </span>
    </li>`;
    }).join("");
    host.querySelectorAll("[data-edit-event]").forEach((button) => button.addEventListener("click", () => editEvent(button.dataset.editEvent)));
    host.querySelectorAll("[data-delete-event]").forEach((button) => button.addEventListener("click", () => deleteEvent(button.dataset.deleteEvent)));
    renderLifecycleOverview();
    updateWorkflow();
  }

  function renderLinks() {
    const host = byId("pageLinkRows");
    if (!linkedPages.length) {
      host.innerHTML = '<tr><td colspan="4" class="rom-empty">No pages attached.</td></tr>';
      renderLifecycleOverview();
      updateWorkflow();
      return;
    }
    const ambiguous = linkedPages.length > 1;
    host.innerHTML = linkedPages.map((page) => {
      const event = events.find((item) => Number(item.id) === Number(page.recruitment_event_id));
      return `<tr><td><a href="/${encodeURIComponent(page.slug)}" target="_blank" rel="noopener">${escapeHtml(page.slug)}</a>${ambiguous ? '<br><small class="rom-overview-meta">Ambiguous — resolve to one canonical page</small>' : ""}</td>
        <td>${escapeHtml(event ? labelize(event.event_type) : "Recruitment")}</td>
        <td>${statusHtml(ambiguous ? "ambiguous" : "linked")}</td>
        <td>
          <a class="rom-row-btn" href="/generator?slug=${encodeURIComponent(page.slug)}" style="text-decoration:none;">Edit Page</a>
          <button type="button" class="rom-row-btn is-danger" data-unlink-page="${page.id}">Detach</button>
        </td></tr>`;
    }).join("");
    host.querySelectorAll("[data-unlink-page]").forEach((button) => button.addEventListener("click", () => unlinkPage(button.dataset.unlinkPage)));
    renderLifecycleOverview();
    updateWorkflow();
  }

  function renderLifecycleLinks() {
    const updateRows = byId("lifecycleUpdateRows");
    const reviewRows = byId("lifecycleReviewRows");
    if (updateRows) {
      if (!linkedUpdates.length) {
        updateRows.innerHTML = '<tr><td colspan="4" class="rom-empty">No linked updates.</td></tr>';
      } else {
        updateRows.innerHTML = linkedUpdates
          .map((row) => {
            const updateId = row.id != null ? row.id : row.update_id;
            const titleFull = row.title || "—";
            return `<tr>
            <td><span class="rom-rec-id">Update ID: ${escapeHtml(updateId != null ? updateId : "—")}</span><br><small>${escapeHtml(labelize(row.recruitmentEventType || row.recruitment_event_type || "update"))}</small></td>
            <td><strong title="${escapeHtml(titleFull)}">${escapeHtml(truncateText(titleFull, 56))}</strong></td>
            <td>${escapeHtml(labelize(row.recruitmentEventType || row.recruitment_event_type || "—"))}</td>
            <td>${escapeHtml(row.siteName || row.site_id || "—")}</td>
          </tr>`;
          })
          .join("");
      }
    }
    if (reviewRows) {
      if (!linkedReviews.length) {
        reviewRows.innerHTML = '<tr><td colspan="4" class="rom-empty">No linked reviews.</td></tr>';
      } else {
        reviewRows.innerHTML = linkedReviews
          .map((row) => {
            const reviewId = row.id != null ? row.id : row.review_id;
            const titleFull = row.title || row.update_title || "—";
            return `<tr>
            <td><span class="rom-rec-id">Review ID: ${escapeHtml(reviewId != null ? reviewId : "—")}</span><br><small>${escapeHtml(labelize(row.event_type || "Review"))}</small></td>
            <td><span class="rrq-status is-${escapeHtml(String(row.status || "").toLowerCase())}">${escapeHtml(
              row.status || "—"
            )}</span></td>
            <td>${escapeHtml(labelize(row.event_type || "—"))}</td>
            <td title="${escapeHtml(titleFull)}">${escapeHtml(truncateText(titleFull, 48))}</td>
          </tr>`;
          })
          .join("");
      }
    }
  }

  function focusEventTimeline() {
    openAccordionSection("lifecycle");
    const section = byId("recruitmentEventsSection") || byId("eventTimeline");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleEventTimelineHash() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (hash !== "eventTimeline") return;
    if (selected?.id) {
      focusEventTimeline();
      return;
    }
    message("Select a recruitment to view its Event Timeline.", false);
  }

  async function selectRecruitment(id, { syncUrl } = {}) {
    try {
      const body = await api(`/api/admin/recruitments/${id}/detail?limit=50`);
      selected = body.data.recruitment;
      events = body.data.events || [];
      linkedPages = body.data.pages || [];
      linkedUpdates = body.data.updates || [];
      linkedReviews = body.data.reviews || [];
      setEditorVisible(true);
      fillRecruitmentForm(selected);
      renderEvents();
      renderLinks();
      renderLifecycleLinks();
      await loadDraftBinding();
      await loadAvailableDrafts();
      await loadRecruitments();
      if (window.AdminSharedPreview) await window.AdminSharedPreview.show(selected.id);
      if (syncUrl !== false) syncRecruitmentUrl(selected.id);
      if (String(window.location.hash || "").replace(/^#/, "") === "eventTimeline") {
        focusEventTimeline();
      }
    } catch (err) {
      message(err.message, true);
    }
  }

  function newRecruitment() {
    // Create flow is list-only — never start from an open existing recruitment detail.
    if (selected?.id) return;
    selected = null;
    events = [];
    linkedPages = [];
    linkedUpdates = [];
    linkedReviews = [];
    draftBinding = null;
    setEditorVisible(true);
    fillRecruitmentForm(null);
    setIdentityEditMode(true);
    renderEvents();
    renderLinks();
    renderLifecycleLinks();
    renderDraftBinding();
    if (window.AdminSharedPreview) window.AdminSharedPreview.clear();
    syncRecruitmentUrl(null, { replace: false, mode: "create" });
    byId("recruitmentTitle").focus();
  }

  function recruitmentPayload() {
    return {
      title: byId("recruitmentTitle").value.trim(),
      slug: byId("recruitmentSlug").value.trim(),
      department: byId("recruitmentDepartment").value.trim() || null,
      post_name: byId("recruitmentPostName").value.trim() || null,
      advertisement_no: byId("recruitmentAdvertisement").value.trim() || null,
      cycle_year: byId("recruitmentCycleYear").value || null,
      lifecycle_state: byId("recruitmentLifecycle").value
    };
  }

  async function saveRecruitment(event) {
    event.preventDefault();
    if (!identityEditMode) return;
    try {
      const id = byId("recruitmentId").value;
      const payload = recruitmentPayload();
      const body = await api(id ? `/api/admin/recruitments/${id}` : "/api/admin/recruitments", {
        method: id ? "PUT" : "POST", body: payload
      });
      const name = payload.title || body.data?.title || "Recruitment";
      if (id) {
        message(`Recruitment updated successfully — ${name}.`);
      } else {
        message(
          `Recruitment created successfully — ${name}. Next: open Generator to create content, Preview, then Manual Publish.`
        );
      }
      await selectRecruitment(body.data.id);
      setIdentityEditMode(false);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function archiveRecruitment() {
    if (!selected?.id) return;
    const title = selected.title || `Recruitment ID: ${selected.id}`;
    let confirmed = false;
    if (window.AdminUI?.simpleConfirm) {
      confirmed = await window.AdminUI.simpleConfirm({
        title: "Archive recruitment?",
        warnText: "Are you sure you want to archive this recruitment?",
        details: `"${title}" will be marked archived/closed. Existing events and page links are retained. You can restore later via Bulk Restore.`,
        confirmLabel: "Archive",
        variant: "danger"
      });
    } else {
      confirmed = window.confirm(`Archive recruitment?\n\n"${title}" will be archived. Existing events and page links will be retained.`);
    }
    if (!confirmed) return;
    try {
      await api(`/api/admin/recruitments/${selected.id}`, { method: "PUT", body: { lifecycle_state: "closed" } });
      message("Recruitment archived successfully. Existing events and page links were retained.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  function showEventForm(event) {
    byId("eventForm").hidden = false;
    byId("eventId").value = event?.id || "";
    byId("eventType").value = event?.event_type || "notification";
    byId("eventOrder").value = event?.sequence_order ?? (events.length ? Math.max(...events.map((item) => Number(item.sequence_order) || 0)) + 1 : 0);
    byId("eventStatus").value = event?.status || "pending";
  }

  function editEvent(id) {
    showEventForm(events.find((event) => String(event.id) === String(id)));
  }

  async function saveEvent(event) {
    event.preventDefault();
    try {
      const id = byId("eventId").value;
      const payload = { event_type: byId("eventType").value, sequence_order: byId("eventOrder").value, status: byId("eventStatus").value };
      await api(id ? `/api/admin/recruitment-events/${id}` : `/api/admin/recruitments/${selected.id}/events`, {
        method: id ? "PUT" : "POST", body: payload
      });
      byId("eventForm").hidden = true;
      message(id ? "Event updated successfully." : "Event added successfully.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm("Delete this lifecycle event? Linked pages will remain attached to the recruitment.")) return;
    try {
      await api(`/api/admin/recruitment-events/${id}`, { method: "DELETE" });
      message("Event deleted successfully.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function validatePage() {
    const slug = byId("pageLinkSlug").value.trim();
    if (!slug) return;
    const status = byId("pageValidationStatus");
    try {
      const body = await api(`/api/admin/page-linkages/page?slug=${encodeURIComponent(slug)}`);
      const page = body.data;
      status.textContent = page.recruitment_id
        ? `Page exists and is currently linked to another recruitment.`
        : "Page exists and is available to attach.";
      status.hidden = false;
    } catch (err) {
      status.textContent = `Failed: ${err.message}`;
      status.hidden = false;
      notifyLocal(
        window.AdminOpsNotifications?.TYPES?.BROKEN_PAGE_LINK || "broken_page_link",
        `Page link validation failed for "${slug}": ${err.message}`,
        "/admin/recruitments"
      );
    }
  }

  async function attachPage(event) {
    event.preventDefault();
    try {
      const eventId = byId("pageLinkEvent").value;
      await api("/api/admin/page-linkages", {
        method: "POST",
        body: {
          slug: byId("pageLinkSlug").value.trim(),
          recruitment_id: selected.id,
          recruitment_event_id: eventId || null
        }
      });
      byId("pageLinkForm").reset();
      byId("pageValidationStatus").hidden = true;
      message("Page linked successfully. One recruitment should keep one permanent public page.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function unlinkPage(pageId) {
    if (!window.confirm("Detach this page from the recruitment?")) return;
    try {
      await api(`/api/admin/page-linkages?page_id=${encodeURIComponent(pageId)}`, { method: "DELETE" });
      message("Page detached successfully.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  async function createManualUpdate(event) {
    event.preventDefault();
    if (!selected?.id) return;
    const openLink = byId("manualUpdateOpenGenerator");
    if (openLink) {
      openLink.hidden = true;
      openLink.removeAttribute("href");
    }
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/manual-update`, {
        method: "POST",
        body: {
          event_type: byId("manualUpdateEventType").value,
          title: byId("manualUpdateTitle").value.trim()
        }
      });
      byId("manualUpdateForm").reset();
      const draftId =
        body &&
        body.data &&
        body.data.draft &&
        (body.data.draft.id != null ? body.data.draft.id : null);
      if (draftId && openLink) {
        openLink.href = `/generator?draftId=${encodeURIComponent(draftId)}`;
        openLink.hidden = false;
        openLink.textContent = "Open Generator (this draft)";
      }
      message(
        draftId
          ? `Manual update created — event + draft ID: ${draftId}. Next: Open Generator → Preview → Manual Publish/Update (same permanent page).`
          : "Manual update created successfully — event + draft ready. Next: Generator → Preview → Manual Publish (same permanent page)."
      );
      await selectRecruitment(selected.id);
    } catch (err) {
      message(`Failed: ${err.message}`, true);
    }
  }

  byId("eventType").innerHTML = EVENT_TYPES.map((type) => `<option value="${type}">${escapeHtml(labelize(type))}</option>`).join("");
  byId("newRecruitmentBtn").addEventListener("click", newRecruitment);
  byId("closeRecruitmentDetailBtn")?.addEventListener("click", () => closeRecruitmentDetail());
  byId("recruitmentForm").addEventListener("submit", saveRecruitment);
  byId("archiveRecruitmentBtn").addEventListener("click", archiveRecruitment);
  byId("editRecruitmentIdentityBtn")?.addEventListener("click", () => enterIdentityEditMode());
  byId("cancelRecruitmentBtn").addEventListener("click", () => cancelIdentityEdit());
  byId("addEventBtn").addEventListener("click", () => {
    openAccordionSection("lifecycle");
    showEventForm(null);
  });
  byId("cancelEventBtn").addEventListener("click", () => { byId("eventForm").hidden = true; });
  byId("eventForm").addEventListener("submit", saveEvent);
  byId("validatePageBtn").addEventListener("click", validatePage);
  byId("pageLinkForm").addEventListener("submit", attachPage);
  byId("manualUpdateForm")?.addEventListener("submit", createManualUpdate);
  byId("draftBindForm").addEventListener("submit", attachDraft);
  byId("replaceDraftBtn").addEventListener("click", replaceDraft);
  byId("refreshDraftsBtn").addEventListener("click", loadAvailableDrafts);
  byId("recruitmentFilters").addEventListener("submit", (event) => { event.preventDefault(); listPage = 1; loadRecruitments(); });
  byId("clearFiltersBtn").addEventListener("click", () => {
    byId("recruitmentFilters").reset();
    window.AdminOpsSearch?.clearFilters(FILTER_SURFACE);
    listPage = 1;
    loadRecruitments();
  });
  byId("saveFilterBtn")?.addEventListener("click", () => {
    const name = window.prompt("Name this filter:");
    if (!name || !name.trim()) return;
    window.AdminOpsSearch?.saveFilter(name.trim(), FILTER_SURFACE, currentFilters());
    renderSavedFilters();
    window.AdminUI?.toastSuccess("Filter saved");
  });
  byId("bulkApplyBtn")?.addEventListener("click", applyBulkAction);
  byId("bulkSelectAll")?.addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".rom-row-check").forEach((box) => {
      box.checked = on;
      const id = Number(box.dataset.bulkId);
      if (on) selectedIds.add(id);
      else selectedIds.delete(id);
    });
    updateBulkBar();
  });
  byId("recruitmentPrev").addEventListener("click", () => { if (listPage > 1) { listPage -= 1; loadRecruitments(); } });
  byId("recruitmentNext").addEventListener("click", () => { if (listPage * PAGE_SIZE < listTotal) { listPage += 1; loadRecruitments(); } });

  window.adminPageRefreshHandler = loadRecruitments;
  wireExclusiveAccordion();
  wireDetailTabs();
  syncListDetailChrome(false);
  const params = new URLSearchParams(window.location.search);
  if (params.get("search")) {
    byId("recruitmentSearch").value = params.get("search");
  }
  const restored = window.AdminOpsSearch?.loadFilters(FILTER_SURFACE);
  if (restored && !params.get("search")) applyFiltersToForm(restored);
  renderSavedFilters();
  renderRecentSearches();
  renderDraftBinding();
  loadAvailableDrafts();
  byId("lifecycleManualUpdateBtn")?.addEventListener("click", () => {
    openAccordionSection("actions");
    byId("manualUpdateForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    byId("manualUpdateTitle")?.focus();
  });
  byId("lifecycleAddEventBtn")?.addEventListener("click", () => {
    openAccordionSection("lifecycle");
    showEventForm(null);
    focusEventTimeline();
  });
  const deepRecruitmentId = params.get("recruitment_id") || params.get("id");
  const createModeRequested = String(params.get("mode") || "").toLowerCase() === "create";
  loadRecruitments().then(async () => {
    if (deepRecruitmentId) {
      try {
        await selectRecruitment(deepRecruitmentId, { syncUrl: false });
        syncRecruitmentUrl(deepRecruitmentId, { replace: true });
      } catch (err) {
        message(err.message || "Could not open recruitment", true);
      }
    } else if (createModeRequested) {
      newRecruitment();
      syncRecruitmentUrl(null, { replace: true, mode: "create" });
    }
    await handleEventTimelineHash();
  });
  window.addEventListener("hashchange", handleEventTimelineHash);
  window.addEventListener("popstate", async () => {
    const nextParams = new URLSearchParams(window.location.search);
    const nextId = nextParams.get("recruitment_id") || nextParams.get("id");
    const nextCreate = String(nextParams.get("mode") || "").toLowerCase() === "create";
    if (nextId) {
      if (!selected || String(selected.id) !== String(nextId)) {
        await selectRecruitment(nextId, { syncUrl: false });
      } else {
        setIdentityEditMode(false);
        syncUiContext();
      }
      return;
    }
    if (nextCreate) {
      if (getUiMode() !== "create") newRecruitment();
      return;
    }
    if (selected || getUiMode() !== "list") {
      selected = null;
      events = [];
      linkedPages = [];
      linkedUpdates = [];
      linkedReviews = [];
      draftBinding = null;
      setEditorVisible(false);
      fillRecruitmentForm(null);
      setIdentityEditMode(false);
      renderEvents();
      renderLinks();
      renderLifecycleLinks();
      renderDraftBinding();
      if (window.AdminSharedPreview) window.AdminSharedPreview.clear();
      await loadRecruitments();
      syncUiContext();
    }
  });
})();
