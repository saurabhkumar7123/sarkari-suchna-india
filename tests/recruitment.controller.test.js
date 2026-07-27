"use strict";

jest.mock("../server/services/recruitment.service", () => ({
  LIFECYCLE_STATES: [
    "announced",
    "open",
    "exam_scheduled",
    "post_exam",
    "results",
    "closed"
  ],
  createRecruitment: jest.fn(),
  updateRecruitment: jest.fn(),
  getRecruitment: jest.fn(),
  getRecruitmentDetail: jest.fn(),
  listRecruitments: jest.fn()
}));

jest.mock("../server/services/adminActivity.service", () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const recruitmentService = require("../server/services/recruitment.service");
const { recordActivity } = require("../server/services/adminActivity.service");
const {
  listRecruitmentsHandler,
  getRecruitmentHandler,
  getRecruitmentDetailHandler,
  createRecruitmentHandler,
  updateRecruitmentHandler
} = require("../server/controllers/admin/recruitment.controller");

const sampleRow = {
  id: 1,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  department: "ssc",
  post_name: "Combined Graduate Level",
  advertisement_no: "CGL-01/2026",
  cycle_year: 2026,
  lifecycle_state: "announced",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z"
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

describe("recruitment.controller admin CRUD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listRecruitmentsHandler returns paginated data", async () => {
    recruitmentService.listRecruitments.mockResolvedValue({
      data: [sampleRow],
      pagination: { page: 1, limit: 20, total: 1 }
    });
    const req = mockReq({ query: { page: "1", limit: "20" } });
    const res = mockRes();

    await listRecruitmentsHandler(req, res, jest.fn());

    expect(recruitmentService.listRecruitments).toHaveBeenCalledWith({
      page: "1",
      limit: "20",
      lifecycle_state: undefined,
      cycle_year: undefined,
      search: undefined
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [sampleRow],
      pagination: { page: 1, limit: 20, total: 1 }
    });
  });

  test("getRecruitmentHandler returns a recruitment row", async () => {
    recruitmentService.getRecruitment.mockResolvedValue(sampleRow);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await getRecruitmentHandler(req, res, jest.fn());

    expect(recruitmentService.getRecruitment).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: sampleRow });
  });

  test("createRecruitmentHandler creates and records activity", async () => {
    recruitmentService.createRecruitment.mockResolvedValue(sampleRow);
    const req = mockReq({
      body: {
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026"
      }
    });
    const res = mockRes();

    await createRecruitmentHandler(req, res, jest.fn());

    expect(recruitmentService.createRecruitment).toHaveBeenCalledWith({
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026"
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: "test-admin",
        action: "recruitment_create",
        target: "1",
        status: "success"
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: sampleRow });
  });

  test("updateRecruitmentHandler updates and records activity", async () => {
    const updated = { ...sampleRow, lifecycle_state: "open" };
    recruitmentService.updateRecruitment.mockResolvedValue(updated);
    const req = mockReq({
      params: { id: "1" },
      body: { lifecycle_state: "open" }
    });
    const res = mockRes();

    await updateRecruitmentHandler(req, res, jest.fn());

    expect(recruitmentService.updateRecruitment).toHaveBeenCalledWith("1", {
      lifecycle_state: "open"
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: "test-admin",
        action: "recruitment_update",
        target: "1",
        status: "success"
      })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
  });

  test("updateRecruitmentHandler archives through the existing closed lifecycle state", async () => {
    const archived = { ...sampleRow, lifecycle_state: "closed" };
    recruitmentService.updateRecruitment.mockResolvedValue(archived);
    const req = mockReq({ params: { id: "1" }, body: { lifecycle_state: "closed" } });
    const res = mockRes();

    await updateRecruitmentHandler(req, res);

    expect(recruitmentService.updateRecruitment).toHaveBeenCalledWith("1", {
      lifecycle_state: "closed"
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: archived });
  });

  test("createRecruitmentHandler propagates service errors", async () => {
    const err = new Error("slug must be unique");
    err.statusCode = 409;
    recruitmentService.createRecruitment.mockRejectedValue(err);
    const req = mockReq({ body: { title: "SSC", slug: "ssc-cgl-2026" } });
    const res = mockRes();

    await expect(createRecruitmentHandler(req, res)).rejects.toThrow("slug must be unique");
    expect(recordActivity).not.toHaveBeenCalled();
  });
});

describe("recruitment.controller detail aggregation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getRecruitmentDetailHandler returns aggregated detail", async () => {
    const detail = {
      recruitment: sampleRow,
      events: [],
      pages: [],
      drafts: []
    };
    recruitmentService.getRecruitmentDetail.mockResolvedValue(detail);
    const req = mockReq({ params: { id: "1" }, query: { limit: "20" } });
    const res = mockRes();

    await getRecruitmentDetailHandler(req, res);

    expect(recruitmentService.getRecruitmentDetail).toHaveBeenCalledWith("1", { limit: "20" });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: detail });
  });
});
