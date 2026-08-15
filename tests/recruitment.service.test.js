"use strict";

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  createRecruitment: jest.fn(),
  getRecruitmentById: jest.fn(),
  getRecruitmentBySlug: jest.fn(),
  listRecruitments: jest.fn(),
  updateRecruitment: jest.fn(),
  existsBySlug: jest.fn(),
  existsByAdvertisementNo: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentService = require("../server/services/recruitment.service");

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

describe("recruitment.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.existsBySlug.mockResolvedValue(false);
  });

  test("createRecruitment persists a validated recruitment", async () => {
    recruitmentRepository.createRecruitment.mockResolvedValue(sampleRow);

    const row = await recruitmentService.createRecruitment({
      title: " SSC CGL 2026 ",
      slug: "/ssc-cgl-2026.html",
      department: " ssc ",
      post_name: " Combined Graduate Level ",
      advertisement_no: " CGL-01/2026 ",
      cycle_year: 2026,
      lifecycle_state: "open"
    });

    expect(recruitmentRepository.existsBySlug).toHaveBeenCalledWith("ssc-cgl-2026", null);
    expect(recruitmentRepository.createRecruitment).toHaveBeenCalledWith({
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026",
      department: "ssc",
      post_name: "Combined Graduate Level",
      advertisement_no: "CGL-01/2026",
      cycle_year: 2026,
      lifecycle_state: "open"
    });
    expect(row).toEqual(sampleRow);
  });

  test("createRecruitment rejects missing title", async () => {
    await expect(
      recruitmentService.createRecruitment({ title: "  ", slug: "ssc-cgl-2026" })
    ).rejects.toMatchObject({ statusCode: 400, message: "title is required" });
  });

  test("createRecruitment rejects missing slug", async () => {
    await expect(
      recruitmentService.createRecruitment({ title: "SSC CGL 2026", slug: " " })
    ).rejects.toMatchObject({ statusCode: 400, message: "slug is required" });
  });

  test("createRecruitment rejects duplicate slug", async () => {
    recruitmentRepository.existsBySlug.mockResolvedValue(true);

    await expect(
      recruitmentService.createRecruitment({
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026"
      })
    ).rejects.toMatchObject({ statusCode: 409, message: "slug must be unique" });
  });

  test("createRecruitment rejects event-stage exam_date (not a recruitment lifecycle_state)", async () => {
    await expect(
      recruitmentService.createRecruitment({
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        lifecycle_state: "exam_date"
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid lifecycle_state" });
    expect(recruitmentRepository.createRecruitment).not.toHaveBeenCalled();
  });

  test("createRecruitment rejects detected fallback string", async () => {
    await expect(
      recruitmentService.createRecruitment({
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        lifecycle_state: "detected"
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid lifecycle_state" });
    expect(recruitmentRepository.createRecruitment).not.toHaveBeenCalled();
  });

  test("createRecruitment accepts mapped exam_scheduled lifecycle_state", async () => {
    recruitmentRepository.createRecruitment.mockResolvedValue({
      ...sampleRow,
      lifecycle_state: "exam_scheduled"
    });

    const row = await recruitmentService.createRecruitment({
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026",
      lifecycle_state: "exam_scheduled"
    });

    expect(recruitmentRepository.createRecruitment).toHaveBeenCalledWith(
      expect.objectContaining({ lifecycle_state: "exam_scheduled" })
    );
    expect(row.lifecycle_state).toBe("exam_scheduled");
  });

  test("updateRecruitment updates an existing recruitment", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(sampleRow);
    recruitmentRepository.updateRecruitment.mockResolvedValue({
      ...sampleRow,
      title: "SSC CGL 2026 Updated",
      lifecycle_state: "open"
    });

    const row = await recruitmentService.updateRecruitment(1, {
      title: " SSC CGL 2026 Updated ",
      lifecycle_state: "open"
    });

    expect(recruitmentRepository.existsBySlug).toHaveBeenCalledWith("ssc-cgl-2026", 1);
    expect(recruitmentRepository.updateRecruitment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: "SSC CGL 2026 Updated",
        slug: "ssc-cgl-2026",
        lifecycle_state: "open"
      })
    );
    expect(row.title).toBe("SSC CGL 2026 Updated");
  });

  test("updateRecruitment rejects invalid lifecycle_state", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(sampleRow);

    await expect(
      recruitmentService.updateRecruitment(1, { lifecycle_state: "draft" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid lifecycle_state" });
  });

  test("getRecruitment returns a row by id", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(sampleRow);

    const row = await recruitmentService.getRecruitment(1);

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(1);
    expect(row).toEqual(sampleRow);
  });

  test("getRecruitment returns 404 when missing", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(recruitmentService.getRecruitment(99)).rejects.toMatchObject({
      statusCode: 404,
      message: "Recruitment not found"
    });
  });

  test("getRecruitmentBySlug returns a row by slug", async () => {
    recruitmentRepository.getRecruitmentBySlug.mockResolvedValue(sampleRow);

    const row = await recruitmentService.getRecruitmentBySlug("ssc-cgl-2026.html");

    expect(recruitmentRepository.getRecruitmentBySlug).toHaveBeenCalledWith("ssc-cgl-2026");
    expect(row).toEqual(sampleRow);
  });

  test("listRecruitments delegates to repository", async () => {
    const payload = {
      data: [sampleRow],
      pagination: { page: 1, limit: 20, total: 1 }
    };
    recruitmentRepository.listRecruitments.mockResolvedValue(payload);

    const result = await recruitmentService.listRecruitments({
      page: 1,
      limit: 20,
      lifecycle_state: "announced"
    });

    expect(recruitmentRepository.listRecruitments).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      lifecycle_state: "announced",
      cycle_year: undefined,
      search: undefined
    });
    expect(result).toEqual(payload);
  });

  test("listRecruitments forwards search and operational filters", async () => {
    recruitmentRepository.listRecruitments.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0 }
    });

    await recruitmentService.listRecruitments({
      search: " SSC CGL ",
      cycle_year: "2026",
      lifecycle_state: "closed"
    });

    expect(recruitmentRepository.listRecruitments).toHaveBeenCalledWith({
      page: undefined,
      limit: undefined,
      search: "SSC CGL",
      cycle_year: 2026,
      lifecycle_state: "closed"
    });
  });
});
