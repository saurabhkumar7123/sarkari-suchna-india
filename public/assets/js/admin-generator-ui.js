/**
 * Generator-only UI: sticky publish bar, section step nav,
 * collapsed search toggle, show Live Preview only after Preview action.
 * Presentation only — does not replace generator.js handlers.
 */
(function () {
  function showGeneratorPreview() {
    document.body.classList.add("generator-preview-visible");
  }

  /* Reveal Live Preview after existing Preview actions (handlers unchanged). */
  ["previewBtn", "editorFsPreviewBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.previewRevealBound === "1") return;
    btn.dataset.previewRevealBound = "1";
    btn.addEventListener("click", showGeneratorPreview);
  });

  if (String(window.location.hash || "") === "#gen-step-preview") {
    showGeneratorPreview();
  }
  window.addEventListener("hashchange", () => {
    if (String(window.location.hash || "") === "#gen-step-preview") {
      showGeneratorPreview();
    }
  });

  /* Collapsed search → icon opens existing #pageSearch UI (logic unchanged).
     Only active on /generator (not #drafts). */
  function isDraftsHash() {
    return String(window.location.hash || "").toLowerCase() === "#drafts";
  }

  const searchPanel = document.getElementById("pageSearchPanel");
  const searchToggle = document.getElementById("pageSearchToggle");
  const searchBody = document.getElementById("pageSearchBody");
  const pageSearch = document.getElementById("pageSearch");

  function syncSearchForHash() {
    if (!searchPanel) return;
    const onDrafts = isDraftsHash();
    searchPanel.hidden = onDrafts;
    searchPanel.setAttribute("aria-hidden", onDrafts ? "true" : "false");
    if (onDrafts) {
      if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
      if (searchBody) searchBody.hidden = true;
      searchPanel.classList.add("is-collapsed");
      searchPanel.classList.remove("is-open");
    }
  }

  syncSearchForHash();
  window.addEventListener("hashchange", syncSearchForHash);

  if (searchPanel && searchToggle && searchBody && searchToggle.dataset.searchBound !== "1") {
    searchToggle.dataset.searchBound = "1";
    searchToggle.addEventListener("click", () => {
      if (isDraftsHash()) return;
      const open = searchToggle.getAttribute("aria-expanded") !== "true";
      searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
      searchBody.hidden = !open;
      searchPanel.classList.toggle("is-collapsed", !open);
      searchPanel.classList.toggle("is-open", open);
      if (open && pageSearch) {
        window.setTimeout(() => pageSearch.focus(), 0);
      }
    });
  }

  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const bar = document.querySelector(".action-bar");
  if (bar) {
    bar.classList.add("is-sticky-publish");
    document.body.classList.add("has-sticky-publish-bar");
    /* Remove legacy local-draft status chip if present — no replacement. */
    document.getElementById("stickyDraftStatus")?.remove();
  }

  const steps = Array.from(document.querySelectorAll(".generator-step"));
  if (!steps.length) return;

  function setActiveStep(id) {
    steps.forEach((step) => {
      step.classList.toggle("is-active", step.getAttribute("data-step") === id);
    });
  }

  steps.forEach((step) => {
    step.addEventListener("click", (e) => {
      const id = step.getAttribute("data-step");
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      if (id === "gen-step-preview") showGeneratorPreview();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveStep(id);
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
})();
