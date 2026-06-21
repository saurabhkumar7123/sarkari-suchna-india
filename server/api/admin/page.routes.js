const express = require("express");
const router = express.Router();

const controller = require("../../controllers/admin/page.controller");
const asyncHandler = require("../../utils/asyncHandler");
const { validateSlugParam } = require("../../validations/page.validation");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { emptyBodySchema, homepageBreakingPatchSchema, homepageBadgesPatchSchema, homepageSmallBoxPatchSchema } = require("../../validations/admin.validation");
const { adminSensitiveLimiter } = require("../../config/rateLimits");

// Auth: app.use("/api/admin", verifyToken) already applied

// 📄 GET ALL
router.get("/pages", asyncHandler(controller.getAllPages));

// 📊 DASHBOARD
router.get("/dashboard", asyncHandler(controller.getDashboardStats));

// 🩺 System health (admin)
const systemHealthController = require("../../controllers/admin/systemHealth.controller");
router.get("/system-health", asyncHandler(systemHealthController.getSystemHealth));

// 🎯 Homepage small-box slot occupancy (admin generator UI)
router.get("/small-box-slots", asyncHandler(controller.getSmallBoxSlots));

// 🌐 Homepage Management — overview + lightweight placement updates (Phase 2)
const homepageManagementController = require("../../controllers/admin/homepageManagement.controller");
router.get("/homepage-management", asyncHandler(homepageManagementController.getHomepageManagementOverview));
router.patch(
  "/homepage-management/breaking/:slug",
  adminSensitiveLimiter,
  validateSlugParam,
  validateJoi(homepageBreakingPatchSchema, "body"),
  asyncHandler(homepageManagementController.patchHomepageBreaking)
);
router.patch(
  "/homepage-management/badges/:slug",
  adminSensitiveLimiter,
  validateSlugParam,
  validateJoi(homepageBadgesPatchSchema, "body"),
  asyncHandler(homepageManagementController.patchHomepageBadges)
);
router.patch(
  "/homepage-management/small-box/:slug",
  adminSensitiveLimiter,
  validateSlugParam,
  validateJoi(homepageSmallBoxPatchSchema, "body"),
  asyncHandler(homepageManagementController.patchHomepageSmallBox)
);

// 📜 Activity log (admin alias; same data as public /api/activity-log)
router.get("/activity", asyncHandler(controller.getAdminActivity));

// 🗑 TRASH (paginated; aliases — must be before GET /pages/:slug)
router.get("/trash", asyncHandler(controller.getTrashPages));
router.get("/pages/trash", asyncHandler(controller.getTrashPages));

// 📄 Single page (admin editor — full row)
router.get("/pages/:slug", validateSlugParam, asyncHandler(controller.getAdminPageBySlug));

// ❌ DELETE (soft)
router.delete("/pages/:slug", adminSensitiveLimiter, validateSlugParam, asyncHandler(controller.deletePage));

// ♻ RESTORE
router.patch(
  "/pages/:slug/restore",
  adminSensitiveLimiter,
  validateSlugParam,
  validateJoi(emptyBodySchema, "body"),
  asyncHandler(controller.restorePage)
);

// 🔥 PERMANENT DELETE
router.delete("/pages/:slug/permanent", adminSensitiveLimiter, validateSlugParam, asyncHandler(controller.permanentDelete));

module.exports = router;