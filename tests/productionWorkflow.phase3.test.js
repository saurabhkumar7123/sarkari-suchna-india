"use strict";

/**
 * PWP Phase 3 — Generator Integration & Draft Preparation tests.
 */

const {
  prepareGeneratorDraft,
  buildUpdatePackage,
  buildGeneratorContract,
  validateGeneratorDraftInput,
  decisionToDraftType,
  createDraftId,
  RESOLUTION_DECISIONS,
  PAGE_SECTIONS,
  planUpdateScope,
  DRAFT_TYPES,
  SECTION_ACTIONS,
  EDITORIAL_NOTE_CODES,
  GENERATOR_INTEGRATION_ENGINE_ID,
  GENERATOR_INTEGRATION_PHASE,
  DRAFT_PACKAGE_FORMAT_ID,
  GENERATOR_CONTRACT_FORMAT_ID,
  buildGeneratorDraftFromCanonical,
  resolveRecruitment,
  PHASE,
  ORCHESTRATOR_VERSION,
  RESOLUTION_ENGINE_ID
} = require("../server/lib/productionWorkflow");

const { CHANGE_TYPES } = require("../server/lib/contentIntelligence/multiSourceCorrelation/correlationTypes");

function baseCanonical(overrides = {}) {
  return {
    formatId: "cip_generator_ready_document_v1",
    metadata: {
      title: "SSC CGL Recruitment 2026 Notification",
      organization: "SSC",
      importantDates: { lastDate: "21/07/2026", applicationEnd: "21/07/2026" }
    },
    generatorText: `[Section: Short Information]
Staff Selection Commission CGL 2026
[Section: Important Dates]
Last Date : 21/07/2026
[Section: Vacancy Details]
Total Posts: 4500
[Section: Important Links]
Apply Online=https://ssc.gov.in/apply`,
    generatorMetadata: {
      title: "SSC CGL Recruitment 2026 Notification",
      organization: "SSC"
    },
    ...overrides
  };
}

function baseWorkflowContext(overrides = {}) {
  return {
    workflowId: "pwp_wf_phase3_001",
    monitoringEvent: {
      workflowId: "pwp_wf_phase3_001",
      title: "SSC CGL Recruitment 2026 Notification",
      sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html"
    },
    orchestratorId: "PWP_PRODUCTION_WORKFLOW_ENGINE",
    phase: "PHASE_2",
    ...overrides
  };
}

function baseResolution(decision, extras = {}) {
  return {
    engineId: RESOLUTION_ENGINE_ID,
    decision,
    reason: extras.reason || "test",
    confidence: "high",
    identity: {
      recruitmentKey: "ssc-cgl-2026",
      organization: "SSC",
      advertisementNumber: "SSC/CGL/2026/01",
      recruitmentName: "SSC CGL Recruitment 2026",
      postName: "Assistant"
    },
    match: extras.match || null,
    pageMatch: extras.pageMatch || null,
    updatePlan: extras.updatePlan || null,
    routing: extras.routing || {
      createDraft: true,
      includesGenerator: true
    },
    ...extras
  };
}

