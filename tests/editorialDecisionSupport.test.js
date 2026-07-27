"use strict";

const decision = require("../server/lib/contentIntelligence/editorialDecisionSupport");
const transformation = require("../server/lib/contentIntelligence/canonicalDraftTransformation");
const governance = require("../server/lib/contentIntelligence/aiResponseGovernance");
const stage2B = require("../server/lib/contentIntelligence/aiDraftGeneration");
const stage2A = require("../server/lib/contentIntelligence/aiDraftPreparation");
const structure = require("../server/lib/contentIntelligence/structureIntelligence");
const validation = require("../server/lib/contentIntelligence/validationEngine");

function recruitmentPayload(overrides = {}) {
  return {
    documentType: "new_recruitment",
    normalizedMetadata: {
      title: "SSC Clerk Recruitment 2026",
      organization: "Staff Selection Commission",
      detectedDocumentType: "new_recruitment",
      importantDates: { startDate: "2026-07-01", lastDate: "2026-07-21" }
    },
    sections: [
      {
        order: 0,
        sectionType: "short_information",
        title: "Short Information",
        generatorTitle: "Short Information",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "Staff Selection Commission invites applications for 45 posts.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 1,
        sectionType: "important_dates",
        title: "Important Dates",
        generatorTitle: "Important Dates",
        blocks: [
          {
            order: 0,
            blockType: "date_row",
            originalContent: "Start Date: 01/07/2026\nLast Date: 21/07/2026",
            normalizedContent: null
          }
        ]
      },
      {
        order: 2,
        sectionType: "application_fee",
        title: "Application Fee",
        generatorTitle: "Application Fee",
        blocks: [
          {
            order: 0,
            blockType: "key_value",
            originalContent: "General: 100\nOBC: 100\nSC/ST: 0",
            normalizedContent: null
          }
        ]
      },
      {
        order: 3,
        sectionType: "age_limit",
        title: "Age Limit",
        generatorTitle: "Age Limit",
        blocks: [
          {
            order: 0,
            blockType: "key_value",
            originalContent: "Minimum Age: 18\nMaximum Age: 27",
            normalizedContent: null
          }
        ]
      },
      {
        order: 4,
        sectionType: "qualification",
        title: "Qualification",
        generatorTitle: "Qualification",
        blocks: [
          {
            order: 0,
            blockType: "list",
            originalContent: "- 12th Pass\n- Graduate Preferred",
            normalizedContent: null
          }
        ]
      },
      {
        order: 5,
        sectionType: "vacancy_details",
        title: "Vacancy Details",
        generatorTitle: "Vacancy Details",
        blocks: [
          {
            order: 0,
            blockType: "table",
            originalContent:
              "---table---\nPost,Category,Posts\nClerk,UR,20\nClerk,OBC,15\n---endtable---",
            normalizedContent: null
          }
        ]
      },
      {
        order: 6,
        sectionType: "important_links",
        title: "Important Links",
        generatorTitle: "Important Links",
        blocks: [
          {
            order: 0,
            blockType: "link",
            originalContent: "Apply Online=https://ssc.gov.in/apply",
            normalizedContent: null
          }
        ]
      }
    ],
    ...overrides
  };
}

function recruitmentWithUnknowns() {
  const payload = recruitmentPayload();
  payload.sections.push({
    order: 7,
    sectionType: "custom_annexure",
    title: "Annexure A",
    generatorTitle: null,
    blocks: [
      {
        order: 0,
        blockType: "weird_block",
        originalContent: "Annexure content must remain.",
        normalizedContent: null
      }
    ]
  });
  return payload;
}

