/**
 * Generator mobile / tablet UX: fullscreen editor, quick edit mode, PWA hints.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const isQuickMode = params.get("quick") === "1" || params.get("quick") === "true";
  const mobileMq = window.matchMedia("(max-width: 768px)");
  const tabletMq = window.matchMedia("(min-width: 769px) and (max-width: 1024px)");
  let mobilePreviewKeepFullscreen = false;

  function buildFullGeneratorHref() {
    const slug = params.get("slug");
    if (!slug) return "/generator";
    return `/generator?slug=${encodeURIComponent(slug)}`;
  }

  function initQuickMode() {
    if (!isQuickMode) return;

    document.body.classList.add("generator-quick-mode");
    document.documentElement.classList.remove("is-quick-boot");

    const badge = document.getElementById("generatorModeBadge");
    if (badge) {
      badge.textContent = "Quick edit mode";
      badge.classList.add("is-quick");
    }

    const banner = document.getElementById("generatorQuickBanner");
    if (banner) banner.classList.remove("is-hidden");

    const fullLink = document.getElementById("generatorFullModeLink");
    if (fullLink) fullLink.href = buildFullGeneratorHref();

    const accordion = document.getElementById("gen-step-advanced");
    if (accordion) accordion.setAttribute("open", "");

    document.title = "Quick Edit | Page Generator";
  }

  function initQuickModeLinkForMobile() {
    if (isQuickMode) return;
    if (!mobileMq.matches) return;

    const host = document.querySelector(".page-subtitle");
    if (!host || document.getElementById("generatorQuickModeLink")) return;

    const link = document.createElement("a");
    link.id = "generatorQuickModeLink";
    link.className = "generator-quick-mode-link";
    link.href = buildQuickEditHref();
    link.textContent = "Switch to quick edit (mobile)";
    host.insertAdjacentElement("afterend", link);
  }

  function buildQuickEditHref() {
    const slug = params.get("slug");
    if (!slug) return "/generator?quick=1";
    return `/generator?quick=1&slug=${encodeURIComponent(slug)}`;
  }

  function initMobileAccordion() {
    if (isQuickMode) return;
    const accordion = document.getElementById("gen-step-advanced");
    if (!accordion || !mobileMq.matches) return;
    accordion.removeAttribute("open");
  }

  function mountExpandTopbar(on) {
    const topbar = document.getElementById("editorExpandTopbar");
    const headBar = document.getElementById("editorHeadBar");
    if (!topbar || !headBar) return;

    const fsToolbar = document.getElementById("editorFullscreenToolbar");
    const seoBtn = document.getElementById("seoChecklistToggle");
    const actions =
      headBar.querySelector(".panel-head__actions") ||
      topbar.querySelector(".panel-head__actions");

    if (on) {
      topbar.hidden = false;
      if (fsToolbar) {
        fsToolbar.hidden = false;
        topbar.appendChild(fsToolbar);
      }
      if (seoBtn) topbar.appendChild(seoBtn);
      if (actions) topbar.appendChild(actions);
      if (typeof window.__applyGeneratorMobileLabels === "function") {
        window.__applyGeneratorMobileLabels();
      }
      return;
    }

    topbar.hidden = true;
    if (fsToolbar) {
      fsToolbar.hidden = true;
      headBar.insertBefore(fsToolbar, headBar.firstChild);
    }
    if (actions) {
      headBar.appendChild(actions);
    }
    if (seoBtn) {
      const actionsInHead = headBar.querySelector(".panel-head__actions");
      if (actionsInHead) {
        headBar.insertBefore(seoBtn, actionsInHead);
      } else {
        headBar.appendChild(seoBtn);
      }
    }
  }

  function initFullscreenEditor() {
    if (isQuickMode) return;

    const btn = document.getElementById("editorFullscreenBtn");
    const panel = document.getElementById("editorPanel");
    const textarea = document.getElementById("data");
    if (!btn || !panel || !textarea) return;

    const labelEl = btn.querySelector(".editor-fullscreen-btn__label");

    function setFullscreen(on) {
      document.body.classList.toggle("generator-editor-fullscreen", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (labelEl) labelEl.textContent = on ? "Collapse" : "Expand";
      mountExpandTopbar(on);
      if (on) {
        closeMobilePreview();
        textarea.focus();
      }
    }

    const fsPreviewBtn = document.getElementById("editorFsPreviewBtn");
    const fsSaveBtn = document.getElementById("editorFsSaveBtn");
    const fsCloseBtn = document.getElementById("editorFsCloseBtn");

    fsPreviewBtn?.addEventListener("click", () => {
      openMobilePreview({ keepFullscreen: true });
    });
    fsSaveBtn?.addEventListener("click", () => {
      document.getElementById("savePageBtn")?.click();
    });
    fsCloseBtn?.addEventListener("click", () => {
      setFullscreen(false);
    });

    btn.addEventListener("click", () => {
      setFullscreen(!document.body.classList.contains("generator-editor-fullscreen"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (document.body.classList.contains("generator-mobile-preview-open")) {
        e.preventDefault();
        closeMobilePreview();
        return;
      }
      if (document.body.classList.contains("generator-editor-fullscreen")) {
        e.preventDefault();
        setFullscreen(false);
      }
    });
  }

  function openMobilePreview(options = {}) {
    if (!mobileMq.matches) {
      document.getElementById("previewBtn")?.click();
      return;
    }
    mobilePreviewKeepFullscreen = options.keepFullscreen === true;
    if (mobilePreviewKeepFullscreen) {
      document.body.classList.add("generator-mobile-preview-from-fs");
    }
    const closeBtn = document.getElementById("mobilePreviewCloseBtn");
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.textContent = mobilePreviewKeepFullscreen ? "Back to editor" : "Close";
    }
    document.getElementById("previewBtn")?.click();
  }

  function closeMobilePreview() {
    document.body.classList.remove("generator-mobile-preview-open");
    document.body.classList.remove("generator-mobile-preview-from-fs");
    mobilePreviewKeepFullscreen = false;
    const closeBtn = document.getElementById("mobilePreviewCloseBtn");
    if (closeBtn) {
      closeBtn.hidden = true;
      closeBtn.textContent = "Close";
    }
    const textarea = document.getElementById("data");
    if (
      document.body.classList.contains("generator-editor-fullscreen") &&
      textarea
    ) {
      textarea.focus();
    }
  }

  function exitFullscreenEditorUi() {
    document.body.classList.remove("generator-editor-fullscreen");
    mountExpandTopbar(false);
    const fsBtn = document.getElementById("editorFullscreenBtn");
    const labelEl = fsBtn?.querySelector(".editor-fullscreen-btn__label");
    if (fsBtn) fsBtn.setAttribute("aria-pressed", "false");
    if (labelEl) labelEl.textContent = "Expand";
  }

  function initMobilePreview() {
    const previewBtn = document.getElementById("previewBtn");
    const closeBtn = document.getElementById("mobilePreviewCloseBtn");
    if (!previewBtn) return;

    closeBtn?.addEventListener("click", closeMobilePreview);

    previewBtn.addEventListener("click", () => {
      if (!mobileMq.matches) return;
      if (!mobilePreviewKeepFullscreen) {
        exitFullscreenEditorUi();
      }
      document.body.classList.add("generator-mobile-preview-open");
      if (closeBtn) {
        closeBtn.hidden = false;
        closeBtn.textContent = mobilePreviewKeepFullscreen ? "Back to editor" : "Close";
      }
    });
  }

  function initTabletClass() {
    function apply() {
      document.body.classList.toggle("generator-tablet-layout", tabletMq.matches && !isQuickMode);
    }
    apply();
    if (typeof tabletMq.addEventListener === "function") {
      tabletMq.addEventListener("change", apply);
    } else if (typeof tabletMq.addListener === "function") {
      tabletMq.addListener(apply);
    }
  }

  function initPwaHint() {
    if (!mobileMq.matches && !tabletMq.matches) return;

    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallHint();
    });

    function showInstallHint() {
      if (document.getElementById("generatorPwaHint")) return;
      const hint = document.createElement("div");
      hint.id = "generatorPwaHint";
      hint.className = "generator-pwa-hint";
      hint.innerHTML = `
        <span>Add generator to home screen for quick access</span>
        <button type="button" class="generator-pwa-hint__btn" id="generatorPwaInstallBtn">Install</button>
        <button type="button" class="generator-pwa-hint__dismiss" id="generatorPwaDismissBtn" aria-label="Dismiss">×</button>
      `;
      const container = document.querySelector(".main-container");
      if (!container) return;
      container.insertBefore(hint, container.firstChild);

      document.getElementById("generatorPwaDismissBtn")?.addEventListener("click", () => {
        hint.remove();
        try {
          sessionStorage.setItem("generatorPwaHintDismissed", "1");
        } catch {
          /* ignore */
        }
      });

      document.getElementById("generatorPwaInstallBtn")?.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        hint.remove();
      });
    }

    try {
      if (sessionStorage.getItem("generatorPwaHintDismissed") === "1") return;
    } catch {
      /* ignore */
    }

    if (window.matchMedia("(display-mode: standalone)").matches) return;
  }

  function initMobileSectionEditorLabels() {
    const visual = document.getElementById("editorModeVisual");
    const raw = document.getElementById("editorModeRaw");
    const addBtn = document.getElementById("sectionEditorAddBtn");
    const seoBtn = document.getElementById("seoChecklistToggle");
    const defaults = {
      visual: "Section builder",
      raw: "Raw text",
      add: "+ Add Section",
      seo: "SEO Checklist"
    };
    const short = { visual: "Builder", raw: "Raw", add: "+ Add", seo: "SEO" };

    function apply() {
      const mobile = mobileMq.matches;
      if (visual) visual.textContent = mobile ? short.visual : defaults.visual;
      if (raw) raw.textContent = mobile ? short.raw : defaults.raw;
      if (addBtn) addBtn.textContent = mobile ? short.add : defaults.add;
      if (seoBtn) seoBtn.textContent = mobile ? short.seo : defaults.seo;
    }

    apply();
    window.__applyGeneratorMobileLabels = apply;
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", apply);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(apply);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initQuickMode();
    initQuickModeLinkForMobile();
    initMobileAccordion();
    initFullscreenEditor();
    initMobilePreview();
    initTabletClass();
    initPwaHint();
    initMobileSectionEditorLabels();
  });
})();
