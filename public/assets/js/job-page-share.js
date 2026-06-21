(function initJobPageShare() {
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

  function wireSocialShareBar() {
    const bar = document.querySelector(".social-share-bar");
    if (!bar) return;

    const { pageUrl, pageTitle, shareText } = getSharePayload();

    const wa = bar.querySelector("a.whatsapp, a.social-btn-whatsapp");
    const tg = bar.querySelector("a.telegram, a.social-btn-telegram");
    const fb = bar.querySelector("a.facebook, a.social-btn-facebook");
    const shareBtn = document.getElementById("sharePageBtn");

    if (wa) {
      wa.href = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`;
      wa.setAttribute("aria-label", "Share on WhatsApp");
    }
    if (tg) {
      tg.href = `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`;
      tg.setAttribute("aria-label", "Share on Telegram");
    }
    if (fb) {
      fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
      fb.setAttribute("aria-label", "Share on Facebook");
    }

    if (!shareBtn || shareBtn.dataset.shareWired === "1") return;
    shareBtn.dataset.shareWired = "1";

    shareBtn.addEventListener("click", async () => {
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

      if (wa && wa.href) {
        window.open(wa.href, "_blank", "noopener,noreferrer");
      }
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
    relocateShareBar();
    wireSocialShareBar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShareBar);
  } else {
    initShareBar();
  }
})();
