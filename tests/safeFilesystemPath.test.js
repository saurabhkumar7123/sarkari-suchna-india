"use strict";

const path = require("path");
const {
  FILESYSTEM_SLUG_RE,
  normalizeFilesystemSlug,
  isValidFilesystemSlug,
  isPathInsideRoot,
  resolveInsideRoot
} = require("../server/lib/safeFilesystemPath");

describe("safeFilesystemPath", () => {
  describe("normalizeFilesystemSlug", () => {
    it("trims and strips trailing .html", () => {
      expect(normalizeFilesystemSlug("  ssc-cgl-2026.html  ")).toBe("ssc-cgl-2026");
      expect(normalizeFilesystemSlug("SSC-CGL-2026.HTML")).toBe("SSC-CGL-2026");
    });
  });

  describe("isValidFilesystemSlug", () => {
    it("accepts live job slugs", () => {
      expect(isValidFilesystemSlug("ssc-cgl-2026")).toBe(true);
      expect(isValidFilesystemSlug("police-1")).toBe(true);
      expect(isValidFilesystemSlug("crpf-constable-form-9195-posts")).toBe(true);
    });

    it("rejects traversal and malformed slugs", () => {
      expect(isValidFilesystemSlug("../private/admin-dashboard")).toBe(false);
      expect(isValidFilesystemSlug("..")).toBe(false);
      expect(isValidFilesystemSlug("foo/bar")).toBe(false);
      expect(isValidFilesystemSlug("")).toBe(false);
      expect(isValidFilesystemSlug("%2e%2e")).toBe(false);
    });

    it("exports the expected slug regex", () => {
      expect(FILESYSTEM_SLUG_RE.test("ssc-cgl-2026")).toBe(true);
      expect(FILESYSTEM_SLUG_RE.test("..")).toBe(false);
    });
  });

  describe("isPathInsideRoot", () => {
    const root = path.resolve("/var/www/generated");

    it("accepts files directly under root", () => {
      const inside = path.join(root, "jobs", "ssc-cgl-2026.html");
      expect(isPathInsideRoot(inside, root)).toBe(true);
    });

    it("rejects paths outside root", () => {
      const outside = path.resolve(root, "jobs", "..", "..", "private", "admin-dashboard.html");
      expect(isPathInsideRoot(outside, root)).toBe(false);
    });
  });

  describe("resolveInsideRoot", () => {
    const generatedRoot = path.resolve("/project/generated");

    it("resolves a valid generated job path", () => {
      const resolved = resolveInsideRoot(generatedRoot, "jobs", "ssc-cgl-2026.html");
      expect(resolved).toBe(path.resolve(generatedRoot, "jobs", "ssc-cgl-2026.html"));
    });

    it("returns null for directory escape attempts", () => {
      expect(resolveInsideRoot(generatedRoot, "jobs", "..", "..", "..", "etc", "passwd")).toBeNull();
      expect(resolveInsideRoot(generatedRoot, "jobs", "../../../private/admin-dashboard.html")).toBeNull();
    });

    it("returns null for empty segments", () => {
      expect(resolveInsideRoot(generatedRoot)).toBeNull();
    });
  });
});
