"use strict";

/**
 * PWP Phase 1 — Production Workflow orchestration tests.
 * Covers HTML / PDF / mixed / lifecycle document types, gates, and failures.
 */

const {
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_IDS,
  STAGE_STATUS,
  PIPELINE_STAGE_ORDER,
  ORCHESTRATOR_ID,
  ORCHESTRATOR_VERSION,
  PUBLISHING_POLICY,
  assertAutoPublishDisabled
} = require("../server/lib/productionWorkflow");

const telegramNotification = require("../server/lib/monitoringBot/telegramNotification");
const { getAutomationFlags } = require("../server/config/automationFlags");

const NOTIFICATION_HTML = `
<html><head><title>SSC CGL Recruitment 2026 Notification</title></head><body>
  <h1>SSC CGL Recruitment 2026 Notification</h1>
  <h2>Short Information</h2>
  <p>Staff Selection Commission invites online applications for Combined Graduate Level Examination 2026.</p>
  <h2>Important Dates</h2>
  <p>Application Begin : 01/07/2026</p>
  <p>Last Date to Apply : 21/07/2026</p>
  <p>Exam Date : 14 September 2026</p>
  <h2>Application Fee</h2>
  <p>General / OBC : 100/-</p>
  <p>SC / ST : 0/-</p>
  <h2>Vacancy Details</h2>
  <p>Total Posts: 4500</p>
  <h2>How To Apply</h2>
  <p>Candidates must apply online through the official website.</p>
  <h2>Important Links</h2>
  <p>Apply Online=https://ssc.gov.in/apply</p>
  <p>Official Website=https://ssc.gov.in</p>
</body></html>`;

const RESULT_HTML = `
<html><head><title>SSC CGL 2025 Result Declared</title></head><body>
  <h1>SSC CGL 2025 Result Declared</h1>
  <h2>Result</h2>
  <p>SSC has declared the CGL 2025 final result. Candidates can check their result online.</p>
  <h2>Important Links</h2>
  <p>Result Link=https://ssc.gov.in/result</p>
  <p>Official Website=https://ssc.gov.in</p>
</body></html>`;

const ADMIT_HTML = `
<html><head><title>SSC CGL Admit Card Download Notice</title></head><body>
  <h1>SSC CGL Admit Card Download Notice</h1>
  <h2>Admit Card</h2>
  <p>Candidates can download the admit card from the official website using registration number and date of birth.</p>
  <h2>Important Links</h2>
  <p>Admit Card=https://ssc.gov.in/admit-card</p>
</body></html>`;

const ANSWER_KEY_HTML = `
<html><head><title>SSC CGL Answer Key Notice</title></head><body>
  <h1>SSC CGL Answer Key Notice</h1>
  <h2>Answer Key</h2>
  <p>Provisional answer key has been released for SSC CGL Tier-I examination.</p>
  <h2>Important Links</h2>
  <p>Answer Key=https://ssc.gov.in/answer-key</p>
</body></html>`;

