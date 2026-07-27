"use strict";

const transformation = require("../server/lib/contentIntelligence/canonicalDraftTransformation");
const governance = require("../server/lib/contentIntelligence/aiResponseGovernance");
const stage2B = require("../server/lib/contentIntelligence/aiDraftGeneration");
const stage2A = require("../server/lib/contentIntelligence/aiDraftPreparation");
const structure = require("../server/lib/contentIntelligence/structureIntelligence");
const { parseSectionsFromText } = require("../generator/parse/sectionParse");

function recruitmentPayload() {
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
          },
          {
            order: 1,
            blockType: "rich_text",
            originalContent: "Apply before [b]21/07/2026[/b].",
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
        sectionType: "selection_process",
        title: "Selection Process",
        generatorTitle: "Selection Process",
        blocks: [
          {
            order: 0,
            blockType: "list",
            originalContent: "1. CBT\n2. Document Verification",
            normalizedContent: null
          }
        ]
      },
      {
        order: 7,
        sectionType: "how_to_apply",
        title: "How To Apply",
        generatorTitle: "How To Apply",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "Candidates must apply online through the official website.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 8,
        sectionType: "important_links",
        title: "Important Links",
        generatorTitle: "Important Links",
        blocks: [
          {
            order: 0,
            blockType: "link",
            originalContent: "Apply Online=https://ssc.gov.in/apply",
            normalizedContent: null
          },
          {
            order: 1,
            blockType: "multi_link",
            originalContent:
              "Notification|Hindi=https://ssc.gov.in/hi.pdf|English=https://ssc.gov.in/en.pdf",
            normalizedContent: null
          }
        ]
      },
      {
        order: 9,
        sectionType: "faq",
        title: "FAQ",
        generatorTitle: "FAQ",
        blocks: [
          {
            order: 0,
            blockType: "faq",
            originalContent: "Q: Who can apply?\nA: Indian citizens aged 18-27.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 10,
        sectionType: "exam_pattern",
        title: "Exam Pattern",
        generatorTitle: "Exam Pattern",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "CBT with 100 objective questions.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 11,
        sectionType: "syllabus",
        title: "Syllabus",
        generatorTitle: "Syllabus",
        blocks: [
          {
            order: 0,
            blockType: "list",
            originalContent: "- Reasoning\n- Quantitative Aptitude\n- English",
            normalizedContent: null
          }
        ]
      },
      {
        order: 12,
        sectionType: "important_instructions",
        title: "Important Instructions",
        generatorTitle: "Important Instructions",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "Keep a valid email and mobile number ready.",
            normalizedContent: null
          }
        ]
      },
      {
        order: 13,
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
      }
    ]
  };
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

