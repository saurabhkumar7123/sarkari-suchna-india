"use strict";

/**
 * Regression: dashboard chart lifecycle + RRQ single active sidebar item.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel));

describe("Admin UI polish — dashboard chart + RRQ nav active state", () => {
  test("admin-dashboard.js uses safe Chart lifecycle (no bare statusChart.destroy)", () => {
    const js = read("public/assets/js/admin-dashboard.js").toString("utf8");
    expect(js).toContain("function destroyDashboardChart");
    expect(js).toContain("Chart.getChart");
    expect(js).toContain("__dashboardStatusChart");
    expect(js).not.toMatch(/if\s*\(\s*window\.statusChart\s*\)\s*window\.statusChart\.destroy\s*\(\s*\)/);
    expect(js).not.toMatch(/if\s*\(\s*window\.viewsChart\s*\)\s*window\.viewsChart\.destroy\s*\(\s*\)/);
  });

  test("dashboard subtitle is UTF-8 (not Windows-1252) and charset is present", () => {
    const buf = read("private/admin-dashboard.html");
    const html = buf.toString("utf8");
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain("feature\u2019s home");
    expect(html).toContain("Summary only \u2014 open");
    // Reject legacy Windows-1252 curly apostrophe / em dash bytes (must be UTF-8)
    expect(buf.includes(0x92)).toBe(false);
    expect(buf.includes(0x97)).toBe(false);
    expect(html).toContain('id="opsNeedsMatching">\u2014</strong>');
  });

  test("admin-shell skips query-string deep-links as active destinations", () => {
    const js = read("public/assets/js/admin-shell.js").toString("utf8");
    expect(js).toContain('if (parts.path.includes("?")) return false;');
    expect(js).toMatch(/Query-string deep-links/);
  });

  test("Recruitment Review remains a needs_matching shortcut; Review Center is canonical", () => {
    const nav = read("public/assets/js/admin-nav.js").toString("utf8");
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue", "/admin/recruitment-review-queue", I.review, "Review Center"'
    );
    expect(nav).toContain(
      'navLink("/admin/recruitment-review-queue?status=needs_matching", "/admin/recruitment-review-queue", I.review, "Recruitment Review"'
    );
    expect(nav).toContain('ADMIN_NAV_VERSION = "29"');
    expect(nav).toMatch(/filter shortcut; not a second active destination/);
  });
});
