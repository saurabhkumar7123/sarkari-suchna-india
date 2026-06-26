/**
 * Browser mirror of server/utils/sectionEditorModel.js — keep in sync.
 */
(function (global) {
  "use strict";

  const CONTENT_TYPES = Object.freeze({
    PARAGRAPH: "paragraph",
    DATES: "dates",
    LINKS: "links",
    FAQ: "faq",
    LIST: "list",
    PARAGRAPH_LIST: "paragraph_list",
    TABLE: "table",
    MIXED: "mixed"
  });

  const SECTION_HEADER_RE = /\[\s*section\s*:\s*(.*?)\]([\s\S]*?)(?=\n\[\s*section\s*:|$)/gi;

  function isUrlLike(value) {
    return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
  }

  function normalizeEditorText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function parseSectionsFromText(text) {
    const src = String(text || "");
    const sections = [];
    let match;
    const re = new RegExp(SECTION_HEADER_RE.source, SECTION_HEADER_RE.flags);
    while ((match = re.exec(src)) !== null) {
      const rawHeaderTitle = String(match[1] || "").trim();
      const forceTable = /\|\s*table\s*$/i.test(rawHeaderTitle);
      const cleanHeaderTitle = rawHeaderTitle.replace(/\|\s*table\s*$/i, "").trim();
      const content = String(match[2] || "").trim();
      sections.push({ rawHeaderTitle, cleanHeaderTitle, forceTable, content });
    }
    return sections;
  }

  function lineType(line) {
    const raw = String(line || "").trim();
    if (!raw) return "empty";
    if (raw.startsWith("Q:")) return "faq_q";
    if (raw.startsWith("A:")) return "faq_a";
    const eqIdx = raw.indexOf("=");
    if (eqIdx > 0 && isUrlLike(raw.slice(eqIdx + 1).trim())) return "link";
    if (/^-\s+/.test(raw)) return "list";
    if (/^\d+[.)]\s+/.test(raw)) return "list_ordered";
    if (raw.includes(":") && !raw.startsWith("http")) {
      const parts = raw.split(":");
      const label = parts[0].trim();
      const value = parts.slice(1).join(":").trim();
      if (label && value && !isUrlLike(value)) return "date";
    }
    if (raw.includes(",") && raw.split(",").length >= 3) return "table_row";
    return "paragraph";
  }

  function detectContentType(lines, forceTable, content) {
    if (forceTable) return CONTENT_TYPES.TABLE;
    if (contentHasTableMarkers(content)) return CONTENT_TYPES.TABLE;
    const types = lines.map(lineType).filter((t) => t !== "empty");
    if (!types.length) return CONTENT_TYPES.PARAGRAPH;

    const unique = new Set(types);
    if (unique.size === 1) {
      const only = types[0];
      if (only === "link") return CONTENT_TYPES.LINKS;
      if (only === "date") return CONTENT_TYPES.DATES;
      if (only === "faq_q" || only === "faq_a") return CONTENT_TYPES.FAQ;
      if (only === "list" || only === "list_ordered") return CONTENT_TYPES.LIST;
      if (only === "table_row") return CONTENT_TYPES.TABLE;
      if (only === "paragraph") return CONTENT_TYPES.PARAGRAPH;
    }

    const hasList = types.some((t) => t === "list" || t === "list_ordered");
    const hasPara = types.some((t) => t === "paragraph");
    const hasFaq = types.some((t) => t === "faq_q" || t === "faq_a");
    const hasLink = types.some((t) => t === "link");
    const hasDate = types.some((t) => t === "date");
    const hasTable = types.some((t) => t === "table_row");

    if (hasFaq && !hasLink && !hasDate && !hasTable) return CONTENT_TYPES.FAQ;
    if (hasLink && !hasDate && !hasFaq && !hasTable) return CONTENT_TYPES.LINKS;
    if (hasDate && !hasLink && !hasFaq && !hasTable) return CONTENT_TYPES.DATES;
    if (hasList && hasPara && !hasLink && !hasDate && !hasFaq) return CONTENT_TYPES.PARAGRAPH_LIST;
    if (hasTable && !hasLink && !hasDate && !hasFaq) return CONTENT_TYPES.TABLE;

    return CONTENT_TYPES.MIXED;
  }

  function parsePipeLinkLine(rawLine) {
    const raw = String(rawLine ?? "").trim();
    if (!raw.includes("|")) return null;

    const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    const displayLabel = parts[0];
    const actions = [];

    for (let i = 1; i < parts.length; i += 1) {
      const segment = parts[i];
      const eqIdx = segment.indexOf("=");
      if (eqIdx <= 0) return null;

      const buttonText = segment.slice(0, eqIdx).trim();
      const href = segment.slice(eqIdx + 1).trim();
      if (!buttonText || !isUrlLike(href)) return null;

      actions.push({ buttonText, url: href });
    }

    if (!displayLabel || !actions.length) return null;
    return { displayLabel, actions };
  }

  function defaultLinkRow() {
    return { mode: "single", label: "", buttonText: "", url: "", actions: [] };
  }

  function parseLinkRow(line) {
    const raw = String(line || "").trim();
    if (!raw) return defaultLinkRow();

    const piped = parsePipeLinkLine(raw);
    if (piped) {
      if (piped.actions.length >= 2) {
        return {
          mode: "multi",
          label: piped.displayLabel,
          buttonText: "",
          url: "",
          actions: piped.actions.map((a) => ({
            buttonText: a.buttonText,
            url: a.url
          }))
        };
      }
      if (piped.actions.length === 1) {
        return {
          mode: "single",
          label: piped.displayLabel,
          buttonText: piped.actions[0].buttonText,
          url: piped.actions[0].url,
          actions: []
        };
      }
    }

    const eqIdx = raw.indexOf("=");
    if (eqIdx <= 0) return { mode: "single", label: raw, buttonText: "", url: "", actions: [] };

    const left = raw.slice(0, eqIdx).trim();
    const url = raw.slice(eqIdx + 1).trim();
    const pipeIdx = left.indexOf("|");
    if (pipeIdx > -1) {
      return {
        mode: "single",
        label: left.slice(0, pipeIdx).trim(),
        buttonText: left.slice(pipeIdx + 1).trim(),
        url,
        actions: []
      };
    }

    return { mode: "single", label: left, buttonText: "", url, actions: [] };
  }

  function compileLinkRow(row) {
    const mode = row?.mode === "multi" ? "multi" : "single";
    if (mode === "multi") {
      const label = String(row.label || "").trim();
      const segments = (row.actions || [])
        .filter((a) => String(a?.buttonText || "").trim() && String(a?.url || "").trim())
        .map((a) => `${String(a.buttonText).trim()}=${String(a.url).trim()}`);
      if (!label || !segments.length) return "";
      return `${label}|${segments.join("|")}`;
    }

    const label = String(row?.label || "").trim();
    const url = String(row?.url || "").trim();
    const btn = String(row?.buttonText || "").trim();
    if (!label && !url) return "";
    if (btn) return `${label}|${btn}=${url}`;
    return `${label}=${url}`;
  }

  function parseDateLine(line) {
    const raw = String(line || "").trim();
    const idx = raw.indexOf(":");
    if (idx <= 0) return { label: raw, value: "" };
    return { label: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
  }

  function parseFaqLines(lines) {
    const pairs = [];
    let current = { q: "", a: "" };
    for (const line of lines) {
      const raw = String(line || "").trim();
      if (raw.startsWith("Q:")) {
        if (current.q || current.a) pairs.push({ ...current });
        current = { q: raw.replace(/^Q:\s*/i, "").trim(), a: "" };
        continue;
      }
      if (raw.startsWith("A:")) {
        current.a = raw.replace(/^A:\s*/i, "").trim();
        pairs.push({ ...current });
        current = { q: "", a: "" };
        continue;
      }
      if (current.q && !current.a) current.a = raw;
      else if (!current.q) current.q = raw;
      else pairs.push({ q: current.q, a: current.a }, { q: raw, a: "" }), (current = { q: "", a: "" });
    }
    if (current.q || current.a) pairs.push(current);
    return pairs.length ? pairs : [{ q: "", a: "" }];
  }

  function parseListLines(lines) {
    return lines
      .map((line) => {
        const raw = String(line || "").trim();
        if (!raw) return null;
        const ordered = /^\d+[.)]\s+/.test(raw);
        const text = ordered ? raw.replace(/^\d+[.)]\s+/, "").trim() : raw.replace(/^-\s+/, "").trim();
        return { text, ordered };
      })
      .filter(Boolean);
  }

  function parseParagraphList(lines) {
    const paragraphs = [];
    const items = [];
    for (const line of lines) {
      const raw = String(line || "").trim();
      if (!raw) continue;
      const t = lineType(raw);
      if (t === "list" || t === "list_ordered") {
        items.push(parseListLines([raw])[0]);
      } else {
        paragraphs.push(raw);
      }
    }
    return {
      paragraphs: paragraphs.length ? paragraphs : [""],
      items: items.length ? items : [{ text: "", ordered: false }]
    };
  }

  function parseDatesSection(lines) {
    const blocks = [];
    for (const line of lines) {
      const raw = String(line || "").trim();
      if (!raw) continue;
      const t = lineType(raw);
      if (t === "date") {
        const { label, value } = parseDateLine(raw);
        blocks.push({ type: "date", label, value });
      } else if (t === "list" || t === "list_ordered") {
        const item = parseListLines([raw])[0];
        blocks.push({ type: "list", text: item.text, ordered: item.ordered });
      } else {
        blocks.push({ type: "paragraph", text: raw });
      }
    }
    return {
      blocks: blocks.length ? blocks : [{ type: "date", label: "", value: "" }]
    };
  }

  function migrateLegacyDatesPayload(payload) {
    if (payload?.blocks?.length) return payload;
    const blocks = [];
    for (const row of payload?.rows || []) {
      blocks.push({
        type: "date",
        label: String(row?.label || "").trim(),
        value: String(row?.value || "").trim()
      });
    }
    for (const p of payload?.paragraphs || []) {
      const t = String(p || "").trim();
      if (t) blocks.push({ type: "paragraph", text: t });
    }
    for (const item of payload?.items || []) {
      const text = String(item?.text || "").trim();
      if (text) blocks.push({ type: "list", text, ordered: Boolean(item?.ordered) });
    }
    return { blocks: blocks.length ? blocks : [{ type: "date", label: "", value: "" }] };
  }

  function compileDatesSection(payload) {
    const { blocks } = migrateLegacyDatesPayload(payload || {});
    const lines = [];
    let orderedListIndex = 0;

    for (const b of blocks) {
      if (b.type === "date") {
        orderedListIndex = 0;
        const label = String(b.label || "").trim();
        const value = String(b.value || "").trim();
        if (label || value) lines.push(`${label} : ${value}`);
        continue;
      }
      if (b.type === "paragraph") {
        orderedListIndex = 0;
        const t = String(b.text || "").trim();
        if (t) lines.push(t);
        continue;
      }
      if (b.type === "list") {
        const text = String(b.text || "").trim();
        if (!text) continue;
        if (b.ordered) {
          orderedListIndex += 1;
          lines.push(`${orderedListIndex}. ${text}`);
        } else {
          orderedListIndex = 0;
          lines.push(`- ${text}`);
        }
      }
    }
    return lines.join("\n");
  }

  function splitTableRow(line) {
    return String(line || "")
      .split(",")
      .map((cell) => String(cell ?? "").trim());
  }

  function normalizeTableGrid(grid) {
    const rows = Array.isArray(grid) ? grid : [];
    if (!rows.length) {
      return [
        ["Column 1", "Column 2", "Column 3"],
        ["", "", ""]
      ];
    }
    const maxCols = Math.max(1, ...rows.map((row) => (Array.isArray(row) ? row.length : 0)));
    return rows.map((row) => {
      const copy = Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [];
      while (copy.length < maxCols) copy.push("");
      return copy;
    });
  }

  function defaultTableGrid() {
    return [
      ["Column 1", "Column 2", "Column 3"],
      ["", "", ""]
    ];
  }

  function defaultTablePayload() {
    return {
      blocks: [{ type: "table", grid: defaultTableGrid() }]
    };
  }

  const TABLE_MARKER_START = /^---table---$/i;
  const TABLE_MARKER_END = /^---endtable---$/i;

  function contentHasTableMarkers(content) {
    return String(content || "")
      .split(/\r?\n/)
      .some((line) => TABLE_MARKER_START.test(String(line || "").trim()));
  }

  function isPureTableBlocks(payload) {
    const { blocks } = migrateLegacyTablePayload(payload || {});
    return blocks.length === 1 && blocks[0].type === "table";
  }

  function parseTableSection(content) {
    const src = String(content || "").replace(/\r\n/g, "\n");
    const rawLines = src.split("\n");

    if (!contentHasTableMarkers(src)) {
      const lines = rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
      if (!lines.length) return defaultTablePayload();
      return { blocks: [{ type: "table", grid: normalizeTableGrid(lines.map(splitTableRow)) }] };
    }

    const blocks = [];
    let inTable = false;
    let textBuf = [];
    let tableLines = [];

    const flushText = () => {
      const segment = textBuf.join("\n").trim();
      if (segment) blocks.push({ type: "text", text: segment });
      textBuf = [];
    };

    const flushTable = () => {
      const lines = tableLines.map((line) => line.trim()).filter(Boolean);
      if (lines.length) {
        blocks.push({ type: "table", grid: normalizeTableGrid(lines.map(splitTableRow)) });
      }
      tableLines = [];
    };

    for (const line of rawLines) {
      const trimmed = String(line || "").trim();
      if (TABLE_MARKER_START.test(trimmed)) {
        flushText();
        inTable = true;
        continue;
      }
      if (TABLE_MARKER_END.test(trimmed)) {
        if (inTable) flushTable();
        inTable = false;
        continue;
      }
      if (inTable) tableLines.push(line);
      else textBuf.push(line);
    }

    if (inTable) flushTable();
    else flushText();

    return blocks.length ? { blocks } : defaultTablePayload();
  }

  function migrateLegacyTablePayload(payload) {
    if (payload?.blocks?.length) {
      return {
        blocks: payload.blocks.map((block) => {
          if (block?.type === "text") {
            return { type: "text", text: String(block.text || "") };
          }
          return { type: "table", grid: normalizeTableGrid(block?.grid) };
        })
      };
    }
    if (payload?.grid?.length) {
      return { blocks: [{ type: "table", grid: normalizeTableGrid(payload.grid) }] };
    }
    if (payload?.raw != null && String(payload.raw).trim()) {
      return parseTableSection(payload.raw);
    }
    return defaultTablePayload();
  }

  function tableRowHasContent(row) {
    return Array.isArray(row) && row.some((cell) => String(cell ?? "").trim());
  }

  function compileTableGrid(grid) {
    return (grid || [])
      .filter((row) => tableRowHasContent(row))
      .map((row) => row.map((cell) => String(cell ?? "").trim()).join(", "));
  }

  function compileTableSection(payload) {
    const { blocks } = migrateLegacyTablePayload(payload || {});
    const useMarkers = !isPureTableBlocks({ blocks });
    const parts = [];

    for (const block of blocks) {
      if (block.type === "text") {
        const text = String(block.text || "").trim();
        if (text) parts.push(text);
        continue;
      }
      if (block.type === "table") {
        const tableLines = compileTableGrid(block.grid);
        if (!tableLines.length) continue;
        if (useMarkers) {
          parts.push(`---table---\n${tableLines.join("\n")}\n---endtable---`);
        } else {
          parts.push(tableLines.join("\n"));
        }
      }
    }

    return parts.join("\n\n");
  }

  function sectionNameForCompile(section) {
    const name = String(section.name || "").trim() || "Untitled";
    const base = name.replace(/\|\s*table\s*$/i, "").trim();

    if (section.contentType === CONTENT_TYPES.TABLE) {
      if (isPureTableBlocks(section.payload)) {
        return /\|\s*table\s*$/i.test(name) ? name : `${base} | table`;
      }
      return base;
    }

    if (section.forceTable) {
      return /\|\s*table\s*$/i.test(name) ? name : `${base} | table`;
    }
    return base;
  }

  function compileLinks(rows) {
    return (rows || [])
      .map((r) => compileLinkRow(r))
      .filter(Boolean)
      .join("\n");
  }

  function compileDates(rows) {
    return (rows || [])
      .filter((r) => String(r.label || "").trim() || String(r.value || "").trim())
      .map((r) => `${String(r.label || "").trim()} : ${String(r.value || "").trim()}`)
      .join("\n");
  }

  function compileFaq(pairs) {
    const lines = [];
    for (const p of pairs || []) {
      const q = String(p.q || "").trim();
      const a = String(p.a || "").trim();
      if (q) lines.push(q.startsWith("Q:") ? q : `Q: ${q}`);
      if (a) lines.push(a.startsWith("A:") ? a : `A: ${a}`);
    }
    return lines.join("\n");
  }

  function compileList(items) {
    return (items || [])
      .filter((item) => String(item?.text || item || "").trim())
      .map((item, index) => {
        if (typeof item === "string") {
          return item.startsWith("-") ? item : `- ${item}`;
        }
        const text = String(item.text || "").trim();
        if (!text) return "";
        if (item.ordered) return `${index + 1}. ${text}`;
        return `- ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  function compileParagraphList(payload) {
    const parts = [];
    for (const p of payload.paragraphs || []) {
      const t = String(p || "").trim();
      if (t) parts.push(t);
    }
    parts.push(compileList(payload.items || []));
    return parts.filter(Boolean).join("\n");
  }

  function compileSectionBody(section) {
    const type = section.contentType || CONTENT_TYPES.MIXED;
    const payload = section.payload || {};

    switch (type) {
      case CONTENT_TYPES.PARAGRAPH:
        return String(payload.text || "").trim();
      case CONTENT_TYPES.DATES:
        return compileDatesSection(payload);
      case CONTENT_TYPES.LINKS:
        return compileLinks(payload.rows);
      case CONTENT_TYPES.FAQ:
        return compileFaq(payload.pairs);
      case CONTENT_TYPES.LIST:
        return compileList(payload.items);
      case CONTENT_TYPES.PARAGRAPH_LIST:
        return compileParagraphList(payload);
      case CONTENT_TYPES.TABLE:
        return compileTableSection(payload);
      case CONTENT_TYPES.MIXED:
      default:
        return String(payload.raw ?? "").trim();
    }
  }

  function parseTextToEditorSections(text) {
    const normalized = normalizeEditorText(text);
    const parsed = parseSectionsFromText(normalized);

    if (!parsed.length) {
      if (!normalized) return [];
      return [
        {
          id: newSectionId(),
          name: "Content",
          forceTable: false,
          contentType: CONTENT_TYPES.MIXED,
          payload: { raw: normalized }
        }
      ];
    }

    return parsed.map((sec) => {
      const lines = String(sec.content || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const contentType = detectContentType(lines, sec.forceTable, sec.content);
      let payload = {};

      switch (contentType) {
        case CONTENT_TYPES.PARAGRAPH:
          payload = { text: sec.content };
          break;
        case CONTENT_TYPES.DATES:
          payload = parseDatesSection(lines);
          break;
        case CONTENT_TYPES.LINKS:
          payload = { rows: lines.map(parseLinkRow) };
          break;
        case CONTENT_TYPES.FAQ:
          payload = { pairs: parseFaqLines(lines) };
          break;
        case CONTENT_TYPES.LIST:
          payload = { items: parseListLines(lines) };
          break;
        case CONTENT_TYPES.PARAGRAPH_LIST:
          payload = parseParagraphList(lines);
          break;
        case CONTENT_TYPES.TABLE:
          payload = parseTableSection(sec.content);
          break;
        case CONTENT_TYPES.MIXED:
        default:
          payload = { raw: sec.content };
          break;
      }

      return {
        id: newSectionId(),
        name: sec.cleanHeaderTitle || "Untitled",
        forceTable: contentType === CONTENT_TYPES.TABLE && isPureTableBlocks(payload),
        contentType,
        payload
      };
    });
  }

  function compileEditorSectionsToText(sections) {
    if (!Array.isArray(sections) || !sections.length) return "";

    const blocks = [];
    for (const section of sections) {
      const name = sectionNameForCompile(section);
      const body = compileSectionBody(section);
      blocks.push(body ? `[Section: ${name}]\n${body}` : `[Section: ${name}]`);
    }
    const out = blocks.join("\n\n");
    return out ? `${out}\n` : "";
  }

  function newSectionId() {
    return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultPayloadForType(contentType) {
    switch (contentType) {
      case CONTENT_TYPES.PARAGRAPH:
        return { text: "" };
      case CONTENT_TYPES.DATES:
        return { blocks: [{ type: "date", label: "", value: "" }] };
      case CONTENT_TYPES.LINKS:
        return { rows: [defaultLinkRow()] };
      case CONTENT_TYPES.FAQ:
        return { pairs: [{ q: "", a: "" }] };
      case CONTENT_TYPES.LIST:
        return { items: [{ text: "", ordered: false }] };
      case CONTENT_TYPES.PARAGRAPH_LIST:
        return { paragraphs: [""], items: [{ text: "", ordered: false }] };
      case CONTENT_TYPES.TABLE:
        return defaultTablePayload();
      default:
        return { raw: "" };
    }
  }

  function createEmptySection(name, contentType) {
    return {
      id: newSectionId(),
      name: name || "New Section",
      forceTable: contentType === CONTENT_TYPES.TABLE,
      contentType: contentType || CONTENT_TYPES.PARAGRAPH,
      payload: defaultPayloadForType(contentType || CONTENT_TYPES.PARAGRAPH)
    };
  }

  function isVisualEditorSafeForText(text) {
    const normalized = normalizeEditorText(text);
    if (!normalized) return true;
    const sections = parseTextToEditorSections(normalized);
    const roundTrip = normalizeEditorText(compileEditorSectionsToText(sections));
    return roundTrip === normalized;
  }

  function compileTableCellFromEditor({ mode, text, label, url }) {
    if (mode === "link") {
      const l = String(label || "").trim();
      const u = String(url || "").trim();
      if (l && u) return `${l}=${u}`;
      if (l) return l;
      if (u) return `=${u}`;
      return "";
    }
    return String(text ?? "");
  }

  function isTableCellUrlLike(value) {
    return /^(https?:\/\/|www\.|\/)/i.test(String(value || "").trim());
  }

  function parseTableCellLinkSyntax(cell) {
    const raw = String(cell ?? "").trim();
    const eqIdx = raw.indexOf("=");
    if (eqIdx <= 0) return null;
    const linkLabel = raw.slice(0, eqIdx).trim();
    const linkUrl = raw.slice(eqIdx + 1).trim();
    if (!linkLabel || !linkUrl || !isTableCellUrlLike(linkUrl)) return null;
    return { label: linkLabel, url: linkUrl };
  }

  function parseTableCellForEditor(cell) {
    const link = parseTableCellLinkSyntax(cell);
    if (link) {
      return { mode: "link", text: "", label: link.label, url: link.url };
    }
    return { mode: "text", text: String(cell ?? ""), label: "", url: "" };
  }

  const CONTENT_TYPE_LABELS = Object.freeze({
    [CONTENT_TYPES.PARAGRAPH]: "Paragraph",
    [CONTENT_TYPES.DATES]: "Dates (+ paragraph / list)",
    [CONTENT_TYPES.LINKS]: "Links (+ Hindi / English)",
    [CONTENT_TYPES.FAQ]: "Questions & answers",
    [CONTENT_TYPES.LIST]: "List",
    [CONTENT_TYPES.PARAGRAPH_LIST]: "Paragraph + list",
    [CONTENT_TYPES.TABLE]: "Table (+ text & links)",
    [CONTENT_TYPES.MIXED]: "Mixed / advanced"
  });

  global.SectionEditorModel = {
    CONTENT_TYPES,
    CONTENT_TYPE_LABELS,
    normalizeEditorText,
    parseTextToEditorSections,
    compileEditorSectionsToText,
    compileSectionBody,
    createEmptySection,
    defaultPayloadForType,
    isVisualEditorSafeForText,
    newSectionId,
    parseTableSection,
    compileTableSection,
    defaultTablePayload,
    normalizeTableGrid,
    isPureTableBlocks,
    defaultTableGrid,
    parseTableCellForEditor,
    compileTableCellFromEditor,
    parseTableCellLinkSyntax
  };
})(typeof window !== "undefined" ? window : globalThis);
