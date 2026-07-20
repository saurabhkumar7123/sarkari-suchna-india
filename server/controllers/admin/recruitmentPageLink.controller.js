"use strict";

const recruitmentPageLinkService = require("../../services/recruitmentPageLink.service");
const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

function pageRefFromRequest(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query && typeof req.query === "object" ? req.query : {};
  return {
    page_id: body.page_id !== undefined ? body.page_id : query.page_id,
    slug: body.slug !== undefined ? body.slug : query.slug
  };
}

const linkPageHandler = async (req, res) => {
  const row = await recruitmentPageLinkService.linkPage(req.body || {});
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_page_link",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  // Package 4D — refresh the shared preview after a page link change.
  if (row.recruitment_id != null) {
    await sharedPreviewService.refreshAfterChange(
      row.recruitment_id,
      "page_link_change",
      adminUsername(req)
    );
  }
  res.status(201).json({ success: true, data: row });
};

const unlinkPageHandler = async (req, res) => {
  const ref = pageRefFromRequest(req);
  // Capture the recruitment this page was linked to before clearing it,
  // so the shared preview of that recruitment can be refreshed (4D).
  let previous = null;
  try {
    previous = await recruitmentPageLinkService.getPageLinkage(ref);
  } catch {
    previous = null;
  }
  const row = await recruitmentPageLinkService.unlinkPage(ref);
  await recordActivity({
    admin: adminUsername(req),
    action: "recruitment_page_unlink",
    target: String(row.id),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  if (previous && previous.recruitment_id != null) {
    await sharedPreviewService.refreshAfterChange(
      previous.recruitment_id,
      "page_link_change",
      adminUsername(req)
    );
  }
  res.json({ success: true, data: row });
};

const getPageLinkageHandler = async (req, res) => {
  const row = await recruitmentPageLinkService.getPageLinkage(pageRefFromRequest(req));
  res.json({ success: true, data: row });
};

const listLinkedPagesHandler = async (req, res) => {
  const { data, pagination } = await recruitmentPageLinkService.listLinkedPages({
    recruitment_id: req.query.recruitment_id,
    recruitment_event_id: req.query.recruitment_event_id,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json({ success: true, data, pagination });
};

module.exports = {
  linkPageHandler,
  unlinkPageHandler,
  getPageLinkageHandler,
  listLinkedPagesHandler
};
