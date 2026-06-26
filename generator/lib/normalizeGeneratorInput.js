"use strict";

const { normalizeDisplayText } = require("./displayTextNormalize");
const { hasRichInlineTags } = require("./richInlineText");
const { parsePipeLinkLine, isUrlLike } = require("./parseLinkLineParts");

const URL_OR_EMAIL_RE =
  /(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

const TITLE_OPTS = Object.freeze({ enabled: true, mode: "title" });
const SECTION_HEADER_RE = /^(\[\s*section\s*:\s*)(.*?)(\]\s*)$/i;
const LIST_PREFIX_RE = /^(-\s+|\d+[.)]\s+)/;
const FAQ_PREFIX_RE = /^(Q:|A:)\s*/i;
const RICH_TAG_RE =
  /(\[(?:\/)?(?:b|highlight|color=(?:red|green|blue|orange|purple|gray|yellow))\]|\[br\])/gi;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * @param {string} text
 */
function normalizeGeneratorScalar(text) {
  return normalizeDisplayText(String(text ?? ""), TITLE_OPTS);
}

/**
 * @param {string} name
 */
function normalizeSectionHeaderName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return raw;

  const tableSuffix = /\|\s*table\s*$/i.test(raw);
  const base = tableSuffix ? raw.replace(/\|\s*table\s*$/i, "").trim() : raw;
  const spaced = base.replace(/([a-z\d])([A-Z])/g, "$1 $2");
  const normalized = normalizeGeneratorScalar(spaced);
  return tableSuffix ? `${normalized} | table` : normalized;
}

/**
 * @param {string} line
 */
function normalizeSectionHeaderLine(line) {
  const m = String(line ?? "").match(SECTION_HEADER_RE);
  if (!m) return normalizeGeneratorContentLine(line);
  return `${m[1]}${normalizeSectionHeaderName(m[2])}${m[3]}`;
}

/**
 * @param {string} text
 */
function normalizeTextPreservingMarkdownLinks(text) {
  const placeholders = [];
  let work = String(text ?? "").replace(MARKDOWN_LINK_RE, (full, label, href) => {
    const token = `\u0000M${placeholders.length}\u0000`;
    placeholders.push({ label, href });
    return token;
  });

  work = normalizeGeneratorScalar(work);

  placeholders.forEach((entry, i) => {
    const normLabel = normalizeGeneratorScalar(entry.label);
    work = work.replace(`\u0000M${i}\u0000`, `[${normLabel}](${entry.href})`);
  });

  return work;
}

/**
 * @param {string} text
 */
function normalizeRichTaggedText(text) {
  const src = String(text ?? "");
  if (!hasRichInlineTags(src)) {
    return normalizeTextPreservingMarkdownLinks(src);
  }

  const parts = [];
  let last = 0;
  let match;
  RICH_TAG_RE.lastIndex = 0;
  while ((match = RICH_TAG_RE.exec(src)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: src.slice(last, match.index) });
    }
    parts.push({ type: "tag", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < src.length) {
    parts.push({ type: "text", value: src.slice(last) });
  }

  return parts
    .map((part) =>
      part.type === "tag" ? part.value : normalizeTextPreservingMarkdownLinks(part.value)
    )
    .join("");
}

/**
 * @param {string} leftOfEq
 */
function normalizeLinkLeftSide(leftOfEq) {
  const raw = String(leftOfEq ?? "").trim();
  if (!raw) return raw;

  const pipeIdx = raw.indexOf("|");
  if (pipeIdx === -1) {
    return normalizeGeneratorScalar(raw);
  }

  const displayLabel = normalizeGeneratorScalar(raw.slice(0, pipeIdx).trim());
  const buttonText = normalizeGeneratorScalar(raw.slice(pipeIdx + 1).trim());
  return `${displayLabel}|${buttonText}`;
}

/**
 * @param {string} line
 */
function normalizeLinkLine(line) {
  const raw = String(line ?? "").trim();
  const pipeParsed = parsePipeLinkLine(raw);
  if (pipeParsed) {
    const label = normalizeGeneratorScalar(pipeParsed.displayLabel);
    const actions = pipeParsed.actions.map(
      (action) => `${normalizeGeneratorScalar(action.buttonText)}=${action.href}`
    );
    return [label, ...actions].join("|");
  }

  const eqIdx = raw.indexOf("=");
  if (eqIdx <= 0) return normalizeRichTaggedText(raw);

  const left = raw.slice(0, eqIdx).trim();
  const right = raw.slice(eqIdx + 1).trim();
  if (!isUrlLike(right)) return normalizeRichTaggedText(raw);

  return `${normalizeLinkLeftSide(left)}=${right}`;
}

/**
 * @param {string} line
 */
function looksLikeKeyValueRow(line) {
  const raw = String(line ?? "").trim();
  const colonIdx = raw.indexOf(":");
  if (colonIdx <= 0) return false;

  const before = raw.slice(0, colonIdx).trim();
  const after = raw.slice(colonIdx + 1).trim();
  if (/https?$/i.test(before) || /^\/\//.test(after)) return false;
  if (/\[[^\]]*\]\([^)]*\)/.test(raw)) return false;
  return true;
}

