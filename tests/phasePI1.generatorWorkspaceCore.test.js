/**
 * Phase PI-1 — Smart Generator Experience.
 * Unit tests for the advisory analysis core shared by the browser workspace UI.
 */
const core = require("../public/assets/js/generator-workspace-core.js");

const SAMPLE = [
  "[Section: ShortInfo]",
  "UP Police Constable Recruitment 2026 notification for 35260 constable posts.",
  "UP Police Constable Recruitment 2026 notification for 35260 constable posts.",
  "",
  "[Section: ImportantDates]",
  "Application Start Date: 04 September 2026",
  "Last Date: 30 September 2026",
  "",
  "[Section: Vacancy]",
  "Post,Category,Total",
  "Constable,UR,17000",
  "Constable,OBC,9500",
  "",
  "[Section: ImportantLinks]",
  "Apply Online=https://uppbpb.gov.in/apply",
  "Notification=htp:/broken",
  "",
  "[Section: Eligibility]",
  "—"
].join("\n");

describe("PI-1 section parsing", () => {
  test("splits publisher text into sections with usable offsets", () => {
    const sections = core.parseWorkspaceSections(SAMPLE);
    expect(sections).toHaveLength(5);
    expect(sections.map((s) => s.key)).toEqual([
      "short_information",
      "important_dates",
      "vacancy_details",
      "important_links",
      "eligibility"
    ]);
    // Offsets must address the real slice of the textarea value.
    const first = sections[0];
    expect(SAMPLE.slice(first.headerStart, first.bodyStart)).toContain("[Section: ShortInfo]");
    expect(SAMPLE.slice(first.bodyStart, first.bodyEnd)).toContain("35260 constable posts");
  });

  test("returns an empty list for unstructured or blank text", () => {
    expect(core.parseWorkspaceSections("")).toEqual([]);
    expect(core.parseWorkspaceSections("   \n  ")).toEqual([]);
    expect(core.parseWorkspaceSections("just some raw pdf text with no markers")).toEqual([]);
  });

  test("maps heading aliases and preserves unknown headings", () => {
    const sections = core.parseWorkspaceSections(
      "[Section: Key Dates]\n01 Jan 2026\n\n[Section: Departmental Notes]\nsomething"
    );
    expect(sections[0].key).toBe("important_dates");
    expect(sections[0].label).toBe("Important Dates");
    expect(sections[1].key).toBe("unknown");
    expect(sections[1].isKnownSection).toBe(false);
    expect(sections[1].label).toBe("Departmental Notes");
  });

  test("placeholder-only bodies are flagged empty", () => {
    const [section] = core.parseWorkspaceSections("[Section: Eligibility]\n—\n-\n");
    expect(section.isEmpty).toBe(true);
    expect(section.contentLineCount).toBe(0);
  });
});

describe("PI-1 link detection", () => {
  test("reads Label=URL, markdown and bare URL syntaxes", () => {
    const links = core.extractLinks(
      [
        "Apply Online=https://example.gov.in/apply",
        "See [official notice](https://example.gov.in/notice.pdf) for details",
        "Visit www.example.gov.in today"
      ].join("\n")
    );
    expect(links.map((l) => l.url)).toEqual([
      "https://example.gov.in/apply",
      "https://example.gov.in/notice.pdf",
      "www.example.gov.in"
    ]);
    expect(links.every((l) => l.ok)).toBe(true);
  });

  test("flags malformed URLs without flagging valid relative paths", () => {
    expect(core.validateUrlValue("https://example.gov.in/x").ok).toBe(true);
    expect(core.validateUrlValue("/pages/local.html").ok).toBe(true);
    expect(core.validateUrlValue("htp:/broken").ok).toBe(false);
    expect(core.validateUrlValue("—").ok).toBe(false);
    expect(core.validateUrlValue("https://").ok).toBe(false);
  });

  test("does not treat plain key:value lines as links", () => {
    const links = core.extractLinks("Age Limit: 18-25 years\nTotal Posts=35260");
    expect(links).toHaveLength(0);
  });
});

