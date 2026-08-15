"use strict";

/**
 * AMP-4B Part 6C — extracted PDF text → existing processJobParse() quality-gated bridge.
 */

jest.mock("axios");
jest.mock("../server/services/aiParseJob.service", () => {
  const actual = jest.requireActual("../server/services/aiParseJob.service");
  return {
    ...actual,
    processJobParse: jest.fn((...args) => actual.processJobParse(...args))
  };
});

const fs = require("fs");
const path = require("path");

const REAL_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "ssc-cht-tentative-vacancies-09072026.pdf"
);

const SITE = { id: 7, name: "SSC", url: "https://ssc.nic.in/" };
const PDF_URL = "https://ssc.nic.in/SSCFileServer/Portal/Download/notice.pdf";
const TITLE = "SSC Combined Hindi Translators 2026";

const STRONG_DOC = `[Section: Short Information]
Staff Selection Commission Combined Hindi Translators Examination tentative vacancies notice.

[Section: Important Dates]
Notice Date : 09.07.2026

[Section: Vacancy]
Tentative vacancies for Combined Hindi Translators posts as notified by SSC.

[Section: Important Links]
Notification PDF=${PDF_URL}
`;

const SPARSE = {
  title: TITLE,
  pageUrl: PDF_URL,
  data: `[Section: Short Information]\n${TITLE}\nOfficial PDF: ${PDF_URL}`,
  status: "draft"
};

function withoutOpenAi(fn) {
  return async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await fn();
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  };
}

function mockPersistDeps({
  saveDraft,
  extractResult,
  extractError,
  convertImpl
} = {}) {
  jest.resetModules();
  const save =
    saveDraft ||
    jest.fn().mockImplementation(async ({ payload, recruitmentId }) => ({
      id: 88,
      title: payload.title,
      payload,
      status: "draft",
      recruitment_id: recruitmentId
    }));

  jest.doMock("../server/services/generatorDraft.service", () => ({
    saveDraft: save,
    getDraftById: jest.fn()
  }));
  jest.doMock("../server/repositories/generatorDraft.repository", () => ({
    updateDraftLinkage: jest.fn()
  }));
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      draft: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) }
    }
  }));
  jest.doMock("../server/services/recruitmentReview.service", () => ({
    saveReviewItem: jest.fn()
  }));
  jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
    sendNotification: jest.fn(),
    CHANNELS: { TELEGRAM: "telegram" }
  }));

  if (extractError) {
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockRejectedValue(extractError)
    }));
  } else {
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockResolvedValue(
        extractResult || {
          text: "Staff Selection Commission Combined Hindi Translators Examination tentative vacancies 09.07.2026",
          sourceUrl: PDF_URL
        }
      )
    }));
  }

  if (convertImpl) {
    jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => convertImpl);
  }

  const runtime = require("../server/lib/recruitment/productionRuntime");
  return { persistDraft: runtime.persistDraft, save };
}

describe("AMP-4B AI Convert quality gate", () => {
  test("strong converted output is acceptable", () => {
    const { isAcceptablePublisherOutput } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
    expect(
      isAcceptablePublisherOutput(STRONG_DOC, {
        title: TITLE,
        officialUrl: PDF_URL,
        extractedText:
          "Staff Selection Commission Combined Hindi Translators Examination tentative vacancies 09.07.2026"
      })
    ).toBe(true);
  });

  test("weak / title-only / placeholder output is rejected", () => {
    const { isAcceptablePublisherOutput } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
    expect(isAcceptablePublisherOutput("", { title: TITLE })).toBe(false);
    expect(
      isAcceptablePublisherOutput(`[Section: Short Information]\n${TITLE}`, {
        title: TITLE,
        extractedText: "Staff Selection Commission Combined Hindi Translators"
      })
    ).toBe(false);
    expect(
      isAcceptablePublisherOutput("[Section: Short Information]\nNo usable data found", {
        extractedText: "Staff Selection Commission Combined Hindi Translators"
      })
    ).toBe(false);
  });
});

