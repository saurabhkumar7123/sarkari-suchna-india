/**
 * Generator mobile / tablet UX: fullscreen editor, quick edit mode, PWA hints.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const isQuickMode = params.get("quick") === "1" || params.get("quick") === "true";
  const mobileMq = window.matchMedia("(max-width: 768px)");
  const tabletMq = window.matchMedia("(min-width: 769px) and (max-width: 1024px)");

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
      if (on) {
        textarea.focus();
      }
    }

    btn.addEventListener("click", () => {
      setFullscreen(!document.body.classList.contains("generator-editor-fullscreen"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("generator-editor-fullscreen")) {
        e.preventDefault();
        setFullscreen(false);
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

  document.addEventListener("DOMContentLoaded", () => {
    initQuickMode();
    initQuickModeLinkForMobile();
    initMobileAccordion();
    initFullscreenEditor();
    initTabletClass();
    initPwaHint();
  });
})();