describe("PI-1 confidence scoring", () => {
  test("bands split on the documented thresholds", () => {
    expect(core.confidenceBand(0.9)).toBe("high");
    expect(core.confidenceBand(0.75)).toBe("high");
    expect(core.confidenceBand(0.6)).toBe("medium");
    expect(core.confidenceBand(0.5)).toBe("medium");
    expect(core.confidenceBand(0.2)).toBe("low");
    expect(core.confidenceBand(undefined)).toBe("low");
  });

  test("server validation scores win over local heuristics", () => {
    const parsed = core.parseWorkspaceSections("[Section: ImportantDates]\n04 September 2026\nLast Date: 30 September 2026");
    const scored = core.applyConfidence(parsed, {
      validation: { sections: [{ title: "ImportantDates", confidence: 0.93, issues: [] }] }
    });
    expect(scored[0].confidence).toBe(0.93);
    expect(scored[0].confidenceSource).toBe("server");
    expect(scored[0].confidenceBand).toBe("high");
  });

  test("falls back to heuristics when the server sent nothing", () => {
    const parsed = core.parseWorkspaceSections("[Section: ImportantDates]\nLast Date: 30 September 2026\nExam: 12 October 2026");
    const scored = core.applyConfidence(parsed, null);
    expect(scored[0].confidenceSource).toBe("heuristic");
    expect(scored[0].confidence).toBeGreaterThan(0.5);
  });

  test("an emptied section can never report high confidence", () => {
    const parsed = core.parseWorkspaceSections("[Section: ImportantDates]\n—");
    const scored = core.applyConfidence(parsed, {
      validation: { sections: [{ title: "ImportantDates", confidence: 0.98, issues: [] }] }
    });
    expect(scored[0].confidence).toBeLessThanOrEqual(0.2);
    expect(scored[0].confidenceBand).toBe("low");
  });
});

describe("PI-1 validation report", () => {
  const analysis = core.analyzeWorkspace({ editorText: SAMPLE });

  test("detects duplicate content across the document", () => {
    expect(analysis.report.duplicates.length).toBeGreaterThan(0);
    expect(analysis.report.duplicates[0].count).toBe(2);
    expect(analysis.report.duplicates[0].text).toContain("35260 constable posts");
  });

  test("detects broken links but keeps valid ones quiet", () => {
    expect(analysis.report.brokenLinks).toHaveLength(1);
    expect(analysis.report.brokenLinks[0].url).toBe("htp:/broken");
  });

  test("reports empty sections and recommended gaps", () => {
    expect(analysis.report.emptySections.map((s) => s.label)).toContain("Eligibility");
    const recommended = analysis.report.recommendedMissing.map((r) => r.key);
    expect(recommended).toContain("selection_process");
    expect(recommended).not.toContain("vacancy_details");
  });

  test("flags required sections that are absent entirely", () => {
    const report = core.analyzeWorkspace({ editorText: "[Section: Salary]\nRs 21700 per month" }).report;
    const missing = report.missingSections.map((m) => m.key);
    expect(missing).toEqual(["short_information", "important_dates", "important_links"]);
    expect(report.ok).toBe(false);
  });

  test("a clean document reports no errors", () => {
    const clean = core.analyzeWorkspace({
      editorText: [
        "[Section: ShortInfo]",
        "SSC CGL 2026 recruitment for graduate level posts across departments.",
        "",
        "[Section: ImportantDates]",
        "Apply Start Date: 04 September 2026",
        "Last Date: 30 September 2026",
        "",
        "[Section: ImportantLinks]",
        "Apply Online=https://ssc.gov.in/apply"
      ].join("\n")
    });
    expect(clean.report.ok).toBe(true);
    expect(clean.report.errorCount).toBe(0);
  });
});

describe("PI-1 OCR issue detection", () => {
  test("surfaces the OCR note as advisory info", () => {
    const issues = core.detectOcrIssues("A reasonably long block of extracted notification text. ".repeat(12), {
      extractionNote: "OCR eng+hin (pehli 15 pages)"
    });
    expect(issues.some((i) => i.code === "ocr_used" && i.severity === "info")).toBe(true);
  });

  test("detects letter-spaced garbage output", () => {
    const issues = core.detectOcrIssues("U P P O L I C E C O N S T A B L E R E C R U I T M E N T N O T I C E ".repeat(6));
    expect(issues.some((i) => i.code === "ocr_letter_spacing")).toBe(true);
  });

  test("detects unreadable replacement characters", () => {
    const issues = core.detectOcrIssues(`Recruitment \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD notice text for candidates`);
    expect(issues.some((i) => i.code === "ocr_unreadable_chars")).toBe(true);
  });

  test("stays silent on clean text", () => {
    const clean = "Uttar Pradesh Police Recruitment Board invites online applications from eligible candidates. ".repeat(8);
    expect(core.detectOcrIssues(clean, null)).toEqual([]);
  });
});

