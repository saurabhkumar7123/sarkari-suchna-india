"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  prepareAiDraft,
  prepareAiDraftFromValidated,
  prepareAiDraftFromStructuredDocument,
  prepareAiDraftFromText,
  OUTPUT_FORMAT_ID,
  REQUIRED_OUTPUT_FORMAT,
  buildAiPayload
} = require("../server/lib/contentIntelligence/aiDraftPreparation");

const {
  structureDocument,
  ENGINE_ID: STAGE_1C_ENGINE_ID,
  STAGE_ID: STAGE_1C_STAGE_ID
} = require("../server/lib/contentIntelligence/structureIntelligence");

const {
  validateStructuredDocument,
  ENGINE_ID: STAGE_1E_ENGINE_ID,
  STAGE_ID: STAGE_1E_STAGE_ID
} = require("../server/lib/contentIntelligence/validationEngine");

const {
  classifyDocument,
  ENGINE_ID: STAGE_1A_ENGINE_ID,
  STAGE_ID: STAGE_1A_STAGE_ID
} = require("../server/lib/contentIntelligence/documentClassification");

const {
  extractMetadata,
  ENGINE_ID: STAGE_1B_ENGINE_ID,
  STAGE_ID: STAGE_1B_STAGE_ID
} = require("../server/lib/contentIntelligence/metadataIntelligence");

const RECRUITMENT_DOC = `[Section: Short Information]
Staff Selection Commission (SSC) has released the CGL 2026 notification. Interested candidates can apply online.

[Section: Important Dates]
Application Begin : 01/07/2026
Last Date to Apply : 21/07/2026
Exam Date : 14 September 2026

[Section: Application Fee]
General / OBC : 100/-
SC / ST : 0/-

[Section: Vacancy Details | table]
Post Name, UR, OBC, Total
Clerk, 10, 5, 15
Assistant, 20, 10, 30

[Section: How To Apply]
- Visit the official website
- Click on Apply Online

[Section: Important Links]
Apply Online=https://ssc.gov.in/apply
Official Website=https://ssc.gov.in

[Section: FAQ]
Q: What is the last date to apply?
A: 21 July 2026.
Q: Can I pay offline?
A: No, only online payment is accepted.
`;

const RESULT_DOC = `SSC CGL 2025 Result Declared

[Section: Result]
SSC has declared the CGL 2025 final result. Candidates can check their result online.

[Section: Important Links]
Result Link=https://ssc.gov.in/result
Official Website=https://ssc.gov.in
`;

const ADMIT_CARD_DOC = `SSC CGL Admit Card Download Notice

[Section: Admit Card]
Candidates can download the admit card from the official website using registration number and date of birth.

[Section: Important Links]
Admit Card=https://ssc.gov.in/admit-card
Official Website=https://ssc.gov.in
`;

const CORRECTION_DOC = `Correction Notice for SSC CGL Application Form

[Section: Correction]
Candidates may correct their application form details between 22/07/2026 and 24/07/2026 on the official portal.
`;

const UNKNOWN_DOC = `Random kitchen recipe notes about boiling vegetables and seasoning soup.`;

const WARNINGS_DOC = `[Section: Short Information]
A short recruitment notice without dates or links.
`;

const ORDERING_DOC = `[Section: Important Links]
Apply Online=https://example.gov.in/apply

[Section: FAQ]
Q: Why first?
A: Ordering test.

[Section: Short Information]
This short info should come first ideally.

[Section: Important Dates]
Last Date : 21/07/2026
`;

function sectionOrders(payload) {
  return payload.sections.map((s) => s.order);
}

function blockOrders(section) {
  return section.blocks.map((b) => b.order);
}