/**
 * @param {string} line
 */
function normalizeColonRow(line) {
  const raw = String(line ?? "").trim();
  const colonIdx = raw.indexOf(":");
  if (colonIdx <= 0) return normalizeRichTaggedText(raw);

  const label = raw.slice(0, colonIdx).trim();
  const value = raw.slice(colonIdx + 1).trim();
  return `${normalizeGeneratorScalar(label)}: ${normalizeGeneratorScalar(value)}`;
}

/**
 * @param {string} line
 */
function normalizeListLine(line) {
  const raw = String(line ?? "");
  const m = raw.match(LIST_PREFIX_RE);
  if (!m) return normalizeRichTaggedText(raw);
  const prefix = m[0];
  const body = raw.slice(prefix.length);
  return `${prefix}${normalizeRichTaggedText(body)}`;
}

/**
 * @param {string} line
 */
function normalizeFaqLine(line) {
  const raw = String(line ?? "").trim();
  const m = raw.match(FAQ_PREFIX_RE);
  if (!m) return normalizeRichTaggedText(raw);
  const prefix = m[0];
  const body = raw.slice(prefix.length);
  return `${prefix}${normalizeGeneratorScalar(body)}`;
}

/**
 * @param {string} cell
 */
function normalizeTableCell(cell) {
  const raw = String(cell ?? "").trim();
  if (!raw) return raw;

  const eqIdx = raw.indexOf("=");
  if (eqIdx > 0) {
    const left = raw.slice(0, eqIdx).trim();
    const right = raw.slice(eqIdx + 1).trim();
    if (isUrlLike(right)) {
      return `${normalizeGeneratorScalar(left)}=${right}`;
    }
  }

  if (isUrlLike(raw)) return raw;
  return normalizeGeneratorScalar(raw);
}

/**
 * @param {string} line
 */
function normalizeTableRow(line) {
  return String(line ?? "")
    .split(",")
    .map((cell) => normalizeTableCell(cell))
    .join(", ");
}

/**
 * @param {string} line
 */
function normalizeGeneratorContentLine(line) {
  const raw = String(line ?? "");
  if (!raw.trim()) return raw;

  if (SECTION_HEADER_RE.test(raw.trim())) {
    return normalizeSectionHeaderLine(raw.trim());
  }

  if (isUrlLike(raw.trim())) {
    return raw.trim();
  }

  if (FAQ_PREFIX_RE.test(raw.trim())) {
    return normalizeFaqLine(raw.trim());
  }

  if (LIST_PREFIX_RE.test(raw.trim())) {
    return normalizeListLine(raw.trim());
  }

  if (raw.includes("=") && isUrlLike(raw.slice(raw.indexOf("=") + 1).trim())) {
    return normalizeLinkLine(raw.trim());
  }

  if (
    hasRichInlineTags(raw) ||
    /\[[^\]]+\]\([^)]+\)/.test(raw) ||
    URL_OR_EMAIL_RE.test(raw)
  ) {
    return normalizeRichTaggedText(raw.trim());
  }

  if (looksLikeKeyValueRow(raw)) {
    return normalizeColonRow(raw.trim());
  }

  return normalizeRichTaggedText(raw.trim());
}

/**
 * @param {string} text
 */
function normalizeGeneratorPageContent(text) {
  const src = String(text ?? "");
  if (!src.trim()) return src;

  const lines = src.split("\n");
  let inTableSection = false;
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\[\s*section\s*:\s*(.*?)\]\s*$/i);
    if (sectionMatch) {
      inTableSection = /\|\s*table\s*$/i.test(sectionMatch[1]);
      out.push(normalizeSectionHeaderLine(trimmed));
      continue;
    }

    if (inTableSection && trimmed) {
      out.push(normalizeTableRow(line));
      continue;
    }

    if (!trimmed) {
      out.push(line);
      continue;
    }

    out.push(normalizeGeneratorContentLine(line));
  }

  return out.join("\n");
}

/**
 * Capitalize display text on generator save. URLs / slugs are untouched.
 * @param {Record<string, unknown>} body
 */
function normalizeGeneratorBodyTextFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  if (body.title != null && String(body.title).trim()) {
    body.title = normalizeGeneratorScalar(body.title);
  }

  if (body.post_name != null && String(body.post_name).trim()) {
    body.post_name = normalizeGeneratorScalar(body.post_name);
  }

  if (body.postName != null && String(body.postName).trim()) {
    body.postName = normalizeGeneratorScalar(body.postName);
  }

  if (body.category != null && String(body.category).trim()) {
    body.category = normalizeGeneratorScalar(body.category);
  }

  const contentKey = body.content != null ? "content" : body.text != null ? "text" : null;
  const rawContent = contentKey ? String(body[contentKey]) : "";
  if (rawContent.trim()) {
    const normalized = normalizeGeneratorPageContent(rawContent);
    body.content = normalized;
    body.text = normalized;
  }

  return body;
}

module.exports = {
  normalizeGeneratorScalar,
  normalizeGeneratorPageContent,
  normalizeGeneratorContentLine,
  normalizeGeneratorBodyTextFields,
  normalizeSectionHeaderName,
  normalizeTableRow
};
