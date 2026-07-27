/**
 * FPO-1 — Shared admin workspace UI helpers.
 *
 * Used by Generator Workspace (PI-1) and Editorial Workspace Pro (PI-2).
 * Presentation helpers only — no fetch, no publish, no draft mutation.
 */
(function (root) {
  "use strict";

  if (root.AdminWorkspaceUI) return;

  const MESSAGES = Object.freeze({
    EMPTY: "Nothing to show yet.",
    EMPTY_OK: "No issues found. Looking good.",
    LOADING: "Loading…",
    TIMEOUT: "This is taking longer than expected. Try again in a moment.",
    AI_UNAVAILABLE: "AI review signals are unavailable right now. You can still review manually.",
    VALIDATION_UNAVAILABLE: "Validation is unavailable until content is structured.",
    NO_DRAFT: "Open a recruitment with a linked draft to load review signals.",
    NO_SECTIONS: "No sections detected yet.",
    NO_SUGGESTIONS: "No suggestions right now.",
    NO_ISSUES: "None"
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Map high|medium|low → CSS modifier class used by Editorial pills/metrics. */
  function bandClass(band) {
    if (band === "high") return "is-high";
    if (band === "medium") return "is-medium";
    return "is-low";
  }

  /** Map high|medium|low → Generator badge modifier (gw-badge--*). */
  function badgeModifier(band) {
    if (band === "high" || band === "medium" || band === "low") return band;
    return "low";
  }

  function storageGet(key, fallback) {
    try {
      const v = root.localStorage.getItem(key);
      if (v == null) return fallback;
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false") return false;
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      if (typeof value === "boolean") root.localStorage.setItem(key, value ? "1" : "0");
      else root.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — ignore */
    }
  }

  /**
   * Build a friendly empty/loading/unavailable row.
   * @param {"empty"|"ok"|"loading"|"unavailable"|"timeout"} kind
   * @param {string} [message]
   * @param {{ className?: string }} [opts]
   */
  function stateHtml(kind, message, opts) {
    const className = (opts && opts.className) || "ws-state";
    const mod =
      kind === "ok"
        ? "ws-state--ok"
        : kind === "loading"
          ? "ws-state--loading"
          : kind === "unavailable"
            ? "ws-state--unavailable"
            : kind === "timeout"
              ? "ws-state--timeout"
              : "";
    const text =
      message ||
      (kind === "ok"
        ? MESSAGES.EMPTY_OK
        : kind === "loading"
          ? MESSAGES.LOADING
          : kind === "unavailable"
            ? MESSAGES.AI_UNAVAILABLE
            : kind === "timeout"
              ? MESSAGES.TIMEOUT
              : MESSAGES.EMPTY);
    return `<p class="${escapeHtml(className)}${mod ? ` ${mod}` : ""}" role="status">${escapeHtml(text)}</p>`;
  }

  /** Compact empty row used inside issue/link lists (preserves .ew-empty-row). */
  function emptyRow(message, className) {
    return `<li class="${escapeHtml(className || "ew-empty-row")}">${escapeHtml(message || MESSAGES.NO_ISSUES)}</li>`;
  }

  root.AdminWorkspaceUI = {
    MESSAGES,
    escapeHtml,
    bandClass,
    badgeModifier,
    storageGet,
    storageSet,
    stateHtml,
    emptyRow,
    version: "fpo1.1"
  };

  /* Also expose escapeHtml on AdminUI when present (single source of truth). */
  if (root.AdminUI && typeof root.AdminUI.escapeHtml !== "function") {
    root.AdminUI.escapeHtml = escapeHtml;
  }
})(typeof window !== "undefined" ? window : globalThis);
