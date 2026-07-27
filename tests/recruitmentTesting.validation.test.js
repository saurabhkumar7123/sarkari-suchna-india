"use strict";

const { recruitmentTestingAnalyzeSchema } = require("../server/validations/admin.validation");

describe("recruitmentTesting candidate validation", () => {
  test("accepts valid candidate JSON array", () => {
    const { error, value } = recruitmentTestingAnalyzeSchema.validate({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: [
        {
          organization: "SSC",
          exam_name: "CGL",
          recruitment_year: 2026,
          advertisement_no: "CGL-01/2026"
        }
      ]
    });

    expect(error).toBeUndefined();
    expect(value.candidateRecruitments).toHaveLength(1);
  });

  test("accepts empty candidate array", () => {
    const { error } = recruitmentTestingAnalyzeSchema.validate({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: []
    });

    expect(error).toBeUndefined();
  });

  test("rejects malformed candidate array items", () => {
    const { error } = recruitmentTestingAnalyzeSchema.validate({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: ["not-an-object"]
    });

    expect(error).toBeDefined();
    expect(error.message).toMatch(/must be an object/i);
  });

  test("rejects invalid recruitment year values", () => {
    const { error } = recruitmentTestingAnalyzeSchema.validate({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: [
        {
          organization: "SSC",
          recruitment_year: "twenty-twenty-six"
        }
      ]
    });

    expect(error).toBeDefined();
  });

  test("requires at least one notice field", () => {
    const { error } = recruitmentTestingAnalyzeSchema.validate({
      title: "",
      content: "",
      url: "",
      candidateRecruitments: []
    });

    expect(error).toBeDefined();
    expect(error.message).toMatch(/At least one of title, content, or url is required/i);
  });
});
