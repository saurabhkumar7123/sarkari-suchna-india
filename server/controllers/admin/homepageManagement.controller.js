const pageRepository = require("../../repositories/page.repository");
const smallBoxService = require("../../services/smallBox.service");
const homepagePlacementService = require("../../services/homepagePlacement.service");
const { invalidatePageCaches } = require("../../services/cache.services");
const { parseBadges } = require("../../services/page.service");
const { recordActivity } = require("../../services/adminActivity.service");
const { ALLOWED_BADGE_CODES, HOMEPAGE_BADGE_MAX } = require("../../lib/homepageBadges");
const { MAX_SLOT, MOBILE_MAX_SLOT } = require("../../lib/smallBoxSlots");

function placementErrorResponse(res, error) {
  const code = error && error.code;
  if (code === "PAGE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: "Page not found" });
  }
  if (code === "INVALID_SLUG" || code === "INVALID_SLOT") {
    return res.status(400).json({ success: false, message: error.message || "Invalid request" });
  }
  return null;
}

const getHomepageManagementOverview = async (req, res) => {
  try {
    const [breakingRows, badgeRows, smallBoxes] = await Promise.all([
      pageRepository.selectHomepageBreakingAdmin(),
      pageRepository.selectPagesWithBadges(),
      smallBoxService.getSmallBoxSlotMap()
    ]);

    const breaking = breakingRows.map((row) => ({
      title: row.title,
      slug: row.slug,
      url: `/${row.slug}`,
      status: (row.status || "").toLowerCase(),
      breakingOrder: Number(row.breakingOrder) || 0,
      badges: parseBadges(row.badges),
      eventTime: row.eventTime || null,
      createdAt: row.createdAt || null
    }));

    const badges = badgeRows.map((row) => ({
      title: row.title,
      slug: row.slug,
      url: `/${row.slug}`,
      status: (row.status || "").toLowerCase(),
      badges: parseBadges(row.badges),
      createdAt: row.createdAt || null
    }));

    const homepageTickerLimit = 10;
    const breakingOnHomepage = Math.min(breaking.length, homepageTickerLimit);
    const breakingOverflow =
      breaking.length > homepageTickerLimit ? breaking.length - homepageTickerLimit : 0;

    return res.json({
      success: true,
      data: {
        breaking,
        badges,
        smallBoxes,
        meta: {
          breakingTotal: breaking.length,
          breakingOnHomepage,
          breakingOverflow,
          homepageTickerLimit,
          badgePagesTotal: badges.length,
          smallBoxSlotsTotal: Array.isArray(smallBoxes) ? smallBoxes.length : 0,
          smallBoxSlotsMax: MAX_SLOT,
          smallBoxMobileMax: MOBILE_MAX_SLOT,
          allowedBadgeCodes: ALLOWED_BADGE_CODES,
          maxBadgesPerPage: HOMEPAGE_BADGE_MAX
        }
      }
    });
  } catch (error) {
    console.error("ADMIN HOMEPAGE MANAGEMENT OVERVIEW:", error);
    return res.status(500).json({ success: false, message: "Failed to load homepage management overview" });
  }
};

const patchHomepageBreaking = async (req, res) => {
  try {
    const slug = req.params.slug;
    const { breaking, breakingOrder } = req.body;
    const result = await homepagePlacementService.updateBreakingPlacement(slug, {
      breaking,
      breakingOrder
    });

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: breaking ? "homepage_breaking_set" : "homepage_breaking_clear",
      target: result.slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, data: result });
  } catch (error) {
    const handled = placementErrorResponse(res, error);
    if (handled) return handled;
    console.error("ADMIN HOMEPAGE BREAKING PATCH:", error);
    return res.status(500).json({ success: false, message: "Failed to update breaking placement" });
  }
};

const patchHomepageBadges = async (req, res) => {
  try {
    const slug = req.params.slug;
    const badges = Array.isArray(req.body.badges) ? req.body.badges : [];
    const result = await homepagePlacementService.updateBadgePlacement(slug, badges);

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: badges.length ? "homepage_badges_set" : "homepage_badges_clear",
      target: result.slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, data: result });
  } catch (error) {
    const handled = placementErrorResponse(res, error);
    if (handled) return handled;
    console.error("ADMIN HOMEPAGE BADGES PATCH:", error);
    return res.status(500).json({ success: false, message: "Failed to update badge placement" });
  }
};

async function invalidateSmallBoxPlacementCaches(result) {
  const slugs = new Set();
  if (result && result.slug) slugs.add(result.slug);
  if (result && result.previousSlug) slugs.add(result.previousSlug);
  if (!slugs.size) return;
  await invalidatePageCaches([...slugs]).catch(() => {});
}

const patchHomepageSmallBox = async (req, res) => {
  try {
    const slug = req.params.slug;
    const { smallBoxSlot } = req.body;
    const result = await homepagePlacementService.updateSmallBoxPlacement(slug, smallBoxSlot);
    await invalidateSmallBoxPlacementCaches(result);

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: result.smallBoxSlot == null ? "homepage_smallbox_clear" : "homepage_smallbox_set",
      target: result.slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, data: result });
  } catch (error) {
    const handled = placementErrorResponse(res, error);
    if (handled) return handled;
    console.error("ADMIN HOMEPAGE SMALL BOX PATCH:", error);
    return res.status(500).json({ success: false, message: "Failed to update small box placement" });
  }
};

const patchHomepageSmallBoxSlot = async (req, res) => {
  try {
    const slot = req.params.slot;
    const { slug } = req.body;
    const result = await homepagePlacementService.updateSmallBoxSlotPlacement(slot, slug);
    await invalidateSmallBoxPlacementCaches(result);

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: result.slug == null ? "homepage_smallbox_clear" : "homepage_smallbox_set",
      target: result.slug || `slot-${slot}`,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, data: result });
  } catch (error) {
    const handled = placementErrorResponse(res, error);
    if (handled) return handled;
    console.error("ADMIN HOMEPAGE SMALL BOX SLOT PATCH:", error);
    return res.status(500).json({ success: false, message: "Failed to update small box slot" });
  }
};

module.exports = {
  getHomepageManagementOverview,
  patchHomepageBreaking,
  patchHomepageBadges,
  patchHomepageSmallBox,
  patchHomepageSmallBoxSlot
};
