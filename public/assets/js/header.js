/* Optional: ?debugcss=1 logs every stylesheet href + media (mobile debugging). */
(function debugStylesheetLinks() {
  function run() {
    try {
      if (new URLSearchParams(window.location.search).get("debugcss") !== "1") return;
      document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
        console.log("[debugcss] CSS:", link.href, "media:", link.media || "(default)");
      });
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

/* Page type: home vs section listing (card grid differs in index.css) */
(function initPageTypeClass() {
  if (!document.body) return;
  const raw = location.pathname.replace(/\/+$/, "") || "/";
  const isHome =
    raw === "/" ||
    /^\/index(\.html)?$/i.test(raw) ||
    /^\/static\/index(\.html)?$/i.test(raw);
  if (isHome) {
    document.body.classList.add("page-home");
    document.body.classList.remove("page-section");
  } else {
    document.body.classList.add("page-section");
    document.body.classList.remove("page-home");
  }
})();

/** Job page: Title → Post meta (date/author/tag) */
function ensureVacancyHeaderBlockOrder() {
  const title = document.querySelector(".job-title-section");
  if (!title) return;
  const meta = document.querySelector(".meta-info-section");
  if (meta) {
    title.insertAdjacentElement("afterend", meta);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureVacancyHeaderBlockOrder();
  markCurrentNavItems();
  initHeaderScrollState();
  initToolsButtonA11y();
  initUpdatedIndicator();
  syncMobileNavOffset();
  window.addEventListener("resize", syncMobileNavOffset, { passive: true });
  window.addEventListener("hashchange", markCurrentNavItems, { passive: true });
  ensureSearchScriptLoaded();
});

function initUpdatedIndicator() {
  const indicators = document.querySelectorAll("[data-updated-indicator]");
  if (!indicators.length) return;

  const mobileMq = window.matchMedia("(max-width: 768px)");

  indicators.forEach((el) => {
    el.addEventListener("click", (e) => {
      if (!mobileMq.matches) return;
      e.preventDefault();
      e.stopPropagation();

      indicators.forEach((other) => {
        if (other !== el) other.classList.remove("is-tooltip-visible");
      });

      const show = !el.classList.contains("is-tooltip-visible");
      el.classList.toggle("is-tooltip-visible", show);

      clearTimeout(el._updatedTooltipTimer);
      if (show) {
        el._updatedTooltipTimer = setTimeout(() => {
          el.classList.remove("is-tooltip-visible");
        }, 2600);
      }
    });

    el.addEventListener("keydown", (e) => {
      if (!mobileMq.matches) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      el.click();
    });
  });

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("[data-updated-indicator]")) return;
      indicators.forEach((el) => {
        el.classList.remove("is-tooltip-visible");
        clearTimeout(el._updatedTooltipTimer);
      });
    },
    true
  );
}

function initToolsButtonA11y() {
  document.querySelectorAll(".tools-btn").forEach((btn) => {
    if (!btn.hasAttribute("aria-expanded")) {
      btn.setAttribute("aria-expanded", "false");
    }
    if (!btn.hasAttribute("aria-haspopup")) {
      btn.setAttribute("aria-haspopup", "true");
    }
  });
}

function initHeaderScrollState() {
  const header = document.querySelector(".main-header");
  if (!header) return;

  let ticking = false;
  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          update();
          if (document.body.classList.contains("mobile-nav-open")) {
            syncMobileNavOffset();
          }
        });
        ticking = true;
      }
    },
    { passive: true }
  );
  update();
}

function syncMobileNavOffset() {
  const bar = document.querySelector(".mobile-nav");
  if (!bar) return;
  const offset = Math.ceil(bar.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty("--mobile-nav-offset", `${offset}px`);
}

function normalizePathnameForNav(pathname) {
  return String(pathname || "/")
    .replace(/\/+$/, "")
    .toLowerCase() || "/";
}

function markCurrentMobileNavItem() {
  markCurrentNavItems();
}

function markCurrentNavItems() {
  const current = normalizePathnameForNav(window.location.pathname);
  const currentHash = String(window.location.hash || "").toLowerCase();
  const onFinderHash = current === "/" && currentHash === "#openfinder";
  const links = document.querySelectorAll(".navbar .nav-item[href], #navbar .nav-item[href]");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") {
      link.classList.remove("active");
      return;
    }
    const hashIdx = href.indexOf("#");
    const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    const hashPart = hashIdx >= 0 ? href.slice(hashIdx).toLowerCase() : "";
    const normalized = normalizePathnameForNav(pathPart || "/");

    if (hashPart === "#openfinder") {
      link.classList.toggle("active", onFinderHash);
      return;
    }

    if (onFinderHash && normalized === "/") {
      link.classList.remove("active");
      return;
    }

    if (normalized === current) link.classList.add("active");
    else link.classList.remove("active");
  });
}

