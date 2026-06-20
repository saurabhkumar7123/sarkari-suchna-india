jest.mock("axios");

const axios = require("axios");
const {
  buildSignature,
  normalizeStoredBaseline,
  checkSite
} = require("../server/services/updates/siteChecker");
const {
  isSscApiEnabled,
  isSscApiSite,
  buildAttachmentLink,
  mapNoticeRow,
  extractSscNoticeItems
} = require("../server/services/updates/sscNoticeChecker");

const helpers = {
  buildSignature,
  normalizeText: (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
};

describe("sscNoticeChecker", () => {
  const originalFlag = process.env.SSC_USE_API;

  afterEach(() => {
    process.env.SSC_USE_API = originalFlag;
    jest.resetAllMocks();
  });

  test("isSscApiEnabled is off by default", () => {
    delete process.env.SSC_USE_API;
    expect(isSscApiEnabled()).toBe(false);
    process.env.SSC_USE_API = "0";
    expect(isSscApiEnabled()).toBe(false);
    process.env.SSC_USE_API = "1";
    expect(isSscApiEnabled()).toBe(true);
  });

  test("isSscApiSite matches ssc.gov.in hostnames", () => {
    expect(isSscApiSite({ url: "https://ssc.gov.in/" })).toBe(true);
    expect(isSscApiSite({ url: "https://www.ssc.gov.in/home" })).toBe(true);
    expect(isSscApiSite({ url: "https://www.upsc.gov.in/" })).toBe(false);
  });

  test("buildAttachmentLink normalizes Windows-style paths", () => {
    expect(buildAttachmentLink("uploads\\masterData\\NoticeBoards\\notice.pdf")).toBe(
      "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice.pdf"
    );
  });

  test("mapNoticeRow maps headline and attachment to monitoring item shape", () => {
    const item = mapNoticeRow(
      {
        headline: "Sample Notice Title",
        attachments: [{ path: "uploads\\masterData\\NoticeBoards\\sample.pdf" }]
      },
      helpers
    );

    expect(item.title).toBe("Sample Notice Title");
    expect(item.link).toBe(
      "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/sample.pdf"
    );
    expect(item.fingerprint).toBe(
      buildSignature(
        "Sample Notice Title https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/sample.pdf"
      )
    );
  });

  test("extractSscNoticeItems returns ssc_api_error on bad API status", async () => {
    axios.get.mockResolvedValue({
      data: { statusCode: "203", error: "Invalid attributes in request" }
    });

    const result = await extractSscNoticeItems({ id: 1 }, helpers);
    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("ssc_api_error");
  });

  test("extractSscNoticeItems returns ssc_api_empty when no usable rows", async () => {
    axios.get.mockResolvedValue({
      data: { statusCode: "200", data: [{ headline: "   " }] }
    });

    const result = await extractSscNoticeItems({ id: 1 }, helpers);
    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("ssc_api_empty");
  });

  test("extractSscNoticeItems maps API rows", async () => {
    axios.get.mockResolvedValue({
      data: {
        statusCode: "200",
        data: [
          {
            headline: "Notice A",
            attachments: [{ path: "uploads/masterData/NoticeBoards/a.pdf" }]
          }
        ]
      }
    });

    const result = await extractSscNoticeItems({ id: 1 }, helpers);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Notice A",
      link: "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/a.pdf"
    });
    expect(result.items[0].fingerprint).toMatch(/^sig:[a-f0-9]{40}:/i);
  });
});

describe("checkSite SSC API branch", () => {
  const originalFlag = process.env.SSC_USE_API;

  afterEach(() => {
    process.env.SSC_USE_API = originalFlag;
    jest.resetAllMocks();
  });

  test("SSC with flag off uses HTML path and can selector_miss", async () => {
    process.env.SSC_USE_API = "0";
    axios.get.mockResolvedValue({ data: "<html><body></body></html>" });

    const result = await checkSite({
      id: 1,
      name: "SSC",
      url: "https://ssc.gov.in/",
      selector: 'a[href*="Notice"]',
      lastContent: ""
    });

    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("selector_miss");
    expect(axios.get).toHaveBeenCalledWith(
      "https://ssc.gov.in/",
      expect.objectContaining({ timeout: 25000 })
    );
  });

  test("SSC with flag on uses API and establishes baseline without alert", async () => {
    process.env.SSC_USE_API = "1";
    axios.get.mockResolvedValue({
      data: {
        statusCode: "200",
        data: [
          {
            headline: "Delhi Police Result Notice",
            attachments: [{ path: "uploads/masterData/NoticeBoards/result.pdf" }]
          }
        ]
      }
    });

    const result = await checkSite({
      id: 1,
      name: "SSC",
      url: "https://ssc.gov.in/",
      selector: 'a[href*="Notice"]',
      lastContent: ""
    });

    expect(result.establishBaseline).toBe(true);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("baseline_established");
    expect(result.baselineFingerprint).toMatch(/^sig:[a-f0-9]{40}:/i);
    expect(axios.get).toHaveBeenCalledWith(
      "https://ssc.gov.in/api/general-website/portal/notice-boards",
      expect.objectContaining({ params: expect.objectContaining({ contentType: "notice-boards" }) })
    );
  });

  test("UPSC with SSC flag on still uses HTML path", async () => {
    process.env.SSC_USE_API = "1";
    axios.get.mockResolvedValue({
      data: `
        <html><body>
          <a href="/notice/example.pdf">UPSC Latest Notice Title Here</a>
        </body></html>
      `
    });

    const result = await checkSite({
      id: 2,
      name: "UPSC",
      url: "https://upsc.gov.in/",
      selector: 'a[href*="notice"]',
      lastContent: ""
    });

    expect(result.establishBaseline).toBe(true);
    expect(result.reason).toBe("baseline_established");
    expect(axios.get).toHaveBeenCalledWith(
      "https://upsc.gov.in/",
      expect.objectContaining({ timeout: 25000 })
    );
    expect(axios.get).not.toHaveBeenCalledWith(
      "https://ssc.gov.in/api/general-website/portal/notice-boards",
      expect.anything()
    );
  });

  test("SSC baseline path suppresses alert when top item unchanged", async () => {
    process.env.SSC_USE_API = "1";
    const title = "Delhi Police Result Notice";
    const link = "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/result.pdf";
    const fingerprint = buildSignature(`${title} ${link}`);
    const baseline = normalizeStoredBaseline(fingerprint);

    axios.get.mockResolvedValue({
      data: {
        statusCode: "200",
        data: [{ headline: title, attachments: [{ path: "uploads/masterData/NoticeBoards/result.pdf" }] }]
      }
    });

    const result = await checkSite({
      id: 1,
      name: "SSC",
      url: "https://ssc.gov.in/",
      selector: 'a[href*="Notice"]',
      lastContent: baseline.fingerprint
    });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe("no_change");
    expect(result.shouldNotify).toBe(false);
  });
});
