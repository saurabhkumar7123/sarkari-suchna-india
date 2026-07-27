"use strict";

const request = require("supertest");
const app = require("../../server/app");

describe("Admin Recruitment Testing API auth", () => {
  test("POST /api/admin/recruitment-testing/analyze requires authentication", async () => {
    const response = await request(app).post("/api/admin/recruitment-testing/analyze").send({
      title: "SSC CGL 2026 Admit Card"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/recruitment-testing/lookup-candidates requires authentication", async () => {
    const response = await request(app)
      .post("/api/admin/recruitment-testing/lookup-candidates")
      .send({
        title: "SSC CGL 2026 Admit Card"
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/recruitment-testing/save-review requires authentication", async () => {
    const response = await request(app)
      .post("/api/admin/recruitment-testing/save-review")
      .send({
        reviewItem: {
          title: "SSC CGL 2026 Admit Card",
          eventType: "admit_card"
        }
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });
});

describe("Admin Recruitment Testing dashboard page", () => {
  test("GET /admin/recruitment-testing requires authentication", async () => {
    const response = await request(app).get("/admin/recruitment-testing");

    expect([302, 401]).toContain(response.status);
  });
});
