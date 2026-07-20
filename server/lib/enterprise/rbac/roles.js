"use strict";

const ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  REVIEWER: "reviewer",
  AUDITOR: "auditor",
  VIEWER: "viewer"
});

const ROLE_HIERARCHY = Object.freeze([
  ROLES.VIEWER,
  ROLES.AUDITOR,
  ROLES.REVIEWER,
  ROLES.EDITOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
]);

module.exports = {
  ROLES,
  ROLE_HIERARCHY
};
