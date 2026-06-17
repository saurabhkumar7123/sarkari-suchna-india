function setFooterYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
}

function initAboutCollapsible(root) {
  if (!root) return;

  const toggle = root.querySelector("#aboutToggle");
  const panel = root.querySelector("#aboutCollapsible");
  if (!toggle || !panel) return;

  const slot = root.closest(".about-site-slot--collapsible");
  if (!slot) {
    panel.hidden = false;
    toggle.hidden = true;
    return;
  }

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    panel.hidden = !next;
    toggle.textContent = next
      ? "Show less"
      : "Read more about Sarkari Suchna India";
  });
}

function mountAboutSiteContent(html) {
  const slot = document.getElementById("about-site");
  if (!slot) return;
  slot.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  initAboutCollapsible(slot);
}

document.addEventListener("DOMContentLoaded", function () {
  const slot = document.getElementById("about-site");
  if (!slot) return;

  if (slot.innerHTML.trim()) {
    initAboutCollapsible(slot);
    return;
  }

  fetch("/static/about-site.html", { cache: "no-store" })
    .then((response) => response.text())
    .then((data) => mountAboutSiteContent(data))
    .catch((error) => console.error("About Section Load Error:", error));
});
