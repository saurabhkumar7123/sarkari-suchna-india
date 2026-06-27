/**
 * Generator parked drafts — collapsible sidebar + generator page bar.
 */
(function () {
  if (window.__generatorDraftsMounted) return;
  window.__generatorDraftsMounted = true;

  const MAX_LABEL = 20;
  let openSidebarSection = null;
  let openBarSection = null;

  const SIDEBAR_PANEL_HTML = `
  <div class="sidebar-drafts" id="sidebarGeneratorDrafts" aria-label="Generator parked drafts">
    <div class="sidebar-drafts__head">
      <span class="sidebar-drafts__title">Parked drafts</span>
      <span class="sidebar-drafts__count" id="sidebarDraftCount">Total 0</span>
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
      document.querySelector(".generator-hero") ||
      document.querySelector(".admin-workflow-banner") ||
      document.querySelector(".main-container");
    if (!host) return null;

    bar = document.createElement("aside");
    bar.id = "generatorDraftsBar";
    bar.className = "generator-drafts-bar";
    bar.hidden = true;
    bar.setAttribute("aria-label", "Parked drafts");
    bar.innerHTML = `
      <div class="generator-drafts-bar__head">
        <strong class="generator-drafts-bar__title">Parked drafts</strong>
        <span class="generator-drafts-bar__count" id="generatorDraftsBarTotal">Total 0</span>
      </div>
      <div class="generator-drafts-bar__section" data-draft-section="draft">
        <button type="button" class="generator-drafts-bar__toggle" data-draft-toggle="draft" aria-expanded="false">
          <span>Unpublished</span>
          <span class="generator-drafts-bar__badge" id="generatorDraftsBarBadgeDraft">0</span>
          <span class="generator-drafts-bar__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="generator-drafts-bar__body" id="generatorDraftsBarBodyDraft" hidden>
          <ul class="generator-drafts-bar__list" id="generatorDraftsBarListDraft" role="list"></ul>
          <p class="generator-drafts-bar__section-empty" id="generatorDraftsBarEmptyDraft" hidden>No unpublished drafts.</p>
        </div>
      </div>
      <div class="generator-drafts-bar__section" data-draft-section="published">
        <button type="button" class="generator-drafts-bar__toggle" data-draft-toggle="published" aria-expanded="false">
          <span>Published</span>
          <span class="generator-drafts-bar__badge is-muted" id="generatorDraftsBarBadgePublished">0</span>
          <span class="generator-drafts-bar__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="generator-drafts-bar__body" id="generatorDraftsBarBodyPublished" hidden>
          <ul class="generator-drafts-bar__list" id="generatorDraftsBarListPublished" role="list"></ul>
          <p class="generator-drafts-bar__section-empty" id="generatorDraftsBarEmptyPublished" hidden>No published-from-draft pages yet.</p>
        </div>
      </div>`;

    if (host.classList.contains("main-container")) {
      host.insertBefore(bar, host.firstChild);
    } else {
      host.insertAdjacentElement("afterend", bar);
    }
    bindBarAccordion(bar);
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

  function bindBarAccordion(bar) {
    if (!bar || bar.dataset.accordionBound === "1") return;
    bar.dataset.accordionBound = "1";
    bar.querySelectorAll("[data-draft-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleSection(bar, btn.getAttribute("data-draft-toggle"), "bar");
      });
    });
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

  function renderDraftRow(row, mode, ui) {
    const li = document.createElement("li");
    const title = truncate(row.title || "Untitled", 48);
    const when = formatWhen(row.updated_at || row.created_at);
    const href = buildDraftLink(row, mode);
    const isBar = ui === "bar";
    const itemClass = isBar ? "generator-drafts-bar__item" : "sidebar-drafts__item";
    const actionsClass = isBar ? "generator-drafts-bar__actions" : "sidebar-drafts__actions";

    li.className = itemClass;

    const main = document.createElement("div");
    main.className = isBar ? "generator-drafts-bar__row" : "sidebar-drafts__row";

    const titleEl = document.createElement("span");
    titleEl.className = isBar ? "generator-drafts-bar__row-title" : "sidebar-drafts__link-title";
    titleEl.textContent = title;
    titleEl.title = row.title || "Untitled";

    const meta = document.createElement("span");
    meta.className = isBar ? "generator-drafts-bar__row-meta" : "sidebar-drafts__link-meta";
    meta.textContent = when;

    main.appendChild(titleEl);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = actionsClass;

    const openBtn = document.createElement("a");
    openBtn.className = isBar ? "generator-drafts-bar__btn generator-drafts-bar__btn--open" : "sidebar-drafts__btn sidebar-drafts__btn--open";
    openBtn.href = href;
    openBtn.textContent = "Open";

    actions.appendChild(openBtn);

    if (mode === "draft") {
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
    if (bar && openBarSection) {
      setSectionOpen(bar, openBarSection, true, "bar");
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
    bindBarAccordion(bar);

    const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
    const published = Array.isArray(data?.published) ? data.published : [];
    const total = drafts.length + published.length;

    const totalEl = el("generatorDraftsBarTotal");
    if (totalEl) totalEl.textContent = `Total ${total}`;

    const badgeDraft = el("generatorDraftsBarBadgeDraft");
    if (badgeDraft) badgeDraft.textContent = String(drafts.length);

    const badgePub = el("generatorDraftsBarBadgePublished");
    if (badgePub) badgePub.textContent = String(published.length);

    fillList(el("generatorDraftsBarListDraft"), el("generatorDraftsBarEmptyDraft"), drafts, "draft", "bar");
    fillList(
      el("generatorDraftsBarListPublished"),
      el("generatorDraftsBarEmptyPublished"),
      published,
      "published",
      "bar"
    );

    bar.hidden = total === 0;
    restoreOpenSections(null, bar);
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
