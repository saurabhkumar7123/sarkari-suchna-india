"use strict";

const request = require("supertest");
const app = require("../../server/app");
const {
  pushRuntimePreview,
  resetRuntimePreviewBuffer,
  getRuntimePreviewSize
} = require("../../server/lib/recruitment/runtimePreviewBuffer");

describe("Admin Recruitment Runtime Preview API auth", () => {
  beforeEach(() => {
    resetRuntimePreviewBuffer();
  });

  test("GET /api/admin/recruitment-runtime-preview requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitment-runtime-preview");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/recruitment-runtime-preview/:id requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitment-runtime-preview/1");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/recruitment-runtime-preview/clear requires authentication", async () => {
    const response = await request(app).post("/api/admin/recruitment-runtime-preview/clear").send({});

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });
});

describe("Admin Recruitment Runtime Preview page", () => {
  test("GET /admin/recruitment-runtime-preview requires authentication", async () => {
    const response = await request(app).get("/admin/recruitment-runtime-preview");

    expect([302, 401]).toContain(response.status);
  });
});

describe("Admin Recruitment Runtime Preview buffer ops (same-process)", () => {
  beforeEach(() => {
    resetRuntimePreviewBuffer();
  });

  test("clear buffer removes in-memory entries without persistence side effects", () => {
    pushRuntimePreview({
      notice: { title: "Temp", content: "Temp", url: "" },
      processorResult: {
        status: "no_match",
        warnings: [],
        eventType: "unknown",
        selectedRecruitment: null,
        reviewItem: null
      }
    });
    expect(getRuntimePreviewSize()).toBe(1);

    const {
      clearRuntimePreviewBuffer
    } = require("../../server/lib/recruitment/runtimePreviewBuffer");
    const result = clearRuntimePreviewBuffer();

    expect(result.cleared).toBe(true);
    expect(getRuntimePreviewSize()).toBe(0);
  });
});
