(function initJobPageShare() {
  const JOIN_LINKS = {
    whatsapp: "https://whatsapp.com/channel/0029VbCtmOJIiRoqIP4wgN1n",
    telegram: "https://t.me/sarkarisuchnaindia",
    facebook: "https://www.facebook.com/share/1cQMwV2STp/"
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isMissingJoinHref(href) {
    const value = cleanText(href);
    return !value || value === "#" || value.endsWith("#");
  }

  function isShareHref(href) {
    const value = String(href || "").toLowerCase();
    return (
      value.includes("wa.me/?text=") ||
      value.includes("t.me/share/url") ||
      value.includes("facebook.com/sharer/")
    );
  }

  function getSharePayload() {
    const pageUrl = window.location.href;
    const pageTitle =
      cleanText(document.querySelector(".job-title")?.textContent) ||
      cleanText(document.title.replace(/\s*\|\s*Sarkari Suchna India$/i, "")) ||
      document.title;
    const shareText = `${pageTitle} — Sarkari Suchna India`;
    return { pageUrl, pageTitle, shareText };
  }

  function wireJoinLinks(bar) {
    const wa = bar.querySelector("a.whatsapp, a.social-btn-whatsapp");
    const tg = bar.querySelector("a.telegram, a.social-btn-telegram");
    const fb = bar.querySelector("a.facebook, a.social-btn-facebook");

    if (wa && (isMissingJoinHref(wa.getAttribute("href")) || isShareHref(wa.href))) {
      wa.href = JOIN_LINKS.whatsapp;
      wa.setAttribute("aria-label", "Join WhatsApp Channel");
    }
    if (tg && (isMissingJoinHref(tg.getAttribute("href")) || isShareHref(tg.href))) {
      tg.href = JOIN_LINKS.telegram;
      tg.setAttribute("aria-label", "Join Telegram Channel");
    }
    if (fb && (isMissingJoinHref(fb.getAttribute("href")) || isShareHref(fb.href))) {
      fb.href = JOIN_LINKS.facebook;
      fb.setAttribute("aria-label", "Join Facebook Page");
    }
  }

  function wireShareButton() {
    const shareBtn = document.getElementById("sharePageBtn");
    if (!shareBtn || shareBtn.dataset.shareWired === "1") return;
    shareBtn.dataset.shareWired = "1";

    shareBtn.addEventListener("click", async () => {
      const { pageUrl, pageTitle, shareText } = getSharePayload();

      if (navigator.share) {
        try {
          await navigator.share({ title: pageTitle, text: shareText, url: pageUrl });
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(pageUrl);
          const label = shareBtn.querySelector("span") || shareBtn;
          const prev = label.textContent;
          label.textContent = "Copied!";
          window.setTimeout(() => {
            label.textContent = prev;
          }, 2000);
          return;
        } catch (_) {
          /* fall through */
        }
      }

      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });
  }

  function normalizeSectionKey(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function isImportantLinksCard(card) {
    const title = card?.querySelector?.(".section-title");
    if (!title) return false;
    const key = normalizeSectionKey(title.textContent.replace("➜", ""));
    return key.includes("importantlink");
  }

  function relocateShareBar() {
    const bar = document.querySelector(".social-share-bar");
    if (!bar) return;

    const cards = Array.from(document.querySelectorAll(".card"));
    const linksCard = cards.find(isImportantLinksCard);

    if (linksCard) {
      if (linksCard.nextElementSibling !== bar) {
        linksCard.insertAdjacentElement("afterend", bar);
      }
      return;
    }

    const banner = document.querySelector(".highlight-banner-root");
    if (banner && bar.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING) {
      banner.insertAdjacentElement("beforebegin", bar);
    }
  }

  function initShareBar() {
    const bar = document.querySelector(".social-share-bar");
    if (bar) wireJoinLinks(bar);
    relocateShareBar();
    wireShareButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShareBar);
  } else {
    initShareBar();
  }
})();
