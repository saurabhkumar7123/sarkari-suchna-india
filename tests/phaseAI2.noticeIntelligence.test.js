"use strict";

/**
 * Phase AI-2 — Government Website Intelligence & Event Classification tests.
 *
 * Covers UPPSC, SSC, Railway, UP Police, NTA, BPSC, AIIMS, DSSSB, BHU,
 * Hindi-heavy and mixed-language notices, corrections, results, admit cards,
 * extensions and press releases, plus backward compatibility with the existing
 * Production Workflow.
 */

const { NOTICES } = require("./fixtures/ai2/governmentNotices");
const {
  analyzeGovernmentNotice,
  enrichMonitoringEvent,
  analyzeContent,
  detectHeadings,
  normalizeHeading,
  parseNumbering,
  repairBrokenHeadings,
  buildHeadingTree,
  detectDepartment,
  extractReferences,
  parseDate,
  extractKeywords,
  assignPriority,
  buildConfidenceReport,
  buildFingerprint,
  validateNormalizedEvent,
  toWorkflowMonitoringEvent,
  readIntelligence,
  INTELLIGENCE_FIELD,
  EVENT_TYPES,
  PRIORITY_LEVELS,
  CANONICAL_SECTIONS,
  LANGUAGES,
  FORMAT_ID,
  ENGINE_VERSION
} = require("../server/lib/noticeIntelligence");

const {
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_STATUS,
  PUBLISHING_POLICY
} = require("../server/lib/productionWorkflow");
const telegramNotification = require("../server/lib/monitoringBot/telegramNotification");
const { getAutomationFlags } = require("../server/config/automationFlags");

const NOW = new Date("2026-07-26T00:00:00Z");

/**
 * @param {string} fixtureName
 * @returns {object}
 */
function analyze(fixtureName) {
  return analyzeGovernmentNotice(NOTICES[fixtureName], { now: NOW });
}

describe("Phase AI-2 content analysis", () => {
  test("parses HTML into text, headings, links and language", () => {
    const analysis = analyzeContent(NOTICES.UPPSC_NEW_RECRUITMENT);
    expect(analysis.sourceFormat).toBe("html");
    expect(analysis.htmlParsed).toBe(true);
    expect(analysis.text).toMatch(/Advertisement No\. A-1\/E-1\/2026/);
    expect(analysis.htmlHeadings.map((heading) => heading.text)).toEqual(
      expect.arrayContaining(["Uttar Pradesh Public Service Commission", "Important Dates"])
    );
    expect(analysis.links.some((link) => link.isPdf)).toBe(true);
    expect(analysis.language).toBe(LANGUAGES.ENGLISH);
  });

  test("accepts extracted PDF text and plain text sources", () => {
    const pdf = analyzeContent(NOTICES.PDF_BROKEN_HEADINGS);
    expect(pdf.sourceFormat).toBe("pdf");
    expect(pdf.lines.length).toBeGreaterThan(5);
    expect(pdf.text).not.toMatch(/Page 1 of 12/);

    const text = analyzeContent(NOTICES.SHORT_NOTICE_TEXT);
    expect(text.sourceFormat).toBe("text");
    expect(text.text).toMatch(/Short Notice/);
  });

  test("classifies Hindi and mixed Hindi-English content", () => {
    expect(analyzeContent(NOTICES.HINDI_HEAVY_RESULT).language).toBe(LANGUAGES.HINDI);
    expect(analyzeContent(NOTICES.MIXED_LANGUAGE_EXTENSION).language).toBe(LANGUAGES.MIXED);
  });

  test("empty input degrades without throwing", () => {
    const analysis = analyzeContent({});
    expect(analysis.isEmpty).toBe(true);
    expect(analysis.sourceFormat).toBe("empty");
  });
});

