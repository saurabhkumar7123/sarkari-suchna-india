const express = require("express");
const router = express.Router();

const {
  listSites,
  createSiteHandler,
  updateSiteHandler,
  deleteSiteHandler,
  listRecentUpdates,
  restoreSiteHandler,
  disableSiteHandler,
  runCheckHandler,
  queueStatusHandler,
  queueFailedHandler,
  queueRetryHandler,
  queueRetryOneHandler,
  queueClearHandler
} = require("../../controllers/admin/updates.controller");
const { adminSensitiveLimiter } = require("../../config/rateLimits");

router.get("/sites", listSites);
router.get("/updates", listRecentUpdates);
router.post("/sites", createSiteHandler);
router.put("/sites/:id", updateSiteHandler);
router.delete("/sites/:id", deleteSiteHandler);
router.patch("/sites/:id/restore", restoreSiteHandler);
router.post("/sites/:id/disable", disableSiteHandler);
router.post("/run-check", adminSensitiveLimiter, runCheckHandler);
router.get("/queue/status", queueStatusHandler);
router.get("/queue/failed", queueFailedHandler);
router.post("/queue/retry", adminSensitiveLimiter, queueRetryHandler);
router.post("/queue/retry/:id", adminSensitiveLimiter, queueRetryOneHandler);
router.post("/queue/clear", adminSensitiveLimiter, queueClearHandler);

module.exports = router;
