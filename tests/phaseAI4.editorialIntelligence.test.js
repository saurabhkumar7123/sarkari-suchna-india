"use strict";

/**
 * Phase AI-4 — Editorial Intelligence & Draft Quality Engine tests.
 *
 * Covers completeness, cross-section validation, missing information,
 * suggestions, quality scores, language quality, link validation, section
 * ordering and editor summaries across the required fixture set — plus proof
 * that the Production Workflow, Generator path and AUTO_PUBLISH are untouched.
 */

const { DRAFTS, PROFILE_HINTS } = require("./fixtures/ai4/editorialDrafts");
const { SAMPLES: AI1_SAMPLES } = require("./fixtures/ai1/notificationSamples");

const {
  analyzeEditorialDraft,
  enrichWithEditorialIntelligence,
  readEditorialIntelligence,
  attachEditorialIntelligence,
  buildDraftModel,
  analyzeCompleteness,
  validateCrossSections,
  detectMissingInformation,
  analyzeLanguageQuality,
  validateLinks,
  recommendSectionOrder,
  buildEditorSuggestions,
  computeQualityScores,
  EDITORIAL_FIELD,
  FORMAT_ID,
  ENGINE_VERSION,
  PHASE,
  SEVERITY,
  SUGGESTION_TYPES,
  MISSING_CODES,
  VALIDATION_CODES,
  LANGUAGE_ISSUE_CODES,
  DRAFT_PROFILES,
  QUALITY_DIMENSIONS,
  EFFORT_LEVELS
} = require("../server/lib/editorialIntelligence");

const { runGeneratorIntelligencePipeline } = require("../server/lib/generatorIntelligence");
const {
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_STATUS,
  PUBLISHING_POLICY
} = require("../server/lib/productionWorkflow");
const telegramNotification = require("../server/lib/monitoringBot/telegramNotification");
const { getAutomationFlags } = require("../server/config/automationFlags");
const { NOTICES: AI2_NOTICES } = require("./fixtures/ai2/governmentNotices");

const NOW = new Date("2026-07-26T00:00:00Z");

/**
 * @param {string} name
 * @param {object} [options]
 */
function analyze(name, options = {}) {
  return analyzeEditorialDraft(DRAFTS[name], {
    now: NOW,
    profile: options.profile || PROFILE_HINTS[name],
    ...options
  });
}

describe("Phase AI-4 draft model", () => {
  test("parses publisher section brackets", () => {
    const draft = buildDraftModel(DRAFTS.NEW_RECRUITMENT, { profile: "new_recruitment" });
    expect(draft.sections.length).toBeGreaterThanOrEqual(12);
    expect(draft.profile).toBe(DRAFT_PROFILES.NEW_RECRUITMENT);
    expect(draft.byType.important_dates).toBeTruthy();
    expect(draft.unknownSections).toEqual([]);
  });

  test("preserves unknown section headings", () => {
    const text = `${DRAFTS.ADMIT_CARD}\n\n[Section: Centre Allotment Notes]\nExtra unknown content here.\n`;
    const draft = buildDraftModel(text, { profile: "admit_card" });
    expect(draft.unknownSections.some((s) => /centre allotment/i.test(s.title))).toBe(true);
  });

  test("accepts AI-1 structured documents", () => {
    const { structured } = runGeneratorIntelligencePipeline(AI1_SAMPLES.UPPSC);
    const draft = buildDraftModel(structured, { profile: "new_recruitment" });
    expect(draft.source).toBe("ai1_structured");
    expect(draft.sections.length).toBeGreaterThan(5);
  });

  test("infers admit card / result / correction / extension profiles", () => {
    expect(buildDraftModel(DRAFTS.ADMIT_CARD).profile).toBe(DRAFT_PROFILES.ADMIT_CARD);
    expect(buildDraftModel(DRAFTS.RESULT).profile).toBe(DRAFT_PROFILES.RESULT);
    expect(buildDraftModel(DRAFTS.CORRECTION).profile).toBe(DRAFT_PROFILES.CORRECTION);
    expect(buildDraftModel(DRAFTS.EXTENSION).profile).toBe(DRAFT_PROFILES.EXTENSION);
  });
});

