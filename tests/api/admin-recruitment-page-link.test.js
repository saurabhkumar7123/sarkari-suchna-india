"use strict";

const request = require("supertest");
const app = require("../../server/app");

describe("Admin Page Linkage API auth", () => {
  test("GET /api/admin/page-linkages requires authentication", async () => {
    const response = await request(app).get("/api/admin/page-linkages").query({
      recruitment_id: 1
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("GET /api/admin/page-linkages/page requires authentication", async () => {
    const response = await request(app).get("/api/admin/page-linkages/page").query({
      slug: "ssc-cgl-2026"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/page-linkages requires authentication", async () => {
    const response = await request(app).post("/api/admin/page-linkages").send({
      slug: "ssc-cgl-2026",
      recruitment_id: 10
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("DELETE /api/admin/page-linkages requires authentication", async () => {
    const response = await request(app).delete("/api/admin/page-linkages").query({
      slug: "ssc-cgl-2026"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });
});