describe("Phase AI-2 heading intelligence", () => {
  test("normalizes English, Hindi and bilingual headings", () => {
    expect(normalizeHeading("Important Dates").canonicalSection).toBe(
      CANONICAL_SECTIONS.IMPORTANT_DATES
    );
    expect(normalizeHeading("महत्वपूर्ण तिथियाँ").canonicalSection).toBe(
      CANONICAL_SECTIONS.IMPORTANT_DATES
    );
    expect(normalizeHeading("Important Dates / महत्वपूर्ण तिथियाँ").canonicalSection).toBe(
      CANONICAL_SECTIONS.IMPORTANT_DATES
    );
    expect(normalizeHeading("आयु सीमा").canonicalSection).toBe(CANONICAL_SECTIONS.AGE_LIMIT);
    expect(normalizeHeading("Scheme of Examination").canonicalSection).toBe(
      CANONICAL_SECTIONS.EXAM_PATTERN
    );
  });

  test("understands numbered and nested heading depth", () => {
    expect(parseNumbering("3. Important Dates")).toMatchObject({ numbering: "3", depth: 1 });
    expect(parseNumbering("3.1 Selection Process")).toMatchObject({ numbering: "3.1", depth: 2 });
    expect(parseNumbering("3.1.2. Written Exam")).toMatchObject({ depth: 3 });
    expect(parseNumbering("Important Dates").numbering).toBeNull();

    expect(normalizeHeading("2. आयु सीमा").canonicalSection).toBe(CANONICAL_SECTIONS.AGE_LIMIT);
    const tree = buildHeadingTree([
      { normalizedText: "Selection Process", canonicalSection: "selection_process", level: 1 },
      { normalizedText: "Written Exam", canonicalSection: "unknown", level: 2 },
      { normalizedText: "Interview", canonicalSection: "unknown", level: 2 }
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((child) => child.text)).toEqual(["Written Exam", "Interview"]);
  });

  test("repairs broken headings without merging content rows", () => {
    const { lines, repairs } = repairBrokenHeadings([
      "1.",
      "Detailed Advertisement",
      "Important",
      "Dates",
      "Corrigen-",
      "dum reference follows",
      "Last Date for Apply Online : 30/09/2025",
      "Vacancy Details"
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        "1. Detailed Advertisement",
        "Important Dates",
        "Corrigendum reference follows",
        "Last Date for Apply Online : 30/09/2025",
        "Vacancy Details"
      ])
    );
    expect(repairs.map((repair) => repair.reason)).toEqual([
      "orphan_numbering",
      "wrapped_heading",
      "hyphen_split"
    ]);
  });

  test("preserves unknown headings instead of discarding them", () => {
    const result = detectHeadings({
      lines: ["Important Dates", "Vigilance Clearance Repository", "Last Date : 30/09/2025"]
    });
    const unknownTexts = result.unknownHeadings.map((heading) => heading.text);
    expect(unknownTexts).toContain("Vigilance Clearance Repository");
    expect(result.canonicalSections).toContain(CANONICAL_SECTIONS.IMPORTANT_DATES);
  });

  test("detects canonical sections in a broken PDF extraction", () => {
    const { headings } = analyze("PDF_BROKEN_HEADINGS");
    expect(headings.canonicalSections).toEqual(
      expect.arrayContaining([
        CANONICAL_SECTIONS.IMPORTANT_DATES,
        CANONICAL_SECTIONS.AGE_LIMIT,
        CANONICAL_SECTIONS.APPLICATION_FEE,
        CANONICAL_SECTIONS.SELECTION_PROCESS
      ])
    );
    expect(headings.repairs.map((repair) => repair.reason)).toContain("orphan_numbering");
  });
});

