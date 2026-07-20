"use strict";

function assertLockVersion(current, expected) {
  const currentVersion = Number(current) || 0;
  const expectedVersion = expected == null ? null : Number(expected);
  if (expectedVersion == null) return currentVersion;
  if (currentVersion !== expectedVersion) {
    const err = new Error("Record was modified by another process");
    err.statusCode = 409;
    err.code = "OPTIMISTIC_LOCK_CONFLICT";
    throw err;
  }
  return currentVersion + 1;
}

module.exports = {
  assertLockVersion
};
