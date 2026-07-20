"use strict";

const recruitmentEventService = require("../../services/recruitmentEvent.service");
const { recordActivity } = require("../../services/adminActivity.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

const listRecruitmentEventsHandler = async (req, res) => {
  const { data, pagination } = await recruitmentEventService.listRecruitmentEvents({
    recruitment_id: req.params.recruitmentId,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status
  });
  res.json({ success: true, data, pagination });
};

const getRecruitmentEventHandler = async (req, res) => {
  const row = await recruitmentEventService.getRecruitmentEvent(req.params.id);
  res.json({ success: true, data: row });
};

const createRecruitmentEventHandler = async (req, res) => {
  const row = await recruitmentEventService.createRecruitmentEvent({
    ...(req.body || {}),
    recruitment_id: req.params.recruitmentId
  });
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_event_create",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.status(201).json({ success: true, data: row });
};

const updateRecruitmentEventHandler = async (req, res) => {
  const row = await recruitmentEventService.updateRecruitmentEvent(req.params.id, req.body || {});
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_event_update",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, data: row });
};

const deleteRecruitmentEventHandler = async (req, res) => {
  const row = await recruitmentEventService.deleteRecruitmentEvent(req.params.id);
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_event_delete",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, data: row });
};

module.exports = {
  listRecruitmentEventsHandler,
  getRecruitmentEventHandler,
  createRecruitmentEventHandler,
  updateRecruitmentEventHandler,
  deleteRecruitmentEventHandler
};