describe("Phase AI-2 department detection", () => {
  const cases = [
    ["UPPSC_NEW_RECRUITMENT", "UPPSC"],
    ["SSC_ADMIT_CARD", "SSC"],
    ["RAILWAY_APPRENTICE", "RRB"],
    ["UP_POLICE_FINAL_RESULT", "UPPRPB"],
    ["NTA_EXAM_CITY", "NTA"],
    ["BPSC_EXTENSION", "BPSC"],
    ["DSSSB_CORRIGENDUM", "DSSSB"],
    ["BHU_ASSISTANT_PROFESSOR", "BHU"],
    ["AIIMS_NURSING_WALK_IN", "AIIMS"]
  ];

  test.each(cases)("%s resolves to %s", (fixtureName, expectedCode) => {
    const { normalizedEvent } = analyze(fixtureName);
    expect(normalizedEvent.departmentCode).toBe(expectedCode);
    expect(normalizedEvent.isKnownOrganization).toBe(true);
    expect(normalizedEvent.sourceDepartment).toBeTruthy();
  });

  test("commissions and boards also populate sourceBoard", () => {
    expect(analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.sourceBoard).toBe(
      "Uttar Pradesh Public Service Commission"
    );
    expect(analyze("BHU_ASSISTANT_PROFESSOR").normalizedEvent.sourceBoard).toBeNull();
  });

  test("matches an official domain even without a name in the body", () => {
    const result = detectDepartment({
      title: "Public notice regarding examination",
      url: "https://ssc.nic.in/Portal/Notices",
      lines: ["Public notice regarding examination"]
    });
    expect(result.departmentCode).toBe("SSC");
    expect(result.matchedSources).toContain("url");
  });

  test("unknown organizations are preserved as detected text", () => {
    const result = detectDepartment({
      title: "Chandrapur Zilla Parishad Recruitment Board notice",
      url: "https://example-zp.gov.in/notice",
      lines: ["Chandrapur Zilla Parishad Recruitment Board notice"]
    });
    expect(result.isKnownOrganization).toBe(false);
    expect(result.departmentCode).toBeNull();
    expect(result.detectedText).toMatch(/Recruitment Board/);
    expect(result.department).toBe(result.detectedText);
  });
});

describe("Phase AI-2 reference and date extraction", () => {
  test("parses Indian, textual and Hindi date formats", () => {
    expect(parseDate("30/09/2025").iso).toBe("2025-09-30");
    expect(parseDate("04 September 2025").iso).toBe("2025-09-04");
    expect(parseDate("September 4, 2025").iso).toBe("2025-09-04");
    expect(parseDate("15 जुलाई 2025").iso).toBe("2025-07-15");
    expect(parseDate("Notify Soon").iso).toBeNull();
  });

  test("extracts advertisement numbers including Devanagari identifiers", () => {
    expect(analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.advertisementNumber).toBe(
      "A-1/E-1/2026"
    );
    expect(analyze("RAILWAY_APPRENTICE").normalizedEvent.advertisementNumber).toBe(
      "RRB/APP/03/2026"
    );
    expect(analyze("HINDI_HEAVY_RESULT").normalizedEvent.advertisementNumber).toBe("ए-2/ई-1/2025");
  });

  test("publication date is not confused with an exam date", () => {
    const references = extractReferences({
      title: "Exam notice",
      lines: ["Exam Date : 14/09/2026", "Date of Publication : 01/07/2026"]
    });
    expect(references.publicationDate).toBe("2026-07-01");
    expect(references.dateCount).toBe(2);
    expect(references.year).toBe(2026);
  });

  test("flags broken reference identifiers", () => {
    const references = extractReferences({
      title: "Recruitment notice",
      lines: ["Advertisement No. XXXX/2026", "Dated : 01/07/2026"]
    });
    expect(references.issues.map((issue) => issue.field)).toContain("advertisementNumber");
  });
});

