/* Legacy: pages used <link class="deferred-css" media="print"> + this script to set media="all".
 * Prefer normal screen stylesheets in HTML (see template.html). This remains for cached/old pages. */
(function () {
  function revealDeferredStylesheets() {
    document.querySelectorAll("link.deferred-css").forEach(function (link) {
      link.media = "all";
    });
  }
  function debugLog() {
    try {
      if (new URLSearchParams(window.location.search).get("debugcss") !== "1") return;
      document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
        console.log("[deferred-css][debugcss] CSS:", link.href, "media:", link.media || "(default)");
      });
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      revealDeferredStylesheets();
      debugLog();
    });
  } else {
    revealDeferredStylesheets();
    debugLog();
  }
  window.addEventListener("load", function () {
    revealDeferredStylesheets();
    setTimeout(revealDeferredStylesheets, 500);
  });
})();