describe("PI-1 generator summary", () => {
  test("counts sections, tables and links", () => {
    const { summary } = core.analyzeWorkspace({ editorText: SAMPLE });
    expect(summary.sectionsDetected).toBe(5);
    expect(summary.tablesDetected).toBe(1);
    expect(summary.linksDetected).toBe(2);
    expect(summary.brokenLinks).toBe(1);
    expect(summary.emptySections).toBe(1);
  });

  test("estimated edit time grows with problems and is never zero for real content", () => {
    const { summary } = core.analyzeWorkspace({ editorText: SAMPLE });
    expect(summary.estimatedEditMinutes).toBeGreaterThan(0);

    const messy = core.analyzeWorkspace({
      editorText: SAMPLE + "\n\n[Section: Syllabus]\n—\n\n[Section: Helpline]\n—"
    });
    expect(messy.summary.estimatedEditMinutes).toBeGreaterThanOrEqual(summary.estimatedEditMinutes);
  });

  test("quality score is bounded and labelled", () => {
    const { summary } = core.analyzeWorkspace({ editorText: SAMPLE });
    expect(summary.qualityScore).toBeGreaterThanOrEqual(0);
    expect(summary.qualityScore).toBeLessThanOrEqual(100);
    expect(["Excellent", "Good", "Needs review", "Needs work"]).toContain(summary.qualityLabel);
  });

  test("empty editor yields an empty, non-crashing analysis", () => {
    const out = core.analyzeWorkspace({ editorText: "" });
    expect(out.hasContent).toBe(false);
    expect(out.isStructured).toBe(false);
    expect(out.summary.sectionsDetected).toBe(0);
    expect(out.summary.estimatedEditMinutes).toBe(0);
    expect(out.suggestions.length).toBeGreaterThanOrEqual(0);
  });
});

describe("PI-1 suggestions are advisory only", () => {
  test("suggestions describe actions without carrying replacement content", () => {
    const { suggestions } = core.analyzeWorkspace({ editorText: SAMPLE });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(typeof s.title).toBe("string");
      expect(typeof s.detail).toBe("string");
      // No auto-apply payload may ever be present.
      expect(s.replacement).toBeUndefined();
      expect(s.patch).toBeUndefined();
      expect(s.apply).toBeUndefined();
      expect(s.newText).toBeUndefined();
    }
  });

  test("analysis never mutates the text it was given", () => {
    const original = SAMPLE;
    const copy = String(SAMPLE);
    core.analyzeWorkspace({ editorText: copy, extractedText: copy });
    expect(copy).toBe(original);
  });

  test("broken links and missing sections are prioritised first", () => {
    const { suggestions } = core.analyzeWorkspace({ editorText: SAMPLE });
    expect(suggestions[0].priority).toBe(1);
  });
});

describe("PI-1 source matching for split view", () => {
  const source =
    "Government of Uttar Pradesh\nUP Police Constable Recruitment 2026 notification for 35260 constable posts.\nApplication Start Date: 04 September 2026";

  test("locates a section body inside the raw extracted text", () => {
    const match = core.findSourceMatch(
      "UP Police Constable Recruitment 2026 notification for 35260 constable posts.",
      source
    );
    expect(match).not.toBeNull();
    expect(source.slice(match.start, match.end)).toContain("35260 constable posts");
    expect(match.score).toBeGreaterThan(0);
  });

  test("returns null when nothing matches", () => {
    expect(core.findSourceMatch("Completely unrelated content here", source)).toBeNull();
    expect(core.findSourceMatch("anything", "")).toBeNull();
  });
});