describe("Phase AI-2 event classification", () => {
  const cases = [
    ["UPPSC_NEW_RECRUITMENT", EVENT_TYPES.NEW_RECRUITMENT],
    ["SSC_ADMIT_CARD", EVENT_TYPES.ADMIT_CARD],
    ["RAILWAY_APPRENTICE", EVENT_TYPES.APPRENTICE],
    ["RAILWAY_TECHNICIAN_RESULT", EVENT_TYPES.RESULT],
    ["UP_POLICE_FINAL_RESULT", EVENT_TYPES.FINAL_RESULT],
    ["NTA_EXAM_CITY", EVENT_TYPES.EXAM_CITY],
    ["NTA_CORRECTION_WINDOW", EVENT_TYPES.CORRECTION],
    ["BPSC_EXTENSION", EVENT_TYPES.EXTENSION_NOTICE],
    ["AIIMS_NURSING_WALK_IN", EVENT_TYPES.WALK_IN],
    ["DSSSB_CORRIGENDUM", EVENT_TYPES.CORRIGENDUM],
    ["BHU_ASSISTANT_PROFESSOR", EVENT_TYPES.DETAILED_ADVERTISEMENT],
    ["HINDI_HEAVY_RESULT", EVENT_TYPES.RESULT],
    ["MIXED_LANGUAGE_EXTENSION", EVENT_TYPES.EXTENSION_NOTICE],
    ["PRESS_RELEASE", EVENT_TYPES.PRESS_RELEASE],
    ["TENDER_NOTICE", EVENT_TYPES.TENDER],
    ["PDF_BROKEN_HEADINGS", EVENT_TYPES.DETAILED_ADVERTISEMENT],
    ["SHORT_NOTICE_TEXT", EVENT_TYPES.SHORT_NOTICE]
  ];

  test.each(cases)("%s classifies as %s", (fixtureName, expectedType) => {
    const { normalizedEvent } = analyze(fixtureName);
    expect(normalizedEvent.eventType).toBe(expectedType);
    expect(normalizedEvent.isKnownEventType).toBe(true);
  });

  test("final result supersedes the generic result type", () => {
    const { classification } = analyze("UP_POLICE_FINAL_RESULT");
    expect(classification.eventType).toBe(EVENT_TYPES.FINAL_RESULT);
    expect(classification.candidates.map((candidate) => candidate.eventType)).not.toContain(
      EVENT_TYPES.RESULT
    );
  });

  test("sub types capture lifecycle detail", () => {
    expect(analyze("NTA_EXAM_CITY").normalizedEvent.eventSubType).toBe("city_intimation");
    expect(analyze("BPSC_EXTENSION").normalizedEvent.eventSubType).toBe("date_extension");
    expect(analyze("DSSSB_CORRIGENDUM").normalizedEvent.eventSubType).toBe("revised");
    expect(analyze("HINDI_HEAVY_RESULT").normalizedEvent.eventSubType).toBe("prelims");
  });

  test("unknown event types are preserved, not discarded", () => {
    const { normalizedEvent } = analyze("UNKNOWN_NOTICE");
    expect(normalizedEvent.eventType).toBe(EVENT_TYPES.UNKNOWN);
    expect(normalizedEvent.isKnownEventType).toBe(false);
    expect(normalizedEvent.rawEventLabel).toBe("Vigilance Clearance Repository Activation");
    expect(normalizedEvent.normalizedTitle).toBe("Vigilance Clearance Repository Activation");
  });

  test("normalized title strips website decoration but keeps meaning", () => {
    const result = analyzeGovernmentNotice(
      {
        title: "NEW! SSC GD Constable Result 2026 *** Click Here",
        sourceUrl: "https://ssc.nic.in/result",
        text: "Staff Selection Commission has declared the result."
      },
      { now: NOW }
    );
    expect(result.normalizedEvent.normalizedTitle).toBe("SSC GD Constable Result 2026");
    expect(result.normalizedEvent.sourceTitle).toBe("NEW! SSC GD Constable Result 2026 *** Click Here");
  });

  test("recruitment matching candidate separates recruitment from non-recruitment notices", () => {
    expect(analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.recruitmentCandidate.isRecruitmentCandidate).toBe(
      true
    );
    expect(analyze("TENDER_NOTICE").normalizedEvent.recruitmentCandidate.isRecruitmentCandidate).toBe(
      false
    );
    const hints = analyze("UP_POLICE_FINAL_RESULT").normalizedEvent.recruitmentCandidate.matchHints;
    expect(hints.postTitles).toEqual(expect.arrayContaining(["Constable"]));
    expect(hints.advertisementNumber).toBe("UPPRPB/CONST/02/2025");
  });
});

