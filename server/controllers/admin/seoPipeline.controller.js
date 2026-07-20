"use strict";

/**
 * Package 4F — SEO & content pipeline admin controller.
 */

const seoPipelineService = require("../../services/seoPipeline.service");

function adminUsername(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

async function diagnosticsPanelHandler(req, res) {
  const limit = parseInt(String(req.query.limit || "40"), 10);
  const data = await seoPipelineService.getDiagnosticsPanel(limit);
  res.json({ success: true, data });
}

async function pageDiagnosticsHandler(req, res) {
  const data = await seoPipelineService.getPageDiagnostics(req.params.slug);
  res.json({ success: true, data });
}

async function contentValidationHandler(req, res) {
  const data = await seoPipelineService.validatePageContent(req.params.slug);
  res.json({ success: true, data });
}

async function editorialChecklistHandler(req, res) {
  const data = await seoPipelineService.getEditorialChecklistForSlug(req.params.slug);
  res.json({ success: true, data });
}

async function linkSuggestionsHandler(req, res) {
  const limit = parseInt(String(req.query.limit || "6"), 10);
  const data = await seoPipelineService.getLinkSuggestionsForSlug(req.params.slug, limit);
  res.json({ success: true, data });
}

async function freshnessHandler(req, res) {
  const data = await seoPipelineService.getFreshnessForSlug(req.params.slug);
  res.json({ success: true, data });
}

async function recordReviewHandler(req, res) {
  const lastReviewDate = req.body && req.body.lastReviewDate;
  const data = await seoPipelineService.recordPageReview(
    req.params.slug,
    lastReviewDate,
    adminUsername(req)
  );
  res.json({ success: true, data });
}

async function sitemapValidationHandler(_req, res) {
  const data = await seoPipelineService.getSitemapValidationReport();
  res.json({ success: true, data });
}

async function featureCompletionReportHandler(_req, res) {
  const data = seoPipelineService.getFeatureCompletionReportData();
  res.json({ success: true, data });
}

module.exports = {
  diagnosticsPanelHandler,
  pageDiagnosticsHandler,
  contentValidationHandler,
  editorialChecklistHandler,
  linkSuggestionsHandler,
  freshnessHandler,
  recordReviewHandler,
  sitemapValidationHandler,
  featureCompletionReportHandler
};
