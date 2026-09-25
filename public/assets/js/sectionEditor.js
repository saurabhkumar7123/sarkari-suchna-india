/**
 * Visual section builder for generator #data — compiles to [Section: …] text.
 */
(function () {
  "use strict";

  const M = () => window.SectionEditorModel;
  const STORAGE_MODE_KEY = "generatorEditorMode";

  let sections = [];
  let mode = "visual";
  let syncing = false;
  let compileTimer = null;

  /** UI presets only — map to existing CONTENT_TYPES / section titles (no new backend types). */
  const SECTION_PRESETS = [
    {
      id: "text",
      label: "Text",
      description: "Short Information / free paragraph",
      name: "Short Information",
      contentType: "paragraph",
      payload: null
    },
    {
      id: "dates",
      label: "Important Dates",
      description: "Field + value rows",
      name: "Important Dates",
      contentType: "dates",
      payload: {
        blocks: [
          { type: "date", label: "Online Apply Start Date", value: "" },
          { type: "date", label: "Online Apply Last Date", value: "" },
          { type: "date", label: "Fee Payment Last Date", value: "" },
          { type: "date", label: "Exam Date", value: "Later" },
          { type: "date", label: "Admit Card", value: "Later" },
          { type: "date", label: "Result Date", value: "Later" }
        ]
      }
    },
    {
      id: "fee",
      label: "Application Fee",
      description: "Category + fee rows",
      name: "Application Fee",
      contentType: "dates",
      payload: {
        blocks: [
          { type: "date", label: "General / EWS / OBC", value: "" },
          { type: "date", label: "SC / ST / PH", value: "" },
          { type: "date", label: "Female", value: "" }
        ]
      }
    },
    {
      id: "age",
      label: "Age Limit",
      description: "Min / max age rows",
      name: "Age Limit",
      contentType: "dates",
      payload: {
        blocks: [
          { type: "date", label: "Minimum Age", value: "" },
          { type: "date", label: "Maximum Age", value: "" }
        ]
      }
    },
    {
      id: "vacancy",
      label: "Vacancy Details",
      description: "Table section",
      name: "Vacancy Details",
      contentType: "table",
      payload: null,
      forceTable: true
    },
    {
      id: "eligibility",
      label: "Eligibility",
      description: "Paragraph text",
      name: "Eligibility",
      contentType: "paragraph",
      payload: null
    },
    {
      id: "howto",
      label: "How To Apply",
      description: "Steps as paragraph + list",
      name: "How To Apply",
      contentType: "paragraph_list",
      payload: null
    },
    {
      id: "selection",
      label: "Selection Process",
      description: "List of stages",
      name: "Selection Process",
      contentType: "list",
      payload: null
    },
    {
      id: "links",
      label: "Important Links",
      description: "Link name + URL rows",
      name: "Important Links",
      contentType: "links",
      payload: {
        rows: [
          { mode: "single", label: "Apply Online", buttonText: "Click Here", url: "", actions: [] },
          { mode: "single", label: "Official Notification", buttonText: "Click Here", url: "", actions: [] },
          { mode: "single", label: "Official Website", buttonText: "Click Here", url: "", actions: [] }
        ]
      }
    },
    {
      id: "faq",
      label: "FAQ",
      description: "Question & answer pairs",
      name: "Important Questions",
      contentType: "faq",
      payload: null
    },
    {
      id: "table",
      label: "Table",
      description: "Custom table section",
      name: "Table",
      contentType: "table",
      payload: null,
      forceTable: true
    },
    {
      id: "custom",
      label: "Custom",
      description: "Blank paragraph section",
      name: "New Section",
      contentType: "paragraph",
      payload: null
    }
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function isFeeLikeSection(sec) {
    const n = String(sec?.name || "").toLowerCase();
    return /fee|fees|application fee/.test(n);
  }

  function isAgeLikeSection(sec) {
    return /age\s*limit/i.test(String(sec?.name || ""));
  }

  function datesFieldLabels(sec) {
    if (isFeeLikeSection(sec)) return { label: "Category", value: "Fee" };
    if (isAgeLikeSection(sec)) return { label: "Field", value: "Age" };
    return { label: "Field", value: "Value" };
  }

  function isUrlFieldValid(url) {
    const u = String(url || "").trim();
    if (!u) return true;
    return /^(https?:\/\/|www\.|\/)/i.test(u);
  }

  function markUrlValidity(input) {
    if (!input || !input.classList.contains("sec-input--url")) return;
    const ok = isUrlFieldValid(input.value);
    input.classList.toggle("is-invalid", !ok);
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    input.title = ok ? "" : "Enter a valid URL (https://..., www..., or /path)";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getTextarea() {
    return el("data");
  }

  function getMode() {
    return mode;
  }

  function showSafetyNotice(text) {
    if (!text) {
      clearEditorNotice();
      return;
    }
    showEditorNotice(text, "info");
  }

  function formatSafetySummary(analysis) {
    if (!analysis || analysis.safe) return "";
    const parts = [];
    if (analysis.unsafeCount > 0) {
      parts.push(
        `${analysis.safeCount} section(s) visual, ${analysis.unsafeCount} advanced — edit advanced blocks below or use Fix for section builder.`
      );
    }
    const detail = (analysis.reasons || []).slice(0, 4).join(" · ");
    if (detail) parts.push(detail);
    return parts.join(" ");
  }

  function loadSectionsFromText(text, options = {}) {
    const normalized = M().normalizeEditorText(text || "");
    sections = M().parseTextToEditorSections(normalized);
    if (!sections.length && normalized.trim()) {
      sections = [
        {
          ...M().createEmptySection("Content", M().CONTENT_TYPES.MIXED),
          payload: { raw: normalized },
          editorSafe: false,
          unsafeReason: "No [Section:] headers found"
        }
      ];
    }
    if (!sections.length && !options.allowEmpty) {
      sections = [
        M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH),
        M().createEmptySection("Important Dates", M().CONTENT_TYPES.DATES),
        M().createEmptySection("Important Links", M().CONTENT_TYPES.LINKS)
      ];
    }
    const analysis = M().analyzeVisualEditorSafety(normalized);
    if (!options.silent) {
      const msg = formatSafetySummary(analysis);
      if (msg) showSafetyNotice(msg);
      else clearEditorNotice();
    }
    return analysis;
  }

  function wrapRichField(innerHtml, fieldKey, options = {}) {
    const compact = options.compact ? " sec-rich-field--compact" : "";
    return `<div class="sec-rich-field${compact}" data-rich-field="${escapeHtml(fieldKey)}">
      <div class="sec-rich-toolbar" role="toolbar" aria-label="Rich formatting">
        <span class="sec-rich-toolbar__label">Format</span>
        <button type="button" class="sec-rich-btn sec-rich-btn--bold" data-rich-action="bold" title="Bold" aria-label="Bold">B</button>
        <button type="button" class="sec-rich-btn sec-rich-btn--highlight" data-rich-action="highlight" title="Highlight" aria-label="Highlight">HL</button>
        <select class="sec-rich-select" data-rich-action="color" title="Text color" aria-label="Text color">
          <option value="">Color</option>
          ${(M().ALLOWED_RICH_COLORS || []).map((c) => `<option value="${c}">${c}</option>`).join("")}
        </select>
        <button type="button" class="sec-rich-btn sec-rich-btn--link" data-rich-action="link" title="Insert link" aria-label="Insert link">Link</button>
        <button type="button" class="sec-rich-btn sec-rich-btn--br" data-rich-action="br" title="Line break" aria-label="Line break">BR</button>
        <button type="button" class="sec-rich-btn sec-rich-btn--bullet" data-rich-action="bullet" title="Bullet list" aria-label="Bullet list">•</button>
      </div>
      ${innerHtml}
    </div>`;
  }

  function getRichEditable(wrap) {
    if (!wrap) return null;
    return wrap.querySelector("textarea, input[data-rich-input]");
  }

  function applyBulletFormat(editable) {
    if (!editable) return;
    const val = String(editable.value || "");
    const start = editable.selectionStart ?? 0;
    const end = editable.selectionEnd ?? 0;
    const isMultiline = editable.tagName === "TEXTAREA";

    if (start !== end && isMultiline) {
      const selected = val.slice(start, end);
      const replaced = selected
        .split("\n")
        .map((line) => {
          if (!String(line).trim()) return line;
          if (/^(\s*)[-*•]\s/.test(line)) return line;
          return line.replace(/^(\s*)/, "$1- ");
        })
        .join("\n");
      editable.value = val.slice(0, start) + replaced + val.slice(end);
      editable.setSelectionRange(start, start + replaced.length);
    } else if (isMultiline) {
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const lineEndRaw = val.indexOf("\n", start);
      const lineEnd = lineEndRaw === -1 ? val.length : lineEndRaw;
      const line = val.slice(lineStart, lineEnd);
      if (!/^(\s*)[-*•]\s/.test(line)) {
        const prefix = "- ";
        editable.value = val.slice(0, lineStart) + prefix + val.slice(lineStart);
        const newPos = start + prefix.length;
        editable.setSelectionRange(newPos, newPos);
      } else {
        const insert = "\n- ";
        editable.value = val.slice(0, end) + insert + val.slice(end);
        editable.setSelectionRange(end + insert.length, end + insert.length);
      }
    } else if (!/^[-*•]\s/.test(val.trim())) {
      const prefix = "- ";
      editable.value = prefix + val;
      editable.setSelectionRange(start + prefix.length, start + prefix.length);
    }

    editable.dispatchEvent(new Event("input", { bubbles: true }));
    editable.focus();
  }

  let richLinkContext = null;

  function isRichLinkUrlValid(url) {
    const u = String(url || "").trim();
    if (!u) return false;
    return /^(https?:\/\/|www\.|\/)/i.test(u);
  }

  function insertMarkdownLinkAt(textarea, start, end, label, url) {
    const val = String(textarea.value || "");
    const linkLabel = String(label || "").trim();
    const href = String(url || "").trim();
    let insert;
    let cursorPos;
    if (linkLabel) {
      insert = `[${linkLabel}](${href})`;
      cursorPos = start + insert.length;
    } else {
      insert = `[](${href})`;
      cursorPos = start + 1;
    }
    textarea.value = val.slice(0, start) + insert + val.slice(end);
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function closeRichLinkModal() {
    const modal = el("secRichLinkModal");
    const err = el("secRichLinkUrlError");
    if (modal) {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
    }
    if (err) err.hidden = true;
    richLinkContext = null;
  }

  function openRichLinkModal(textarea) {
    const modal = el("secRichLinkModal");
    const labelInput = el("secRichLinkLabel");
    const urlInput = el("secRichLinkUrl");
    const err = el("secRichLinkUrlError");
    if (!modal || !labelInput || !urlInput || !textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const val = String(textarea.value || "");
    const selected = start !== end ? val.slice(start, end) : "";

    labelInput.value = selected;
    urlInput.value = "";
    if (err) err.hidden = true;

    richLinkContext = { textarea, start, end };

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");

    window.setTimeout(() => {
      if (selected) urlInput.focus();
      else labelInput.focus();
    }, 0);
  }

  function confirmRichLinkModal() {
    const labelInput = el("secRichLinkLabel");
    const urlInput = el("secRichLinkUrl");
    const err = el("secRichLinkUrlError");
    if (!richLinkContext || !labelInput || !urlInput) return;

    const url = String(urlInput.value || "").trim();
    if (!isRichLinkUrlValid(url)) {
      if (err) err.hidden = false;
      urlInput.focus();
      return;
    }
    if (err) err.hidden = true;

    const label = String(labelInput.value || "").trim();
    const { textarea, start, end } = richLinkContext;
    closeRichLinkModal();
    insertMarkdownLinkAt(textarea, start, end, label, url);
    syncSectionsFromDom();
    scheduleCompile();
  }

  function initRichLinkModal() {
    const modal = el("secRichLinkModal");
    if (!modal) return;

    modal.addEventListener("click", (ev) => {
      const action = ev.target.closest("[data-rich-link-action]")?.getAttribute("data-rich-link-action");
      if (action === "cancel") {
        const ta = richLinkContext?.textarea;
        closeRichLinkModal();
        ta?.focus();
        return;
      }
      if (action === "insert") confirmRichLinkModal();
    });

    const urlInput = el("secRichLinkUrl");
    urlInput?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        confirmRichLinkModal();
      }
    });

    const labelInput = el("secRichLinkLabel");
    labelInput?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        urlInput?.focus();
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape" || modal.hidden) return;
      if (!modal.classList.contains("is-open")) return;
      const ta = richLinkContext?.textarea;
      closeRichLinkModal();
      ta?.focus();
    });
  }

  function applyRichAction(editable, action, colorValue) {
    if (!editable) return;
    if (action === "bullet") {
      applyBulletFormat(editable);
      return;
    }
    const start = editable.selectionStart ?? 0;
    const end = editable.selectionEnd ?? 0;
    const val = String(editable.value || "");
    const hasSelection = start !== end;
    const selected = hasSelection ? val.slice(start, end) : "";

    let insert = "";
    let cursorPos = start;

    if (action === "bold") {
      if (hasSelection) {
        insert = `[b]${selected}[/b]`;
        cursorPos = start + insert.length;
      } else {
        insert = "[b][/b]";
        cursorPos = start + 3;
      }
    } else if (action === "highlight") {
      if (hasSelection) {
        insert = `[highlight]${selected}[/highlight]`;
        cursorPos = start + insert.length;
      } else {
        insert = "[highlight][/highlight]";
        cursorPos = start + "[highlight]".length;
      }
    } else if (action === "color" && colorValue) {
      const open = `[color=${colorValue}]`;
      const close = "[/color]";
      if (hasSelection) {
        insert = `${open}${selected}${close}`;
        cursorPos = start + insert.length;
      } else {
        insert = `${open}${close}`;
        cursorPos = start + open.length;
      }
    } else if (action === "link") {
      openRichLinkModal(editable);
      return;
    } else if (action === "br") {
      insert = "[br]";
      cursorPos = start + insert.length;
    } else return;

    editable.value = val.slice(0, start) + insert + val.slice(end);
    editable.setSelectionRange(cursorPos, cursorPos);
    editable.dispatchEvent(new Event("input", { bubbles: true }));
    editable.focus();
  }

  function setMode(next, options = {}) {
    const m = next === "raw" ? "raw" : "visual";
    const ta = getTextarea();
    const wrap = el("sectionEditorWrap");
    const visualBtn = el("editorModeVisual");
    const rawBtn = el("editorModeRaw");

    if (m === "visual" && ta && !options.force) {
      const text = ta.value || "";
      if (text.trim()) {
        loadSectionsFromText(text, { silent: options.silent, allowEmpty: true });
      } else if (!sections.length) {
        sections = [
          M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH),
          M().createEmptySection("Important Dates", M().CONTENT_TYPES.DATES),
          M().createEmptySection("Important Links", M().CONTENT_TYPES.LINKS)
        ];
      }
    }

    if (m === "raw" && mode === "visual" && !options.skipCompile) {
      pushSectionsToTextarea({ silent: true });
    }

    mode = m;
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    } catch {
      /* ignore */
    }

    if (wrap) wrap.classList.toggle("is-raw-mode", mode === "raw");
    if (ta) ta.classList.toggle("is-hidden-raw-off", mode === "visual");
    if (visualBtn) {
      visualBtn.classList.toggle("is-active", mode === "visual");
      visualBtn.setAttribute("aria-selected", mode === "visual" ? "true" : "false");
    }
    if (rawBtn) {
      rawBtn.classList.toggle("is-active", mode === "raw");
      rawBtn.setAttribute("aria-selected", mode === "raw" ? "true" : "false");
    }

    const modeHint = el("sectionEditorModeHint");
    const rawHint = el("sectionEditorRawHint");
    if (modeHint) modeHint.hidden = mode === "raw";
    if (rawHint) rawHint.hidden = mode !== "raw";

    if (mode === "visual") renderAllSections();
    clearEditorNotice();

    if (mode === "visual" && ta && !String(ta.value || "").trim() && sections.length) {
      pushSectionsToTextarea({ silent: true });
    }
    return true;
  }

  function showEditorNotice(message, tone) {
    const node = el("sectionEditorNotice");
    if (!node) return;
    node.textContent = message;
    node.className = `section-editor-notice is-${tone || "info"}`;
    node.hidden = false;
  }

  function clearEditorNotice() {
    const node = el("sectionEditorNotice");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  function pushSectionsToTextarea(options = {}) {
    const ta = getTextarea();
    if (!ta || syncing) return;
    syncing = true;
    const compiled = M().normalizeEditorText(M().compileEditorSectionsToText(sections));
    if (ta.value !== compiled) {
      ta.value = compiled;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    syncing = false;
    if (!options.silent) clearEditorNotice();
  }

  function scheduleCompile() {
    if (mode !== "visual" || syncing) return;
    clearTimeout(compileTimer);
    compileTimer = setTimeout(() => pushSectionsToTextarea(), 120);
  }

  function findSectionIndex(id) {
    return sections.findIndex((s) => s.id === id);
  }

  function updateSection(id, patch) {
    const idx = findSectionIndex(id);
    if (idx < 0) return;
    sections[idx] = { ...sections[idx], ...patch };
    scheduleCompile();
  }

  function moveSection(id, delta) {
    const idx = findSectionIndex(id);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= sections.length) return;
    const copy = sections.slice();
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    sections = copy;
    renderAllSections();
    scheduleCompile();
  }

  function removeSection(id) {
    if (sections.length <= 1) return;
    sections = sections.filter((s) => s.id !== id);
    renderAllSections();
    scheduleCompile();
  }

  function createSectionFromPreset(preset) {
    const type = preset.contentType || M().CONTENT_TYPES.PARAGRAPH;
    const sec = M().createEmptySection(preset.name || "New Section", type);
    if (preset.forceTable) sec.forceTable = true;
    if (preset.payload) {
      sec.payload = JSON.parse(JSON.stringify(preset.payload));
    }
    return sec;
  }

  function closeAddSectionModal() {
    const modal = el("secAddSectionModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
  }

  function openAddSectionModal() {
    const modal = el("secAddSectionModal");
    const list = el("secAddSectionPresets");
    if (!modal || !list) {
      addSectionFromPreset(SECTION_PRESETS.find((p) => p.id === "custom") || SECTION_PRESETS[0]);
      return;
    }
    list.innerHTML = SECTION_PRESETS.map(
      (p) => `
      <button type="button" class="sec-add-section-preset" data-preset-id="${escapeHtml(p.id)}" role="listitem">
        <span class="sec-add-section-preset__label">${escapeHtml(p.label)}</span>
        <span class="sec-add-section-preset__desc">${escapeHtml(p.description || "")}</span>
      </button>`
    ).join("");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    list.querySelector("button")?.focus();
  }

  function initAddSectionModal() {
    const modal = el("secAddSectionModal");
    if (!modal || modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";
    modal.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-add-section-action='cancel']")) {
        closeAddSectionModal();
        return;
      }
      const presetBtn = ev.target.closest("[data-preset-id]");
      if (!presetBtn) return;
      const preset = SECTION_PRESETS.find((p) => p.id === presetBtn.getAttribute("data-preset-id"));
      closeAddSectionModal();
      if (preset) addSectionFromPreset(preset);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.classList.contains("is-open")) closeAddSectionModal();
    });
  }

  function addSectionFromPreset(preset) {
    const sec = createSectionFromPreset(preset || SECTION_PRESETS[SECTION_PRESETS.length - 1]);
    sections.push(sec);
    renderAllSections();
    scheduleCompile();
    const root = el("sectionEditorRoot");
    const card = root?.querySelector(`[data-section-id="${sec.id}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card?.querySelector('[data-field="section-name"]')?.focus();
  }

  function addSection() {
    openAddSectionModal();
  }

  function duplicateSection(id) {
    syncSectionsFromDom();
    const idx = findSectionIndex(id);
    if (idx < 0) return;
    const source = sections[idx];
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = M().newSectionId ? M().newSectionId() : `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    copy.collapsed = false;
    if (copy.name && !/ \(copy\)$/i.test(copy.name)) {
      copy.name = `${copy.name} (copy)`;
    }
    sections.splice(idx + 1, 0, copy);
    renderAllSections();
    scheduleCompile();
  }

  function moveRowInArray(arr, index, delta) {
    if (!Array.isArray(arr) || arr.length < 2) return false;
    const next = index + delta;
    if (next < 0 || next >= arr.length) return false;
    const [item] = arr.splice(index, 1);
    arr.splice(next, 0, item);
    return true;
  }

  function onTypeChange(id, newType) {
    const idx = findSectionIndex(id);
    if (idx < 0) return;
    const sec = sections[idx];
    const oldBody = M().compileSectionBody
      ? M().compileSectionBody(sec)
      : M().compileEditorSectionsToText([sec]).replace(/^\[Section:[^\]]+\]\n?/i, "").trim();

    const next = {
      ...sec,
      contentType: newType,
      forceTable: newType === M().CONTENT_TYPES.TABLE,
      payload: M().defaultPayloadForType(newType)
    };

    if (newType === M().CONTENT_TYPES.PARAGRAPH) next.payload = { text: oldBody };
    else if (newType === M().CONTENT_TYPES.TABLE) {
      next.payload = M().parseTableSection(oldBody);
    } else if (newType === M().CONTENT_TYPES.MIXED) {
      next.payload = { raw: oldBody };
    }

    sections[idx] = next;
    renderSectionCard(next);
    scheduleCompile();
  }

  function contentTypeOptions(selected) {
    const friendly = {
      [M().CONTENT_TYPES.PARAGRAPH]: "Text",
      [M().CONTENT_TYPES.DATES]: "Dates / Fee rows",
      [M().CONTENT_TYPES.LINKS]: "Important Links",
      [M().CONTENT_TYPES.FAQ]: "FAQ",
      [M().CONTENT_TYPES.LIST]: "List",
      [M().CONTENT_TYPES.PARAGRAPH_LIST]: "Text + list",
      [M().CONTENT_TYPES.TABLE]: "Table",
      [M().CONTENT_TYPES.BLOCKS]: "Multiple blocks",
      [M().CONTENT_TYPES.MIXED]: "Advanced / mixed"
    };
    const labels = M().CONTENT_TYPE_LABELS || {};
    return Object.keys(labels)
      .map((key) => {
        const sel = key === selected ? " selected" : "";
        return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(friendly[key] || labels[key])}</option>`;
      })
      .join("");
  }

  function renderRowActions(extraClass, options = {}) {
    const extra = extraClass ? ` ${extraClass}` : "";
    const move =
      options.withMove !== false
        ? `<button type="button" class="sec-row-btn sec-row-btn--up${extra}" title="Move up" aria-label="Move up">↑</button>
      <button type="button" class="sec-row-btn sec-row-btn--down${extra}" title="Move down" aria-label="Move down">↓</button>`
        : "";
    return `${move}<button type="button" class="sec-row-btn sec-row-btn--add${extra}" title="Add row">+</button>
      <button type="button" class="sec-row-btn sec-row-btn--remove${extra}" title="Remove row">−</button>`;
  }

  function renderParagraphBody(sec) {
    const text = escapeHtml(sec.payload?.text || "");
    const inner = `<label class="sec-field-label">Content</label>
      <textarea class="sec-textarea" data-sec-id="${sec.id}" data-field="paragraph-text" rows="5" placeholder="Write section text. Use Format buttons for bold, color, highlight, and links.">${text}</textarea>`;
    return wrapRichField(inner, "paragraph");
  }

  function ensureDatesBlocks(sec) {
    if (sec.payload?.blocks?.length) return sec.payload.blocks;
    const blocks = [];
    for (const row of sec.payload?.rows || []) {
      blocks.push({
        type: "date",
        label: String(row?.label || ""),
        value: String(row?.value || "")
      });
    }
    for (const p of sec.payload?.paragraphs || []) {
      const t = String(p || "").trim();
      if (t) blocks.push({ type: "paragraph", text: t });
    }
    for (const item of sec.payload?.items || []) {
      blocks.push({
        type: "list",
        text: String(item?.text || ""),
        ordered: Boolean(item?.ordered)
      });
    }
    if (!blocks.length) blocks.push({ type: "date", label: "", value: "" });
    sec.payload = { blocks };
    return blocks;
  }

  function renderDatesBlock(block, index, sec) {
    const labels = datesFieldLabels(sec);
    if (block.type === "paragraph") {
      const inner = `
      <div class="sec-dates-block sec-dates-block--para" data-block-index="${index}" data-block-type="paragraph">
        <label class="sec-field-label">Paragraph</label>
        <textarea class="sec-textarea sec-textarea--compact" data-field="dates-para" rows="2" placeholder="Extra note">${escapeHtml(block.text)}</textarea>
        <div class="sec-row-actions sec-row-actions--block">${renderRowActions()}</div>
      </div>`;
      return wrapRichField(inner, "dates-para");
    }
    if (block.type === "list") {
      const inner = `
      <div class="sec-dates-block sec-dates-block--list" data-block-index="${index}" data-block-type="list">
        <div class="sec-row sec-row--stack">
          <textarea class="sec-textarea sec-textarea--compact" data-rich-input data-field="dates-list-text" rows="2" placeholder="List item">${escapeHtml(block.text)}</textarea>
          <label class="sec-check"><input type="checkbox" data-field="dates-list-ordered" ${block.ordered ? "checked" : ""}> Numbered</label>
          <div class="sec-row-actions">${renderRowActions()}</div>
        </div>
      </div>`;
      return wrapRichField(inner, `dates-list-${index}`, { compact: true });
    }
    const dateInner = `
      <div class="sec-dates-block sec-dates-block--date" data-block-index="${index}" data-block-type="date">
        <div class="sec-row sec-row--kv">
          ${wrapRichField(
            `<label class="sec-field-label">${escapeHtml(labels.label)}</label>
            <input type="text" class="sec-input" data-rich-input data-field="date-label" placeholder="${escapeHtml(labels.label)}" value="${escapeHtml(block.label)}">`,
            `dates-label-${index}`,
            { compact: true }
          )}
          ${wrapRichField(
            `<label class="sec-field-label">${escapeHtml(labels.value)}</label>
            <textarea class="sec-textarea sec-textarea--compact" data-rich-input data-field="date-value" rows="2" placeholder="${escapeHtml(labels.value)}">${escapeHtml(block.value)}</textarea>`,
            `dates-value-${index}`,
            { compact: true }
          )}
          <div class="sec-row-actions">${renderRowActions()}</div>
        </div>
      </div>`;
    return dateInner;
  }

  function renderDatesBody(sec) {
    const blocks = ensureDatesBlocks(sec);
    const feeLike = isFeeLikeSection(sec);
    const ageLike = isAgeLikeSection(sec);
    const addLabel = feeLike ? "+ Add fee row" : ageLike ? "+ Add age row" : "+ Add date";
    const blocksHtml = blocks.map((block, i) => renderDatesBlock(block, i, sec)).join("");
    return `
      <div class="sec-dates-blocks${feeLike ? " sec-dates-blocks--fee" : ""}" data-sec-id="${sec.id}" data-rows-kind="dates-blocks">${blocksHtml}</div>
      <div class="sec-dates-add-actions">
        <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="dates">${addLabel}</button>
        <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="dates-paragraph">+ Add paragraph</button>
        <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="dates-list">+ Add list item</button>
      </div>`;
  }

  function ensureLinkRow(row) {
    if (row && row.mode) return row;
    return {
      mode: "single",
      label: String(row?.label || ""),
      buttonText: String(row?.buttonText || ""),
      url: String(row?.url || ""),
      actions: Array.isArray(row?.actions) ? row.actions : []
    };
  }

  function renderLinkActionRow(action, linkIndex, actionIndex) {
    const urlInvalid = !isUrlFieldValid(action.url) ? " is-invalid" : "";
    const inner = `
      <div class="sec-link-action" data-link-index="${linkIndex}" data-action-index="${actionIndex}">
        <input type="text" class="sec-input" data-rich-input data-field="link-action-text" placeholder="Button text" value="${escapeHtml(action.buttonText)}">
        <input type="url" class="sec-input sec-input--url${urlInvalid}" data-field="link-action-url" placeholder="https://..." value="${escapeHtml(action.url)}" aria-invalid="${urlInvalid ? "true" : "false"}">
        <div class="sec-row-actions">${renderRowActions("sec-row-btn--link-action")}</div>
      </div>`;
    return wrapRichField(inner, `link-action-${linkIndex}-${actionIndex}`, { compact: true });
  }

  function renderLinkEntry(row, index) {
    const link = ensureLinkRow(row);
    const isMulti = link.mode === "multi";
    const actions = link.actions?.length
      ? link.actions
      : [
          { buttonText: "Hindi", url: "" },
          { buttonText: "English", url: "" }
        ];
    const actionsHtml = actions
      .map((action, actionIndex) => renderLinkActionRow(action, index, actionIndex))
      .join("");
    const urlInvalid = !isUrlFieldValid(link.url) ? " is-invalid" : "";

    return `
      <div class="sec-link-entry" data-row-index="${index}">
        ${wrapRichField(
          `<label class="sec-field-label">Link name</label>
        <input type="text" class="sec-input sec-input--title" data-rich-input data-field="link-label" placeholder="e.g. Apply Online" value="${escapeHtml(link.label)}">`,
          `link-label-${index}`,
          { compact: true }
        )}
        <label class="sec-check sec-check--block">
          <input type="checkbox" data-field="link-multi" ${isMulti ? "checked" : ""}>
          Hindi / English — multiple clickable buttons
        </label>
        <div class="sec-link-single${isMulti ? " is-hidden" : ""}">
          ${wrapRichField(
            `<label class="sec-field-label">Button text <span class="sec-field-label-muted">(blank = Click Here)</span></label>
          <input type="text" class="sec-input" data-rich-input data-field="link-button-text" placeholder="Click Here" value="${escapeHtml(link.buttonText)}">`,
            `link-button-${index}`,
            { compact: true }
          )}
          <label class="sec-field-label">URL</label>
          <input type="url" class="sec-input sec-input--url${urlInvalid}" data-field="link-url" placeholder="https://..." value="${escapeHtml(link.url)}" aria-invalid="${urlInvalid ? "true" : "false"}">
        </div>
        <div class="sec-link-multi${isMulti ? "" : " is-hidden"}">
          <p class="sec-field-hint">Each row = one button (e.g. Hindi, English)</p>
          <div class="sec-link-actions">${actionsHtml}</div>
          <button type="button" class="sec-add-row-btn" data-add-kind="link-action">+ Add button</button>
        </div>
        <div class="sec-link-entry-tools">
          <div class="sec-row-actions sec-row-actions--block">${renderRowActions("sec-row-btn--link-entry")}</div>
        </div>
      </div>`;
  }

  function renderLinksBody(sec) {
    const rows = sec.payload?.rows?.length ? sec.payload.rows.map(ensureLinkRow) : [ensureLinkRow({})];
    const rowsHtml = rows.map((row, i) => renderLinkEntry(row, i)).join("");
    return `<div class="sec-links" data-sec-id="${sec.id}" data-rows-kind="links">${rowsHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="links">+ Add link</button>`;
  }

  function renderFaqBody(sec) {
    const pairs = sec.payload?.pairs?.length ? sec.payload.pairs : [{ q: "", a: "" }];
    const rowsHtml = pairs
      .map(
        (pair, i) => `
      <div class="sec-faq-pair" data-row-index="${i}">
        <label class="sec-field-label">Question</label>
        <input type="text" class="sec-input" data-field="faq-q" placeholder="When will the result come?" value="${escapeHtml(pair.q)}">
        <label class="sec-field-label">Answer</label>
        <textarea class="sec-textarea sec-textarea--compact" data-field="faq-a" rows="3" placeholder="The answer will be published soon.">${escapeHtml(pair.a)}</textarea>
        <div class="sec-row-actions sec-row-actions--block">${renderRowActions()}</div>
      </div>`
      )
      .join("");
    return `<div class="sec-rows" data-sec-id="${sec.id}" data-rows-kind="faq">${rowsHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="faq">+ Add Question</button>`;
  }

  function renderListBody(sec) {
    const items = sec.payload?.items?.length ? sec.payload.items : [{ text: "", ordered: false }];
    const rowsHtml = items
      .map((item, i) => {
        const inner = `
      <div class="sec-row sec-row--stack" data-row-index="${i}">
        <textarea class="sec-textarea sec-textarea--compact" data-rich-input data-field="list-text" rows="2" placeholder="List item">${escapeHtml(item.text)}</textarea>
        <label class="sec-check"><input type="checkbox" data-field="list-ordered" ${item.ordered ? "checked" : ""}> Numbered</label>
        <div class="sec-row-actions">${renderRowActions()}</div>
      </div>`;
        return wrapRichField(inner, `list-item-${i}`, { compact: true });
      })
      .join("");
    return `<div class="sec-rows" data-sec-id="${sec.id}" data-rows-kind="list">${rowsHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="list">+ Add item</button>`;
  }

  function renderParagraphListBody(sec) {
    const paras = sec.payload?.paragraphs?.length ? sec.payload.paragraphs : [""];
    const items = sec.payload?.items?.length ? sec.payload.items : [{ text: "", ordered: false }];
    const parasHtml = paras
      .map(
        (p, i) => `
      <div class="sec-para-block" data-para-index="${i}">
        <textarea class="sec-textarea sec-textarea--compact" data-field="pl-paragraph" rows="2">${escapeHtml(p)}</textarea>
        <div class="sec-row-actions sec-row-actions--block">${renderRowActions("sec-row-btn--para")}</div>
      </div>`
      )
      .join("");
    const listHtml = items
      .map((item, i) => {
        const inner = `
      <div class="sec-row sec-row--stack" data-row-index="${i}">
        <textarea class="sec-textarea sec-textarea--compact" data-rich-input data-field="list-text" rows="2" placeholder="List item">${escapeHtml(item.text)}</textarea>
        <div class="sec-row-actions">${renderRowActions()}</div>
      </div>`;
        return wrapRichField(inner, `pl-list-${i}`, { compact: true });
      })
      .join("");
    return `
      <p class="sec-field-hint">Paragraphs</p>
      <div class="sec-paras" data-sec-id="${sec.id}">${parasHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="pl-paragraph">+ Add paragraph</button>
      <p class="sec-field-hint">List items</p>
      <div class="sec-rows" data-sec-id="${sec.id}" data-rows-kind="list">${listHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="list">+ Add list item</button>`;
  }

  function ensureTableBlocks(sec) {
    if (sec.payload?.blocks?.length) {
      sec.payload.blocks = sec.payload.blocks.map((block) => {
        if (block?.type === "text") return { type: "text", text: String(block.text || "") };
        return { type: "table", grid: M().normalizeTableGrid(block?.grid) };
      });
      return sec.payload.blocks;
    }
    if (sec.payload?.grid?.length) {
      sec.payload = { blocks: [{ type: "table", grid: M().normalizeTableGrid(sec.payload.grid) }] };
      return sec.payload.blocks;
    }
    if (sec.payload?.raw != null && String(sec.payload.raw).trim()) {
      sec.payload = M().parseTableSection(sec.payload.raw);
      return sec.payload.blocks;
    }
    sec.payload = M().defaultTablePayload();
    return sec.payload.blocks;
  }

  function renderTableBodyCell(cell, blockIndex, rowIndex, colIdx) {
    const parsed = M().parseTableCellForEditor(cell);
    const isLink = parsed.mode === "link";
    const textField = wrapRichField(
      `<textarea class="sec-textarea sec-textarea--compact sec-table-cell-input" data-rich-input data-field="table-cell-text" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" rows="3" placeholder="Cell text">${escapeHtml(parsed.text)}</textarea>`,
      `table-cell-${blockIndex}-${rowIndex}-${colIdx}`,
      { compact: true }
    );
    const linkLabelField = wrapRichField(
      `<input type="text" class="sec-input sec-table-cell-input" data-rich-input data-field="table-cell-link-label" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" value="${escapeHtml(parsed.label)}" placeholder="Button text">`,
      `table-cell-link-${blockIndex}-${rowIndex}-${colIdx}`,
      { compact: true }
    );
    return `
          <td class="sec-table-cell sec-table-cell--body" data-row-index="${rowIndex}" data-col-index="${colIdx}">
            <label class="sec-table-cell-link-toggle">
              <input type="checkbox" data-field="table-cell-link" ${isLink ? "checked" : ""}>
              Link
            </label>
            <div class="sec-table-cell-text-wrap${isLink ? " is-hidden" : ""}">
              ${textField}
            </div>
            <div class="sec-table-cell-link-wrap${isLink ? "" : " is-hidden"}">
              ${linkLabelField}
              <input type="url" class="sec-input sec-table-cell-input sec-input--url${!isUrlFieldValid(parsed.url) ? " is-invalid" : ""}" data-field="table-cell-link-url" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" value="${escapeHtml(parsed.url)}" placeholder="https://..." aria-invalid="${!isUrlFieldValid(parsed.url) ? "true" : "false"}">
            </div>
          </td>`;
  }

  function renderTableGridEditor(grid, blockIndex, secId) {
    const colCount = grid[0]?.length || 1;
    const headerCells = grid[0]
      .map(
        (cell, colIdx) => `
        <th class="sec-table-cell sec-table-cell--head" data-row-index="0" data-col-index="${colIdx}">
          ${wrapRichField(
            `<input type="text" class="sec-input sec-table-cell-input" data-rich-input data-field="table-cell" data-block-index="${blockIndex}" data-row-index="0" data-col-index="${colIdx}" value="${escapeHtml(cell)}" placeholder="Header ${colIdx + 1}">`,
            `table-head-${blockIndex}-${colIdx}`,
            { compact: true }
          )}
          ${
            colCount > 1
              ? `<button type="button" class="sec-table-mini-btn" data-action="table-remove-col" data-block-index="${blockIndex}" data-col-index="${colIdx}" title="Remove column">×</button>`
              : ""
          }
        </th>`
      )
      .join("");

    const bodyRows = grid
      .slice(1)
      .map((row, rowOffset) => {
        const rowIndex = rowOffset + 1;
        const cells = row
          .map((cell, colIdx) => renderTableBodyCell(cell, blockIndex, rowIndex, colIdx))
          .join("");
        return `
        <tr class="sec-table-row" data-row-index="${rowIndex}">
          ${cells}
          <td class="sec-table-row-tools">
            ${
              grid.length > 2
                ? `<button type="button" class="sec-table-mini-btn" data-action="table-remove-row" data-block-index="${blockIndex}" data-row-index="${rowIndex}" title="Remove row">×</button>`
                : ""
            }
          </td>
        </tr>`;
      })
      .join("");

    return `
      <div class="sec-table-scroll">
        <table class="sec-table-grid">
          <thead>
            <tr class="sec-table-row sec-table-row--head" data-row-index="0">
              ${headerCells}
              <th class="sec-table-row-tools sec-table-row-tools--head" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <div class="sec-table-actions sec-table-actions--inline">
        <button type="button" class="sec-add-row-btn" data-sec-id="${secId}" data-add-kind="table-row" data-block-index="${blockIndex}">+ Add row</button>
        <button type="button" class="sec-add-row-btn" data-sec-id="${secId}" data-add-kind="table-col" data-block-index="${blockIndex}">+ Add column</button>
      </div>`;
  }

  function renderTableBlock(block, blockIndex, totalBlocks, secId) {
    if (block.type === "text") {
      return `
      <div class="sec-table-block sec-table-block--text" data-block-index="${blockIndex}" data-block-type="text">
        <div class="sec-table-block__head">
          <span class="sec-table-block__label">Text / heading</span>
          <div class="sec-table-block__tools">
            <button type="button" class="sec-tool-btn" data-action="table-block-up" data-block-index="${blockIndex}" title="Move up">↑</button>
            <button type="button" class="sec-tool-btn" data-action="table-block-down" data-block-index="${blockIndex}" title="Move down">↓</button>
            <button type="button" class="sec-tool-btn sec-tool-btn--danger" data-action="table-remove-block" data-block-index="${blockIndex}" title="Remove" ${totalBlocks <= 1 ? "disabled" : ""}>✕</button>
          </div>
        </div>
        <textarea class="sec-textarea" data-field="table-block-text" data-block-index="${blockIndex}" rows="3" placeholder="Heading or paragraph — rich tags supported">${escapeHtml(block.text || "")}</textarea>
      </div>`;
    }

    const grid = M().normalizeTableGrid(block.grid || M().defaultTableGrid());
    return `
      <div class="sec-table-block sec-table-block--grid" data-block-index="${blockIndex}" data-block-type="table">
        <div class="sec-table-block__head">
          <span class="sec-table-block__label">Table</span>
          <div class="sec-table-block__tools">
            <button type="button" class="sec-tool-btn" data-action="table-block-up" data-block-index="${blockIndex}" title="Move up">↑</button>
            <button type="button" class="sec-tool-btn" data-action="table-block-down" data-block-index="${blockIndex}" title="Move down">↓</button>
            <button type="button" class="sec-tool-btn sec-tool-btn--danger" data-action="table-remove-block" data-block-index="${blockIndex}" title="Remove" ${totalBlocks <= 1 ? "disabled" : ""}>✕</button>
          </div>
        </div>
        <p class="sec-field-hint">Row 1 = header. Tick <strong>Link</strong> on a cell for a clickable button. Paste spreadsheet rows (Tab / CSV) into any cell to fill the grid.</p>
        ${renderTableGridEditor(grid, blockIndex, secId)}
      </div>`;
  }

  function renderTableBody(sec) {
    const blocks = ensureTableBlocks(sec);
    const blocksHtml = blocks.map((block, i) => renderTableBlock(block, i, blocks.length, sec.id)).join("");
    return `
      <div class="sec-table-editor" data-sec-id="${sec.id}">
        <p class="sec-table-hint">Build tables visually — no need to type <code>| table</code> markers. Add text blocks above/below as needed.</p>
        <div class="sec-table-blocks">${blocksHtml}</div>
        <div class="sec-table-block-actions">
          <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="table-block-text">+ Add text / heading</button>
          <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="table-block-table">+ Add table</button>
        </div>
      </div>`;
  }

  function renderBlockSectionMini(block, blockIndex, secId) {
    if (block.type === "text") {
      const inner = `<textarea class="sec-textarea sec-textarea--compact" data-field="flex-text" data-block-index="${blockIndex}" rows="3">${escapeHtml(block.text || "")}</textarea>`;
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="text">
        <span class="sec-flex-block__label">Text</span>
        ${wrapRichField(inner, "flex-text")}
      </div>`;
    }
    if (block.type === "table") {
      const fakeSec = { id: secId, payload: { blocks: [{ type: "table", grid: M().normalizeTableGrid(block.grid) }] } };
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="table">${renderTableBlock({ type: "table", grid: block.grid }, 0, 1, secId)}</div>`;
    }
    if (block.type === "dates") {
      const fakeSec = { id: `${secId}_b${blockIndex}`, payload: block };
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="dates">${renderDatesBody(fakeSec)}</div>`;
    }
    if (block.type === "links") {
      const fakeSec = { id: `${secId}_b${blockIndex}`, payload: { rows: block.rows || [] } };
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="links">${renderLinksBody(fakeSec)}</div>`;
    }
    if (block.type === "faq") {
      const fakeSec = { id: `${secId}_b${blockIndex}`, payload: { pairs: block.pairs || [] } };
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="faq">${renderFaqBody(fakeSec)}</div>`;
    }
    if (block.type === "list") {
      const fakeSec = { id: `${secId}_b${blockIndex}`, payload: { items: block.items || [] } };
      return `<div class="sec-flex-block" data-block-index="${blockIndex}" data-block-type="list">${renderListBody(fakeSec)}</div>`;
    }
    return "";
  }

  function renderBlocksBody(sec) {
    const blocks = sec.payload?.blocks?.length ? sec.payload.blocks : [];
    const html = blocks.map((b, i) => renderBlockSectionMini(b, i, sec.id)).join("");
    return `<div class="sec-flex-blocks" data-sec-id="${sec.id}">${html}</div>
      <p class="sec-field-hint">Multiple content blocks in one section — text, tables, dates, links, etc.</p>`;
  }

  function renderRawBody(sec, label) {
    const raw = escapeHtml(sec.payload?.raw ?? "");
    const warn = sec.editorSafe === false
      ? `<p class="sec-field-hint sec-field-hint--warn">${escapeHtml(sec.unsafeReason || "Advanced formatting in this section")}</p>`
      : "";
    return `${warn}<label class="sec-field-label">${escapeHtml(label)}</label>
      <textarea class="sec-textarea sec-textarea--mono" data-sec-id="${sec.id}" data-field="raw-text" rows="6" placeholder="One line per row. Table: comma-separated columns.">${raw}</textarea>`;
  }

  function renderSectionBody(sec) {
    if (sec.editorSafe === false && sec.contentType === M().CONTENT_TYPES.MIXED) {
      return renderRawBody(sec, "Advanced content (raw)");
    }
    switch (sec.contentType) {
      case M().CONTENT_TYPES.DATES:
        return renderDatesBody(sec);
      case M().CONTENT_TYPES.LINKS:
        return renderLinksBody(sec);
      case M().CONTENT_TYPES.FAQ:
        return renderFaqBody(sec);
      case M().CONTENT_TYPES.LIST:
        return renderListBody(sec);
      case M().CONTENT_TYPES.PARAGRAPH_LIST:
        return renderParagraphListBody(sec);
      case M().CONTENT_TYPES.TABLE:
        return renderTableBody(sec);
      case M().CONTENT_TYPES.BLOCKS:
        return renderBlocksBody(sec);
      case M().CONTENT_TYPES.MIXED:
        return renderRawBody(sec, "Free text (advanced). Switch to Raw text for full control.");
      default:
        return renderParagraphBody(sec);
    }
  }

  function sectionTypeLabel(contentType) {
    const friendly = {
      [M().CONTENT_TYPES.PARAGRAPH]: "Text",
      [M().CONTENT_TYPES.DATES]: "Dates / Fee",
      [M().CONTENT_TYPES.LINKS]: "Links",
      [M().CONTENT_TYPES.FAQ]: "FAQ",
      [M().CONTENT_TYPES.LIST]: "List",
      [M().CONTENT_TYPES.PARAGRAPH_LIST]: "Text + list",
      [M().CONTENT_TYPES.TABLE]: "Table",
      [M().CONTENT_TYPES.BLOCKS]: "Blocks",
      [M().CONTENT_TYPES.MIXED]: "Advanced"
    };
    const labels = M().CONTENT_TYPE_LABELS || {};
    return friendly[contentType] || labels[contentType] || contentType || "Section";
  }

  function toggleSectionCollapsed(secId) {
    syncSectionsFromDom();
    const idx = findSectionIndex(secId);
    if (idx < 0) return;
    sections[idx].collapsed = !sections[idx].collapsed;
    renderSectionCard(sections[idx]);
  }

  function renderSectionCard(sec) {
    const root = el("sectionEditorRoot");
    if (!root) return;
    const existing = root.querySelector(`[data-section-id="${sec.id}"]`);
    const collapsed = Boolean(sec.collapsed);
    const typeLabel = sectionTypeLabel(sec.contentType);
    const displayName = String(sec.name || "").trim() || "Untitled";
    const unsafeBadge =
      sec.editorSafe === false
        ? `<span class="sec-card__unsafe-badge" title="${escapeHtml(sec.unsafeReason || "Advanced")}">Advanced</span>`
        : "";
    const html = `
      <article class="sec-card${collapsed ? " is-collapsed" : ""}${sec.editorSafe === false ? " is-unsafe" : ""}" data-section-id="${sec.id}">
        <header class="sec-card__head" data-sec-id="${sec.id}">
          <button type="button" class="sec-toggle-btn" data-action="toggle" data-sec-id="${sec.id}" aria-expanded="${collapsed ? "false" : "true"}" title="${collapsed ? "Expand section" : "Collapse section"}">${collapsed ? "▶" : "▼"}</button>
          <div class="sec-card__head-main">
            <div class="sec-card__collapsed-bar" data-action="toggle" data-sec-id="${sec.id}" role="button" tabindex="0" aria-label="Open section ${escapeHtml(displayName)}">
              <span class="sec-card__collapsed-name">${escapeHtml(displayName)}</span>
              <span class="sec-card__collapsed-type">${escapeHtml(typeLabel)}</span>
              ${unsafeBadge}
            </div>
            <div class="sec-card__expandable">
              <div class="sec-card__title-row">
                <label class="sec-field-label">Section title</label>
                <input type="text" class="sec-input sec-input--title" data-sec-id="${sec.id}" data-field="section-name" value="${escapeHtml(sec.name)}" placeholder="e.g. Important Dates">
              </div>
              <div class="sec-card__meta-row">
                <label class="sec-field-label">Section type</label>
                <select class="sec-select" data-sec-id="${sec.id}" data-field="content-type">${contentTypeOptions(sec.contentType)}</select>
              </div>
            </div>
          </div>
          <div class="sec-card__tools">
            <button type="button" class="sec-tool-btn" data-action="duplicate" data-sec-id="${sec.id}" title="Duplicate section" aria-label="Duplicate">⧉</button>
            <button type="button" class="sec-tool-btn" data-action="up" data-sec-id="${sec.id}" title="Move up" aria-label="Move up">↑</button>
            <button type="button" class="sec-tool-btn" data-action="down" data-sec-id="${sec.id}" title="Move down" aria-label="Move down">↓</button>
            <button type="button" class="sec-tool-btn sec-tool-btn--danger" data-action="remove" data-sec-id="${sec.id}" title="Delete section" aria-label="Delete">✕</button>
          </div>
        </header>
        <div class="sec-card__body">${renderSectionBody(sec)}</div>
        <footer class="sec-card__foot">
          <button type="button" class="sec-card-foot-btn" data-action="duplicate" data-sec-id="${sec.id}">Duplicate</button>
          <button type="button" class="sec-card-foot-btn" data-action="up" data-sec-id="${sec.id}">Move up</button>
          <button type="button" class="sec-card-foot-btn" data-action="down" data-sec-id="${sec.id}">Move down</button>
          <button type="button" class="sec-card-foot-btn sec-card-foot-btn--danger" data-action="remove" data-sec-id="${sec.id}">Delete</button>
        </footer>
      </article>`;

    if (existing) {
      existing.outerHTML = html;
    } else {
      root.insertAdjacentHTML("beforeend", html);
    }
  }

  function renderAllSections() {
    const root = el("sectionEditorRoot");
    if (!root) return;
    root.innerHTML = "";
    for (const sec of sections) renderSectionCard(sec);
  }

  function collectDatesFromCard(card, sec) {
    const blocks = [];
    card.querySelectorAll(".sec-dates-block").forEach((node) => {
      const type = node.getAttribute("data-block-type") || "date";
      if (type === "paragraph") {
        blocks.push({
          type: "paragraph",
          text: node.querySelector('[data-field="dates-para"]')?.value || ""
        });
      } else if (type === "list") {
        blocks.push({
          type: "list",
          text: node.querySelector('[data-field="dates-list-text"]')?.value || "",
          ordered: node.querySelector('[data-field="dates-list-ordered"]')?.checked || false
        });
      } else {
        blocks.push({
          type: "date",
          label: node.querySelector('[data-field="date-label"]')?.value || "",
          value: node.querySelector('[data-field="date-value"]')?.value || ""
        });
      }
    });
    sec.payload = { blocks: blocks.length ? blocks : [{ type: "date", label: "", value: "" }] };
  }

  function collectTableBlocksFromCard(card, sec) {
    const blocks = [];
    card.querySelectorAll(".sec-table-block").forEach((node) => {
      const blockIndex = Number(node.getAttribute("data-block-index") || 0);
      const type = node.getAttribute("data-block-type") || "table";
      if (type === "text") {
        blocks[blockIndex] = {
          type: "text",
          text: node.querySelector('[data-field="table-block-text"]')?.value || ""
        };
        return;
      }

      const grid = [];
      const map = new Map();
      node.querySelectorAll(".sec-table-cell").forEach((cellEl) => {
        let rowIndex = Number(cellEl.getAttribute("data-row-index"));
        let colIndex = Number(cellEl.getAttribute("data-col-index"));
        if (Number.isNaN(rowIndex)) {
          const probe = cellEl.querySelector("[data-row-index]");
          rowIndex = Number(probe?.getAttribute("data-row-index") || 0);
          colIndex = Number(probe?.getAttribute("data-col-index") || 0);
        }
        if (!map.has(rowIndex)) map.set(rowIndex, []);
        const row = map.get(rowIndex);
        while (row.length <= colIndex) row.push("");

        const isHeader = rowIndex === 0;
        if (isHeader) {
          row[colIndex] =
            cellEl.querySelector('[data-field="table-cell"]')?.value ||
            cellEl.querySelector('[data-field="table-cell-text"]')?.value ||
            "";
          return;
        }

        const isLink = cellEl.querySelector('[data-field="table-cell-link"]')?.checked || false;
        if (isLink) {
          row[colIndex] = M().compileTableCellFromEditor({
            mode: "link",
            label: cellEl.querySelector('[data-field="table-cell-link-label"]')?.value || "",
            url: cellEl.querySelector('[data-field="table-cell-link-url"]')?.value || ""
          });
        } else {
          row[colIndex] = cellEl.querySelector('[data-field="table-cell-text"]')?.value || "";
        }
      });
      const indices = [...map.keys()].sort((a, b) => a - b);
      for (const idx of indices) grid.push(map.get(idx) || []);
      blocks[blockIndex] = { type: "table", grid: M().normalizeTableGrid(grid.length ? grid : M().defaultTableGrid()) };
    });

    const ordered = blocks.filter(Boolean);
    sec.payload = { blocks: ordered.length ? ordered : M().defaultTablePayload().blocks };
  }

  function collectLinksFromCard(card, sec) {
    const rows = [];
    card.querySelectorAll(".sec-link-entry").forEach((entry) => {
      const isMulti = entry.querySelector('[data-field="link-multi"]')?.checked || false;
      const label = entry.querySelector('[data-field="link-label"]')?.value || "";
      if (isMulti) {
        const actions = [];
        entry.querySelectorAll(".sec-link-action").forEach((node) => {
          actions.push({
            buttonText: node.querySelector('[data-field="link-action-text"]')?.value || "",
            url: node.querySelector('[data-field="link-action-url"]')?.value || ""
          });
        });
        rows.push({
          mode: "multi",
          label,
          buttonText: "",
          url: "",
          actions: actions.length ? actions : [{ buttonText: "Hindi", url: "" }, { buttonText: "English", url: "" }]
        });
      } else {
        rows.push({
          mode: "single",
          label,
          buttonText: entry.querySelector('[data-field="link-button-text"]')?.value || "",
          url: entry.querySelector('[data-field="link-url"]')?.value || "",
          actions: []
        });
      }
    });
    sec.payload = { rows: rows.length ? rows : [ensureLinkRow({})] };
  }

  function collectFaqFromCard(card, sec) {
    const pairs = [];
    card.querySelectorAll(".sec-faq-pair").forEach((row) => {
      pairs.push({
        q: row.querySelector('[data-field="faq-q"]')?.value || "",
        a: row.querySelector('[data-field="faq-a"]')?.value || ""
      });
    });
    sec.payload = { pairs: pairs.length ? pairs : [{ q: "", a: "" }] };
  }

  function collectListFromCard(card, sec) {
    const items = [];
    card.querySelectorAll('.sec-row [data-field="list-text"]').forEach((input) => {
      const row = input.closest(".sec-row");
      const ordered = row?.querySelector('[data-field="list-ordered"]')?.checked || false;
      items.push({ text: input.value || "", ordered });
    });
    sec.payload = { items: items.length ? items : [{ text: "", ordered: false }] };
  }

  function collectParagraphListFromCard(card, sec) {
    const paragraphs = [];
    card.querySelectorAll('[data-field="pl-paragraph"]').forEach((ta) => {
      paragraphs.push(ta.value || "");
    });
    const items = [];
    card.querySelectorAll('.sec-rows[data-rows-kind="list"] .sec-row').forEach((row) => {
      items.push({ text: row.querySelector('[data-field="list-text"]')?.value || "", ordered: false });
    });
    sec.payload = {
      paragraphs: paragraphs.length ? paragraphs : [""],
      items: items.length ? items : [{ text: "", ordered: false }]
    };
  }

  function collectBlocksFromCard(card, sec) {
    const blocks = [];
    card.querySelectorAll(".sec-flex-block").forEach((node) => {
      const type = node.getAttribute("data-block-type") || "text";
      if (type === "text") {
        blocks.push({ type: "text", text: node.querySelector('[data-field="flex-text"]')?.value || "" });
        return;
      }
      if (type === "table") {
        const fake = { id: sec.id, payload: {} };
        collectTableBlocksFromCard(node, fake);
        const tbl = (fake.payload?.blocks || []).find((b) => b.type === "table");
        if (tbl) blocks.push({ type: "table", grid: tbl.grid });
        return;
      }
      if (type === "dates") {
        const fake = { id: sec.id, payload: {}, contentType: M().CONTENT_TYPES.DATES };
        collectDatesFromCard(node, fake);
        blocks.push({ type: "dates", ...fake.payload });
        return;
      }
      if (type === "links") {
        const fake = { id: sec.id, payload: {}, contentType: M().CONTENT_TYPES.LINKS };
        collectLinksFromCard(node, fake);
        blocks.push({ type: "links", rows: fake.payload.rows });
        return;
      }
      if (type === "faq") {
        const fake = { id: sec.id, payload: {}, contentType: M().CONTENT_TYPES.FAQ };
        collectFaqFromCard(node, fake);
        blocks.push({ type: "faq", pairs: fake.payload.pairs });
        return;
      }
      if (type === "list") {
        const fake = { id: sec.id, payload: {}, contentType: M().CONTENT_TYPES.LIST };
        collectListFromCard(node, fake);
        blocks.push({ type: "list", items: fake.payload.items });
      }
    });
    sec.payload = { blocks: blocks.length ? blocks : sec.payload?.blocks || [] };
  }

  function collectSectionFromDom(sec) {
    const card = document.querySelector(`[data-section-id="${sec.id}"]`);
    if (!card) return sec;
    const nameInput = card.querySelector('[data-field="section-name"]');
    if (nameInput) sec.name = nameInput.value;

    switch (sec.contentType) {
      case M().CONTENT_TYPES.DATES:
        collectDatesFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.LINKS:
        collectLinksFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.FAQ:
        collectFaqFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.LIST:
        collectListFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.PARAGRAPH_LIST:
        collectParagraphListFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.PARAGRAPH: {
        const ta = card.querySelector('[data-field="paragraph-text"]');
        sec.payload = { text: ta?.value || "" };
        break;
      }
      case M().CONTENT_TYPES.TABLE:
        collectTableBlocksFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.BLOCKS:
        collectBlocksFromCard(card, sec);
        break;
      case M().CONTENT_TYPES.MIXED:
      default: {
        const ta = card.querySelector('[data-field="raw-text"]');
        sec.payload = { raw: ta?.value || "" };
        break;
      }
    }
    return sec;
  }

  function syncSectionsFromDom() {
    sections = sections.map((sec) => collectSectionFromDom({ ...sec }));
  }

  function handleRootInput(ev) {
    const target = ev.target;
    if (!target.closest("#sectionEditorRoot")) return;

    if (target.matches('[data-field="section-name"]')) {
      const card = target.closest(".sec-card");
      const summary = card?.querySelector(".sec-card__collapsed-name");
      if (summary) summary.textContent = target.value.trim() || "Untitled";
    }

    if (target.matches(".sec-input--url")) {
      markUrlValidity(target);
    }

    syncSectionsFromDom();
    scheduleCompile();
  }

  function handleRootChange(ev) {
    const target = ev.target;
    if (!target.closest("#sectionEditorRoot")) return;

    if (target.matches('[data-field="content-type"]')) {
      syncSectionsFromDom();
      onTypeChange(target.getAttribute("data-sec-id"), target.value);
      return;
    }

    if (target.matches('[data-field="table-cell-link"]')) {
      const cell = target.closest(".sec-table-cell");
      if (cell) {
        const textWrap = cell.querySelector(".sec-table-cell-text-wrap");
        const linkWrap = cell.querySelector(".sec-table-cell-link-wrap");
        if (target.checked) {
          textWrap?.classList.add("is-hidden");
          linkWrap?.classList.remove("is-hidden");
        } else {
          textWrap?.classList.remove("is-hidden");
          linkWrap?.classList.add("is-hidden");
        }
      }
      syncSectionsFromDom();
      scheduleCompile();
      return;
    }

    if (target.matches('[data-field="link-multi"]')) {
      syncSectionsFromDom();
      const entry = target.closest(".sec-link-entry");
      const card = target.closest(".sec-card");
      const secId = card?.getAttribute("data-section-id");
      const idx = findSectionIndex(secId);
      if (idx < 0 || !entry) return;
      const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
      const row = ensureLinkRow(sections[idx].payload.rows[rowIdx] || {});
      if (target.checked) {
        row.mode = "multi";
        if (!row.actions?.length) {
          row.actions = [
            { buttonText: row.buttonText || "Hindi", url: row.url || "" },
            { buttonText: "English", url: "" }
          ];
        }
        row.buttonText = "";
        row.url = "";
      } else {
        row.mode = "single";
        const first = row.actions?.[0];
        if (first) {
          row.buttonText = first.buttonText || "";
          row.url = first.url || "";
        }
        row.actions = [];
      }
      sections[idx].payload.rows[rowIdx] = row;
      renderSectionCard(sections[idx]);
      scheduleCompile();
      return;
    }

    syncSectionsFromDom();
    scheduleCompile();
  }

  function handleRootClick(ev) {
    if (ev.target.matches(".sec-rich-btn")) {
      const wrap = ev.target.closest(".sec-rich-field");
      const editable = getRichEditable(wrap);
      applyRichAction(editable, ev.target.getAttribute("data-rich-action"), "");
      syncSectionsFromDom();
      scheduleCompile();
      return;
    }
    if (ev.target.matches(".sec-rich-select")) {
      const color = ev.target.value;
      if (!color) return;
      const wrap = ev.target.closest(".sec-rich-field");
      const editable = getRichEditable(wrap);
      applyRichAction(editable, "color", color);
      ev.target.value = "";
      syncSectionsFromDom();
      scheduleCompile();
      return;
    }

    const collapsedBar = ev.target.closest(".sec-card__collapsed-bar[data-action='toggle']");
    if (collapsedBar) {
      const secId = collapsedBar.getAttribute("data-sec-id");
      if (secId) {
        toggleSectionCollapsed(secId);
        return;
      }
    }

    const btn = ev.target.closest("button");
    if (!btn || !btn.closest("#sectionEditorRoot")) return;

    const secId = btn.getAttribute("data-sec-id");
    const action = btn.getAttribute("data-action");
    const addKind = btn.getAttribute("data-add-kind");

    if (action === "toggle" && secId) {
      toggleSectionCollapsed(secId);
      return;
    }

    if (action === "table-remove-row" || action === "table-remove-col") {
      const card = btn.closest(".sec-card");
      const secId2 = card?.getAttribute("data-section-id");
      const idx = findSectionIndex(secId2);
      if (idx < 0) return;
      syncSectionsFromDom();
      const sec = sections[idx];
      ensureTableBlocks(sec);
      const blockIdx = Number(btn.getAttribute("data-block-index") || 0);
      const block = sec.payload.blocks[blockIdx];
      if (!block || block.type !== "table") return;
      const grid = block.grid;

      if (action === "table-remove-row") {
        const rowIdx = Number(btn.getAttribute("data-row-index") || 0);
        if (grid.length > 1 && rowIdx > 0) grid.splice(rowIdx, 1);
      } else {
        const colIdx = Number(btn.getAttribute("data-col-index") || 0);
        if (grid[0].length > 1) {
          for (const row of grid) row.splice(colIdx, 1);
        }
      }
      block.grid = M().normalizeTableGrid(grid);
      renderSectionCard(sec);
      scheduleCompile();
      return;
    }

    if (action === "table-remove-block" || action === "table-block-up" || action === "table-block-down") {
      const card = btn.closest(".sec-card");
      const secId2 = card?.getAttribute("data-section-id");
      const idx = findSectionIndex(secId2);
      if (idx < 0) return;
      syncSectionsFromDom();
      const sec = sections[idx];
      ensureTableBlocks(sec);
      const blockIdx = Number(btn.getAttribute("data-block-index") || 0);
      const blocks = sec.payload.blocks;

      if (action === "table-remove-block" && blocks.length > 1) {
        blocks.splice(blockIdx, 1);
      } else if (action === "table-block-up" && blockIdx > 0) {
        const [item] = blocks.splice(blockIdx, 1);
        blocks.splice(blockIdx - 1, 0, item);
      } else if (action === "table-block-down" && blockIdx < blocks.length - 1) {
        const [item] = blocks.splice(blockIdx, 1);
        blocks.splice(blockIdx + 1, 0, item);
      }
      renderSectionCard(sec);
      scheduleCompile();
      return;
    }

    if (action === "up" && secId) {
      syncSectionsFromDom();
      moveSection(secId, -1);
      return;
    }
    if (action === "down" && secId) {
      syncSectionsFromDom();
      moveSection(secId, 1);
      return;
    }
    if (action === "duplicate" && secId) {
      duplicateSection(secId);
      return;
    }
    if (action === "remove" && secId) {
      syncSectionsFromDom();
      removeSection(secId);
      return;
    }

    if (btn.classList.contains("sec-row-btn--up") || btn.classList.contains("sec-row-btn--down")) {
      const delta = btn.classList.contains("sec-row-btn--up") ? -1 : 1;
      const card = btn.closest(".sec-card");
      if (!card) return;
      syncSectionsFromDom();
      const secId2 = card.getAttribute("data-section-id");
      const idx = findSectionIndex(secId2);
      if (idx < 0) return;
      const sec = sections[idx];
      let moved = false;

      const datesBlock = btn.closest(".sec-dates-block");
      if (sec.contentType === M().CONTENT_TYPES.DATES && datesBlock) {
        ensureDatesBlocks(sec);
        const blockIdx = Number(datesBlock.getAttribute("data-block-index") || 0);
        moved = moveRowInArray(sec.payload.blocks, blockIdx, delta);
      } else if (sec.contentType === M().CONTENT_TYPES.FAQ) {
        const pair = btn.closest(".sec-faq-pair");
        const rowIdx = Number(pair?.getAttribute("data-row-index") || 0);
        moved = moveRowInArray(sec.payload.pairs, rowIdx, delta);
      } else if (sec.contentType === M().CONTENT_TYPES.LINKS) {
        const entry = btn.closest(".sec-link-entry");
        const actionNode = btn.closest(".sec-link-action");
        if (actionNode && entry) {
          const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
          const actionIdx = Number(actionNode.getAttribute("data-action-index") || 0);
          const linkRow = ensureLinkRow(sec.payload.rows[rowIdx] || {});
          moved = moveRowInArray(linkRow.actions, actionIdx, delta);
          sec.payload.rows[rowIdx] = linkRow;
        } else if (entry) {
          const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
          moved = moveRowInArray(sec.payload.rows, rowIdx, delta);
        }
      } else if (sec.contentType === M().CONTENT_TYPES.LIST) {
        const row = btn.closest(".sec-row");
        const rowIdx = Number(row?.getAttribute("data-row-index") || 0);
        moved = moveRowInArray(sec.payload.items, rowIdx, delta);
      } else if (sec.contentType === M().CONTENT_TYPES.PARAGRAPH_LIST) {
        const para = btn.closest(".sec-para-block");
        const row = btn.closest(".sec-row");
        if (para) {
          const rowIdx = Number(para.getAttribute("data-para-index") || 0);
          moved = moveRowInArray(sec.payload.paragraphs, rowIdx, delta);
        } else if (row) {
          const rowIdx = Number(row.getAttribute("data-row-index") || 0);
          moved = moveRowInArray(sec.payload.items, rowIdx, delta);
        }
      }

      if (moved) {
        renderSectionCard(sec);
        scheduleCompile();
      }
      return;
    }

    if (btn.classList.contains("sec-add-row-btn") && addKind) {
      const card = btn.closest(".sec-card");
      const secIdResolved = secId || card?.getAttribute("data-section-id");
      if (!secIdResolved) return;
      syncSectionsFromDom();
      const idx = findSectionIndex(secIdResolved);
      if (idx < 0) return;
      const sec = sections[idx];
      if (addKind === "dates") {
        ensureDatesBlocks(sec);
        sec.payload.blocks.push({ type: "date", label: "", value: "" });
      } else if (addKind === "dates-paragraph") {
        ensureDatesBlocks(sec);
        sec.payload.blocks.push({ type: "paragraph", text: "" });
      } else if (addKind === "dates-list") {
        ensureDatesBlocks(sec);
        sec.payload.blocks.push({ type: "list", text: "", ordered: false });
      } else if (addKind === "links") {
        sec.payload.rows.push(ensureLinkRow({}));
      } else if (addKind === "link-action") {
        const entry = btn.closest(".sec-link-entry");
        const rowIdx = Number(entry?.getAttribute("data-row-index") || 0);
        const row = ensureLinkRow(sec.payload.rows[rowIdx] || {});
        row.mode = "multi";
        if (!row.actions) row.actions = [];
        row.actions.push({ buttonText: "", url: "" });
        sec.payload.rows[rowIdx] = row;
      } else if (addKind === "table-row") {
        syncSectionsFromDom();
        const blockIdx = Number(btn.getAttribute("data-block-index") || 0);
        ensureTableBlocks(sec);
        const block = sec.payload.blocks[blockIdx];
        if (block?.type === "table") block.grid.push(new Array(block.grid[0].length).fill(""));
      } else if (addKind === "table-col") {
        syncSectionsFromDom();
        const blockIdx = Number(btn.getAttribute("data-block-index") || 0);
        ensureTableBlocks(sec);
        const block = sec.payload.blocks[blockIdx];
        if (block?.type === "table") {
          for (const row of block.grid) row.push("");
        }
      } else if (addKind === "table-block-text") {
        ensureTableBlocks(sec);
        sec.payload.blocks.push({ type: "text", text: "" });
      } else if (addKind === "table-block-table") {
        ensureTableBlocks(sec);
        sec.payload.blocks.push({ type: "table", grid: M().defaultTableGrid() });
      } else if (addKind === "faq") sec.payload.pairs.push({ q: "", a: "" });
      else if (addKind === "list") sec.payload.items.push({ text: "", ordered: false });
      else if (addKind === "pl-paragraph") sec.payload.paragraphs.push("");
      renderSectionCard(sec);
      scheduleCompile();
      return;
    }

    if (btn.classList.contains("sec-row-btn--add")) {
      const row = btn.closest(".sec-row, .sec-faq-pair, .sec-para-block");
      const blockNode = row?.closest(".sec-dates-block") || btn.closest(".sec-dates-block");
      const card = btn.closest(".sec-card");
      if ((!row && !blockNode) || !card) return;
      syncSectionsFromDom();
      const secId2 = card.getAttribute("data-section-id");
      const idx = findSectionIndex(secId2);
      if (idx < 0) return;
      const sec = sections[idx];

      if (sec.contentType === M().CONTENT_TYPES.DATES && blockNode) {
        ensureDatesBlocks(sec);
        const blockIdx = Number(blockNode.getAttribute("data-block-index") || 0);
        const blockType = blockNode.getAttribute("data-block-type") || "date";
        if (blockType === "paragraph") {
          sec.payload.blocks.splice(blockIdx + 1, 0, { type: "paragraph", text: "" });
        } else if (blockType === "list") {
          sec.payload.blocks.splice(blockIdx + 1, 0, { type: "list", text: "", ordered: false });
        } else {
          sec.payload.blocks.splice(blockIdx + 1, 0, { type: "date", label: "", value: "" });
        }
        renderSectionCard(sec);
        scheduleCompile();
        return;
      }

      if (sec.contentType === M().CONTENT_TYPES.LINKS) {
        const entry = row?.closest(".sec-link-entry") || btn.closest(".sec-link-entry");
        if (!entry) return;
        const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
        const linkRow = ensureLinkRow(sec.payload.rows[rowIdx] || {});

        if (btn.classList.contains("sec-row-btn--link-action")) {
          const actionNode = btn.closest(".sec-link-action");
          const actionIdx = Number(actionNode?.getAttribute("data-action-index") || 0);
          if (btn.classList.contains("sec-row-btn--add")) {
            linkRow.actions.splice(actionIdx + 1, 0, { buttonText: "", url: "" });
          } else if (linkRow.actions.length > 1) {
            linkRow.actions.splice(actionIdx, 1);
          }
          sec.payload.rows[rowIdx] = linkRow;
          renderSectionCard(sec);
          scheduleCompile();
          return;
        }

        if (btn.classList.contains("sec-row-btn--link-entry")) {
          if (btn.classList.contains("sec-row-btn--add")) {
            sec.payload.rows.splice(rowIdx + 1, 0, ensureLinkRow({}));
          } else if (sec.payload.rows.length > 1) {
            sec.payload.rows.splice(rowIdx, 1);
          }
          renderSectionCard(sec);
          scheduleCompile();
          return;
        }
      }

      const rowIdx = Number(
        row?.getAttribute("data-row-index") ?? row?.getAttribute("data-para-index") ?? 0
      );

      if (sec.contentType === M().CONTENT_TYPES.LINKS) {
        return;
      }

      if (sec.contentType === M().CONTENT_TYPES.FAQ) {
        sec.payload.pairs.splice(rowIdx + 1, 0, { q: "", a: "" });
      } else if (sec.contentType === M().CONTENT_TYPES.LIST) {
        sec.payload.items.splice(rowIdx + 1, 0, { text: "", ordered: false });
      } else if (sec.contentType === M().CONTENT_TYPES.PARAGRAPH_LIST && row) {
        if (row.classList.contains("sec-para-block")) sec.payload.paragraphs.splice(rowIdx + 1, 0, "");
        else sec.payload.items.splice(rowIdx + 1, 0, { text: "", ordered: false });
      }
      renderSectionCard(sec);
      scheduleCompile();
      return;
    }

    if (btn.classList.contains("sec-row-btn--remove")) {
      const row = btn.closest(".sec-row, .sec-faq-pair, .sec-para-block");
      const blockNode = btn.closest(".sec-dates-block");
      const card = btn.closest(".sec-card");
      if ((!row && !blockNode && !btn.closest(".sec-link-entry")) || !card) return;
      syncSectionsFromDom();
      const secId2 = card.getAttribute("data-section-id");
      const idx = findSectionIndex(secId2);
      if (idx < 0) return;
      const sec = sections[idx];

      if (sec.contentType === M().CONTENT_TYPES.DATES && blockNode) {
        ensureDatesBlocks(sec);
        if (sec.payload.blocks.length > 1) {
          const blockIdx = Number(blockNode.getAttribute("data-block-index") || 0);
          sec.payload.blocks.splice(blockIdx, 1);
        }
        renderSectionCard(sec);
        scheduleCompile();
        return;
      }

      if (sec.contentType === M().CONTENT_TYPES.LINKS) {
        const entry = btn.closest(".sec-link-entry");
        const actionNode = btn.closest(".sec-link-action");
        if (actionNode && entry) {
          const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
          const actionIdx = Number(actionNode.getAttribute("data-action-index") || 0);
          const linkRow = ensureLinkRow(sec.payload.rows[rowIdx] || {});
          if (linkRow.actions.length > 1) linkRow.actions.splice(actionIdx, 1);
          sec.payload.rows[rowIdx] = linkRow;
          renderSectionCard(sec);
          scheduleCompile();
          return;
        }
        if (entry && btn.classList.contains("sec-row-btn--link-entry")) {
          const rowIdx = Number(entry.getAttribute("data-row-index") || 0);
          if (sec.payload.rows.length > 1) sec.payload.rows.splice(rowIdx, 1);
          renderSectionCard(sec);
          scheduleCompile();
          return;
        }
      }

      if (!row) return;

      const rowIdx = Number(row.getAttribute("data-row-index") ?? row.getAttribute("data-para-index") ?? 0);

      if (sec.contentType === M().CONTENT_TYPES.FAQ && sec.payload.pairs.length > 1) {
        sec.payload.pairs.splice(rowIdx, 1);
      } else if (sec.contentType === M().CONTENT_TYPES.LIST && sec.payload.items.length > 1) {
        sec.payload.items.splice(rowIdx, 1);
      } else if (sec.contentType === M().CONTENT_TYPES.PARAGRAPH_LIST) {
        if (row.classList.contains("sec-para-block") && sec.payload.paragraphs.length > 1) {
          sec.payload.paragraphs.splice(rowIdx, 1);
        } else if (sec.payload.items.length > 1) {
          sec.payload.items.splice(rowIdx, 1);
        }
      }
      renderSectionCard(sec);
      scheduleCompile();
    }
  }

  function parsePastedTableMatrix(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!raw) return null;
    const lines = raw.split("\n").filter((l) => String(l).trim());
    if (lines.length < 1) return null;
    const hasTabs = lines.some((l) => l.includes("\t"));
    const matrix = lines.map((line) => {
      if (hasTabs) return line.split("\t").map((c) => c.trim());
      return line.split(",").map((c) => c.trim());
    });
    const maxCols = Math.max(...matrix.map((r) => r.length), 1);
    if (maxCols < 2 && matrix.length < 2) return null;
    return matrix.map((row) => {
      const next = row.slice();
      while (next.length < maxCols) next.push("");
      return next.slice(0, maxCols);
    });
  }

  function applyPasteToTableCell(target, clipboardText) {
    const cellEl = target.closest(".sec-table-cell");
    const card = target.closest(".sec-card");
    if (!cellEl || !card) return false;
    const matrix = parsePastedTableMatrix(clipboardText);
    if (!matrix || (matrix.length === 1 && matrix[0].length === 1)) return false;

    syncSectionsFromDom();
    const secId = card.getAttribute("data-section-id");
    const idx = findSectionIndex(secId);
    if (idx < 0) return false;
    const sec = sections[idx];
    ensureTableBlocks(sec);

    const startRow = Number(
      target.getAttribute("data-row-index") ?? cellEl.getAttribute("data-row-index") ?? 0
    );
    const startCol = Number(
      target.getAttribute("data-col-index") ?? cellEl.getAttribute("data-col-index") ?? 0
    );
    const blockIdx = Number(target.getAttribute("data-block-index") || 0);
    const block = sec.payload.blocks[blockIdx];
    if (!block || block.type !== "table") return false;

    const grid = M().normalizeTableGrid(block.grid);
    const needRows = startRow + matrix.length;
    const needCols = startCol + matrix[0].length;
    while (grid.length < needRows) grid.push(new Array(grid[0].length).fill(""));
    while (grid[0].length < needCols) {
      for (const row of grid) row.push("");
    }
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        grid[startRow + r][startCol + c] = matrix[r][c];
      }
    }
    block.grid = M().normalizeTableGrid(grid);
    renderSectionCard(sec);
    scheduleCompile();
    showEditorNotice(`Pasted ${matrix.length}×${matrix[0].length} table cells`, "info");
    return true;
  }

  function handleRootPaste(ev) {
    const target = ev.target;
    if (!target?.closest?.("#sectionEditorRoot")) return;
    if (!target.matches(".sec-table-cell-input, [data-field='table-cell'], [data-field='table-cell-text']")) {
      return;
    }
    const text = ev.clipboardData?.getData("text/plain") || "";
    if (!text || (!text.includes("\t") && !text.includes("\n") && !text.includes(","))) return;
    if (applyPasteToTableCell(target, text)) {
      ev.preventDefault();
    }
  }

  function isEditingExistingPage() {
    const params = new URLSearchParams(window.location.search);
    const slugParam = String(params.get("slug") || "").trim();
    const oldSlug = String(el("oldSlug")?.value || "").trim();
    const pageId = String(el("pageId")?.value || "").trim();
    return Boolean(slugParam || oldSlug || pageId);
  }

  function preferVisualIfSafe() {
    const ta = getTextarea();
    if (!ta) return false;
    const text = M().normalizeEditorText(ta.value || "");
    if (text !== ta.value) ta.value = text;
    if (!text.trim()) return false;
    loadSectionsFromText(text, { silent: true, allowEmpty: true });
    return setMode("visual", { force: true, silent: true, skipCompile: true });
  }

  function syncFromTextarea() {
    if (mode !== "visual" || syncing) return;
    const ta = getTextarea();
    if (!ta) return;
    const text = M().normalizeEditorText(ta.value || "");
    if (text !== ta.value) ta.value = text;
    loadSectionsFromText(text, { silent: false, allowEmpty: true });
    renderAllSections();
  }

  function runRepairFromTextarea() {
    const ta = getTextarea();
    if (!ta || !M().repairEditorText) return;
    const result = M().repairEditorText(ta.value || "");
    ta.value = result.text;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    if (mode === "visual") {
      loadSectionsFromText(result.text, { silent: false, allowEmpty: true });
      renderAllSections();
    }
    const changeList = result.changes?.length ? result.changes.join("; ") : "No changes needed";
    showEditorNotice(`Repair done: ${changeList}`, result.changes?.length ? "info" : "warn");
  }

  function init() {
    if (!window.SectionEditorModel || !el("sectionEditorRoot")) return;

    try {
      const saved = localStorage.getItem(STORAGE_MODE_KEY);
      if (saved === "raw" || saved === "visual") mode = saved;
    } catch {
      /* ignore */
    }

    const ta = getTextarea();
    if (ta) {
      ta.addEventListener("input", () => {
        if (mode === "visual" && !syncing) syncFromTextarea();
      });
    }

    el("editorModeVisual")?.addEventListener("click", () => setMode("visual"));
    el("editorModeRaw")?.addEventListener("click", () => setMode("raw"));
    el("sectionEditorAddBtn")?.addEventListener("click", addSection);
    el("sectionEditorRepairBtn")?.addEventListener("click", runRepairFromTextarea);
    initRichLinkModal();
    initAddSectionModal();

    const root = el("sectionEditorRoot");
    root?.addEventListener("input", handleRootInput);
    root?.addEventListener("change", handleRootChange);
    root?.addEventListener("click", handleRootClick);
    root?.addEventListener("paste", handleRootPaste);
    root?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const bar = ev.target.closest(".sec-card__collapsed-bar[data-action='toggle']");
      if (!bar) return;
      ev.preventDefault();
      const secId = bar.getAttribute("data-sec-id");
      if (secId) toggleSectionCollapsed(secId);
    });

    const initialText = M().normalizeEditorText(ta?.value || "");
    if (ta && initialText !== (ta.value || "")) ta.value = initialText;
    if (isEditingExistingPage() || mode === "visual") {
      if (initialText.trim()) {
        loadSectionsFromText(initialText, { silent: true, allowEmpty: true });
      } else if (!sections.length) {
        sections = [
          M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH),
          M().createEmptySection("Important Dates", M().CONTENT_TYPES.DATES),
          M().createEmptySection("Important Links", M().CONTENT_TYPES.LINKS)
        ];
      }
      mode = "visual";
    }

    setMode(mode, { force: true, silent: true, skipCompile: true });
  }

  function flushToTextarea() {
    if (mode !== "visual") return;
    syncSectionsFromDom();
    pushSectionsToTextarea({ silent: true });
  }

  window.sectionEditor = {
    init,
    syncFromTextarea,
    flushToTextarea,
    preferVisualIfSafe,
    runRepairFromTextarea,
    getMode,
    setMode,
    addSection,
    SECTION_PRESETS
  };
})();