describe("Phase AI-2 priority engine", () => {
  const cases = [
    ["RAILWAY_TECHNICIAN_RESULT", PRIORITY_LEVELS.CRITICAL],
    ["UP_POLICE_FINAL_RESULT", PRIORITY_LEVELS.CRITICAL],
    ["SSC_ADMIT_CARD", PRIORITY_LEVELS.CRITICAL],
    ["NTA_EXAM_CITY", PRIORITY_LEVELS.HIGH],
    ["UPPSC_NEW_RECRUITMENT", PRIORITY_LEVELS.HIGH],
    ["NTA_CORRECTION_WINDOW", PRIORITY_LEVELS.MEDIUM],
    ["DSSSB_CORRIGENDUM", PRIORITY_LEVELS.MEDIUM],
    ["PRESS_RELEASE", PRIORITY_LEVELS.LOW],
    ["TENDER_NOTICE", PRIORITY_LEVELS.LOW],
    ["UNKNOWN_NOTICE", PRIORITY_LEVELS.LOW]
  ];

  test.each(cases)("%s is prioritised %s", (fixtureName, expectedPriority) => {
    expect(analyze(fixtureName).normalizedEvent.priority).toBe(expectedPriority);
  });

  test("results outrank exam dates which outrank minor website notices", () => {
    const resultRank = analyze("RAILWAY_TECHNICIAN_RESULT").priority.rank;
    const examRank = analyze("NTA_EXAM_CITY").priority.rank;
    const minorRank = analyze("UNKNOWN_NOTICE").priority.rank;
    expect(resultRank).toBeGreaterThan(examRank);
    expect(examRank).toBeGreaterThan(minorRank);
  });

  test("priority explains every modifier it applied", () => {
    const { priority } = analyze("SSC_ADMIT_CARD");
    expect(priority.basePriority).toBe(PRIORITY_LEVELS.CRITICAL);
    expect(priority.reasons.length).toBeGreaterThan(1);
    expect(priority.modifiers.every((modifier) => typeof modifier.reason === "string")).toBe(true);
  });

  test("low confidence demotes an otherwise high priority event", () => {
    const base = {
      classification: { eventType: EVENT_TYPES.EXAM_DATE, classificationScore: 0.5 },
      references: {},
      department: {},
      analysis: { characterCount: 1200 },
      recruitmentCandidate: { isRecruitmentCandidate: false }
    };
    const confident = assignPriority({ ...base, overallConfidence: 0.9 }, { now: NOW });
    const unsure = assignPriority({ ...base, overallConfidence: 0.3 }, { now: NOW });
    expect(confident.priority).toBe(PRIORITY_LEVELS.HIGH);
    expect(unsure.priority).toBe(PRIORITY_LEVELS.MEDIUM);
    expect(unsure.modifiers.map((modifier) => modifier.name)).toContain("low_confidence");
  });
});

