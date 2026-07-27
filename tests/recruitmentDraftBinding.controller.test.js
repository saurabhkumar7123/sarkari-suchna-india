"use strict";

jest.mock("../server/services/recruitmentDraftBinding.service", () => ({
  getBinding: jest.fn(),
  attachDraft: jest.fn(),
  detachDraft: jest.fn(),
  replaceDraft: jest.fn(),
  listAvailableDrafts: jest.fn()
}));

jest.mock("../server/services/adminActivity.service", () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const bindingService = require("../server/services/recruitmentDraftBinding.service");
const {
  getRecruitmentDraftBinding,
  attachRecruitmentDraft,
  detachRecruitmentDraft
} = require("../server/controllers/admin/recruitmentDraftBinding.controller");

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("recruitmentDraftBinding.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getRecruitmentDraftBinding returns binding payload", async () => {
    bindingService.getBinding.mockResolvedValue({ bindingStatus: "no_draft", drafts: [] });
    const req = { params: { recruitmentId: "10" } };
    const res = mockRes();
    await getRecruitmentDraftBinding(req, res);
    expect(res.body.success).toBe(true);
    expect(bindingService.getBinding).toHaveBeenCalledWith("10");
  });

  test("attachRecruitmentDraft passes operator identity", async () => {
    bindingService.attachDraft.mockResolvedValue({ bindingStatus: "draft_ready" });
    const req = {
      params: { recruitmentId: "10" },
      body: { draft_id: 55 },
      user: { username: "ops-admin" },
      ip: "127.0.0.1",
      headers: {},
      id: "req-1"
    };
    const res = mockRes();
    await attachRecruitmentDraft(req, res);
    expect(bindingService.attachDraft).toHaveBeenCalledWith("10", {
      draftId: 55,
      recruitmentEventId: undefined,
      operator: "ops-admin"
    });
    expect(res.body.success).toBe(true);
  });

  test("detachRecruitmentDraft maps service errors to status codes", async () => {
    const err = new Error("No drafts attached to this recruitment");
    err.statusCode = 400;
    bindingService.detachDraft.mockRejectedValue(err);
    const req = {
      params: { recruitmentId: "10" },
      body: {},
      query: {},
      user: { username: "admin" },
      ip: "127.0.0.1",
      headers: {}
    };
    const res = mockRes();
    await detachRecruitmentDraft(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