describe("Phase AI-4 draft completeness", () => {
  test("scores a full new recruitment draft highly", () => {
    const { completeness, draft } = analyze("NEW_RECRUITMENT");
    expect(completeness.percentage).toBeGreaterThanOrEqual(85);
    expect(completeness.presentCount).toBeGreaterThanOrEqual(12);
    expect(completeness.unknownPreserved).toEqual([]);
    expect(draft.profile).toBe(DRAFT_PROFILES.NEW_RECRUITMENT);
  });

  test("reports low completeness for incomplete notification", () => {
    const { completeness } = analyze("INCOMPLETE_NOTIFICATION");
    expect(completeness.percentage).toBeLessThan(30);
    expect(completeness.missingCount).toBeGreaterThan(8);
  });

  test("uses a narrower expectation set for admit card drafts", () => {
    const { completeness } = analyze("ADMIT_CARD");
    expect(completeness.expectedCount).toBeLessThan(10);
    expect(completeness.percentage).toBeGreaterThanOrEqual(80);
  });

  test("preserves unknown sections outside the percentage denominator", () => {
    const text = `${DRAFTS.RESULT}\n\n[Section: Custom Annexure]\nAnnex data\n`;
    const result = analyzeEditorialDraft(text, { now: NOW, profile: "result" });
    expect(result.completeness.unknownPreserved.length).toBe(1);
    expect(result.editorialIntelligence.unknownSectionsPreserved[0].title).toMatch(/annexure/i);
  });
});

describe("Phase AI-4 cross-section validation", () => {
  test("flags dates in Short Information missing from Important Dates", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(validationIssues.issues.some((i) => i.code === VALIDATION_CODES.DATE_MISSING_FROM_IMPORTANT_DATES)).toBe(
      true
    );
  });

  test("flags fee mismatches", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(validationIssues.issues.some((i) => i.code === VALIDATION_CODES.FEE_VALUE_MISMATCH)).toBe(true);
  });

  test("flags vacancy total mismatches", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(validationIssues.issues.some((i) => i.code === VALIDATION_CODES.VACANCY_TOTAL_MISMATCH)).toBe(true);
  });

  test("flags eligibility vs qualification conflicts", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(
      validationIssues.issues.some((i) => i.code === VALIDATION_CODES.ELIGIBILITY_QUALIFICATION_CONFLICT)
    ).toBe(true);
  });

  test("flags inconsistent advertisement and reference numbers", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(
      validationIssues.issues.some((i) => i.code === VALIDATION_CODES.ADVERTISEMENT_NUMBER_INCONSISTENT)
    ).toBe(true);
    expect(
      validationIssues.issues.some((i) => i.code === VALIDATION_CODES.REFERENCE_NUMBER_INCONSISTENT)
    ).toBe(true);
  });

  test("flags duplicate dates", () => {
    const { validationIssues } = analyze("INCONSISTENT_DRAFT");
    expect(validationIssues.issues.some((i) => i.code === VALIDATION_CODES.DUPLICATE_DATE_ENTRIES)).toBe(true);
  });

  test("large vacancy table with matching total is clean", () => {
    const { validationIssues } = analyze("LARGE_VACANCY_TABLE");
    expect(validationIssues.issues.some((i) => i.code === VALIDATION_CODES.VACANCY_TOTAL_MISMATCH)).toBe(false);
  });
});

describe("Phase AI-4 missing information", () => {
  test("detects missing application start and last dates", () => {
    const { missingInformation } = analyze("MISSING_DATES");
    const codes = missingInformation.items.map((i) => i.code);
    expect(codes).toContain(MISSING_CODES.MISSING_APPLICATION_START_DATE);
    expect(codes).toContain(MISSING_CODES.MISSING_LAST_DATE);
    expect(missingInformation.items.find((i) => i.code === MISSING_CODES.MISSING_APPLICATION_START_DATE).severity).toBe(
      SEVERITY.CRITICAL
    );
  });

  test("detects missing fee section", () => {
    const { missingInformation } = analyze("MISSING_FEE");
    expect(missingInformation.items.some((i) => i.code === MISSING_CODES.MISSING_FEE_SECTION)).toBe(true);
  });

  test("detects missing eligibility", () => {
    const { missingInformation } = analyze("MISSING_ELIGIBILITY");
    expect(missingInformation.items.some((i) => i.code === MISSING_CODES.MISSING_ELIGIBILITY)).toBe(true);
  });

  test("detects missing FAQ on new recruitment as low severity", () => {
    const draft = DRAFTS.MISSING_FEE; // no FAQ section
    const result = analyzeEditorialDraft(draft, { now: NOW, profile: "new_recruitment" });
    const faq = result.missingInformation.items.find((i) => i.code === MISSING_CODES.MISSING_FAQ);
    expect(faq).toBeTruthy();
    expect(faq.severity).toBe(SEVERITY.LOW);
  });

  test("admit card missing admit-card link is critical", () => {
    const text = DRAFTS.ADMIT_CARD.replace(/Admit Card https:\/\/ssc\.nic\.in\/admitcard\n/, "");
    const result = analyzeEditorialDraft(text, { now: NOW, profile: "admit_card" });
    expect(result.missingInformation.items.some((i) => i.code === MISSING_CODES.MISSING_ADMIT_CARD_LINK)).toBe(true);
  });
});