describe("Phase AI-2 confidence engine", () => {
  test("reports a score, level and reasons for every field", () => {
    const { confidence } = analyze("UPPSC_NEW_RECRUITMENT");
    for (const field of ["title", "department", "eventType", "dates", "referenceNumber"]) {
      expect(confidence.fields[field].score).toBeGreaterThan(0);
      expect(confidence.fields[field].level).toBeTruthy();
      expect(confidence.fields[field].reasons.length).toBeGreaterThan(0);
      expect(confidence.fields[field].reasons.every((reason) => reason.code && reason.detail)).toBe(
        true
      );
    }
    expect(confidence.overall.score).toBeGreaterThan(0.8);
    expect(confidence.overall.level).toBe("HIGH");
  });

  test("explains why an unclassified notice scores low", () => {
    const { confidence } = analyze("UNKNOWN_NOTICE");
    expect(confidence.overallScore).toBeLessThan(0.35);
    const codes = [
      ...confidence.fields.eventType.reasons,
      ...confidence.fields.department.reasons,
      ...confidence.overall.reasons
    ].map((reason) => reason.code);
    expect(codes).toEqual(
      expect.arrayContaining(["EVENT_TYPE_UNKNOWN", "DEPARTMENT_MISSING", "UNCLASSIFIED_EVENT"])
    );
  });

  test("registry-backed department scores above free-text department", () => {
    const known = buildConfidenceReport({
      classification: {},
      department: {
        department: "Staff Selection Commission",
        departmentCode: "SSC",
        isKnownOrganization: true,
        matchedSources: ["title", "url"]
      },
      references: {},
      analysis: {}
    });
    const unknown = buildConfidenceReport({
      classification: {},
      department: {
        department: "Chandrapur Zilla Parishad Recruitment Board",
        isKnownOrganization: false,
        matchedSources: ["body"]
      },
      references: {},
      analysis: {}
    });
    expect(known.fields.department.score).toBeGreaterThan(unknown.fields.department.score);
  });
});

describe("Phase AI-2 keyword intelligence", () => {
  test("produces canonical keywords while preserving original wording", () => {
    const keywords = extractKeywords({
      title: "UP Police Constable Recruitment 2026",
      text: "Applications are invited for the post of Junior Engineer and Nursing Officer in Group C. Railway Technician and Apprentice posts are also included. Assistant Professor posts are advertised separately."
    });
    const byKeyword = new Map(keywords.map((item) => [item.keyword, item]));

    for (const expected of [
      "UP Police",
      "Constable",
      "Group C",
      "Assistant Professor",
      "Junior Engineer",
      "Apprentice",
      "Nursing Officer",
      "Railway Technician"
    ]) {
      expect(byKeyword.has(expected)).toBe(true);
      expect(byKeyword.get(expected).original).toBeTruthy();
      expect(byKeyword.get(expected).category).toBeTruthy();
    }
    expect(byKeyword.get("UP Police").inTitle).toBe(true);
  });

  test("keeps Hindi source wording alongside the normalized keyword", () => {
    const keywords = extractKeywords({
      title: "उत्तर प्रदेश पुलिस आरक्षी भर्ती 2026",
      text: "उत्तर प्रदेश पुलिस आरक्षी भर्ती 2026 के लिए आवेदन आमंत्रित हैं।"
    });
    const constable = keywords.find((item) => item.keyword === "Constable");
    expect(constable).toBeTruthy();
    expect(constable.original).toBe("आरक्षी");
  });

  test("normalized event exposes keywords as canonical strings", () => {
    const { normalizedEvent } = analyze("BHU_ASSISTANT_PROFESSOR");
    expect(normalizedEvent.keywords).toEqual(expect.arrayContaining(["Assistant Professor", "BHU"]));
    expect(normalizedEvent.keywordDetails[0]).toHaveProperty("original");
  });
});

