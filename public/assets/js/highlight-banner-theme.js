(function () {
  function themeClassFromText(tag, title) {
    const s = `${String(tag || "")} ${String(title || "")}`.toLowerCase();
    if (/\brailway\b/.test(s) || /\brrb\b/.test(s)) return "theme-railway";
    if (/\bssb\b/.test(s) || /\barmy\b/.test(s) || /\bdefence\b/.test(s) || /\bdefense\b/.test(s)) return "theme-defence";
    if (/\bpolice\b/.test(s)) return "theme-police";
    return "";
  }

  const root = document.querySelector(".highlight-banner-root");
  if (!root) return;

  const tagEl = root.querySelector(".highlight-banner-tag");
  const titleEl = root.querySelector(".highlight-banner-title-main");
  const cls = themeClassFromText(tagEl ? tagEl.textContent : "", titleEl ? titleEl.textContent : "");
  if (cls) root.classList.add(cls);
})();