describe("Phase AI-4 language quality", () => {
  test("detects mixed Hindi/English wording", () => {
    const { languageQuality } = analyze("MIXED_HINDI_ENGLISH");
    expect(languageQuality.issues.some((i) => i.code === LANGUAGE_ISSUE_CODES.MIXED_HINDI_ENGLISH)).toBe(true);
    expect(languageQuality.issues.every((i) => i.appliesChanges === false)).toBe(true);
  });

  test("detects OCR artifacts", () => {
    const { languageQuality } = analyze("OCR_HEAVY");
    expect(languageQuality.issues.some((i) => i.code === LANGUAGE_ISSUE_CODES.OCR_ARTIFACTS)).toBe(true);
  });

  test("detects broken Unicode", () => {
    const { languageQuality } = analyze("BROKEN_UNICODE");
    expect(languageQuality.issues.some((i) => i.code === LANGUAGE_ISSUE_CODES.BROKEN_UNICODE)).toBe(true);
  });
});

describe("Phase AI-4 link validation", () => {
  test("flags duplicate links", () => {
    const { linkValidation } = analyze("DUPLICATE_LINKS");
    expect(linkValidation.duplicates.length).toBeGreaterThanOrEqual(2);
    expect(linkValidation.issues.some((i) => i.code === VALIDATION_CODES.DUPLICATE_LINK)).toBe(true);
  });

  test("flags placeholder / broken links", () => {
    const { linkValidation } = analyze("INCONSISTENT_DRAFT");
    expect(linkValidation.broken.length).toBeGreaterThanOrEqual(1);
    expect(linkValidation.issues.some((i) => i.code === VALIDATION_CODES.BROKEN_OR_PLACEHOLDER_LINK)).toBe(true);
  });

  test("validates tracked categories on a healthy draft", () => {
    const { linkValidation } = analyze("NEW_RECRUITMENT");
    expect(linkValidation.coverage.missing).toEqual([]);
    expect(linkValidation.broken).toHaveLength(0);
  });

  test("result profile expects a result link", () => {
    const { linkValidation } = analyze("RESULT");
    expect(linkValidation.coverage.present).toEqual(
      expect.arrayContaining(["result", "official_website"])
    );
  });
});

describe("Phase AI-4 section ordering", () => {
  test("recommends reorder without applying it", () => {
    const { sectionOrdering, editorialIntelligence } = analyze("OUT_OF_ORDER");
    expect(sectionOrdering.needsReorder).toBe(true);
    expect(sectionOrdering.recommendedOrder[0].sectionType).toBe("short_information");
    expect(editorialIntelligence.appliesChanges).toBe(false);
    // Original draft text is not rewritten by the engine
    expect(DRAFTS.OUT_OF_ORDER.indexOf("[Section: Important Links]")).toBeLessThan(
      DRAFTS.OUT_OF_ORDER.indexOf("[Section: Short Information]")
    );
  });

  test("healthy draft does not need reorder", () => {
    const { sectionOrdering } = analyze("NEW_RECRUITMENT");
    expect(sectionOrdering.needsReorder).toBe(false);
  });
});