describe("Phase AI-2 duplicate candidate fingerprint", () => {
  test("is deterministic for identical inputs", () => {
    const first = analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.fingerprint;
    const second = analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.fingerprint;
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^AI2FP-SHA256:[a-f0-9]{64}$/);
  });

  test("is built from title, department, advertisement, reference and year", () => {
    const fingerprint = buildFingerprint({
      normalizedTitle: "UPPSC Combined State Examination 2026",
      departmentCode: "UPPSC",
      advertisementNumber: "A-1/E-1/2026",
      referenceNumber: "F-12/2026",
      year: 2026
    });
    expect(Object.keys(fingerprint.components).sort()).toEqual([
      "advertisementNumber",
      "department",
      "normalizedTitle",
      "referenceNumber",
      "year"
    ]);
    expect(fingerprint.missingComponents).toHaveLength(0);
    expect(fingerprint.strength).toBe("strong");
  });

  test("ignores identifier punctuation differences", () => {
    const base = {
      normalizedTitle: "UPPSC Combined State Examination 2026",
      departmentCode: "UPPSC",
      year: 2026
    };
    const dotted = buildFingerprint({ ...base, advertisementNumber: "A-1/E-1/2026" });
    const spaced = buildFingerprint({ ...base, advertisementNumber: "A 1 / E 1 / 2026" });
    expect(dotted.fingerprint).toBe(spaced.fingerprint);
  });

  test("different notices produce different fingerprints", () => {
    const uppsc = analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent.fingerprint.fingerprint;
    const ssc = analyze("SSC_ADMIT_CARD").normalizedEvent.fingerprint.fingerprint;
    expect(uppsc).not.toBe(ssc);
  });

  test("makes no duplicate decision in this phase", () => {
    const { fingerprint } = analyze("UPPSC_NEW_RECRUITMENT").normalizedEvent;
    expect(fingerprint.duplicateDecision).toBeNull();
    expect(fingerprint.advisoryOnly).toBe(true);
    expect(fingerprint.variants).toHaveProperty("identifier");
    expect(fingerprint.variants).toHaveProperty("title");
  });
});

describe("Phase AI-2 validation", () => {
  test("clean notices validate without errors", () => {
    const { validation } = analyze("UPPSC_NEW_RECRUITMENT");
    expect(validation.ok).toBe(true);
    expect(validation.errorCount).toBe(0);
  });

  test("reports missing title, department, dates and classification", () => {
    const { validation } = analyzeGovernmentNotice({ text: "" }, { now: NOW });
    const codes = validation.issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "EMPTY_CONTENT",
        "MISSING_TITLE",
        "MISSING_DEPARTMENT",
        "MISSING_DATES",
        "UNKNOWN_CLASSIFICATION",
        "LOW_CONFIDENCE"
      ])
    );
    expect(validation.ok).toBe(false);
    expect(validation.requiresManualReview).toBe(true);
  });

  test("reports broken references and unverified departments", () => {
    const validation = validateNormalizedEvent({
      classification: { normalizedTitle: "Some board recruitment notice 2026", eventType: EVENT_TYPES.NOTIFICATION },
      department: { department: "Chandrapur Recruitment Board", isKnownOrganization: false },
      references: {
        publicationDate: "2026-01-01",
        dateCount: 2,
        advertisementNumber: "XX/",
        issues: [{ field: "advertisementNumber", reason: "malformed_identifier", value: "XX/" }]
      },
      confidence: { overallScore: 0.7 },
      analysis: { isEmpty: false },
      headingResult: { knownHeadingCount: 2 }
    });
    const codes = validation.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["UNVERIFIED_DEPARTMENT", "BROKEN_REFERENCE"]));
    expect(validation.ok).toBe(true);
  });

  test("flags low confidence events for review", () => {
    const { validation } = analyze("UNKNOWN_NOTICE");
    expect(validation.issues.map((issue) => issue.code)).toContain("LOW_CONFIDENCE");
    expect(validation.summary.isClassified).toBe(false);
  });
});