describe("PI-1 friendly extraction errors", () => {
  test("maps transport and auth failures", () => {
    expect(core.describeExtractionError({ networkError: true }).code).toBe("network");
    expect(core.describeExtractionError({ status: 401 }).code).toBe("auth");
    expect(core.describeExtractionError({ status: 429 }).code).toBe("rate_limited");
  });

  test("explains oversized uploads with the actual size", () => {
    const err = core.describeExtractionError({ status: 413, fileSizeBytes: 12 * 1024 * 1024 });
    expect(err.code).toBe("too_large");
    expect(err.message).toContain("12.0 MB");
    expect(err.retryable).toBe(false);
  });

  test("recognises OCR and missing-text-layer failures from backend messages", () => {
    const ocr = core.describeExtractionError({
      status: 500,
      message: "PDF extraction failed: Scanned ya image PDF ho sakti hai — OCR abhi pura text nahi nikal paya."
    });
    expect(ocr.code).toBe("ocr_failed");

    const short = core.describeExtractionError({
      status: 500,
      message: "PDF extraction failed: PDF ka text properly read nahi ho paya"
    });
    expect(short.code).toBe("no_text");
  });

  test("every mapped error carries a title, message and actionable hint", () => {
    const cases = [
      { networkError: true },
      { status: 401 },
      { status: 413 },
      { status: 429 },
      { status: 400, message: "Sirf PDF allowed hai." },
      { status: 500, code: "OCR_FAILED" },
      { status: 500, code: "TEXT_TOO_SHORT" },
      { status: 500, code: "INVALID_PDF" },
      { status: 502, contentType: "text/html" },
      { status: 500 },
      {}
    ];
    for (const c of cases) {
      const out = core.describeExtractionError(c);
      expect(out.title).toBeTruthy();
      expect(out.message).toBeTruthy();
      expect(out.hint).toBeTruthy();
      expect(typeof out.retryable).toBe("boolean");
    }
  });
});

describe("PI-1 performance budget", () => {
  /** Build a document far larger than a real recruitment notification. */
  function buildLargeDocument(sectionCount) {
    const parts = [];
    for (let i = 0; i < sectionCount; i++) {
      parts.push(`[Section: ${i % 2 ? "Important Instructions" : "Selection Process"} ${i}]`);
      for (let line = 0; line < 25; line++) {
        parts.push(`Line ${line} of section ${i}: candidates must read the official notification carefully before applying.`);
      }
      parts.push("Apply Online=https://example.gov.in/apply?section=" + i, "");
    }
    return parts.join("\n");
  }

  test("a typical notification analyses in a few milliseconds", () => {
    const started = process.hrtime.bigint();
    for (let i = 0; i < 20; i++) core.analyzeWorkspace({ editorText: SAMPLE, extractedText: SAMPLE });
    const perRunMs = Number(process.hrtime.bigint() - started) / 1e6 / 20;
    console.log(`[PI-1 perf] typical document: ${perRunMs.toFixed(2)} ms/analysis`);
    expect(perRunMs).toBeLessThan(25);
  });

  test("an oversized document stays within the interaction budget", () => {
    const large = buildLargeDocument(60);
    expect(large.length).toBeGreaterThan(100000);

    const started = process.hrtime.bigint();
    const out = core.analyzeWorkspace({ editorText: large, extractedText: large });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`[PI-1 perf] ${large.length} chars / ${out.summary.sectionsDetected} sections: ${ms.toFixed(2)} ms`);

    expect(out.summary.sectionsDetected).toBe(60);
    // Well under a 16 ms frame budget is ideal, but the UI also debounces and
    // runs this in requestIdleCallback, so 250 ms is the hard ceiling.
    expect(ms).toBeLessThan(250);
  });

  test("source matching on a large PDF extract stays fast", () => {
    const large = buildLargeDocument(40);
    const [section] = core.parseWorkspaceSections(large);
    const started = process.hrtime.bigint();
    for (let i = 0; i < 50; i++) core.findSourceMatch(section.body, large);
    const perRunMs = Number(process.hrtime.bigint() - started) / 1e6 / 50;
    console.log(`[PI-1 perf] source match: ${perRunMs.toFixed(3)} ms/lookup`);
    expect(perRunMs).toBeLessThan(15);
  });
});

describe("PI-1 pipeline stage contract", () => {
  test("exposes the five documented stages in order", () => {
    expect(core.PIPELINE_STAGES.map((s) => s.id)).toEqual([
      "upload",
      "extraction",
      "conversion",
      "validation",
      "ready"
    ]);
    expect(core.PIPELINE_STAGES.map((s) => s.label)).toEqual([
      "Upload",
      "Extraction",
      "AI Conversion",
      "Validation",
      "Generator Ready"
    ]);
  });
});