describe("persistDraft AI Convert bridge", () => {
  afterEach(() => {
    jest.dontMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
    jest.dontMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction");
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("1. strong converted output replaces sparse body", async () => {
    const { persistDraft, save } = mockPersistDeps({
      convertImpl: {
        convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
          accepted: true,
          reason: "accepted",
          result: STRONG_DOC
        }),
        withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
      }
    });

    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL },
      monitoredSite: SITE
    });

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0];
    expect(saved.payload.data).toBe(STRONG_DOC);
    expect(saved.payload.title).toBe(TITLE);
    expect(saved.payload.pageUrl).toBe(PDF_URL);
    expect(saved.recruitmentId).toBe(102);
    expect(result.aiConvert.ok).toBe(true);
  });

  test("2. weak output keeps sparse body", async () => {
    const { persistDraft, save } = mockPersistDeps({
      convertImpl: {
        convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
          accepted: false,
          reason: "weak_output",
          result: "[Section: Short Information]\nHi"
        }),
        withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
      }
    });

    await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL },
      monitoredSite: SITE
    });

    expect(save.mock.calls[0][0].payload).toEqual(SPARSE);
  });

  test("3. malformed AI output keeps sparse body", async () => {
    const { persistDraft, save } = mockPersistDeps({
      convertImpl: {
        convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
          accepted: false,
          reason: "weak_output",
          result: "{{TEXT}}\n```json {\"bad\": true}"
        }),
        withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
      }
    });

    await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL },
      monitoredSite: SITE
    });

    expect(save.mock.calls[0][0].payload.data).toBe(SPARSE.data);
  });

  test("5. extraction failure keeps sparse body", async () => {
    const err = Object.assign(new Error("HTML notice pages are not fetched"), { code: "NOT_DIRECT_PDF" });
    const { persistDraft, save } = mockPersistDeps({ extractError: err });

    const review = require("../server/services/recruitmentReview.service");
    const gateway = require("../server/lib/enterprise/notificationGateway");

    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: "https://ssc.nic.in/Portal/Apply" },
      monitoredSite: SITE
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].payload).toEqual(SPARSE);
    expect(result.pdfExtraction.ok).toBe(false);
    expect(result.aiConvert.reason).toBe("not_attempted");
    expect(review.saveReviewItem).not.toHaveBeenCalled();
    expect(gateway.sendNotification).not.toHaveBeenCalled();
  });

  test("7-10. title, PDF URL, recruitmentId preserved; no extra review/Telegram", async () => {
    const { persistDraft, save } = mockPersistDeps({
      convertImpl: {
        convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
          accepted: true,
          reason: "accepted",
          result: STRONG_DOC
        }),
        withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
      }
    });
    const review = require("../server/services/recruitmentReview.service");
    const gateway = require("../server/lib/enterprise/notificationGateway");

    await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE, customStatus: "keep-me" } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL },
      monitoredSite: SITE
    });

    const saved = save.mock.calls[0][0];
    expect(saved.payload.title).toBe(TITLE);
    expect(saved.payload.pageUrl).toBe(PDF_URL);
    expect(saved.payload.customStatus).toBe("keep-me");
    expect(saved.payload.status).toBe("draft");
    expect(saved.recruitmentId).toBe(102);
    expect(save).toHaveBeenCalledTimes(1);
    expect(review.saveReviewItem).not.toHaveBeenCalled();
    expect(gateway.sendNotification).not.toHaveBeenCalled();
  });

  test("11. processJobParse receives extracted PDF text", async () => {
    const { processJobParse } = require("../server/services/aiParseJob.service");
    const extractedText =
      "Staff Selection Commission Combined Hindi Translators Examination tentative vacancies 09.07.2026 notice";
    processJobParse.mockClear();
    processJobParse.mockResolvedValueOnce({ result: STRONG_DOC });

    const {
      convertAmpExtractedTextToPublisher
    } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");

    await convertAmpExtractedTextToPublisher({
      extractedText,
      title: TITLE,
      officialUrl: PDF_URL
    });

    expect(processJobParse).toHaveBeenCalledTimes(1);
    expect(processJobParse.mock.calls[0][0]).toBe(extractedText);
  });
});

describe("OpenAI-off rule-based + canonical + real SSC fixture", () => {
  test(
    "4+6. OpenAI unavailable uses rule-based conversion with canonical sections",
    withoutOpenAi(async () => {
      const {
        convertAmpExtractedTextToPublisher
      } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
      const extracted = `Staff Selection Commission
Combined Hindi Translators Examination 2026
Tentative vacancies
Notice dated 09.07.2026
Last date to apply 31.07.2026
Apply online https://ssc.nic.in/`;
      const converted = await convertAmpExtractedTextToPublisher({
        extractedText: extracted,
        title: TITLE,
        officialUrl: PDF_URL
      });
      expect(converted.result || "").toMatch(/\[Section:\s*Short Information\]/);
      expect(converted.result || "").not.toMatch(/\[Section:\s*ShortInfo\]/);
    }),
    60000
  );

  test("12. real SSC fixture conversion", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(fs.existsSync(REAL_FIXTURE)).toBe(true);
      const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");
      const {
        convertAmpExtractedTextToPublisher
      } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");

      const extracted = await extractGeneratorPdfText(fs.readFileSync(REAL_FIXTURE));
      expect(extracted.text.length).toBeGreaterThan(80);

      const converted = await convertAmpExtractedTextToPublisher({
        extractedText: extracted.text,
        title: TITLE,
        officialUrl: PDF_URL
      });

      const doc = converted.result || "";
      expect(doc).toMatch(/\[Section:\s*Short Information\]/);
      expect(doc).toMatch(/Hindi Translator|COMBINED HINDI TRANSLATORS|Staff Selection Commission|SSC/i);
      expect(doc).toMatch(/TENTATIVE VACANCIES|Vacancy|tentative/i);
      if (/09[./-]07[./-]2026/.test(extracted.text)) {
        expect(doc).toMatch(/09[./-]07[./-]2026/);
      }
      expect(doc).not.toMatch(/\| table\][\s\S]{0,80}Post \| Category \| Vacancy/);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  }, 120000);
});
