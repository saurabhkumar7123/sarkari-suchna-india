"use strict";

const express = require("express");
const router = express.Router();
const asyncHandler = require("../../utils/asyncHandler");
const controller = require("../../controllers/admin/enterprisePersistence.controller");

router.get("/snapshot", asyncHandler(controller.getSnapshot));
router.get("/search", asyncHandler(controller.searchUnified));

router.get("/recruitments", asyncHandler(controller.listRecruitments));
router.get("/recruitments/:id", asyncHandler(controller.getRecruitment));
router.put("/recruitments/:id", asyncHandler(controller.updateRecruitment));
router.post("/recruitments/:id/soft-delete", asyncHandler(controller.softDeleteRecruitment));
router.post("/recruitments/:id/restore", asyncHandler(controller.restoreRecruitment));

router.get("/drafts", asyncHandler(controller.listDrafts));
router.get("/drafts/:id", asyncHandler(controller.getDraft));

router.get("/workflows", asyncHandler(controller.listWorkflows));
router.get("/review-queue", asyncHandler(controller.listReviewQueue));

router.get("/audit", asyncHandler(controller.listAudit));
router.get("/audit/export", asyncHandler(controller.exportAudit));

router.get("/metrics", asyncHandler(controller.listMetrics));
router.get("/soft-deletes", asyncHandler(controller.listSoftDeletes));

router.get("/versions/:entityType/:entityId", asyncHandler(controller.listVersions));
router.get(
  "/versions/:entityType/:entityId/compare/:leftVersion/:rightVersion",
  asyncHandler(controller.compareVersions)
);

router.get("/notification-gateway", asyncHandler(controller.getNotificationGatewayStatus));
router.get("/rbac", asyncHandler(controller.getRbacMatrix));

module.exports = router;
