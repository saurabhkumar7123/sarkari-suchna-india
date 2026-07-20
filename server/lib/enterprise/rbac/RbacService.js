"use strict";

const { ROLES } = require("./roles");
const { PERMISSION_MATRIX } = require("./permissions");

function normalizeRole(role) {
  const normalized = String(role || ROLES.ADMIN).trim().toLowerCase();
  return Object.values(ROLES).includes(normalized) ? normalized : ROLES.ADMIN;
}

function getPermissionsForRole(role) {
  const normalized = normalizeRole(role);
  return PERMISSION_MATRIX[normalized] || PERMISSION_MATRIX[ROLES.VIEWER];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(String(permission));
}

function authorize(role, permission) {
  const allowed = hasPermission(role, permission);
  return {
    allowed,
    role: normalizeRole(role),
    permission: String(permission),
  };
}

function createAuthorizationHook(defaultRole = ROLES.ADMIN) {
  return function checkPermission(permission, role = defaultRole) {
    return authorize(role, permission);
  };
}

module.exports = {
  normalizeRole,
  getPermissionsForRole,
  hasPermission,
  authorize,
  createAuthorizationHook
};
