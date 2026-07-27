"use strict";

const request = require("supertest");
const app = require("../../server/app");

describe("Admin Recruitment Event API auth", () => {
  test("GET /api/admin/recruitments/:id/events requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitments/1/events");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/recruitment-events/:id requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitment-events/1");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/recruitments/:id/events requires authentication", async () => {
    const response = await request(app).post("/api/admin/recruitments/1/events").send({
      event_type: "notification"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("PUT /api/admin/recruitment-events/:id requires authentication", async () => {
    const response = await request(app).put("/api/admin/recruitment-events/1").send({
      status: "active"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("DELETE /api/admin/recruitment-events/:id requires authentication", async () => {
    const response = await request(app).delete("/api/admin/recruitment-events/1");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });
});
