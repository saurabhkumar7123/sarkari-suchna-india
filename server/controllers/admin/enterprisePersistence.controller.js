"use strict";

const {
  defaultService,
  getPlatformSnapshot
} = require("../../services/enterprise/enterprisePersistence.service");
const { getAutomationFlags } = require("../../config/automationFlags");
const { PERMISSIONS } = require("../../lib/enterprise/rbac/permissions");
const { authorize } = require("../../lib/enterprise/rbac/RbacService");

function assertPermission(req, permission) {
  const auth = authorize(req.user?.role || "admin", permission);
  if (!auth.allowed) {
    const err = new Error("Insufficient permissions for enterprise persistence access");
    err.statusCode = 403;
    throw err;
  }
  return auth;
}

async function getSnapshot(_req, res) {
  const snapshot = await getPlatformSnapshot();
  res.json({ success: true, data: snapshot });
}

async function searchUnified(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const result = await defaultService.search.searchAll(req.query);
  res.json({ success: true, data: result });
}

async function listRecruitments(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const result = await defaultService.recruitment.listEnterprise(req.query);
  res.json({ success: true, data: result });
}

async function getRecruitment(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const row = await defaultService.recruitment.getByRecruitmentId(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Recruitment not found" });
  res.json({ success: true, data: row });
}

async function updateRecruitment(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_WRITE);
  const row = await defaultService.recruitment.upsertExtended(req.params.id, req.body, {
    author: req.user?.username || "admin",
    changeSummary: req.body.changeSummary || "Updated via enterprise API"
  });
  await defaultService.audit.recordEvent({
    category: "automation",
    eventType: "recruitment_update",
    entityType: "recruitment",
    entityId: req.params.id,
    action: "enterprise_update",
    actor: req.user?.username || "admin",
    detail: { fields: Object.keys(req.body || {}) }
  });
  res.json({ success: true, data: row });
}

async function softDeleteRecruitment(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_DELETE);
  const row = await defaultService.recruitment.softDelete(req.params.id, {
    reason: req.body?.reason,
    deletedBy: req.user?.username || "admin"
  });
  res.json({ success: true, data: row });
}

async function restoreRecruitment(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_RESTORE);
  const row = await defaultService.recruitment.restore(req.params.id, {
    restoredBy: req.user?.username || "admin"
  });
  res.json({ success: true, data: row });
}

async function listDrafts(req, res) {
  assertPermission(req, PERMISSIONS.DRAFT_READ);
  const result = await defaultService.draft.listEnterprise(req.query);
  res.json({ success: true, data: result });
}

async function getDraft(req, res) {
  assertPermission(req, PERMISSIONS.DRAFT_READ);
  const row = await defaultService.draft.getByDraftId(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Draft not found" });
  res.json({ success: true, data: row });
}

async function listWorkflows(req, res) {
  assertPermission(req, PERMISSIONS.WORKFLOW_READ);
  const result = await defaultService.workflow.listWorkflows(req.query);
  res.json({ success: true, data: result });
}

async function listReviewQueue(req, res) {
  assertPermission(req, PERMISSIONS.REVIEW_READ);
  const result = await defaultService.reviewQueue.listEnterprise(req.query);
  res.json({ success: true, data: result });
}

async function listAudit(req, res) {
  assertPermission(req, PERMISSIONS.AUDIT_READ);
  const result = await defaultService.audit.mergeLegacyAdminActivity(req.query);
  res.json({ success: true, data: result });
}

async function exportAudit(req, res) {
  assertPermission(req, PERMISSIONS.AUDIT_EXPORT);
  const result = await defaultService.audit.exportEvents(req.query);
  res.json({ success: true, data: result });
}

async function listMetrics(req, res) {
  assertPermission(req, PERMISSIONS.METRICS_READ);
  const result = await defaultService.metrics.listMetrics(req.query);
  res.json({ success: true, data: result });
}

async function listVersions(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const result = await defaultService.versionHistory.listVersions({
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json({ success: true, data: result });
}

async function compareVersions(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const left = await defaultService.versionHistory.getVersion({
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    version: req.params.leftVersion
  });
  const right = await defaultService.versionHistory.getVersion({
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    version: req.params.rightVersion
  });
  res.json({
    success: true,
    data: defaultService.versionHistory.compareVersions(left, right)
  });
}

async function listSoftDeletes(req, res) {
  assertPermission(req, PERMISSIONS.RECRUITMENT_READ);
  const result = await defaultService.softDelete.listSoftDeleteLog(req.query);
  res.json({ success: true, data: result });
}

async function getNotificationGatewayStatus(_req, res) {
  res.json({
    success: true,
    data: {
      enabled: getAutomationFlags().NOTIFICATION_GATEWAY_ENABLED === true,
      channels: defaultService.notificationGateway.getChannelStatus()
    }
  });
}

async function getRbacMatrix(_req, res) {
  const { PERMISSION_MATRIX } = require("../../lib/enterprise/rbac/permissions");
  res.json({ success: true, data: PERMISSION_MATRIX });
}

module.exports = {
  getSnapshot,
  searchUnified,
  listRecruitments,
  getRecruitment,
  updateRecruitment,
  softDeleteRecruitment,
  restoreRecruitment,
  listDrafts,
  getDraft,
  listWorkflows,
  listReviewQueue,
  listAudit,
  exportAudit,
  listMetrics,
  listVersions,
  compareVersions,
  listSoftDeletes,
  getNotificationGatewayStatus,
  getRbacMatrix
};
