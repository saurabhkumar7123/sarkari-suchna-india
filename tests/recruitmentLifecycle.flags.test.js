"use strict";

const ENV_KEYS = {
  DATA_PRESENCE: "RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED",
  READ_AWARENESS: "RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED",
  EDITORIAL_ATTACHMENT: "RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED",
  MONITORING_MATCH: "RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED",
  PUBLIC_LIFECYCLE: "RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED"
};

const ALL_ENV_KEYS = Object.values(ENV_KEYS);

function loadModule() {
  jest.resetModules();
  return require("../server/config/recruitmentLifecycle");
}

describe("recruitmentLifecycle feature flags", () => {
  const originalEnv = {};

  beforeEach(() => {
    for (const key of ALL_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  test("default values are false when env vars are missing", () => {
    const config = loadModule();

    expect(config.getRecruitmentLifecycleFlags()).toEqual({
      dataPresence: false,
      readAwareness: false,
      editorialAttachment: false,
      monitoringMatch: false,
      publicLifecycle: false
    });
    expect(config.isRecruitmentDataPresenceEnabled()).toBe(false);
    expect(config.isRecruitmentReadAwarenessEnabled()).toBe(false);
    expect(config.isRecruitmentEditorialAttachmentEnabled()).toBe(false);
    expect(config.isRecruitmentMonitoringMatchEnabled()).toBe(false);
    expect(config.isRecruitmentPublicLifecycleEnabled()).toBe(false);
  });

  test("missing env values return false", () => {
    const config = loadModule();

    for (const key of ALL_ENV_KEYS) {
      delete process.env[key];
      expect(config.parseEnvFlag(process.env[key])).toBe(false);
    }
  });

  test.each([
    ["1", true],
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["on", true],
    ["0", false],
    ["false", false],
    ["FALSE", false],
    ["no", false],
    ["off", false],
    ["", false],
    ["maybe", false],
    [undefined, false],
    [null, false]
  ])("parseEnvFlag(%p) returns %p", (rawValue, expected) => {
    const config = loadModule();
    expect(config.parseEnvFlag(rawValue)).toBe(expected);
  });

  test("explicit true works for each flag group", () => {
    for (const [flagName, envKey] of [
      ["dataPresence", ENV_KEYS.DATA_PRESENCE],
      ["readAwareness", ENV_KEYS.READ_AWARENESS],
      ["editorialAttachment", ENV_KEYS.EDITORIAL_ATTACHMENT],
      ["monitoringMatch", ENV_KEYS.MONITORING_MATCH],
      ["publicLifecycle", ENV_KEYS.PUBLIC_LIFECYCLE]
    ]) {
      delete process.env[ENV_KEYS.DATA_PRESENCE];
      delete process.env[ENV_KEYS.READ_AWARENESS];
      delete process.env[ENV_KEYS.EDITORIAL_ATTACHMENT];
      delete process.env[ENV_KEYS.MONITORING_MATCH];
      delete process.env[ENV_KEYS.PUBLIC_LIFECYCLE];
      process.env[envKey] = "true";

      const config = loadModule();
      const flags = config.getRecruitmentLifecycleFlags();

      expect(flags[flagName]).toBe(true);
      for (const otherFlag of Object.keys(flags)) {
        if (otherFlag !== flagName) {
          expect(flags[otherFlag]).toBe(false);
        }
      }
    }
  });

  test("explicit false works for each flag group", () => {
    for (const envKey of ALL_ENV_KEYS) {
      process.env[envKey] = "false";
    }

    const config = loadModule();

    expect(config.getRecruitmentLifecycleFlags()).toEqual({
      dataPresence: false,
      readAwareness: false,
      editorialAttachment: false,
      monitoringMatch: false,
      publicLifecycle: false
    });
  });

  test("exports all five flag groups with metadata", () => {
    const config = loadModule();

    expect(Object.keys(config.FLAG_GROUPS).sort()).toEqual(["A", "B", "C", "D", "E"]);
    expect(config.FLAG_GROUPS.A.envKey).toBe(ENV_KEYS.DATA_PRESENCE);
    expect(config.FLAG_GROUPS.E.envKey).toBe(ENV_KEYS.PUBLIC_LIFECYCLE);
  });
});
