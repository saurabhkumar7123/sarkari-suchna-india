// ================= SAFE LINKS =================
function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Text nodes inside HTML strings (titles, etc.). */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Allow only http(s) URLs or same-origin relative paths starting with "/".
 * Blocks javascript:, data:, vbscript:, file:, and protocol-relative "//".
 */
function safeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "#") return "#";
  const colonIdx = s.indexOf(":");
  if (colonIdx !== -1) {
    const proto = s.slice(0, colonIdx).toLowerCase();
    if (proto === "javascript" || proto === "data" || proto === "vbscript" || proto === "file") return "#";
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
      return u.href;
    } catch {
      return "#";
    }
  }
  if (s.startsWith("//")) return "#";
  if (s.startsWith("/")) return s;
  return "#";
}

function isInvalidHrefToken(v) {
  if (v == null) return true;
  const t = String(v).trim();
  return t === "" || t === "undefined" || t === "null";
}

/** Internal listing / page card: prefer url, else slug path; fallback "#". */
function safePageHref(item) {
  if (!item || typeof item !== "object") {
    console.error("Invalid URL: missing item");
    return "#";
  }
  const rawUrl = item.url != null ? String(item.url).trim() : "";
  const rawSlug = item.slug != null ? String(item.slug).trim() : "";
  if (!isInvalidHrefToken(rawUrl) && rawUrl !== "#") return safeUrl(rawUrl);
  if (!isInvalidHrefToken(rawSlug)) {
    const path = rawSlug.replace(/^\/+/, "");
    return path ? safeUrl(`/${path}`) : "#";
  }
  console.error("Invalid URL: missing url and slug", item);
  return "#";
}

function safeExternalUrl(url) {
  if (isInvalidHrefToken(url)) {
    console.error("Invalid URL: breaking news / external link missing url", url);
    return "#";
  }
  return safeUrl(String(url).trim());
}

/**
 * Align breaking-news links with small boxes / cards: internal pages same tab,
 * external http(s) another origin → new tab. href must already be sanitized (safeUrl).
 */
function breakingNewsLinkTargetRel(href) {
  if (!href || href === "#") return "";
  const s = String(href).trim();
  if (s.startsWith("//")) return ' target="_blank" rel="noopener noreferrer"';
  if (s.startsWith("/")) return "";
  try {
    const u = new URL(s);
    if (u.origin === window.location.origin) return "";
    return ' target="_blank" rel="noopener noreferrer"';
  } catch {
    return "";
  }
}

// ================= SAFE FETCH =================
// Default cache lets browser + CDN respect Cache-Control from API (faster repeat visits).
async function safeFetch(url, opts = {}){
  try{
    const res = await fetch(url, { cache: opts.cache ?? "default", ...opts });
    if(!res.ok) throw new Error("API error");
    return await res.json();
  }catch(err){
    console.error("Fetch error:", url, err);
    return null;
  }
}

