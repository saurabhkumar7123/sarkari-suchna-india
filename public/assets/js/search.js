/* =========================
   SEARCH OVERLAY + UNIVERSAL BINDING
   Listing / search-result pages omit overlay markup — inject once (same markup as home).
========================= */

var SEARCH_OVERLAY_MARKUP =
  '<div id="searchOverlay" class="search-overlay">' +
  '<div class="search-box">' +
  '<i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>' +
  '<input type="text" id="searchInput" placeholder="Search Jobs, Results, Admit Card..." autocomplete="off">' +
  '<button type="button" id="searchBtn">Search</button>' +
  "</div>" +
  '<div id="recentSearches" class="recent-searches"></div>' +
  '<div id="searchSuggestions" class="search-suggestions"></div>' +
  '<button type="button" class="close-search" aria-label="Close search">\u2716</button>' +
  "</div>";

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function safeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "#") return "#";
  const colonIdx = s.indexOf(":");
  if (colonIdx !== -1) {
    const proto = s.slice(0, colonIdx).toLowerCase();
    if (proto === "javascript" || proto === "data" || proto === "vbscript" || proto === "file") return "#";
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
      return u.href;
    } catch {
      return "#";
    }
  }
  if (s.startsWith("//")) return "#";
  if (s.startsWith("/")) return s;
  return "#";
}

function ensureSearchOverlayStyles() {
  if (document.querySelector('link[href*="search-overlay.css"]')) return;
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/components/search-overlay.css?v=4";
  document.head.appendChild(link);
}

function ensureSearchOverlayInDom() {
  if (document.getElementById("searchOverlay")) return;
  ensureSearchOverlayStyles();
  document.body.insertAdjacentHTML("beforeend", SEARCH_OVERLAY_MARKUP);
}

function bindSearchEventsOnce() {
  if (window.__searchHandlersBound) return;
  window.__searchHandlersBound = true;

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("#searchBtn");
    if (btn) {
      e.preventDefault();
      goToSearch();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const active = document.activeElement;
    if (active && active.id === "searchInput") {
      e.preventDefault();
      goToSearch();
    }
  });
}

function initSearchOverlay() {
  const overlay = document.getElementById("searchOverlay");
  if (!overlay) return;
  bindSearchEventsOnce();
}

function bootSearch() {
  ensureSearchOverlayInDom();
  initSearchOverlay();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSearch);
} else {
  bootSearch();
}

function goToSearch() {
  const el = document.getElementById("searchInput");
  if (!el) return;
  const query = el.value.trim();
  if (!query) return;

  saveRecentSearch(query);

  window.location.href = `/search?q=${encodeURIComponent(query)}`;
}

function highlightText(text, query) {
  const safe = String(text || "");
  const escaped = String(query || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return safe;
  const regex = new RegExp(`(${escaped})`, "gi");
  return safe.replace(regex, "<mark>$1</mark>");
}

function hasDomPurify() {
  return Boolean(window.DOMPurify && typeof window.DOMPurify.sanitize === "function");
}

function clearElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

function renderSuggestionFallbackText(container, items) {
  clearElement(container);
  items.forEach((item) => {
    var a = document.createElement("a");
    a.href = safeUrl(item && item.url ? String(item.url) : "#");
    a.textContent = item && item.title ? String(item.title) : "";
    container.appendChild(a);
  });
}

/* =========================
   SEARCH SUGGEST (debounced)
========================= */

let debounceTimer;

document.addEventListener("input", function (event) {
  const input = event.target && event.target.id === "searchInput" ? event.target : null;
  const suggestionBox = document.getElementById("searchSuggestions");
  if (!input || !suggestionBox) return;
    clearTimeout(debounceTimer);

    const query = input.value.trim();
    const recentBox = document.getElementById("recentSearches");

    if (query.length > 0 && recentBox) {
      recentBox.style.display = "none";
    }

    if (query.length < 2) {
      suggestionBox.innerHTML = "";
      if (query.length === 0) {
        showRecentSearches();
      }
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (!Array.isArray(data)) {
          suggestionBox.innerHTML = "";
          return;
        }
        if (hasDomPurify()) {
          const rawHtml = data
            .map((item) => {
              const u = safeUrl(item.url || "#");
              return `<a href="${escapeAttr(u)}">${highlightText(item.title, query)}</a>`;
            })
            .join("");
          suggestionBox.innerHTML = window.DOMPurify.sanitize(rawHtml);
        } else {
          // Fail closed for HTML rendering: plain text only if sanitizer is unavailable.
          renderSuggestionFallbackText(suggestionBox, data);
        }
      } catch (err) {
        console.error("Suggest error:", err);
        suggestionBox.innerHTML = "";
      }
    }, 300);
});