/** High-quality Stage 3C shaped document for orchestration fixtures. */
function normalizedPdfFixture({ title, text, sourceUrl, headings }) {
  const headingList = headings || [title, "Important Dates", "Important Links"];
  const contentBlocks = [];
  let order = 1;
  for (const heading of headingList) {
    contentBlocks.push({
      id: `block-h-${order}`,
      type: "heading",
      text: heading,
      level: order === 1 ? 1 : 2,
      normalizedLevel: order === 1 ? 1 : 2,
      order: order++,
      pageNumber: 1
    });
    contentBlocks.push({
      id: `block-p-${order}`,
      type: "paragraph",
      text: `Content for ${heading}`,
      order: order++,
      pageNumber: 1
    });
  }

  return {
    engineId: "CIP_PDF_EXTRACTION_ENGINE",
    stageId: "CIP_3C",
    engineVersion: "1.0.0",
    version: "1.0.0",
    formatId: "cip_normalized_pdf_document_v1",
    metadata: {
      pageTitle: title,
      title,
      sourceUrl: sourceUrl || "https://ssc.gov.in/docs/sample.pdf",
      baseUrl: sourceUrl || "https://ssc.gov.in/docs/sample.pdf",
      canonicalUrl: null,
      creationDate: "2026-01-01",
      modificationDate: null,
      pageCount: 1
    },
    pages: [
      {
        pageNumber: 1,
        lineCount: String(text || "").split("\n").length,
        text: text || title,
        headers: [],
        footers: [],
        blockIds: contentBlocks.map((b) => b.id)
      }
    ],
    contentBlocks,
    structuralTree: {
      type: "document",
      blocks: [],
      resources: [],
      sections: contentBlocks
        .filter((b) => b.type === "heading")
        .map((b, index) => ({
          id: `section-${index + 1}`,
          heading: b.text,
          blockIds: [b.id]
        }))
    },
    resourceList: [
      {
        id: "res-1",
        type: "link",
        text: "Official Website",
        url: "https://ssc.gov.in"
      }
    ],
    resourceInventory: { links: 1, downloads: 0 },
    embeddedDocuments: [],
    navigationReferences: [],
    warnings: [],
    extractionSummary: { pageCount: 1, blockCount: contentBlocks.length }
  };
}

const PROGRAM1_NOTIFICATION_TEXT = `SSC CGL Recruitment 2026 Notification

[Section: Short Information]
Staff Selection Commission invites online applications for Combined Graduate Level Examination 2026.

[Section: Important Dates]
Application Begin : 01/07/2026
Last Date to Apply : 21/07/2026
Exam Date : 14 September 2026

[Section: Application Fee]
General / OBC : 100/-
SC / ST : 0/-

[Section: Vacancy Details]
Total Posts: 4500

[Section: How To Apply]
Candidates must apply online through the official website.

[Section: Important Links]
Apply Online=https://ssc.gov.in/apply
Official Website=https://ssc.gov.in
`;

function baseEvent(overrides = {}) {
  return {
    sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html",
    title: "SSC CGL Recruitment 2026 Notification",
    contentType: "text/html",
    html: NOTIFICATION_HTML,
    program1Text: PROGRAM1_NOTIFICATION_TEXT,
    forceChangeDetected: true,
    allowTelegramDelivery: true,
    telegramTransport: telegramNotification.createMemoryTransport(),
    ...overrides
  };
}

