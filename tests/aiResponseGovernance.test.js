"use strict";

const governance = require("../server/lib/contentIntelligence/aiResponseGovernance");
const stage2B = require("../server/lib/contentIntelligence/aiDraftGeneration");
const stage2A = require("../server/lib/contentIntelligence/aiDraftPreparation");

function baselinePayload() {
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
    ]
  };
}

function normalizedResponse(payload = baselinePayload()) {
  return {
    formatId: stage2B.NORMALIZED_RESPONSE_FORMAT_ID,
    version: stage2B.CONTRACT_VERSION,
    document: {
      documentType: payload.documentType,
      documentTypeLabel: "New Recruitment",
      language: "en",
      title: "SSC Clerk Recruitment 2026",
      pageStatusHint: "active"
    },
    metadata: JSON.parse(JSON.stringify(payload.normalizedMetadata)),
    sections: JSON.parse(JSON.stringify(payload.sections)),
    sectionCount: payload.sections.length,
    blockCount: payload.sections.reduce((sum, section) => sum + section.blocks.length, 0),
    warnings: [],
    notes: [],
    confidence: 0.9,
    unknownFields: [],
    extensions: {}
  };
}

function govern(response = normalizedResponse(), extra = {}) {
  return governance.governAiResponseFromNormalized(response, {
    payload: baselinePayload(),
    ...extra
  });
}

