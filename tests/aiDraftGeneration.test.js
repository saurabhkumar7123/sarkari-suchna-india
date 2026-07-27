"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CONTRACT_VERSION,
  generateAiDraftPackage,
  generateAiDraftPackageFromPrepared,
  generateAiDraftPackageFromPayload,
  generateAiDraftPackageFromText,
  normalizeDraftResponse,
  buildAiRequestPackage,
  normalizeAiResponse,
  buildDraftPolicy,
  buildExpectedOutputSchema,
  REQUEST_PACKAGE_FORMAT_ID,
  NORMALIZED_RESPONSE_FORMAT_ID,
  EXPECTED_OUTPUT_SCHEMA_ID,
  DRAFT_POLICY_ID,
  DRAFT_POLICY_RULES
} = require("../server/lib/contentIntelligence/aiDraftGeneration");

const {
  prepareAiDraft,
  prepareAiDraftFromText,
  ENGINE_ID: STAGE_2A_ENGINE_ID,
  STAGE_ID: STAGE_2A_STAGE_ID,
  ENGINE_VERSION: STAGE_2A_ENGINE_VERSION,
  OUTPUT_FORMAT_ID
} = require("../server/lib/contentIntelligence/aiDraftPreparation");

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

const UNKNOWN_DOC = `Random kitchen recipe notes about boiling vegetables and seasoning soup.`;

function mockAiResponseFromPayload(payload, extras = {}) {
  return {
    document: {
      documentType: payload.documentType,
      documentTypeLabel: payload.documentTypeLabel,
      language: payload.language,
      title: extras.title || null,
      pageStatusHint: payload.pageStatusHint
    },
    metadata: payload.normalizedMetadata,
    sections: (payload.sections || []).map((s) => ({
      order: s.order,
      sectionType: s.sectionType,
      title: s.title,
      generatorTitle: s.generatorTitle,
      blocks: (s.blocks || []).map((b) => ({
        order: b.order,
        blockType: b.blockType,
        originalContent: b.originalContent,
        normalizedContent: b.normalizedContent
      }))
    })),
    warnings: (payload.warnings || []).slice(),
    notes: extras.notes || [],
    confidence: Object.prototype.hasOwnProperty.call(extras, "confidence")
      ? extras.confidence
      : 0.91,
    ...extras.extraFields
  };
}

