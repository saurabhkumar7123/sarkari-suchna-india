/**
 * Generator parked drafts — collapsible sidebar + generator page bar.
 */
(function () {
  if (window.__generatorDraftsMounted) return;
  window.__generatorDraftsMounted = true;

  const MAX_LABEL = 20;
  let openSidebarSection = null;
  let openBarSection = "all";
  let barDraftCache = { drafts: [], published: [] };

  const SIDEBAR_PANEL_HTML = `
  <div class="sidebar-drafts" id="sidebarGeneratorDrafts" aria-label="Generator parked drafts">
    <div class="sidebar-drafts__head">
      <span class="sidebar-drafts__title">Parked drafts</span>
      <span class="sidebar-drafts__count" id="sidebarDraftCount">Total 0</span>
      <span class="sidebar-drafts__capacity" id="sidebarDraftCapacity" title="Unpublished draft capacity">0 / 20</span>
    </div>
    <p class="sidebar-drafts__error" id="sidebarDraftsError" hidden></p>
    <div class="sidebar-drafts__section" data-draft-section="draft">
      <button type="button" class="sidebar-drafts__toggle" data-draft-toggle="draft" aria-expanded="false">
        <span class="sidebar-drafts__toggle-label">Unpublished</span>
        <span class="sidebar-drafts__badge" id="sidebarDraftBadgeDraft">0</span>
        <span class="sidebar-drafts__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="sidebar-drafts__body" id="sidebarDraftBodyDraft" hidden>
        <ul class="sidebar-drafts__list" id="sidebarDraftListDraft" role="list"></ul>
        <p class="sidebar-drafts__section-empty" id="sidebarDraftEmptyDraft" hidden>No unpublished drafts.</p>
      </div>
    </div>
    <div class="sidebar-drafts__section sidebar-drafts__section--published" data-draft-section="published">
      <button type="button" class="sidebar-drafts__toggle" data-draft-toggle="published" aria-expanded="false">
        <span class="sidebar-drafts__toggle-label">Published</span>
        <span class="sidebar-drafts__badge is-muted" id="sidebarDraftBadgePublished">0</span>
        <span class="sidebar-drafts__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="sidebar-drafts__body" id="sidebarDraftBodyPublished" hidden>
        <ul class="sidebar-drafts__list" id="sidebarDraftListPublished" role="list"></ul>
        <p class="sidebar-drafts__section-empty" id="sidebarDraftEmptyPublished" hidden>No published-from-draft pages yet.</p>
      </div>
    </div>
    <p class="sidebar-drafts__empty" id="sidebarDraftsEmpty">No parked drafts yet. Use <strong>Save draft</strong> in the generator.</p>
  </div>`;

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function truncate(s, n) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return `${t.slice(0, n - 1)}…`;
  }

  function isGeneratorPage() {
    return /\/generator/i.test(String(window.location.pathname || ""));
  }

  function buildDraftLink(row, mode) {
    if (mode === "published" && row.published_slug) {
      return `/generator?slug=${encodeURIComponent(row.published_slug)}`;
    }
    return `/generator?draftId=${encodeURIComponent(row.id)}`;
  }

  function ensureSidebarPanel() {
    if (el("sidebarGeneratorDrafts")) return true;

    const generatorLink =
      document.querySelector('#sidebar a[href="/generator"]') ||
      document.querySelector('#sidebar a[data-nav-path="/generator"]');
    const nav = document.querySelector("#sidebar .sidebar-nav") || document.getElementById("sidebar");
    if (!nav) return false;

    const wrap = document.createElement("div");
    wrap.innerHTML = SIDEBAR_PANEL_HTML.trim();
    const panel = wrap.firstElementChild;
    if (!panel) return false;

    if (generatorLink) {
      generatorLink.insertAdjacentElement("afterend", panel);
    } else {
      nav.appendChild(panel);
    }
    bindSidebarAccordion(panel);
    return true;
  }

  function ensureGeneratorBar() {
    if (!isGeneratorPage()) return null;
    let bar = el("generatorDraftsBar");
    if (bar) return bar;

    const host =
      document.getElementById("drafts") ||
      document.querySelector(".generator-hero") ||
      document.querySelector(".admin-workflow-banner") ||
      document.querySelector(".main-container");
    if (!host) return null;

    bar = document.createElement("aside");
    bar.id = "generatorDraftsBar";
    bar.className = "generator-drafts-bar";
    bar.hidden = true;
    bar.setAttribute("aria-label", "Saved Draft Management");
    bar.innerHTML = `
      <div class="generator-drafts-bar__head">
        <strong class="generator-drafts-bar__title">Saved Draft Management</strong>
        <span class="generator-drafts-bar__count" id="generatorDraftsBarTotal">Total 0</span>
        <span class="generator-drafts-bar__capacity" id="generatorDraftsBarCapacity" title="Unpublished draft capacity">0 / 20</span>
      </div>
      <div class="generator-drafts-bar__filters" role="tablist" aria-label="Draft status">
        <button type="button" class="generator-drafts-bar__filter is-active" data-draft-filter="all" aria-selected="true">All</button>
        <button type="button" class="generator-drafts-bar__filter" data-draft-filter="draft" aria-selected="false">
          Unpublished <span class="generator-drafts-bar__badge" id="generatorDraftsBarBadgeDraft">0</span>
        </button>
        <button type="button" class="generator-drafts-bar__filter" data-draft-filter="published" aria-selected="false">
          Published <span class="generator-drafts-bar__badge is-muted" id="generatorDraftsBarBadgePublished">0</span>
        </button>
      </div>
      <div class="generator-drafts-bar__table-wrap">
        <table class="generator-drafts-bar__table" aria-label="Saved drafts">
          <thead>
            <tr>
              <th scope="col">Draft / Recruitment</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody id="generatorDraftsBarTableBody"></tbody>
        </table>
        <p class="generator-drafts-bar__section-empty" id="generatorDraftsBarEmpty" hidden>No saved drafts yet.</p>
      </div>`;

    if (host.classList.contains("main-container")) {
      host.insertBefore(bar, host.firstChild);
    } else {
      host.insertAdjacentElement("afterend", bar);
    }
    bindBarFilters(bar);
    return bar;
  }

  function setSectionOpen(root, section, open, prefix) {
    const isSidebar = prefix === "sidebar";
    const bodyId =
      section === "draft"
        ? isSidebar
          ? "sidebarDraftBodyDraft"
          : "generatorDraftsBarBodyDraft"
        : isSidebar
          ? "sidebarDraftBodyPublished"
          : "generatorDraftsBarBodyPublished";
    const body = el(bodyId);
    const toggle = root.querySelector(`[data-draft-toggle="${section}"]`);
    const wrap = root.querySelector(`[data-draft-section="${section}"]`);

    if (body) body.hidden = !open;
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (wrap) wrap.classList.toggle("is-open", open);
  }

  function closeAllSections(root, prefix) {
    ["draft", "published"].forEach((section) => setSectionOpen(root, section, false, prefix));
    if (prefix === "sidebar") openSidebarSection = null;
    else openBarSection = null;
  }

  function toggleSection(root, section, prefix) {
    const current = prefix === "sidebar" ? openSidebarSection : openBarSection;
    const willOpen = current !== section;
    closeAllSections(root, prefix);
    if (willOpen) {
      setSectionOpen(root, section, true, prefix);
      if (prefix === "sidebar") openSidebarSection = section;
      else openBarSection = section;
    }
  }

  function bindSidebarAccordion(panel) {
    if (!panel || panel.dataset.accordionBound === "1") return;
    panel.dataset.accordionBound = "1";
    panel.querySelectorAll("[data-draft-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSection(panel, btn.getAttribute("data-draft-toggle"), "sidebar");
      });
    });
  }

  function bindBarFilters(bar) {
    if (!bar || bar.dataset.filtersBound === "1") return;
    bar.dataset.filtersBound = "1";
    bar.querySelectorAll("[data-draft-filter]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const filter = btn.getAttribute("data-draft-filter") || "all";
        openBarSection = filter;
        bar.querySelectorAll("[data-draft-filter]").forEach((el) => {
          const active = el.getAttribute("data-draft-filter") === filter;
          el.classList.toggle("is-active", active);
          el.setAttribute("aria-selected", active ? "true" : "false");
        });
        renderBarTable(barDraftCache.drafts, barDraftCache.published, filter);
      });
    });
  }

  function bindBarAccordion(bar) {
    // Legacy accordion removed — filters replace toggles.
    bindBarFilters(bar);
  }

  function renderBarTableRow(row, listMode) {
    const tr = document.createElement("tr");
    tr.dataset.draftStatus = listMode;
    const title = truncate(row.title || "Untitled", 64);
    const when = formatWhen(row.updated_at || row.updatedAt || row.created_at || row.createdAt);
    const href = buildDraftLink(row, listMode);
    const isPublished = listMode === "published" || String(row.status || "").toLowerCase() === "published";
    const status = String(row.status || row.workflow_state || (isPublished ? "Published" : "Draft")).trim();
    const recruitment = row.recruitmentTitle
      ? row.recruitmentTitle
      : row.recruitmentId
        ? `Recruitment #${row.recruitmentId}`
        : "Not bound";

    const identityTd = document.createElement("td");
    identityTd.className = "generator-drafts-bar__cell-identity";
    identityTd.innerHTML = `
      <strong class="generator-drafts-bar__row-title" title="${escapeHtml(row.title || "Untitled")}">${escapeHtml(title)}</strong>
      <span class="generator-drafts-bar__row-meta">
        ${row.id != null ? `Draft #${escapeHtml(String(row.id))} · ` : ""}${escapeHtml(recruitment)}
      </span>`;

    const statusTd = document.createElement("td");
    statusTd.className = "generator-drafts-bar__cell-status";
    statusTd.innerHTML = `<span class="generator-drafts-bar__status ${isPublished ? "is-published" : "is-draft"}">${escapeHtml(status)}</span>`;

    const updatedTd = document.createElement("td");
    updatedTd.className = "generator-drafts-bar__cell-updated";
    updatedTd.textContent = when || "—";

    const actionsTd = document.createElement("td");
    actionsTd.className = "generator-drafts-bar__cell-actions";
    const actions = document.createElement("div");
    actions.className = "generator-drafts-bar__actions";

    if (!isPublished) {
      const openBtn = document.createElement("a");
      openBtn.className = "generator-drafts-bar__btn generator-drafts-bar__btn--open";
      openBtn.href = href;
      openBtn.textContent = "Open";
      actions.appendChild(openBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "generator-drafts-bar__btn generator-drafts-bar__btn--delete";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteDraft(row.id, title);
      });
      actions.appendChild(delBtn);
    } else if (row.published_slug || row.publishedSlug || row.publicPageSlug) {
      const slug = row.published_slug || row.publishedSlug || row.publicPageSlug;
      const openLive = document.createElement("a");
      openLive.className = "generator-drafts-bar__btn generator-drafts-bar__btn--open";
      openLive.href = `/generator?slug=${encodeURIComponent(slug)}`;
      openLive.textContent = "Open";
      actions.appendChild(openLive);
    }

    if (row.recruitmentId) {
      const recBtn = document.createElement("a");
      recBtn.className = "generator-drafts-bar__btn";
      recBtn.href = `/admin/recruitments?recruitment_id=${encodeURIComponent(row.recruitmentId)}`;
      recBtn.textContent = "Recruitment";
      actions.appendChild(recBtn);
    }

    actionsTd.appendChild(actions);
    tr.appendChild(identityTd);
    tr.appendChild(statusTd);
    tr.appendChild(updatedTd);
    tr.appendChild(actionsTd);
    return tr;
  }

  function renderBarTable(drafts, published, filter) {
    const body = el("generatorDraftsBarTableBody");
    const emptyEl = el("generatorDraftsBarEmpty");
    if (!body) return;
    body.innerHTML = "";

    const showDraft = filter === "all" || filter === "draft";
    const showPublished = filter === "all" || filter === "published";
    const rows = [];
    if (showDraft) drafts.forEach((row) => rows.push(renderBarTableRow(row, "draft")));
    if (showPublished) published.forEach((row) => rows.push(renderBarTableRow(row, "published")));
    rows.forEach((tr) => body.appendChild(tr));

    if (emptyEl) {
      emptyEl.hidden = rows.length > 0;
      if (!rows.length) {
        emptyEl.textContent =
          filter === "published"
            ? "No published-from-draft pages yet."
            : filter === "draft"
              ? "No unpublished drafts."
              : "No saved drafts yet.";
      }
    }
  }

  async function apiRequest(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (String(url).includes("/api/admin") && typeof window.getAdminCsrfToken === "function") {
      try {
        headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
      } catch (err) {
        console.warn("[generator-drafts] CSRF token failed", err);
      }
    }
    if (typeof options.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers
    });

    const ct = res.headers.get("content-type") || "";
    let body = null;
    if (ct.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    }

    if (!res.ok) {
      const message =
        (body && (body.message || body.error)) || `Request failed (${res.status})`;
      return { ok: false, message, status: res.status };
    }

    if (body && body.success === true && body.data != null) {
      return { ok: true, data: body.data };
    }
    if (body && body.success === false) {
      return { ok: false, message: body.message || "Request failed" };
    }
    return { ok: true, data: body };
  }

  async function fetchDrafts() {
    const res = await apiRequest("/api/admin/generator-drafts");
    if (!res.ok) {
      console.warn("[generator-drafts] list failed", res.message);
      return { error: res.message || "Could not load drafts" };
    }
    return { data: res.data || null };
  }

  async function deleteDraft(id, title) {
    const ok = window.confirm(`Delete draft #${id}?\n\n"${title}"\n\nThis cannot be undone.`);
    if (!ok) return;
    const delRes = await apiRequest(`/api/admin/generator-drafts/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!delRes.ok) {
      window.alert(delRes.message || "Could not delete draft.");
      return;
    }
    refreshGeneratorDraftsSidebar();
  }

  function renderDraftRow(row, listMode, ui) {
    const li = document.createElement("li");
    const title = truncate(row.title || "Untitled", 48);
    const when = formatWhen(row.updated_at || row.updatedAt || row.created_at || row.createdAt);
    const href = buildDraftLink(row, listMode);
    const isBar = ui === "bar";
    const itemClass = isBar ? "generator-drafts-bar__item" : "sidebar-drafts__item";
    const actionsClass = isBar ? "generator-drafts-bar__actions" : "sidebar-drafts__actions";
    const isPublished = listMode === "published" || String(row.status || "").toLowerCase() === "published";

    li.className = itemClass;

    const main = document.createElement("div");
    main.className = isBar ? "generator-drafts-bar__row" : "sidebar-drafts__row";

    const titleEl = document.createElement("span");
    titleEl.className = isBar ? "generator-drafts-bar__row-title" : "sidebar-drafts__link-title";
    titleEl.textContent = title;
    titleEl.title = row.title || "Untitled";

    const meta = document.createElement("span");
    meta.className = isBar ? "generator-drafts-bar__row-meta" : "sidebar-drafts__link-meta";
    const status = String(row.status || row.workflow_state || (isPublished ? "Published" : "Draft")).trim();
    const recruitment = row.recruitmentTitle
      ? row.recruitmentTitle
      : row.recruitmentId
        ? `Recruitment #${row.recruitmentId}`
        : "NOT BOUND";
    const eventName = row.eventLabel || "—";
    const pageSlug =
      row.publicPageSlug ||
      row.publishedSlug ||
      row.published_slug ||
      (row.publicPageAmbiguous ? "(ambiguous)" : "—");
    const generatorMode = String(
      row.generatorMode || (pageSlug !== "—" && pageSlug !== "(ambiguous)" ? "UPDATE" : "CREATE")
    ).toUpperCase();
    const extraction =
      row.extractionCode ||
      row.extractionStatus ||
      (row.conversionRequired ? "conversion_required" : "—");
    const validation = row.validationStatus || "—";
    const nextAction =
      row.nextAction ||
      (isPublished
        ? "Immutable history"
        : !row.recruitmentId
          ? "Resolve Recruitment"
          : "Open Generator → Preview → Manual Publish");
    meta.innerHTML = [
      row.id != null ? `<span>Draft #${escapeHtml(String(row.id))}</span>` : "",
      `<span>Recruitment: ${escapeHtml(recruitment)}</span>`,
      `<span>Event: ${escapeHtml(eventName)}</span>`,
      `<span>Public Page: ${escapeHtml(pageSlug === "—" || pageSlug === "(ambiguous)" ? pageSlug : "/" + String(pageSlug).replace(/^\//, ""))}</span>`,
      `<span>Mode: ${escapeHtml(generatorMode)}</span>`,
      `<span>Status: ${escapeHtml(status)}</span>`,
      `<span>Extraction: ${escapeHtml(String(extraction))}</span>`,
      `<span>Validation: ${escapeHtml(String(validation))}</span>`,
      `<span>Next Action: ${escapeHtml(nextAction)}</span>`,
      when ? `<span>${escapeHtml(when)}</span>` : ""
    ]
      .filter(Boolean)
      .join(" · ");

    main.appendChild(titleEl);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = actionsClass;

    if (!isPublished) {
      const openBtn = document.createElement("a");
      openBtn.className = isBar
        ? "generator-drafts-bar__btn generator-drafts-bar__btn--open"
        : "sidebar-drafts__btn sidebar-drafts__btn--open";
      openBtn.href = href;
      openBtn.textContent = isBar ? "Open Draft" : "Open";
      actions.appendChild(openBtn);

      const previewBtn = document.createElement("a");
      previewBtn.className = isBar
        ? "generator-drafts-bar__btn"
        : "sidebar-drafts__btn";
      previewBtn.href = `/generator?draftId=${encodeURIComponent(row.id)}#gen-step-preview`;
      previewBtn.textContent = "Preview";
      actions.appendChild(previewBtn);
    } else if (row.published_slug || row.publishedSlug || row.publicPageSlug) {
      const slug = row.published_slug || row.publishedSlug || row.publicPageSlug;
      const openLive = document.createElement("a");
      openLive.className = isBar
        ? "generator-drafts-bar__btn generator-drafts-bar__btn--open"
        : "sidebar-drafts__btn sidebar-drafts__btn--open";
      openLive.href = `/generator?slug=${encodeURIComponent(slug)}`;
      openLive.textContent = "Open Public Page";
      actions.appendChild(openLive);
    }

    if (row.recruitmentId) {
      const recBtn = document.createElement("a");
      recBtn.className = isBar ? "generator-drafts-bar__btn" : "sidebar-drafts__btn";
      recBtn.href = `/admin/recruitments?recruitment_id=${encodeURIComponent(row.recruitmentId)}`;
      recBtn.textContent = "Open Recruitment";
      actions.appendChild(recBtn);
    }

    if (!isPublished && (row.publicPageSlug || row.publishedSlug || row.published_slug)) {
      const slug = row.publicPageSlug || row.publishedSlug || row.published_slug;
      const pageBtn = document.createElement("a");
      pageBtn.className = isBar ? "generator-drafts-bar__btn" : "sidebar-drafts__btn";
      pageBtn.href = `/${encodeURIComponent(slug)}`;
      pageBtn.target = "_blank";
      pageBtn.rel = "noopener";
      pageBtn.textContent = "Open Public Page";
      actions.appendChild(pageBtn);
    }

    // Unpublished working drafts only — never delete published history.
    if (listMode === "draft" && !isPublished) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = isBar
        ? "generator-drafts-bar__btn generator-drafts-bar__btn--delete"
        : "sidebar-drafts__btn sidebar-drafts__btn--delete";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteDraft(row.id, title);
      });
      actions.appendChild(delBtn);
    }

    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  function fillList(listEl, emptyEl, rows, mode, ui) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const hasRows = rows.length > 0;
    if (emptyEl) emptyEl.hidden = hasRows;
    rows.forEach((row) => listEl.appendChild(renderDraftRow(row, mode, ui)));
  }

  function restoreOpenSections(panel, bar) {
    if (panel && openSidebarSection) {
      setSectionOpen(panel, openSidebarSection, true, "sidebar");
    }
    if (bar) {
      bindBarFilters(bar);
      bar.querySelectorAll("[data-draft-filter]").forEach((elBtn) => {
        const active = elBtn.getAttribute("data-draft-filter") === (openBarSection || "all");
        elBtn.classList.toggle("is-active", active);
        elBtn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
  }

  function renderPanel(data, errorMessage) {
    ensureSidebarPanel();
    const panel = el("sidebarGeneratorDrafts");
    if (!panel) return;
    bindSidebarAccordion(panel);

    const errEl = el("sidebarDraftsError");
    if (errEl) {
      if (errorMessage) {
        errEl.textContent = errorMessage;
        errEl.hidden = false;
      } else {
        errEl.textContent = "";
        errEl.hidden = true;
      }
    }

    const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
    const published = Array.isArray(data?.published) ? data.published : [];
    const draftCount = data?.draftCount != null ? Number(data.draftCount) : drafts.length;
    const maxDrafts = data?.maxDrafts != null ? Number(data.maxDrafts) : MAX_LABEL;
    const total = drafts.length + published.length;

    const countEl = el("sidebarDraftCount");
    if (countEl) countEl.textContent = `Total ${total}`;

    const capacityEl = el("sidebarDraftCapacity");
    if (capacityEl) {
      const used = Number.isFinite(draftCount) ? draftCount : drafts.length;
      const max = Number.isFinite(maxDrafts) && maxDrafts > 0 ? maxDrafts : MAX_LABEL;
      capacityEl.textContent = `${used} / ${max}`;
      capacityEl.classList.toggle("is-near-limit", used >= Math.max(1, Math.floor(max * 0.8)));
      capacityEl.title = `Unpublished drafts ${used} of ${max} capacity`;
    }

    const navDrafts = document.getElementById("navDraftsLink");
    if (navDrafts) {
      let badge = document.getElementById("navDraftsBadge");
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "navDraftsBadge";
        badge.className = "nav-badge";
        navDrafts.appendChild(badge);
      }
      badge.textContent = String(drafts.length);
      badge.hidden = drafts.length === 0;
    }

    const badgeDraft = el("sidebarDraftBadgeDraft");
    if (badgeDraft) badgeDraft.textContent = String(drafts.length);

    const badgePub = el("sidebarDraftBadgePublished");
    if (badgePub) badgePub.textContent = String(published.length);

    fillList(el("sidebarDraftListDraft"), el("sidebarDraftEmptyDraft"), drafts, "draft", "sidebar");
    fillList(el("sidebarDraftListPublished"), el("sidebarDraftEmptyPublished"), published, "published", "sidebar");

    const empty = el("sidebarDraftsEmpty");
    if (empty) {
      const showEmpty = !errorMessage && total === 0;
      empty.hidden = !showEmpty;
      panel.classList.toggle("is-empty", showEmpty);
    }

    panel.classList.toggle("has-drafts", drafts.length > 0);
    panel.classList.toggle("has-published", published.length > 0);
    panel.hidden = false;

    restoreOpenSections(panel, null);
  }

  function renderGeneratorBar(data) {
    const bar = ensureGeneratorBar();
    if (!bar) return;
    bindBarFilters(bar);

    const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
    const published = Array.isArray(data?.published) ? data.published : [];
    barDraftCache = { drafts, published };
    const draftCount = data?.draftCount != null ? Number(data.draftCount) : drafts.length;
    const maxDrafts = data?.maxDrafts != null ? Number(data.maxDrafts) : MAX_LABEL;
    const total = drafts.length + published.length;

    const totalEl = el("generatorDraftsBarTotal");
    if (totalEl) totalEl.textContent = `Total ${total}`;

    const capacityEl = el("generatorDraftsBarCapacity");
    if (capacityEl) {
      const used = Number.isFinite(draftCount) ? draftCount : drafts.length;
      const max = Number.isFinite(maxDrafts) && maxDrafts > 0 ? maxDrafts : MAX_LABEL;
      capacityEl.textContent = `${used} / ${max}`;
      capacityEl.classList.toggle("is-near-limit", used >= Math.max(1, Math.floor(max * 0.8)));
      capacityEl.title = `Unpublished drafts ${used} of ${max} capacity`;
    }

    const badgeDraft = el("generatorDraftsBarBadgeDraft");
    if (badgeDraft) badgeDraft.textContent = String(drafts.length);

    const badgePub = el("generatorDraftsBarBadgePublished");
    if (badgePub) badgePub.textContent = String(published.length);

    const hashDrafts = String(window.location.hash || "") === "#drafts";
    if (hashDrafts && (!openBarSection || openBarSection === "all")) {
      openBarSection = "all";
    }

    bar.querySelectorAll("[data-draft-filter]").forEach((elBtn) => {
      const active = elBtn.getAttribute("data-draft-filter") === openBarSection;
      elBtn.classList.toggle("is-active", active);
      elBtn.setAttribute("aria-selected", active ? "true" : "false");
    });

    renderBarTable(drafts, published, openBarSection || "all");

    bar.hidden = total === 0 && !hashDrafts;
    if (hashDrafts) {
      bar.hidden = false;
    }
  }

  async function refreshGeneratorDraftsSidebar() {
    ensureSidebarPanel();
    const panel = el("sidebarGeneratorDrafts");
    if (panel) panel.classList.add("is-loading");

    try {
      const result = await fetchDrafts();
      if (result.error) {
        renderPanel({ drafts: [], published: [], draftCount: 0, maxDrafts: MAX_LABEL }, result.error);
        renderGeneratorBar({ drafts: [], published: [] });
        return;
      }
      const data = result.data || { drafts: [], published: [], draftCount: 0, maxDrafts: MAX_LABEL };
      renderPanel(data, "");
      renderGeneratorBar(data);
    } catch (err) {
      console.warn("[generator-drafts] refresh failed", err);
      renderPanel({ drafts: [], published: [] }, "Could not load drafts. Refresh the page.");
    } finally {
      if (panel) panel.classList.remove("is-loading");
    }
  }

  function init() {
    ensureSidebarPanel();
    ensureGeneratorBar();
    refreshGeneratorDraftsSidebar();
    window.refreshGeneratorDraftsSidebar = refreshGeneratorDraftsSidebar;
    window.addEventListener("hashchange", () => {
      if (!isGeneratorPage()) return;
      const bar = el("generatorDraftsBar");
      if (!bar) return;
      if (String(window.location.hash || "") === "#drafts") {
        openBarSection = "all";
        bar.hidden = false;
        bar.querySelectorAll("[data-draft-filter]").forEach((elBtn) => {
          const active = elBtn.getAttribute("data-draft-filter") === "all";
          elBtn.classList.toggle("is-active", active);
          elBtn.setAttribute("aria-selected", active ? "true" : "false");
        });
        renderBarTable(barDraftCache.drafts, barDraftCache.published, "all");
      }
    });
  }

  function scheduleInit() {
    if (document.getElementById("sidebar") || isGeneratorPage()) {
      init();
      return;
    }
    window.setTimeout(scheduleInit, 120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInit);
  } else {
    scheduleInit();
  }

  document.addEventListener("adminNavHydrated", () => {
    ensureSidebarPanel();
    refreshGeneratorDraftsSidebar();
  });
})();