function ensureSearchScriptLoaded() {
  const hasSearchScript = Array.from(document.scripts).some((s) => {
    const src = s.getAttribute("src") || "";
    return /\/js\/search\.js(?:$|\?)/.test(src);
  });
  if (hasSearchScript || typeof window.openSearch === "function") return;

  const script = document.createElement("script");
  script.src = "/js/search.js";
  script.defer = true;
  document.head.appendChild(script);
}

/* ---------- Mobile nav ---------- */
function setMobileNavOpen(open) {
  const menu = document.getElementById("navbar");
  const menuOverlay = document.querySelector(".menu-overlay");
  const icon = document.querySelector(".hamburger i");

  if (!menu) return;

  if (open) {
    closeToolsMenu();
    syncMobileNavOffset();
  }

  menu.classList.toggle("active", open);
  if (menuOverlay) {
    menuOverlay.classList.toggle("active", open);
    menuOverlay.setAttribute("aria-hidden", open ? "false" : "true");
  }

  menu.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("mobile-nav-open", open);

  if (icon) {
    if (open) {
      icon.classList.remove("fa-bars");
      icon.classList.add("fa-xmark");
    } else {
      icon.classList.remove("fa-xmark");
      icon.classList.add("fa-bars");
    }
  }
}

function toggleMenu(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  const menu = document.getElementById("navbar");
  if (!menu) return;
  const next = !menu.classList.contains("active");
  setMobileNavOpen(next);
}

function closeMobileNav() {
  setMobileNavOpen(false);
  closeMobileLegalMenu();
}

function closeMobileLegalMenu() {
  const wrap = document.querySelector("#navbar .mobile-legal");
  const toggle = document.querySelector("#navbar .mobile-legal-toggle");
  if (wrap) wrap.classList.remove("active");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function toggleMobileLegal(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  const wrap = document.querySelector("#navbar .mobile-legal");
  const toggle = document.querySelector("#navbar .mobile-legal-toggle");
  if (!wrap || !toggle) return;
  const next = !wrap.classList.contains("active");
  wrap.classList.toggle("active", next);
  toggle.setAttribute("aria-expanded", next ? "true" : "false");
}

/* Outside click: mobile menu */
document.addEventListener(
  "click",
  function (e) {
    const navbar = document.getElementById("navbar");
    const hamburger = document.querySelector(".hamburger");
    const menuOverlay = document.querySelector(".menu-overlay");

    if (!navbar || !navbar.classList.contains("active")) return;

    const onHamburger = hamburger && hamburger.contains(e.target);
    const onMenu = navbar.contains(e.target);
    const onDimmer = menuOverlay && menuOverlay.contains(e.target);

    if (onDimmer) {
      closeMobileNav();
      return;
    }

    if (!onMenu && !onHamburger) {
      closeMobileNav();
    }
  },
  false
);

/* Nav link click → close mobile menu */
document.addEventListener("click", function (e) {
  if (e.target.closest("#navbar .mobile-legal-toggle")) return;
  const legalLink = e.target.closest("#navbar .mobile-legal-link");
  if (legalLink) {
    closeMobileNav();
    return;
  }
  const link = e.target.closest("#navbar .nav-item");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!isSafeHref(href)) {
    console.error("Invalid URL on nav link:", href);
    e.preventDefault();
    return;
  }

  closeMobileNav();
});

/* ---------- Tools menu ---------- */
let toolsMenuOpenedAt = 0;

function getToolsElements() {
  return {
    menu: document.getElementById("toolsMenu"),
    overlay: document.getElementById("toolsOverlay"),
  };
}

function getVisibleToolsButton() {
  return (
    Array.from(document.querySelectorAll(".tools-btn")).find((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    }) || null
  );
}

