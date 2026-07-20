"use strict";

const request = require("supertest");
const app = require("../server/app");

describe("Package AMP-4A.2 Enterprise Persistence Integration", () => {
  test("enterprise persistence endpoints require authentication", async () => {
    const endpoints = [
      "/api/admin/enterprise-persistence/snapshot",
      "/api/admin/enterprise-persistence/search",
      "/api/admin/enterprise-persistence/recruitments",
      "/api/admin/enterprise-persistence/drafts",
      "/api/admin/enterprise-persistence/workflows",
      "/api/admin/enterprise-persistence/review-queue",
      "/api/admin/enterprise-persistence/audit",
      "/api/admin/enterprise-persistence/metrics",
      "/api/admin/enterprise-persistence/notification-gateway",
      "/api/admin/enterprise-persistence/rbac"
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    }
  });

  test("AMP-4A automation control center endpoints still require authentication", async () => {
    const res = await request(app).get("/api/admin/automation-control-center");
    expect(res.status).toBe(401);
  });
});
