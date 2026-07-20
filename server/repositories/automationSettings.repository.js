"use strict";

const fs = require("fs");
const path = require("path");
const { FLAG_DEFAULTS } = require("../config/automationFlags");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/automation-settings.json");

function resolveStorePath() {
  const fromEnv = String(process.env.AUTOMATION_SETTINGS_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildDefaultSettings() {
  return {
    version: 1,
    thresholds: {
      confidenceThreshold: 82,
      riskThreshold: 58
    },
    rules: {
      reviewRules:
        "Route low-confidence or incomplete records to manual review only.",
      draftRules:
        "Draft generation remains disabled until explicit future activation.",
      recoveryRules:
        "Use recovery data for operator inspection only while automation is dormant.",
      departmentRules:
        "Prioritize official domains and preserve auditability for all edits."
    },
    featureFlags: Object.keys(FLAG_DEFAULTS).map((key) => ({
      key,
      state: false
    }))
  };
}

function normalizeFeatureFlags(flags) {
  const map = new Map(
    (Array.isArray(flags) ? flags : []).map((flag) => [
      String(flag && flag.key ? flag.key : "").trim(),
      flag && flag.state === true
    ])
  );
  return Object.keys(FLAG_DEFAULTS).map((key) => ({
    key,
    state: Boolean(map.get(key)) && FLAG_DEFAULTS[key] === true
  }));
}

function readSettings(filePath = resolveStorePath()) {
  try {
    if (!fs.existsSync(filePath)) {
      return buildDefaultSettings();
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const defaults = buildDefaultSettings();
    return {
      version: 1,
      thresholds: {
        confidenceThreshold:
          Number(parsed?.thresholds?.confidenceThreshold) || defaults.thresholds.confidenceThreshold,
        riskThreshold:
          Number(parsed?.thresholds?.riskThreshold) || defaults.thresholds.riskThreshold
      },
      rules: {
        reviewRules: String(parsed?.rules?.reviewRules || defaults.rules.reviewRules),
        draftRules: String(parsed?.rules?.draftRules || defaults.rules.draftRules),
        recoveryRules: String(parsed?.rules?.recoveryRules || defaults.rules.recoveryRules),
        departmentRules: String(parsed?.rules?.departmentRules || defaults.rules.departmentRules)
      },
      featureFlags: normalizeFeatureFlags(parsed?.featureFlags)
    };
  } catch {
    return buildDefaultSettings();
  }
}

function writeSettings(settings, filePath = resolveStorePath()) {
  ensureDir(filePath);
  const payload = {
    version: 1,
    thresholds: {
      confidenceThreshold: Number(settings?.thresholds?.confidenceThreshold) || 82,
      riskThreshold: Number(settings?.thresholds?.riskThreshold) || 58
    },
    rules: {
      reviewRules: String(settings?.rules?.reviewRules || ""),
      draftRules: String(settings?.rules?.draftRules || ""),
      recoveryRules: String(settings?.rules?.recoveryRules || ""),
      departmentRules: String(settings?.rules?.departmentRules || "")
    },
    featureFlags: normalizeFeatureFlags(settings?.featureFlags)
  };
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return payload;
}

module.exports = {
  resolveStorePath,
  buildDefaultSettings,
  readSettings,
  writeSettings
};
