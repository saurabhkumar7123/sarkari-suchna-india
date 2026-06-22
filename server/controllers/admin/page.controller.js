const path = require("path");
const fs = require("fs");
const pageRepository = require("../../repositories/page.repository");
const pageService = require("../../services/page.service");
const { invalidatePageCaches } = require("../../services/cache.services");
const db = require("../../config/db");
const pipeline = require("../../../generator/pipeline/generatePage");
const { embedRelatedJobsInJobHtml } = require("../../lib/relatedJobsEmbed");
const { getRelatedPagesForSlug } = require("../../services/relatedPages.service");
const fileService = require("../../services/file.service");
const { siteCheckQueue } = require("../../services/queue/siteQueue");
const { recordActivity, listActivity } = require("../../services/adminActivity.service");
const { canSendTelegram } = require("../../services/updates/telegramNotifier");
const { fetchSites } = require("../../services/updates/updates.repository");

/** Same canonical status list as regenerate / generator (for buildJobHtml). */
const CANONICAL_STATUSES = new Set([
  "latest job",
  "admit card",
  "result",
  "answer key",
  "document",
  "admission",
  "syllabus"
]);
const LEGACY_STATUS_ALIASES = {
  "new form": "latest job",
  new: "latest job",
  form: "latest job",
  admit: "admit card",
  answer: "answer key"
};

function normalizeStatusForPipeline(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (CANONICAL_STATUSES.has(lower)) return lower;
  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, lower)) {
    return LEGACY_STATUS_ALIASES[lower];
  }
  const cleaned = raw.replace(/\s+/g, " ").slice(0, 64).trim();
  if (!cleaned) return "other";
  return cleaned.toLowerCase();
}

const getAllPages = async (req, res) => {
  try {
    let { page = 1, limit = 20, status, category, q, notag, sort } = req.query;

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(parseInt(limit) || 20, 50);

    const offset = (page - 1) * limit;
    const orderDir = String(sort || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    let where = "WHERE deleted=0";
    const params = [];

    if (status && String(status).trim()) {
      where += " AND LOWER(status) = LOWER(?)";
      params.push(String(status).trim());
    }

    if (notag === "1" || notag === "true") {
      where += " AND (category IS NULL OR TRIM(category) = '')";
    } else if (category && String(category).trim()) {
      where += " AND category = ?";
      params.push(String(category).trim());
    }

    const qTrim = q != null ? String(q).trim() : "";
    if (qTrim.length >= 1) {
      where += " AND (title LIKE ? OR slug LIKE ?)";
      const like = `%${qTrim}%`;
      params.push(like, like);
    }

    const total = await pageRepository.countAdminPages(where, params);

    const rows = await pageRepository.selectAdminPageList(where, params, orderDir, limit, offset);

    const categories = await pageRepository.selectDistinctCategories();
    const statuses = await pageRepository.selectDistinctStatusesAll();

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      meta: {
        categories,
        statuses
      }
    });
  } catch (error) {
    console.error("❌ GET ALL PAGES:", error);
    return res.status(500).json({ success: false });
  }
};

const getTrashPages = async (req, res) => {
  try {
    let { page = 1, limit = 20, q } = req.query;
    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const qTrim = q != null ? String(q).trim() : "";

    const total = qTrim
      ? await pageRepository.countTrashPagesFiltered(qTrim)
      : await pageRepository.countTrashPages();
    const rows = qTrim
      ? await pageRepository.selectTrashPagesPaginatedFiltered(limit, offset, qTrim)
      : await pageRepository.selectTrashPagesPaginated(limit, offset);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("❌ TRASH ERROR:", error);
    return res.status(500).json({ success: false });
  }
};

const getAdminActivity = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const action = String(req.query.action || "");
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const result = await listActivity({ page, limit, action, from, to });
    return res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error("❌ ADMIN ACTIVITY:", error);
    return res.status(500).json({ success: false });
  }
};

const deletePage = async (req, res) => {
  try {
    const slug = req.params.slug;

    const result = await pageRepository.softDeleteBySlug(slug);

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    const filePath = path.join(process.cwd(), "generated", "jobs", `${slug}.html`);

    try {
      await fileService.unlink(filePath);
    } catch {
      // ignore
    }

    await invalidatePageCaches([slug]);
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "page_delete",
      target: slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE ERROR:", error);
    return res.status(500).json({ success: false });
  }
};

const restorePage = async (req, res) => {
  try {
    const slug = req.params.slug;

    const page = await pageRepository.findRowBySlug(slug);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    await pageRepository.restoreBySlug(slug);

    const filePath = path.join(process.cwd(), "generated", "jobs", `${slug}.html`);

    let finalHtml = await pipeline.buildJobHtml({
      title: page.title || "",
      text: page.raw_text || "",
      slug: page.slug,
      category: page.category || "",
      normalizedStatus: normalizeStatusForPipeline(page.status),
      postName: page.post_name != null ? String(page.post_name) : null,
      totalPosts: page.total_posts != null ? String(page.total_posts) : null
    });
    try {
      const relatedItems = await getRelatedPagesForSlug(page.slug, 6);
      finalHtml = embedRelatedJobsInJobHtml(finalHtml, page.slug, relatedItems);
    } catch {
      // non-blocking
    }
    await fileService.writeFile(filePath, finalHtml, "utf8");
    await pageRepository.updateRestoredPageContent(slug, finalHtml);

    await invalidatePageCaches([slug]);
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "page_restore",
      target: slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ RESTORE ERROR:", error);
    return res.status(500).json({ success: false });
  }
};