function resultPayload() {
  return {
    documentType: "result",
    normalizedMetadata: {
      title: "UPSC Result 2026",
      detectedDocumentType: "result"
    },
    sections: [
      {
        order: 0,
        sectionType: "result",
        title: "Result",
        generatorTitle: "Result",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "UPSC has released the final result.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 1,
        sectionType: "important_links",
        title: "Important Links",
        generatorTitle: "Important Links",
        blocks: [
          {
            order: 0,
            blockType: "link",
            originalContent: "Download Result=https://upsc.gov.in/result.pdf",
            normalizedContent: null
          }
        ]
      }
    ]
  };
}

function admitCardPayload() {
  return {
    documentType: "admit_card",
    normalizedMetadata: {
      title: "RRB Admit Card 2026",
      detectedDocumentType: "admit_card"
    },
    sections: [
      {
        order: 0,
        sectionType: "admit_card",
        title: "Admit Card",
        generatorTitle: "Admit Card",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "Admit cards are available for download.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 1,
        sectionType: "important_links",
        title: "Important Links",
        generatorTitle: "Important Links",
        blocks: [
          {
            order: 0,
            blockType: "link",
            originalContent: "Download Admit Card=https://rrb.gov.in/admit",
            normalizedContent: null
          }
        ]
      }
    ]
  };
}

function normalizedResponse(payload) {
  return {
    formatId: stage2B.NORMALIZED_RESPONSE_FORMAT_ID,
    version: stage2B.CONTRACT_VERSION,
    document: {
      documentType: payload.documentType,
      documentTypeLabel: payload.documentType,
      language: "en",
      title: payload.normalizedMetadata.title,
      pageStatusHint: "active"
    },
    metadata: JSON.parse(JSON.stringify(payload.normalizedMetadata)),
    sections: JSON.parse(JSON.stringify(payload.sections)),
    sectionCount: payload.sections.length,
    blockCount: payload.sections.reduce((sum, section) => sum + section.blocks.length, 0),
    warnings: [],
    notes: [],
    confidence: 0.91,
    unknownFields: [],
    extensions: {}
  };
}

function governAndTransform(payload, extra = {}) {
  const governed = governance.governAiResponseFromNormalized(normalizedResponse(payload), {
    payload,
    freeze: false
  });
  return {
    governed,
    transformed: transformation.transformFromGovernanceResult(governed, {
      freeze: false,
      ...extra
    })
  };
}

function runDecision(payload, extra = {}) {
  const { governed, transformed } = governAndTransform(payload, extra);
  return decision.supportEditorialDecision({
    ...transformed,
    governanceResult: governed,
    freeze: extra.freeze !== false,
    pipeline: extra.pipeline,
    validationResult: extra.validationResult
  });
}