describe("CIP Stage 2B — Shared AI Draft Generation Engine", () => {
  test("engine identity and taxonomy exports", () => {
    expect(ENGINE_ID).toBe("CIP_AI_DRAFT_GENERATION_ENGINE");
    expect(STAGE_ID).toBe("CIP_2B");
    expect(ENGINE_VERSION).toBe("1.0.0");
    expect(CONTRACT_VERSION).toBe("1.0.0");
    expect(REQUEST_PACKAGE_FORMAT_ID).toBe("cip_ai_request_package_v1");
    expect(NORMALIZED_RESPONSE_FORMAT_ID).toBe("cip_normalized_ai_response_v1");
    expect(EXPECTED_OUTPUT_SCHEMA_ID).toBe("cip_ai_draft_output_schema_v1");
    expect(DRAFT_POLICY_ID).toBe("cip_ai_draft_policy_v1");
    expect(DRAFT_POLICY_RULES.length).toBeGreaterThanOrEqual(11);
  });

  test("recruitment payload produces complete AI request package", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const result = generateAiDraftPackageFromPrepared(prepared, {
      pipeline: "manual_pdf"
    });

    expect(result.engineId).toBe(ENGINE_ID);
    expect(result.stageId).toBe(STAGE_ID);
    expect(result.extensions.executedModel).toBe(false);
    expect(result.extensions.providerAgnostic).toBe(true);

    const pkg = result.requestPackage;
    expect(pkg.formatId).toBe(REQUEST_PACKAGE_FORMAT_ID);
    expect(pkg.version).toBe(CONTRACT_VERSION);
    expect(pkg.pipeline).toBe("manual_pdf");
    expect(Array.isArray(pkg.systemInstructions)).toBe(true);
    expect(pkg.systemInstructions.length).toBeGreaterThan(0);
    expect(pkg.userContext.documentType).toBe("new_recruitment");
    expect(pkg.structuredPayload.documentType).toBe("new_recruitment");
    expect(pkg.structuredPayload.sections.length).toBeGreaterThan(0);
    expect(pkg.promptContext.documentType).toBe("new_recruitment");
    expect(pkg.draftPolicy.id).toBe(DRAFT_POLICY_ID);
    expect(pkg.expectedOutputSchema.id).toBe(EXPECTED_OUTPUT_SCHEMA_ID);
    expect(pkg.expectedOutputSchema.outputFormatId).toBe(OUTPUT_FORMAT_ID);
    expect(result.normalizedResponse).toBeNull();
  });

  test("result payload request package", () => {
    const prepared = prepareAiDraftFromText(RESULT_DOC, {
      title: "SSC CGL 2025 Result",
      filename: "ssc-cgl-result.pdf"
    });
    const result = generateAiDraftPackageFromPrepared(prepared, {
      pipeline: "automation"
    });
    expect(result.requestPackage.structuredPayload.documentType).toBe("result");
    expect(result.requestPackage.userContext.expectedPageType).toBe("result");
    expect(result.requestPackage.pipeline).toBe("automation");
  });

  test("unknown document request package", () => {
    const prepared = prepareAiDraftFromText(UNKNOWN_DOC, {
      title: "Miscellaneous note"
    });
    const result = generateAiDraftPackageFromPrepared(prepared);
    expect(result.requestPackage.structuredPayload.documentType).toBe("unknown");
    expect(
      result.requestPackage.promptContext.reviewRecommendations.some((r) => /unknown/i.test(r))
    ).toBe(true);
  });

  test("draft policy includes all required rules", () => {
    const policy = buildDraftPolicy();
    const texts = policy.ruleTexts.join(" | ").toLowerCase();
    expect(texts).toContain("preserve factual content");
    expect(texts).toContain("do not invent information");
    expect(texts).toContain("do not remove sections");
    expect(texts).toContain("preserve dates");
    expect(texts).toContain("preserve links");
    expect(texts).toContain("preserve tables");
    expect(texts).toContain("preserve numbers");
    expect(texts).toContain("keep original language");
    expect(texts).toContain("generator-compatible");
    expect(texts).toContain("do not summarize");
    expect(texts).toContain("do not change meaning");
  });

  test("expected output schema supports document/metadata/sections/blocks/warnings/notes/confidence", () => {
    const schema = buildExpectedOutputSchema();
    expect(schema.fields.document).toBeTruthy();
    expect(schema.fields.metadata).toBeTruthy();
    expect(schema.fields.sections).toBeTruthy();
    expect(schema.fields.blocks).toBeTruthy();
    expect(schema.fields.warnings).toBeTruthy();
    expect(schema.fields.notes).toBeTruthy();
    expect(schema.fields.confidence).toBeTruthy();
    expect(schema.requiredRoots).toEqual(expect.arrayContaining(["document", "sections"]));
    expect(schema.optionalRoots).toEqual(
      expect.arrayContaining(["metadata", "warnings", "notes", "confidence"])
    );
  });

  test("normalization — recruitment response", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const raw = mockAiResponseFromPayload(prepared.payload, {
      title: "SSC CGL 2026",
      notes: ["Review vacancy totals"],
      confidence: 0.88
    });
    const result = generateAiDraftPackageFromPrepared(prepared, { rawResponse: raw });
    const norm = result.normalizedResponse;

    expect(norm.formatId).toBe(NORMALIZED_RESPONSE_FORMAT_ID);
    expect(norm.document.documentType).toBe("new_recruitment");
    expect(norm.sections.length).toBe(prepared.payload.sections.length);
    expect(norm.metadata).toBeTruthy();
    expect(norm.warnings).toEqual(expect.any(Array));
    expect(norm.notes).toContain("Review vacancy totals");
    expect(norm.confidence).toBe(0.88);
    expect(norm.blockCount).toBeGreaterThan(0);
  });

  test("normalization — result response", () => {
    const prepared = prepareAiDraftFromText(RESULT_DOC, {
      title: "SSC CGL 2025 Result",
      filename: "ssc-cgl-result.pdf"
    });
    const raw = mockAiResponseFromPayload(prepared.payload);
    const norm = normalizeDraftResponse(raw);
    expect(norm.document.documentType).toBe("result");
    expect(norm.sections.some((s) => s.sectionType === "result")).toBe(true);
  });

  test("normalization — unknown document response", () => {
    const prepared = prepareAiDraftFromText(UNKNOWN_DOC, { title: "Misc" });
    const raw = mockAiResponseFromPayload(prepared.payload, { confidence: null });
    const norm = normalizeAiResponse(raw);
    expect(norm.document.documentType).toBe("unknown");
    expect(norm.confidence).toBeNull();
  });

  test("normalization — missing optional fields", () => {
    const raw = {
      document: { documentType: "result", language: "en" },
      sections: [
        {
          sectionType: "result",
          blocks: [{ blockType: "paragraph", originalContent: "Result declared." }]
        }
      ]
    };
    const norm = normalizeAiResponse(raw);
    expect(norm.metadata).toBeNull();
    expect(norm.warnings).toEqual([]);
    expect(norm.notes).toEqual([]);
    expect(norm.confidence).toBeNull();
    expect(norm.extensions.missingOptional.metadata).toBe(true);
    expect(norm.extensions.missingOptional.warnings).toBe(true);
    expect(norm.extensions.missingOptional.notes).toBe(true);
    expect(norm.extensions.missingOptional.confidence).toBe(true);
    expect(norm.sections[0].blocks[0].originalContent).toBe("Result declared.");
  });

  test("normalization — extra unknown fields do not break parsing", () => {
    const raw = {
      document: { documentType: "new_recruitment", language: "hi" },
      sections: [
        {
          order: 0,
          sectionType: "short_information",
          title: "Short Info",
          blocks: [{ order: 0, blockType: "paragraph", originalContent: "Notice text" }]
        }
      ],
      providerMeta: { model: "should-be-ignored", tokens: 999 },
      weirdNested: { a: 1 },
      openaiChoices: [{ text: "nope" }]
    };
    const norm = normalizeAiResponse(raw);
    expect(norm.document.documentType).toBe("new_recruitment");
    expect(norm.document.language).toBe("hi");
    expect(norm.sections.length).toBe(1);
    expect(norm.unknownFields).toEqual(
      expect.arrayContaining(["openaiChoices", "providerMeta", "weirdNested"])
    );
    expect(norm).not.toHaveProperty("providerMeta");
    expect(norm).not.toHaveProperty("openaiChoices");
  });

  test("normalization — ordering of sections and blocks", () => {
    const raw = {
      document: { documentType: "new_recruitment" },
      sections: [
        {
          order: 2,
          sectionType: "important_links",
          blocks: [
            { order: 1, blockType: "link", originalContent: "B" },
            { order: 0, blockType: "link", originalContent: "A" }
          ]
        },
        {
          order: 0,
          sectionType: "short_information",
          blocks: [{ order: 5, blockType: "paragraph", originalContent: "First" }]
        },
        {
          order: 1,
          sectionType: "important_dates",
          blocks: [{ order: 0, blockType: "dates", originalContent: "Dates" }]
        }
      ]
    };
    const norm = normalizeAiResponse(raw);
    expect(norm.sections.map((s) => s.sectionType)).toEqual([
      "short_information",
      "important_dates",
      "important_links"
    ]);
    expect(norm.sections[2].blocks.map((b) => b.originalContent)).toEqual(["A", "B"]);
  });

  test("normalization — whitespace normalization", () => {
    const raw = {
      document: { documentType: "result", title: "  Result   Notice  " },
      sections: [
        {
          order: 0,
          sectionType: "result",
          title: "Result\t\tSection",
          blocks: [
            {
              order: 0,
              blockType: "paragraph",
              originalContent: "Line one.  \r\n  Line   two."
            }
          ]
        }
      ],
      warnings: ["  Extra   spaces  ", "Extra   spaces"],
      notes: ["  Keep note  "]
    };
    const norm = normalizeAiResponse(raw);
    expect(norm.document.title).toBe("Result Notice");
    expect(norm.sections[0].title).toBe("Result Section");
    expect(norm.sections[0].blocks[0].originalContent).toBe("Line one. \n Line two.");
    expect(norm.warnings).toEqual(["Extra spaces"]);
    expect(norm.notes).toEqual(["Keep note"]);
  });

  test("normalization — language preservation", () => {
    const raw = {
      document: {
        documentType: "new_recruitment",
        language: "hi",
        title: "भर्ती सूचना"
      },
      sections: [
        {
          order: 0,
          sectionType: "short_information",
          title: "संक्षिप्त जानकारी",
          blocks: [
            {
              order: 0,
              blockType: "paragraph",
              originalContent: "आवेदन ऑनलाइन करें।"
            }
          ]
        }
      ]
    };
    const norm = normalizeAiResponse(raw);
    expect(norm.document.language).toBe("hi");
    expect(norm.document.title).toBe("भर्ती सूचना");
    expect(norm.sections[0].title).toBe("संक्षिप्त जानकारी");
    expect(norm.sections[0].blocks[0].originalContent).toBe("आवेदन ऑनलाइन करें।");
  });

  test("request package determinism — identical inputs yield identical JSON", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const a = generateAiDraftPackageFromPrepared(prepared, { pipeline: "manual_pdf" });
    const b = generateAiDraftPackageFromPrepared(prepared, { pipeline: "manual_pdf" });
    expect(JSON.stringify(a.requestPackage)).toBe(JSON.stringify(b.requestPackage));
    expect(JSON.stringify(a.draftPolicy)).toBe(JSON.stringify(b.draftPolicy));
  });

  test("normalization determinism", () => {
    const raw = {
      document: { documentType: "result", language: "en" },
      sections: [
        {
          order: 1,
          sectionType: "result",
          blocks: [{ order: 0, blockType: "paragraph", originalContent: "Ok" }]
        },
        {
          order: 0,
          sectionType: "important_links",
          blocks: [{ order: 0, blockType: "link", originalContent: "Link" }]
        }
      ],
      confidence: { overall: 0.7 }
    };
    const a = normalizeAiResponse(raw);
    const b = normalizeAiResponse(raw);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.confidence).toBe(0.7);
  });

  test("immutability — frozen result rejects mutation", () => {
    const result = generateAiDraftPackageFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf",
      pipeline: "automation"
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.requestPackage)).toBe(true);
    expect(Object.isFrozen(result.requestPackage.draftPolicy)).toBe(true);
    expect(() => {
      result.requestPackage.version = "hacked";
    }).toThrow();
  });

  test("never mutates Stage 2A payload or prompt context", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    // Stage 2A freezes by default; clone via JSON for mutation-guard comparison
    const beforePayload = JSON.stringify(prepared.payload);
    const beforeCtx = JSON.stringify(prepared.promptContext);

    generateAiDraftPackageFromPayload(prepared.payload, prepared.promptContext, {
      pipeline: "manual_pdf"
    });

    expect(JSON.stringify(prepared.payload)).toBe(beforePayload);
    expect(JSON.stringify(prepared.promptContext)).toBe(beforeCtx);
  });

  test("shared engine: payload path and prepared path agree", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const fromPrepared = generateAiDraftPackageFromPrepared(prepared, {
      pipeline: "manual_pdf"
    });
    const fromPayload = generateAiDraftPackageFromPayload(
      prepared.payload,
      prepared.promptContext,
      { pipeline: "manual_pdf" }
    );
    expect(JSON.stringify(fromPrepared.requestPackage)).toBe(
      JSON.stringify(fromPayload.requestPackage)
    );
  });

  test("manual_pdf and automation pipelines share the same package shape", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const manual = generateAiDraftPackageFromPrepared(prepared, { pipeline: "manual_pdf" });
    const auto = generateAiDraftPackageFromPrepared(prepared, { pipeline: "automation" });

    const stripPipeline = (pkg) => {
      const clone = JSON.parse(JSON.stringify(pkg));
      clone.pipeline = null;
      return clone;
    };
    expect(JSON.stringify(stripPipeline(manual.requestPackage))).toBe(
      JSON.stringify(stripPipeline(auto.requestPackage))
    );
    expect(manual.requestPackage.pipeline).toBe("manual_pdf");
    expect(auto.requestPackage.pipeline).toBe("automation");
  });

  test("buildAiRequestPackage embeds payload sections without rewriting content", () => {
    const prepared = prepareAiDraftFromText(RECRUITMENT_DOC, {
      title: "SSC CGL 2026 Recruitment Notification",
      filename: "ssc-cgl-2026-recruitment.pdf"
    });
    const pkg = buildAiRequestPackage(prepared.payload, prepared.promptContext);
    const joinedSrc = prepared.payload.sections
      .map((s) => s.blocks.map((b) => b.originalContent).join("\n"))
      .join("\n");
    const joinedOut = pkg.structuredPayload.sections
      .map((s) => s.blocks.map((b) => b.originalContent).join("\n"))
      .join("\n");
    expect(joinedOut).toBe(joinedSrc);
  });

  test("string JSON response and nested envelopes normalize safely", () => {
    const asString = JSON.stringify({
      result: {
        document: { documentType: "result", language: "en" },
        sections: [
          {
            sectionType: "result",
            blocks: [{ blockType: "paragraph", originalContent: "Declared" }]
          }
        ]
      }
    });
    const norm = normalizeAiResponse(asString);
    expect(norm.document.documentType).toBe("result");
    expect(norm.sections[0].blocks[0].originalContent).toBe("Declared");
  });

  test("backward compatibility — Stage 2A and Foundation remain intact", () => {
    expect(STAGE_1A_ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
    expect(STAGE_1A_STAGE_ID).toBe("CIP_1A");
    expect(STAGE_1B_ENGINE_ID).toBe("CIP_METADATA_INTELLIGENCE_ENGINE");
    expect(STAGE_1B_STAGE_ID).toBe("CIP_1B");
    expect(STAGE_1C_ENGINE_ID).toBe("CIP_STRUCTURE_INTELLIGENCE_ENGINE");
    expect(STAGE_1C_STAGE_ID).toBe("CIP_1C_1D");
    expect(STAGE_1E_ENGINE_ID).toBe("CIP_CONTENT_VALIDATION_ENGINE");
    expect(STAGE_1E_STAGE_ID).toBe("CIP_1E");
    expect(STAGE_2A_ENGINE_ID).toBe("CIP_AI_DRAFT_PREPARATION_ENGINE");
    expect(STAGE_2A_STAGE_ID).toBe("CIP_2A");
    expect(STAGE_2A_ENGINE_VERSION).toBe("1.0.0");

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

    const prepared = prepareAiDraft({
      structuredDocument: structured,
      validationResult: validation
    });
    expect(prepared.stageId).toBe(STAGE_2A_STAGE_ID);

    const generated = generateAiDraftPackageFromPrepared(prepared);
    expect(generated.stageId).toBe(STAGE_ID);
    expect(generated.extensions.upstreamStageIds).toEqual([
      "CIP_1A",
      "CIP_1B",
      "CIP_1C_1D",
      "CIP_1E",
      "CIP_2A"
    ]);
  });

  test("no provider SDK / network surface in module exports", () => {
    const mod = require("../server/lib/contentIntelligence/aiDraftGeneration");
    const keys = Object.keys(mod).join(",");
    expect(keys).not.toMatch(/openai|gemini|claude|anthropic|fetch|axios|apiKey/i);
    expect(typeof mod.generateAiDraftPackage).toBe("function");
    expect(typeof mod.normalizeAiResponse).toBe("function");
  });
});