describe("CIP Stage 2C — Shared AI Response Governance Engine", () => {
  test("exports stable identity and a provider-independent capability profile", () => {
    expect(governance.ENGINE_ID).toBe("CIP_AI_RESPONSE_GOVERNANCE_ENGINE");
    expect(governance.STAGE_ID).toBe("CIP_2C");
    expect(governance.ENGINE_VERSION).toBe("1.0.0");
    expect(governance.GOVERNED_DRAFT_FORMAT_ID).toBe("cip_governed_ai_draft_v1");

    const profile = governance.buildCapabilityProfile({
      id: "descriptive-profile",
      supportsStructuredOutput: true,
      supportsVision: false
    });
    expect(profile.supportsStructuredOutput).toBe(true);
    expect(profile.supportsVision).toBe(false);
    expect(profile.supportsStreaming).toBeNull();
    expect(profile.descriptiveOnly).toBe(true);
    expect(profile.providerIntegrated).toBe(false);
  });

  test("valid response is governed and ready without changing source content", () => {
    const input = normalizedResponse();
    const result = govern(input);
    expect(result.stageId).toBe("CIP_2C");
    expect(result.readinessStatus.status).toBe("ready");
    expect(result.generatorCompatibility.status).toBe("compatible");
    expect(result.originalAiResponse).toEqual(input);
    expect(result.governedDraft.sections[0].blocks[0].originalContent).toBe(
      input.sections[0].blocks[0].originalContent
    );
    expect(result.extensions.executedModel).toBe(false);
  });

  test("missing required fields fail schema validation while optional fields get safe defaults", () => {
    const missingRequired = {
      formatId: stage2B.NORMALIZED_RESPONSE_FORMAT_ID,
      version: "1.0.0"
    };
    const result = governance.governAiResponseFromNormalized(missingRequired);
    expect(result.validationFindings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["schema.document_required", "schema.sections_required"])
    );
    expect(result.governedDraft.metadata).toBeNull();
    expect(result.governedDraft.warnings).toEqual([]);
    expect(result.governedDraft.notes).toEqual([]);
    expect(
      result.repairsApplied.some((item) => item.code === "repair.optional_object_default")
    ).toBe(true);
    expect(result.readinessStatus.status).toBe("blocked");
  });

  test("unknown fields never fail and remain available in original and governed drafts", () => {
    const input = normalizedResponse();
    input.futureField = { enabled: true };
    const result = govern(input);
    expect(result.readinessStatus.schemaValid).toBe(true);
    expect(result.validationFindings.some((item) => item.code === "schema.unknown_fields")).toBe(
      true
    );
    expect(result.originalAiResponse.futureField).toEqual({ enabled: true });
    expect(result.governedDraft.futureField).toEqual({ enabled: true });
  });

  test("incompatible schema major version is critical and blocked", () => {
    const input = normalizedResponse();
    input.version = "2.0.0";
    const result = govern(input);
    expect(
      result.validationFindings.some((item) => item.code === "schema.version_incompatible")
    ).toBe(true);
    expect(result.editorialRisks.overall).toBe("CRITICAL");
    expect(result.readinessStatus.status).toBe("blocked");
  });

  test("repairs ordering, duplicate indexes, whitespace, null arrays, and confidence", () => {
    const input = normalizedResponse();
    input.sections = [input.sections[2], input.sections[0], input.sections[1]];
    input.sections[0].order = 5;
    input.sections[1].order = 1;
    input.sections[2].order = 1;
    input.sections[0].blocks[0].order = 4;
    input.sections[0].blocks.push({
      order: 4,
      blockType: "link",
      originalContent: "  Official Site=https://ssc.gov.in  ",
      normalizedContent: null
    });
    input.document.title = "  SSC   Clerk\tRecruitment 2026 ";
    input.notes = null;
    input.confidence = 84;

    const result = govern(input);
    expect(result.governedDraft.sections.map((section) => section.order)).toEqual([0, 1, 2]);
    expect(result.governedDraft.sections[2].blocks.map((block) => block.order)).toEqual([0, 1]);
    expect(result.governedDraft.document.title).toBe("SSC Clerk Recruitment 2026");
    expect(result.governedDraft.notes).toEqual([]);
    expect(result.governedDraft.confidence).toBe(0.84);
    expect(result.repairsApplied.map((item) => item.code)).toEqual(
      expect.arrayContaining(["repair.order_index", "repair.whitespace", "repair.confidence"])
    );
  });

  test.each([
    [
      "date",
      (draft) => {
        draft.sections[1].blocks[0].originalContent = "Start Date: 02/07/2026";
      },
      "policy.dates_changed"
    ],
    [
      "number",
      (draft) => {
        draft.sections[0].blocks[0].originalContent = "Applications for 99 posts.";
      },
      "policy.numbers_changed"
    ],
    [
      "URL",
      (draft) => {
        draft.sections[2].blocks[0].originalContent = "Apply Online=https://fake.example/apply";
      },
      "policy.urls_changed"
    ],
    [
      "organization",
      (draft) => {
        draft.metadata.organization = "Unknown Board";
      },
      "policy.organization_changed"
    ]
  ])("detects changed %s facts", (_label, mutate, expectedCode) => {
    const input = normalizedResponse();
    mutate(input);
    const result = govern(input);
    expect(result.policyFindings.some((item) => item.code === expectedCode)).toBe(true);
    expect(result.editorialRisks.overall).toBe("CRITICAL");
    expect(result.readinessStatus.status).toBe("blocked");
  });

  test("detects removed sections, content deletion, additions, and hallucination indicators", () => {
    const removed = normalizedResponse();
    removed.sections.splice(1, 1);
    const removedResult = govern(removed);
    expect(
      removedResult.policyFindings.some((item) => item.code === "policy.section_removed")
    ).toBe(true);

    const changed = normalizedResponse();
    changed.sections[0].blocks = [];
    changed.sections.push({
      order: 3,
      sectionType: "notice",
      title: "Notice",
      generatorTitle: "Notice",
      blocks: [
        {
          order: 0,
          blockType: "paragraph",
          originalContent: "Unverified claim.",
          normalizedContent: null
        }
      ]
    });
    const changedResult = govern(changed);
    expect(changedResult.policyFindings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "policy.content_deleted",
        "policy.unexpected_section",
        "policy.potential_hallucination"
      ])
    );
  });

  test("reports unsupported sections/blocks, missing title mappings, and broken grammar", () => {
    const input = normalizedResponse();
    input.sections[0].sectionType = "made_up_section";
    input.sections[0].generatorTitle = null;
    input.sections[2].blocks[0].originalContent = "not a link";
    input.sections[2].blocks.push({
      order: 1,
      blockType: "made_up_block",
      originalContent: "text",
      normalizedContent: null
    });
    const result = govern(input);
    const codes = result.generatorCompatibility.findings.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "generator.unsupported_section",
        "generator.title_mapping_missing",
        "generator.invalid_grammar",
        "generator.unsupported_block"
      ])
    );
    expect(result.generatorCompatibility.status).toBe("incompatible");
  });

  test("editorial model assigns LOW, MEDIUM, HIGH, and CRITICAL deterministically", () => {
    const compatibility = { status: "partial" };
    const assessment = governance.assessEditorialRisk(
      [
        { code: "schema.unknown_fields", severity: "info", category: "schema", message: "Unknown" },
        {
          code: "policy.potential_hallucination",
          severity: "warning",
          category: "policy",
          message: "Possible"
        },
        {
          code: "policy.section_removed",
          severity: "error",
          category: "policy",
          message: "Missing"
        },
        { code: "policy.urls_changed", severity: "error", category: "policy", message: "URL" }
      ],
      compatibility
    );
    expect(assessment.risks.map((risk) => risk.level)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL"
    ]);
    expect(assessment.overallRisk).toBe("CRITICAL");
  });

  test("identical input is deterministic, immutable, and preserves the unmodified original", () => {
    const input = normalizedResponse();
    input.document.title = "  SSC   Clerk Recruitment 2026 ";
    const before = JSON.stringify(input);
    const first = govern(input);
    const second = govern(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(input)).toBe(before);
    expect(first.originalAiResponse.document.title).toBe("  SSC   Clerk Recruitment 2026 ");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.governedDraft)).toBe(true);
    expect(() => {
      first.governedDraft.confidence = 0;
    }).toThrow();
  });

  test("manual PDF and automation use exactly the same engine and result shape", () => {
    const manual = govern(normalizedResponse(), { pipeline: "manual_pdf" });
    const automation = govern(normalizedResponse(), { pipeline: "automation" });
    const stripPipeline = (value) => {
      const copy = JSON.parse(JSON.stringify(value));
      copy.pipeline = null;
      return copy;
    };
    expect(manual.engineId).toBe(automation.engineId);
    expect(stripPipeline(manual)).toEqual(stripPipeline(automation));
  });

  test("accepts a Stage 2B generation result without modifying Stage 2B", () => {
    const payload = baselinePayload();
    const generated = stage2B.generateAiDraftPackageFromPayload(
      payload,
      {},
      {
        pipeline: "automation",
        rawResponse: normalizedResponse(payload)
      }
    );
    const result = governance.governAiResponseFromGenerationResult(generated);
    expect(result.pipeline).toBe("automation");
    expect(result.extensions.baselineAvailable).toBe(true);
    expect(result.originalAiResponse.formatId).toBe(stage2B.NORMALIZED_RESPONSE_FORMAT_ID);
  });

  test("Foundation, Stage 2A, and Stage 2B contracts remain backward compatible", () => {
    expect(stage2A.STAGE_ID).toBe("CIP_2A");
    expect(stage2B.STAGE_ID).toBe("CIP_2B");
    expect(stage2B.CONTRACT_VERSION).toBe("1.0.0");
    expect(stage2B.NORMALIZED_RESPONSE_FORMAT_ID).toBe("cip_normalized_ai_response_v1");
    expect(governance.STAGE_ID).toBe("CIP_2C");
  });

  test("exports no AI SDK, network, or provider execution surface", () => {
    const keys = Object.keys(governance).join(",");
    expect(keys).not.toMatch(/openai|gemini|claude|anthropic|fetch|axios|apiKey|executeModel/i);
  });
});