describe("Phase AI-2 normalized event output", () => {
  test("exposes every required field", () => {
    const { normalizedEvent } = analyze("UPPSC_NEW_RECRUITMENT");
    const required = [
      "eventType",
      "eventSubType",
      "sourceTitle",
      "sourceDepartment",
      "sourceBoard",
      "publicationDate",
      "referenceNumber",
      "advertisementNumber",
      "normalizedTitle",
      "keywords",
      "confidence",
      "priority",
      "language"
    ];
    for (const field of required) {
      expect(normalizedEvent).toHaveProperty(field);
    }
    expect(normalizedEvent.formatId).toBe(FORMAT_ID);
    expect(normalizedEvent.engineVersion).toBe(ENGINE_VERSION);
    expect(Array.isArray(normalizedEvent.keywords)).toBe(true);
    expect(typeof normalizedEvent.confidence).toBe("number");
  });

  test("is immutable advisory output", () => {
    const { normalizedEvent } = analyze("SSC_ADMIT_CARD");
    expect(Object.isFrozen(normalizedEvent)).toBe(true);
    expect(normalizedEvent.advisoryOnly).toBe(true);
    expect(() => {
      "use strict";
      normalizedEvent.eventType = EVENT_TYPES.TENDER;
    }).toThrow();
  });

  test("every fixture produces a complete normalized event", () => {
    for (const name of Object.keys(NOTICES)) {
      const { normalizedEvent } = analyze(name);
      expect(normalizedEvent.formatId).toBe(FORMAT_ID);
      expect(normalizedEvent.normalizedTitle).toBeTruthy();
      expect(normalizedEvent.fingerprint.fingerprint).toMatch(/^AI2FP-SHA256:/);
      expect(Object.values(PRIORITY_LEVELS)).toContain(normalizedEvent.priority);
      expect(normalizedEvent.confidence).toBeGreaterThanOrEqual(0);
      expect(normalizedEvent.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("Phase AI-2 Production Workflow compatibility", () => {
  const originalEvent = Object.freeze({
    sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html",
    title: "SSC CGL Recruitment 2026 Notification",
    contentType: "text/html",
    html: NOTICES.SSC_ADMIT_CARD.html,
    forceChangeDetected: true
  });

  test("enrichment is additive and preserves every original key", () => {
    const enriched = enrichMonitoringEvent(originalEvent, { now: NOW });
    for (const [key, value] of Object.entries(originalEvent)) {
      expect(enriched[key]).toBe(value);
    }
    expect(Object.keys(enriched)).toHaveLength(Object.keys(originalEvent).length + 1);
    expect(readIntelligence(enriched).eventType).toBe(EVENT_TYPES.ADMIT_CARD);
  });

  test("attaching intelligence to an arbitrary event does not mutate it", () => {
    const event = { sourceUrl: "https://example.gov.in", title: "Notice" };
    const snapshot = JSON.stringify(event);
    const attached = toWorkflowMonitoringEvent(event, { eventType: EVENT_TYPES.NOTIFICATION });
    expect(JSON.stringify(event)).toBe(snapshot);
    expect(attached[INTELLIGENCE_FIELD].eventType).toBe(EVENT_TYPES.NOTIFICATION);
  });

  test("Production Workflow behaves identically with and without intelligence", async () => {
    const buildEvent = (extra) => ({
      sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html",
      title: "SSC CGL Recruitment 2026 Notification",
      contentType: "text/html",
      html: NOTICES.UPPSC_NEW_RECRUITMENT.html,
      forceChangeDetected: true,
      allowTelegramDelivery: true,
      telegramTransport: telegramNotification.createMemoryTransport(),
      ...extra
    });

    const baseline = await runProductionWorkflow({
      monitoringEvent: buildEvent(),
      workflowId: "ai2_compat_baseline"
    });
    const enrichedEvent = enrichMonitoringEvent(buildEvent(), { now: NOW });
    const enriched = await runProductionWorkflow({
      monitoringEvent: enrichedEvent,
      workflowId: "ai2_compat_enriched"
    });

    expect(enriched.status).toBe(baseline.status);
    expect(enriched.finalState).toBe(baseline.finalState);
    expect(enriched.published).toBe(baseline.published);
    expect(enriched.autoPublishBlocked).toBe(baseline.autoPublishBlocked);
    const stageStatuses = (result) =>
      Object.entries(result.stageResults).map(([stageId, stage]) => [stageId, stage.status]);
    expect(stageStatuses(enriched)).toEqual(stageStatuses(baseline));
    expect(baseline.status).toBe(STAGE_STATUS.SUCCESS);
    expect(baseline.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
  });

  test("AUTO_PUBLISH remains disabled", () => {
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });
});