describe("Phase AI-4 editorial suggestions", () => {
  test("suggests adding FAQ without modifying draft", () => {
    const { editorSuggestions, editorialIntelligence } = analyze("MISSING_FEE");
    expect(editorSuggestions.some((s) => s.type === SUGGESTION_TYPES.ADD_SECTION)).toBe(true);
    expect(editorialIntelligence.appliesChanges).toBe(false);
    expect(editorSuggestions.every((s) => s.advisoryOnly && s.appliesChanges === false)).toBe(true);
  });

  test("suggests removing duplicate links and fixing broken links", () => {
    const { editorSuggestions } = analyze("INCONSISTENT_DRAFT");
    expect(editorSuggestions.some((s) => s.type === SUGGESTION_TYPES.FIX_LINK)).toBe(true);
  });

  test("suggests resolving inconsistencies", () => {
    const { editorSuggestions } = analyze("INCONSISTENT_DRAFT");
    expect(editorSuggestions.some((s) => s.type === SUGGESTION_TYPES.RESOLVE_INCONSISTENCY)).toBe(true);
  });

  test("suggests converting how-to prose to bullets on large vacancy draft", () => {
    // LARGE has bullets already; INCONSISTENT how-to is short — use custom
    const text = DRAFTS.NEW_RECRUITMENT.replace(
      /Candidates must apply online through the official website only\.\nRegister, fill the form, upload documents, pay the fee and submit\./,
      "Candidates should visit the portal and complete registration then fill every field carefully then upload photograph signature and documents then pay the required application fee using net banking or card then finally submit the form and print the confirmation page for future reference before the last date ends."
    );
    const { editorSuggestions } = analyzeEditorialDraft(text, { now: NOW, profile: "new_recruitment" });
    expect(editorSuggestions.some((s) => s.type === SUGGESTION_TYPES.CONVERT_TO_BULLETS)).toBe(true);
  });
});

describe("Phase AI-4 quality scores", () => {
  test("exposes all required dimensions with explanations", () => {
    const { qualityScores } = analyze("NEW_RECRUITMENT");
    for (const key of [
      QUALITY_DIMENSIONS.COMPLETENESS,
      QUALITY_DIMENSIONS.CONSISTENCY,
      QUALITY_DIMENSIONS.READABILITY,
      QUALITY_DIMENSIONS.STRUCTURE,
      QUALITY_DIMENSIONS.LINK_QUALITY,
      QUALITY_DIMENSIONS.SECTION_COVERAGE
    ]) {
      expect(qualityScores[key].score).toBeGreaterThanOrEqual(0);
      expect(qualityScores[key].score).toBeLessThanOrEqual(100);
      expect(qualityScores[key].explanation).toBeTruthy();
    }
    expect(qualityScores.overall.score).toBeGreaterThanOrEqual(70);
    expect(qualityScores.overall.explanation).toMatch(/Overall editorial quality/);
  });

  test("incomplete drafts score lower overall", () => {
    const good = analyze("NEW_RECRUITMENT").qualityScores.overall.score;
    const bad = analyze("INCOMPLETE_NOTIFICATION").qualityScores.overall.score;
    expect(good).toBeGreaterThan(bad);
    expect(bad).toBeLessThan(50);
  });

  test("inconsistent drafts lose consistency points", () => {
    const { qualityScores } = analyze("INCONSISTENT_DRAFT");
    expect(qualityScores.consistency.score).toBeLessThan(70);
  });
});

describe("Phase AI-4 editor summary", () => {
  test("produces a concise briefing with effort estimate", () => {
    const { editorSummary } = analyze("INCOMPLETE_NOTIFICATION");
    expect(editorSummary.overallQuality.score).toBeDefined();
    expect(editorSummary.criticalIssues.length).toBeGreaterThan(0);
    expect(editorSummary.missingInformation.length).toBeGreaterThan(0);
    expect(editorSummary.recommendedImprovements.length).toBeGreaterThan(0);
    expect(editorSummary.confidence.score).toBeGreaterThan(0);
    expect(Object.values(EFFORT_LEVELS)).toContain(editorSummary.estimatedManualEditingEffort);
    expect(editorSummary.briefing).toMatch(/Advisory only/);
    expect(editorSummary.advisoryOnly).toBe(true);
    expect(editorSummary.appliesChanges).toBe(false);
  });

  test("healthy draft estimates minimal or light effort", () => {
    const { editorSummary } = analyze("NEW_RECRUITMENT");
    expect([EFFORT_LEVELS.MINIMAL, EFFORT_LEVELS.LIGHT]).toContain(
      editorSummary.estimatedManualEditingEffort
    );
  });
});

