/**
 * Phase PI-2 — Editorial Workspace Pro: pure presentation analysis core.
 *
 * Prefers AI-4 `editorialIntelligence` already attached to the workspace
 * payload. Falls back to PI-1 GeneratorWorkspaceCore heuristics when absent.
 * Advisory only — never mutates drafts, never publishes, never applies changes.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.EditorialWorkspaceCore = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";

  const CORE_VERSION = "pi2.1.0";

  function getGw() {
    if (root && root.GeneratorWorkspaceCore) return root.GeneratorWorkspaceCore;
    if (typeof global !== "undefined" && global.GeneratorWorkspaceCore) return global.GeneratorWorkspaceCore;
    try {
      return require("./generator-workspace-core.js");
    } catch {
      return null;
    }
  }

  const CHECKLIST_ITEMS = Object.freeze([
    Object.freeze({ id: "short_information", label: "Short Information", sectionType: "short_information" }),
    Object.freeze({ id: "dates", label: "Dates", sectionType: "important_dates" }),
    Object.freeze({ id: "fees", label: "Fees", sectionType: "application_fee" }),
    Object.freeze({ id: "age", label: "Age", sectionType: "age_limit" }),
    Object.freeze({ id: "vacancy", label: "Vacancy", sectionType: "vacancy_details" }),
    Object.freeze({ id: "eligibility", label: "Eligibility", sectionType: "eligibility" }),
    Object.freeze({ id: "selection", label: "Selection", sectionType: "selection_process" }),
    Object.freeze({ id: "salary", label: "Salary", sectionType: "salary" }),
    Object.freeze({ id: "links", label: "Links", sectionType: "important_links" }),
    Object.freeze({ id: "faq", label: "FAQ", sectionType: "faq" }),
    Object.freeze({ id: "instructions", label: "Instructions", sectionType: "important_instructions" })
  ]);

  const CHECKLIST_STATUS = Object.freeze({
    COMPLETE: "complete",
    NEEDS_REVIEW: "needs_review",
    MISSING: "missing"
  });

  const SEVERITY_ORDER = Object.freeze(["Critical", "High", "Medium", "Low"]);

  const LINK_BUCKETS = Object.freeze([
    Object.freeze({ id: "official", label: "Official", match: /official_website|official/i }),
    Object.freeze({ id: "notification", label: "Notification", match: /notification/i }),
    Object.freeze({ id: "apply", label: "Apply", match: /apply|registration/i }),
    Object.freeze({ id: "login", label: "Login", match: /login/i }),
    Object.freeze({ id: "result", label: "Result", match: /result/i }),
    Object.freeze({ id: "admit_card", label: "Admit Card", match: /admit/i }),
    Object.freeze({ id: "answer_key", label: "Answer Key", match: /answer/i }),
    Object.freeze({ id: "broken", label: "Broken", match: null }),
    Object.freeze({ id: "duplicate", label: "Duplicate", match: null })
  ]);

  const READINESS = Object.freeze({
    READY: "ready",
    NEEDS_WORK: "needs_work",
    BLOCKED: "blocked",
    EMPTY: "empty"
  });

  function toText(value) {
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }

  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function round(value, digits) {
    const factor = Math.pow(10, digits == null ? 0 : digits);
    return Math.round(value * factor) / factor;
  }

  function normalizeSeverity(value) {
    const raw = toText(value).trim();
    if (!raw) return "Low";
    const lower = raw.toLowerCase();
    if (lower === "critical") return "Critical";
    if (lower === "high" || lower === "error") return "High";
    if (lower === "medium" || lower === "warning") return "Medium";
    if (lower === "low" || lower === "info") return "Low";
    return "Low";
  }

  function scoreBand(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return "low";
    if (n >= 75) return "high";
    if (n >= 50) return "medium";
    return "low";
  }

  function levelFromScore100(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return "LOW";
    if (n >= 80) return "HIGH";
    if (n >= 60) return "MEDIUM";
    if (n >= 40) return "LOW";
    return "VERY_LOW";
  }

  function extractDraftText(workspace) {
    const draft = workspace && workspace.draft;
    if (!draft) return "";
    const payload = draft.payload && typeof draft.payload === "object" ? draft.payload : {};
    if (typeof payload.result === "string") return payload.result;
    if (typeof payload.content === "string") return payload.content;
    if (typeof payload.draftText === "string") return payload.draftText;
    if (typeof payload.publisherText === "string") return payload.publisherText;
    if (typeof payload.text === "string") return payload.text;
    if (Array.isArray(payload.sections)) {
      return payload.sections
        .map((sec) => {
          const title = sec.generatorTitle || sec.title || "Section";
          const body = sec.originalContent || sec.content || (sec.lines || []).join("\n") || "";
          return `[Section: ${title}]\n${body}`;
        })
        .join("\n\n");
    }
    return "";
  }

  function readAi4(workspace) {
    if (!workspace || typeof workspace !== "object") return null;
    if (workspace.editorialIntelligence && typeof workspace.editorialIntelligence === "object") {
      return workspace.editorialIntelligence;
    }
    const payload = workspace.draft && workspace.draft.payload;
    if (payload && payload.editorialIntelligence && typeof payload.editorialIntelligence === "object") {
      return payload.editorialIntelligence;
    }
    return null;
  }

  function emptyGroups() {
    return { Critical: [], High: [], Medium: [], Low: [] };
  }

  function pushIssue(groups, issue) {
    const severity = normalizeSeverity(issue.severity);
    groups[severity].push({
      id: issue.id || `${severity}-${groups[severity].length + 1}`,
      severity,
      code: issue.code || null,
      message: issue.message || issue.title || "Issue",
      detail: issue.detail || null,
      sectionType: issue.sectionType || null,
      sectionKey: issue.sectionKey || issue.sectionType || null,
      highlight: issue.highlight || issue.message || null
    });
  }

  function buildChecklistFromAi4(ai4) {
    const completeness = ai4.completeness || {};
    const presentSet = new Set((completeness.present || []).map((p) => p.sectionType));
    const emptySet = new Set((completeness.empty || []).map((p) => p.sectionType));
    const missingSet = new Set((completeness.missing || []).map((p) => p.sectionType));
    const issueSectionTypes = new Set();

    for (const issue of (ai4.validationIssues && ai4.validationIssues.issues) || []) {
      if (issue.sectionType) issueSectionTypes.add(issue.sectionType);
    }
    for (const item of (ai4.missingInformation && ai4.missingInformation.items) || []) {
      if (item.sectionType) issueSectionTypes.add(item.sectionType);
    }

    return CHECKLIST_ITEMS.map((item) => {
      let status = CHECKLIST_STATUS.MISSING;
      if (presentSet.has(item.sectionType)) {
        status =
          issueSectionTypes.has(item.sectionType) || emptySet.has(item.sectionType)
            ? CHECKLIST_STATUS.NEEDS_REVIEW
            : CHECKLIST_STATUS.COMPLETE;
      } else if (emptySet.has(item.sectionType)) {
        status = CHECKLIST_STATUS.NEEDS_REVIEW;
      } else if (missingSet.has(item.sectionType)) {
        status = CHECKLIST_STATUS.MISSING;
      }
      return {
        id: item.id,
        label: item.label,
        sectionType: item.sectionType,
        status
      };
    });
  }

  function buildChecklistFromPi1(sections) {
    const byKey = new Map();
    (sections || []).forEach((sec) => {
      if (sec.key) byKey.set(sec.key, sec);
    });
    return CHECKLIST_ITEMS.map((item) => {
      const sec = byKey.get(item.sectionType);
      if (!sec) return { id: item.id, label: item.label, sectionType: item.sectionType, status: CHECKLIST_STATUS.MISSING };
      if (sec.completion === "empty" || !toText(sec.body).trim()) {
        return { id: item.id, label: item.label, sectionType: item.sectionType, status: CHECKLIST_STATUS.MISSING };
      }
      if (sec.completion === "needs_attention" || (sec.confidence != null && sec.confidence < 0.5)) {
        return { id: item.id, label: item.label, sectionType: item.sectionType, status: CHECKLIST_STATUS.NEEDS_REVIEW };
      }
      return { id: item.id, label: item.label, sectionType: item.sectionType, status: CHECKLIST_STATUS.COMPLETE };
    });
  }

  function buildIssuesFromAi4(ai4) {
    const groups = emptyGroups();
    let idx = 0;
    for (const issue of (ai4.validationIssues && ai4.validationIssues.issues) || []) {
      pushIssue(groups, {
        id: `val-${++idx}`,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        sectionType: issue.sectionType,
        highlight: issue.message
      });
    }
    for (const item of (ai4.missingInformation && ai4.missingInformation.items) || []) {
      pushIssue(groups, {
        id: `miss-${++idx}`,
        severity: item.severity,
        code: item.code,
        message: item.message,
        sectionType: item.sectionType,
        highlight: item.message
      });
    }
    return groups;
  }

  function buildIssuesFromPi1(report) {
    const groups = emptyGroups();
    let idx = 0;
    const buckets = [
      { key: "errors", severity: "High" },
      { key: "warnings", severity: "Medium" },
      { key: "info", severity: "Low" }
    ];
    const categories = (report && report.categories) || {};
    Object.keys(categories).forEach((catKey) => {
      const rows = categories[catKey] || [];
      rows.forEach((row) => {
        const severity =
          row.severity === "error" ? "High" : row.severity === "warning" ? "Medium" : normalizeSeverity(row.severity) || "Low";
        pushIssue(groups, {
          id: `pi1-${++idx}`,
          severity: severity === "error" ? "High" : severity,
          code: row.code || catKey,
          message: row.message || row.label || catKey,
          sectionType: row.sectionKey || null,
          sectionKey: row.sectionKey || null,
          highlight: row.message || row.label
        });
      });
    });
    if (!Object.keys(categories).length && report) {
      buckets.forEach((b) => {
        ((report[b.key] || report.items || [])).forEach(() => {});
      });
    }
    return groups;
  }

  function buildSuggestionsFromAi4(ai4) {
    return ((ai4 && ai4.editorSuggestions) || []).map((s, i) => ({
      id: s.id || `sug-${i + 1}`,
      type: s.type || "advice",
      severity: normalizeSeverity(s.severity),
      title: s.title || "Suggestion",
      detail: s.detail || "",
      sectionType: s.sectionType || null,
      advisoryOnly: true,
      appliesChanges: false
    }));
  }

  function buildSuggestionsFromPi1(suggestions) {
    return (suggestions || []).map((s, i) => ({
      id: s.id || `pi1-sug-${i + 1}`,
      type: s.type || "advice",
      severity: normalizeSeverity(s.severity || s.priority || "Low"),
      title: s.title || s.message || "Suggestion",
      detail: s.detail || s.message || "",
      sectionType: s.sectionKey || null,
      advisoryOnly: true,
      appliesChanges: false
    }));
  }

  function buildLinkInspector(ai4, pi1Links) {
    const buckets = {};
    LINK_BUCKETS.forEach((b) => {
      buckets[b.id] = [];
    });

    const links = (ai4 && ai4.linkValidation && ai4.linkValidation.links) || pi1Links || [];
    links.forEach((link, i) => {
      const entry = {
        id: `link-${i + 1}`,
        label: link.label || link.text || "Link",
        url: link.url || link.href || "",
        category: link.category || link.categoryLabel || "other",
        sectionTitle: link.sectionTitle || null,
        broken: Boolean(link.broken),
        duplicate: Boolean(link.duplicate)
      };
      if (entry.broken) buckets.broken.push(entry);
      if (entry.duplicate) buckets.duplicate.push(entry);
      let placed = false;
      for (const bucket of LINK_BUCKETS) {
        if (!bucket.match) continue;
        if (bucket.match.test(String(entry.category))) {
          buckets[bucket.id].push(entry);
          placed = true;
          break;
        }
      }
      if (!placed && !entry.broken && !entry.duplicate) {
        buckets.official.push(entry);
      }
    });

    return {
      buckets,
      labels: LINK_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: buckets[b.id].length })),
      total: links.length
    };
  }

  function detectDuplicates(draftText, sections, ai4) {
    const result = {
      paragraphs: [],
      dates: [],
      links: [],
      faqs: []
    };

    const dateMap = new Map();
    const dateRe = /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g;
    const text = toText(draftText);
    let match;
    while ((match = dateRe.exec(text))) {
      const key = match[1].toLowerCase();
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    }
    dateMap.forEach((count, value) => {
      if (count > 1) result.dates.push({ value, count });
    });

    const paraMap = new Map();
    toText(draftText)
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length >= 40)
      .forEach((p) => {
        const key = p.toLowerCase();
        paraMap.set(key, (paraMap.get(key) || 0) + 1);
      });
    paraMap.forEach((count, value) => {
      if (count > 1) result.paragraphs.push({ value: value.slice(0, 160), count });
    });

    const linkDupes =
      (ai4 && ai4.linkValidation && ai4.linkValidation.duplicates) ||
      (ai4 &&
        ai4.validationIssues &&
        (ai4.validationIssues.issues || []).filter((i) => /duplicate_link/i.test(i.code || ""))) ||
      [];
    result.links = linkDupes.map((l, i) => ({
      id: `dup-link-${i + 1}`,
      value: l.url || l.message || "Duplicate link",
      count: 2
    }));

    const faqSection = (sections || []).find((s) => s.key === "faq" || s.sectionType === "faq");
    if (faqSection) {
      const qMap = new Map();
      toText(faqSection.body || faqSection.content || "")
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => /^q\s*[:.)]/i.test(l) || /\?$/.test(l))
        .forEach((q) => {
          const key = q.toLowerCase();
          qMap.set(key, (qMap.get(key) || 0) + 1);
        });
      qMap.forEach((count, value) => {
        if (count > 1) result.faqs.push({ value: value.slice(0, 160), count });
      });
    }

    // Surface AI-4 duplicate date validation when present
    for (const issue of (ai4 && ai4.validationIssues && ai4.validationIssues.issues) || []) {
      if (/duplicate_date/i.test(issue.code || "") || /duplicate.?date/i.test(issue.message || "")) {
        result.dates.push({ value: issue.message, count: 2, fromAi4: true });
      }
    }

    return result;
  }

  function buildSections(ai4, pi1Sections) {
    if (pi1Sections && pi1Sections.length) {
      return pi1Sections.map((sec, i) => {
        const issues = [];
        return {
          id: sec.id || `sec-${i + 1}`,
          key: sec.key || sec.sectionType || "unknown",
          title: sec.title || sec.label || "Section",
          sectionType: sec.key || sec.sectionType || null,
          confidence: Number.isFinite(sec.confidence) ? sec.confidence : null,
          confidenceBand: sec.confidenceBand || (Number.isFinite(sec.confidence) ? scoreBand(sec.confidence * 100) : "low"),
          issueCount: Number(sec.issueCount) || 0,
          completion: sec.completion || "complete",
          body: sec.body || "",
          issues
        };
      });
    }

    const present = (ai4 && ai4.completeness && ai4.completeness.present) || [];
    const empty = (ai4 && ai4.completeness && ai4.completeness.empty) || [];
    const missing = (ai4 && ai4.completeness && ai4.completeness.missing) || [];
    const issueCountByType = {};
    for (const issue of (ai4 && ai4.validationIssues && ai4.validationIssues.issues) || []) {
      if (!issue.sectionType) continue;
      issueCountByType[issue.sectionType] = (issueCountByType[issue.sectionType] || 0) + 1;
    }
    for (const item of (ai4 && ai4.missingInformation && ai4.missingInformation.items) || []) {
      if (!item.sectionType) continue;
      issueCountByType[item.sectionType] = (issueCountByType[item.sectionType] || 0) + 1;
    }

    const rows = [];
    present.forEach((p, i) => {
      const issueCount = issueCountByType[p.sectionType] || 0;
      rows.push({
        id: `sec-p-${i + 1}`,
        key: p.sectionType,
        title: p.title || p.sectionType,
        sectionType: p.sectionType,
        confidence: null,
        confidenceBand: issueCount ? "medium" : "high",
        issueCount,
        completion: issueCount ? "needs_attention" : "complete",
        body: "",
        issues: []
      });
    });
    empty.forEach((p, i) => {
      rows.push({
        id: `sec-e-${i + 1}`,
        key: p.sectionType,
        title: p.title || p.sectionType,
        sectionType: p.sectionType,
        confidence: 0.2,
        confidenceBand: "low",
        issueCount: issueCountByType[p.sectionType] || 1,
        completion: "needs_attention",
        body: "",
        issues: []
      });
    });
    missing.forEach((p, i) => {
      rows.push({
        id: `sec-m-${i + 1}`,
        key: p.sectionType,
        title: p.title || p.sectionType,
        sectionType: p.sectionType,
        confidence: 0,
        confidenceBand: "low",
        issueCount: issueCountByType[p.sectionType] || 1,
        completion: "empty",
        body: "",
        issues: []
      });
    });
    return rows;
  }

  function buildDashboard(ai4, pi1Summary, checklist, issueGroups) {
    const summary = (ai4 && ai4.editorSummary) || {};
    const scores = (ai4 && ai4.qualityScores) || {};
    const confidence = (ai4 && ai4.confidence) || summary.confidence || {};
    const overall =
      (summary.overallQuality && summary.overallQuality.score) != null
        ? summary.overallQuality.score
        : scores.overall && scores.overall.score != null
          ? scores.overall.score
          : pi1Summary && pi1Summary.qualityScore != null
            ? pi1Summary.qualityScore
            : 0;

    const completeness =
      scores.completeness && scores.completeness.score != null
        ? scores.completeness.score
        : ai4 && ai4.completeness
          ? ai4.completeness.percentage
          : checklist.filter((c) => c.status === CHECKLIST_STATUS.COMPLETE).length * (100 / CHECKLIST_ITEMS.length);

    const consistency =
      scores.consistency && scores.consistency.score != null
        ? scores.consistency.score
        : clamp(100 - (issueGroups.Critical.length * 20 + issueGroups.High.length * 10 + issueGroups.Medium.length * 4), 0, 100);

    const confidencePct =
      confidence.score != null
        ? round(Number(confidence.score) <= 1 ? Number(confidence.score) * 100 : Number(confidence.score), 0)
        : pi1Summary && pi1Summary.confidenceBreakdown
          ? round(
              ((pi1Summary.confidenceBreakdown.high || 0) * 100 +
                (pi1Summary.confidenceBreakdown.medium || 0) * 65 +
                (pi1Summary.confidenceBreakdown.low || 0) * 30) /
                Math.max(
                  1,
                  (pi1Summary.confidenceBreakdown.high || 0) +
                    (pi1Summary.confidenceBreakdown.medium || 0) +
                    (pi1Summary.confidenceBreakdown.low || 0)
                ),
              0
            )
          : round(overall, 0);

    const effort =
      summary.estimatedManualEditingEffort ||
      (pi1Summary && pi1Summary.editMinutes != null
        ? pi1Summary.editMinutes <= 5
          ? "minimal"
          : pi1Summary.editMinutes <= 15
            ? "light"
            : pi1Summary.editMinutes <= 30
              ? "moderate"
              : "substantial"
        : issueGroups.Critical.length
          ? "heavy"
          : issueGroups.High.length
            ? "moderate"
            : "light");

    let readiness = READINESS.EMPTY;
    if (overall > 0 || checklist.some((c) => c.status !== CHECKLIST_STATUS.MISSING)) {
      if (issueGroups.Critical.length) readiness = READINESS.BLOCKED;
      else if (issueGroups.High.length || checklist.some((c) => c.status === CHECKLIST_STATUS.MISSING)) {
        readiness = READINESS.NEEDS_WORK;
      } else readiness = READINESS.READY;
    }

    return {
      overallQuality: round(Number(overall) || 0, 0),
      overallLevel: (summary.overallQuality && summary.overallQuality.level) || levelFromScore100(overall),
      completeness: round(Number(completeness) || 0, 0),
      consistency: round(Number(consistency) || 0, 0),
      confidence: confidencePct,
      confidenceLevel: confidence.level || levelFromScore100(confidencePct),
      estimatedEditingEffort: effort,
      readiness,
      briefing: summary.briefing || null,
      advisoryOnly: true
    };
  }

  function buildDraftHealth(ai4, dashboard, issueGroups, duplicates, linkInspector) {
    const scores = (ai4 && ai4.qualityScores) || {};
    const missingCount =
      (ai4 && ai4.missingInformation && ai4.missingInformation.items && ai4.missingInformation.items.length) ||
      issueGroups.Critical.length + issueGroups.High.length;
    const validationTotal =
      (ai4 && ai4.validationIssues && ai4.validationIssues.counts && ai4.validationIssues.counts.total) ||
      SEVERITY_ORDER.reduce((n, s) => n + issueGroups[s].length, 0);

    function card(id, label, score, detail) {
      return {
        id,
        label,
        score: round(Number(score) || 0, 0),
        band: scoreBand(score),
        detail: detail || ""
      };
    }

    return [
      card("overall", "Overall Quality", dashboard.overallQuality, dashboard.overallLevel),
      card(
        "missing",
        "Missing Information",
        clamp(100 - missingCount * 12, 0, 100),
        missingCount ? `${missingCount} gap(s)` : "No gaps flagged"
      ),
      card(
        "validation",
        "Validation Issues",
        clamp(100 - validationTotal * 8, 0, 100),
        validationTotal ? `${validationTotal} issue(s)` : "Clean"
      ),
      card(
        "links",
        "Link Quality",
        scores.linkQuality && scores.linkQuality.score != null
          ? scores.linkQuality.score
          : clamp(100 - (linkInspector.buckets.broken.length * 20 + linkInspector.buckets.duplicate.length * 10), 0, 100),
        `${linkInspector.total} link(s)`
      ),
      card(
        "structure",
        "Structure",
        scores.structure && scores.structure.score != null ? scores.structure.score : dashboard.completeness,
        scores.structure && scores.structure.explanation ? scores.structure.explanation : "Section coverage"
      ),
      card(
        "readability",
        "Readability",
        scores.readability && scores.readability.score != null
          ? scores.readability.score
          : clamp(100 - duplicates.paragraphs.length * 10, 40, 100),
        scores.readability && scores.readability.explanation ? scores.readability.explanation : "Language & repetition"
      )
    ];
  }

  /**
   * Presentation-only change summary between two draft text snapshots.
   * @param {string} previousText
   * @param {string} currentText
   */
  function buildChangeSummary(previousText, currentText) {
    const gw = getGw();
    const prevSections = gw && typeof gw.parseWorkspaceSections === "function"
      ? gw.parseWorkspaceSections(previousText || "")
      : [];
    const nextSections = gw && typeof gw.parseWorkspaceSections === "function"
      ? gw.parseWorkspaceSections(currentText || "")
      : [];

    const prevMap = new Map(prevSections.map((s) => [s.key || s.title, s]));
    const nextMap = new Map(nextSections.map((s) => [s.key || s.title, s]));

    const added = [];
    const removed = [];
    const modified = [];

    nextMap.forEach((sec, key) => {
      if (!prevMap.has(key)) {
        added.push({ key, title: sec.title || key });
        return;
      }
      const before = toText(prevMap.get(key).body).trim();
      const after = toText(sec.body).trim();
      if (before !== after) modified.push({ key, title: sec.title || key });
    });
    prevMap.forEach((sec, key) => {
      if (!nextMap.has(key)) removed.push({ key, title: sec.title || key });
    });

    return {
      added,
      modified,
      removed,
      hasChanges: Boolean(added.length || modified.length || removed.length),
      presentationOnly: true
    };
  }

  function flattenIssues(groups) {
    const list = [];
    SEVERITY_ORDER.forEach((sev) => {
      (groups[sev] || []).forEach((issue) => list.push(issue));
    });
    return list;
  }

  /**
   * Build the full PI-2 presentation model from an editorial workspace payload.
   * @param {object} workspace
   * @param {{ previousDraftText?: string }} [options]
   */
  function analyzeEditorialWorkspace(workspace, options) {
    const opts = options || {};
    const ai4 = readAi4(workspace);
    const draftText = extractDraftText(workspace);
    const gw = getGw();
    let pi1 = null;
    const hasDraft = Boolean(workspace && workspace.draft);
    if (hasDraft && gw && typeof gw.analyzeWorkspace === "function") {
      pi1 = gw.analyzeWorkspace({
        editorText: draftText,
        aiPayload: workspace && workspace.draft && workspace.draft.payload
      });
    }

    const checklist = ai4 ? buildChecklistFromAi4(ai4) : buildChecklistFromPi1((pi1 && pi1.sections) || []);
    const issueGroups = ai4 ? buildIssuesFromAi4(ai4) : buildIssuesFromPi1((pi1 && pi1.report) || {});
    const suggestions = ai4
      ? buildSuggestionsFromAi4(ai4)
      : buildSuggestionsFromPi1((pi1 && pi1.suggestions && pi1.suggestions.items) || (pi1 && pi1.suggestions) || []);

    // Ensure advisory invariant
    suggestions.forEach((s) => {
      s.advisoryOnly = true;
      s.appliesChanges = false;
      delete s.replacement;
      delete s.patch;
      delete s.apply;
      delete s.newText;
    });

    const sections = buildSections(ai4, (pi1 && pi1.sections) || []);
    // Attach issue counts onto sections when missing
    const flat = flattenIssues(issueGroups);
    sections.forEach((sec) => {
      if (sec.issueCount) return;
      sec.issueCount = flat.filter(
        (i) => i.sectionType === sec.sectionType || i.sectionKey === sec.key
      ).length;
    });

    const pi1Links = [];
    if (pi1 && pi1.sections) {
      pi1.sections.forEach((sec) => {
        if (gw && typeof gw.extractLinks === "function") {
          gw.extractLinks(sec.body || "").forEach((link) => {
            pi1Links.push({
              label: link.label || link.text || "Link",
              url: link.url,
              category: "other",
              broken: link.ok === false,
              duplicate: false,
              sectionTitle: sec.title
            });
          });
        }
      });
    }

    const linkInspector = buildLinkInspector(ai4, pi1Links);
    const duplicates = detectDuplicates(draftText, sections, ai4);
    const dashboard = buildDashboard(ai4, (pi1 && pi1.summary) || null, checklist, issueGroups);
    const draftHealth = buildDraftHealth(ai4, dashboard, issueGroups, duplicates, linkInspector);
    const changeSummary = buildChangeSummary(opts.previousDraftText || "", draftText);

    return {
      version: CORE_VERSION,
      source: ai4 ? "ai4" : pi1 ? "pi1-fallback" : "empty",
      hasDraft: Boolean(workspace && workspace.draft),
      draftText,
      dashboard,
      checklist,
      issueGroups,
      issues: flat,
      suggestions,
      sections,
      draftHealth,
      linkInspector,
      duplicates,
      changeSummary,
      editorialIntelligence: ai4,
      advisoryOnly: true,
      appliesChanges: false
    };
  }

  return {
    CORE_VERSION,
    CHECKLIST_ITEMS,
    CHECKLIST_STATUS,
    SEVERITY_ORDER,
    LINK_BUCKETS,
    READINESS,
    extractDraftText,
    readAi4,
    buildChangeSummary,
    analyzeEditorialWorkspace,
    flattenIssues,
    normalizeSeverity,
    scoreBand
  };
});
