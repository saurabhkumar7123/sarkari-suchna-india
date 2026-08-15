jest.mock("axios");

const axios = require("axios");
const {
  checkSite,
  buildSignature,
  SOURCE_METHODS,
  resolveSourceMethod,
  extractLatestItems,
  extractSourceItems
} = require("../server/services/updates/siteChecker");

const HTML_SITE = {
  id: 2,
  name: "UPSC",
  url: "https://upsc.gov.in/",
  selector: 'a[href*="notice"]',
  lastContent: ""
};

const SSC_SITE = {
  id: 1,
  name: "SSC",
  url: "https://ssc.gov.in/",
  selector: 'a[href*="Notice"]',
  lastContent: ""
};

describe("minimal hybrid source adapter", () => {
  const originalFlag = process.env.SSC_USE_API;

  afterEach(() => {
    process.env.SSC_USE_API = originalFlag;
    jest.resetAllMocks();
  });

  test("HTML source uses HTML_SELECTOR and emits {title,link,fingerprint}", () => {
    process.env.SSC_USE_API = "0";
    const html = `<html><body><a href="/notice/example.pdf">UPSC Latest Notice Title Here</a></body></html>`;
    const extracted = extractLatestItems(html, HTML_SITE);
    expect(extracted.invalid).toBeUndefined();
    expect(extracted.items[0]).toEqual(
      expect.objectContaining({
        title: "UPSC Latest Notice Title Here",
        link: "https://upsc.gov.in/notice/example.pdf",
        fingerprint: buildSignature(
          "UPSC Latest Notice Title Here https://upsc.gov.in/notice/example.pdf"
        )
      })
    );
    expect(resolveSourceMethod(HTML_SITE)).toBe(SOURCE_METHODS.HTML_SELECTOR);
  });

  test("UPSC stays on HTML path even when SSC_USE_API=1", async () => {
    process.env.SSC_USE_API = "1";
    expect(resolveSourceMethod(HTML_SITE)).toBe(SOURCE_METHODS.HTML_SELECTOR);

    axios.get.mockResolvedValue({
      data: `<html><body><a href="/notice/example.pdf">UPSC Latest Notice Title Here</a></body></html>`
    });

    const extracted = await extractSourceItems(HTML_SITE);
    expect(extracted.method).toBe(SOURCE_METHODS.HTML_SELECTOR);
    expect(extracted.items[0]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        link: expect.any(String),
        fingerprint: expect.stringMatching(/^sig:[a-f0-9]{40}:/i)
      })
    );

    const result = await checkSite(HTML_SITE);
    expect(result.establishBaseline).toBe(true);
    expect(axios.get).toHaveBeenCalledWith(
      "https://upsc.gov.in/",
      expect.objectContaining({ timeout: 25000 })
    );
    expect(axios.get).not.toHaveBeenCalledWith(
      "https://ssc.gov.in/api/general-website/portal/notice-boards",
      expect.anything()
    );
  });

  test("SSC_USE_API=1 uses SSC_JSON with the common item shape", async () => {
    process.env.SSC_USE_API = "1";
    expect(resolveSourceMethod(SSC_SITE)).toBe(SOURCE_METHODS.SSC_JSON);

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

    const extracted = await extractSourceItems(SSC_SITE);
    expect(extracted.method).toBe(SOURCE_METHODS.SSC_JSON);
    expect(extracted.items[0]).toEqual(
      expect.objectContaining({
        title: "Delhi Police Result Notice",
        link: "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/result.pdf",
        fingerprint: buildSignature(
          "Delhi Police Result Notice https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/result.pdf"
        )
      })
    );
  });

  test("SSC API remains host-restricted", () => {
    process.env.SSC_USE_API = "1";
    expect(resolveSourceMethod(SSC_SITE)).toBe(SOURCE_METHODS.SSC_JSON);
    expect(resolveSourceMethod({ url: "https://www.ssc.gov.in/home" })).toBe(
      SOURCE_METHODS.SSC_JSON
    );
    expect(resolveSourceMethod({ url: "https://ssc.nic.in/" })).toBe(SOURCE_METHODS.HTML_SELECTOR);
    expect(
      resolveSourceMethod({ name: "SSC", url: "https://upsc.gov.in/" })
    ).toBe(SOURCE_METHODS.HTML_SELECTOR);
  });

  test("SSC_USE_API=0 uses existing HTML path including selector_miss", async () => {
    process.env.SSC_USE_API = "0";
    expect(resolveSourceMethod(SSC_SITE)).toBe(SOURCE_METHODS.HTML_SELECTOR);
    axios.get.mockResolvedValue({ data: "<html><body></body></html>" });

    const result = await checkSite(SSC_SITE);
    expect(result.invalid).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("selector_miss");
    expect(axios.get).toHaveBeenCalledWith(
      "https://ssc.gov.in/",
      expect.objectContaining({ timeout: 25000 })
    );
  });

  test("change-detection contract is unchanged for matching top fingerprint", async () => {
    process.env.SSC_USE_API = "1";
    const title = "Delhi Police Result Notice";
    const link =
      "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/result.pdf";
    const fingerprint = buildSignature(`${title} ${link}`);

    axios.get.mockResolvedValue({
      data: {
        statusCode: "200",
        data: [{ headline: title, attachments: [{ path: "uploads/masterData/NoticeBoards/result.pdf" }] }]
      }
    });

    const result = await checkSite({ ...SSC_SITE, lastContent: fingerprint });
    expect(result.changed).toBe(false);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("no_change");
    expect(result.items).toEqual([]);
  });

  test("SSC JSON failure does not fabricate an update", async () => {
    process.env.SSC_USE_API = "1";
    axios.get.mockResolvedValue({
      data: { statusCode: "203", error: "Invalid attributes in request" }
    });

    const result = await checkSite({ ...SSC_SITE, lastContent: "sig:abc" });
    expect(result.invalid).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("ssc_api_error");
    expect(result.items).toBeUndefined();
  });
});