describe("Phase AI-4 scenario coverage", () => {
  test.each([
    ["NEW_RECRUITMENT", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["ADMIT_CARD", DRAFT_PROFILES.ADMIT_CARD],
    ["RESULT", DRAFT_PROFILES.RESULT],
    ["CORRECTION", DRAFT_PROFILES.CORRECTION],
    ["EXTENSION", DRAFT_PROFILES.EXTENSION],
    ["MIXED_HINDI_ENGLISH", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["OCR_HEAVY", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["INCOMPLETE_NOTIFICATION", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["DUPLICATE_LINKS", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["MISSING_DATES", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["MISSING_FEE", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["MISSING_ELIGIBILITY", DRAFT_PROFILES.NEW_RECRUITMENT],
    ["LARGE_VACANCY_TABLE", DRAFT_PROFILES.NEW_RECRUITMENT]
  ])("%s returns a frozen advisory report for profile %s", (name, profile) => {
    const result = analyze(name, { profile });
    const report = result.editorialIntelligence;
    expect(Object.isFrozen(report)).toBe(true);
    expect(report.formatId).toBe(FORMAT_ID);
    expect(report.engineVersion).toBe(ENGINE_VERSION);
    expect(report.phase).toBe(PHASE);
    expect(report.advisoryOnly).toBe(true);
    expect(report.appliesChanges).toBe(false);
    expect(report.qualityScores).toBeTruthy();
    expect(report.validationIssues).toBeTruthy();
    expect(report.missingInformation).toBeTruthy();
    expect(Array.isArray(report.editorSuggestions)).toBe(true);
    expect(report.editorSummary).toBeTruthy();
    expect(report.confidence).toBeTruthy();
    expect(report.profile).toBe(profile);
  });
});

describe("Phase AI-4 output contract", () => {
  test("namespaced object exposes required fields", () => {
    const report = analyze("ADMIT_CARD").editorialIntelligence;
    for (const field of [
      "qualityScores",
      "validationIssues",
      "missingInformation",
      "editorSuggestions",
      "editorSummary",
      "confidence",
      "advisoryOnly",
      "appliesChanges"
    ]) {
      expect(report).toHaveProperty(field);
    }
  });

  test("enrichment is additive and does not mutate the original", () => {
    const original = Object.freeze({
      draftText: DRAFTS.RESULT,
      title: "RRB Result",
      sourceUrl: "https://www.rrbcdg.gov.in/result"
    });
    const enriched = enrichWithEditorialIntelligence(original, { now: NOW, profile: "result" });
    for (const [key, value] of Object.entries(original)) {
      expect(enriched[key]).toBe(value);
    }
    expect(Object.keys(enriched)).toHaveLength(Object.keys(original).length + 1);
    expect(EDITORIAL_FIELD).toBe("editorialIntelligence");
    expect(readEditorialIntelligence(enriched).phase).toBe(PHASE);
  });

  test("attach helper keeps original keys", () => {
    const event = { id: 1, draftText: DRAFTS.CORRECTION };
    const snapshot = JSON.stringify(event);
    const attached = attachEditorialIntelligence(event, analyze("CORRECTION").editorialIntelligence);
    expect(JSON.stringify(event)).toBe(snapshot);
    expect(attached[EDITORIAL_FIELD].profile).toBe(DRAFT_PROFILES.CORRECTION);
    expect(readEditorialIntelligence({})).toBeNull();
  });

  test("does not mutate draft text fixtures", () => {
    const snapshot = DRAFTS.NEW_RECRUITMENT;
    analyze("NEW_RECRUITMENT");
    expect(DRAFTS.NEW_RECRUITMENT).toBe(snapshot);
  });
});

describe("Phase AI-4 Production Workflow compatibility", () => {
  test("Production Workflow behaves identically with and without editorial intelligence", async () => {
    const buildEvent = (extra) => ({
      sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
      title: "UPPSC Combined State Upper Subordinate Services Examination 2026",
      contentType: "text/html",
      html: AI2_NOTICES.UPPSC_NEW_RECRUITMENT.html,
      forceChangeDetected: true,
      allowTelegramDelivery: true,
      telegramTransport: telegramNotification.createMemoryTransport(),
      ...extra
    });

    const baseline = await runProductionWorkflow({
      monitoringEvent: buildEvent(),
      workflowId: "ai4_compat_baseline"
    });
    const enriched = await runProductionWorkflow({
      monitoringEvent: enrichWithEditorialIntelligence(buildEvent(), {
        now: NOW,
        profile: "new_recruitment",
        title: "UPPSC Combined State Upper Subordinate Services Examination 2026"
      }),
      workflowId: "ai4_compat_enriched"
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
    expect(baseline.published).toBe(false);
  });

  test("AUTO_PUBLISH remains disabled", () => {
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("module is require-only and does not alter Generator pipeline output shape", () => {
    const before = runGeneratorIntelligencePipeline(AI1_SAMPLES.SSC);
    analyzeEditorialDraft(before.result, { now: NOW, profile: "new_recruitment" });
    const after = runGeneratorIntelligencePipeline(AI1_SAMPLES.SSC);
    expect(after.result).toBe(before.result);
    expect(after.meta.formatId).toBe(before.meta.formatId);
  });
});
