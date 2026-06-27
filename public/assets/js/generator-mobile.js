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
      mountMobileFsButtonGroups(true);
      return;
    }

    mountMobileFsButtonGroups(false);
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

  /* ---- Mobile fullscreen: collapsible button groups (save screen space) ---- */
  const fsGroupRestore = new Map();
  const fsGroupChrome = {
    built: false,
    chrome: null,
    nav: null,
    panels: {},
    openGroup: null,
    observer: null,
    clickBound: false
  };

  function fsStashMove(node, target) {
    if (!node || !target) return;
    if (!fsGroupRestore.has(node)) {
      fsGroupRestore.set(node, { parent: node.parentNode, next: node.nextSibling });
    }
    target.appendChild(node);
  }

  function fsRestoreMovedNodes() {
    fsGroupRestore.forEach(({ parent, next }, node) => {
      if (!parent) return;
      if (next && next.parentNode === parent) parent.insertBefore(node, next);
      else parent.appendChild(node);
    });
    fsGroupRestore.clear();
  }

  function closeFsTopGroups() {
    fsGroupChrome.openGroup = null;
    document.body.classList.remove(
      "generator-fs-group-open",
      "generator-fs-group-page-open",
      "generator-fs-group-editor-open"
    );
    Object.values(fsGroupChrome.panels).forEach((panel) => {
      if (panel) panel.hidden = true;
    });
    fsGroupChrome.nav
      ?.querySelectorAll(".editor-fs-group-toggle")
      .forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  }

  function toggleFsTopGroup(name) {
    const panel = fsGroupChrome.panels[name];
    if (!panel) return;
    const willOpen = fsGroupChrome.openGroup !== name;
    closeFsTopGroups();
    if (!willOpen) return;
    fsGroupChrome.openGroup = name;
    panel.hidden = false;
    document.body.classList.add("generator-fs-group-open", `generator-fs-group-${name}-open`);
    fsGroupChrome.nav
      ?.querySelector(`[data-fs-group="${name}"]`)
      ?.setAttribute("aria-expanded", "true");
  }

  function buildFsTopGroupChrome(topbar) {
    if (fsGroupChrome.built) return;

    const chrome = document.createElement("div");
    chrome.className = "editor-fs-mobile-chrome";
    chrome.id = "editorFsMobileChrome";

    const nav = document.createElement("div");
    nav.className = "editor-fs-mobile-nav";

    ["page", "editor"].forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "editor-fs-group-toggle";
      btn.dataset.fsGroup = name;
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = name === "page" ? "Page" : "Editor";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFsTopGroup(name);
      });
      nav.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "editor-fs-group-panel";
      panel.dataset.fsGroup = name;
      panel.hidden = true;
      chrome.appendChild(panel);
      fsGroupChrome.panels[name] = panel;
    });

    const spacer = document.createElement("span");
    spacer.className = "editor-fs-mobile-nav__spacer";
    spacer.setAttribute("aria-hidden", "true");
    nav.appendChild(spacer);

    chrome.insertBefore(nav, chrome.firstChild);
    topbar.insertBefore(chrome, topbar.firstChild);

    fsStashMove(document.getElementById("editorFsPreviewBtn"), fsGroupChrome.panels.page);
    fsStashMove(document.getElementById("editorFsSaveBtn"), fsGroupChrome.panels.page);
    fsStashMove(document.getElementById("seoChecklistToggle"), fsGroupChrome.panels.page);

    const secToolbar = document.querySelector(".section-editor-toolbar");
    if (secToolbar) {
      secToolbar.classList.add("is-fs-toolbar-host");
      fsStashMove(secToolbar.querySelector(".section-editor-mode"), fsGroupChrome.panels.editor);
      fsStashMove(
        secToolbar.querySelector(".section-editor-toolbar__actions"),
        fsGroupChrome.panels.editor
      );
    }

    const doneBtn = document.getElementById("editorFsCloseBtn");
    const collapseBtn = document.getElementById("editorFullscreenBtn");
    if (doneBtn) fsStashMove(doneBtn, nav);
    if (collapseBtn) fsStashMove(collapseBtn, nav);

    const fsToolbar = document.getElementById("editorFullscreenToolbar");
    if (fsToolbar && !fsToolbar.children.length) fsToolbar.hidden = true;

    const headActions = topbar.querySelector(".panel-head__actions");
    if (headActions && !headActions.children.length) headActions.hidden = true;

    fsGroupChrome.chrome = chrome;
    fsGroupChrome.nav = nav;
    fsGroupChrome.built = true;
  }

  function teardownFsTopGroupChrome() {
    closeFsTopGroups();
    fsRestoreMovedNodes();

    const headActions = document.querySelector(
      "#editorExpandTopbar .panel-head__actions, #editorHeadBar .panel-head__actions"
    );
    if (headActions) headActions.hidden = false;

    const fsToolbar = document.getElementById("editorFullscreenToolbar");
    if (fsToolbar) fsToolbar.hidden = false;

    document.querySelector(".section-editor-toolbar")?.classList.remove("is-fs-toolbar-host");

    fsGroupChrome.chrome?.remove();
    fsGroupChrome.chrome = null;
    fsGroupChrome.nav = null;
    fsGroupChrome.panels = {};
    fsGroupChrome.built = false;
  }

  function wrapInlineButtonGroup(container, toggleLabel) {
    if (!container || container.dataset.fsInlineGrouped === "1") return;
    const kids = [...container.children];
    if (!kids.length) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sec-inline-group-toggle";
    toggle.textContent = toggleLabel;
    toggle.setAttribute("aria-expanded", "false");

    const body = document.createElement("div");
    body.className = "sec-inline-group__body";
    body.hidden = true;
    kids.forEach((child) => body.appendChild(child));

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      container.classList.toggle("is-inline-group-open", open);
    });

    container.insertBefore(toggle, container.firstChild);
    container.appendChild(body);
    container.dataset.fsInlineGrouped = "1";
  }

  function unwrapInlineButtonGroup(container) {
    if (!container || container.dataset.fsInlineGrouped !== "1") return;
    const body = container.querySelector(".sec-inline-group__body");
    const toggle = container.querySelector(".sec-inline-group-toggle");
    if (body) {
      [...body.children].forEach((child) => container.appendChild(child));
      body.remove();
    }
    toggle?.remove();
    delete container.dataset.fsInlineGrouped;
    container.classList.remove("is-inline-group-open");
  }

  function decorateRichToolbar(field) {
    if (!field || field.dataset.fsRichGrouped === "1") return;
    const toolbar = field.querySelector(".sec-rich-toolbar");
    if (!toolbar) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sec-rich-group-toggle";
    toggle.textContent = "Format";
    toggle.setAttribute("aria-expanded", "false");

    const controls = document.createElement("div");
    controls.className = "sec-rich-toolbar__controls";
    while (toolbar.firstChild) controls.appendChild(toolbar.firstChild);

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !field.classList.contains("is-format-open");
      field.classList.toggle("is-format-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    toolbar.appendChild(toggle);
    toolbar.appendChild(controls);
    field.dataset.fsRichGrouped = "1";
  }

  function undecorateRichToolbar(field) {
    if (!field || field.dataset.fsRichGrouped !== "1") return;
    const toolbar = field.querySelector(".sec-rich-toolbar");
    const controls = toolbar?.querySelector(".sec-rich-toolbar__controls");
    const toggle = toolbar?.querySelector(".sec-rich-group-toggle");
    if (controls) {
      while (controls.firstChild) toolbar.insertBefore(controls.firstChild, controls);
      controls.remove();
    }
    toggle?.remove();
    field.classList.remove("is-format-open");
    delete field.dataset.fsRichGrouped;
  }

  function decorateCardTools(card) {
    const tools = card?.querySelector(".sec-card__tools");
    const head = card?.querySelector(".sec-card__head");
    if (!tools || !head || tools.dataset.fsToolsGrouped === "1") return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sec-card__tools-toggle";
    toggle.textContent = "⋮";
    toggle.setAttribute("aria-label", "Section actions");
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !card.classList.contains("is-tools-open");
      card.classList.toggle("is-tools-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    head.insertBefore(toggle, tools);
    tools.dataset.fsToolsGrouped = "1";
  }

  function undecorateCardTools(card) {
    const tools = card?.querySelector(".sec-card__tools");
    const toggle = card?.querySelector(".sec-card__tools-toggle");
    toggle?.remove();
    card?.classList.remove("is-tools-open");
    if (tools) delete tools.dataset.fsToolsGrouped;
  }

  function syncSectionButtonGroups() {
    if (!document.body.classList.contains("generator-fs-mobile-groups")) return;

    document.querySelectorAll(".sec-rich-field").forEach(decorateRichToolbar);
    document.querySelectorAll(".sec-card").forEach(decorateCardTools);
    document
      .querySelectorAll(".sec-dates-add-actions, .sec-table-block-actions")
      .forEach((el) => wrapInlineButtonGroup(el, "Add"));
    document
      .querySelectorAll(".sec-table-block__tools")
      .forEach((el) => wrapInlineButtonGroup(el, "Block"));
    document
      .querySelectorAll(".sec-row-actions")
      .forEach((el) => wrapInlineButtonGroup(el, "Row"));
  }

  function clearSectionButtonGroups() {
    document.querySelectorAll(".sec-rich-field").forEach(undecorateRichToolbar);
    document.querySelectorAll(".sec-card").forEach(undecorateCardTools);
    document
      .querySelectorAll(
        ".sec-dates-add-actions, .sec-table-block-actions, .sec-table-block__tools, .sec-row-actions"
      )
      .forEach(unwrapInlineButtonGroup);
  }

  function mountMobileFsButtonGroups(on) {
    if (!on || !mobileMq.matches) {
      document.body.classList.remove("generator-fs-mobile-groups");
      clearSectionButtonGroups();
      teardownFsTopGroupChrome();
      if (fsGroupChrome.observer) {
        fsGroupChrome.observer.disconnect();
        fsGroupChrome.observer = null;
      }
      return;
    }

    const topbar = document.getElementById("editorExpandTopbar");
    if (!topbar) return;

    buildFsTopGroupChrome(topbar);
    document.body.classList.add("generator-fs-mobile-groups");
    syncSectionButtonGroups();

    const root = document.getElementById("sectionEditorRoot");
    if (root && !fsGroupChrome.observer) {
      fsGroupChrome.observer = new MutationObserver(() => syncSectionButtonGroups());
      fsGroupChrome.observer.observe(root, { childList: true, subtree: true });
    }

    if (!fsGroupChrome.clickBound) {
      fsGroupChrome.clickBound = true;
      document.addEventListener("click", (e) => {
        if (!document.body.classList.contains("generator-fs-group-open")) return;
        if (e.target.closest(".editor-fs-mobile-chrome")) return;
        closeFsTopGroups();
      });
    }
  }

  function bindMobileFsGroupMq() {
    const handler = () => {
      if (!document.body.classList.contains("generator-editor-fullscreen")) return;
      mountMobileFsButtonGroups(mobileMq.matches);
    };
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", handler);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(handler);
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
      if (document.body.classList.contains("generator-fs-group-open")) {
        e.preventDefault();
        closeFsTopGroups();
        return;
      }
      if (document.body.classList.contains("generator-editor-fullscreen")) {
        e.preventDefault();
        setFullscreen(false);
      }
    });
  }

  function openMobilePreview(options = {}) {
    const inFullscreen = document.body.classList.contains("generator-editor-fullscreen");
    mobilePreviewKeepFullscreen = options.keepFullscreen === true;

    closeFsTopGroups();

    if (mobilePreviewKeepFullscreen && inFullscreen) {
      document.body.classList.add("generator-mobile-preview-from-fs");
    }

    document.getElementById("previewBtn")?.click();

    if (!mobileMq.matches && !inFullscreen) {
      document.getElementById("gen-step-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      const inFullscreen = document.body.classList.contains("generator-editor-fullscreen");
      const useOverlay =
        mobileMq.matches || (inFullscreen && mobilePreviewKeepFullscreen);
      if (!useOverlay) return;

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
    bindMobileFsGroupMq();
  });
})();
