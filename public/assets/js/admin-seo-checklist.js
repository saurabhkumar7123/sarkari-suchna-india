/**
 * Generator SEO checklist drawer — non-blocking, client-side validation.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;
  if (!document.getElementById("title")) return;

  const DRAFT_KEY = "generatorDraft_v1";
  let slugCheckTimer = null;
  let lastSlugWarn = "";

  function $(id) {
    return document.getElementById(id);
  }

  function getSlug() {
    const code = $("slugPreview");
    const text = code ? code.textContent : "";
    if (text && text !== "—") return String(text).trim();
    const title = $("title")?.value || "";
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getStatus() {
    const sel = $("status");
    const custom = $("customStatus");
    if (!sel) return "";
    if (sel.value === "__custom__" && custom) return String(custom.value || "").trim();
    return String(sel.value || "").trim();
  }

  function buildChecks() {
    const title = String($("title")?.value || "").trim();
    const slug = getSlug();
    const status = getStatus();
    const content = String($("data")?.value || "").trim();
    const checks = [];

    const titleLen = title.length;
    checks.push({
      id: "title",
      pass: titleLen >= 10 && titleLen <= 120,
      warn: titleLen > 0 && (titleLen < 10 || titleLen > 120),
      label: `Title length (${titleLen}/10–120)`
    });

    checks.push({
      id: "slug",
      pass: slug.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      warn: false,
      label: slug ? `Slug: ${slug}` : "Slug required"
    });

    checks.push({
      id: "status",
      pass: Boolean(status),
      warn: false,
      label: status ? `Section: ${status}` : "Select section (Latest Jobs / Result / …)"
    });

    checks.push({
      id: "content",
      pass: content.length >= 80,
      warn: content.length > 0 && content.length < 80,
      label: `Content length (${content.length} chars, min ~80)`
    });

    if (lastSlugWarn) {
      checks.push({
        id: "dup",
        pass: false,
        warn: true,
        label: lastSlugWarn
      });
    }

    return checks;
  }

  function renderDrawer(bodyEl) {
    const checks = buildChecks();
    bodyEl.innerHTML = checks
      .map((c) => {
        const cls = c.pass ? "is-pass" : c.warn ? "is-warn" : "is-fail";
        const icon = c.pass ? "✓" : c.warn ? "!" : "✕";
        return `<div class="seo-check-item ${cls}"><span class="seo-check-icon" aria-hidden="true">${icon}</span><span>${c.label}</span></div>`;
      })
      .join("");
  }

  async function checkDuplicateSlug(slug) {
    if (!slug || slug.length < 3) {
      lastSlugWarn = "";
      return;
    }
    const old = new URLSearchParams(window.location.search).get("slug");
    if (old && normalizeSlugKey(old) === normalizeSlugKey(slug)) {
      lastSlugWarn = "";
      return;
    }
    const res = await window.adminSafeFetch(
      `/api/admin/pages?q=${encodeURIComponent(slug)}&limit=5&page=1`
    );
    if (!res || !res.success || !Array.isArray(res.data)) return;
    const hit = res.data.find((p) => normalizeSlugKey(p.slug) === normalizeSlugKey(slug));
    lastSlugWarn = hit ? `Possible duplicate: "${hit.title || hit.slug}" exists` : "";
  }

  function normalizeSlugKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/^\/+|\.html$/gi, "")
      .replace(/\/+$/g, "");
  }

  function ensureUi() {
    const panelHead = document.querySelector(".editor-panel .panel-head");
    const headBar = document.getElementById("editorHeadBar");
    if (!panelHead || document.getElementById("seoChecklistToggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "seoChecklistToggle";
    btn.className = "seo-checklist-toggle";
    btn.textContent = "SEO Checklist";

    const actions = headBar?.querySelector(".panel-head__actions");
    if (headBar && actions) {
      headBar.insertBefore(btn, actions);
    } else if (panelHead) {
      panelHead.appendChild(btn);
    }
    if (typeof window.__applyGeneratorMobileLabels === "function") {
      window.__applyGeneratorMobileLabels();
    }

    const drawer = document.createElement("aside");
    drawer.id = "seoChecklistDrawer";
    drawer.className = "seo-checklist-drawer";
    drawer.setAttribute("aria-label", "SEO checklist");
    drawer.innerHTML = '<div id="seoChecklistBody"></div>';
    const editorPanel = document.querySelector(".editor-panel");
    if (editorPanel) editorPanel.appendChild(drawer);

    const bodyEl = drawer.querySelector("#seoChecklistBody");
    btn.addEventListener("click", () => {
      drawer.classList.toggle("is-open");
      renderDrawer(bodyEl);
    });

    const rerun = () => {
      if (drawer.classList.contains("is-open")) renderDrawer(bodyEl);
    };

    ["title", "data", "status", "customStatus"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", rerun);
      if (el) el.addEventListener("change", rerun);
    });

    const slugObs = $("slugPreview");
    if (slugObs) {
      const mo = new MutationObserver(() => {
        rerun();
        clearTimeout(slugCheckTimer);
        slugCheckTimer = setTimeout(() => checkDuplicateSlug(getSlug()).then(rerun), 400);
      });
      mo.observe(slugObs, { childList: true, characterData: true, subtree: true });
    }

    setInterval(rerun, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUi);
  } else {
    ensureUi();
  }
})();
