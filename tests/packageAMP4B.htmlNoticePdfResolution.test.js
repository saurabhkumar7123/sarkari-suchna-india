"use strict";

/**
 * AMP-4B Part 14 — same-host HTML notice → PDF resolution.
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

const axios = require("axios");
const dns = require("dns");
const { extractGeneratorPdfText } = require("../server/services/pdfGeneratorExtract.service");
const { processJobParse } = require("../server/services/aiParseJob.service");
const {
  BRIDGE_CODES,
  assertPdfMagic,
  downloadOfficialPdfForGeneratorExtraction
} = require("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction");

const SITE = { id: 2, name: "UPSC", url: "https://www.upsc.gov.in/" };
const HTML_URL = "https://www.upsc.gov.in/content/important-notice";
const SAME_HOST_PDF = "https://www.upsc.gov.in/sites/default/files/notice.pdf";
const DIRECT_PDF = "https://www.upsc.gov.in/documents/direct.pdf";
const PDF_BYTES = Buffer.from("%PDF-1.4\n% magic\n");

function htmlWith(body) {
  return Buffer.from(`<!DOCTYPE html><html><body>${body}</body></html>`);
}

beforeEach(() => {
  jest.clearAllMocks();
  dns.promises.lookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
  extractGeneratorPdfText.mockResolvedValue({ text: "extracted official pdf text" });
});

describe("same-host HTML notice PDF resolution", () => {
  test("same-host PDF link accepted", async () => {
    axios.get.mockImplementation((url) => {
      if (url === SAME_HOST_PDF) {
        return Promise.resolve({ data: PDF_BYTES, headers: { "content-type": "application/pdf" } });
      }
      return Promise.resolve({
        data: htmlWith(`<a href="${SAME_HOST_PDF}">Download</a>`),
        headers: { "content-type": "text/html" }
      });
    });

    const result = await downloadOfficialPdfForGeneratorExtraction({
      notice: { title: "UPSC notice", url: HTML_URL },
      monitoredSite: SITE
    });

    expect(axios.get.mock.calls[0][0]).toBe(HTML_URL);
    expect(axios.get.mock.calls[1][0]).toBe(SAME_HOST_PDF);
    expect(result.sourceUrl).toBe(SAME_HOST_PDF);
    expect(result.text).toBe("extracted official pdf text");
    expect(extractGeneratorPdfText).toHaveBeenCalledTimes(1);
    expect(processJobParse).not.toHaveBeenCalled();
  });

  test("relative same-host PDF link accepted", async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).endsWith(".pdf")) {
        return Promise.resolve({ data: PDF_BYTES, headers: { "content-type": "application/pdf" } });
      }
      return Promise.resolve({
        data: htmlWith(`<a href="/sites/default/files/caf-notice.pdf">PDF</a>`),
        headers: { "content-type": "text/html" }
      });
    });

    const result = await downloadOfficialPdfForGeneratorExtraction({
      notice: { url: HTML_URL },
      monitoredSite: SITE
    });

    expect(axios.get.mock.calls[1][0]).toBe("https://www.upsc.gov.in/sites/default/files/caf-notice.pdf");
    expect(result.sourceUrl).toBe("https://www.upsc.gov.in/sites/default/files/caf-notice.pdf");
  });

  test("unrelated-domain PDF rejected", async () => {
    axios.get.mockResolvedValue({
      data: htmlWith(`<a href="https://evil.example.com/notice.pdf">PDF</a>`),
      headers: { "content-type": "text/html" }
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: HTML_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NO_SAFE_PDF });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toBe(HTML_URL);
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });

  test("private/localhost PDF rejected", async () => {
    axios.get.mockResolvedValue({
      data: htmlWith(
        `<a href="http://127.0.0.1/secret.pdf">a</a><a href="http://localhost/x.pdf">b</a><a href="http://192.168.1.9/x.pdf">c</a>`
      ),
      headers: { "content-type": "text/html" }
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: HTML_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NO_SAFE_PDF });
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });

  test("no PDF link → controlled failure", async () => {
    axios.get.mockResolvedValue({
      data: htmlWith(`<a href="/content/other-notice">Other</a>`),
      headers: { "content-type": "text/html" }
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: HTML_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NO_SAFE_PDF });
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
  });

  test("existing direct-PDF path remains working", async () => {
    axios.get.mockResolvedValue({
      data: PDF_BYTES,
      headers: { "content-type": "application/pdf" }
    });

    const result = await downloadOfficialPdfForGeneratorExtraction({
      notice: { url: DIRECT_PDF },
      monitoredSite: SITE
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toBe(DIRECT_PDF);
    expect(result.sourceUrl).toBe(DIRECT_PDF);
    expect(result.text).toBe("extracted official pdf text");
    expect(processJobParse).not.toHaveBeenCalled();
  });

  test("%PDF- validation remains enforced", async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).endsWith(".pdf")) {
        return Promise.resolve({
          data: Buffer.from("<!DOCTYPE html><html>not a pdf</html>"),
          headers: { "content-type": "text/html" }
        });
      }
      return Promise.resolve({
        data: htmlWith(`<a href="${SAME_HOST_PDF}">Download</a>`),
        headers: { "content-type": "text/html" }
      });
    });

    await expect(
      downloadOfficialPdfForGeneratorExtraction({
        notice: { url: HTML_URL },
        monitoredSite: SITE
      })
    ).rejects.toMatchObject({ code: BRIDGE_CODES.NOT_PDF });
    expect(extractGeneratorPdfText).not.toHaveBeenCalled();
    expect(() => assertPdfMagic(Buffer.from("%PDF-1.4\n"))).not.toThrow();
  });
});
