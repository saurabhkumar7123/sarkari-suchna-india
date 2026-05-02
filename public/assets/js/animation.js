/* ===== Page Load Animation ===== */
document.addEventListener("DOMContentLoaded", function () {
  document.body.classList.add("page-active");
});

/* ===== Link Click Animation ===== */
document.addEventListener("click", function (e) {

  const link = e.target.closest("a");

  if (!link) return;

  try {
    const u = new URL(link.href, window.location.href);
    if (u.pathname === "/undefined" || u.pathname.endsWith("/undefined")) {
      e.preventDefault();
      console.error("Blocked invalid internal navigation:", link.href);
      return;
    }
  } catch (_) {
    /* ignore */
  }

  /* Internal links only */
  if (
    link.hostname === window.location.hostname &&
    !link.hasAttribute("target") &&
    !link.href.includes("#")
  ) {

    e.preventDefault();

    document.body.classList.remove("page-active");
    document.body.classList.add("page-exit");

    setTimeout(() => {
      window.location.href = link.href;
    }, 400);
  }

});

/* ===== Hardware Back Support ===== */
window.addEventListener("pageshow", function () {
  document.body.classList.remove("page-exit");
  document.body.classList.add("page-active");
});