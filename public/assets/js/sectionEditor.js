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

  function el(id) {
    return document.getElementById(id);
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

  function setMode(next, options = {}) {
    const m = next === "raw" ? "raw" : "visual";
    const ta = getTextarea();
    const wrap = el("sectionEditorWrap");
    const visualBtn = el("editorModeVisual");
    const rawBtn = el("editorModeRaw");

    if (m === "visual" && ta && !options.force) {
      const text = ta.value || "";
      if (text.trim() && !M().isVisualEditorSafeForText(text)) {
        if (!options.silent) {
          showEditorNotice(
            "This content uses advanced formatting. Stay on Raw text, or simplify sections first.",
            "warn"
          );
        }
        return false;
      }
      sections = M().parseTextToEditorSections(text);
      if (!sections.length) {
        sections = [
          M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH),
          M().createEmptySection("Important Dates", M().CONTENT_TYPES.DATES),
          M().createEmptySection("Important Links", M().CONTENT_TYPES.LINKS)
        ];
      }
    }

    if (m === "raw" && mode === "visual") {
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
    const compiled = M().compileEditorSectionsToText(sections);
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

  function addSection() {
    sections.push(M().createEmptySection("New Section", M().CONTENT_TYPES.PARAGRAPH));
    renderAllSections();
    scheduleCompile();
    const root = el("sectionEditorRoot");
    if (root) root.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    const labels = M().CONTENT_TYPE_LABELS;
    return Object.keys(labels)
      .map((key) => {
        const sel = key === selected ? " selected" : "";
        return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(labels[key])}</option>`;
      })
      .join("");
  }

  function renderRowActions(extraClass) {
    const extra = extraClass ? ` ${extraClass}` : "";
    return `<button type="button" class="sec-row-btn sec-row-btn--add${extra}" title="Add row">+</button>
      <button type="button" class="sec-row-btn sec-row-btn--remove${extra}" title="Remove row">−</button>`;
  }

  function renderParagraphBody(sec) {
    const text = escapeHtml(sec.payload?.text || "");
    return `<label class="sec-field-label">Paragraph text</label>
      <textarea class="sec-textarea" data-sec-id="${sec.id}" data-field="paragraph-text" rows="4" placeholder="Plain paragraph — no colon or Q: needed">${text}</textarea>`;
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

  function renderDatesBlock(block, index) {
    if (block.type === "paragraph") {
      return `
      <div class="sec-dates-block sec-dates-block--para" data-block-index="${index}" data-block-type="paragraph">
        <label class="sec-field-label">Paragraph</label>
        <textarea class="sec-textarea sec-textarea--compact" data-field="dates-para" rows="2" placeholder="Note or extra text (no colon needed)">${escapeHtml(block.text)}</textarea>
        <div class="sec-row-actions sec-row-actions--block">${renderRowActions()}</div>
      </div>`;
    }
    if (block.type === "list") {
      return `
      <div class="sec-dates-block sec-dates-block--list" data-block-index="${index}" data-block-type="list">
        <div class="sec-row">
          <input type="text" class="sec-input" data-field="dates-list-text" placeholder="List item" value="${escapeHtml(block.text)}">
          <label class="sec-check"><input type="checkbox" data-field="dates-list-ordered" ${block.ordered ? "checked" : ""}> Numbered</label>
          <div class="sec-row-actions">${renderRowActions()}</div>
        </div>
      </div>`;
    }
    return `
      <div class="sec-dates-block sec-dates-block--date" data-block-index="${index}" data-block-type="date">
        <div class="sec-row">
          <input type="text" class="sec-input" data-field="date-label" placeholder="Label" value="${escapeHtml(block.label)}">
          <input type="text" class="sec-input" data-field="date-value" placeholder="Value" value="${escapeHtml(block.value)}">
          <div class="sec-row-actions">${renderRowActions()}</div>
        </div>
      </div>`;
  }

  function renderDatesBody(sec) {
    const blocks = ensureDatesBlocks(sec);
    const blocksHtml = blocks.map((block, i) => renderDatesBlock(block, i)).join("");
    return `
      <div class="sec-dates-blocks" data-sec-id="${sec.id}" data-rows-kind="dates-blocks">${blocksHtml}</div>
      <div class="sec-dates-add-actions">
        <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="dates">+ Add date</button>
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
    return `
      <div class="sec-link-action" data-link-index="${linkIndex}" data-action-index="${actionIndex}">
        <input type="text" class="sec-input" data-field="link-action-text" placeholder="Hindi / English" value="${escapeHtml(action.buttonText)}">
        <input type="url" class="sec-input sec-input--url" data-field="link-action-url" placeholder="https://..." value="${escapeHtml(action.url)}">
        <div class="sec-row-actions">${renderRowActions("sec-row-btn--link-action")}</div>
      </div>`;
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

    return `
      <div class="sec-link-entry" data-row-index="${index}">
        <label class="sec-field-label">Link label (left text)</label>
        <input type="text" class="sec-input sec-input--title" data-field="link-label" placeholder="Download PDF" value="${escapeHtml(link.label)}">
        <label class="sec-check sec-check--block">
          <input type="checkbox" data-field="link-multi" ${isMulti ? "checked" : ""}>
          Hindi / English — multiple clickable buttons
        </label>
        <div class="sec-link-single${isMulti ? " is-hidden" : ""}">
          <label class="sec-field-label">Button text <span class="sec-field-label-muted">(blank = Click Here)</span></label>
          <input type="text" class="sec-input" data-field="link-button-text" placeholder="Click Here" value="${escapeHtml(link.buttonText)}">
          <label class="sec-field-label">URL</label>
          <input type="url" class="sec-input sec-input--url" data-field="link-url" placeholder="https://..." value="${escapeHtml(link.url)}">
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
        <textarea class="sec-textarea sec-textarea--compact" data-field="faq-a" rows="2" placeholder="The answer will be published soon.">${escapeHtml(pair.a)}</textarea>
        <div class="sec-row-actions sec-row-actions--block">${renderRowActions()}</div>
      </div>`
      )
      .join("");
    return `<div class="sec-rows" data-sec-id="${sec.id}" data-rows-kind="faq">${rowsHtml}</div>
      <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="faq">+ Add Q&amp;A</button>`;
  }

  function renderListBody(sec) {
    const items = sec.payload?.items?.length ? sec.payload.items : [{ text: "", ordered: false }];
    const rowsHtml = items
      .map(
        (item, i) => `
      <div class="sec-row" data-row-index="${i}">
        <input type="text" class="sec-input" data-field="list-text" placeholder="List item" value="${escapeHtml(item.text)}">
        <label class="sec-check"><input type="checkbox" data-field="list-ordered" ${item.ordered ? "checked" : ""}> Numbered</label>
        <div class="sec-row-actions">${renderRowActions()}</div>
      </div>`
      )
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
      .map(
        (item, i) => `
      <div class="sec-row" data-row-index="${i}">
        <input type="text" class="sec-input" data-field="list-text" placeholder="List item" value="${escapeHtml(item.text)}">
        <div class="sec-row-actions">${renderRowActions()}</div>
      </div>`
      )
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
    return `
          <td class="sec-table-cell sec-table-cell--body" data-row-index="${rowIndex}" data-col-index="${colIdx}">
            <label class="sec-table-cell-link-toggle">
              <input type="checkbox" data-field="table-cell-link" ${isLink ? "checked" : ""}>
              Link
            </label>
            <div class="sec-table-cell-text-wrap${isLink ? " is-hidden" : ""}">
              <input type="text" class="sec-input sec-table-cell-input" data-field="table-cell-text" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" value="${escapeHtml(parsed.text)}" placeholder="Text, -, =, *">
            </div>
            <div class="sec-table-cell-link-wrap${isLink ? "" : " is-hidden"}">
              <input type="text" class="sec-input sec-table-cell-input" data-field="table-cell-link-label" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" value="${escapeHtml(parsed.label)}" placeholder="Button text">
              <input type="url" class="sec-input sec-table-cell-input sec-input--url" data-field="table-cell-link-url" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-col-index="${colIdx}" value="${escapeHtml(parsed.url)}" placeholder="https://...">
            </div>
          </td>`;
  }

  function renderTableGridEditor(grid, blockIndex, secId) {
    const colCount = grid[0]?.length || 1;
    const headerCells = grid[0]
      .map(
        (cell, colIdx) => `
        <th class="sec-table-cell sec-table-cell--head" data-row-index="0" data-col-index="${colIdx}">
          <input type="text" class="sec-input sec-table-cell-input" data-field="table-cell" data-block-index="${blockIndex}" data-row-index="0" data-col-index="${colIdx}" value="${escapeHtml(cell)}" placeholder="Header ${colIdx + 1}">
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
        <textarea class="sec-textarea" data-field="table-block-text" data-block-index="${blockIndex}" rows="3" placeholder="Heading or paragraph before/after table">${escapeHtml(block.text || "")}</textarea>
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
        <p class="sec-field-hint">Row 1 = header. Body cell: tick <strong>Link</strong> for clickable button. Merge: <code>-</code> above, <code>=</code> left, <code>*</code> empty.</p>
        ${renderTableGridEditor(grid, blockIndex, secId)}
      </div>`;
  }

  function renderTableBody(sec) {
    const blocks = ensureTableBlocks(sec);
    const blocksHtml = blocks.map((block, i) => renderTableBlock(block, i, blocks.length, sec.id)).join("");
    return `
      <div class="sec-table-editor" data-sec-id="${sec.id}">
        <p class="sec-table-hint">Pehle text/heading, phir table, phir text — kisi bhi order mein. Table cell mein <strong>Link</strong> tick karke button banao.</p>
        <div class="sec-table-blocks">${blocksHtml}</div>
        <div class="sec-table-block-actions">
          <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="table-block-text">+ Add text / heading</button>
          <button type="button" class="sec-add-row-btn" data-sec-id="${sec.id}" data-add-kind="table-block-table">+ Add table</button>
        </div>
      </div>`;
  }

  function renderRawBody(sec, label) {
    const raw = escapeHtml(sec.payload?.raw ?? "");
    return `<label class="sec-field-label">${escapeHtml(label)}</label>
      <textarea class="sec-textarea sec-textarea--mono" data-sec-id="${sec.id}" data-field="raw-text" rows="6" placeholder="One line per row. Table: comma-separated columns.">${raw}</textarea>`;
  }

  function renderSectionBody(sec) {
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
      case M().CONTENT_TYPES.MIXED:
        return renderRawBody(sec, "Free text (advanced). Switch to Raw text for full control.");
      default:
        return renderParagraphBody(sec);
    }
  }

  function sectionTypeLabel(contentType) {
    const labels = M().CONTENT_TYPE_LABELS || {};
    return labels[contentType] || contentType || "Section";
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
    const html = `
      <article class="sec-card${collapsed ? " is-collapsed" : ""}" data-section-id="${sec.id}">
        <header class="sec-card__head" data-sec-id="${sec.id}">
          <button type="button" class="sec-toggle-btn" data-action="toggle" data-sec-id="${sec.id}" aria-expanded="${collapsed ? "false" : "true"}" title="${collapsed ? "Open section" : "Close section"}">${collapsed ? "▶" : "▼"}</button>
          <div class="sec-card__head-main">
            <div class="sec-card__collapsed-bar" data-action="toggle" data-sec-id="${sec.id}" role="button" tabindex="0" aria-label="Open section ${escapeHtml(displayName)}">
              <span class="sec-card__collapsed-name">${escapeHtml(displayName)}</span>
              <span class="sec-card__collapsed-type">${escapeHtml(typeLabel)}</span>
            </div>
            <div class="sec-card__expandable">
              <div class="sec-card__title-row">
                <label class="sec-field-label">Section name</label>
                <input type="text" class="sec-input sec-input--title" data-sec-id="${sec.id}" data-field="section-name" value="${escapeHtml(sec.name)}" placeholder="e.g. Document Required">
              </div>
              <div class="sec-card__meta-row">
                <label class="sec-field-label">Content type</label>
                <select class="sec-select" data-sec-id="${sec.id}" data-field="content-type">${contentTypeOptions(sec.contentType)}</select>
              </div>
            </div>
          </div>
          <div class="sec-card__tools">
            <button type="button" class="sec-tool-btn" data-action="up" data-sec-id="${sec.id}" title="Move up">↑</button>
            <button type="button" class="sec-tool-btn" data-action="down" data-sec-id="${sec.id}" title="Move down">↓</button>
            <button type="button" class="sec-tool-btn sec-tool-btn--danger" data-action="remove" data-sec-id="${sec.id}" title="Remove section">✕</button>
          </div>
        </header>
        <div class="sec-card__body">${renderSectionBody(sec)}</div>
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
    if (action === "remove" && secId) {
      syncSectionsFromDom();
      removeSection(secId);
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

  function syncFromTextarea() {
    if (mode !== "visual" || syncing) return;
    const ta = getTextarea();
    if (!ta) return;
    const text = ta.value || "";
    if (text.trim() && !M().isVisualEditorSafeForText(text)) {
      setMode("raw", { force: true, silent: true });
      showEditorNotice("Switched to Raw text — content has advanced formatting.", "warn");
      return;
    }
    sections = M().parseTextToEditorSections(text);
    if (!sections.length && mode === "visual") {
      sections = [M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH)];
    }
    renderAllSections();
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

    const root = el("sectionEditorRoot");
    root?.addEventListener("input", handleRootInput);
    root?.addEventListener("change", handleRootChange);
    root?.addEventListener("click", handleRootClick);
    root?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const bar = ev.target.closest(".sec-card__collapsed-bar[data-action='toggle']");
      if (!bar) return;
      ev.preventDefault();
      const secId = bar.getAttribute("data-sec-id");
      if (secId) toggleSectionCollapsed(secId);
    });

    const initialText = ta?.value || "";
    if (initialText.trim() && !M().isVisualEditorSafeForText(initialText)) {
      mode = "raw";
    } else if (mode === "visual") {
      sections = M().parseTextToEditorSections(initialText);
      if (!sections.length) {
        sections = [
          M().createEmptySection("Short Information", M().CONTENT_TYPES.PARAGRAPH),
          M().createEmptySection("Important Dates", M().CONTENT_TYPES.DATES),
          M().createEmptySection("Important Links", M().CONTENT_TYPES.LINKS)
        ];
      }
    }

    setMode(mode, { force: true, silent: true });
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
    getMode,
    setMode,
    addSection
  };
})();