describe("PWP Phase 3 — Generator Integration Layer", () => {
  test("engine identity and catalogs", () => {
    expect(GENERATOR_INTEGRATION_ENGINE_ID).toBe("PWP_GENERATOR_INTEGRATION_LAYER");
    expect(GENERATOR_INTEGRATION_PHASE).toBe("PHASE_3");
    expect(DRAFT_PACKAGE_FORMAT_ID).toBe("pwp_generator_draft_package_v1");
    expect(GENERATOR_CONTRACT_FORMAT_ID).toBe("pwp_generator_contract_v1");
    expect(Object.keys(DRAFT_TYPES).sort()).toEqual(
      [
        "FULL_PAGE_DRAFT",
        "FULL_RECRUITMENT_DRAFT",
        "NONE",
        "PAGE_UPDATE_DRAFT",
        "RECRUITMENT_METADATA_UPDATE",
        "REVIEW_ONLY"
      ].sort()
    );
    expect(Object.values(SECTION_ACTIONS).sort()).toEqual(
      ["ADD", "NO_CHANGE", "REMOVE", "UPDATE"].sort()
    );
  });

  test("backward compatibility — Phase 1/2 exports unchanged", () => {
    expect(PHASE).toBe("PHASE_2");
    expect(ORCHESTRATOR_VERSION).toBe("2.0.0");
    expect(RESOLUTION_ENGINE_ID).toBe("PWP_RECRUITMENT_RESOLUTION_ENGINE");
    expect(typeof buildGeneratorDraftFromCanonical).toBe("function");
    expect(typeof resolveRecruitment).toBe("function");
    expect(typeof planUpdateScope).toBe("function");
  });

  test("new recruitment draft — full package + generator contract", () => {
    const resolution = baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: resolution,
      canonicalRecruitmentPackage: baseCanonical()
    });

    expect(result.skipped).toBe(false);
    expect(result.validationReport.valid).toBe(true);
    expect(result.draftPackage).toBeTruthy();
    expect(result.draftPackage.draftType).toBe(DRAFT_TYPES.FULL_RECRUITMENT_DRAFT);
    expect(result.draftPackage.decision).toBe(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    expect(result.draftPackage.generatorPayload.title).toContain("SSC CGL");
    expect(result.draftPackage.generatorPayload.data).toContain("[Section:");
    expect(result.draftPackage.editorialNotes).toContain(EDITORIAL_NOTE_CODES.NEW_RECRUITMENT);
    expect(result.draftPackage.effects.rendersHtml).toBe(false);
    expect(result.draftPackage.effects.publishes).toBe(false);
    expect(result.draftPackage.effects.usesAi).toBe(false);

    expect(result.generatorContract.callGenerator).toBe(true);
    expect(result.generatorContract.package).toBeTruthy();
    expect(result.generatorContract.boundaries.mayAccessMonitoring).toBe(false);
    expect(result.generatorContract.boundaries.mayAccessProgram1).toBe(false);
    expect(result.generatorContract.boundaries.mayAccessProgram2).toBe(false);
    expect(result.generatorContract.boundaries.mayAccessProgram3).toBe(false);
    expect(result.generatorContract.boundaries.mayAccessResolutionEngine).toBe(false);
    expect(result.generatorContract.effects.invokesGeneratorEngine).toBe(false);
  });

  test("new page draft — full page package", () => {
    const resolution = baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_PAGE, {
      match: { matched: true, recruitmentId: "rec-100" },
      pageMatch: { matched: false }
    });

    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext({
        existingRecruitment: {
          recruitmentId: "rec-100",
          advertisementNumber: "SSC/CGL/2026/01"
        }
      }),
      resolutionDecision: resolution,
      canonicalRecruitmentPackage: baseCanonical(),
      recruitmentId: "rec-100"
    });

    expect(result.draftPackage.draftType).toBe(DRAFT_TYPES.FULL_PAGE_DRAFT);
    expect(result.draftPackage.recruitmentId).toBe("rec-100");
    expect(result.draftPackage.editorialNotes).toEqual(
      expect.arrayContaining([
        EDITORIAL_NOTE_CODES.EXISTING_RECRUITMENT,
        EDITORIAL_NOTE_CODES.NEW_PAGE
      ])
    );
    expect(result.generatorContract.callGenerator).toBe(true);
  });

  test("existing page update — affected sections only with section actions", () => {
    const detectedChanges = [
      {
        changeType: CHANGE_TYPES.IMPORTANT_DATE,
        field: "importantDates.lastDate",
        previousValue: "2026-07-21",
        currentValue: "2026-07-31"
      },
      {
        changeType: CHANGE_TYPES.VACANCY_COUNT,
        field: "totalPosts",
        previousValue: "4500",
        currentValue: "5000"
      },
      {
        changeType: CHANGE_TYPES.APPLICATION_FEE,
        field: "fee.general",
        previousValue: "100",
        currentValue: "150"
      }
    ];

    const existingPage = {
      pageId: "page-55",
      sections: [
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.APPLICATION_FEE,
        PAGE_SECTIONS.VACANCY_DETAILS,
        PAGE_SECTIONS.IMPORTANT_LINKS
      ]
    };

    const updatePlan = planUpdateScope({ existingPage, detectedChanges });
    const resolution = baseResolution(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE, {
      match: { matched: true, recruitmentId: "rec-100" },
      pageMatch: { matched: true, pageId: "page-55" },
      updatePlan
    });

    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: resolution,
      canonicalRecruitmentPackage: baseCanonical(),
      updatePlan,
      existingPageMetadata: existingPage,
      recruitmentId: "rec-100"
    });

    expect(result.draftPackage.draftType).toBe(DRAFT_TYPES.PAGE_UPDATE_DRAFT);
    expect(result.draftPackage.updatePackage.affectedSections).toEqual([
      PAGE_SECTIONS.APPLICATION_FEE,
      PAGE_SECTIONS.IMPORTANT_DATES,
      PAGE_SECTIONS.VACANCY_DETAILS
    ]);
    expect(result.draftPackage.updatePackage.unaffectedSections).toEqual(
      expect.arrayContaining([
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.IMPORTANT_LINKS
      ])
    );
    expect(result.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.IMPORTANT_DATES]).toBe(
      SECTION_ACTIONS.UPDATE
    );
    expect(result.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.VACANCY_DETAILS]).toBe(
      SECTION_ACTIONS.UPDATE
    );
    expect(result.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.APPLICATION_FEE]).toBe(
      SECTION_ACTIONS.UPDATE
    );
    expect(result.draftPackage.updatePackage.sectionActions[PAGE_SECTIONS.SHORT_INFORMATION]).toBe(
      SECTION_ACTIONS.NO_CHANGE
    );
    expect(result.draftPackage.updatePackage.overwriteUnrelatedSections).toBe(false);
    expect(result.draftPackage.editorialNotes).toEqual(
      expect.arrayContaining([
        EDITORIAL_NOTE_CODES.UPDATED_DATES,
        EDITORIAL_NOTE_CODES.UPDATED_VACANCY_COUNT,
        EDITORIAL_NOTE_CODES.UPDATED_FEE
      ])
    );
    expect(result.draftPackage.generatorPayload.affectedSections).toEqual(
      result.draftPackage.updatePackage.affectedSections
    );
    expect(result.generatorContract.callGenerator).toBe(true);
  });

  test("section update planning — ADD / UPDATE / REMOVE / NO_CHANGE", () => {
    const existingPage = {
      pageId: "page-77",
      sections: [
        PAGE_SECTIONS.SHORT_INFORMATION,
        PAGE_SECTIONS.IMPORTANT_DATES,
        PAGE_SECTIONS.ELIGIBILITY
      ]
    };
    const detectedChanges = [
      {
        changeType: CHANGE_TYPES.IMPORTANT_DATE,
        field: "importantDates.lastDate",
        previousValue: "a",
        currentValue: "b"
      },
      {
        changeType: CHANGE_TYPES.SECTION_ADDED,
        previousValue: null,
        currentValue: "Important Links"
      },
      {
        changeType: CHANGE_TYPES.SECTION_REMOVED,
        previousValue: "Eligibility",
        currentValue: null
      }
    ];
    const updatePlan = planUpdateScope({ existingPage, detectedChanges });
    const updatePackage = buildUpdatePackage({ updatePlan, existingPage });

    expect(updatePackage.sectionActions[PAGE_SECTIONS.IMPORTANT_DATES]).toBe(SECTION_ACTIONS.UPDATE);
    expect(updatePackage.sectionActions[PAGE_SECTIONS.IMPORTANT_LINKS]).toBe(SECTION_ACTIONS.ADD);
    expect(updatePackage.sectionActions[PAGE_SECTIONS.ELIGIBILITY]).toBe(SECTION_ACTIONS.REMOVE);
    expect(updatePackage.sectionActions[PAGE_SECTIONS.SHORT_INFORMATION]).toBe(
      SECTION_ACTIONS.NO_CHANGE
    );
  });

  test("recruitment metadata update package", () => {
    const updatePlan = planUpdateScope({
      existingPage: { pageId: "page-1", sections: [PAGE_SECTIONS.SHORT_INFORMATION] },
      detectedChanges: [
        {
          changeType: CHANGE_TYPES.VACANCY_COUNT,
          field: "totalPosts",
          previousValue: "100",
          currentValue: "120"
        }
      ]
    });

    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext({
        existingRecruitment: { recruitmentId: "rec-200" }
      }),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT, {
        match: { matched: true, recruitmentId: "rec-200" },
        updatePlan
      }),
      canonicalRecruitmentPackage: baseCanonical(),
      updatePlan,
      recruitmentId: "rec-200"
    });

    expect(result.draftPackage.draftType).toBe(DRAFT_TYPES.RECRUITMENT_METADATA_UPDATE);
    expect(result.draftPackage.generatorPayload.metadataUpdateOnly).toBe(true);
    expect(result.draftPackage.generatorPayload.data).toBe("");
    expect(result.draftPackage.editorialNotes).toContain(
      EDITORIAL_NOTE_CODES.RECRUITMENT_METADATA_UPDATE
    );
    expect(result.generatorContract.callGenerator).toBe(true);
  });

  test("duplicate ignored — no Generator package", () => {
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.IGNORE_DUPLICATE),
      canonicalRecruitmentPackage: baseCanonical()
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe(RESOLUTION_DECISIONS.IGNORE_DUPLICATE);
    expect(result.draftPackage).toBeNull();
    expect(result.generatorContract.callGenerator).toBe(false);
    expect(result.generatorContract.package).toBeNull();
    expect(result.editorialNotes).toContain(EDITORIAL_NOTE_CODES.DUPLICATE_IGNORED);
  });

  test("superseded ignored — no Generator package", () => {
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT),
      canonicalRecruitmentPackage: baseCanonical()
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe(RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT);
    expect(result.draftPackage).toBeNull();
    expect(result.generatorContract.callGenerator).toBe(false);
    expect(result.editorialNotes).toContain(EDITORIAL_NOTE_CODES.SUPERSEDED_IGNORED);
  });

  test("manual review package — review-only, no Generator call", () => {
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED),
      canonicalRecruitmentPackage: null
    });

    expect(result.skipped).toBe(false);
    expect(result.draftPackage.draftType).toBe(DRAFT_TYPES.REVIEW_ONLY);
    expect(result.draftPackage.generatorPayload.reviewOnly).toBe(true);
    expect(result.draftPackage.editorialNotes).toContain(EDITORIAL_NOTE_CODES.MANUAL_REVIEW);
    expect(result.draftPackage.effects.callsGenerator).toBe(false);
    expect(result.generatorContract.callGenerator).toBe(false);
    expect(result.generatorContract.package).toBeNull();
    expect(result.effects.reviewOnly).toBe(true);
  });

  test("validation failure — missing canonical package", () => {
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT),
      canonicalRecruitmentPackage: null
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("VALIDATION_FAILED");
    expect(result.draftPackage).toBeNull();
    expect(result.validationReport.valid).toBe(false);
    expect(result.validationReport.errors.map((e) => e.code)).toContain(
      "MISSING_CANONICAL_PACKAGE"
    );
    expect(result.generatorContract.callGenerator).toBe(false);
  });

  test("validation failure — missing update plan for page update", () => {
    const report = validateGeneratorDraftInput({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE,
      canonicalRecruitmentPackage: baseCanonical(),
      updatePlan: null,
      workflowId: "pwp_wf_phase3_001"
    });

    expect(report.valid).toBe(false);
    expect(report.errors.map((e) => e.code)).toContain("MISSING_UPDATE_PLAN");
  });

  test("validation failure — missing workflow id", () => {
    const report = validateGeneratorDraftInput({
      workflowContext: { monitoringEvent: { title: "x" } },
      resolutionDecision: RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT,
      canonicalRecruitmentPackage: baseCanonical()
    });

    expect(report.valid).toBe(false);
    expect(report.errors.map((e) => e.code)).toContain("MISSING_WORKFLOW_ID");
  });

  test("generator contract — single object boundaries", () => {
    const prepared = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT),
      canonicalRecruitmentPackage: baseCanonical()
    });

    const contract = buildGeneratorContract({
      draftPackage: prepared.draftPackage,
      validationReport: prepared.validationReport,
      callGenerator: true
    });

    expect(contract.formatId).toBe(GENERATOR_CONTRACT_FORMAT_ID);
    expect(contract.package.generatorPayload).toBeTruthy();
    expect(contract.package.updatePlan == null || typeof contract.package.updatePlan === "object").toBe(
      true
    );
    expect(Object.keys(contract.boundaries).sort()).toEqual(
      [
        "mayAccessMonitoring",
        "mayAccessProgram1",
        "mayAccessProgram2",
        "mayAccessProgram3",
        "mayAccessResolutionEngine",
        "mayPublish",
        "mayRenderFromSuppliedPackageOnly",
        "mayUseAi"
      ].sort()
    );
  });

  test("determinism — same inputs produce identical draft ids and packages", () => {
    const input = {
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT),
      canonicalRecruitmentPackage: baseCanonical()
    };

    const a = prepareGeneratorDraft(input);
    const b = prepareGeneratorDraft(input);

    expect(a.draftPackage.draftId).toBe(b.draftPackage.draftId);
    expect(a.draftPackage.draftId).toBe(
      createDraftId({
        workflowId: "pwp_wf_phase3_001",
        decision: RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT,
        recruitmentId: null,
        draftType: DRAFT_TYPES.FULL_RECRUITMENT_DRAFT
      })
    );
    expect(JSON.stringify(a.draftPackage.editorialNotes)).toBe(
      JSON.stringify(b.draftPackage.editorialNotes)
    );
    expect(JSON.stringify(a.generatorContract.package)).toBe(
      JSON.stringify(b.generatorContract.package)
    );
  });

  test("immutability — draft package is frozen", () => {
    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext(),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT),
      canonicalRecruitmentPackage: baseCanonical()
    });

    expect(Object.isFrozen(result.draftPackage)).toBe(true);
    expect(Object.isFrozen(result.draftPackage.editorialNotes)).toBe(true);
    expect(() => {
      result.draftPackage.decision = "HACKED";
    }).toThrow();
  });

  test("decisionToDraftType mapping", () => {
    expect(decisionToDraftType(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT)).toBe(
      DRAFT_TYPES.FULL_RECRUITMENT_DRAFT
    );
    expect(decisionToDraftType(RESOLUTION_DECISIONS.CREATE_NEW_PAGE)).toBe(
      DRAFT_TYPES.FULL_PAGE_DRAFT
    );
    expect(decisionToDraftType(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE)).toBe(
      DRAFT_TYPES.PAGE_UPDATE_DRAFT
    );
    expect(decisionToDraftType(RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT)).toBe(
      DRAFT_TYPES.RECRUITMENT_METADATA_UPDATE
    );
    expect(decisionToDraftType(RESOLUTION_DECISIONS.IGNORE_DUPLICATE)).toBe(DRAFT_TYPES.NONE);
    expect(decisionToDraftType(RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT)).toBe(DRAFT_TYPES.NONE);
    expect(decisionToDraftType(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED)).toBe(
      DRAFT_TYPES.REVIEW_ONLY
    );
  });

  test("editorial notes for result / admit card / answer key hints", () => {
    const updatePlan = planUpdateScope({
      existingPage: {
        pageId: "p1",
        sections: [PAGE_SECTIONS.SHORT_INFORMATION, PAGE_SECTIONS.IMPORTANT_LINKS]
      },
      detectedChanges: [
        {
          changeType: CHANGE_TYPES.OFFICIAL_LINK,
          field: "links.result",
          previousValue: null,
          currentValue: "https://example.gov.in/result"
        }
      ]
    });

    const result = prepareGeneratorDraft({
      workflowContext: baseWorkflowContext({
        monitoringEvent: {
          workflowId: "pwp_wf_phase3_001",
          title: "SSC CGL Result 2026",
          documentRole: "result",
          sourceUrl: "https://ssc.gov.in/result"
        }
      }),
      resolutionDecision: baseResolution(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE, {
        updatePlan,
        pageMatch: { matched: true, pageId: "p1" }
      }),
      canonicalRecruitmentPackage: baseCanonical(),
      updatePlan,
      existingPageMetadata: {
        pageId: "p1",
        sections: [PAGE_SECTIONS.SHORT_INFORMATION, PAGE_SECTIONS.IMPORTANT_LINKS]
      }
    });

    expect(result.draftPackage.editorialNotes).toEqual(
      expect.arrayContaining([
        EDITORIAL_NOTE_CODES.UPDATED_LINKS,
        EDITORIAL_NOTE_CODES.UPDATED_RESULT
      ])
    );
  });
});
