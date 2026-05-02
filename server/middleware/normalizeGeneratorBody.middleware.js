function normalizeGeneratorBody(req, res, next) {
  console.log("NORMALIZE MIDDLEWARE RUNNING");
  console.warn("NORMALIZE MIDDLEWARE RUNNING");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return next();

  req.body.pageUrl = String(req.body.pageUrl || "").trim();
  req.body.slug = String(req.body.slug || req.body.pageUrl || "").trim();

  if (!req.body.slug || req.body.slug.trim() === "") {
    const base = req.body.title || "page";
    req.body.slug = String(base)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  req.body.slug = String(req.body.slug).replace(/^\/+|\/+$/g, "");
  if (!req.body.slug) req.body.slug = "page";
  req.body.pageUrl = req.body.slug;

  let status = String(req.body.status || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
  if (!status) status = "active";
  req.body.status = status;
  console.log("FINAL STATUS:", req.body.status);
  console.warn("FINAL STATUS:", req.body.status);

  const normalizedPosition = String(req.body.position || "")
    .toLowerCase()
    .trim();
  req.body.position = normalizedPosition || "normal";
  console.warn("FINAL POSITION [middleware]:", req.body.position);

  const bo = req.body.breakingOrder;
  req.body.breakingOrder = bo === "" || bo == null ? 0 : Number(bo);
  if (req.body.total_posts == null || req.body.total_posts === "") {
    req.body.total_posts = "";
  } else {
    req.body.total_posts = String(req.body.total_posts).trim();
  }
  console.warn("FINAL total_posts:", req.body.total_posts, typeof req.body.total_posts);

  if (!req.body.lastDate) {
    req.body.lastDate = null;
  } else {
    const d = new Date(req.body.lastDate);
    if (Number.isNaN(d.getTime())) {
      req.body.lastDate = null;
    } else {
      req.body.lastDate = d.toISOString();
    }
  }
  console.warn("FINAL lastDate:", req.body.lastDate);

  if (!req.body.eventTime) {
    req.body.eventTime = null;
  } else {
    const rawEventTime = String(req.body.eventTime).trim().replace(" ", "T");
    const eventMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(rawEventTime);
    req.body.eventTime = eventMatch ? `${eventMatch[1]}T${eventMatch[2]}` : null;
  }

  console.warn("TYPES:", {
    total_posts: typeof req.body.total_posts,
    lastDate: req.body.lastDate,
    eventTime: req.body.eventTime
  });

  ["qualification", "state", "department"].forEach((k) => {
    if (req.body[k] === "") req.body[k] = null;
  });

  if ((req.body.content == null || String(req.body.content).trim() === "") && req.body.text != null) {
    req.body.content = req.body.text;
  }

  console.log("FINAL BODY:", req.body);
  console.warn("FINAL BODY:", req.body);
  next();
}

module.exports = normalizeGeneratorBody;
