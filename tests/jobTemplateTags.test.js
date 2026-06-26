const { buildJobTemplateVariables } = require("../server/utils/templatePlaceholders");

describe("job template tag placeholders", () => {
  test("empty category hides tag meta and skips status fallback", () => {
    const vars = buildJobTemplateVariables({
      title: "Sample Job 2026",
      text: "Short info",
      slug: "sample-job-2026",
      category: "",
      normalizedStatus: "latest job"
    });

    expect(vars.TAG).toBe("");
    expect(vars.TAG_META_HIDDEN).toBe(" hidden");
    expect(vars.TAG_HREF).toBe("");
    expect(vars.TAG_SLUG).toBe("");
  });

  test("category tag links to topic page for non-board topics", () => {
    const vars = buildJobTemplateVariables({
      title: "SSC CGL Online Form 2026",
      text: "Short info",
      slug: "ssc-cgl-2026",
      category: "ssc, cgl",
      normalizedStatus: "latest job"
    });

    expect(vars.TAG).toBe("ssc, cgl");
    expect(vars.TAG_META_HIDDEN).toBe("");
    expect(vars.TAG_HREF).toBe("/topic/ssc-cgl");
    expect(vars.TAG_SLUG).toBe("ssc-cgl");
  });

  test("single board tag links to department hub", () => {
    const vars = buildJobTemplateVariables({
      title: "UP Police Constable 2026",
      text: "Short info",
      slug: "up-police-constable-2026",
      category: "police",
      normalizedStatus: "latest job"
    });

    expect(vars.TAG_HREF).toBe("/department/police");
  });

  test("explicit advertisementNo overrides text extraction", () => {
    const vars = buildJobTemplateVariables({
      title: "SSC CGL Online Form 2026",
      text: "Advt No: 99/2020",
      slug: "ssc-cgl-2026",
      category: "ssc",
      normalizedStatus: "latest job",
      advertisementNo: "14/2026"
    });

    expect(vars.ADVERTISEMENT_NO).toBe("14/2026");
    expect(vars.BANNER_ADVT_DISPLAY).toBe("14/2026");
  });

  test("falls back to text extraction when advertisementNo empty", () => {
    const vars = buildJobTemplateVariables({
      title: "SSC CGL Online Form 2026",
      text: "Advt No: 99/2020",
      slug: "ssc-cgl-2026",
      category: "ssc",
      normalizedStatus: "latest job"
    });

    expect(vars.ADVERTISEMENT_NO).toBe("99/2020");
  });
});
