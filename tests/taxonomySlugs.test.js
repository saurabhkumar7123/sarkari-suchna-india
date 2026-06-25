"use strict";

const {
  toTaxonomyPathSlug,
  resolveQualificationFromPath,
  resolveStateFromPath,
  buildDepartmentPath,
  buildBoardPath,
  buildQualificationPath,
  buildStatePath
} = require("../server/lib/taxonomySlugs");

describe("taxonomySlugs", () => {
  it("converts spaced values to hyphenated path slugs", () => {
    expect(toTaxonomyPathSlug("central")).toBe("central");
    expect(toTaxonomyPathSlug("all india")).toBe("all-india");
    expect(toTaxonomyPathSlug("post graduation")).toBe("post-graduation");
    expect(toTaxonomyPathSlug("10th")).toBe("10th");
  });

  it("resolves qualification path slugs against whitelist", () => {
    expect(resolveQualificationFromPath("10th")).toBe("10th");
    expect(resolveQualificationFromPath("post-graduation")).toBe("post graduation");
    expect(resolveQualificationFromPath("invalid")).toBeNull();
  });

  it("resolves state path slugs against whitelist", () => {
    expect(resolveStateFromPath("central")).toBe("central");
    expect(resolveStateFromPath("all-india")).toBe("central");
    expect(resolveStateFromPath("uttar-pradesh")).toBe("uttar pradesh");
    expect(resolveStateFromPath("invalid")).toBeNull();
  });

  it("builds canonical taxonomy hub paths", () => {
    expect(buildDepartmentPath("railway")).toBe("/department/railway");
    expect(buildBoardPath("railway")).toBe("/department/railway");
    expect(buildQualificationPath("10th")).toBe("/qualification/10th");
    expect(buildStatePath("central")).toBe("/state/central");
    expect(buildStatePath("all india")).toBe("/state/all-india");
  });
});
