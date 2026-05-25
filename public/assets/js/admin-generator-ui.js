/**
 * Generator-only UI: sticky publish bar + draft status chip (preserves existing handlers).
 */
(function () {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;

  const bar = document.querySelector(".action-bar");
  if (!bar) return;

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
})();
