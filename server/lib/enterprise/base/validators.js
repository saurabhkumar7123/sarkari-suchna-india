"use strict";

function assertRequiredString(value, fieldName, max = 500) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    throw err;
  }
  return normalized.slice(0, max);
}

function assertOptionalString(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max);
}

function assertPositiveId(value, fieldName = "id") {
  const parsed = parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

function assertEnum(value, allowed, fieldName) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

function assertJsonObject(value, fieldName = "payload") {
  if (value === undefined || value === null) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  const err = new Error(`${fieldName} must be an object`);
  err.statusCode = 400;
  throw err;
}

module.exports = {
  assertRequiredString,
  assertOptionalString,
  assertPositiveId,
  assertEnum,
  assertJsonObject
};