function isToolsButtonHit(event) {
  if (!event) return false;
  if (event.target && event.target.closest && event.target.closest(".tools-btn")) return true;

  const btn = getVisibleToolsButton();
  if (!btn || typeof event.clientX !== "number" || typeof event.clientY !== "number") return false;

  const rect = btn.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function positionToolsMenu(menu) {
  const btn = getVisibleToolsButton();
  if (!btn || !menu) return;

  const btnRect = btn.getBoundingClientRect();
  const header = menu.closest(".main-header");
  if (!header) return;

  const headerRect = header.getBoundingClientRect();
  menu.style.position = "absolute";
  menu.style.top = `${Math.round(btnRect.bottom - headerRect.top + 6)}px`;
  menu.style.right = `${Math.round(headerRect.right - btnRect.right)}px`;
  menu.style.left = "auto";
}

function resetToolsMenuPosition(menu) {
  if (!menu) return;
  menu.style.removeProperty("top");
  menu.style.removeProperty("right");
  menu.style.removeProperty("left");
  menu.style.removeProperty("position");
}

function setToolsMenuOpen(open) {
  const { menu, overlay } = getToolsElements();
  if (!menu || !overlay) return;

  if (open) {
    closeMobileNav();
    positionToolsMenu(menu);
    toolsMenuOpenedAt = performance.now();
  } else {
    resetToolsMenuPosition(menu);
  }

  menu.classList.toggle("active", open);
  overlay.classList.toggle("active", open);
  document.body.classList.toggle("tools-menu-open", open);

  document.querySelectorAll(".tools-btn").forEach((btn) => {
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function closeToolsMenu() {
  setToolsMenuOpen(false);
}

function toggleTools(event) {
  if (event) {
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof event.preventDefault === "function") event.preventDefault();
  }

  const { menu, overlay } = getToolsElements();
  if (!menu || !overlay) {
    console.error("Tools menu elements not found (header may still be loading).");
    return;
  }

  const next = !menu.classList.contains("active");
  setToolsMenuOpen(next);
}

function syncToolsMenuPosition() {
  const { menu } = getToolsElements();
  if (menu && menu.classList.contains("active")) {
    positionToolsMenu(menu);
  }
}

window.addEventListener("resize", syncToolsMenuPosition, { passive: true });

/* Tools overlay click → close */
document.addEventListener("click", function (e) {
  const t = e.target;
  if (t && t.id === "toolsOverlay") {
    e.preventDefault();
    closeToolsMenu();
  }
});

/* Outside click → close tools */
document.addEventListener("click", function (e) {
  const { menu, overlay } = getToolsElements();
  if (!menu || !overlay || !menu.classList.contains("active")) return;

  if (performance.now() - toolsMenuOpenedAt < 80) return;

  const onToolsBtn = isToolsButtonHit(e);
  const onMenu = menu.contains(e.target);

  if (onMenu || onToolsBtn) return;

  /* Click elsewhere while open */
  closeToolsMenu();
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;

  const { menu } = getToolsElements();
  if (menu && menu.classList.contains("active")) {
    closeToolsMenu();
    return;
  }

  const navbar = document.getElementById("navbar");
  if (navbar && navbar.classList.contains("active")) {
    closeMobileNav();
  }
});

/* Safe href for inline checks */
function isSafeHref(href) {
  if (href == null || href === "") return false;
  const s = String(href).trim();
  if (s === "" || s === "undefined" || s === "null") return false;
  return true;
}

/* ---------- More menu (optional pages) ---------- */
function toggleMoreMenu() {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const overlay = document.getElementById("moreOverlay");

  const desktopIcon = document.querySelector(".nav-item i.fa-bars");
  const mobileIcon = document.querySelector(".more-btn i");

  if (isMobile) {
    const mobileMenu = document.getElementById("moreMenuMobile");
    if (mobileMenu) {
      mobileMenu.classList.toggle("active");
      if (mobileMenu.classList.contains("active")) {
        mobileIcon && mobileIcon.classList.add("active");
      } else {
        mobileIcon && mobileIcon.classList.remove("active");
      }
    }
  } else {
    const desktopMenu = document.getElementById("moreMenuDesktop");
    if (desktopMenu) {
      desktopMenu.classList.toggle("active");
      if (desktopMenu.classList.contains("active")) {
        desktopIcon && desktopIcon.classList.add("active");
      } else {
        desktopIcon && desktopIcon.classList.remove("active");
      }
    }
  }

  if (overlay) {
    overlay.classList.toggle("active");
  }
}

const moreOverlay = document.getElementById("moreOverlay");
if (moreOverlay) {
  moreOverlay.addEventListener("click", function () {
    const desktopMenu = document.getElementById("moreMenuDesktop");
    const mobileMenu = document.getElementById("moreMenuMobile");
    const icon = document.querySelector(".nav-item i.fa-bars");

    if (desktopMenu) desktopMenu.classList.remove("active");
    if (mobileMenu) mobileMenu.classList.remove("active");

    moreOverlay.classList.remove("active");

    if (icon) icon.classList.remove("active");

    const desktopIcon = document.querySelector(".nav-item i.fa-bars");
    const mobileIcon = document.querySelector(".more-btn i");
    if (desktopIcon) desktopIcon.classList.remove("active");
    if (mobileIcon) mobileIcon.classList.remove("active");
  });
}

document.addEventListener("click", function (e) {
  const desktopMenu = document.getElementById("moreMenuDesktop");
  const mobileMenu = document.getElementById("moreMenuMobile");
  const overlay = document.getElementById("moreOverlay");

  const moreBtn = e.target.closest(".nav-more-btn");
  const mobileBtn = e.target.closest(".more-btn");

  let closed = false;

  if (
    desktopMenu &&
    desktopMenu.classList.contains("active") &&
    !desktopMenu.contains(e.target) &&
    !moreBtn
  ) {
    desktopMenu.classList.remove("active");
    closed = true;
  }

  if (
    mobileMenu &&
    mobileMenu.classList.contains("active") &&
    !mobileMenu.contains(e.target) &&
    !mobileBtn
  ) {
    mobileMenu.classList.remove("active");
    closed = true;
  }

  if (closed && overlay) {
    overlay.classList.remove("active");
  }

  const desktopIcon = document.querySelector(".nav-item i.fa-bars");
  const mobileIcon = document.querySelector(".more-btn i");

  if (closed) {
    if (desktopIcon) desktopIcon.classList.remove("active");
    if (mobileIcon) mobileIcon.classList.remove("active");
  }
});

window.addEventListener("load", function () {
  let lastScroll = 0;

  window.addEventListener("scroll", function () {
    const nav = document.querySelector(".mobile-bottom-nav");
    if (!nav) return;

    const currentScroll = window.pageYOffset;

    if (currentScroll > lastScroll && currentScroll > 80) {
      nav.style.transform = "translateY(100%)";
    } else {
      nav.style.transform = "translateY(0)";
    }

    lastScroll = currentScroll;
  });
});

const links = document.querySelectorAll(".mobile-bottom-nav a");
const current = window.location.pathname;

links.forEach((link) => {
  if (link.getAttribute("href") === current) {
    link.classList.add("active");
  }
});

/* Block navigation to literal undefined /invalid hrefs (safety net sitewide) */
document.addEventListener(
  "click",
  function (e) {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (href == null) return;
    const t = href.trim();
    if (t === "undefined" || t === "/undefined" || t === "null") {
      e.preventDefault();
      e.stopPropagation();
      console.error("Blocked navigation: invalid href", href);
    }
  },
  true
);

function slugifyForTag(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hydrateLegacyMetaPlaceholders() {
  const metaInfo = document.querySelector(".meta-info");
  if (!metaInfo) return;

  const now = new Date();
  const postDate = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const postTime = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  const spans = metaInfo.querySelectorAll("span");
  spans.forEach((span) => {
    if (span.textContent.includes("{{POST_DATE}}")) {
      span.textContent = span.textContent.replace("{{POST_DATE}}", postDate);
    }
    if (span.textContent.includes("{{POST_TIME}}")) {
      span.textContent = span.textContent.replace("{{POST_TIME}}", postTime);
    }
  });

  const tagAnchor = metaInfo.querySelector("a.tag-link");
  if (!tagAnchor) return;

  const legacyStatusTags =
    /^(latest job|new form|admit card|result|answer key|document|admission|syllabus|general)$/i;
  const tagItem = metaInfo.querySelector(".meta-item--tag") || tagAnchor.closest(".meta-item");
  const label = tagAnchor.textContent?.trim() || "";
  if (!label || legacyStatusTags.test(label) || label.includes("{{TAG}}")) {
    if (tagItem) tagItem.hidden = true;
    return;
  }

  const href = tagAnchor.getAttribute("href") || "";
  if (href.includes("{{TAG_HREF}}") || href.includes("{{TAG_SLUG}}")) {
    const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    tagAnchor.setAttribute("href", slug ? `/topic/${slug}` : "#");
  }
}

document.addEventListener("DOMContentLoaded", hydrateLegacyMetaPlaceholders);

/* CSP: no inline onclick — delegate header controls after fragment load */
document.addEventListener(
  "click",
  function (e) {
    const ph = e.target.closest(".social-placeholder");
    if (ph) {
      e.preventDefault();
      return;
    }

    if (isToolsButtonHit(e)) {
      e.preventDefault();
      toggleTools(e);
      return;
    }

    if (e.target.closest(".hamburger")) {
      e.preventDefault();
      toggleMenu(e);
      return;
    }

    if (e.target.closest(".header-search-mobile-btn")) {
      e.preventDefault();
      openSearch();
      return;
    }

    const searchNav = e.target.closest("a.nav-search-open");
    if (searchNav) {
      e.preventDefault();
      openSearch();
    }
  },
  true
);

document.addEventListener("keydown", function (e) {
  const btn = e.target && e.target.closest && e.target.closest(".tools-btn");
  if (!btn || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  toggleTools(e);
});

document.addEventListener(
  "click",
  function (e) {
    const t = e.target.closest(".mobile-legal-toggle");
    if (t) toggleMobileLegal(e);
  },
  true
);