function correctionPayload() {
  return {
    documentType: "correction_notice",
    normalizedMetadata: {
      title: "IBPS Correction Notice",
      detectedDocumentType: "correction_notice"
    },
    sections: [
      {
        order: 0,
        sectionType: "correction",
        title: "Correction",
        generatorTitle: "Correction",
        blocks: [
          {
            order: 0,
            blockType: "paragraph",
            originalContent: "Candidates may correct application details online.",
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
  return transformation.transformFromGovernanceResult(governed, extra);
}

describe("CIP Stage 2D — Canonical Draft Transformation Engine", () => {
  test("exports stable identity and supported Generator mappings", () => {
    expect(transformation.ENGINE_ID).toBe("CIP_CANONICAL_DRAFT_TRANSFORMATION_ENGINE");
    expect(transformation.STAGE_ID).toBe("CIP_2D");
    expect(transformation.ENGINE_VERSION).toBe("1.0.0");
    expect(transformation.TRANSFORMATION_VERSION).toBe("1.0.0");
    expect(transformation.GENERATOR_READY_FORMAT_ID).toBe("cip_generator_ready_document_v1");
    expect(transformation.SUPPORTED_GENERATOR_MAPPINGS).toEqual(
      expect.arrayContaining([
        "Paragraph",
        "Short Information",
        "Important Dates",
        "Table",
        "FAQ",
        "Link",
        "Multi Link",
        "List",
        "Rich Text",
        "Mixed",
        "Unknown",
        "Instructions"
      ])
    );
  });

  test("transforms recruitment governed draft into Generator-ready document", () => {
    const result = governAndTransform(recruitmentPayload());
    const doc = result.generatorReadyDocument;

    expect(result.stageId).toBe("CIP_2D");
    expect(doc.formatId).toBe("cip_generator_ready_document_v1");
    expect(doc.transformationVersion).toBe("1.0.0");
    expect(doc.mappedSections.length).toBe(14);
    expect(doc.generatorMetadata.title).toBe("SSC Clerk Recruitment 2026");
    expect(doc.generatorMetadata.organization).toBe("Staff Selection Commission");
    expect(doc.generatorCompatibility.compatible).toBe(true);
    expect(doc.generatorText).toMatch(/\[Section:\s*Short Information\]/i);
    expect(doc.generatorText).toContain(
      "Staff Selection Commission invites applications for 45 posts."
    );
    expect(doc.generatorText).toContain("Apply Online=https://ssc.gov.in/apply");
    expect(parseSectionsFromText(doc.generatorText).length).toBe(14);
  });

  test("maps Result, Admit Card, and Correction document types", () => {
    const resultDoc = governAndTransform(resultPayload());
    expect(resultDoc.mappedSections.map((s) => s.sectionType)).toEqual([
      "result",
      "important_links"
    ]);
    expect(resultDoc.generatorReadyDocument.generatorText).toMatch(/\[Section:\s*Result\]/i);

    const admitDoc = governAndTransform(admitCardPayload());
    expect(admitDoc.mappedSections[0].generatorTitle).toBe("Admit Card");
    expect(admitDoc.generatorReadyDocument.generatorText).toContain(
      "Download Admit Card=https://rrb.gov.in/admit"
    );

    const correctionDoc = governAndTransform(correctionPayload());
    expect(correctionDoc.mappedSections[0].sectionType).toBe("correction");
    expect(correctionDoc.mappedSections[0].generatorTitle).toBe("Correction");
  });

  test("preserves unknown sections and unknown blocks without dropping them", () => {
    const result = governAndTransform(recruitmentPayload());
    const unknownSection = result.mappedSections.find((s) => s.sectionType === "custom_annexure");
    expect(unknownSection).toBeTruthy();
    expect(unknownSection.generatorTitle).toBe("Annexure A");
    expect(unknownSection.blocks[0].blockType).toBe("weird_block");
    expect(unknownSection.blocks[0].originalContent).toBe("Annexure content must remain.");
    expect(result.generatorReadyDocument.generatorText).toContain("Annexure content must remain.");
    expect(
      result.transformationWarnings.some((w) => w.code === "transform.unknown_section_preserved")
    ).toBe(true);
    expect(
      result.transformationWarnings.some((w) => w.code === "transform.unknown_block_preserved")
    ).toBe(true);
  });

  test("preserves tables, FAQ, links, lists, and rich text content exactly", () => {
    const result = governAndTransform(recruitmentPayload());
    const byType = Object.fromEntries(result.mappedSections.map((s) => [s.sectionType, s]));

    expect(byType.vacancy_details.body).toContain("---table---");
    expect(byType.vacancy_details.body).toContain("Post,Category,Posts");
    expect(byType.faq.body).toBe("Q: Who can apply?\nA: Indian citizens aged 18-27.");
    expect(byType.important_links.blocks.map((b) => b.blockType)).toEqual([
      "link",
      "multi_link"
    ]);
    expect(byType.qualification.body).toBe("- 12th Pass\n- Graduate Preferred");
    expect(byType.short_information.blocks[1].originalContent).toBe(
      "Apply before [b]21/07/2026[/b]."
    );
    expect(byType.short_information.blocks[1].generatorContentType).toBe("mixed");
  });

  test("preserves section and block ordering from the governed draft", () => {
    const result = governAndTransform(recruitmentPayload());
    expect(result.mappedSections.map((s) => s.order)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
    ]);
    expect(result.mappedSections[0].blocks.map((b) => b.order)).toEqual([0, 1]);
    expect(result.mappedSections[8].blocks.map((b) => b.order)).toEqual([0, 1]);
    expect(result.transformationSummary.orderingPreserved).toBe(true);
  });

  test("retains traceability back to governed sections and blocks", () => {
    const result = governAndTransform(recruitmentPayload());
    expect(result.traceability.sourceStageId).toBe("CIP_2C");
    expect(result.traceability.reversible).toBe(true);
    expect(result.traceability.sections[8].source.governedSectionType).toBe("important_links");
    expect(result.traceability.sections[8].blocks[1].source.governedBlockType).toBe("multi_link");
    expect(result.mappedSections[5].blocks[0].sourceRef.governedSectionOrder).toBe(5);
  });

  test("reverse mapping restores governed section/block content", () => {
    const result = governAndTransform(recruitmentPayload());
    const reversed = transformation.reverseMappedSections(result.mappedSections);
    expect(reversed[0].blocks[0].originalContent).toBe(
      result.sourceGovernedDraft.sections[0].blocks[0].originalContent
    );
    expect(reversed[13].sectionType).toBe("custom_annexure");
    expect(reversed[13].blocks[0].blockType).toBe("weird_block");
    expect(result.generatorReadyDocument.reverse.sections.length).toBe(14);
  });

  test("Generator compatibility report is present and Generator text is parseable", () => {
    const result = governAndTransform(recruitmentPayload());
    const report = result.generatorCompatibility;
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("findings");
    expect(report).toHaveProperty("summary");
    expect(report.compatible).toBe(true);
    expect(report.parseability.hasSectionMarkers).toBe(true);
    expect(report.parseability.generatorSectionCount).toBe(14);
  });

  test("identical input is deterministic and immutable by default", () => {
    const payload = recruitmentPayload();
    const governed = governance.governAiResponseFromNormalized(normalizedResponse(payload), {
      payload,
      freeze: false
    });
    const first = transformation.transformFromGovernanceResult(governed);
    const second = transformation.transformFromGovernanceResult(governed);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.generatorReadyDocument)).toBe(true);
    expect(() => {
      first.transformationSummary.compatible = false;
    }).toThrow();
  });

  test("manual PDF and automation share the same transformation engine", () => {
    const payload = resultPayload();
    const manual = governAndTransform(payload, { pipeline: "manual_pdf", freeze: false });
    const automation = governAndTransform(payload, { pipeline: "automation", freeze: false });
    const strip = (value) => {
      const copy = JSON.parse(JSON.stringify(value));
      copy.pipeline = null;
      return copy;
    };
    expect(manual.engineId).toBe(automation.engineId);
    expect(strip(manual)).toEqual(strip(automation));
  });

  test("accepts a bare governed draft without requiring governance wrapper", () => {
    const governed = normalizedResponse(admitCardPayload());
    governed.formatId = governance.GOVERNED_DRAFT_FORMAT_ID;
    const result = transformation.transformFromGovernedDraft(governed, { freeze: false });
    expect(result.mappedSections[0].generatorTitle).toBe("Admit Card");
    expect(result.extensions.executedModel).toBe(false);
    expect(result.extensions.htmlGenerated).toBe(false);
  });

  test("Foundation and Stages 2A–2C remain backward compatible", () => {
    expect(structure.STAGE_ID).toBe("CIP_1C_1D");
    expect(stage2A.STAGE_ID).toBe("CIP_2A");
    expect(stage2B.STAGE_ID).toBe("CIP_2B");
    expect(stage2B.CONTRACT_VERSION).toBe("1.0.0");
    expect(governance.STAGE_ID).toBe("CIP_2C");
    expect(governance.GOVERNED_DRAFT_FORMAT_ID).toBe("cip_governed_ai_draft_v1");
    expect(transformation.STAGE_ID).toBe("CIP_2D");
  });

  test("exports no AI SDK, network, HTML, or publish surface", () => {
    const keys = Object.keys(transformation).join(",");
    expect(keys).not.toMatch(/openai|gemini|claude|anthropic|fetch|axios|apiKey|executeModel|html|publish/i);
  });
});
