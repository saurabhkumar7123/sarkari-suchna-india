"use strict";

const request = require("supertest");
const app = require("../../server/app");

describe("Admin Recruitment API auth", () => {
  test("GET /api/admin/recruitments requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitments");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/recruitments/:id requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitments/1");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/recruitments/:id/detail requires authentication", async () => {
    const response = await request(app).get("/api/admin/recruitments/1/detail");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/recruitments requires authentication", async () => {
    const response = await request(app).post("/api/admin/recruitments").send({
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("PUT /api/admin/recruitments/:id requires authentication", async () => {
    const response = await request(app).put("/api/admin/recruitments/1").send({
      lifecycle_state: "open"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });
});