/** API may expose `eventTime` or `event_time`. */
function rowEventTime(n) {
  if (!n || typeof n !== "object") return null;
  const v = n.eventTime != null ? n.eventTime : n.event_time;
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Parse DB/API event time (MySQL datetime or datetime-local). */
function parseEventDate(value) {
  const s = rowEventTime({ eventTime: value });
  if (!s) return null;
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function hideCountdownBox(box) {
  if (!box) return;
  box.classList.add("is-hidden");
  box.style.removeProperty("display");
  box.setAttribute("aria-hidden", "true");
}

function showCountdownBox(box) {
  if (!box) return;
  box.classList.remove("is-hidden");
  box.style.display = "flex";
  box.setAttribute("aria-hidden", "false");
}

/**
 * Homepage badges — breaking rotator uses unified `.home-badge` (max 1); cards use group + en-dash.
 */
const ALLOWED_BADGE_CODES = ["NEW", "OUT", "START", "SOON"];
const BADGE_CODE_ALIASES = { DECLARED: "OUT" };

const HOMEPAGE_BREAKING_BADGE_CSS = {
  NEW: "home-badge home-badge--new",
  OUT: "home-badge home-badge--out",
  START: "home-badge home-badge--start",
  SOON: "home-badge home-badge--soon"
};

const HOMEPAGE_BREAKING_BADGE_MAX = 1;

const HOMEPAGE_CARD_BADGE_CSS = {
  NEW: "home-badge home-badge--new",
  OUT: "home-badge home-badge--out",
  START: "home-badge home-badge--start",
  SOON: "home-badge home-badge--soon"
};

const HOMEPAGE_BADGE_MAX = 2;

function normalizeBadgeCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return "";
  return BADGE_CODE_ALIASES[code] || code;
}

function renderBadgesFromArray(badges, cssMap, max = HOMEPAGE_BADGE_MAX) {
  if (!Array.isArray(badges) || badges.length === 0) return "";
  const seen = new Set();
  const html = [];
  for (const raw of badges) {
    if (html.length >= max) break;
    const code = normalizeBadgeCode(raw);
    if (!code || seen.has(code)) continue;
    const cssClass = cssMap[code];
    if (!cssClass) continue;
    seen.add(code);
    html.push(`<span class="${cssClass}">${escapeHtml(code)}</span>`);
  }
  return html.join(" ");
}

function renderHomepageBadgesFromArray(badges) {
  return renderBadgesFromArray(badges, HOMEPAGE_BREAKING_BADGE_CSS, HOMEPAGE_BREAKING_BADGE_MAX);
}

function resolveHomepageBadgeHtml(item) {
  if (!item || typeof item !== "object") return "";
  return renderHomepageBadgesFromArray(item.badges);
}

/** Card grid (#dynamicSections) — en-dash + home-badge pills; breaking news uses resolveHomepageBadgeHtml. */
function renderHomeCardBadgesFromArray(badges) {
  const badgeHtml = renderBadgesFromArray(badges, HOMEPAGE_CARD_BADGE_CSS);
  if (!badgeHtml) return "";
  return `<span class="home-card-badge-group"><span class="home-card-badge-sep" aria-hidden="true">–</span>${badgeHtml}</span>`;
}

function resolveHomeCardBadgeHtml(item) {
  if (!item || typeof item !== "object") return "";
  return renderHomeCardBadgesFromArray(item.badges);
}

function escapeRibbonInnerText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** True when ribbon label is the "Latest Jobs" section (dropdown / sections API). */
function isLatestJobRibbonStatus(status) {
  const t = String(status ?? "").trim().toLowerCase();
  return t === "latest job" || t.startsWith("latest job ")
    || t === "new form" || t.startsWith("new form ");
}

/** Ribbon label plural, e.g. RESULT → RESULTS, LATEST JOB → LATEST JOBS. */
function formatRibbonLabelText(status) {
  const line = String(status ?? "").trim() || "SECTION";
  const upper = line.toUpperCase();
  if (upper.endsWith("S")) return upper;
  return `${upper}S`;
}

/**
 * Ribbon title HTML. "Latest Job" → mini-badge "Latest" + title "JOBS"; others uppercase + s.
 */
function buildRibbonTitleHtml(status) {
  if (isLatestJobRibbonStatus(status)) {
    return `<span class="mini-badge">Latest</span><span class="title">${escapeRibbonInnerText("JOBS")}</span>`;
  }
  return `<span class="title">${escapeRibbonInnerText(formatRibbonLabelText(status))}</span>`;
}

// ================= HOME BOOTSTRAP =================
function readHomeBootstrap() {
  const el = document.getElementById("home-bootstrap");
  if (!el || !el.textContent) return null;
  try {
    const data = JSON.parse(el.textContent);
    return data && data.v === 1 ? data : null;
  } catch (err) {
    console.warn("home bootstrap parse failed", err);
    return null;
  }
}

function buildBreakingRotatorHtml(data, staticMode) {
  const items = Array.isArray(data) ? data : [];
  if (!items.length) return "";

  if (staticMode) {
    const list = items
      .slice(0, window.BreakingRotator?.STATIC_MAX ?? 3)
      .map((n) => {
        const badge = resolveHomepageBadgeHtml(n);
        const href = safeExternalUrl(n.url);
        const ext = breakingNewsLinkTargetRel(href);
        const title = escapeHtml(n.title);
        const badgeHtml = badge ? `<span class="breaking-rotator__badges">${badge}</span>` : "";
        return `<li><a href="${escapeAttr(href)}" class="breaking-rotator__chip"${ext} title="${title}"><span class="breaking-rotator__chip-inner">${badgeHtml}<span class="breaking-rotator__title">${title}</span></span></a></li>`;
      })
      .join("");
    return `<div class="breaking-rotator breaking-rotator--static" data-breaking-rotator data-count="${items.length}" aria-live="polite"><ul class="breaking-rotator__static-list">${list}</ul></div>`;
  }

  const chips = items
    .map((n) => {
      const badge = resolveHomepageBadgeHtml(n);
      const href = safeExternalUrl(n.url);
      const ext = breakingNewsLinkTargetRel(href);
      const title = escapeHtml(n.title);
      const badgeHtml = badge ? `<span class="breaking-rotator__badges">${badge}</span>` : "";
      return `<a href="${escapeAttr(href)}" class="breaking-rotator__chip"${ext} title="${title}"><span class="breaking-rotator__chip-inner">${badgeHtml}<span class="breaking-rotator__title">${title}</span></span></a>`;
    })
    .join("");

  const count = items.length;
  const dots = items
    .slice(0, 5)
    .map(
      (_, i) =>
        `<button type="button" class="breaking-rotator__dot${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-index="${i}" aria-label="Breaking update ${i + 1}"></button>`
    )
    .join("");
  const dotsMore =
    count > 5 ? `<span class="breaking-rotator__dots-more" hidden aria-hidden="true">+${count - 5}</span>` : "";
  const controlsClass = count <= 1 ? " breaking-rotator__controls--hidden" : "";

  return `<div class="breaking-rotator" data-breaking-rotator data-count="${count}" aria-live="polite"><div class="breaking-rotator__viewport"><div class="breaking-rotator__track">${chips}</div></div><div class="breaking-rotator__controls${controlsClass}"><button type="button" class="breaking-rotator__arrow breaking-rotator__arrow--prev" aria-label="Previous breaking update"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><div class="breaking-rotator__dots" role="tablist">${dots}${dotsMore}</div><button type="button" class="breaking-rotator__arrow breaking-rotator__arrow--next" aria-label="Next breaking update"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></div></div>`;
}

function mountBreakingRotator(container) {
  if (!container) return;
  const root = container.querySelector("[data-breaking-rotator]");
  if (root && window.BreakingRotator) {
    window.BreakingRotator.mount(root);
  }
}

function renderBreakingNewsIntoContainer(data) {
  const container = document.getElementById("breakingNews");
  if (!container) return;

  const staticMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  container.innerHTML = buildBreakingRotatorHtml(data, staticMode);
  mountBreakingRotator(container);
}

function initBreakingFromBootstrap(breakingNews, countdownEvents) {
  const box = document.getElementById("countdownBox");
  const container = document.getElementById("breakingNews");
  const news = Array.isArray(breakingNews) ? breakingNews : [];

  if (!news.length) {
    if (container) container.style.display = "none";
  } else {
    if (container) container.style.display = "";

    const root = container && container.querySelector("[data-breaking-rotator]");
    const wantsStatic = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || (wantsStatic && !root.classList.contains("breaking-rotator--static"))) {
      renderBreakingNewsIntoContainer(news);
    } else {
      mountBreakingRotator(container);
    }
  }

  startCountdown(countdownEvents);
}