describe("CIP Stage 2A — Shared AI Draft Preparation Engine", () => {
  test("engine identity and taxonomy exports", () => {
    expect(ENGINE_ID).toBe("CIP_AI_DRAFT_PREPARATION_ENGINE");
    expect(STAGE_ID).toBe("CIP_2A");
    expect(ENGINE_VERSION).toBe("1.0.0");
    expect(OUTPUT_FORMAT_ID).toBe("cip_structured_page_draft_v1");
    expect(REQUIRED_OUTPUT_FORMAT.id).toBe(OUTPUT_FORMAT_ID);
    expect(Array.isArray(REQUIRED_OUTPUT_FORMAT.rules)).toBe(true);
  });

  test("recruitment document produces complete AI payload", () => {
    const result = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });

    expect(result.engineId).toBe(ENGINE_ID);
    expect(result.stageId).toBe(STAGE_ID);
    expect(result.payload.documentType).toBe("new_recruitment");
    expect(result.payload.documentTypeLabel).toBeTruthy();
    expect(result.payload.normalizedMetadata).toBeTruthy();
    expect(result.payload.sections.length).toBeGreaterThan(0);
    expect(result.payload.validationSummary).toBeTruthy();
    expect(result.payload.qualityScores).toBeTruthy();
    expect(Array.isArray(result.payload.warnings)).toBe(true);
    expect(result.payload.generatorCompatibility).toBeTruthy();
    expect(result.payload.publishReadiness).toBeTruthy();
    expect(Array.isArray(result.payload.reviewAreas)).toBe(true);

    const firstSection = result.payload.sections[0];
    expect(firstSection.blocks.length).toBeGreaterThan(0);
    expect(firstSection.blocks[0].originalContent.length).toBeGreaterThan(0);
    expect(firstSection).not.toHaveProperty("matchedIndicators");
    expect(firstSection).not.toHaveProperty("forceTable");
    expect(firstSection.blocks[0]).not.toHaveProperty("hasRichMarkup");
    expect(firstSection.blocks[0]).not.toHaveProperty("warnings");
  });

  test("result document payload", () => {
    const result = prepareAiDraftFromText(RESULT_DOC, {
      title: "SSC CGL 2025 Result",
      filename: "ssc-cgl-result.pdf"
    });
    expect(result.payload.documentType).toBe("result");
    expect(result.payload.sections.some((s) => s.sectionType === "result")).toBe(true);
    expect(result.promptContext.expectedPageType).toBe("result");
  });

  test("admit card document payload", () => {
    const result = prepareAiDraftFromText(ADMIT_CARD_DOC, {
      title: "SSC CGL Admit Card",
      filename: "ssc-admit-card.pdf"
    });
    expect(result.payload.documentType).toBe("admit_card");
    expect(result.payload.sections.some((s) => s.sectionType === "admit_card")).toBe(true);
    expect(result.promptContext.expectedPageType).toBe("admit card");
  });

  test("correction document payload", () => {
    const result = prepareAiDraftFromText(CORRECTION_DOC, {
      title: "Correction Notice SSC CGL",
      filename: "correction-notice.pdf"
    });
    expect(result.payload.documentType).toBe("correction_notice");
    expect(result.payload.sections.some((s) => s.sectionType === "correction")).toBe(true);
  });

  test("unknown document payload", () => {
    const result = prepareAiDraftFromText(UNKNOWN_DOC, {
      title: "Miscellaneous note"
    });
    expect(result.payload.documentType).toBe("unknown");
    expect(result.promptContext.reviewRecommendations.some((r) => /unknown/i.test(r))).toBe(
      true
    );
  });

  test("validation warnings are included in payload and prompt context", () => {
    const result = prepareAiDraftFromText(WARNINGS_DOC, {
      title: "Incomplete Recruitment Notice",
      filename: "recruitment-notice.pdf"
    });
    expect(result.payload.documentType).toBe("new_recruitment");
    expect(
      result.payload.warnings.length > 0 ||
        result.payload.validationWarnings.length > 0 ||
        result.payload.validationErrors.length > 0
    ).toBe(true);
    expect(Array.isArray(result.promptContext.validationWarnings)).toBe(true);
    expect(result.promptContext.validationWarnings.length).toBeGreaterThan(0);
  });

  test("ordering preservation for sections and blocks", () => {
    const structured = structureDocument({
      text: ORDERING_DOC,
      title: "Ordering Recruitment Notice",
      filename: "recruitment.pdf"
    });
    const validation = validateStructuredDocument(structured);
    const result = prepareAiDraftFromValidated(validation, structured);

    expect(sectionOrders(result.payload)).toEqual(
      structured.sections.map((s) => s.order)
    );

    for (let i = 0; i < structured.sections.length; i += 1) {
      const src = structured.sections[i];
      const out = result.payload.sections[i];
      expect(out.sectionType).toBe(src.sectionType);
      expect(blockOrders(out)).toEqual(src.blocks.map((b) => b.order));
      for (let j = 0; j < src.blocks.length; j += 1) {
        expect(out.blocks[j].originalContent).toBe(src.blocks[j].originalContent);
        expect(out.blocks[j].blockType).toBe(src.blocks[j].blockType);
      }
    }
  });

  test("payload determinism — identical inputs yield identical JSON", () => {
    const input = {
      text: RECRUITMENT_DOC,
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    };
    const a = prepareAiDraft(input);
    const b = prepareAiDraft(input);
    expect(JSON.stringify(a.payload)).toBe(JSON.stringify(b.payload));
    expect(JSON.stringify(a.promptContext)).toBe(JSON.stringify(b.promptContext));
  });

  test("payload immutability — frozen result rejects mutation", () => {
    const result = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(result.payload.sections)).toBe(true);
    expect(Object.isFrozen(result.promptContext)).toBe(true);

    expect(() => {
      result.payload.documentType = "hacked";
    }).toThrow();
    expect(() => {
      result.payload.sections.push({ order: 99 });
    }).toThrow();
    expect(() => {
      result.promptContext.language = "xx";
    }).toThrow();
  });

  test("never mutates structured document or validation result", () => {
    const structured = structureDocument({
      text: RECRUITMENT_DOC,
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const beforeDoc = JSON.stringify(structured);
    const validation = validateStructuredDocument(structured);
    const beforeVal = JSON.stringify(validation);

    prepareAiDraftFromValidated(validation, structured);

    expect(JSON.stringify(structured)).toBe(beforeDoc);
    expect(JSON.stringify(validation)).toBe(beforeVal);
  });

  test("preserves all content without rewriting", () => {
    const structured = structureDocument({
      text: RECRUITMENT_DOC,
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const result = prepareAiDraftFromStructuredDocument(structured);
    const joinedSrc = structured.sections
      .map((s) => s.blocks.map((b) => b.originalContent).join("\n"))
      .join("\n");
    const joinedOut = result.payload.sections
      .map((s) => s.blocks.map((b) => b.originalContent).join("\n"))
      .join("\n");
    expect(joinedOut).toBe(joinedSrc);
  });

  test("prompt context is deterministic and complete", () => {
    const result = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const ctx = result.promptContext;
    expect(ctx.documentType).toBe("new_recruitment");
    expect(ctx.expectedPageType).toBeTruthy();
    expect(ctx.language != null).toBe(true);
    expect(ctx.generatorExpectations).toBeTruthy();
    expect(ctx.generatorExpectations.noRawSourceText).toBe(true);
    expect(ctx.requiredOutputFormat.id).toBe(OUTPUT_FORMAT_ID);
    expect(Array.isArray(ctx.requiredOutputFormat.rules)).toBe(true);
    expect(Array.isArray(ctx.validationWarnings)).toBe(true);
    expect(Array.isArray(ctx.reviewRecommendations)).toBe(true);
  });

  test("does not expose parser / foundation internals in payload", () => {
    const result = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const json = JSON.stringify(result.payload);
    expect(json).not.toMatch(/matchedIndicators/);
    expect(json).not.toMatch(/normalizedText/);
    expect(json).not.toMatch(/CIP_STRUCTURE_INTELLIGENCE/);
    expect(json).not.toMatch(/extensions/);
    expect(result.payload).not.toHaveProperty("classification");
    expect(result.payload).not.toHaveProperty("stats");
  });

  test("shared engine: validated path and text path agree for same document", () => {
    const structured = structureDocument({
      text: RECRUITMENT_DOC,
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const validation = validateStructuredDocument(structured);
    const fromValidated = prepareAiDraftFromValidated(validation, structured);
    const fromText = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    expect(JSON.stringify(fromValidated.payload)).toBe(JSON.stringify(fromText.payload));
  });

  test("backward compatibility — Foundation stages remain intact and independent", () => {
    expect(STAGE_1A_ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_1A_STAGE_ID).toBe("CIP_1A");
    expect(STAGE_1B_ENGINE_ID).toBe("CIP_METADATA_INTELLIGENCE_ENGINE");
    expect(STAGE_1B_STAGE_ID).toBe("CIP_1B");
    expect(STAGE_1C_ENGINE_ID).toBe("CIP_STRUCTURE_INTELLIGENCE_ENGINE");
    expect(STAGE_1C_STAGE_ID).toBe("CIP_1C_1D");
    expect(STAGE_1E_ENGINE_ID).toBe("CIP_CONTENT_VALIDATION_ENGINE");
    expect(STAGE_1E_STAGE_ID).toBe("CIP_1E");

    const classified = classifyDocument({
      title: "SSC CGL 2026 Recruitment Notification",
      text: RECRUITMENT_DOC
    });
    expect(classified.documentType).toBe("new_recruitment");

    const meta = extractMetadata({
      title: "SSC CGL 2026 Recruitment Notification",
      text: RECRUITMENT_DOC,
      classification: classified
    });
    expect(meta.normalizedMetadata).toBeTruthy();

    const structured = structureDocument({
      text: RECRUITMENT_DOC,
      title: "SSC CGL 2026 Recruitment Notification",
      classification: classified,
      metadataResult: meta
    });
    expect(structured.stageId).toBe(STAGE_1C_STAGE_ID);

    const validation = validateStructuredDocument(structured);
    expect(validation.stageId).toBe(STAGE_1E_STAGE_ID);

    const draft = prepareAiDraftFromValidated(validation, structured);
    expect(draft.stageId).toBe(STAGE_ID);
    expect(draft.extensions.foundationStageIds).toEqual([
      "CIP_1A",
      "CIP_1B",
      "CIP_1C_1D",
      "CIP_1E"
    ]);
  });

  test("buildAiPayload strips duplicates and keeps validation summary scores", () => {
    const structured = structureDocument({
      text: WARNINGS_DOC,
      title: "Incomplete Recruitment Notice",
      filename: "recruitment-notice.pdf"
    });
    const validation = validateStructuredDocument(structured);
    const payload = buildAiPayload(structured, validation);
    expect(payload.validationSummary.errorCount).toBe(validation.summary.errorCount);
    expect(payload.qualityScores.overall).toBe(validation.qualityScores.overall);
    const unique = new Set(payload.warnings);
    expect(unique.size).toBe(payload.warnings.length);
  });
});
