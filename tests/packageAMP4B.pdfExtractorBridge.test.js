"use strict";

/**
 * AMP-4B Part 6B — official PDF URL → existing extractGeneratorPdfText bridge.
 * Network is mocked. processJobParse must not be used.
 */

jest.mock("axios");
jest.mock("dns", () => ({
  promises: {
    lookup: jest.fn()
  }
}));
jest.mock("../server/services/pdfGeneratorExtract.service", () => ({
  extractGeneratorPdfText: jest.fn()
}));
jest.mock("../server/services/aiParseJob.service", () => ({
  processJobParse: jest.fn()
}));

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dns = require("dns");
const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");
const { processJobParse } = require("../server/services/aiParseJob.service");
const {
  BRIDGE_CODES,
  assertSafeOfficialPdfUrl,
  assertPdfMagic,
  downloadOfficialPdfForGeneratorExtraction
} = require("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction");

const FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "ssc-cht-tentative-vacancies-09072026.pdf"
);

const SITE = { id: 7, name: "SSC", url: "https://ssc.nic.in/" };
const PDF_URL = "https://ssc.nic.in/SSCFileServer/Portal/Download/notice.pdf";

function pdfBufferFromFixtureOrMagic() {
  if (fs.existsSync(FIXTURE)) {
    return fs.readFileSync(FIXTURE);
  }
  return Buffer.from("%PDF-1.4\n% fixture unavailable, magic only\n");
}

beforeEach(() => {
  jest.clearAllMocks();
  dns.promises.lookup.mockResolvedValue([{ address: "1.2.3.4", family: 4 }]);
  extractGeneratorPdfText.mockResolvedValue({ text: "extracted official pdf text" });
});

describe("AMP-4B PDF URL safety", () => {
  test("unrelated domain rejected", () => {
    expect(() =>
      assertSafeOfficialPdfUrl("https://evil.example.com/notice.pdf", SITE)
    ).toThrow(expect.objectContaining({ code: BRIDGE_CODES.HOST_MISMATCH }));
  });

  test("localhost rejected", () => {
    expect(() => assertSafeOfficialPdfUrl("http://localhost/secret.pdf", SITE)).toThrow(
      expect.objectContaining({ code: BRIDGE_CODES.UNSAFE_URL })
    );
  });

  test("private IP rejected", () => {
    expect(() => assertSafeOfficialPdfUrl("http://127.0.0.1/notice.pdf", SITE)).toThrow(
      expect.objectContaining({ code: BRIDGE_CODES.UNSAFE_URL })
    );
    expect(() => assertSafeOfficialPdfUrl("http://192.168.1.9/notice.pdf", SITE)).toThrow(
      expect.objectContaining({ code: BRIDGE_CODES.UNSAFE_URL })
    );
    expect(() => assertSafeOfficialPdfUrl("http://10.0.0.8/notice.pdf", SITE)).toThrow(
      expect.objectContaining({ code: BRIDGE_CODES.UNSAFE_URL })
    );
  });

  test("HTML notice page with no PDF fails closed after fetching notice only", async () => {
    axios.get.mockResolvedValue({
      data: Buffer.from("<!DOCTYPE html><html><body><a href='/Portal/Apply'>Apply</a></body></html>"),
      headers: { "content-type": "text/html; charset=utf-8" }
    });
    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { title: "SSC CGL", url: "https://ssc.nic.in/Portal/Apply" },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NO_SAFE_PDF });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toBe("https://ssc.nic.in/Portal/Apply");
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });
});

describe("AMP-4B PDF download + existing extractor", () => {
  test("%PDF- signature accepted", () => {
    expect(() => assertPdfMagic(Buffer.from("%PDF-1.4\n"))).not.toThrow();
  });

  test("valid PDF URL downloads and calls extractGeneratorPdfText", async () => {
    const bytes = pdfBufferFromFixtureOrMagic();
    axios.get.mockResolvedValue({
      data: bytes,
      headers: { "content-type": "application/pdf" }
    });

    const result = await downloadOfficialPdfForGeneratorExtraction({
      notice: { title: "SSC notice", url: PDF_URL },
      monitoredSite: SITE
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toBe(PDF_URL);
    expect(axios.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        responseType: "arraybuffer"
      })
    );
    expect(extractGeneratorPdfText).toHaveBeenCalledTimes(1);
    const passed = extractGeneratorPdfText.mock.calls[0][0];
    expect(Buffer.isBuffer(passed)).toBe(true);
    expect(passed.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(result.text).toBe("extracted official pdf text");
    expect(processJobParse).not.toHaveBeenCalled();
  });

  test("HTML response rejected", async () => {
    axios.get.mockResolvedValue({
      data: Buffer.from("<!DOCTYPE html><html><body>Notice</body></html>"),
      headers: { "content-type": "text/html; charset=utf-8" }
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: PDF_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NOT_PDF });
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });

  test("non-PDF binary rejected", async () => {
    axios.get.mockResolvedValue({
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      headers: { "content-type": "application/octet-stream" }
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: PDF_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NOT_PDF });
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });

  test("extractor failure becomes controlled EXTRACT_FAILED", async () => {
    axios.get.mockResolvedValue({
      data: Buffer.from("%PDF-1.4\n"),
      headers: { "content-type": "application/pdf" }
    });
    extractGeneratorPdfText.mockRejectedValue(Object.assign(new Error("PDF ka text properly read nahi ho paya"), { code: "TEXT_TOO_SHORT" }));

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: PDF_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.EXTRACT_FAILED });
  });

  test("processJobParse is never called", async () => {
    axios.get.mockResolvedValue({
      data: Buffer.from("%PDF-1.4\n"),
      headers: { "content-type": "application/pdf" }
    });
    await downloadOfficialPdfForGeneratorExtraction({
      notice: { url: PDF_URL },
      monitoredSite: SITE
    });
    expect(processJobParse).not.toHaveBeenCalled();
  });
});

describe("persistDraft fallback keeps sparse payload", () => {
  test("extractor failure still saves original AMP-4B payload", async () => {
    const sparse = {
      title: "SSC CGL 2026 Recruitment",
      pageUrl: "https://ssc.nic.in/Portal/Apply",
      data: "[Section: Short Information]\nSSC CGL 2026 Recruitment"
    };
    const saveDraft = jest.fn().mockResolvedValue({
      id: 77,
      title: sparse.title,
      payload: sparse,
      recruitment_id: 102
    });

    jest.resetModules();
    jest.doMock("../server/services/generatorDraft.service", () => ({
      saveDraft,
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
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockRejectedValue(
        Object.assign(new Error("HTML notice pages are not fetched"), { code: "NOT_DIRECT_PDF" })
      )
    }));

    const { persistDraft } = require("../server/lib/recruitment/productionRuntime");
    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: sparse },
      recruitmentId: 102,
      notice: { title: sparse.title, url: sparse.pageUrl },
      monitoredSite: SITE
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft.mock.calls[0][0].payload).toEqual(sparse);
    expect(result.skipped).toBe(false);
    expect(result.draftId).toBe(77);
    expect(result.pdfExtraction && result.pdfExtraction.ok).toBe(false);
    expect(processJobParse).not.toHaveBeenCalled();
  });
});