const permanentDelete = async (req, res) => {
  try {
    const slug = req.params.slug;

    const filePath = path.join(process.cwd(), "generated", "jobs", `${slug}.html`);

    try {
      await fileService.unlink(filePath);
    } catch {}

    const result = await pageRepository.hardDeleteBySlug(slug);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false });
    }

    await invalidatePageCaches([slug]);
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "page_permanent_delete",
      target: slug,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ PERMANENT DELETE ERROR:", error);
    return res.status(500).json({ success: false });
  }
};

async function countPdfsUploadedToday() {
  const dir = path.join(process.cwd(), "storage", "uploads", "pdf");
  const files = await fs.promises.readdir(dir).catch(() => []);
  if (!Array.isArray(files) || !files.length) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let count = 0;
  await Promise.all(
    files.map(async (name) => {
      try {
        const stat = await fs.promises.stat(path.join(dir, name));
        if (stat.mtime >= start) count += 1;
      } catch {
        /* ignore */
      }
    })
  );
  return count;
}

async function countImportsToday() {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS n FROM content_imports WHERE DATE(created_at) = CURDATE()`
    );
    return Number(rows && rows[0] && rows[0].n) || 0;
  } catch {
    return null;
  }
}

async function countActivityEventsToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await listActivity({ page: 1, limit: 1, from: start.toISOString() });
  return Number(result.pagination && result.pagination.total) || 0;
}

const getDashboardStats = async (req, res) => {
  try {
    const { agg, catRow, todayRow } = await pageRepository.selectDashboardAggregate();
    const counts = await siteCheckQueue.getJobCounts("waiting", "active", "completed", "failed").catch(() => ({}));
    const waitingJobs = Number(counts && counts.waiting ? counts.waiting : 0);
    const activeJobs = Number(counts && counts.active ? counts.active : 0);
    const completedJobs = Number(counts && counts.completed ? counts.completed : 0);
    const failedJobs = Number(counts && counts.failed ? counts.failed : 0);
    const totalProcessed = completedJobs + failedJobs;
    const successRate = totalProcessed > 0 ? Math.round((completedJobs / totalProcessed) * 100) : 0;
    const storageRoot = path.join(process.cwd(), "storage", "uploads");
    const [pdfFiles, imageFiles] = await Promise.all([
      fs.promises.readdir(path.join(storageRoot, "pdf")).catch(() => []),
      fs.promises.readdir(path.join(storageRoot, "images")).catch(() => [])
    ]);
    const totalUploads = (Array.isArray(pdfFiles) ? pdfFiles.length : 0) + (Array.isArray(imageFiles) ? imageFiles.length : 0);

    const [pdfsToday, importsToday, activityToday, sites] = await Promise.all([
      countPdfsUploadedToday(),
      countImportsToday(),
      countActivityEventsToday(),
      fetchSites().catch(() => [])
    ]);
    const brokenSites = Array.isArray(sites) ? sites.filter((s) => Number(s && s.broken) === 1).length : 0;
    const telegramOk = canSendTelegram();

    const stats = {
      totalPages: Number(agg.totalPages) || 0,
      smallPages: Number(agg.smallPages) || 0,
      trashPages: Number(agg.trashPages) || 0,
      totalViews: Number(agg.totalViews) || 0,
      totalCategories: Number(catRow.totalCategories) || 0,
      todayViews: Number(todayRow.todayViews) || 0,
      liveVisitors: 0,
      totalUploads,
      failedJobs,
      pendingJobs: waitingJobs + activeJobs,
      completedJobs,
      successRate,
      avgProcessingTimeMs: null,
      needsAttention: {
        failedJobs,
        manualActionItems: failedJobs + (waitingJobs > 0 ? 1 : 0)
      },
      todaySummary: {
        pdfUploads: pdfsToday,
        csvImports: importsToday,
        adminActions: activityToday,
        queueFailed: failedJobs,
        queuePending: waitingJobs + activeJobs,
        brokenSites,
        telegramConfigured: telegramOk,
        telegramStatus: telegramOk ? "ready" : "not_configured"
      }
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("❌ DASHBOARD ERROR:", error);
    return res.status(500).json({ success: false });
  }
};

function formatDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const getAdminPageBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const p = await pageRepository.findAdminPageBySlug(slug);
    if (!p) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
    return res.json({
      success: true,
      data: {
        id: p.id,
        title: p.title || "",
        slug: p.slug,
        url: `/${p.slug}`,
        status: p.status || "",
        badges: pageService.parseBadges(p.badges),
        category: p.category || "",
        qualification: p.qualification != null ? String(p.qualification) : "",
        state: p.state != null ? String(p.state) : "",
        department: p.department != null ? String(p.department) : "",
        post_name: p.post_name != null ? String(p.post_name) : "",
        total_posts: p.total_posts != null ? String(p.total_posts) : "",
        lastDate: pageService.normalizeLastDate(pageService.pickLastDateColumn(p)) ?? "",
        rawText: p.raw_text || "",
        breaking: !!p.breaking,
        breakingOrder: p.breaking_order != null && p.breaking_order !== 0 ? String(p.breaking_order) : "",
        eventTime: formatDatetimeLocal(p.event_time),
        position: p.position || "normal",
        smallBoxSlot: p.small_box_slot != null ? Number(p.small_box_slot) : null
      }
    });
  } catch (error) {
    console.error("❌ ADMIN GET PAGE:", error);
    return res.status(500).json({ success: false });
  }
};

const getSmallBoxSlots = async (req, res) => {
  try {
    const smallBoxService = require("../../services/smallBox.service");
    const rows = await smallBoxService.getSmallBoxSlotMap();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ADMIN SMALL BOX SLOTS:", error);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  getAllPages,
  deletePage,
  restorePage,
  permanentDelete,
  getTrashPages,
  getAdminActivity,
  getDashboardStats,
  getAdminPageBySlug,
  getSmallBoxSlots
};
