/**
 * Generator-only UI: sticky publish bar, section step nav,
 * collapsed search toggle, show Live Preview only after Preview action.
 * Presentation only — does not replace generator.js handlers.
 */
(function () {
  function showGeneratorPreview() {
    document.body.classList.add("generator-preview-visible");
    const panel = document.getElementById("gen-step-preview");
    if (panel) {
      panel.classList.remove("is-preview-collapsed");
      panel.setAttribute("aria-hidden", "false");
    }
  }

  function ensurePreviewClosedByDefault() {
    if (String(window.location.hash || "") === "#gen-step-preview") {
      showGeneratorPreview();
      return;
    }
    document.body.classList.remove("generator-preview-visible");
    const panel = document.getElementById("gen-step-preview");
    if (panel) {
      panel.classList.add("is-preview-collapsed");
      panel.setAttribute("aria-hidden", "true");
    }
  }

  ensurePreviewClosedByDefault();

  /* Reveal Live Preview after existing Preview actions (handlers unchanged). */
  ["previewBtn", "editorFsPreviewBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.previewRevealBound === "1") return;
    btn.dataset.previewRevealBound = "1";
    btn.addEventListener("click", showGeneratorPreview);
  });

  window.addEventListener("hashchange", () => {
    if (String(window.location.hash || "") === "#gen-step-preview") {
      showGeneratorPreview();
    }
  });

  /* Collapsed search icon ↔ open input. Active on /generator only (not #drafts). */
  function isDraftsHash() {
    return String(window.location.hash || "").toLowerCase() === "#drafts";
  }

  const searchPanel = document.getElementById("pageSearchPanel");
  const searchToggle = document.getElementById("pageSearchToggle");
  const searchBody = document.getElementById("pageSearchBody");
  const searchClose = document.getElementById("pageSearchClose");
  const pageSearch = document.getElementById("pageSearch");

  function isSearchOpen() {
    return Boolean(searchPanel && searchPanel.classList.contains("is-open"));
  }

  function setSearchOpen(open) {
    if (!searchPanel || !searchToggle || !searchBody) return;
    const next = Boolean(open);
    searchToggle.setAttribute("aria-expanded", next ? "true" : "false");
    searchBody.hidden = !next;
    searchPanel.classList.toggle("is-collapsed", !next);
    searchPanel.classList.toggle("is-open", next);
    if (next && pageSearch) {
      window.setTimeout(() => pageSearch.focus(), 0);
    }
  }

  function syncSearchForHash() {
    if (!searchPanel) return;
    const onDrafts = isDraftsHash();
    searchPanel.hidden = onDrafts;
    searchPanel.setAttribute("aria-hidden", onDrafts ? "true" : "false");
    if (onDrafts) setSearchOpen(false);
  }

  syncSearchForHash();
  window.addEventListener("hashchange", syncSearchForHash);

  if (searchPanel && searchToggle && searchBody && searchToggle.dataset.searchBound !== "1") {
    searchToggle.dataset.searchBound = "1";
    searchToggle.addEventListener("click", (ev) => {
      if (isDraftsHash()) return;
      ev.preventDefault();
      ev.stopPropagation();
      setSearchOpen(!isSearchOpen());
    });
  }

  if (searchClose && searchClose.dataset.searchCloseBound !== "1") {
    searchClose.dataset.searchCloseBound = "1";
    searchClose.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setSearchOpen(false);
      searchToggle?.focus();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (!isSearchOpen() || isDraftsHash()) return;
    setSearchOpen(false);
  });

  /* Compact step nav — always bind (not gated on AdminEnhancements). */
  const steps = Array.from(document.querySelectorAll(".generator-step"));

  function setActiveStep(id) {
    steps.forEach((step) => {
      step.classList.toggle("is-active", step.getAttribute("data-step") === id);
    });
  }

  if (steps.length && !document.documentElement.dataset.genStepsBound) {
    document.documentElement.dataset.genStepsBound = "1";
    steps.forEach((step) => {
      step.addEventListener("click", (e) => {
        const id = step.getAttribute("data-step");
        const target = id ? document.getElementById(id) : null;
        if (!target) return;
        e.preventDefault();
        if (id === "gen-step-preview") showGeneratorPreview();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveStep(id);
        try {
          history.replaceState(null, "", `#${id}`);
        } catch {
          /* ignore */
        }
      });
    });

    const sections = steps
      .map((step) => document.getElementById(step.getAttribute("data-step") || ""))
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible && visible.target.id) setActiveStep(visible.target.id);
        },
        { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
      );
      sections.forEach((section) => observer.observe(section));
    }
  }

  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const bar = document.querySelector(".action-bar");
  if (bar) {
    bar.classList.add("is-sticky-publish");
    document.body.classList.add("has-sticky-publish-bar");
    document.getElementById("stickyDraftStatus")?.remove();
  }
})();