describe("CIP Stage 2E — Editorial Decision Support Engine", () => {
  test("exports stable identity and priority taxonomy", () => {
    expect(decision.ENGINE_ID).toBe("CIP_EDITORIAL_DECISION_SUPPORT_ENGINE");
    expect(decision.STAGE_ID).toBe("CIP_2E");
    expect(decision.ENGINE_VERSION).toBe("1.0.0");
    expect(decision.DECISION_VERSION).toBe("1.0.0");
    expect(decision.DECISION_SUPPORT_FORMAT_ID).toBe("cip_editorial_decision_support_v1");
    expect(decision.REVIEW_PRIORITIES).toEqual({
      LOW: "LOW",
      NORMAL: "NORMAL",
      HIGH: "HIGH",
      URGENT: "URGENT"
    });
  });

  test("normal recruitment produces advisory decision support without publishing", () => {
    const result = runDecision(recruitmentPayload(), { freeze: false });
    expect(result.stageId).toBe("CIP_2E");
    expect(result.formatId).toBe("cip_editorial_decision_support_v1");
    expect(result.editorialAnalysis.documentType).toBe("new_recruitment");
    expect(result.decisionSupport.constraints.publishes).toBe(false);
    expect(result.decisionSupport.constraints.modifiesContent).toBe(false);
    expect(result.decisionSupport.constraints.autoApproves).toBe(false);
    expect(result.publishReadiness.humanApprovalMandatory).toBe(true);
    expect(result.publishReadiness.autoPublish).toBe(false);
    expect(result.publishReadiness.ready).toBe(false);
    expect(result.extensions.publishes).toBe(false);
    expect(["LOW", "NORMAL"]).toContain(result.reviewPriority);
  });

  test("high-risk recruitment with policy/date change is URGENT or HIGH", () => {
    const payload = recruitmentPayload();
    const baseline = JSON.parse(JSON.stringify(payload));
    const mutated = normalizedResponse(payload);
    mutated.metadata.importantDates = { startDate: "2026-08-01", lastDate: "2026-08-21" };
    mutated.sections[1].blocks[0].originalContent =
      "Start Date: 01/08/2026\nLast Date: 21/08/2026";

    const governed = governance.governAiResponseFromNormalized(mutated, {
      payload: baseline,
      freeze: false
    });
    const transformed = transformation.transformFromGovernanceResult(governed, { freeze: false });
    const result = decision.supportEditorialDecision({
      ...transformed,
      governanceResult: governed,
      freeze: false
    });

    expect(["HIGH", "URGENT"]).toContain(result.reviewPriority);
    expect(["HIGH", "CRITICAL"]).toContain(result.editorialRisk.overall);
    expect(result.changeSummary.policyViolations.length).toBeGreaterThan(0);
    expect(result.decisionSupport.keyFindings.length).toBeGreaterThan(0);
  });

  test("result document analysis and checklist include result status", () => {
    const result = runDecision(resultPayload(), { freeze: false });
    expect(result.editorialAnalysis.documentType).toBe("result");
    expect(result.reviewChecklist.some((c) => c.id === "verify_result_status")).toBe(true);
    expect(result.reviewChecklist.some((c) => c.id === "verify_links")).toBe(true);
    expect(result.reviewChecklist.some((c) => c.id === "manual_approval_required")).toBe(true);
  });

  test("admit card document analysis and checklist include admit card details", () => {
    const result = runDecision(admitCardPayload(), { freeze: false });
    expect(result.editorialAnalysis.documentType).toBe("admit_card");
    expect(result.reviewChecklist.some((c) => c.id === "verify_admit_card_details")).toBe(true);
    expect(result.reviewChecklist.some((c) => c.id === "verify_links")).toBe(true);
  });

  test("unknown sections and blocks appear in change summary and checklist", () => {
    const result = runDecision(recruitmentWithUnknowns(), { freeze: false });
    expect(result.editorialAnalysis.unknownSectionCount).toBeGreaterThan(0);
    expect(result.editorialAnalysis.unknownBlockCount).toBeGreaterThan(0);
    expect(result.changeSummary.unknownSections.length).toBeGreaterThan(0);
    expect(result.changeSummary.unknownBlocks.length).toBeGreaterThan(0);
    expect(result.reviewChecklist.some((c) => c.id === "verify_unknown_sections")).toBe(true);
    expect(result.reviewChecklist.some((c) => c.id === "verify_unknown_blocks")).toBe(true);
    expect(["NORMAL", "HIGH", "URGENT"]).toContain(result.reviewPriority);
  });

  test("missing metadata elevates priority and checklist organization item", () => {
    const payload = recruitmentPayload();
    delete payload.normalizedMetadata.organization;
    const result = runDecision(payload, { freeze: false });
    expect(result.editorialAnalysis.metadataCompleteness.complete).toBe(false);
    expect(result.editorialAnalysis.metadataCompleteness.missingFields).toContain("organization");
    expect(["HIGH", "URGENT"]).toContain(result.reviewPriority);
    expect(result.reviewChecklist.some((c) => c.id === "verify_organization")).toBe(true);
    expect(result.changeSummary.importantMetadataChanges.length).toBeGreaterThan(0);
  });

  test("generator incompatibility elevates priority and suggested review areas", () => {
    const payload = recruitmentPayload();
    payload.sections = payload.sections.filter((s) => s.sectionType !== "important_links");
    const result = runDecision(payload, { freeze: false });
    expect(
      result.editorialAnalysis.generatorCompatibility.status === "incompatible" ||
        result.editorialAnalysis.sectionCompleteness.complete === false ||
        result.keyFindings.some((f) => /generator|required_section/i.test(f.code))
    ).toBe(true);
    expect(["HIGH", "URGENT"]).toContain(result.reviewPriority);
    expect(
      result.suggestedReviewAreas.some(
        (a) => /generator|section|link/i.test(a.id) || /generator|section|link/i.test(a.text)
      )
    ).toBe(true);
  });

  test("low quality score elevates review priority", () => {
    const result = runDecision(recruitmentPayload(), {
      freeze: false,
      validationResult: {
        scores: {
          overall: 30,
          metadata: 30,
          section: 30,
          block: 30,
          generatorCompatibility: 30,
          publishReadiness: 30
        },
        findings: [
          {
            code: "META_MISSING",
            severity: "error",
            category: "metadata",
            message: "Simulated low quality finding"
          }
        ]
      }
    });
    expect(result.editorialAnalysis.qualityScores.overall).toBe(30);
    expect(result.reviewPriority).toBe("URGENT");
    expect(result.suggestedReviewAreas.some((a) => a.id === "area_quality")).toBe(true);
  });

  test("review priority is deterministic across LOW NORMAL HIGH URGENT rules", () => {
    const lowish = runDecision(admitCardPayload(), { freeze: false });
    expect(["LOW", "NORMAL"]).toContain(lowish.reviewPriority);

    const normalish = runDecision(recruitmentWithUnknowns(), { freeze: false });
    expect(["NORMAL", "HIGH", "URGENT"]).toContain(normalish.reviewPriority);

    const missingMeta = runDecision(
      (() => {
        const p = recruitmentPayload();
        delete p.normalizedMetadata.organization;
        return p;
      })(),
      { freeze: false }
    );
    expect(["HIGH", "URGENT"]).toContain(missingMeta.reviewPriority);

    const lowQuality = runDecision(resultPayload(), {
      freeze: false,
      validationResult: {
        scores: {
          overall: 20,
          metadata: 20,
          section: 20,
          block: 20,
          generatorCompatibility: 20,
          publishReadiness: 20
        },
        findings: []
      }
    });
    expect(lowQuality.reviewPriority).toBe("URGENT");
  });

  test("checklist items are generated only when relevant", () => {
    const admit = runDecision(admitCardPayload(), { freeze: false });
    const ids = admit.reviewChecklist.map((c) => c.id);
    expect(ids).toContain("verify_admit_card_details");
    expect(ids).not.toContain("verify_vacancy_count");
    expect(ids).not.toContain("verify_application_fee");
    expect(ids).not.toContain("verify_result_status");

    const recruitment = runDecision(recruitmentPayload(), { freeze: false });
    const rIds = recruitment.reviewChecklist.map((c) => c.id);
    expect(rIds).toContain("verify_important_dates");
    expect(rIds).toContain("verify_vacancy_count");
    expect(rIds).toContain("verify_application_fee");
    expect(rIds).toContain("verify_eligibility");
    expect(rIds).toContain("verify_links");
    expect(rIds).toContain("manual_approval_required");
  });

  test("telegram summary is compact, plain text, and non-publishing", () => {
    const result = runDecision(recruitmentPayload(), { freeze: false });
    const tg = result.telegramSummary;
    expect(tg.markdown).toBe(false);
    expect(tg.publishes).toBe(false);
    expect(tg.text).toContain("Type:");
    expect(tg.text).toContain("Organization:");
    expect(tg.text).toContain("Priority:");
    expect(tg.text).toContain("Readiness:");
    expect(tg.text).toContain("Manual approval required");
    expect(tg.text).not.toMatch(/[*_`#\[\]]/);
  });

  test("every recommendation includes explainability fields", () => {
    const result = runDecision(recruitmentWithUnknowns(), { freeze: false });
    result.suggestedReviewAreas.forEach((area) => {
      expect(area.explanation).toEqual(
        expect.objectContaining({
          reason: expect.any(String),
          supportingFinding: expect.anything(),
          severity: expect.any(String)
        })
      );
      expect(area.explanation).toHaveProperty("affectedSection");
    });
    result.keyFindings.forEach((finding) => {
      expect(finding.explanation.reason).toBeTruthy();
      expect(finding.explanation.supportingFinding).toBeTruthy();
      expect(finding.explanation.severity).toBeTruthy();
    });
    result.reviewChecklist.forEach((item) => {
      expect(item.explanation.reason).toBeTruthy();
      expect(item.explanation).toHaveProperty("supportingFinding");
      expect(item.explanation).toHaveProperty("severity");
      expect(item.explanation).toHaveProperty("affectedSection");
    });
  });

  test("identical input is deterministic and immutable by default", () => {
    const payload = recruitmentPayload();
    const { governed, transformed } = governAndTransform(payload);
    const first = decision.supportEditorialDecision({
      ...transformed,
      governanceResult: governed
    });
    const second = decision.supportEditorialDecision({
      ...transformed,
      governanceResult: governed
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      first.reviewPriority = "LOW";
    }).toThrow();
  });

  test("manual PDF and automation share the same decision engine", () => {
    const payload = resultPayload();
    const manual = runDecision(payload, { pipeline: "manual_pdf", freeze: false });
    const automation = runDecision(payload, { pipeline: "automation", freeze: false });
    const strip = (value) => {
      const copy = JSON.parse(JSON.stringify(value));
      copy.pipeline = null;
      return copy;
    };
    expect(manual.engineId).toBe(automation.engineId);
    expect(strip(manual)).toEqual(strip(automation));
  });

  test("accepts bare Generator-ready document from Stage 2D", () => {
    const { transformed } = governAndTransform(admitCardPayload());
    const result = decision.supportFromGeneratorReadyDocument(transformed.generatorReadyDocument, {
      freeze: false
    });
    expect(result.editorialAnalysis.documentType).toBe("admit_card");
    expect(result.extensions.executedModel).toBe(false);
  });

  test("Foundation and Stages 2A–2D remain backward compatible", () => {
    expect(structure.STAGE_ID).toBe("CIP_1C_1D");
    expect(validation.STAGE_ID || validation.ENGINE_ID).toBeTruthy();
    expect(stage2A.STAGE_ID).toBe("CIP_2A");
    expect(stage2B.STAGE_ID).toBe("CIP_2B");
    expect(stage2B.CONTRACT_VERSION).toBe("1.0.0");
    expect(governance.STAGE_ID).toBe("CIP_2C");
    expect(transformation.STAGE_ID).toBe("CIP_2D");
    expect(transformation.GENERATOR_READY_FORMAT_ID).toBe("cip_generator_ready_document_v1");
    expect(decision.STAGE_ID).toBe("CIP_2E");
  });

  test("exports no AI SDK, network, or publish surface", () => {
    const keys = Object.keys(decision);
    expect(keys.join(",")).not.toMatch(/openai|gemini|claude|anthropic|fetch|axios|apiKey|executeModel/i);
    expect(keys).not.toContain("publish");
    expect(keys).not.toContain("approve");
    expect(typeof decision.supportEditorialDecision).toBe("function");
  });

  test("does not modify Generator-ready document content", () => {
    const { transformed } = governAndTransform(recruitmentPayload());
    const before = JSON.stringify(transformed.generatorReadyDocument);
    decision.supportFromTransformationResult(transformed, { freeze: false });
    const after = JSON.stringify(transformed.generatorReadyDocument);
    expect(after).toBe(before);
  });
});
