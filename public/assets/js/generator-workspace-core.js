/**
 * Phase PI-1 — Smart Generator Experience: pure analysis core.
 *
 * Advisory only. Nothing here mutates editor content, publish payloads, or
 * workflow state — every export is a pure function over strings/objects.
 * Loaded both in the browser (window.GeneratorWorkspaceCore) and in Jest.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.GeneratorWorkspaceCore = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const CORE_VERSION = "pi1.1.0";

  /** Ordered pipeline stages shown in the processing timeline. */
  const PIPELINE_STAGES = Object.freeze([
    Object.freeze({ id: "upload", label: "Upload", hint: "Choose a recruitment PDF" }),
    Object.freeze({ id: "extraction", label: "Extraction", hint: "Reading text layer / OCR" }),
    Object.freeze({ id: "conversion", label: "AI Conversion", hint: "Structuring into sections" }),
    Object.freeze({ id: "validation", label: "Validation", hint: "Checking sections and links" }),
    Object.freeze({ id: "ready", label: "Generator Ready", hint: "Review and publish" })
  ]);

  const STAGE_STATES = Object.freeze({
    PENDING: "pending",
    ACTIVE: "active",
    DONE: "done",
    ERROR: "error",
    SKIPPED: "skipped"
  });

  const CONFIDENCE_BANDS = Object.freeze({
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low"
  });

  const HIGH_CONFIDENCE_MIN = 0.75;
  const MEDIUM_CONFIDENCE_MIN = 0.5;

  const SEVERITY = Object.freeze({
    ERROR: "error",
    WARNING: "warning",
    INFO: "info"
  });

  /**
   * Section heading aliases → canonical key.
   * Mirrors server/lib/generatorIntelligence/types.js SECTION_HEADING_MAP so the
   * navigator labels the same sections the backend detects.
   */
  const SECTION_ALIASES = Object.freeze({
    shortinfo: "short_information",
    shortinformation: "short_information",
    briefinformation: "short_information",
    about: "short_information",
    importantdates: "important_dates",
    importantdate: "important_dates",
    keydates: "important_dates",
    dates: "important_dates",
    schedule: "important_dates",
    applicationfee: "application_fee",
    applicationfees: "application_fee",
    examfee: "application_fee",
    registrationfee: "application_fee",
    fee: "application_fee",
    agelimit: "age_limit",
    agecriteria: "age_limit",
    age: "age_limit",
    vacancy: "vacancy_details",
    vacancies: "vacancy_details",
    vacancydetails: "vacancy_details",
    postdetails: "vacancy_details",
    postwisevacancy: "vacancy_details",
    categorywisevacancy: "vacancy_details",
    eligibility: "eligibility",
    eligibilitycriteria: "eligibility",
    qualification: "qualification",
    educationalqualification: "qualification",
    selectionprocess: "selection_process",
    modeofselection: "selection_process",
    selection: "selection_process",
    salary: "salary",
    pay: "salary",
    payscale: "salary",
    howtoapply: "how_to_apply",
    howtoapplyonline: "how_to_apply",
    applicationprocedure: "how_to_apply",
    stepstoapply: "how_to_apply",
    importantlinks: "important_links",
    usefullinks: "important_links",
    links: "important_links",
    faq: "faq",
    importantquestions: "faq",
    frequentlyaskedquestions: "faq",
    helpline: "helpline",
    helpdesk: "helpline",
    contactus: "helpline",
    notificationdetails: "notification_details",
    advertisementdetails: "notification_details",
    advtdetails: "notification_details",
    importantinstructions: "important_instructions",
    generalinstructions: "important_instructions",
    instructions: "important_instructions",
    exampattern: "exam_pattern",
    schemeofexamination: "exam_pattern",
    syllabus: "syllabus"
  });

  const SECTION_LABELS = Object.freeze({
    short_information: "Short Information",
    important_dates: "Important Dates",
    application_fee: "Application Fee",
    age_limit: "Age Limit",
    vacancy_details: "Vacancy Details",
    eligibility: "Eligibility",
    qualification: "Qualification",
    selection_process: "Selection Process",
    salary: "Salary",
    how_to_apply: "How To Apply",
    important_links: "Important Links",
    faq: "Important Questions",
    helpline: "Helpline",
    notification_details: "Notification Details",
    important_instructions: "Important Instructions",
    exam_pattern: "Exam Pattern",
    syllabus: "Syllabus",
    unknown: "Other"
  });

  /** Sections a publishable recruitment page is expected to carry. */
  const REQUIRED_SECTIONS = Object.freeze(["short_information", "important_dates", "important_links"]);

  /** Sections that usually improve the page but are not blocking. */
  const RECOMMENDED_SECTIONS = Object.freeze([
    "vacancy_details",
    "eligibility",
    "application_fee",
    "age_limit",
    "selection_process",
    "how_to_apply"
  ]);

  const SECTION_HEADER_RE = /\[\s*section\s*:\s*([^\]\n]*?)\s*\]/gi;
  const PLACEHOLDER_LINE_RE = /^[\s—–-]*$/;
  const URL_IN_TEXT_RE = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;
  const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

  /* ---------------------------------------------------------------- utils */

  function toText(value) {
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  /** Normalize a heading for alias lookup: lowercase, strip everything but a–z0–9. */
  function normalizeHeadingKey(title) {
    return toText(title).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  /** Collapse whitespace + lowercase, for duplicate and match comparisons. */
  function normalizeLine(line) {
    return toText(line).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function resolveSectionKey(title) {
    const key = normalizeHeadingKey(title);
    if (!key) return "unknown";
    if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
    // Tolerate suffixes/prefixes such as "Important Dates 2026".
    for (const alias of Object.keys(SECTION_ALIASES)) {
      if (alias.length >= 6 && key.indexOf(alias) !== -1) return SECTION_ALIASES[alias];
    }
    return "unknown";
  }

  function sectionLabel(key, fallbackTitle) {
    if (key && key !== "unknown" && SECTION_LABELS[key]) return SECTION_LABELS[key];
    const title = toText(fallbackTitle).trim();
    return title || SECTION_LABELS.unknown;
  }

  /**
   * @param {number} score 0–1
   * @returns {"high"|"medium"|"low"}
   */
  function confidenceBand(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return CONFIDENCE_BANDS.LOW;
    if (n >= HIGH_CONFIDENCE_MIN) return CONFIDENCE_BANDS.HIGH;
    if (n >= MEDIUM_CONFIDENCE_MIN) return CONFIDENCE_BANDS.MEDIUM;
    return CONFIDENCE_BANDS.LOW;
  }

  function formatConfidencePercent(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return "0%";
    return `${Math.round(clamp(n, 0, 1) * 100)}%`;
  }

  /* ------------------------------------------------------------- link scan */

  /**
   * Accepts the URL shapes the publisher pipeline already renders.
   * @param {string} url
   * @returns {{ ok: boolean, reason?: string }}
   */
  function validateUrlValue(url) {
    const u = toText(url).trim();
    if (!u) return { ok: false, reason: "empty_url" };
    if (u === "—" || u === "-" || u === "#") return { ok: false, reason: "placeholder_url" };
    if (/^https?:\/\/$/i.test(u)) return { ok: false, reason: "broken_url" };
    if (/\s/.test(u)) return { ok: false, reason: "url_contains_space" };
    if (/^https?:\/\//i.test(u)) {
      const host = u.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
      if (!host || host.indexOf(".") === -1) return { ok: false, reason: "invalid_url" };
      return { ok: true };
    }
    // "www.example.gov.in" needs at least one dot after the www. prefix.
    if (/^www\./i.test(u)) return u.slice(4).indexOf(".") !== -1 ? { ok: true } : { ok: false, reason: "invalid_url" };
    if (u.charAt(0) === "/") return { ok: true };
    return { ok: false, reason: "unsupported_url_scheme" };
  }

  /**
   * Does the right-hand side of a `Label=value` row look like an intended link?
   * Kept deliberately narrow so rows such as `Total Posts=35260` or
   * `Qualification=10th/12th` are not mistaken for broken URLs.
   * @param {string} value
   * @returns {boolean}
   */
  function looksLikeLinkTarget(value) {
    const v = toText(value).trim();
    if (!v || /\s/.test(v)) return false;
    if (v === "—") return true;
    if (/^(https?:\/\/|www\.|\/\/)/i.test(v)) return true;
    if (v.charAt(0) === "/") return true;
    // Misspelled or truncated schemes ("htp:/x") still signal link intent.
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return true;
    return /\.[a-z]{2,}([/?#]|$)/i.test(v);
  }

  /**
   * Collect links from the three syntaxes the Generator editor supports:
   * `Label=URL`, `[Label](URL)`, and bare URLs.
   * @param {string} body
   * @returns {Array<{ label: string, url: string, ok: boolean, reason?: string, line: number }>}
   */
  function extractLinks(body) {
    const out = [];
    const lines = toText(body).split("\n");

    lines.forEach((rawLine, lineIndex) => {
      const line = toText(rawLine);
      const seenOnLine = new Set();

      const pushLink = (label, url) => {
        const clean = toText(url).trim().replace(/[.,;]+$/, "");
        if (!clean || seenOnLine.has(clean)) return;
        seenOnLine.add(clean);
        const check = validateUrlValue(clean);
        out.push({
          label: toText(label).trim() || clean,
          url: clean,
          ok: check.ok,
          reason: check.reason,
          line: lineIndex
        });
      };

      let match;
      MARKDOWN_LINK_RE.lastIndex = 0;
      while ((match = MARKDOWN_LINK_RE.exec(line)) !== null) pushLink(match[1], match[2]);

      const eq = line.indexOf("=");
      if (eq > 0) {
        const label = line.slice(0, eq);
        const value = line.slice(eq + 1).trim();
        // Only treat as a link row when the right side actually looks like a target.
        if (looksLikeLinkTarget(value)) pushLink(label, value);
      }

      URL_IN_TEXT_RE.lastIndex = 0;
      while ((match = URL_IN_TEXT_RE.exec(line)) !== null) pushLink("", match[1]);
    });

    return out;
  }

  /** Rows that look like the publisher's CSV/pipe table syntax. */
  function countTableRows(body) {
    const lines = toText(body).split("\n");
    let rows = 0;
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^\|.*\|$/.test(t) || (t.split("|").length >= 3 && !/^https?:/i.test(t))) rows += 1;
      else if (t.split(",").length >= 3 && /\d/.test(t) && !/^https?:/i.test(t) && t.indexOf("=") === -1) rows += 1;
    }
    return rows;
  }

  function hasTableMarker(body) {
    return /\|\s*table\b/i.test(toText(body)) || countTableRows(body) >= 2;
  }

  /* -------------------------------------------------------- section parser */

  /**
   * Split `[Section: …]` publisher text into addressable sections with offsets.
   * Offsets let the UI select the exact range inside the textarea.
   * @param {string} text
   * @returns {Array<object>}
   */
  function parseWorkspaceSections(text) {
    const source = toText(text);
    if (!source.trim()) return [];

    const headers = [];
    let match;
    SECTION_HEADER_RE.lastIndex = 0;
    while ((match = SECTION_HEADER_RE.exec(source)) !== null) {
      headers.push({
        title: toText(match[1]).trim(),
        headerStart: match.index,
        bodyStart: match.index + match[0].length
      });
    }

    if (!headers.length) return [];

    return headers.map((header, index) => {
      const next = headers[index + 1];
      const bodyEnd = next ? next.headerStart : source.length;
      const body = source.slice(header.bodyStart, bodyEnd).replace(/^\n+/, "").replace(/\s+$/, "");
      const key = resolveSectionKey(header.title);
      const lines = body.split("\n").filter((l) => l.trim());
      const contentLines = lines.filter((l) => !PLACEHOLDER_LINE_RE.test(l));
      const links = extractLinks(body);

      return {
        index,
        id: `pi1-sec-${index}`,
        title: header.title || SECTION_LABELS.unknown,
        label: sectionLabel(key, header.title),
        key,
        isKnownSection: key !== "unknown",
        body,
        headerStart: header.headerStart,
        bodyStart: header.bodyStart,
        bodyEnd,
        lineCount: lines.length,
        contentLineCount: contentLines.length,
        charCount: body.replace(/\s+/g, " ").trim().length,
        isEmpty: contentLines.length === 0,
        links,
        brokenLinks: links.filter((l) => !l.ok),
        tableRowCount: countTableRows(body),
        hasTable: hasTableMarker(body)
      };
    });
  }

  /* ----------------------------------------------------- confidence scoring */

  /** Does the body carry the kind of content its heading promises? */
  function sectionContentMatchesType(section) {
    const body = toText(section.body);
    switch (section.key) {
      case "important_dates":
        return /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(body) || /\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/.test(body);
      case "important_links":
        return section.links.length > 0;
      case "vacancy_details":
        return section.hasTable || /\d/.test(body);
      case "application_fee":
      case "salary":
        return /\d/.test(body);
      case "age_limit":
        return /\d/.test(body);
      case "faq":
        return /\bQ\s*[:.]/i.test(body) && /\bA\s*[:.]/i.test(body);
      default:
        return section.charCount > 0;
    }
  }

  /**
   * Heuristic fallback used when the server did not return a score.
   * @param {object} section
   * @returns {number} 0–1
   */
  function heuristicConfidence(section) {
    if (section.isEmpty) return 0.15;

    let score = 0.45;
    if (section.isKnownSection) score += 0.12;
    if (section.charCount > 60) score += 0.12;
    if (section.charCount > 200) score += 0.06;
    if (section.contentLineCount >= 3) score += 0.06;
    if (sectionContentMatchesType(section)) score += 0.14;
    else score -= 0.12;
    if (section.hasTable && section.tableRowCount >= 2) score += 0.05;
    score -= Math.min(0.24, section.brokenLinks.length * 0.08);
    if (section.charCount < 12) score -= 0.18;

    return round(clamp(score, 0.05, 0.99), 3);
  }

  /**
   * Attach a confidence score to each parsed section, preferring the server's
   * Phase AI-1 validation output and falling back to local heuristics.
   * @param {Array<object>} sections
   * @param {object|null} aiPayload response body of POST /api/ai-parse
   * @returns {Array<object>}
   */
  function applyConfidence(sections, aiPayload) {
    const serverSections =
      aiPayload && aiPayload.validation && Array.isArray(aiPayload.validation.sections)
        ? aiPayload.validation.sections
        : [];
    const structuredSections =
      aiPayload && aiPayload.structured && Array.isArray(aiPayload.structured.sections)
        ? aiPayload.structured.sections
        : [];

    const byTitle = new Map();
    serverSections.forEach((entry, i) => {
      const structured = structuredSections[i];
      const titleKey = normalizeHeadingKey(entry && entry.title) || normalizeHeadingKey(structured && structured.title);
      if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, entry);
    });

    return sections.map((section, i) => {
      const titleKey = normalizeHeadingKey(section.title);
      const server = byTitle.get(titleKey) || (serverSections.length === sections.length ? serverSections[i] : null);
      const hasServerScore = Boolean(server && typeof server.confidence === "number");
      // Server score is authoritative, but a locally emptied section must not stay "high".
      const raw = hasServerScore ? server.confidence : heuristicConfidence(section);
      const confidence = section.isEmpty ? Math.min(raw, 0.2) : raw;

      return Object.assign({}, section, {
        confidence: round(clamp(confidence, 0.05, 0.99), 3),
        confidenceBand: confidenceBand(confidence),
        confidenceSource: hasServerScore ? "server" : "heuristic",
        serverIssues: server && Array.isArray(server.issues) ? server.issues.slice() : [],
        complete: !section.isEmpty && section.brokenLinks.length === 0 && confidence >= MEDIUM_CONFIDENCE_MIN
      });
    });
  }

  /* --------------------------------------------------------- OCR heuristics */

  /**
   * Detect extraction damage that usually means the PDF was scanned or OCR'd poorly.
   * @param {string} extractedText
   * @param {{ extractionNote?: string, ocrUsed?: boolean }} [extraction]
   * @returns {Array<{ code: string, message: string, severity: string }>}
   */
  function detectOcrIssues(extractedText, extraction) {
    const text = toText(extractedText);
    const issues = [];
    if (!text.trim()) return issues;

    const note = toText(extraction && extraction.extractionNote);
    if (note || (extraction && extraction.ocrUsed)) {
      issues.push({
        code: "ocr_used",
        severity: SEVERITY.INFO,
        message: "OCR was used for this PDF — proofread names, numbers and dates carefully."
      });
    }

    const replacementChars = (text.match(/\uFFFD/g) || []).length;
    if (replacementChars > 3) {
      issues.push({
        code: "ocr_unreadable_chars",
        severity: SEVERITY.WARNING,
        message: `${replacementChars} unreadable characters found — some glyphs did not decode.`
      });
    }

    const sample = text.slice(0, 6000);
    const tokens = sample.split(/\s+/).filter(Boolean);
    if (tokens.length > 60) {
      const singles = tokens.filter((t) => t.length === 1 && /[A-Za-z]/.test(t)).length;
      if (singles / tokens.length > 0.3) {
        issues.push({
          code: "ocr_letter_spacing",
          severity: SEVERITY.WARNING,
          message: "Text looks letter-spaced (b r o k e n words) — check spelling before publishing."
        });
      }
    }

    const letters = (sample.match(/[A-Za-z\u0900-\u097F]/g) || []).length;
    if (sample.length > 400 && letters / sample.length < 0.45) {
      issues.push({
        code: "ocr_low_text_density",
        severity: SEVERITY.WARNING,
        message: "Low readable-text density — the PDF may be a scan with noisy output."
      });
    }

    if (text.trim().length < 300) {
      issues.push({
        code: "ocr_short_extract",
        severity: SEVERITY.WARNING,
        message: "Very little text was extracted — the notification may be image-only."
      });
    }

    return issues;
  }

  /* ------------------------------------------------------ validation report */

  function findDuplicateContent(sections) {
    const seen = new Map();
    const duplicates = [];

    sections.forEach((section) => {
      section.body.split("\n").forEach((rawLine) => {
        const norm = normalizeLine(rawLine);
        // Ignore short/boilerplate lines — repetition there is normal.
        if (norm.length < 25) return;
        if (PLACEHOLDER_LINE_RE.test(norm)) return;
        const prior = seen.get(norm);
        if (prior) {
          prior.count += 1;
          if (prior.sections.indexOf(section.label) === -1) prior.sections.push(section.label);
        } else {
          seen.set(norm, { text: rawLine.trim(), count: 1, sections: [section.label] });
        }
      });
    });

    seen.forEach((entry) => {
      if (entry.count > 1) duplicates.push(entry);
    });

    return duplicates.sort((a, b) => b.count - a.count).slice(0, 12);
  }

  const SERVER_ISSUE_LABELS = Object.freeze({
    missing_title: "Section heading is missing.",
    empty_section: "Section has no content.",
    invalid_table: "Table rows are not in a publishable shape.",
    empty_faq: "FAQ block has no question/answer pairs.",
    incomplete_faq_pair: "An FAQ entry is missing its question or answer."
  });

  function describeServerIssue(issue) {
    const raw = toText(issue);
    if (SERVER_ISSUE_LABELS[raw]) return SERVER_ISSUE_LABELS[raw];
    if (raw.indexOf("broken_url:") === 0) return `Broken link: ${raw.slice(11)}`;
    if (raw.indexOf("bad_date:") === 0) return `Unrecognized date format: ${raw.slice(9)}`;
    if (raw.indexOf("duplicate_lines:") === 0) return `${raw.slice(16)} duplicate line(s) in this section.`;
    if (raw.indexOf("table_col_mismatch") === 0) return "Table has rows with mismatched column counts.";
    if (raw.indexOf("table_duplicate_rows:") === 0) return `Table has ${raw.split(":")[1]} duplicate row(s).`;
    if (raw.indexOf("table_empty_rows:") === 0) return `Table has ${raw.split(":")[1]} empty row(s).`;
    if (raw.indexOf("table_few_columns") === 0) return "Table has fewer than two columns.";
    return raw.replace(/_/g, " ");
  }

  /**
   * Build the advisory validation report rendered in the Validation panel.
   * @param {{ sections: Array<object>, extractedText?: string, extraction?: object, aiPayload?: object }} input
   */
  function buildValidationReport(input) {
    const sections = Array.isArray(input && input.sections) ? input.sections : [];
    const presentKeys = new Set(sections.filter((s) => !s.isEmpty).map((s) => s.key));

    const missingSections = REQUIRED_SECTIONS.filter((key) => !presentKeys.has(key)).map((key) => ({
      key,
      label: SECTION_LABELS[key],
      severity: SEVERITY.ERROR,
      message: `${SECTION_LABELS[key]} is missing or empty.`
    }));

    const recommendedMissing = RECOMMENDED_SECTIONS.filter((key) => !presentKeys.has(key)).map((key) => ({
      key,
      label: SECTION_LABELS[key],
      severity: SEVERITY.INFO,
      message: `${SECTION_LABELS[key]} was not detected — add it if the notification mentions it.`
    }));

    const emptySections = sections
      .filter((s) => s.isEmpty)
      .map((s) => ({
        key: s.key,
        sectionId: s.id,
        label: s.label,
        severity: SEVERITY.WARNING,
        message: `${s.label} has no content yet.`
      }));

    const brokenLinks = [];
    sections.forEach((section) => {
      section.brokenLinks.forEach((link) => {
        brokenLinks.push({
          sectionId: section.id,
          label: section.label,
          url: link.url,
          reason: link.reason,
          severity: SEVERITY.ERROR,
          message: `${section.label}: "${link.label}" points to an invalid URL (${link.url || "empty"}).`
        });
      });
    });

    const duplicates = findDuplicateContent(sections).map((d) => ({
      severity: SEVERITY.WARNING,
      text: d.text,
      count: d.count,
      sections: d.sections,
      message: `Repeated ${d.count}×: "${d.text.slice(0, 90)}${d.text.length > 90 ? "…" : ""}"`
    }));

    const ocrIssues = detectOcrIssues(input && input.extractedText, input && input.extraction);

    const warnings = [];
    sections.forEach((section) => {
      section.serverIssues.forEach((issue) => {
        // Broken links already have a dedicated group.
        if (toText(issue).indexOf("broken_url:") === 0) return;
        warnings.push({
          sectionId: section.id,
          label: section.label,
          severity: SEVERITY.WARNING,
          message: `${section.label}: ${describeServerIssue(issue)}`
        });
      });
      if (section.confidenceBand === CONFIDENCE_BANDS.LOW && !section.isEmpty) {
        warnings.push({
          sectionId: section.id,
          label: section.label,
          severity: SEVERITY.WARNING,
          message: `${section.label} has low confidence (${formatConfidencePercent(section.confidence)}) — verify against the PDF.`
        });
      }
    });

    const errorCount = missingSections.length + brokenLinks.length;
    const warningCount =
      emptySections.length +
      duplicates.length +
      warnings.length +
      ocrIssues.filter((i) => i.severity === SEVERITY.WARNING).length;

    return {
      ok: errorCount === 0,
      errorCount,
      warningCount,
      infoCount: recommendedMissing.length + ocrIssues.filter((i) => i.severity === SEVERITY.INFO).length,
      missingSections,
      recommendedMissing,
      emptySections,
      brokenLinks,
      duplicates,
      ocrIssues,
      warnings
    };
  }

  /* ---------------------------------------------------------- AI suggestions */

  /**
   * Advisory-only suggestions. These are never applied automatically — the
   * panel renders them as read-only guidance next to a "jump to section" action.
   * @param {{ sections: Array<object>, report: object, editorText?: string }} input
   * @returns {Array<{ id: string, title: string, detail: string, sectionId?: string, priority: number }>}
   */
  function buildSuggestions(input) {
    const sections = Array.isArray(input && input.sections) ? input.sections : [];
    const report = (input && input.report) || {};
    const suggestions = [];

    (report.missingSections || []).forEach((miss) => {
      suggestions.push({
        id: `add-${miss.key}`,
        title: `Add a ${miss.label} section`,
        detail: `Published pages normally include ${miss.label}. Search the PDF for it and add the section manually.`,
        priority: 1
      });
    });

    (report.brokenLinks || []).forEach((link, i) => {
      suggestions.push({
        id: `fix-link-${i}`,
        title: `Fix the link in ${link.label}`,
        detail: `"${link.url || "empty value"}" is not a usable URL. Expected format: Label=https://example.com/page`,
        sectionId: link.sectionId,
        priority: 1
      });
    });

    (report.emptySections || []).forEach((sec) => {
      suggestions.push({
        id: `fill-${sec.sectionId}`,
        title: `Fill in ${sec.label}`,
        detail: "This section is a placeholder. Copy the matching text from the PDF pane or delete the section.",
        sectionId: sec.sectionId,
        priority: 2
      });
    });

    if ((report.duplicates || []).length) {
      suggestions.push({
        id: "remove-duplicates",
        title: `Review ${report.duplicates.length} repeated line(s)`,
        detail: "The same line appears more than once — usually a PDF header repeated on every page.",
        priority: 2
      });
    }

    sections.forEach((section) => {
      if (section.confidenceBand === CONFIDENCE_BANDS.LOW && !section.isEmpty) {
        suggestions.push({
          id: `verify-${section.id}`,
          title: `Verify ${section.label}`,
          detail: `Confidence is ${formatConfidencePercent(section.confidence)}. Compare this section against the source PDF before publishing.`,
          sectionId: section.id,
          priority: 3
        });
      }
      if (section.key === "important_dates" && !section.isEmpty && !sectionContentMatchesType(section)) {
        suggestions.push({
          id: `dates-format-${section.id}`,
          title: "Dates may not be machine-readable",
          detail: "No recognizable date pattern found. Use formats like 22 June 2026 or 22/06/2026.",
          sectionId: section.id,
          priority: 2
        });
      }
      if (section.key === "important_links" && !section.isEmpty && !section.links.length) {
        suggestions.push({
          id: `links-missing-${section.id}`,
          title: "Important Links has no URLs",
          detail: "Add rows in the form Apply Online=https://example.com/apply so the link box renders.",
          sectionId: section.id,
          priority: 2
        });
      }
    });

    (report.ocrIssues || []).forEach((issue, i) => {
      if (issue.severity === SEVERITY.INFO) return;
      suggestions.push({
        id: `ocr-${i}`,
        title: "Proofread OCR output",
        detail: issue.message,
        priority: 2
      });
    });

    return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 14);
  }

  /* -------------------------------------------------------------- summary */

  /**
   * Rough manual-review effort estimate, in minutes.
   * Deliberately conservative: it is a planning hint, not a promise.
   */
  function estimateEditMinutes(sections, report) {
    const list = Array.isArray(sections) ? sections : [];
    if (!list.length) return 0;

    let minutes = 1.5;
    list.forEach((section) => {
      minutes += 0.4;
      minutes += Math.min(2.5, section.charCount / 900);
      if (section.confidenceBand === CONFIDENCE_BANDS.LOW) minutes += 1.5;
      else if (section.confidenceBand === CONFIDENCE_BANDS.MEDIUM) minutes += 0.6;
      if (section.hasTable) minutes += 0.8;
    });

    minutes += (report && report.errorCount ? report.errorCount : 0) * 1.2;
    minutes += (report && report.warningCount ? report.warningCount : 0) * 0.4;

    return Math.max(1, Math.round(minutes * 2) / 2);
  }

  function qualityLabelFor(score) {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Needs review";
    return "Needs work";
  }

  /**
   * @param {{ sections: Array<object>, report: object }} input
   */
  function buildSummary(input) {
    const sections = Array.isArray(input && input.sections) ? input.sections : [];
    const report = (input && input.report) || { errorCount: 0, warningCount: 0 };

    const linksDetected = sections.reduce((sum, s) => sum + s.links.length, 0);
    const tablesDetected = sections.filter((s) => s.hasTable).length;
    const confidences = sections.map((s) => s.confidence);
    const avgConfidence = confidences.length
      ? round(confidences.reduce((a, b) => a + b, 0) / confidences.length, 3)
      : 0;

    let quality = avgConfidence * 100;
    quality -= report.errorCount * 9;
    quality -= report.warningCount * 3;
    if (!sections.length) quality = 0;
    const qualityScore = Math.round(clamp(quality, 0, 100));

    return {
      sectionsDetected: sections.length,
      knownSections: sections.filter((s) => s.isKnownSection).length,
      emptySections: sections.filter((s) => s.isEmpty).length,
      tablesDetected,
      linksDetected,
      brokenLinks: sections.reduce((sum, s) => sum + s.brokenLinks.length, 0),
      highConfidence: sections.filter((s) => s.confidenceBand === CONFIDENCE_BANDS.HIGH).length,
      mediumConfidence: sections.filter((s) => s.confidenceBand === CONFIDENCE_BANDS.MEDIUM).length,
      lowConfidence: sections.filter((s) => s.confidenceBand === CONFIDENCE_BANDS.LOW).length,
      avgConfidence,
      estimatedEditMinutes: estimateEditMinutes(sections, report),
      qualityScore,
      qualityLabel: qualityLabelFor(qualityScore)
    };
  }

  /* ------------------------------------------------------------- top level */

  /**
   * Full advisory analysis for the workspace UI.
   * Pure: returns a new object and never touches its inputs.
   *
   * @param {{
   *   editorText?: string,
   *   extractedText?: string,
   *   aiPayload?: object|null,
   *   extraction?: { extractionNote?: string, ocrUsed?: boolean }|null
   * }} [input]
   */
  function analyzeWorkspace(input) {
    const opts = input || {};
    const editorText = toText(opts.editorText);
    const parsed = parseWorkspaceSections(editorText);
    const sections = applyConfidence(parsed, opts.aiPayload);
    const report = buildValidationReport({
      sections,
      extractedText: opts.extractedText,
      extraction: opts.extraction,
      aiPayload: opts.aiPayload
    });
    const summary = buildSummary({ sections, report });
    const suggestions = buildSuggestions({ sections, report, editorText });

    return {
      version: CORE_VERSION,
      hasContent: editorText.trim().length > 0,
      isStructured: sections.length > 0,
      sections,
      report,
      summary,
      suggestions
    };
  }

  /* ------------------------------------------------------- source matching */

  /** Pick lines distinctive enough to locate in the raw PDF text. */
  function distinctiveLines(body, limit) {
    return toText(body)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 12 && !PLACEHOLDER_LINE_RE.test(l))
      .sort((a, b) => b.length - a.length)
      .slice(0, limit || 4);
  }

  /**
   * Locate a section's text inside the raw extracted text so the split view can
   * highlight the matching source region.
   * @param {string} sectionBody
   * @param {string} sourceText
   * @returns {{ start: number, end: number, matchedLines: number, score: number }|null}
   */
  function findSourceMatch(sectionBody, sourceText) {
    const source = toText(sourceText);
    if (!source) return null;
    const candidates = distinctiveLines(sectionBody, 6);
    if (!candidates.length) return null;

    const haystack = source.toLowerCase();
    const hits = [];

    for (const line of candidates) {
      const needle = line.toLowerCase();
      let at = haystack.indexOf(needle);
      if (at === -1) {
        // Fall back to the first half of the line — AI output often reflows text.
        const half = needle.slice(0, Math.max(12, Math.floor(needle.length / 2)));
        at = half.length >= 12 ? haystack.indexOf(half) : -1;
        if (at !== -1) hits.push({ start: at, end: at + half.length, exact: false });
      } else {
        hits.push({ start: at, end: at + needle.length, exact: true });
      }
    }

    if (!hits.length) return null;

    hits.sort((a, b) => a.start - b.start);
    const start = hits[0].start;
    const end = hits.reduce((max, h) => Math.max(max, h.end), start);
    const exactCount = hits.filter((h) => h.exact).length;

    return {
      start,
      end: Math.min(source.length, end),
      matchedLines: hits.length,
      score: round(exactCount / candidates.length, 2)
    };
  }

  /* -------------------------------------------------------- error messages */

  const NETWORK_ERROR = Object.freeze({
    code: "network",
    title: "Could not reach the server",
    message: "The upload did not complete.",
    hint: "Check your internet connection and try Extract text again.",
    retryable: true
  });

  /**
   * Turn a raw extraction failure into something an editor can act on.
   * @param {{
   *   status?: number,
   *   code?: string,
   *   message?: string,
   *   contentType?: string,
   *   networkError?: boolean,
   *   fileName?: string,
   *   fileSizeBytes?: number
   * }} [failure]
   */
  function describeExtractionError(failure) {
    const f = failure || {};
    if (f.networkError) return NETWORK_ERROR;

    const status = Number(f.status) || 0;
    const message = toText(f.message);
    const code = toText(f.code).toUpperCase();
    const contentType = toText(f.contentType);

    if (status === 401 || status === 403) {
      return {
        code: "auth",
        title: "Your session expired",
        message: "The generator could not authenticate this upload.",
        hint: "Open /login in a new tab, sign in, then return here and extract again. Your draft is kept.",
        retryable: true
      };
    }

    if (status === 413) {
      const sizeMb = Number(f.fileSizeBytes) > 0 ? ` (${(Number(f.fileSizeBytes) / (1024 * 1024)).toFixed(1)} MB)` : "";
      return {
        code: "too_large",
        title: "PDF is too large to upload",
        message: `The server rejected this file${sizeMb} before extraction started.`,
        hint: "Compress the PDF or split it, then upload only the notification pages.",
        retryable: false
      };
    }

    if (status === 429) {
      return {
        code: "rate_limited",
        title: "Too many extractions in a row",
        message: "Extraction is rate limited to protect the server.",
        hint: "Wait about a minute and try again.",
        retryable: true
      };
    }

    if (status === 400 && /pdf/i.test(message)) {
      return {
        code: "wrong_type",
        title: "That file is not a PDF",
        message: "Only PDF files can be extracted here.",
        hint: "Export or scan the notification as PDF and upload it again.",
        retryable: false
      };
    }

    if (code === "OCR_FAILED" || /ocr/i.test(message) || /scanned|image pdf/i.test(message)) {
      return {
        code: "ocr_failed",
        title: "This looks like a scanned PDF",
        message: "OCR ran but could not recover enough readable text.",
        hint: "Try a clearer scan, a smaller page range, or paste the text manually into Page Content.",
        retryable: true
      };
    }

    if (
      code === "TEXT_TOO_SHORT" ||
      /properly\s+read\s+nahi/i.test(message) ||
      /readable\s+text\s+(nahi|not)/i.test(message) ||
      /no\s+readable\s+text/i.test(message)
    ) {
      return {
        code: "no_text",
        title: "No readable text found",
        message: "The PDF has no usable text layer, so there was nothing to extract.",
        hint: "Upload the original (non-scanned) notification PDF, or paste the text manually.",
        retryable: false
      };
    }

    if (code === "INVALID_PDF" || /corrupt|empty/i.test(message)) {
      return {
        code: "invalid_pdf",
        title: "The PDF could not be opened",
        message: "The file appears to be empty or damaged.",
        hint: "Re-download the notification from the official site and upload it again.",
        retryable: false
      };
    }

    if (contentType && contentType.indexOf("application/json") === -1 && status >= 500) {
      return {
        code: "bad_gateway",
        title: "The server returned an unexpected response",
        message: `Status ${status} came back without JSON — usually a proxy or restart.`,
        hint: "Wait a few seconds and try Extract text again.",
        retryable: true
      };
    }

    if (status >= 500) {
      return {
        code: "server_error",
        title: "Extraction failed on the server",
        message: message || "The extraction pipeline reported an internal error.",
        hint: "Try again. If it keeps failing, paste the notification text manually.",
        retryable: true
      };
    }

    return {
      code: "unknown",
      title: "Extraction did not finish",
      message: message || "The PDF could not be converted to text.",
      hint: "Try another PDF, or paste the notification text into Page Content.",
      retryable: true
    };
  }

  /* --------------------------------------------------------------- exports */

  return {
    CORE_VERSION,
    PIPELINE_STAGES,
    STAGE_STATES,
    CONFIDENCE_BANDS,
    SEVERITY,
    SECTION_LABELS,
    REQUIRED_SECTIONS,
    RECOMMENDED_SECTIONS,
    HIGH_CONFIDENCE_MIN,
    MEDIUM_CONFIDENCE_MIN,
    normalizeHeadingKey,
    resolveSectionKey,
    sectionLabel,
    confidenceBand,
    formatConfidencePercent,
    validateUrlValue,
    looksLikeLinkTarget,
    extractLinks,
    countTableRows,
    parseWorkspaceSections,
    heuristicConfidence,
    applyConfidence,
    detectOcrIssues,
    buildValidationReport,
    buildSuggestions,
    estimateEditMinutes,
    buildSummary,
    analyzeWorkspace,
    findSourceMatch,
    describeExtractionError
  };
});
