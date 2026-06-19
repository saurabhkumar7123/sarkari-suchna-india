const request = require("supertest");
const app = require("../../server/app");

describe("Admin Auth API", () => {
  test("POST /api/admin/login returns 400 for missing fields", async () => {
    const response = await request(app).post("/api/admin/login").send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/login returns 401 for invalid username", async () => {
    const response = await request(app).post("/api/admin/login").send({
      username: "invalid-user",
      password: "123456"
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/admin/dev-auto-login is not available in test env", async () => {
    const response = await request(app)
      .post("/api/admin/dev-auto-login")
      .set("Host", "localhost");

    expect(response.status).toBe(404);
  });

  test("POST /api/admin/dev-auto-login is not available on production host", async () => {
    const response = await request(app)
      .post("/api/admin/dev-auto-login")
      .set("Host", "www.sarkarisuchnaindia.com");

    expect(response.status).toBe(404);
  });
});
