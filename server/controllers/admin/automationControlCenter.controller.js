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

async function verifySourceHandler(req, res) {
  const data = await automationControlCenterService.verifySourceInput(req.body || {});
  await logAction(req, "automation_source_verify", data.exactUrl || "");
  res.json({ success: true, data });
}

async function verifySourceByIdHandler(req, res) {
  const data = await automationControlCenterService.verifySourceById(req.params.id);
  await logAction(req, "automation_source_verify", req.params.id);
  res.json({ success: true, data });
}

async function enableSourceHandler(req, res) {
  const data = await automationControlCenterService.setSourceEnabled(req.params.id, true);
  await logAction(req, "automation_source_enable", req.params.id);
  res.json({ success: true, data });
}

async function disableSourceHandler(req, res) {
  const data = await automationControlCenterService.setSourceEnabled(req.params.id, false);
  await logAction(req, "automation_source_disable", req.params.id);
  res.json({ success: true, data });
}

async function runSourceCheckHandler(req, res) {
  const data = await automationControlCenterService.runSourceCheck(req.params.id);
  await logAction(req, "automation_source_run_check", req.params.id);
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

function getControlsHandler(_req, res) {
  const data = automationControlCenterService.getPublishingControlState();
  res.json({ success: true, data });
}

async function updateControlsHandler(req, res) {
  const body = req.body || {};
  const data = automationControlCenterService.updatePublishingControls(body);
  await logAction(req, "automation_controls_update", "publishing_controls");
  res.json({ success: true, data });
}

module.exports = {
  getAccSnapshotHandler,
  listSourcesHandler,
  getSourceHandler,
  createSourceHandler,
  updateSourceHandler,
  deleteSourceHandler,
  verifySourceHandler,
  verifySourceByIdHandler,
  enableSourceHandler,
  disableSourceHandler,
  runSourceCheckHandler,
  getSettingsHandler,
  updateSettingsHandler,
  getDashboardHandler,
  listWorkflowHandler,
  listAuditHandler,
  getControlsHandler,
  updateControlsHandler
};