/* =========================
   CLOSE SUGGEST ON OUTSIDE CLICK
========================= */

document.addEventListener("click", function (e) {
  const sb = document.getElementById("searchSuggestions");
  if (!sb) return;
  if (!e.target.closest(".search-overlay")) {
    sb.innerHTML = "";
  }
});

function openSearch() {
  ensureSearchOverlayInDom();
  initSearchOverlay();
  const overlay = document.getElementById("searchOverlay");
  if (!overlay) {
    console.error("[search] #searchOverlay missing after ensureSearchOverlayInDom");
    return;
  }
  overlay.style.display = "flex";
  overlay.classList.add("active");

  const inp = document.getElementById("searchInput");
  if (inp) inp.focus();
  showRecentSearches();
}

function closeSearch() {
  const overlay = document.getElementById("searchOverlay");
  if (!overlay) return;
  overlay.classList.remove("active");
  overlay.style.display = "none";
}

window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.goToSearch = goToSearch;

/* =========================
   RECENT SEARCH SAVE
========================= */

function saveRecentSearch(query) {
  let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  searches = searches.filter((item) => item !== query);

  searches.unshift(query);

  if (searches.length > 5) {
    searches.pop();
  }

  localStorage.setItem("recentSearches", JSON.stringify(searches));
}

/* =========================
   SHOW RECENT SEARCHES
========================= */

function showRecentSearches() {
  const box = document.getElementById("recentSearches");
  if (!box) return;

  let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  if (searches.length === 0) {
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";

  const recentHtml = `
  <div class="recent-header">
    <div class="recent-title">Recent Searches</div>
    <button type="button" class="recent-clear">Clear</button>
  </div>

  ${searches
    .map((item) => {
      const esc = String(item).replace(/"/g, "&quot;");
      return `
    <div class="recent-item-wrap">
      <a class="recent-item" href="/search?q=${encodeURIComponent(item)}">
        ${String(item).replace(/</g, "&lt;")}
      </a>
      <button type="button" class="recent-delete" data-item="${esc}">✕</button>
    </div>
  `;
    })
    .join("")}
  `;
  if (hasDomPurify()) {
    box.innerHTML = window.DOMPurify.sanitize(recentHtml);
    return;
  }
  // Fail closed for HTML rendering: plain text list only if sanitizer is unavailable.
  clearElement(box);
  var fallbackWrap = document.createElement("div");
  fallbackWrap.className = "recent-header";
  var fallbackTitle = document.createElement("div");
  fallbackTitle.className = "recent-title";
  fallbackTitle.textContent = "Recent Searches";
  fallbackWrap.appendChild(fallbackTitle);
  box.appendChild(fallbackWrap);
  searches.forEach((item) => {
    var row = document.createElement("div");
    row.className = "recent-item-wrap";
    var link = document.createElement("a");
    link.className = "recent-item";
    link.href = "/search?q=" + encodeURIComponent(item);
    link.textContent = String(item);
    row.appendChild(link);
    box.appendChild(row);
  });
}

document.addEventListener("click", function (e) {
  const del = e.target.closest(".recent-delete");
  if (del) {
    const value = del.dataset.item;

    let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

    searches = searches.filter((item) => item !== value);

    localStorage.setItem("recentSearches", JSON.stringify(searches));

    showRecentSearches();
  }
});

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("recent-clear")) {
    localStorage.removeItem("recentSearches");

    showRecentSearches();
  }
});

document.addEventListener("click", function (e) {
  if (e.target.closest(".close-search")) {
    e.preventDefault();
    closeSearch();
  }
});
