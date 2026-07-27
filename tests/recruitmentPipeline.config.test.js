"use strict";

const ENV_KEY = "RECRUITMENT_PIPELINE_ENABLED";

function loadModule() {
  jest.resetModules();
  return require("../server/config/recruitmentPipeline");
}

describe("recruitmentPipeline feature flag", () => {
  const originalValue = process.env[ENV_KEY];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  test("defaults to false when env var is missing", () => {
    delete process.env[ENV_KEY];
    const config = loadModule();
    expect(config.isRecruitmentPipelineEnabled()).toBe(false);
  });

  test.each([
    ["1", true],
    ["true", true],
    ["yes", true],
    ["on", true],
    ["0", false],
    ["false", false],
    ["no", false],
    ["off", false],
    ["", false],
    ["maybe", false]
  ])("parseEnvFlag(%p) returns %p", (rawValue, expected) => {
    const config = loadModule();
    expect(config.parseEnvFlag(rawValue)).toBe(expected);
  });

  test("isRecruitmentPipelineEnabled reads RECRUITMENT_PIPELINE_ENABLED", () => {
    process.env[ENV_KEY] = "true";
    const config = loadModule();
    expect(config.isRecruitmentPipelineEnabled()).toBe(true);
  });
});
