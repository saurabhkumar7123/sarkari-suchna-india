document.addEventListener("DOMContentLoaded", async function () {
  try {
    let slug = window.location.pathname.split("/").pop();
    slug = slug.replace(".html", "");

    const box = document.getElementById("related-posts");
    if (!box) return;

  const sourceSlug = slug;
  bindRelatedClickTracking(box, sourceSlug);

  if (box.getAttribute("data-related-embedded") === "1" || box.querySelector("[data-related-embedded]")) {
    return;
  }

  const res = await fetch(`/api/related/${encodeURIComponent(slug)}`);
  if (!res.ok) return;
  const payload = await res.json();
  const posts = Array.isArray(payload) ? payload : [];

  if (!posts.length) return;

  let html = `
<div class="related-section" data-related-from="${escapeAttr(sourceSlug)}">

<div class="related-header">
<h2>Related Jobs</h2>
</div>

<div class="related-grid">
`;

  posts.forEach((p) => {
    const postSlug = p && p.slug != null ? String(p.slug).trim() : "";
    const href =
      postSlug && postSlug !== "undefined" && postSlug !== "null"
        ? `/${encodeURIComponent(postSlug).replace(/%2F/g, "/")}`
        : "#";
    html += `
<div class="related-card">
<a href="${href}" data-related-to="${escapeAttr(postSlug)}">
${escapeHtml(p.title || "")}
</a>
</div>
`;
  });

  html += `
</div>
</div>
`;

  box.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  box.setAttribute("data-related-embedded", "1");
  bindRelatedClickTracking(box, sourceSlug);
  } catch (e) {
    console.error("Related posts error:", e);
  }
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function bindRelatedClickTracking(container, sourceSlug) {
  if (!container || !sourceSlug) return;
  container.querySelectorAll("a[data-related-to], .related-card a").forEach((link) => {
    if (link.dataset.relatedBound === "1") return;
    link.dataset.relatedBound = "1";
    link.addEventListener("click", () => {
      const to = link.getAttribute("data-related-to") || "";
      if (!to) return;
      const body = JSON.stringify({ from: sourceSlug, to });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/related-click", blob);
        return;
      }
      fetch("/api/related-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    });
  });
}