async function run(event, extra = {}) {
  return runProductionWorkflow({
    monitoringEvent: baseEvent(event),
    workflowId: extra.workflowId || `test_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    recruitmentId: extra.recruitmentId || null
  });
}

describe("PWP Phase 1 — Production Workflow Orchestration", () => {
  test("orchestrator identity and publishing policy", () => {
    expect(ORCHESTRATOR_ID).toBe("PWP_PRODUCTION_WORKFLOW_ENGINE");
    expect(ORCHESTRATOR_VERSION).toBe("2.0.0");
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(assertAutoPublishDisabled().autoPublishBlocked).toBe(true);
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(PIPELINE_STAGE_ORDER).toEqual(
      expect.arrayContaining([
        STAGE_IDS.SOURCE_DETECTION,
        STAGE_IDS.RECRUITMENT_RESOLUTION,
        STAGE_IDS.AI_INTELLIGENCE_P2,
        STAGE_IDS.GENERATOR_DRAFT,
        STAGE_IDS.EDITORIAL_QUEUE,
        STAGE_IDS.TELEGRAM_NOTIFICATION,
        STAGE_IDS.MANUAL_PUBLISH_GATE
      ])
    );
  });

  test("Notification HTML end-to-end reaches READY_FOR_REVIEW", async () => {
    const result = await run({});
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.published).toBe(false);
    expect(result.autoPublishBlocked).toBe(true);
    expect(result.payload.generatorDraft).toBeTruthy();
    expect(result.payload.editorialQueueReference).toBeTruthy();
    expect(result.payload.telegramNotification).toBeTruthy();
    expect(result.payload.canonicalRecruitmentPackage).toBeTruthy();
    expect(result.payload.resolution).toBeTruthy();
    expect(result.payload.resolution.decision).toBe("CREATE_NEW_RECRUITMENT");
    expect(result.report.executedStages.length).toBe(PIPELINE_STAGE_ORDER.length);
    expect(result.report.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.report.executionTimeline.length).toBeGreaterThan(0);
  });

  test("Notification PDF end-to-end", async () => {
    const normalizedDocument = normalizedPdfFixture({
      title: "SSC CGL Recruitment 2026 Notification",
      sourceUrl: "https://ssc.gov.in/docs/cgl-2026.pdf",
      text: PROGRAM1_NOTIFICATION_TEXT,
      headings: [
        "SSC CGL Recruitment 2026 Notification",
        "Short Information",
        "Important Dates",
        "Application Fee",
        "Vacancy Details",
        "How To Apply",
        "Important Links"
      ]
    });

    const result = await run({
      sourceUrl: "https://ssc.gov.in/docs/cgl-2026.pdf",
      contentType: "application/pdf",
      html: undefined,
      title: "SSC CGL Recruitment 2026 Notification",
      program1Text: PROGRAM1_NOTIFICATION_TEXT,
      documents: [{ kind: "normalized", normalizedDocument }]
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.payload.extractedDocuments.length).toBeGreaterThanOrEqual(1);
  });

  test("Mixed HTML + PDF correlation", async () => {
    const normalizedDocument = normalizedPdfFixture({
      title: "SSC CGL Recruitment 2026 Corrigendum",
      sourceUrl: "https://ssc.gov.in/docs/cgl-2026-corrigendum.pdf",
      text: [
        "Corrigendum to SSC CGL Recruitment 2026",
        "Organization: Staff Selection Commission",
        "Last Date to Apply : 28/07/2026",
        "Total Posts: 5000"
      ].join("\n"),
      headings: [
        "SSC CGL Recruitment 2026 Corrigendum",
        "Important Dates",
        "Important Links"
      ]
    });

    const result = await run({
      documents: [
        {
          kind: "html",
          html: NOTIFICATION_HTML,
          sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html"
        },
        {
          kind: "normalized",
          normalizedDocument
        }
      ]
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.extractedDocuments.length).toBe(2);
    expect(result.payload.correlation).toBeTruthy();
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
  });

  test("Corrigendum update", async () => {
    const result = await run({
      title: "SSC CGL Correction Notice",
      html: `
<html><head><title>SSC CGL Correction Notice</title></head><body>
  <h1>SSC CGL Correction Notice</h1>
  <h2>Short Information</h2>
  <p>Staff Selection Commission has issued a correction notice for CGL 2026.</p>
  <h2>Correction</h2>
  <p>Candidates may correct their application form details between 22/07/2026 and 24/07/2026.</p>
  <h2>Important Dates</h2>
  <p>Correction Start : 22/07/2026</p>
  <p>Correction End : 24/07/2026</p>
  <h2>Important Links</h2>
  <p><a href="https://ssc.gov.in/correction">Correction Link</a></p>
  <p><a href="https://ssc.gov.in">Official Website</a></p>
</body></html>`,
      program1Text: `SSC CGL Correction Notice

[Section: Correction]
Candidates may correct their application form details between 22/07/2026 and 24/07/2026 on the official portal.

[Section: Important Links]
Correction Link=https://ssc.gov.in/correction
Official Website=https://ssc.gov.in
`
    });

    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.editorialQueueReference.reviewItem.eventType).toBe("correction");
  });

  test("Admit Card", async () => {
    const result = await run({
      title: "SSC CGL Admit Card Download Notice",
      html: ADMIT_HTML,
      sourceUrl: "https://ssc.gov.in/admit-card.html",
      program1Text: `SSC CGL Admit Card Download Notice

[Section: Admit Card]
Candidates can download the admit card from the official website using registration number and date of birth.

[Section: Important Links]
Admit Card=https://ssc.gov.in/admit-card
Official Website=https://ssc.gov.in
`
    });
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.editorialQueueReference.reviewItem.eventType).toBe("admit_card");
  });

  test("Answer Key", async () => {
    const result = await run({
      title: "SSC CGL Answer Key Notice",
      html: ANSWER_KEY_HTML,
      sourceUrl: "https://ssc.gov.in/answer-key.html",
      program1Text: `SSC CGL Answer Key Notice

[Section: Answer Key]
Provisional answer key has been released for SSC CGL Tier-I examination.

[Section: Important Links]
Answer Key=https://ssc.gov.in/answer-key
Official Website=https://ssc.gov.in
`
    });
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.editorialQueueReference.reviewItem.eventType).toBe("answer_key");
  });

  test("Result", async () => {
    const result = await run({
      title: "SSC CGL 2025 Result Declared",
      html: RESULT_HTML,
      sourceUrl: "https://ssc.gov.in/result.html",
      program1Text: `SSC CGL 2025 Result Declared

[Section: Result]
SSC has declared the CGL 2025 final result. Candidates can check their result online.

[Section: Important Links]
Result Link=https://ssc.gov.in/result
Official Website=https://ssc.gov.in
`
    });
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.editorialQueueReference.reviewItem.eventType).toBe("result");
  });

  test("Generator draft creation uses Canonical Recruitment Package only", async () => {
    const result = await run({});
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.generatorDraft.canonicalRecruitmentPackage).toBeTruthy();
    expect(result.payload.generatorDraft.data).toEqual(expect.any(String));
    expect(result.stageResults[STAGE_IDS.GENERATOR_DRAFT].executionSummary.generatorCalledIntelligence).toBe(
      false
    );
    expect(result.effects.generatorCalledIntelligence).toBe(false);
  });

  test("Editorial Queue creation without auto-approval", async () => {
    const result = await run({});
    const queue = result.payload.editorialQueueReference;
    expect(queue.queue).toBe("editorial_review");
    expect(queue.autoApproved).toBe(false);
    expect(queue.reviewItem.status).toBe("pending");
    expect(result.stageResults[STAGE_IDS.EDITORIAL_QUEUE].executionSummary.autoApproved).toBe(false);
  });

  test("Telegram notification is triggered via existing service", async () => {
    const transport = telegramNotification.createMemoryTransport();
    const result = await run({
      allowTelegramDelivery: true,
      telegramTransport: transport
    });
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.payload.telegramNotification.delivery).toBeTruthy();
    expect(result.payload.telegramNotification.summary.text).toMatch(/Manual approval required/i);
    expect(transport.getSent().length).toBeGreaterThanOrEqual(1);
  });

  test("Manual publish gate holds at READY_FOR_REVIEW by default", async () => {
    const result = await run({ confirmManualPublish: false });
    expect(result.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(result.published).toBe(false);
    expect(result.payload.manualPublishGate.allowed).toBe(false);
    expect(result.payload.autoPublishBlocked).toBe(true);
  });

  test("Manual publish confirmation marks PUBLISHED_MANUALLY without invoking publisher", async () => {
    const result = await run({ confirmManualPublish: true });
    expect(result.status).toBe(STAGE_STATUS.SUCCESS);
    expect(result.finalState).toBe(WORKFLOW_STATES.PUBLISHED_MANUALLY);
    expect(result.published).toBe(false);
    expect(result.payload.markedPublishedManually).toBe(true);
    expect(
      result.stageResults[STAGE_IDS.MANUAL_PUBLISH_GATE].executionSummary.publishingEngineInvoked
    ).toBe(false);
  });

  test("Stage failure stops downstream execution", async () => {
    const result = await runProductionWorkflow({
      monitoringEvent: {
        // Missing content and url documents intentionally
        title: "Broken event",
        forceChangeDetected: true
      }
    });
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.finalState).toBe(WORKFLOW_STATES.FAILED);
    expect(result.failureReport).toBeTruthy();
    expect(result.retryAdvisory.automaticRetry).toBe(false);
    expect(result.retryAdvisory.retryPossible).toBe(true);
    expect(result.report.skippedStages.length).toBeGreaterThan(0);
    expect(result.published).toBe(false);
  });

  test("Blocked quality validation stops pipeline", async () => {
    const result = await run({
      html: "<html><body><p></p></body></html>",
      title: "Empty",
      sourceUrl: "https://ssc.gov.in/empty.html"
    });
    // Empty/poor extraction should fail at quality or earlier extraction/doc stages
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.finalState).toBe(WORKFLOW_STATES.FAILED);
    expect(result.failureReport.failedStage).toBeTruthy();
    const executed = result.report.executedStages.map((s) => s.stageId);
    expect(executed).not.toContain(STAGE_IDS.GENERATOR_DRAFT);
  });

  test("Blocked AI stops pipeline", async () => {
    const result = await run({ forceAiBlocked: true });
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.failureReport.failedStage).toBe(STAGE_IDS.AI_INTELLIGENCE_P2);
    expect(result.retryAdvisory.recommendedStage).toBe(STAGE_IDS.AI_INTELLIGENCE_P2);
    expect(result.report.skippedStages.map((s) => s.stageId)).toEqual(
      expect.arrayContaining([STAGE_IDS.GENERATOR_DRAFT, STAGE_IDS.EDITORIAL_QUEUE])
    );
  });

  test("Workflow determinism for identical inputs", async () => {
    const shared = {
      sourceUrl: "https://ssc.gov.in/cgl-2026-notification.html",
      title: "SSC CGL Recruitment 2026 Notification",
      contentType: "text/html",
      html: NOTIFICATION_HTML,
      program1Text: PROGRAM1_NOTIFICATION_TEXT,
      forceChangeDetected: true,
      allowTelegramDelivery: false,
      changeDetection: { detectionStatus: "CHANGED", reason: "fixture" }
    };

    const a = await runProductionWorkflow({
      monitoringEvent: { ...shared },
      workflowId: "determinism_a"
    });
    const b = await runProductionWorkflow({
      monitoringEvent: { ...shared },
      workflowId: "determinism_b"
    });

    expect(a.status).toBe(STAGE_STATUS.SUCCESS);
    expect(b.status).toBe(STAGE_STATUS.SUCCESS);
    expect(a.finalState).toBe(b.finalState);
    expect(a.payload.generatorDraft.title).toBe(b.payload.generatorDraft.title);
    expect(a.payload.classification.documentType).toBe(b.payload.classification.documentType);
    expect(a.report.executedStages.map((s) => s.stageId)).toEqual(
      b.report.executedStages.map((s) => s.stageId)
    );
  });

  test("Backward compatibility — existing modules remain reusable and untouched by orchestration contract", async () => {
    const sourceIntelligence = require("../server/lib/contentIntelligence/sourceIntelligence");
    const htmlExtraction = require("../server/lib/contentIntelligence/htmlExtraction");
    const reviewQueue = require("../server/lib/recruitment/reviewQueue");
    const telegram = require("../server/lib/monitoringBot/telegramNotification");

    expect(typeof sourceIntelligence.analyzeSource).toBe("function");
    expect(typeof htmlExtraction.extractHtml).toBe("function");
    expect(typeof reviewQueue.createReviewItem).toBe("function");
    expect(typeof telegram.deliverTelegramNotification).toBe("function");
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("Every transition is logged in audit trail", async () => {
    const result = await run({});
    expect(result.report.executionTimeline.length).toBe(PIPELINE_STAGE_ORDER.length);
    for (const entry of result.report.executionTimeline) {
      expect(entry.stageId).toBeTruthy();
      expect(entry.toState).toBeTruthy();
      expect(entry.at).toBeTruthy();
    }
  });
});
