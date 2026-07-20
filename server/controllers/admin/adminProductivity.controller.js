"use strict";

const recruitmentBulkService = require("../../services/recruitmentBulk.service");
const adminProductivityService = require("../../services/adminProductivity.service");
const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

const bulkRecruitmentsHandler = async (req, res) => {
  const result = await recruitmentBulkService.executeBulk(req.body || {}, adminUsername(req));

  await recordActivity({
    admin: adminUsername(req),
    action: `recruitment_bulk_${result.summary.action}`,
    target: `${result.summary.ok}/${result.summary.requested}`,
    status: result.summary.failed > 0 ? "partial" : "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});

  // Refresh shared previews for successful non-delete mutations.
  if (result.summary.action !== "delete") {
    for (const row of result.results) {
      if (row.status === "ok" && row.id) {
        await sharedPreviewService
          .refreshAfterChange(row.id, "recruitment_update", adminUsername(req))
          .catch(() => {});
      }
    }
  }

  res.json({ success: true, data: result });
};

const productivitySummaryHandler = async (req, res) => {
  const data = await adminProductivityService.getProductivitySummary();
  res.json({ success: true, data });
};

module.exports = {
  bulkRecruitmentsHandler,
  productivitySummaryHandler
};
