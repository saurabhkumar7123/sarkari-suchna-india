/**
 * Phase PI-1 — Smart Generator Experience: workspace UI layer.
 *
 * Renders the processing timeline, section navigator, PDF/structured split view,
 * confidence badges, validation panel, advisory suggestions, summary and
 * keyboard shortcuts.
 *
 * Contract with the rest of the Generator:
 *  - Read-only. This module never writes to #data, never edits sections, and
 *    never calls save / publish endpoints. Shortcuts only click existing buttons.
 *  - Additive. If markup or the core is missing, it exits quietly and the
 *    Generator behaves exactly as before.
 */
(function () {
  "use strict";

  const core = window.GeneratorWorkspaceCore;
  if (!core) return;

  const STAGE = core.STAGE_STATES;
  const BAND_LABEL = { high: "High", medium: "Medium", low: "Low" };

  /** Idle delay before re-analysing while the editor is being typed in. */
  const ANALYZE_DEBOUNCE_MS = 320;
  /** Above this length we stop rendering the source pane text to keep paint cheap. */
  const SOURCE_RENDER_LIMIT = 240000;
  const STORAGE_KEY = "pi1.workspace.open";

  const state = {
    ready: false,
    open: true,
    stages: {},
    extractedText: "",
    extraction: null,
    aiPayload: null,
    analysis: null,
    activeSectionId: null,
    sourceMode: "text",
    pdfFile: null,
    pdfObjectUrl: null,
    lastSignature: "",
    analyzeTimer: 0,
    idleHandle: 0
  };

  const els = {};

  /* ------------------------------------------------------------ utilities */

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

  function byId(id) {
    return document.getElementById(id);
  }

  function editorTextarea() {
    return byId("data");
  }

  function readEditorText() {
    const ta = editorTextarea();
    return ta ? String(ta.value || "") : "";
  }

  /** Ask the visual section editor to flush pending edits into #data first. */
  function flushEditor() {
    try {
      if (window.sectionEditor && typeof window.sectionEditor.flushToTextarea === "function") {
        window.sectionEditor.flushToTextarea();
      }
    } catch {
      /* advisory only — never block on editor internals */
    }
  }

  /** Run non-urgent rendering work off the interaction path when possible. */
  function schedule(fn) {
    if (typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function") {
      if (state.idleHandle) window.cancelIdleCallback(state.idleHandle);
      state.idleHandle = window.requestIdleCallback(fn, { timeout: 600 });
      return;
    }
    window.setTimeout(fn, 0);
  }

  /* -------------------------------------------------------------- timeline */

  function initStages() {
    core.PIPELINE_STAGES.forEach((stage) => {
      state.stages[stage.id] = { state: STAGE.PENDING, note: "" };
    });
  }

  function setStage(id, next, note) {
    const entry = state.stages[id];
    if (!entry) return;
    entry.state = next;
    entry.note = note || "";
    renderTimeline();
  }

  /** Move every stage before `id` to done, so manual paths do not look stalled. */
  function completeStagesBefore(id) {
    const order = core.PIPELINE_STAGES.map((s) => s.id);
    const stop = order.indexOf(id);
    for (let i = 0; i < stop; i++) {
      const entry = state.stages[order[i]];
      if (entry && entry.state === STAGE.PENDING) entry.state = STAGE.SKIPPED;
    }
  }

  function renderTimeline() {
    if (!els.timeline) return;
    const html = core.PIPELINE_STAGES.map((stage, i) => {
      const entry = state.stages[stage.id] || { state: STAGE.PENDING, note: "" };
      const note = entry.note || stage.hint;
      const icon =
        entry.state === STAGE.DONE
          ? "✓"
          : entry.state === STAGE.ERROR
            ? "!"
            : entry.state === STAGE.SKIPPED
              ? "–"
              : String(i + 1);
      return `<li class="gw-stage is-${escapeHtml(entry.state)}" data-stage="${escapeHtml(stage.id)}">
        <span class="gw-stage__dot" aria-hidden="true">${escapeHtml(icon)}</span>
        <span class="gw-stage__text">
          <span class="gw-stage__label">${escapeHtml(stage.label)}</span>
          <span class="gw-stage__note">${escapeHtml(note)}</span>
        </span>
      </li>`;
    }).join("");
    els.timeline.innerHTML = html;

    const active = core.PIPELINE_STAGES.find((s) => state.stages[s.id].state === STAGE.ACTIVE);
    const failed = core.PIPELINE_STAGES.find((s) => state.stages[s.id].state === STAGE.ERROR);
    els.timeline.setAttribute(
      "aria-label",
      failed ? `${failed.label} failed` : active ? `${active.label} in progress` : "Generator processing timeline"
    );
  }

  /* ------------------------------------------------------------- navigator */

  function renderNavigator() {
    if (!els.navList) return;
    const sections = (state.analysis && state.analysis.sections) || [];

    if (!sections.length) {
      els.navList.innerHTML = "";
      if (els.navEmpty) els.navEmpty.hidden = false;
      if (els.navCount) els.navCount.textContent = "0";
      return;
    }
    if (els.navEmpty) els.navEmpty.hidden = true;
    if (els.navCount) els.navCount.textContent = String(sections.length);

    els.navList.innerHTML = sections
      .map((section, i) => {
        const band = section.confidenceBand;
        const status = section.isEmpty ? "empty" : section.complete ? "complete" : "attention";
        const statusTitle =
          status === "complete" ? "Looks complete" : status === "empty" ? "No content yet" : "Needs review";
        const active = section.id === state.activeSectionId ? " is-active" : "";
        return `<li>
        <button type="button" class="gw-nav__item${active}" data-section-id="${escapeHtml(section.id)}"
          aria-current="${section.id === state.activeSectionId ? "true" : "false"}">
          <span class="gw-nav__index">${i + 1}</span>
          <span class="gw-nav__body">
            <span class="gw-nav__title">${escapeHtml(section.label)}</span>
            <span class="gw-nav__meta">${section.isEmpty ? "empty" : `${section.contentLineCount} line${section.contentLineCount === 1 ? "" : "s"}`}${
              section.hasTable ? " · table" : ""
            }${section.links.length ? ` · ${section.links.length} link${section.links.length === 1 ? "" : "s"}` : ""}</span>
          </span>
          <span class="gw-badge gw-badge--${escapeHtml(band)}" title="Confidence ${escapeHtml(
            core.formatConfidencePercent(section.confidence)
          )} (${escapeHtml(section.confidenceSource)})">${escapeHtml(BAND_LABEL[band] || band)}</span>
          <span class="gw-dot gw-dot--${escapeHtml(status)}" title="${escapeHtml(statusTitle)}" aria-label="${escapeHtml(
            statusTitle
          )}"></span>
        </button>
      </li>`;
      })
      .join("");
  }

  /* ------------------------------------------------------------ split view */

  function renderStructuredPane() {
    if (!els.structured) return;
    const sections = (state.analysis && state.analysis.sections) || [];

    if (!sections.length) {
      els.structured.innerHTML =
        '<p class="gw-empty">No structured sections yet. Extract a PDF and run <strong>Convert with AI</strong> to see the structured view.</p>';
      return;
    }

    els.structured.innerHTML = sections
      .map((section) => {
        const preview = section.isEmpty
          ? '<p class="gw-struct__empty">No content in this section.</p>'
          : `<pre class="gw-struct__body">${escapeHtml(
              section.body.length > 1200 ? `${section.body.slice(0, 1200)}\n…` : section.body
            )}</pre>`;
        const active = section.id === state.activeSectionId ? " is-active" : "";
        return `<article class="gw-struct${active}" data-section-id="${escapeHtml(section.id)}" id="gw-struct-${escapeHtml(
          section.id
        )}">
        <header class="gw-struct__head">
          <h4 class="gw-struct__title">${escapeHtml(section.label)}</h4>
          <span class="gw-badge gw-badge--${escapeHtml(section.confidenceBand)}">${escapeHtml(
            BAND_LABEL[section.confidenceBand]
          )} · ${escapeHtml(core.formatConfidencePercent(section.confidence))}</span>
        </header>
        ${preview}
      </article>`;
      })
      .join("");
  }

  /**
   * Render the raw extracted text, optionally wrapping the region that matches
   * the active section so the editor can see where the content came from.
   */
  function renderSourceText() {
    if (!els.sourceText) return;
    const text = state.extractedText;

    if (!text.trim()) {
      els.sourceText.innerHTML =
        '<p class="gw-empty">Upload and extract a PDF to compare the original text against the structured output.</p>';
      return;
    }
    if (text.length > SOURCE_RENDER_LIMIT) {
      els.sourceText.innerHTML = `<pre class="gw-source__pre">${escapeHtml(
        text.slice(0, SOURCE_RENDER_LIMIT)
      )}\n\n… truncated for performance …</pre>`;
      return;
    }

    const section = activeSection();
    const match = section ? core.findSourceMatch(section.body, text) : null;

    if (!match) {
      els.sourceText.innerHTML = `<pre class="gw-source__pre">${escapeHtml(text)}</pre>`;
      if (section) setSourceHint("No matching text found in the PDF extract for this section.");
      else setSourceHint("");
      return;
    }

    els.sourceText.innerHTML = `<pre class="gw-source__pre">${escapeHtml(text.slice(0, match.start))}<mark class="gw-source__hit" id="gwSourceHit">${escapeHtml(
      text.slice(match.start, match.end)
    )}</mark>${escapeHtml(text.slice(match.end))}</pre>`;
    setSourceHint(`Matched ${match.matchedLines} line(s) from “${section.label}”.`);

    const hit = byId("gwSourceHit");
    if (hit && typeof hit.scrollIntoView === "function") {
      hit.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function setSourceHint(message) {
    if (!els.sourceHint) return;
    els.sourceHint.textContent = message || "";
    els.sourceHint.hidden = !message;
  }

  function setSourceMode(mode) {
    state.sourceMode = mode === "pdf" ? "pdf" : "text";
    const isPdf = state.sourceMode === "pdf";

    if (els.sourceTabText) {
      els.sourceTabText.classList.toggle("is-active", !isPdf);
      els.sourceTabText.setAttribute("aria-selected", String(!isPdf));
    }
    if (els.sourceTabPdf) {
      els.sourceTabPdf.classList.toggle("is-active", isPdf);
      els.sourceTabPdf.setAttribute("aria-selected", String(isPdf));
    }
    if (els.sourceText) els.sourceText.hidden = isPdf;
    if (els.sourcePdf) els.sourcePdf.hidden = !isPdf;

    if (isPdf) renderPdfPane();
    else renderSourceText();
  }

  /** Blob URLs are created lazily — only when the operator opens the PDF tab. */
  function renderPdfPane() {
    if (!els.sourcePdf) return;
    if (!state.pdfFile) {
      els.sourcePdf.innerHTML = '<p class="gw-empty">Choose a PDF in the PDF Extract panel to preview it here.</p>';
      return;
    }
    if (!state.pdfObjectUrl) {
      try {
        state.pdfObjectUrl = URL.createObjectURL(state.pdfFile);
      } catch {
        els.sourcePdf.innerHTML = '<p class="gw-empty">This browser could not open a local preview of the PDF.</p>';
        return;
      }
    }
    const url = escapeHtml(state.pdfObjectUrl);
    els.sourcePdf.innerHTML = `<iframe class="gw-pdf__frame" src="${url}" title="Original PDF"></iframe>
      <p class="gw-pdf__fallback">Preview blocked by the browser?
        <a href="${url}" target="_blank" rel="noopener">Open the PDF in a new tab</a>.</p>`;
  }

  function releasePdfObjectUrl() {
    if (!state.pdfObjectUrl) return;
    try {
      URL.revokeObjectURL(state.pdfObjectUrl);
    } catch {
      /* nothing to clean up */
    }
    state.pdfObjectUrl = null;
  }

  /* ---------------------------------------------------------------- panels */

  function renderSummary() {
    if (!els.summary) return;
    const summary = state.analysis && state.analysis.summary;
    if (!summary || !summary.sectionsDetected) {
      els.summary.innerHTML = '<p class="gw-empty">Summary appears once the content is structured into sections.</p>';
      if (els.qualityChip) els.qualityChip.hidden = true;
      return;
    }

    const minutes = summary.estimatedEditMinutes;
    const timeLabel = minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`;
    const tiles = [
      { label: "Sections detected", value: summary.sectionsDetected, note: `${summary.knownSections} recognised` },
      { label: "Tables detected", value: summary.tablesDetected, note: summary.tablesDetected ? "check columns" : "none" },
      {
        label: "Links detected",
        value: summary.linksDetected,
        note: summary.brokenLinks ? `${summary.brokenLinks} broken` : "all valid"
      },
      { label: "Estimated edit time", value: timeLabel, note: "manual review" },
      {
        label: "Overall quality",
        value: `${summary.qualityScore}%`,
        note: summary.qualityLabel
      }
    ];

    els.summary.innerHTML = `<div class="gw-tiles">${tiles
      .map(
        (t) => `<div class="gw-tile">
          <span class="gw-tile__value">${escapeHtml(t.value)}</span>
          <span class="gw-tile__label">${escapeHtml(t.label)}</span>
          <span class="gw-tile__note">${escapeHtml(t.note)}</span>
        </div>`
      )
      .join("")}</div>
      <p class="gw-confidence-split">Confidence: <span class="gw-badge gw-badge--high">${summary.highConfidence} high</span>
        <span class="gw-badge gw-badge--medium">${summary.mediumConfidence} medium</span>
        <span class="gw-badge gw-badge--low">${summary.lowConfidence} low</span></p>`;

    if (els.qualityChip) {
      els.qualityChip.hidden = false;
      els.qualityChip.textContent = `${summary.qualityLabel} · ${summary.qualityScore}%`;
      els.qualityChip.className = `gw-quality-chip is-${
        summary.qualityScore >= 70 ? "good" : summary.qualityScore >= 50 ? "warn" : "bad"
      }`;
    }
  }

  function issueListHtml(title, items, severity) {
    if (!items || !items.length) return "";
    const rows = items
      .slice(0, 20)
      .map((item) => {
        const jump = item.sectionId
          ? `<button type="button" class="gw-jump" data-section-id="${escapeHtml(item.sectionId)}">Go</button>`
          : "";
        return `<li class="gw-issue is-${escapeHtml(severity)}"><span>${escapeHtml(item.message)}</span>${jump}</li>`;
      })
      .join("");
    const extra = items.length > 20 ? `<li class="gw-issue is-info"><span>+ ${items.length - 20} more…</span></li>` : "";
    return `<section class="gw-issue-group">
      <h5 class="gw-issue-group__title">${escapeHtml(title)} <span class="gw-count">${items.length}</span></h5>
      <ul class="gw-issue-list">${rows}${extra}</ul>
    </section>`;
  }

  function renderValidation() {
    if (!els.validation) return;
    const report = state.analysis && state.analysis.report;

    if (!report || !state.analysis.isStructured) {
      els.validation.innerHTML = '<p class="gw-empty">Validation runs once the content has [Section: …] headings.</p>';
      if (els.validationChip) els.validationChip.hidden = true;
      return;
    }

    const groups = [
      issueListHtml("Missing sections", report.missingSections, "error"),
      issueListHtml("Broken links", report.brokenLinks, "error"),
      issueListHtml("Empty sections", report.emptySections, "warning"),
      issueListHtml("Duplicate content", report.duplicates, "warning"),
      issueListHtml("OCR issues", report.ocrIssues, "warning"),
      issueListHtml("Validation warnings", report.warnings, "warning"),
      issueListHtml("Suggested additions", report.recommendedMissing, "info")
    ]
      .filter(Boolean)
      .join("");

    els.validation.innerHTML =
      groups || '<p class="gw-empty gw-empty--ok">No validation issues found. This page looks ready for review.</p>';

    if (els.validationChip) {
      els.validationChip.hidden = false;
      const total = report.errorCount + report.warningCount;
      els.validationChip.textContent = report.errorCount
        ? `${report.errorCount} error${report.errorCount === 1 ? "" : "s"}`
        : report.warningCount
          ? `${report.warningCount} warning${report.warningCount === 1 ? "" : "s"}`
          : "Clean";
      els.validationChip.className = `gw-quality-chip is-${report.errorCount ? "bad" : total ? "warn" : "good"}`;
    }
  }

  function renderSuggestions() {
    if (!els.suggestions) return;
    const list = (state.analysis && state.analysis.suggestions) || [];

    if (!list.length) {
      els.suggestions.innerHTML =
        '<p class="gw-empty gw-empty--ok">No suggestions right now. Everything the checker looks at is in good shape.</p>';
      return;
    }

    els.suggestions.innerHTML = `<ul class="gw-suggestions">${list
      .map(
        (s) => `<li class="gw-suggestion is-p${s.priority}">
        <div class="gw-suggestion__text">
          <strong>${escapeHtml(s.title)}</strong>
          <span>${escapeHtml(s.detail)}</span>
        </div>
        ${s.sectionId ? `<button type="button" class="gw-jump" data-section-id="${escapeHtml(s.sectionId)}">Go</button>` : ""}
      </li>`
      )
      .join("")}</ul>`;
  }

  /* ---------------------------------------------------------------- errors */

  function showExtractionError(failure) {
    if (!els.error) return;
    const info = core.describeExtractionError(failure);
    els.error.hidden = false;
    els.error.innerHTML = `<div class="gw-error__body">
      <strong class="gw-error__title">${escapeHtml(info.title)}</strong>
      <p class="gw-error__message">${escapeHtml(info.message)}</p>
      <p class="gw-error__hint">${escapeHtml(info.hint)}</p>
    </div>
    <button type="button" class="gw-error__close" data-gw-action="dismiss-error" aria-label="Dismiss">×</button>`;
    setStage("extraction", STAGE.ERROR, info.title);
  }

  function clearExtractionError() {
    if (!els.error) return;
    els.error.hidden = true;
    els.error.innerHTML = "";
  }

  /* -------------------------------------------------------------- analysis */

  function activeSection() {
    const sections = (state.analysis && state.analysis.sections) || [];
    return sections.find((s) => s.id === state.activeSectionId) || null;
  }

  function runAnalysis(force) {
    const editorText = readEditorText();
    const signature = `${editorText.length}:${state.extractedText.length}:${editorText.slice(0, 160)}:${editorText.slice(-160)}`;
    if (!force && signature === state.lastSignature) return;
    state.lastSignature = signature;

    const started = typeof performance !== "undefined" ? performance.now() : 0;
    state.analysis = core.analyzeWorkspace({
      editorText,
      extractedText: state.extractedText,
      aiPayload: state.aiPayload,
      extraction: state.extraction
    });
    if (started && window.__PI1_DEBUG) {
      console.info("[PI-1] analysis in", (performance.now() - started).toFixed(1), "ms");
    }

    const sections = state.analysis.sections;
    if (state.activeSectionId && !sections.some((s) => s.id === state.activeSectionId)) {
      state.activeSectionId = null;
    }

    if (state.analysis.isStructured) {
      completeStagesBefore("validation");
      setStage("validation", STAGE.DONE, `${state.analysis.report.errorCount} error(s), ${state.analysis.report.warningCount} warning(s)`);
      setStage(
        "ready",
        state.analysis.report.ok ? STAGE.DONE : STAGE.ACTIVE,
        state.analysis.report.ok ? "Ready for manual review" : "Fix flagged items before publishing"
      );
    } else if (state.analysis.hasContent) {
      setStage("validation", STAGE.PENDING, "Waiting for structured sections");
      setStage("ready", STAGE.PENDING, "");
    }

    renderNavigator();
    renderStructuredPane();
    renderSummary();
    renderValidation();
    renderSuggestions();
    if (state.sourceMode === "text") renderSourceText();
  }

  function scheduleAnalysis(force) {
    window.clearTimeout(state.analyzeTimer);
    state.analyzeTimer = window.setTimeout(() => {
      schedule(() => runAnalysis(force));
    }, ANALYZE_DEBOUNCE_MS);
  }

  /* -------------------------------------------------------- section jumping */

  /**
   * Focus a section everywhere at once: navigator, structured pane, source
   * highlight, and the real editor (raw textarea or visual section card).
   */
  function focusSection(sectionId, options) {
    const sections = (state.analysis && state.analysis.sections) || [];
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    state.activeSectionId = sectionId;
    renderNavigator();
    renderStructuredPane();
    if (state.sourceMode === "text") renderSourceText();

    const card = byId(`gw-struct-${sectionId}`);
    if (card && typeof card.scrollIntoView === "function") {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    if (options && options.editorOnly === false) return;
    revealSectionInEditor(section);
  }

  function revealSectionInEditor(section) {
    // Visual "Section builder" mode: cards render in the same order as the text.
    const cards = document.querySelectorAll("#sectionEditorRoot .sec-card");
    const wrap = byId("sectionEditorWrap");
    const visualVisible = wrap && wrap.offsetParent !== null && cards.length > section.index;

    if (visualVisible) {
      const card = cards[section.index];
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.classList.add("gw-flash");
      window.setTimeout(() => card.classList.remove("gw-flash"), 1200);
      return;
    }

    const ta = editorTextarea();
    if (!ta || ta.offsetParent === null) return;
    try {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(section.headerStart, section.bodyEnd);
      // Approximate the scroll position from the line offset.
      const before = ta.value.slice(0, section.headerStart).split("\n").length;
      const lineHeight = parseFloat(window.getComputedStyle(ta).lineHeight) || 18;
      ta.scrollTop = Math.max(0, (before - 2) * lineHeight);
    } catch {
      /* selection is a convenience; ignore engine differences */
    }
  }

  function stepSection(delta) {
    const sections = (state.analysis && state.analysis.sections) || [];
    if (!sections.length) return;
    const current = sections.findIndex((s) => s.id === state.activeSectionId);
    const next = current === -1 ? (delta > 0 ? 0 : sections.length - 1) : (current + delta + sections.length) % sections.length;
    focusSection(sections[next].id);
  }

  /* ------------------------------------------------------------- shortcuts */

  const SHORTCUTS = [
    { keys: "Ctrl / ⌘ + S", action: "Save draft" },
    { keys: "Ctrl / ⌘ + Shift + S", action: "Save / Update page" },
    { keys: "Ctrl / ⌘ + Enter", action: "Refresh live preview" },
    { keys: "Ctrl / ⌘ + Shift + A", action: "Convert with AI" },
    { keys: "Alt + ↑ / ↓", action: "Previous / next section" },
    { keys: "Alt + 1…9", action: "Jump to section by number" },
    { keys: "Alt + W", action: "Show / hide smart workspace" },
    { keys: "Alt + P", action: "Switch PDF / extracted text pane" },
    { keys: "Alt + R", action: "Re-run validation" },
    { keys: "Shift + ?", action: "Open this shortcut list" },
    { keys: "Esc", action: "Close this shortcut list" }
  ];

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
  }

  function clickIfPresent(id) {
    const btn = byId(id);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }

  function toggleShortcutHelp(open) {
    if (!els.shortcuts) return;
    const next = typeof open === "boolean" ? open : els.shortcuts.hidden;
    els.shortcuts.hidden = !next;
    if (next) els.shortcuts.querySelector(".gw-modal__close")?.focus();
  }

  function handleShortcut(event) {
    const mod = event.ctrlKey || event.metaKey;

    if (event.key === "Escape" && els.shortcuts && !els.shortcuts.hidden) {
      event.preventDefault();
      event.stopPropagation();
      toggleShortcutHelp(false);
      return;
    }

    if (mod && !event.altKey) {
      const key = String(event.key).toLowerCase();
      if (key === "s") {
        event.preventDefault();
        clickIfPresent(event.shiftKey ? "savePageBtn" : "saveDraftBtn");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        clickIfPresent("previewBtn");
        return;
      }
      if (event.shiftKey && key === "a") {
        event.preventDefault();
        clickIfPresent("aiConvertBtn");
        return;
      }
      return;
    }

    if (event.altKey && !mod) {
      const key = String(event.key).toLowerCase();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        stepSection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        stepSection(-1);
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const sections = (state.analysis && state.analysis.sections) || [];
        const target = sections[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          focusSection(target.id);
        }
        return;
      }
      if (key === "w") {
        event.preventDefault();
        setWorkspaceOpen(!state.open);
        return;
      }
      if (key === "p") {
        event.preventDefault();
        setSourceMode(state.sourceMode === "pdf" ? "text" : "pdf");
        return;
      }
      if (key === "r") {
        event.preventDefault();
        flushEditor();
        runAnalysis(true);
        return;
      }
    }

    if (event.key === "?" && !isTypingTarget(event.target)) {
      event.preventDefault();
      toggleShortcutHelp(true);
    }
  }

  function renderShortcutList() {
    const body = byId("gwShortcutTable");
    if (!body) return;
    body.innerHTML = SHORTCUTS.map(
      (s) => `<tr><th scope="row"><kbd>${escapeHtml(s.keys)}</kbd></th><td>${escapeHtml(s.action)}</td></tr>`
    ).join("");
  }

  /* ------------------------------------------------------------ open/close */

  function setWorkspaceOpen(open) {
    state.open = Boolean(open);
    if (els.root) els.root.classList.toggle("is-collapsed", !state.open);
    if (els.toggle) {
      els.toggle.setAttribute("aria-expanded", String(state.open));
      els.toggle.textContent = state.open ? "Hide workspace" : "Show workspace";
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, state.open ? "1" : "0");
    } catch {
      /* private mode — default to open */
    }
    if (state.open) scheduleAnalysis(true);
  }

  function restoreOpenState() {
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const isNarrow = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    setWorkspaceOpen(stored === null ? !isNarrow : stored === "1");
  }

  /* ----------------------------------------------------------- app events */

  function onPdfSelected(detail) {
    state.pdfFile = (detail && detail.file) || null;
    releasePdfObjectUrl();
    clearExtractionError();
    setStage("upload", state.pdfFile ? STAGE.DONE : STAGE.PENDING, state.pdfFile ? state.pdfFile.name : "");
    setStage("extraction", STAGE.PENDING, "Press “Extract text”");
    if (state.sourceMode === "pdf") renderPdfPane();
  }

  function onExtractStart() {
    clearExtractionError();
    setStage("upload", STAGE.DONE, "");
    setStage("extraction", STAGE.ACTIVE, "Reading text layer / OCR…");
  }

  function onExtractSuccess(detail) {
    state.extractedText = String((detail && detail.text) || "");
    state.extraction = { extractionNote: detail && detail.extractionNote, ocrUsed: Boolean(detail && detail.extractionNote) };
    clearExtractionError();
    setStage(
      "extraction",
      STAGE.DONE,
      `${state.extractedText.length.toLocaleString()} characters${state.extraction.extractionNote ? " · OCR" : ""}`
    );
    setStage("conversion", STAGE.PENDING, "Press “Convert with AI”");
    if (state.sourceMode === "text") renderSourceText();
    scheduleAnalysis(true);
  }

  function onAiStart() {
    setStage("conversion", STAGE.ACTIVE, "Structuring sections…");
  }

  function onAiSuccess(detail) {
    state.aiPayload = (detail && detail.payload) || null;
    const meta = state.aiPayload && state.aiPayload.meta;
    setStage(
      "conversion",
      STAGE.DONE,
      meta && typeof meta.overallConfidence === "number"
        ? `Engine confidence ${core.formatConfidencePercent(meta.overallConfidence)}`
        : "Sections generated"
    );
    setStage("validation", STAGE.ACTIVE, "Checking sections…");
    scheduleAnalysis(true);
  }

  function onAiError(detail) {
    setStage("conversion", STAGE.ERROR, (detail && detail.message) || "AI conversion failed");
  }

  /* ------------------------------------------------------------------ wire */

  function cacheElements() {
    els.root = byId("generatorWorkspace");
    els.timeline = byId("gwTimeline");
    els.toggle = byId("gwToggle");
    els.navList = byId("gwNavList");
    els.navEmpty = byId("gwNavEmpty");
    els.navCount = byId("gwNavCount");
    els.structured = byId("gwStructured");
    els.sourceText = byId("gwSourceText");
    els.sourcePdf = byId("gwSourcePdf");
    els.sourceHint = byId("gwSourceHint");
    els.sourceTabText = byId("gwSourceTabText");
    els.sourceTabPdf = byId("gwSourceTabPdf");
    els.summary = byId("gwSummary");
    els.validation = byId("gwValidation");
    els.suggestions = byId("gwSuggestions");
    els.error = byId("gwError");
    els.shortcuts = byId("gwShortcuts");
    els.qualityChip = byId("gwQualityChip");
    els.validationChip = byId("gwValidationChip");
  }

  function onWorkspaceClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;

    const jump = target.closest("[data-section-id]");
    if (jump) {
      focusSection(jump.getAttribute("data-section-id"));
      return;
    }
    const action = target.closest("[data-gw-action]");
    if (!action) return;
    const name = action.getAttribute("data-gw-action");
    if (name === "dismiss-error") clearExtractionError();
    if (name === "toggle") setWorkspaceOpen(!state.open);
    if (name === "refresh") {
      flushEditor();
      runAnalysis(true);
    }
    if (name === "shortcuts") toggleShortcutHelp(true);
    if (name === "close-shortcuts") toggleShortcutHelp(false);
    if (name === "source-text") setSourceMode("text");
    if (name === "source-pdf") setSourceMode("pdf");
  }

  function bindEvents() {
    els.root.addEventListener("click", onWorkspaceClick);

    // The shortcuts dialog is a sibling of the workspace, so it needs its own binding.
    if (els.shortcuts) {
      els.shortcuts.addEventListener("click", (event) => {
        if (event.target === els.shortcuts) {
          toggleShortcutHelp(false);
          return;
        }
        onWorkspaceClick(event);
      });
    }

    const ta = editorTextarea();
    if (ta) {
      ta.addEventListener("input", () => scheduleAnalysis(false));
      ta.addEventListener("change", () => scheduleAnalysis(false));
    }

    // The visual section editor writes back to #data without firing input events.
    document.addEventListener("generator:content-change", () => scheduleAnalysis(false));
    document.addEventListener("generator:pdf-selected", (e) => onPdfSelected(e.detail));
    document.addEventListener("generator:extract-start", () => onExtractStart());
    document.addEventListener("generator:extract-success", (e) => onExtractSuccess(e.detail));
    document.addEventListener("generator:extract-error", (e) => showExtractionError(e.detail || {}));
    document.addEventListener("generator:ai-start", () => onAiStart());
    document.addEventListener("generator:ai-success", (e) => onAiSuccess(e.detail));
    document.addEventListener("generator:ai-error", (e) => onAiError(e.detail));

    document.addEventListener("keydown", handleShortcut, true);
    window.addEventListener("beforeunload", releasePdfObjectUrl);
  }

  function init() {
    if (state.ready) return;
    cacheElements();
    if (!els.root) return;

    initStages();
    renderTimeline();
    renderShortcutList();
    bindEvents();
    restoreOpenState();
    setSourceMode("text");

    // Editing an existing page: content is already present, so skip straight to validation.
    if (readEditorText().trim()) {
      setStage("upload", STAGE.SKIPPED, "Existing content");
      setStage("extraction", STAGE.SKIPPED, "");
      setStage("conversion", STAGE.SKIPPED, "");
    }
    runAnalysis(true);
    state.ready = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for debugging and for tests that assert the module stays read-only.
  window.GeneratorWorkspace = {
    version: core.CORE_VERSION,
    refresh: () => runAnalysis(true),
    getAnalysis: () => state.analysis,
    focusSection
  };
})();