// ================= BREAKING NEWS =================
async function loadBreaking(){
  const [breakingNews, countdownEvents] = await Promise.all([
    safeFetch("/api/breaking-news", { cache: "no-store" }),
    safeFetch("/api/countdown-events", { cache: "no-store" })
  ]);

  const container = document.getElementById("breakingNews");
  if (!container) {
    startCountdown(countdownEvents);
    return;
  }

  if (!Array.isArray(breakingNews) || breakingNews.length === 0) {
    container.style.display = "none";
  } else {
    container.style.display = "";
    renderBreakingNewsIntoContainer(breakingNews);
  }

  startCountdown(countdownEvents);
}

// ================= COUNTDOWN =================
const COUNTDOWN_MAX_EVENTS = 8;
const COUNTDOWN_LIVE_MS = 60 * 60 * 1000;

function padTime(n) {
  return String(Math.floor(Math.max(0, n))).padStart(2, "0");
}

function formatCountdownHMS(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${padTime(h)}:${padTime(m)}:${padTime(s)}`;
}

function clearCountdownInterval() {
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
    window.countdownInterval = null;
  }
}

function buildCountdownEvents(data, now = Date.now()) {
  if (!Array.isArray(data) || !data.length) return [];
  const events = [];

  for (const n of data) {
    const eventDate = parseEventDate(rowEventTime(n));
    if (!eventDate) continue;
    const t = eventDate.getTime();
    const liveEnds = t + COUNTDOWN_LIVE_MS;
    if (now > liveEnds) continue;
    events.push({
      n,
      t,
      liveEnds,
      phase: t > now ? "upcoming" : "live"
    });
  }

  events.sort((a, b) => a.t - b.t);
  return events.slice(0, COUNTDOWN_MAX_EVENTS);
}

function countdownItemHref(item) {
  if (!item || typeof item !== "object") return "";
  const rawUrl = item.url != null ? String(item.url).trim() : "";
  const rawSlug = item.slug != null ? String(item.slug).trim() : "";
  const href = rawUrl
    ? safePageHref({ url: rawUrl, slug: rawSlug })
    : rawSlug
      ? safePageHref({ slug: rawSlug })
      : "#";
  return href === "#" ? "" : href;
}

const LIVE_TIMER_INNER =
  '<span class="countdown-item__live-dot" aria-hidden="true"></span><span class="countdown-item__live-text">LIVE</span>';

function setLiveTimerEl(timerEl) {
  timerEl.classList.add("countdown-item__timer--live");
  timerEl.setAttribute("aria-label", "Live now");
  timerEl.innerHTML = LIVE_TIMER_INNER;
}

function countdownTimerMarkup(item) {
  if (item.phase === "live") {
    return `<span class="countdown-item__timer countdown-item__timer--live" aria-label="Live now">${LIVE_TIMER_INNER}</span>`;
  }
  return `<span class="countdown-item__timer" aria-label="Time remaining">${formatCountdownHMS(item.t - Date.now())}</span>`;
}

function renderCountdownListMarkup(events) {
  return events
    .map((item) => {
      const title = escapeHtml(String(item.n.title || "Result").slice(0, 88));
      const href = countdownItemHref(item.n);
      const rowInner = `<span class="countdown-item__title">${title}</span>${countdownTimerMarkup(item)}`;
      const attrs = `data-event-ms="${item.t}" data-live-ends="${item.liveEnds}" data-phase="${item.phase}"`;
      if (href) {
        return `<li class="countdown-item countdown-item--${item.phase}" ${attrs}><a class="countdown-item__link" href="${escapeAttr(href)}">${rowInner}</a></li>`;
      }
      return `<li class="countdown-item countdown-item--${item.phase}" ${attrs}><div class="countdown-item__row">${rowInner}</div></li>`;
    })
    .join("");
}

function syncCountdownListDom(list, events) {
  const signature = events
    .map((item) => `${item.phase}:${item.t}:${item.n.title || ""}`)
    .join("|");
  if (list.dataset.countdownSig === signature) return;
  list.dataset.countdownSig = signature;
  list.innerHTML = renderCountdownListMarkup(events);
}

function tickCountdownTimers(list, events, nowTick) {
  const active = events.filter((item) => nowTick <= item.liveEnds);
  active.forEach((item) => {
    item.phase = item.t > nowTick ? "upcoming" : "live";
  });
  syncCountdownListDom(list, active);

  list.querySelectorAll(".countdown-item").forEach((el) => {
    const ms = Number(el.getAttribute("data-event-ms"));
    const liveEnds = Number(el.getAttribute("data-live-ends"));
    const timerEl = el.querySelector(".countdown-item__timer");
    if (!timerEl || !Number.isFinite(ms) || !Number.isFinite(liveEnds)) return;

    if (nowTick > liveEnds) {
      el.remove();
      return;
    }

    const diff = ms - nowTick;
    if (diff <= 0) {
      el.classList.remove("countdown-item--upcoming");
      el.classList.add("countdown-item--live");
      el.setAttribute("data-phase", "live");
      setLiveTimerEl(timerEl);
      return;
    }

    el.classList.remove("countdown-item--live");
    el.classList.add("countdown-item--upcoming");
    el.setAttribute("data-phase", "upcoming");
    timerEl.classList.remove("countdown-item__timer--live");
    timerEl.setAttribute("aria-label", "Time remaining");
    timerEl.textContent = formatCountdownHMS(diff);
  });

  return active;
}

/**
 * Countdown panel — upcoming timers; after event_time shows LIVE for 1 hour (or until event_time cleared in admin).
 */
function startCountdown(data) {
  const box = document.getElementById("countdownBox");
  const list = document.getElementById("countdownList");

  clearCountdownInterval();

  if (!box || !list) return;

  const source = Array.isArray(data) ? data : [];

  function update() {
    const nowTick = Date.now();
    const events = tickCountdownTimers(list, buildCountdownEvents(source, nowTick), nowTick);
    if (!events.length) {
      clearCountdownInterval();
      hideCountdownBox(box);
      list.innerHTML = "";
      delete list.dataset.countdownSig;
      return;
    }
    showCountdownBox(box);
  }

  update();
  if (list.children.length) {
    window.countdownInterval = setInterval(update, 1000);
  }
}

// ================= SMALL BOX =================
async function loadTopCategories(){

  const data = await safeFetch("/api/small-boxes");
  if(!data) return;

  const container = document.getElementById("smallBoxes");
  if (!container) return;

  container.innerHTML = "";

  const colors = ["blue","green","orange","purple"];

  data.slice(0, 8).forEach((item, i) => {
    const slot = item && item.smallBoxSlot != null ? Number(item.smallBoxSlot) : null;
    const colorIdx = slot >= 1 && slot <= 8 ? (slot - 1) % 4 : i % colors.length;
    const a = document.createElement("a");
    a.href = safePageHref(item);
    a.className = `cat ${colors[colorIdx % colors.length]}`;
    if (slot >= 1 && slot <= 8) {
      a.setAttribute("data-small-box-slot", String(slot));
    }
    a.textContent = item.title;
    container.appendChild(a);
  });
}
// ================= PAGE GENERATE =================  
function getRibbonClass(status) {
  const s = String(status || "").toLowerCase().trim();

  if (s === "latest job" || s.startsWith("latest job ")) return "navy-ribbon";
  if (s === "new form" || s.startsWith("new form ")) return "navy-ribbon";
  if (s === "admission" || s.startsWith("admission ")) return "navy-ribbon";
  if (s.includes("admit card") || s === "admit") return "orange-ribbon";
  if (s.includes("answer key") || s === "answer") return "purple-ribbon";
  if (s.includes("result")) return "green-ribbon";
  if (s.includes("syllabus")) return "darkblue-ribbon";
  if (s.includes("document")) return "orange-ribbon";
  if (/\bnew\b/.test(s)) return "blue-ribbon";

  return "green-ribbon";
}

/** Listing routes use listing.js only (avoid wrong pathname / double load). */
function normalizePathname() {
  let p = window.location.pathname || "/";
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

const LISTING_ROUTES = new Set([
  "/latest-job",
  "/admission",
  "/result",
  "/admit-card",
  "/answer-key",
  "/syllabus",
  "/document"
]);

const HOME_SECTION_LIMIT = 25;

async function getHomeSectionDefs() {
  const defs = await safeFetch("/api/sections");
  if (!Array.isArray(defs) || defs.length === 0) return [];
  return defs;
}

const HOME_SECTION_DESKTOP_MQ = "(min-width: 769px)";

function currentHomeSectionPlatform() {
  return window.matchMedia(HOME_SECTION_DESKTOP_MQ).matches ? "desktop" : "mobile";
}

function sortHomeSectionResultsClient(sectionResults) {
  const orderKey = currentHomeSectionPlatform() === "mobile" ? "orderMobile" : "orderDesktop";
  return [...sectionResults].sort((a, b) => {
    const ao = Number(a?.def?.[orderKey]);
    const bo = Number(b?.def?.[orderKey]);
    const av = Number.isFinite(ao) && ao > 0 ? ao : 99;
    const bv = Number.isFinite(bo) && bo > 0 ? bo : 99;
    return av - bv;
  });
}

let cachedHomeSectionResults = null;
let cachedHomeSectionPlatform = null;

// ================= MAIN CARDS =================
function renderHomeSectionCards(sectionResults) {
  const container = document.getElementById("dynamicSections");
  if (!container) return;

  cachedHomeSectionResults = sectionResults;
  cachedHomeSectionPlatform = currentHomeSectionPlatform();

  const frag = document.createDocumentFragment();
  let rendered = 0;

  sortHomeSectionResultsClient(sectionResults).forEach(({ def, res }) => {
    if (!def || !res || !Array.isArray(res.data) || res.data.length === 0) {
      console.log("[home] section empty — skip render:", def && def.section);
      return;
    }
    console.log(
      "[home] section=%s items=%s pagination=%o",
      def.section,
      res.data.length,
      res.pagination || null
    );

    const ribbonText = def.ribbonStatus;
    const ribbonClass = getRibbonClass(ribbonText);
    const ribbonFormClass = isLatestJobRibbonStatus(ribbonText) ? " form-ribbon" : "";

    let html = `<ul class="job-list">`;
    res.data.forEach((item) => {
      const badge = resolveHomeCardBadgeHtml(item);
      const href = safePageHref(item);
      html += `<li><a href="${escapeAttr(href)}">${escapeHtml(item.title)}${badge || ""}</a></li>`;
    });
    html += `</ul>`;

    const div = document.createElement("div");
    div.className = "card";
    if (def.section) {
      div.dataset.homeSection = def.section;
    }
    const orderDesktop = Number(def.orderDesktop) > 0 ? Number(def.orderDesktop) : 99;
    const orderMobile = Number(def.orderMobile) > 0 ? Number(def.orderMobile) : 99;
    div.style.setProperty("--home-order-desktop", String(orderDesktop));
    div.style.setProperty("--home-order-mobile", String(orderMobile));
    div.innerHTML = `
      <div class="ribbon ${ribbonClass}${ribbonFormClass}">
        ${buildRibbonTitleHtml(ribbonText)}
      </div>
      <div class="card-content">
        ${html}
        ${window.HomeViewMore ? window.HomeViewMore.buildHomeViewMoreLinkHtml(def, res, escapeHtml, escapeAttr) : `<div class="card-view-more"><a href="${escapeAttr(def.href)}" class="view-more view-more--green">View all</a></div>`}
      </div>
    `;
    frag.appendChild(div);
    rendered += 1;
  });

  container.innerHTML = "";
  if (rendered > 0) {
    container.appendChild(frag);
  }
}

function initHomeCardsFromBootstrap(boot) {
  if (!boot || !Array.isArray(boot.sectionPages) || !boot.sectionPages.length) {
    return false;
  }
  const results = boot.sectionPages.map((entry) => ({
    def: entry.def,
    res: entry.payload || null
  }));
  renderHomeSectionCards(results);
  return true;
}

async function loadHomeCards() {
  const sectionDefs = await getHomeSectionDefs();
  if (!sectionDefs.length) {
    const container = document.getElementById("dynamicSections");
    if (container) container.innerHTML = "";
    return;
  }

  const results = await Promise.all(
    sectionDefs.map(async (def) => {
      const mode = def.queryMode === "status" ? "status" : "section";
      const queryValue = mode === "status" ? def.queryValue : def.section;
      const url = `/api/pages?${mode}=${encodeURIComponent(queryValue)}&limit=${HOME_SECTION_LIMIT}&page=1`;
      const res = await safeFetch(url);
      return { def, res };
    })
  );

  renderHomeSectionCards(results);
}

// ================= TRENDING =================
function setTrendingSectionVisible(visible) {
  const section =
    document.getElementById("trendingSection") ||
    document.querySelector(".trending-section");
  if (!section) return;
  section.classList.toggle("is-hidden", !visible);
  section.setAttribute("aria-hidden", visible ? "false" : "true");
}

function ensureTrendingViewMore(section) {
  if (!section || section.querySelector(".trending-view-more")) return;
  const wrap = document.createElement("div");
  wrap.className = "trending-view-more";
  const link = document.createElement("a");
  link.href = "/search";
  link.className = "view-more view-more--green";
  link.textContent = "View all trending jobs";
  wrap.appendChild(link);
  section.appendChild(wrap);
}

function renderTrendingJobsList(list) {
  const container = document.getElementById("trendingJobs");
  if (!container) return;

  const items = Array.isArray(list) ? list : [];
  setTrendingSectionVisible(items.length > 0);
  container.innerHTML = "";
  if (!items.length) return;

  const section =
    document.getElementById("trendingSection") ||
    container.closest(".trending-section");
  const frag = document.createDocumentFragment();

  items.forEach((item) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = safePageHref(item);
    a.textContent = item.title || "";
    const badge = resolveHomeCardBadgeHtml(item);
    if (badge) a.insertAdjacentHTML("beforeend", badge);
    li.appendChild(a);
    frag.appendChild(li);
  });

  container.appendChild(frag);
  ensureTrendingViewMore(section);
}

function initTrendingFromBootstrap(boot) {
  const container = document.getElementById("trendingJobs");
  if (!container) return false;

  if (container.children.length > 0) {
    setTrendingSectionVisible(true);
    const section =
      document.getElementById("trendingSection") ||
      container.closest(".trending-section");
    ensureTrendingViewMore(section);
    return true;
  }

  const trending = boot && boot.trending;
  if (!trending || !Array.isArray(trending.data) || !trending.data.length) {
    setTrendingSectionVisible(false);
    return false;
  }

  renderTrendingJobsList(trending.data);
  return true;
}

async function loadTrendingJobs() {
  const res = await safeFetch("/api/top-views");
  if (!res) {
    setTrendingSectionVisible(false);
    return;
  }

  const list = Array.isArray(res.data) ? res.data : [];
  renderTrendingJobsList(list);
}

// ================= SECTION =================
function showSection(sectionId){
  document.querySelectorAll(".home-section").forEach(sec=>{
    sec.style.display="none";
  });

  const section = document.getElementById(sectionId);
  if(section) section.style.display="block";
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  try {
    const path = normalizePathname();
    if (LISTING_ROUTES.has(path)) {
      return;
    }

    const boot = readHomeBootstrap();
    if (boot) {
      initBreakingFromBootstrap(boot.breakingNews, boot.countdownEvents);
      initTrendingFromBootstrap(boot);
      if (!initHomeCardsFromBootstrap(boot)) {
        loadHomeCards();
      }
    } else {
      loadBreaking();
      loadTopCategories();
      loadHomeCards();
      loadTrendingJobs();
    }

    if (window.matchMedia) {
      const mq = window.matchMedia(HOME_SECTION_DESKTOP_MQ);
      const onPlatformChange = () => {
        if (!cachedHomeSectionResults) return;
        const next = currentHomeSectionPlatform();
        if (next === cachedHomeSectionPlatform) return;
        cachedHomeSectionPlatform = next;
        renderHomeSectionCards(cachedHomeSectionResults);
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onPlatformChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onPlatformChange);
      }
    }
  } catch (err) {
    console.error("index.js init:", err);
  }
});