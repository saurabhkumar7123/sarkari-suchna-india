"use strict";

const { recordActivity } = require("../services/adminActivity.service");

function adminFromReq(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

function baseMeta(req) {
  return {
    admin: adminFromReq(req),
    ip: String(req.ip || ""),
    userAgent: String((req.headers && req.headers["user-agent"]) || ""),
    requestId: String(req.id || "")
  };
}

/**
 * @param {string} slug
 * @param {string} [title]
 */
function formatPageTarget(slug, title) {
  const s = String(slug || "").trim();
  const t = String(title || "").trim().slice(0, 120);
  if (!s) return t || "";
  return t ? `${s} — ${t}` : s;
}

async function logGeneratorActivity(req, meta = {}) {
  try {
    await recordActivity({ ...baseMeta(req), ...meta });
  } catch {
    // non-blocking
  }
}

module.exports = {
  logGeneratorActivity,
  formatPageTarget,
  adminFromReq,
  baseMeta
};
