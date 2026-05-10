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

const EVENT_LIVE_PHASE_MS = 30 * 60 * 1000;

/** API may expose `eventTime` or `event_time`. */
function rowEventTime(n) {
  if (!n || typeof n !== "object") return null;
  const v = n.eventTime != null ? n.eventTime : n.event_time;
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Phase 4: Homepage badge resolver.
 * Prefers server-controlled `badges` array (from Phase 2 API). Falls back to
 * the legacy auto-derived getBadge() so rows without manual badges keep their
 * historical appearance during the rollout.
 *
 * Reuses existing CSS classes ("tag new", "tag out") — no styling changes.
 * Caps at 2 badges to match the validation/UI limit.
 */
const HOMEPAGE_BADGE_CSS = {
  NEW: "tag new",
  OUT: "tag out"
};
const HOMEPAGE_BADGE_MAX = 2;

function renderHomepageBadgesFromArray(badges) {
  if (!Array.isArray(badges) || badges.length === 0) return "";
  const seen = new Set();
  const html = [];
  for (const raw of badges) {
    if (html.length >= HOMEPAGE_BADGE_MAX) break;
    const code = String(raw || "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    const cssClass = HOMEPAGE_BADGE_CSS[code];
    if (!cssClass) continue;
    seen.add(code);
    html.push(`<span class="${cssClass}">${escapeHtml(code)}</span>`);
  }
  return html.join(" ");
}

function resolveHomepageBadgeHtml(item) {
  if (!item || typeof item !== "object") return "";
  const serverHtml = renderHomepageBadgesFromArray(item.badges);
  if (serverHtml) return serverHtml;
  return getBadge(item.status, rowEventTime(item), item.date);
}

/** List row badges only — ribbon "NEW" mini-badge is built separately in loadHomeCards. */
function getBadge(status, eventTime, date) {
  const normalizedStatus = String(status || "").toLowerCase().trim();
  const created = date ? new Date(date) : null;
  const hasValidDate = created && !isNaN(created.getTime());
  const now = new Date();

  if (hasValidDate) {
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return "";
  }

  if (eventTime) {
    const event = new Date(eventTime);
    if (!isNaN(event.getTime())) {
      const diff = event - now;
      if (diff > 0) return `<span class="tag coming">COMING SOON</span>`;
      const since = now - event;
      if (since >= 0 && since < EVENT_LIVE_PHASE_MS) {
        return `<span class="tag live">LIVE NOW</span>`;
      }
      if (since >= EVENT_LIVE_PHASE_MS && normalizedStatus === "result") {
        return `<span class="tag declared">DECLARED</span>`;
      }
    }
  }

  if (normalizedStatus === "new form" || normalizedStatus.includes("new form")) {
    return `<span class="tag new">NEW</span>`;
  }
  if (status === "new" || normalizedStatus === "new") return `<span class="tag new">NEW</span>`;
  if (
    normalizedStatus === "admit card" ||
    normalizedStatus.includes("admit card") ||
    status === "admit" ||
    normalizedStatus === "admit"
  ) {
    return `<span class="tag out">OUT</span>`;
  }
  if (normalizedStatus === "result") {
    return `<span class="tag declared">DECLARED</span>`;
  }
  if (
    normalizedStatus === "answer key" ||
    normalizedStatus.includes("answer key") ||
    status === "answer" ||
    normalizedStatus === "answer"
  ) {
    return `<span class="tag answer">KEY</span>`;
  }
  if (status === "syllabus" || normalizedStatus === "syllabus") {
    return `<span class="tag syllabus">SYLLABUS</span>`;
  }
  if (status === "admission" || normalizedStatus === "admission") {
    return `<span class="tag admission">OPEN</span>`;
  }
  if (status === "document" || normalizedStatus === "document") {
    return `<span class="tag document">DOC</span>`;
  }
  if (normalizedStatus.includes("new")) return `<span class="tag new">NEW</span>`;

  return "";
}

function escapeRibbonInnerText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** True when ribbon label is the "New Form" status (dropdown / sections API). */
function isNewFormRibbonStatus(status) {
  const t = String(status ?? "").trim().toLowerCase();
  return t === "new form" || t.startsWith("new form ");
}

/**
 * Ribbon title HTML. "New Form" → mini-badge "New" + title "FORM"; others unchanged (uppercase line).
 */
function buildRibbonTitleHtml(status) {
  if (isNewFormRibbonStatus(status)) {
    return `<span class="mini-badge">New</span><span class="title">${escapeRibbonInnerText("FORM")}</span>`;
  }
  const line = String(status ?? "").trim() || "SECTION";
  const t = line.toUpperCase();
  return `<span class="title">${escapeRibbonInnerText(t)}</span>`;
}

// ================= BREAKING NEWS =================
async function loadBreaking(){
  const box = document.getElementById("countdownBox");
  // Avoid stale browser cache for countdown source data.
  const data = await safeFetch("/api/breaking-news", { cache: "no-store" });
  if(!data){
    if (box) box.style.display = "none";
    clearCountdownInterval();
    return;
  }

  const container = document.getElementById("breakingNews");
  if (!container) return;

  if (!Array.isArray(data) || data.length === 0) {
    container.style.display = "none";
    if (box) box.style.display = "none";
    clearCountdownInterval();
    return;
  }

  const scrollDiv = document.createElement("div");
  scrollDiv.className = "breaking-scroll";

  scrollDiv.innerHTML = data.map((n) => {
    let badge = resolveHomepageBadgeHtml(n);
    const href = safeExternalUrl(n.url);
    const ext = href !== "#" ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeAttr(href)}"${ext}>${escapeHtml(n.title)} ${badge}</a>`;
  }).join("");

  container.innerHTML = "";
  container.appendChild(scrollDiv);

  startCountdown(data); // 🔥 existing logic preserved
}

// ================= COUNTDOWN =================
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

/**
 * Countdown strip: only when at least one row has a valid FUTURE event_time.
 * null / invalid / past → hide box and clear interval.
 */
function startCountdown(data) {
  const box = document.getElementById("countdownBox");
  const titleEl = document.getElementById("countdownTitle");
  const timer = document.getElementById("countdownTimer");

  clearCountdownInterval();

  if (!box || !titleEl || !timer) return;

  if (!Array.isArray(data) || data.length === 0) {
    box.style.display = "none";
    return;
  }

  const now = new Date();
  const upcoming = [];

  for (let i = 0; i < data.length && upcoming.length < 16; i++) {
    const n = data[i];
    const event_time = rowEventTime(n);
    if (!event_time) continue;
    const eventDate = new Date(event_time);
    if (isNaN(eventDate.getTime()) || eventDate <= now) continue;
    upcoming.push({ n, t: eventDate });
  }

  if (!upcoming.length) {
    box.style.display = "none";
    return;
  }

  upcoming.sort((a, b) => a.t - b.t);

  box.style.display = "flex";

  function update() {
    const nowTick = new Date();
    const pick = upcoming.find((x) => x.t > nowTick);
    if (!pick) {
      clearCountdownInterval();
      box.style.display = "none";
      return;
    }
    titleEl.textContent = (pick.n.title || "Result").slice(0, 72);
    const diff = pick.t - nowTick;
    timer.innerHTML = `<span class="cd-hms" aria-live="polite">${formatCountdownHMS(diff)}</span>`;
  }

  update();
  window.countdownInterval = setInterval(update, 1000);
}

// ================= SMALL BOX =================
async function loadTopCategories(){

  const data = await safeFetch("/api/small-boxes");
  if(!data) return;

  const container = document.getElementById("smallBoxes");
  if (!container) return;

  container.innerHTML = "";

  const colors = ["blue","green","purple","red"];

  data.slice(0, 4).forEach((item, i) => {
    const a = document.createElement("a");
    a.href = safePageHref(item);
    a.className = `cat ${colors[i % colors.length]}`;
    a.textContent = item.title;
    container.appendChild(a);
  });
}
// ================= PAGE GENERATE =================  
function getRibbonClass(status) {
  const s = String(status || "").toLowerCase().trim();

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
  "/new-form",
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

// ================= MAIN CARDS =================
async function loadHomeCards() {
  const container = document.getElementById("dynamicSections");
  if (!container) return;

  const sectionDefs = await getHomeSectionDefs();
  if (!sectionDefs.length) {
    container.innerHTML = "";
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

  const frag = document.createDocumentFragment();

  results.forEach(({ def, res }) => {
    if (!res || !Array.isArray(res.data) || res.data.length === 0) {
      console.log("[home] section empty — skip render:", def.section);
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
    const ribbonFormClass = isNewFormRibbonStatus(ribbonText) ? " form-ribbon" : "";

    let html = `<ul class="job-list">`;
    res.data.forEach((item) => {
      const badge = resolveHomepageBadgeHtml(item);
      const href = safePageHref(item);
      html += `<li><a href="${escapeAttr(href)}">${escapeHtml(item.title)}</a>${badge}</li>`;
    });
    html += `</ul>`;

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="ribbon ${ribbonClass}${ribbonFormClass}">
        ${buildRibbonTitleHtml(ribbonText)}
      </div>
      <div class="card-content">
        ${html}
        <div class="card-view-more">
          <a href="${escapeAttr(def.href)}" class="view-more">View More</a>
        </div>
      </div>
    `;
    frag.appendChild(div);
  });

  container.innerHTML = "";
  container.appendChild(frag);
}

// ================= TRENDING =================
async function loadTrendingJobs(){

  const res = await safeFetch("/api/top-views");
  if(!res) return;

  const list = Array.isArray(res.data) ? res.data : [];
  const container = document.getElementById("trendingJobs");
  if(!container) return;

  container.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach((item) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = safePageHref(item);
    a.textContent = item.title;
    li.appendChild(a);
    frag.appendChild(li);
  });
  container.appendChild(frag);
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

    loadBreaking();
    loadTopCategories();
    loadHomeCards();
    loadTrendingJobs();
  } catch (err) {
    console.error("index.js init:", err);
  }
});