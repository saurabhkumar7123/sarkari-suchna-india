(function () {
  "use strict";

  const API_PATH = "/api/admin/recruitment-testing/analyze";
  const LOOKUP_API_PATH = "/api/admin/recruitment-testing/lookup-candidates";
  const SAVE_REVIEW_API_PATH = "/api/admin/recruitment-testing/save-review";
  const DEFAULT_CANDIDATES_JSON = "[]";
  const YEAR_PATTERN = /^(19|20)\d{2}$/;

  let lastAnalysis = null;

  function prettyJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function setError(message) {
    const errorEl = document.getElementById("analysisError");
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function setSaveMessage(message, tone) {
    const el = document.getElementById("saveReviewMessage");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-success", "is-error");
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle("is-success", tone === "success");
    el.classList.toggle("is-error", tone === "error");
  }

  function setSaveEnabled(enabled) {
    const btn = document.getElementById("saveReviewBtn");
    if (!btn) return;
    btn.disabled = !enabled;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validateYearField(value, fieldName, index) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 1900 || value > 9999) {
        throw new Error(
          `candidateRecruitments[${index}].${fieldName} must be a valid year between 1900 and 9999.`
        );
      }
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (!YEAR_PATTERN.test(trimmed)) {
        throw new Error(
          `candidateRecruitments[${index}].${fieldName} must be a valid four-digit year.`
        );
      }
      return trimmed;
    }
    throw new Error(
      `candidateRecruitments[${index}].${fieldName} must be a number or year string.`
    );
  }

  function validateCandidateObject(candidate, index) {
    if (!isPlainObject(candidate)) {
      throw new Error(`candidateRecruitments[${index}] must be an object.`);
    }

    if (candidate.id !== undefined && candidate.id !== null && candidate.id !== "") {
      const id = Number(candidate.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`candidateRecruitments[${index}].id must be a positive integer.`);
      }
    }

    validateYearField(candidate.cycle_year, "cycle_year", index);
    validateYearField(candidate.recruitment_year, "recruitment_year", index);

    const stringFields = [
      "department",
      "board",
      "organization",
      "post_name",
      "exam_name",
      "advertisement_no",
      "title",
      "slug"
    ];
    for (const field of stringFields) {
      if (
        candidate[field] !== undefined &&
        candidate[field] !== null &&
        typeof candidate[field] !== "string"
      ) {
        throw new Error(`candidateRecruitments[${index}].${field} must be a string.`);
      }
    }
  }

  function parseCandidateRecruitments(raw) {
    const text = String(raw ?? "").trim() || DEFAULT_CANDIDATES_JSON;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Candidate recruitments must be valid JSON.");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Candidate recruitments must be a JSON array.");
    }

    parsed.forEach((candidate, index) => {
      validateCandidateObject(candidate, index);
    });

    return parsed;
  }

  function renderMatchWarnings(summary) {
    const host = document.querySelector('[data-summary="matchWarnings"]');
    if (!host || !summary) return;
    host.innerHTML = "";

    const alerts = [];
    if (summary.warnings?.ambiguousMatch) {
      alerts.push({ label: "Ambiguous Match Warning", tone: "warning" });
    }
    if (summary.warnings?.noMatch) {
      alerts.push({ label: "No Match Warning", tone: "warning" });
    }
    if (summary.warnings?.noCandidates) {
      alerts.push({ label: "No Candidates Supplied", tone: "info" });
    }
    if (summary.warnings?.unknownMatch) {
      alerts.push({ label: "Unknown Match", tone: "info" });
    }

    for (const alert of alerts) {
      const el = document.createElement("span");
      el.className = `recruitment-testing-alert is-${alert.tone}`;
      el.textContent = alert.label;
      host.appendChild(el);
    }
  }

  function renderCandidateMatching(summary) {
    const card = document.querySelector('[data-result="candidateMatching"]');
    if (!card || !summary) return;

    const countValue = card.querySelector(
      '[data-summary="candidateCount"] .recruitment-testing-stat__value'
    );
    if (countValue) countValue.textContent = String(summary.candidateCount ?? 0);

    const selectedPre = card.querySelector('[data-summary="selectedCandidate"] pre');
    if (selectedPre) selectedPre.textContent = prettyJson(summary.selectedCandidate);

    const matchedSignalsPre = card.querySelector('[data-summary="matchedSignals"] pre');
    if (matchedSignalsPre) matchedSignalsPre.textContent = prettyJson(summary.matchedSignals || []);

    const conflictingSignalsPre = card.querySelector('[data-summary="conflictingSignals"] pre');
    if (conflictingSignalsPre) {
      conflictingSignalsPre.textContent = prettyJson(summary.conflictingSignals || []);
    }

    renderMatchWarnings(summary);

    const individualPre = card.querySelector("h3 + pre.recruitment-testing-json");
    if (individualPre) {
      individualPre.textContent = prettyJson(summary.individualMatchResults || []);
    }
  }

  function renderAnalysis(data) {
    const host = document.getElementById("analysisResults");
    if (!host) return;
    host.hidden = false;

    renderCandidateMatching(data.candidateMatching);

    const sections = {
      rawInput: data.rawInput,
      normalizedNotice: data.normalizedNotice,
      classification: data.classification,
      recruitmentMatching: data.recruitmentMatching,
      selectedMatch: data.selectedMatch,
      reviewItem: data.reviewItem,
      warnings: data.warnings,
      finalStatus: data.finalStatus,
      processorOutput: data.processorOutput
    };

    Object.entries(sections).forEach(([key, value]) => {
      const card = host.querySelector(`[data-result="${key}"] .recruitment-testing-json`);
      if (!card) return;
      if (key === "normalizedNotice") {
        card.textContent = typeof value === "string" ? value : prettyJson(value);
        return;
      }
      if (key === "finalStatus") {
        card.textContent = prettyJson({ status: value });
        return;
      }
      card.textContent = prettyJson(value);
    });

    lastAnalysis = data;
    setSaveEnabled(Boolean(data && data.reviewItem));
    setSaveMessage("");
  }

  function clearAnalysis() {
    document.getElementById("noticeTitle").value = "";
    document.getElementById("noticeContent").value = "";
    document.getElementById("noticeUrl").value = "";
    document.getElementById("candidateRecruitments").value = DEFAULT_CANDIDATES_JSON;
    const summary = document.getElementById("lookupSummary");
    if (summary) {
      summary.hidden = true;
      summary.textContent = "";
    }
    const host = document.getElementById("analysisResults");
    if (host) host.hidden = true;
    lastAnalysis = null;
    setSaveEnabled(false);
    setSaveMessage("");
    setError("");
  }

  function setLookupSummary(text) {
    const summary = document.getElementById("lookupSummary");
    if (!summary) return;
    if (!text) {
      summary.hidden = true;
      summary.textContent = "";
      return;
    }
    summary.hidden = false;
    summary.textContent = text;
  }

  function readNoticeFields() {
    return {
      title: document.getElementById("noticeTitle").value.trim(),
      content: document.getElementById("noticeContent").value.trim(),
      url: document.getElementById("noticeUrl").value.trim()
    };
  }

  async function runAutoLookup() {
    setError("");
    const notice = readNoticeFields();

    if (!notice.title && !notice.content && !notice.url) {
      setError("Enter at least one of title, content, or URL before Auto Lookup.");
      return;
    }

    const lookupBtn = document.getElementById("autoLookupBtn");
    if (lookupBtn) {
      lookupBtn.disabled = true;
      lookupBtn.textContent = "Looking up...";
    }

    try {
      const response = await window.adminSafeFetch(LOOKUP_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice })
      });

      if (!response || response.success !== true) {
        setError((response && response.message) || "Candidate lookup failed. Please try again.");
        return;
      }

      const candidates = Array.isArray(response.data?.candidates) ? response.data.candidates : [];
      const summary = response.data?.searchSummary || {};
      document.getElementById("candidateRecruitments").value = prettyJson(candidates);

      const criteria = summary.criteria
        ? `strategy=${summary.strategy || "n/a"}; org=${summary.criteria.organization || "-"}; exam=${summary.criteria.examName || "-"}; year=${summary.criteria.recruitmentYear || "-"}; advt=${summary.criteria.advertisementNo || "-"}`
        : `strategy=${summary.strategy || "n/a"}`;

      setLookupSummary(
        `Auto Lookup loaded ${candidates.length} candidate(s) (limit ${summary.limitedTo || 20}). ${criteria}`
      );
    } catch {
      setError("Candidate lookup failed. Please try again.");
    } finally {
      if (lookupBtn) {
        lookupBtn.disabled = false;
        lookupBtn.textContent = "Auto Lookup";
      }
    }
  }

  async function runAnalysis() {
    setError("");
    setSaveMessage("");
    const { title, content, url } = readNoticeFields();

    if (!title && !content && !url) {
      setError("Enter at least one of title, content, or URL.");
      return;
    }

    let candidateRecruitments = [];
    try {
      candidateRecruitments = parseCandidateRecruitments(
        document.getElementById("candidateRecruitments").value
      );
    } catch (error) {
      setError(error.message || "Invalid candidate recruitments JSON.");
      return;
    }

    const runBtn = document.getElementById("runAnalysisBtn");
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = "Running...";
    }

    try {
      const response = await window.adminSafeFetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          url,
          candidateRecruitments
        })
      });

      if (!response || response.success !== true) {
        setError((response && response.message) || "Analysis failed. Please try again.");
        lastAnalysis = null;
        setSaveEnabled(false);
        return;
      }

      renderAnalysis(response.data);
    } catch {
      setError("Analysis failed. Please try again.");
      lastAnalysis = null;
      setSaveEnabled(false);
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = "Run Analysis";
      }
    }
  }

  async function saveReviewItem() {
    setError("");
    setSaveMessage("");

    if (!lastAnalysis || !lastAnalysis.reviewItem) {
      setSaveMessage("Validation failed: run analysis successfully before saving.", "error");
      return;
    }

    const saveBtn = document.getElementById("saveReviewBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    try {
      const response = await window.adminSafeFetch(SAVE_REVIEW_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItem: lastAnalysis.reviewItem,
          raw_notice: lastAnalysis.rawInput?.notice || lastAnalysis.rawInput || null,
          normalized_notice: lastAnalysis.normalizedNotice || null,
          processor_output: lastAnalysis.processorOutput || null,
          finalStatus: lastAnalysis.finalStatus || null,
          warnings: lastAnalysis.warnings || []
        })
      });

      if (!response || response.success !== true) {
        setSaveMessage(response?.message || "Validation failed", "error");
        return;
      }

      const savedId = response.data && response.data.id ? ` (id ${response.data.id})` : "";
      setSaveMessage(`Saved successfully${savedId}`, "success");
    } catch {
      setSaveMessage("Validation failed", "error");
    } finally {
      if (saveBtn) {
        saveBtn.textContent = "Save Review Item";
        saveBtn.disabled = !lastAnalysis || !lastAnalysis.reviewItem;
      }
    }
  }

  document.getElementById("runAnalysisBtn")?.addEventListener("click", runAnalysis);
  document.getElementById("autoLookupBtn")?.addEventListener("click", runAutoLookup);
  document.getElementById("saveReviewBtn")?.addEventListener("click", saveReviewItem);
  document.getElementById("clearAnalysisBtn")?.addEventListener("click", clearAnalysis);
  setSaveEnabled(false);
})();
