"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

describe("admin API rate-limit posture (429 root-cause fix)", () => {
  test("adminApiLimiter default budget supports SPA reads without disabling limits", () => {
    const src = read("server/config/rateLimits.js");
    expect(src).toMatch(/RATE_LIMIT_ADMIN_API_MAX \|\| "900"/);
    expect(src).toMatch(/admin-api:\$\{getAdminIdentity\(req\)\}:\$\{getClientIp\(req\)\}/);
    expect(src).toContain("Too many requests. Please wait a moment and try again.");
    expect(src).not.toMatch(/RATE_LIMIT_ADMIN_API_MAX \|\| "200"/);
  });

  test("session refresh does not share the login brute-force limiter", () => {
    const auth = read("server/api/admin/auth.routes.js");
    const limits = read("server/config/rateLimits.js");
    expect(limits).toContain("adminRefreshLimiter");
    expect(auth).toContain("adminRefreshLimiter");
    expect(auth).toMatch(/router\.post\(\s*"\/refresh"[\s\S]*adminRefreshLimiter/);
    expect(auth).not.toMatch(/router\.post\(\s*"\/refresh"[\s\S]*adminLoginLimiter/);
    expect(auth).toMatch(/router\.post\(\s*"\/login"[\s\S]*adminLoginLimiter/);
  });

  test("admin shell distinguishes 429 from network failure and supports quiet fetch", () => {
    const shell = read("public/assets/js/admin-shell.js");
    expect(shell).toContain("Too many requests. Please wait a moment and try again.");
    expect(shell).toContain("Could not reach the server. Check your connection and try again.");
    expect(shell).toContain("options.quiet");
    expect(shell).toContain("__httpError");
  });

  test("notification polling uses quiet fetch and backs off on 429", () => {
    const notify = read("public/assets/js/admin-notifications.js");
    expect(notify).toContain("quiet: true");
    expect(notify).toContain("hit429");
    expect(notify).toContain("POLL_MAX_MS");
    expect(notify).toContain("currentPollMs");
  });

  test("dashboard live tick is lightweight and less frequent", () => {
    const dash = read("public/assets/js/admin-dashboard.js");
    expect(dash).toContain("INTERVAL_MS = 90000");
    expect(dash).toMatch(/async function tickLive\(\)[\s\S]*loadStatsCards\(\)/);
    expect(dash).not.toMatch(/async function tickLive\(\)[\s\S]*await initAdminDashboard\(\)/);
  });
});
