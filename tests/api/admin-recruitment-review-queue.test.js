"use strict";

const request = require("supertest");
const app = require("../../server/app");

describe("Admin Recruitment Review Queue API auth", () => {
  test("GET /api/admin/recruitment-review-queue requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitment-review-queue");
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/recruitment-review-queue/:id requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitment-review-queue/1");
    expect(response.status).toBe(401);
  });

  test("POST /api/admin/recruitment-review-queue/:id/approve requires authentication", async () => {
    const response = await request(app)
      .post("/api/admin/recruitment-review-queue/1/approve")
      .send({});
    expect(response.status).toBe(401);
  });

  test("POST /api/admin/recruitment-review-queue/:id/reject requires authentication", async () => {
    const response = await request(app)
      .post("/api/admin/recruitment-review-queue/1/reject")
      .send({});
    expect(response.status).toBe(401);
  });

  test("POST /api/admin/recruitment-review-queue/:id/freeze requires authentication", async () => {
    const response = await request(app)
      .post("/api/admin/recruitment-review-queue/1/freeze")
      .send({});
    expect(response.status).toBe(401);
  });

  test("PATCH /api/admin/recruitment-review-queue/:id/notes requires authentication", async () => {
    const response = await request(app)
      .patch("/api/admin/recruitment-review-queue/1/notes")
      .send({ notes: "x" });
    expect(response.status).toBe(401);
  });
});

describe("Admin Recruitment Review Queue page", () => {
  test("GET /admin/recruitment-review-queue requires authentication", async () => {
    const response = await request(app).get("/admin/recruitment-review-queue");
    expect([302, 401]).toContain(response.status);
  });
});
