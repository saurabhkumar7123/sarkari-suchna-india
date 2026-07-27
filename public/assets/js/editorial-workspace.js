/**
 * Phase PI-2 — Editorial Workspace Pro: UI layer.
 *
 * Presentation only. Renders Smart Review Dashboard, checklist, issues,
 * AI-4 suggestions (dismiss / reviewed / hide), section navigator, draft
 * health, link inspector, duplicates, change summary, and shortcuts.
 *
 * Never mutates draft content, never calls publish, never invents API calls.
 * Consumes data already returned by `/api/admin/editorial-reviews/:id`.
 */
(function () {
  "use strict";

  const core = window.EditorialWorkspaceCore;
  if (!core) return;

  const STORAGE_PREFIX = "pi2.editorial.";
  const OPEN_KEY = STORAGE_PREFIX + "open";
  const NAV_KEY = STORAGE_PREFIX + "navOpen";

  const state = {
    ready: false,
    open: true,
    navOpen: true,
    model: null,
    workspace: null,
    previousDraftText: "",
    activeIssueIndex: -1,
    activeSectionIndex: -1,
    suggestionState: {},
    statusMessage: ""
  };

  const els = {};

  const ws = window.AdminWorkspaceUI || {};
  const escapeHtml =
    ws.escapeHtml ||
    function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };
  const bandClass = ws.bandClass || function (band) {
    return band === "high" ? "is-high" : band === "medium" ? "is-medium" : "is-low";
  };
  const storageGet = ws.storageGet || function (key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      if (v == null) return fallback;
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false") return false;
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };
  const storageSet = ws.storageSet || function (key, value) {
    try {
      if (typeof value === "boolean") window.localStorage.setItem(key, value ? "1" : "0");
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  };
  const emptyRow =
    ws.emptyRow ||
    function (message, className) {
      return `<li class="${escapeHtml(className || "ew-empty-row")}">${escapeHtml(message || "None")}</li>`;
    };

  function byId(id) {
    return document.getElementById(id);
  }

  function suggestionStorageKey() {
    const id = state.workspace && state.workspace.draft && state.workspace.draft.id;
    return STORAGE_PREFIX + "suggestions." + (id || "none");
  }

  function loadSuggestionState() {
    state.suggestionState = storageGet(suggestionStorageKey(), {}) || {};
  }

  function saveSuggestionState() {
    storageSet(suggestionStorageKey(), state.suggestionState || {});
  }

  function setStatus(text) {
    state.statusMessage = text || "";
    if (els.status) els.status.textContent = state.statusMessage;
  }

  function readinessLabel(value) {
    if (value === core.READINESS.READY) return "Ready for decision";
    if (value === core.READINESS.NEEDS_WORK) return "Needs work";
    if (value === core.READINESS.BLOCKED) return "Blocked";
    return "No draft";
  }

  function checklistLabel(status) {
    if (status === core.CHECKLIST_STATUS.COMPLETE) return "Complete";
    if (status === core.CHECKLIST_STATUS.NEEDS_REVIEW) return "Needs Review";
    return "Missing";
  }

  function visibleSuggestions() {
    const model = state.model;
    if (!model) return [];
    return (model.suggestions || []).filter((s) => {
      const st = state.suggestionState[s.id] || {};
      return !st.hidden && !st.dismissed;
    });
  }

  function renderDashboard() {
    if (!els.dashboard || !state.model) return;
    const d = state.model.dashboard;
    els.dashboard.innerHTML = `
      <div class="ew-metric"><span class="ew-metric__label">Overall quality</span><strong class="${bandClass(core.scoreBand(d.overallQuality))}">${escapeHtml(d.overallQuality)}<small>/100</small></strong></div>
      <div class="ew-metric"><span class="ew-metric__label">Completeness</span><strong class="${bandClass(core.scoreBand(d.completeness))}">${escapeHtml(d.completeness)}%</strong></div>
      <div class="ew-metric"><span class="ew-metric__label">Consistency</span><strong class="${bandClass(core.scoreBand(d.consistency))}">${escapeHtml(d.consistency)}%</strong></div>
      <div class="ew-metric"><span class="ew-metric__label">Confidence</span><strong class="${bandClass(core.scoreBand(d.confidence))}">${escapeHtml(d.confidence)}%</strong></div>
      <div class="ew-metric"><span class="ew-metric__label">Editing effort</span><strong>${escapeHtml(d.estimatedEditingEffort)}</strong></div>
      <div class="ew-metric ew-metric--ready is-${escapeHtml(d.readiness)}"><span class="ew-metric__label">Readiness</span><strong>${escapeHtml(readinessLabel(d.readiness))}</strong></div>`;
    if (els.briefing) {
      els.briefing.textContent = d.briefing || "Open a recruitment with a linked draft to load AI-4 review signals.";
    }
  }

  function renderChecklist() {
    if (!els.checklist || !state.model) return;
    els.checklist.innerHTML = (state.model.checklist || [])
      .map(
        (item) => `<li class="ew-check is-${escapeHtml(item.status)}" data-section="${escapeHtml(item.sectionType)}">
        <button type="button" class="ew-check__btn" data-jump-section="${escapeHtml(item.sectionType)}">
          <span>${escapeHtml(item.label)}</span>
          <span class="ew-pill is-${escapeHtml(item.status)}">${escapeHtml(checklistLabel(item.status))}</span>
        </button>
      </li>`
      )
      .join("");
  }

  function renderIssues() {
    if (!els.issues || !state.model) return;
    const groups = state.model.issueGroups || {};
    els.issues.innerHTML = core.SEVERITY_ORDER.map((sev) => {
      const rows = groups[sev] || [];
      return `<div class="ew-issue-group is-${escapeHtml(sev.toLowerCase())}">
        <h4>${escapeHtml(sev)} <span>${rows.length}</span></h4>
        <ul>${
          rows.length
            ? rows
                .map(
                  (issue, idx) => `<li class="ew-issue" data-issue-id="${escapeHtml(issue.id)}" data-issue-global="${escapeHtml(String(state.model.issues.indexOf(issue)))}">
            <button type="button" class="ew-issue__btn" data-jump-issue="${escapeHtml(issue.id)}">
              <strong>${escapeHtml(issue.message)}</strong>
              <small>${escapeHtml(issue.sectionType || issue.code || "General")}</small>
            </button>
          </li>`
                )
                .join("")
              : emptyRow()
        }</ul>
      </div>`;
    }).join("");
  }

  function renderSuggestions() {
    if (!els.suggestions || !state.model) return;
    const rows = visibleSuggestions();
    const reviewedCount = (state.model.suggestions || []).filter((s) => (state.suggestionState[s.id] || {}).reviewed).length;
    els.suggestions.innerHTML =
      `<p class="ew-help">AI-4 suggestions — advisory only. Never applied automatically. ${reviewedCount} marked reviewed.</p>` +
      (rows.length
        ? rows
            .map((s) => {
              const st = state.suggestionState[s.id] || {};
              return `<article class="ew-suggestion is-${escapeHtml(s.severity.toLowerCase())}${st.reviewed ? " is-reviewed" : ""}" data-suggestion-id="${escapeHtml(s.id)}">
            <header>
              <strong>${escapeHtml(s.title)}</strong>
              <span class="ew-pill is-${escapeHtml(s.severity.toLowerCase())}">${escapeHtml(s.severity)}</span>
            </header>
            <p>${escapeHtml(s.detail || "")}</p>
            <div class="ew-suggestion__actions">
              <button type="button" data-sug-action="reviewed" data-sug-id="${escapeHtml(s.id)}">Mark Reviewed</button>
              <button type="button" data-sug-action="dismiss" data-sug-id="${escapeHtml(s.id)}">Dismiss</button>
              <button type="button" data-sug-action="hide" data-sug-id="${escapeHtml(s.id)}">Hide</button>
              ${
                s.sectionType
                  ? `<button type="button" data-jump-section="${escapeHtml(s.sectionType)}">Go</button>`
                  : ""
              }
            </div>
          </article>`;
            })
            .join("")
        : '<p class="ew-empty-row">No visible suggestions.</p>');
  }

  function renderNavigator() {
    if (!els.navList || !state.model) return;
    els.navList.innerHTML = (state.model.sections || [])
      .map(
        (sec, i) => `<button type="button" class="ew-nav-item${state.activeSectionIndex === i ? " is-active" : ""}" data-section-index="${i}" data-jump-section="${escapeHtml(sec.sectionType || sec.key)}" aria-current="${state.activeSectionIndex === i ? "true" : "false"}">
        <span class="ew-nav-item__title">${escapeHtml(sec.title)}</span>
        <span class="ew-nav-item__meta">
          <span class="ew-pill ${bandClass(sec.confidenceBand)}" title="Confidence">${escapeHtml((sec.confidenceBand || "low").toUpperCase())}</span>
          <span class="ew-count" title="Issues" aria-label="${escapeHtml(String(sec.issueCount || 0))} issues">${escapeHtml(sec.issueCount || 0)}</span>
          <span class="ew-dot is-${escapeHtml(sec.completion || "complete")}" title="${escapeHtml(sec.completion || "complete")}" aria-hidden="true"></span>
        </span>
      </button>`
      )
      .join("") || `<p class="ew-empty-row">${escapeHtml((ws.MESSAGES && ws.MESSAGES.NO_SECTIONS) || "No sections detected.")}</p>`;
  }

  function renderHealth() {
    if (!els.health || !state.model) return;
    els.health.innerHTML = (state.model.draftHealth || [])
      .map(
        (card) => `<div class="ew-health-card ${bandClass(card.band)}">
        <span class="ew-health-card__label">${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.score)}</strong>
        <small>${escapeHtml(card.detail)}</small>
      </div>`
      )
      .join("");
  }

  function renderLinks() {
    if (!els.links || !state.model) return;
    const inspector = state.model.linkInspector;
    els.links.innerHTML = (inspector.labels || [])
      .map((bucket) => {
        const rows = inspector.buckets[bucket.id] || [];
        return `<div class="ew-link-bucket">
          <h4>${escapeHtml(bucket.label)} <span>${bucket.count}</span></h4>
          <ul>${
            rows.length
              ? rows
                  .slice(0, 12)
                  .map(
                    (link) => `<li>
                <strong>${escapeHtml(link.label)}</strong>
                <small>${escapeHtml(link.url)}</small>
              </li>`
                  )
                  .join("")
              : emptyRow()
          }</ul>
        </div>`;
      })
      .join("");
  }

  function renderDuplicates() {
    if (!els.duplicates || !state.model) return;
    const d = state.model.duplicates;
    function block(title, rows) {
      return `<div class="ew-dup-block"><h4>${escapeHtml(title)} <span>${rows.length}</span></h4>
        <ul>${
          rows.length
            ? rows
                .slice(0, 8)
                .map((r) => `<li>${escapeHtml(r.value)} <small>×${escapeHtml(r.count)}</small></li>`)
                .join("")
            : emptyRow()
        }</ul></div>`;
    }
    els.duplicates.innerHTML =
      block("Duplicate paragraphs", d.paragraphs || []) +
      block("Duplicate dates", d.dates || []) +
      block("Duplicate links", d.links || []) +
      block("Duplicate FAQs", d.faqs || []);
  }

  function renderChanges() {
    if (!els.changes || !state.model) return;
    const c = state.model.changeSummary || { added: [], modified: [], removed: [] };
    function list(label, rows) {
      return `<div><h4>${escapeHtml(label)} <span>${rows.length}</span></h4>
        <ul>${
          rows.length
            ? rows.map((r) => `<li>${escapeHtml(r.title || r.key)}</li>`).join("")
            : emptyRow()
        }</ul></div>`;
    }
    els.changes.innerHTML =
      '<p class="ew-help">Presentation-only diff vs the draft snapshot from when this review was opened (or last saved progress).</p>' +
      list("Added", c.added || []) +
      list("Modified", c.modified || []) +
      list("Removed", c.removed || []);
  }

  function renderDraftPreview() {
    if (!els.draftView || !state.model) return;
    const text = state.model.draftText || "";
    if (!text.trim()) {
      els.draftView.innerHTML = '<p class="ew-empty-row">No draft text available for section highlighting.</p>';
      return;
    }
    const sections = state.model.sections || [];
    if (!sections.length || !window.GeneratorWorkspaceCore) {
      els.draftView.innerHTML = `<pre class="ew-draft-pre">${escapeHtml(text.slice(0, 12000))}</pre>`;
      return;
    }
    const parsed = window.GeneratorWorkspaceCore.parseWorkspaceSections(text);
    els.draftView.innerHTML = parsed.length
      ? parsed
          .map(
            (sec) => `<section class="ew-draft-section" id="ew-section-${escapeHtml(sec.key)}" data-section-key="${escapeHtml(sec.key)}">
          <h4>${escapeHtml(sec.title)}</h4>
          <pre>${escapeHtml((sec.body || "").slice(0, 4000))}</pre>
        </section>`
          )
          .join("")
      : `<pre class="ew-draft-pre">${escapeHtml(text.slice(0, 12000))}</pre>`;
  }

  function clearHighlights() {
    if (!els.root) return;
    els.root.querySelectorAll(".is-highlighted").forEach((node) => node.classList.remove("is-highlighted"));
  }

  function jumpToSection(sectionType) {
    if (!sectionType || !state.model) return;
    const idx = (state.model.sections || []).findIndex(
      (s) => s.sectionType === sectionType || s.key === sectionType
    );
    if (idx >= 0) state.activeSectionIndex = idx;
    clearHighlights();
    const target =
      byId("ew-section-" + sectionType) ||
      (els.draftView && els.draftView.querySelector(`[data-section-key="${sectionType}"]`));
    if (target) {
      target.classList.add("is-highlighted");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    renderNavigator();
    setStatus(`Jumped to section: ${sectionType}`);
  }

  function jumpToIssue(issueId) {
    if (!state.model) return;
    const issues = state.model.issues || [];
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx < 0) return;
    state.activeIssueIndex = idx;
    const issue = issues[idx];
    clearHighlights();
    if (els.issues) {
      const row = els.issues.querySelector(`[data-issue-id="${issueId}"]`);
      if (row) {
        row.classList.add("is-highlighted");
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
    if (issue.sectionType || issue.sectionKey) jumpToSection(issue.sectionType || issue.sectionKey);
    setStatus(`Issue ${idx + 1}/${issues.length}: ${issue.message}`);
  }

  function nextIssue(delta) {
    if (!state.model || !(state.model.issues || []).length) {
      setStatus("No issues to navigate.");
      return;
    }
    const len = state.model.issues.length;
    const next = state.activeIssueIndex < 0 ? (delta > 0 ? 0 : len - 1) : (state.activeIssueIndex + delta + len) % len;
    jumpToIssue(state.model.issues[next].id);
  }

  function nextSection(delta) {
    if (!state.model || !(state.model.sections || []).length) {
      setStatus("No sections to navigate.");
      return;
    }
    const len = state.model.sections.length;
    const next =
      state.activeSectionIndex < 0 ? (delta > 0 ? 0 : len - 1) : (state.activeSectionIndex + delta + len) % len;
    const sec = state.model.sections[next];
    state.activeSectionIndex = next;
    jumpToSection(sec.sectionType || sec.key);
  }

  function saveReviewProgress() {
    saveSuggestionState();
    if (state.model) state.previousDraftText = state.model.draftText || "";
    storageSet(STORAGE_PREFIX + "progressSavedAt", new Date().toISOString());
    setStatus("Review progress saved locally (suggestions + snapshot). Draft was not modified.");
  }

  function onSuggestionAction(action, id) {
    if (!id) return;
    const current = state.suggestionState[id] || {};
    if (action === "dismiss") current.dismissed = true;
    if (action === "hide") current.hidden = true;
    if (action === "reviewed") current.reviewed = true;
    state.suggestionState[id] = current;
    saveSuggestionState();
    renderSuggestions();
    setStatus(`Suggestion ${action}: ${id}`);
  }

  function bindClicks() {
    if (!els.root) return;
    els.root.addEventListener("click", (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      const jumpIssue = t.closest("[data-jump-issue]");
      if (jumpIssue) {
        jumpToIssue(jumpIssue.getAttribute("data-jump-issue"));
        return;
      }
      const jumpSection = t.closest("[data-jump-section]");
      if (jumpSection) {
        jumpToSection(jumpSection.getAttribute("data-jump-section"));
        return;
      }
      const sug = t.closest("[data-sug-action]");
      if (sug) {
        onSuggestionAction(sug.getAttribute("data-sug-action"), sug.getAttribute("data-sug-id"));
      }
    });
  }

  function bindChrome() {
    if (els.toggle) {
      els.toggle.addEventListener("click", () => {
        state.open = !state.open;
        storageSet(OPEN_KEY, state.open);
        syncOpen();
      });
    }
    if (els.navToggle) {
      els.navToggle.addEventListener("click", () => {
        state.navOpen = !state.navOpen;
        storageSet(NAV_KEY, state.navOpen);
        syncNav();
      });
    }
    if (els.saveBtn) {
      els.saveBtn.addEventListener("click", () => saveReviewProgress());
    }
    if (els.shortcutsBtn && els.shortcuts) {
      els.shortcutsBtn.addEventListener("click", () => {
        if (typeof els.shortcuts.showModal === "function") els.shortcuts.showModal();
        else els.shortcuts.hidden = !els.shortcuts.hidden;
      });
    }
  }

  function bindShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (!state.ready || !state.open) return;
      const tag = (event.target && event.target.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target && event.target.isContentEditable);
      if (typing && !(event.ctrlKey || event.metaKey)) return;

      const key = event.key;
      const mod = event.ctrlKey || event.metaKey;

      if (mod && !event.shiftKey && key.toLowerCase() === "s") {
        // Save draft / review progress only — never publish.
        event.preventDefault();
        if (els.saveBtn) els.saveBtn.click();
        else saveReviewProgress();
        return;
      }
      if (event.altKey && key === "ArrowDown") {
        event.preventDefault();
        nextIssue(1);
        return;
      }
      if (event.altKey && key === "ArrowUp") {
        event.preventDefault();
        nextIssue(-1);
        return;
      }
      if (event.altKey && key === "]") {
        event.preventDefault();
        nextSection(1);
        return;
      }
      if (event.altKey && key === "[") {
        event.preventDefault();
        nextSection(-1);
      }
    });
  }

  function syncOpen() {
    if (!els.root) return;
    els.root.classList.toggle("is-collapsed", !state.open);
    if (els.toggle) els.toggle.setAttribute("aria-expanded", state.open ? "true" : "false");
  }

  function syncNav() {
    if (!els.shell) return;
    els.shell.classList.toggle("is-nav-collapsed", !state.navOpen);
    if (els.navToggle) els.navToggle.setAttribute("aria-expanded", state.navOpen ? "true" : "false");
  }

  function renderAll() {
    renderDashboard();
    renderChecklist();
    renderIssues();
    renderSuggestions();
    renderNavigator();
    renderHealth();
    renderLinks();
    renderDuplicates();
    renderChanges();
    renderDraftPreview();
    if (els.source) {
      els.source.textContent = state.model
        ? state.model.source === "ai4"
          ? "Source: AI-4 editorial intelligence"
          : state.model.source === "pi1-fallback"
            ? "Source: PI-1 local fallback"
            : "Source: waiting for draft"
        : "";
    }
  }

  function render(workspace) {
    if (!state.ready) return;
    state.workspace = workspace || null;
    if (!workspace || !workspace.draft) {
      state.model = core.analyzeEditorialWorkspace(workspace || {}, {
        previousDraftText: state.previousDraftText
      });
      renderAll();
      setStatus("Select a review item with a linked draft.");
      return;
    }
    loadSuggestionState();
    const draftText = core.extractDraftText(workspace);
    if (!state.previousDraftText) state.previousDraftText = draftText;
    state.model = core.analyzeEditorialWorkspace(workspace, {
      previousDraftText: state.previousDraftText
    });
    state.activeIssueIndex = -1;
    state.activeSectionIndex = -1;
    renderAll();
    setStatus(
      state.model.source === "ai4"
        ? "Editorial Workspace Pro ready (AI-4)."
        : "Editorial Workspace Pro ready (local fallback)."
    );
  }

  function cacheEls() {
    els.root = byId("editorialWorkspacePro");
    if (!els.root) return false;
    els.shell = byId("ewShell");
    els.toggle = byId("ewToggle");
    els.navToggle = byId("ewNavToggle");
    els.saveBtn = byId("ewSaveProgress");
    els.shortcutsBtn = byId("ewShortcutsBtn");
    els.shortcuts = byId("ewShortcuts");
    els.status = byId("ewStatus");
    els.source = byId("ewSource");
    els.briefing = byId("ewBriefing");
    els.dashboard = byId("ewDashboard");
    els.checklist = byId("ewChecklist");
    els.issues = byId("ewIssues");
    els.suggestions = byId("ewSuggestions");
    els.navList = byId("ewNavList");
    els.health = byId("ewHealth");
    els.links = byId("ewLinks");
    els.duplicates = byId("ewDuplicates");
    els.changes = byId("ewChanges");
    els.draftView = byId("ewDraftView");
    return true;
  }

  function init() {
    if (state.ready) return;
    if (!cacheEls()) return;
    state.open = storageGet(OPEN_KEY, true) !== false;
    state.navOpen = storageGet(NAV_KEY, true) !== false;
    syncOpen();
    syncNav();
    bindChrome();
    bindClicks();
    bindShortcuts();
    state.ready = true;
    window.EditorialWorkspacePro = {
      render,
      saveReviewProgress,
      nextIssue,
      nextSection,
      version: core.CORE_VERSION
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
