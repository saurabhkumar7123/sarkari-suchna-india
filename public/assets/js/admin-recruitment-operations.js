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

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const labelize = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const statusHtml = (status) => `<span class="rom-status is-${escapeHtml(status)}">${escapeHtml(labelize(status))}</span>`;

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
    if (bar) bar.hidden = false;
    const label = byId("bulkSelectedCount");
    if (label) label.textContent = `${count} selected`;
    const selectAll = byId("bulkSelectAll");
    if (selectAll) {
      const boxes = Array.from(document.querySelectorAll(".rom-row-check"));
      selectAll.checked = boxes.length > 0 && boxes.every((b) => b.checked);
      selectAll.indeterminate = count > 0 && !selectAll.checked;
    }
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
      host.innerHTML = '<tr><td colspan="5" class="rom-empty">No recruitments found.</td></tr>';
      updateBulkBar();
      return;
    }
    host.innerHTML = rows.map((row) => {
      const checked = selectedIds.has(Number(row.id)) ? "checked" : "";
      return `<tr data-id="${row.id}" class="${selected?.id === row.id ? "is-selected" : ""}">
      <td><input type="checkbox" class="rom-row-check" data-bulk-id="${row.id}" ${checked} aria-label="Select recruitment ${escapeHtml(row.title)}"></td>
      <td><strong>${escapeHtml(row.title)}</strong><br><small>${escapeHtml(row.slug)}</small></td>
      <td>${escapeHtml(row.department || "—")}</td>
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
      byId("recruitmentPageLabel").textContent = `Page ${listPage} of ${pages}`;
      byId("recruitmentPrev").disabled = listPage <= 1;
      byId("recruitmentNext").disabled = listPage >= pages;
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
        selected = null;
        setEditorVisible(false);
      }
      await loadRecruitments();
    } catch (err) {
      message(err.message, true);
    }
  }

  function setEditorVisible(visible) {
    byId("recruitmentEmpty").hidden = visible;
    byId("recruitmentEditor").hidden = !visible;
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
    byId("recruitmentFormTitle").textContent = row?.id ? row.title : "New recruitment";
    byId("archiveRecruitmentBtn").hidden = !row?.id || row.lifecycle_state === "closed";
  }

  function updateWorkflow() {
    const steps = ["recruitment", "events", "links", "review"];
    let current = "recruitment";
    if (selected?.id) {
      if (!events.length) current = "events";
      else if (!linkedPages.length) current = "links";
      else if (draftBinding && draftBinding.drafts && draftBinding.drafts.length) current = "review";
      else current = "links";
    }
    const index = steps.indexOf(current);
    steps.forEach((step, i) => {
      const el = document.querySelector(`[data-workflow-step="${step}"]`);
      el.classList.toggle("is-complete", i < index);
      el.classList.toggle("is-current", i === index);
    });
  }

  function renderDraftBinding() {
    const statusEl = byId("draftBindingStatus");
    const workflowEl = byId("draftWorkflowLine");
    const rows = byId("draftBindingRows");
    const openReview = byId("openEditorialReviewBtn");
    if (!selected?.id) {
      statusEl.textContent = "No Draft";
      statusEl.className = "rom-status";
      workflowEl.textContent = "Workflow: —";
      rows.innerHTML = '<tr><td colspan="4" class="rom-empty">Select a recruitment to manage draft binding.</td></tr>';
      openReview.href = "/admin/editorial-review";
      return;
    }
    const binding = draftBinding || {};
    const status = binding.bindingStatus || "no_draft";
    statusEl.textContent = binding.bindingStatusLabel || "No Draft";
    statusEl.className = `rom-status is-${status}`;
    workflowEl.textContent = `Workflow: ${binding.workflowStateLabel || "Draft Created"}`;
    openReview.href = `/admin/editorial-review?recruitment_id=${encodeURIComponent(selected.id)}`;

    const drafts = binding.drafts || [];
    if (!drafts.length) {
      rows.innerHTML = '<tr><td colspan="4" class="rom-empty">No drafts attached.</td></tr>';
    } else {
      rows.innerHTML = drafts.map((draft) => {
        const isPrimary = Number(draft.id) === Number(binding.primaryDraftId);
        return `<tr>
          <td><strong>#${escapeHtml(draft.id)}</strong> ${escapeHtml(draft.title || "Untitled")}<br><small>${escapeHtml(draft.slugHint || "—")}</small></td>
          <td>${escapeHtml(draft.updatedAt || "—")}</td>
          <td>${isPrimary ? statusHtml("primary") : "Linked"}</td>
          <td><button type="button" class="rom-row-btn is-danger" data-detach-draft="${draft.id}">Detach</button></td>
        </tr>`;
      }).join("");
      rows.querySelectorAll("[data-detach-draft]").forEach((button) => {
        button.addEventListener("click", () => detachDraft(button.dataset.detachDraft));
      });
    }
    updateWorkflow();
  }

  async function loadAvailableDrafts() {
    const select = byId("draftBindSelect");
    try {
      const body = await api("/api/admin/draft-bindings/available-drafts?limit=30");
      const drafts = body.data || [];
      select.innerHTML = '<option value="">Select an unbound draft</option>' + drafts
        .map((draft) => `<option value="${draft.id}">#${draft.id} — ${escapeHtml(draft.title || "Untitled")}</option>`)
        .join("");
    } catch (err) {
      select.innerHTML = '<option value="">Unable to load drafts</option>';
      message(err.message, true);
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
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding/attach`, {
        method: "POST",
        body: { draft_id: draftId }
      });
      draftBinding = body.data;
      message("Draft attached.");
      notifyLocal(
        window.AdminOpsNotifications?.TYPES?.DRAFT_ATTACHED || "draft_attached",
        `Draft #${draftId} attached to recruitment #${selected.id}`,
        `/admin/editorial-review?recruitment_id=${selected.id}`
      );
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(err.message, true);
    }
  }

  async function replaceDraft() {
    if (!selected?.id) return;
    const draftId = byId("draftBindSelect").value;
    if (!draftId) {
      message("Select a draft to replace with.", true);
      return;
    }
    try {
      const body = await api(`/api/admin/recruitments/${selected.id}/draft-binding/replace`, {
        method: "POST",
        body: {
          draft_id: draftId,
          previous_draft_id: draftBinding?.primaryDraftId || null
        }
      });
      draftBinding = body.data;
      message("Linked draft replaced.");
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(err.message, true);
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
      message("Draft detached.");
      renderDraftBinding();
      await loadAvailableDrafts();
    } catch (err) {
      message(err.message, true);
    }
  }

  function renderEvents() {
    const host = byId("eventTimeline");
    const eventSelect = byId("pageLinkEvent");
    eventSelect.innerHTML = '<option value="">Recruitment-level link</option>' + events
      .map((event) => `<option value="${event.id}">${escapeHtml(labelize(event.event_type))} (#${event.id})</option>`).join("");
    if (!events.length) {
      host.innerHTML = '<li class="rom-empty">No lifecycle events yet.</li>';
      updateWorkflow();
      return;
    }
    host.innerHTML = events.map((event) => `<li data-event-id="${event.id}">
      <span class="rom-timeline__order">${escapeHtml(event.sequence_order)}</span>
      <span><strong>${escapeHtml(labelize(event.event_type))}</strong><br>${statusHtml(event.status)}</span>
      <span class="rom-row-actions">
        <button type="button" class="rom-row-btn" data-edit-event="${event.id}">Edit</button>
        <button type="button" class="rom-row-btn is-danger" data-delete-event="${event.id}">Delete</button>
      </span>
    </li>`).join("");
    host.querySelectorAll("[data-edit-event]").forEach((button) => button.addEventListener("click", () => editEvent(button.dataset.editEvent)));
    host.querySelectorAll("[data-delete-event]").forEach((button) => button.addEventListener("click", () => deleteEvent(button.dataset.deleteEvent)));
    updateWorkflow();
  }

  function renderLinks() {
    const host = byId("pageLinkRows");
    if (!linkedPages.length) {
      host.innerHTML = '<tr><td colspan="4" class="rom-empty">No pages attached.</td></tr>';
      updateWorkflow();
      return;
    }
    host.innerHTML = linkedPages.map((page) => {
      const event = events.find((item) => Number(item.id) === Number(page.recruitment_event_id));
      return `<tr><td><a href="/${encodeURIComponent(page.slug)}" target="_blank" rel="noopener">${escapeHtml(page.slug)}</a></td>
        <td>${escapeHtml(event ? labelize(event.event_type) : "Recruitment")}</td>
        <td>${statusHtml("linked")}</td>
        <td><button type="button" class="rom-row-btn is-danger" data-unlink-page="${page.id}">Detach</button></td></tr>`;
    }).join("");
    host.querySelectorAll("[data-unlink-page]").forEach((button) => button.addEventListener("click", () => unlinkPage(button.dataset.unlinkPage)));
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
          .map(
            (row) => `<tr>
            <td>#${escapeHtml(row.id)}</td>
            <td>${escapeHtml(row.title || "—")}</td>
            <td>${escapeHtml(row.recruitmentEventType || row.recruitment_event_type || "—")}</td>
            <td>${escapeHtml(row.siteName || row.site_id || "—")}</td>
          </tr>`
          )
          .join("");
      }
    }
    if (reviewRows) {
      if (!linkedReviews.length) {
        reviewRows.innerHTML = '<tr><td colspan="4" class="rom-empty">No linked reviews.</td></tr>';
      } else {
        reviewRows.innerHTML = linkedReviews
          .map(
            (row) => `<tr>
            <td><a href="/admin/recruitment-review-queue">#${escapeHtml(row.id)}</a></td>
            <td><span class="rrq-status is-${escapeHtml(String(row.status || "").toLowerCase())}">${escapeHtml(
              row.status || "—"
            )}</span></td>
            <td>${escapeHtml(row.event_type || "—")}</td>
            <td>${escapeHtml(row.update_id ?? "—")}</td>
          </tr>`
          )
          .join("");
      }
    }
  }

  async function selectRecruitment(id) {
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
      // Package 4D — shared preview panel (same model as Editorial Review).
      if (window.AdminSharedPreview) await window.AdminSharedPreview.show(selected.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  function newRecruitment() {
    selected = null;
    events = [];
    linkedPages = [];
    linkedUpdates = [];
    linkedReviews = [];
    draftBinding = null;
    setEditorVisible(true);
    fillRecruitmentForm(null);
    renderEvents();
    renderLinks();
    renderLifecycleLinks();
    renderDraftBinding();
    if (window.AdminSharedPreview) window.AdminSharedPreview.clear();
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
    try {
      const id = byId("recruitmentId").value;
      const body = await api(id ? `/api/admin/recruitments/${id}` : "/api/admin/recruitments", {
        method: id ? "PUT" : "POST", body: recruitmentPayload()
      });
      message(id ? "Recruitment updated." : "Recruitment created.");
      await selectRecruitment(body.data.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  async function archiveRecruitment() {
    if (!selected || !window.confirm(`Archive "${selected.title}"?`)) return;
    try {
      await api(`/api/admin/recruitments/${selected.id}`, { method: "PUT", body: { lifecycle_state: "closed" } });
      message("Recruitment archived. Existing events and page links were retained.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
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
      message(id ? "Event updated." : "Event added.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm("Delete this lifecycle event? Linked pages will remain attached to the recruitment.")) return;
    try {
      await api(`/api/admin/recruitment-events/${id}`, { method: "DELETE" });
      message("Event deleted.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
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
        ? `Page exists and is currently linked to recruitment #${page.recruitment_id}.`
        : "Page exists and is available to attach.";
      status.hidden = false;
    } catch (err) {
      status.textContent = err.message;
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
      message("Page attached. No publishing action was performed.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  async function unlinkPage(pageId) {
    if (!window.confirm("Detach this page from the recruitment?")) return;
    try {
      await api(`/api/admin/page-linkages?page_id=${encodeURIComponent(pageId)}`, { method: "DELETE" });
      message("Page detached.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  async function createManualUpdate(event) {
    event.preventDefault();
    if (!selected?.id) return;
    try {
      await api(`/api/admin/recruitments/${selected.id}/manual-update`, {
        method: "POST",
        body: {
          event_type: byId("manualUpdateEventType").value,
          title: byId("manualUpdateTitle").value.trim()
        }
      });
      byId("manualUpdateForm").reset();
      message("Manual update draft + review created. Not published.");
      await selectRecruitment(selected.id);
    } catch (err) {
      message(err.message, true);
    }
  }

  byId("eventType").innerHTML = EVENT_TYPES.map((type) => `<option value="${type}">${escapeHtml(labelize(type))}</option>`).join("");
  byId("newRecruitmentBtn").addEventListener("click", newRecruitment);
  byId("recruitmentForm").addEventListener("submit", saveRecruitment);
  byId("archiveRecruitmentBtn").addEventListener("click", archiveRecruitment);
  byId("cancelRecruitmentBtn").addEventListener("click", () => selected ? fillRecruitmentForm(selected) : setEditorVisible(false));
  byId("addEventBtn").addEventListener("click", () => showEventForm(null));
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
  loadRecruitments();
})();
