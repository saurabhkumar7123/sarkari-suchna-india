"use strict";

jest.mock("../server/services/recruitmentPageLink.service", () => ({
  linkPage: jest.fn(),
  unlinkPage: jest.fn(),
  getPageLinkage: jest.fn(),
  listLinkedPages: jest.fn()
}));

jest.mock("../server/services/adminActivity.service", () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const recruitmentPageLinkService = require("../server/services/recruitmentPageLink.service");
const { recordActivity } = require("../server/services/adminActivity.service");
const {
  linkPageHandler,
  unlinkPageHandler,
  getPageLinkageHandler,
  listLinkedPagesHandler
} = require("../server/controllers/admin/recruitmentPageLink.controller");

const linkedPage = {
  id: 42,
  slug: "ssc-cgl-2026",
  recruitment_id: 10,
  recruitment_event_id: 5
};

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { username: "test-admin" },
    ip: "127.0.0.1",
    headers: { "user-agent": "jest" },
    id: "req-1",
    ...overrides
  };
}

describe("recruitmentPageLink.controller admin attachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("linkPageHandler links page and records activity", async () => {
    recruitmentPageLinkService.linkPage.mockResolvedValue(linkedPage);
    const req = mockReq({
      body: {
        slug: "ssc-cgl-2026",
        recruitment_id: 10,
        recruitment_event_id: 5
      }
    });
    const res = mockRes();

    await linkPageHandler(req, res);

    expect(recruitmentPageLinkService.linkPage).toHaveBeenCalledWith({
      slug: "ssc-cgl-2026",
      recruitment_id: 10,
      recruitment_event_id: 5
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: "test-admin",
        action: "recruitment_page_link",
        target: "42",
        status: "success"
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: linkedPage });
  });

  test("unlinkPageHandler unlinks page and records activity", async () => {
    const unlinked = { ...linkedPage, recruitment_id: null, recruitment_event_id: null };
    recruitmentPageLinkService.unlinkPage.mockResolvedValue(unlinked);
    const req = mockReq({ query: { slug: "ssc-cgl-2026" } });
    const res = mockRes();

    await unlinkPageHandler(req, res);

    expect(recruitmentPageLinkService.unlinkPage).toHaveBeenCalledWith({
      page_id: undefined,
      slug: "ssc-cgl-2026"
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recruitment_page_unlink",
        target: "42"
      })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: unlinked });
  });

  test("getPageLinkageHandler returns current linkage", async () => {
    recruitmentPageLinkService.getPageLinkage.mockResolvedValue(linkedPage);
    const req = mockReq({ query: { page_id: "42" } });
    const res = mockRes();

    await getPageLinkageHandler(req, res);

    expect(recruitmentPageLinkService.getPageLinkage).toHaveBeenCalledWith({ page_id: "42", slug: undefined });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: linkedPage });
  });

  test("listLinkedPagesHandler lists pages by recruitment", async () => {
    const payload = {
      data: [linkedPage],
      pagination: { page: 1, limit: 20, total: 1 }
    };
    recruitmentPageLinkService.listLinkedPages.mockResolvedValue(payload);
    const req = mockReq({ query: { recruitment_id: "10", page: "1", limit: "20" } });
    const res = mockRes();

    await listLinkedPagesHandler(req, res);

    expect(recruitmentPageLinkService.listLinkedPages).toHaveBeenCalledWith({
      recruitment_id: "10",
      recruitment_event_id: undefined,
      page: "1",
      limit: "20"
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, ...payload });
  });

  test("listLinkedPagesHandler lists pages by recruitment event", async () => {
    const payload = {
      data: [linkedPage],
      pagination: { page: 1, limit: 20, total: 1 }
    };
    recruitmentPageLinkService.listLinkedPages.mockResolvedValue(payload);
    const req = mockReq({ query: { recruitment_event_id: "5" } });
    const res = mockRes();

    await listLinkedPagesHandler(req, res);

    expect(recruitmentPageLinkService.listLinkedPages).toHaveBeenCalledWith({
      recruitment_id: undefined,
      recruitment_event_id: "5",
      page: undefined,
      limit: undefined
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, ...payload });
  });

  test("linkPageHandler propagates service validation errors", async () => {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    recruitmentPageLinkService.linkPage.mockRejectedValue(err);
    const req = mockReq({ body: { slug: "ssc-cgl-2026", recruitment_id: 99 } });
    const res = mockRes();

    await expect(linkPageHandler(req, res)).rejects.toThrow("Recruitment not found");
    expect(recordActivity).not.toHaveBeenCalled();
  });
});
