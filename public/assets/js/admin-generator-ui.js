/**
 * Generator-only UI: sticky publish bar, draft status chip, section step nav.
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const bar = document.querySelector(".action-bar");
  if (bar) {
    bar.classList.add("is-sticky-publish");
    document.body.classList.add("has-sticky-publish-bar");

    let statusEl = document.getElementById("stickyDraftStatus");
    if (!statusEl) {
      const group = bar.querySelector(".action-group-secondary") || bar;
      statusEl = document.createElement("span");
      statusEl.id = "stickyDraftStatus";
      statusEl.className = "sticky-draft-status";
      statusEl.setAttribute("aria-live", "polite");
      group.insertBefore(statusEl, group.firstChild);
    }

    function updateDraftStatus() {
      try {
        const pending = Number(localStorage.getItem("generatorPendingDrafts") || "0") > 0;
        const raw = localStorage.getItem("generatorDraft_v1");
        if (pending && raw) {
          statusEl.textContent = "Draft saved locally";
        } else if (pending) {
          statusEl.textContent = "Unsaved draft";
        } else {
          statusEl.textContent = "";
        }
      } catch {
        statusEl.textContent = "";
      }
    }

    updateDraftStatus();
    const t = window.setInterval(updateDraftStatus, 5000);
    window.addEventListener("pagehide", () => clearInterval(t));
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
