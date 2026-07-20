"use strict";

const automationControlCenterService = require("../../services/automationControlCenter.service");
const { recordActivity } = require("../../services/adminActivity.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

async function logAction(req, action, target, status = "success") {
  await recordActivity({
    admin: adminUsername(req),
    action,
    target: target != null ? String(target) : "",
    status,
    ip: req.ip,
    userAgent: String((req.headers && req.headers["user-agent"]) || ""),
    requestId: req.id || ""
  }).catch(() => {});
}

async function getAccSnapshotHandler(req, res) {
  const data = await automationControlCenterService.getAccSnapshot();
  res.json({ success: true, data });
}

async function listSourcesHandler(req, res) {
  const result = await automationControlCenterService.listSources(req.query || {});
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function getSourceHandler(req, res) {
  const data = await automationControlCenterService.getSourceById(req.params.id);
  res.json({ success: true, data });
}

async function createSourceHandler(req, res) {
  const data = await automationControlCenterService.createSource(req.body || {});
  await logAction(req, "automation_source_create", data.id);
  res.status(201).json({ success: true, data });
}

async function updateSourceHandler(req, res) {
  const data = await automationControlCenterService.updateSource(req.params.id, req.body || {});
  await logAction(req, "automation_source_update", data.id);
  res.json({ success: true, data });
}

async function deleteSourceHandler(req, res) {
  const data = await automationControlCenterService.deleteSourceById(req.params.id);
  await logAction(req, "automation_source_delete", req.params.id);
  res.json({ success: true, data });
}

async function getSettingsHandler(_req, res) {
  const data = automationControlCenterService.getSettings();
  res.json({ success: true, data });
}

async function updateSettingsHandler(req, res) {
  const data = automationControlCenterService.saveSettings(req.body || {});
  await logAction(req, "automation_settings_update", "automation_settings");
  res.json({ success: true, data });
}

async function getDashboardHandler(_req, res) {
  const data = await automationControlCenterService.getDashboardSummary();
  res.json({ success: true, data });
}

async function listWorkflowHandler(req, res) {
  const result = await automationControlCenterService.listWorkflowItems(req.query || {});
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function listAuditHandler(req, res) {
  const result = await automationControlCenterService.listAuditEntries(req.query || {});
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

module.exports = {
  getAccSnapshotHandler,
  listSourcesHandler,
  getSourceHandler,
  createSourceHandler,
  updateSourceHandler,
  deleteSourceHandler,
  getSettingsHandler,
  updateSettingsHandler,
  getDashboardHandler,
  listWorkflowHandler,
  listAuditHandler
};
