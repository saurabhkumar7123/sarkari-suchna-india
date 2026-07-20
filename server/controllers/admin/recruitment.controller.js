"use strict";

const recruitmentService = require("../../services/recruitment.service");
const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

const listRecruitmentsHandler = async (req, res) => {
  const { data, pagination } = await recruitmentService.listRecruitments({
    page: req.query.page,
    limit: req.query.limit,
    lifecycle_state: req.query.lifecycle_state,
    cycle_year: req.query.cycle_year,
    search: req.query.search
  });
  res.json({ success: true, data, pagination });
};

const getRecruitmentHandler = async (req, res) => {
  const row = await recruitmentService.getRecruitment(req.params.id);
  res.json({ success: true, data: row });
};

const getRecruitmentDetailHandler = async (req, res) => {
  const detail = await recruitmentService.getRecruitmentDetail(req.params.id, req.query || {});
  res.json({ success: true, data: detail });
};

const createRecruitmentHandler = async (req, res) => {
  const row = await recruitmentService.createRecruitment(req.body || {});
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_create",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.status(201).json({ success: true, data: row });
};

const updateRecruitmentHandler = async (req, res) => {
  const row = await recruitmentService.updateRecruitment(req.params.id, req.body || {});
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_update",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  // Package 4D — refresh the shared preview after an operator-driven update.
  await sharedPreviewService.refreshAfterChange(row.id, "recruitment_update", adminUsername(req));
  res.json({ success: true, data: row });
};

module.exports = {
  listRecruitmentsHandler,
  getRecruitmentHandler,
  getRecruitmentDetailHandler,
  createRecruitmentHandler,
  updateRecruitmentHandler
};
