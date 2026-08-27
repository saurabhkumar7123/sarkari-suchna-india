"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const controller = require("../../controllers/admin/automationControlCenter.controller");
const {
  automationSourceListQuerySchema,
  automationSourceUpsertSchema,
  automationSourceVerifySchema,
  automationSettingsUpdateSchema,
  automationWorkflowListQuerySchema,
  automationAuditListQuerySchema,
  automationControlsUpdateSchema
} = require("../../validations/admin.validation");

const router = express.Router();

router.get("/automation-control-center", asyncHandler(controller.getAccSnapshotHandler));
router.get(
  "/automation-control-center/dashboard",
  asyncHandler(controller.getDashboardHandler)
);
router.get(
  "/automation-control-center/sources",
  validateJoi(automationSourceListQuerySchema, "query"),
  asyncHandler(controller.listSourcesHandler)
);
router.post(
  "/automation-control-center/sources/verify",
  adminSensitiveLimiter,
  validateJoi(automationSourceVerifySchema, "body"),
  asyncHandler(controller.verifySourceHandler)
);
router.get("/automation-control-center/sources/:id", asyncHandler(controller.getSourceHandler));
router.post(
  "/automation-control-center/sources",
  adminSensitiveLimiter,
  validateJoi(automationSourceUpsertSchema, "body"),
  asyncHandler(controller.createSourceHandler)
);
router.put(
  "/automation-control-center/sources/:id",
  adminSensitiveLimiter,
  validateJoi(automationSourceUpsertSchema, "body"),
  asyncHandler(controller.updateSourceHandler)
);
router.post(
  "/automation-control-center/sources/:id/verify",
  adminSensitiveLimiter,
  asyncHandler(controller.verifySourceByIdHandler)
);
router.post(
  "/automation-control-center/sources/:id/enable",
  adminSensitiveLimiter,
  asyncHandler(controller.enableSourceHandler)
);
router.post(
  "/automation-control-center/sources/:id/disable",
  adminSensitiveLimiter,
  asyncHandler(controller.disableSourceHandler)
);
router.post(
  "/automation-control-center/sources/:id/run-check",
  adminSensitiveLimiter,
  asyncHandler(controller.runSourceCheckHandler)
);
router.delete(
  "/automation-control-center/sources/:id",
  adminSensitiveLimiter,
  asyncHandler(controller.deleteSourceHandler)
);
router.get("/automation-control-center/settings", asyncHandler(controller.getSettingsHandler));
router.put(
  "/automation-control-center/settings",
  adminSensitiveLimiter,
  validateJoi(automationSettingsUpdateSchema, "body"),
  asyncHandler(controller.updateSettingsHandler)
);
router.get(
  "/automation-control-center/workflow",
  validateJoi(automationWorkflowListQuerySchema, "query"),
  asyncHandler(controller.listWorkflowHandler)
);
router.get(
  "/automation-control-center/audit",
  validateJoi(automationAuditListQuerySchema, "query"),
  asyncHandler(controller.listAuditHandler)
);
router.get(
  "/automation-control-center/controls",
  asyncHandler(controller.getControlsHandler)
);
router.patch(
  "/automation-control-center/controls",
  adminSensitiveLimiter,
  validateJoi(automationControlsUpdateSchema, "body"),
  asyncHandler(controller.updateControlsHandler)
);

module.exports = router;
