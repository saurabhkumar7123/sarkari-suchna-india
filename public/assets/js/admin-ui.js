(function () {
  if (window.AdminUI) return;

  const STYLE_ID = "adminUiStyles";
  const STYLE_VERSION = "5";
  const CONFIRM_CSS_ID = "adminConfirmCssLink";
  const TOAST_HOST_ID = "adminToastHost";
  const MODAL_HOST_ID = "adminConfirmModalHost";
  const MODAL_Z_INDEX = "99999";

  const VARIANT_META = {
    danger: { icon: "🗑️", btnClass: "admin-dialog__btn--danger" },
    safe: { icon: "↩️", btnClass: "admin-dialog__btn--safe" },
    default: { icon: "ℹ️", btnClass: "admin-dialog__btn--primary" }
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getStandaloneSidebarLeft() {
    if (!document.body.classList.contains("standalone-admin-page")) return 0;
    if (window.matchMedia("(max-width: 768px)").matches) return 0;
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const width = sidebar.getBoundingClientRect().width;
      if (width > 0) return Math.round(width);
    }
    return document.body.classList.contains("sidebar-collapsed") ? 72 : 338;
  }

  function layoutModalHost(host) {
    const left = getStandaloneSidebarLeft();
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.left = `${left}px`;
    host.style.width = "auto";
    host.style.zIndex = MODAL_Z_INDEX;
  }

  function ensureConfirmCss() {
    if (document.getElementById(CONFIRM_CSS_ID)) return;
    const link = document.createElement("link");
    link.id = CONFIRM_CSS_ID;
    link.rel = "stylesheet";
    link.href = "/css/admin/admin-confirm.css?v=2";
    document.head.appendChild(link);
  }

  function ensureStyles() {
    ensureConfirmCss();
    const existing = document.getElementById(STYLE_ID);
    if (existing && existing.dataset.version === STYLE_VERSION) return;
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.dataset.version = STYLE_VERSION;
    style.textContent = `
#${TOAST_HOST_ID}{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:${MODAL_Z_INDEX}}
.admin-toast{min-width:220px;max-width:360px;padding:10px 12px;border-radius:10px;color:#fff;font-size:13px;box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);transition:all .2s ease}
.admin-toast.show{opacity:1;transform:translateY(0)}
.admin-toast.success{background:#166534}
.admin-toast.error{background:#b91c1c}
.admin-toast.info{background:#1e3a8a}
#${MODAL_HOST_ID}{display:none}
#${MODAL_HOST_ID}.show{display:flex}
body.admin-confirm-open.standalone-admin-page .sidebar,
body.admin-confirm-open.standalone-admin-page .toggle-btn{z-index:1 !important}
.admin-btn-loading{position:relative;opacity:.85}
`;
    document.head.appendChild(style);
  }

  function ensureToastHost() {
    let host = document.getElementById(TOAST_HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = TOAST_HOST_ID;
    document.body.appendChild(host);
    return host;
  }

  function toast(message, type = "info", timeout = 2600) {
    ensureStyles();
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.className = `admin-toast ${type}`;
    el.textContent = String(message || "");
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 180);
    }, timeout);
  }

  function ensureModalHost() {
    let host = document.getElementById(MODAL_HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = MODAL_HOST_ID;
    }
    document.body.appendChild(host);
    return host;
  }

  function closeModal() {
    const host = document.getElementById(MODAL_HOST_ID);
    if (!host) return;
    host.classList.remove("show");
    host.innerHTML = "";
    host.removeAttribute("style");
    document.body.classList.remove("admin-confirm-open");
    document.removeEventListener("keydown", closeModal._onKeydown);
  }

  function resolveVariant(options) {
    if (options.variant) return String(options.variant);
    if (options.requireText) return "danger";
    if (options.warnText === "") return "safe";
    return "default";
  }

  function confirmModal(options = {}) {
    ensureStyles();
    const host = ensureModalHost();
    layoutModalHost(host);

    const title = String(options.title || "Confirm action");
    const details = String(options.details || "");
    const warnText = String(options.warnText || "");
    const requireText = String(options.requireText || "");
    const confirmLabel = String(options.confirmLabel || "Confirm");
    const hasInput = Boolean(requireText);
    const variant = resolveVariant(options);
    const meta = VARIANT_META[variant] || VARIANT_META.default;

    return new Promise((resolve) => {
      host.innerHTML = `
        <div class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="adminDialogTitle" data-variant="${escapeHtml(variant)}">
          <button type="button" class="admin-dialog__close" id="adminConfirmClose" aria-label="Close">×</button>
          <div class="admin-dialog__icon" aria-hidden="true">${meta.icon}</div>
          <h3 class="admin-dialog__title" id="adminDialogTitle">${escapeHtml(title)}</h3>
          ${details ? `<p class="admin-dialog__message">${escapeHtml(details)}</p>` : ""}
          ${warnText ? `<p class="admin-dialog__alert">${escapeHtml(warnText)}</p>` : ""}
          ${hasInput ? `
            <div class="admin-dialog__typed">
              <label class="admin-dialog__typed-label" for="adminConfirmInput">
                Type <kbd>${escapeHtml(requireText)}</kbd> to confirm
              </label>
              <input type="text" class="admin-dialog__input" id="adminConfirmInput" placeholder="${escapeHtml(requireText)}" autocomplete="off" spellcheck="false">
            </div>
          ` : ""}
          <div class="admin-dialog__actions">
            <button type="button" class="admin-dialog__btn admin-dialog__btn--ghost" id="adminConfirmCancel">Cancel</button>
            <button type="button" class="admin-dialog__btn ${meta.btnClass}" id="adminConfirmOk" ${hasInput ? "disabled" : ""}>${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      `;

      host.classList.add("show");
      document.body.classList.add("admin-confirm-open");

      const dialog = host.querySelector(".admin-dialog");
      const input = document.getElementById("adminConfirmInput");
      const cancelBtn = document.getElementById("adminConfirmCancel");
      const closeBtn = document.getElementById("adminConfirmClose");
      const okBtn = document.getElementById("adminConfirmOk");

      const finish = (state) => {
        closeModal();
        resolve(state);
      };

      closeModal._onKeydown = (e) => {
        if (e.key === "Escape") finish(false);
      };
      document.addEventListener("keydown", closeModal._onKeydown);

      if (input) {
        input.focus();
        input.addEventListener("input", () => {
          const valid = String(input.value || "").trim() === requireText;
          okBtn.disabled = !valid;
          input.classList.toggle("is-valid", valid);
        });
      } else {
        okBtn?.focus();
      }

      cancelBtn?.addEventListener("click", () => finish(false));
      closeBtn?.addEventListener("click", () => finish(false));
      okBtn?.addEventListener("click", () => finish(true));
      host.addEventListener("click", (e) => {
        if (e.target === host) finish(false);
      }, { once: true });
      dialog?.addEventListener("click", (e) => e.stopPropagation());
    });
  }

  function simpleConfirm(options = {}) {
    return confirmModal({
      title: String(options.title || "Confirm"),
      warnText: options.warnText !== undefined ? String(options.warnText) : "This action cannot be undone",
      details: String(options.details || ""),
      confirmLabel: String(options.confirmLabel || "Confirm"),
      variant: options.variant
    });
  }

  function typedConfirm(options = {}) {
    return confirmModal({
      title: String(options.title || "Confirm action"),
      warnText: String(options.warnText || "This cannot be undone."),
      details: String(options.details || ""),
      requireText: String(options.requireText || "DELETE"),
      confirmLabel: String(options.confirmLabel || "Confirm"),
      variant: "danger"
    });
  }

  function confirmDelete(options = {}) {
    const count = Number(options.count) || 1;
    const confirmLabel = String(options.confirmLabel || "Confirm");
    return typedConfirm({
      title: String(options.title || "Confirm delete"),
      warnText: "Permanent action — data cannot be recovered.",
      details: count > 1
        ? `You are deleting ${count} items.`
        : "Please confirm you want to delete this item.",
      requireText: "DELETE",
      confirmLabel
    });
  }

  function confirmMoveToTrash(options = {}) {
    const count = Number(options.count) || 1;
    return simpleConfirm({
      title: String(options.title || (count > 1 ? "Move pages to trash" : "Move page to trash")),
      warnText: "You can restore from Trash anytime.",
      details: count > 1
        ? `${count} selected pages will be hidden from the site.`
        : "This page will be hidden from the site and moved to Trash.",
      confirmLabel: String(options.confirmLabel || "Move to trash"),
      variant: "danger"
    });
  }

  async function withLoading(button, action, loadingText = "Processing...") {
    if (!button || typeof action !== "function") {
      return action();
    }
    const prevText = button.textContent;
    button.disabled = true;
    button.classList.add("admin-btn-loading");
    button.textContent = loadingText;
    try {
      return await action();
    } finally {
      button.disabled = false;
      button.classList.remove("admin-btn-loading");
      button.textContent = prevText;
    }
  }

  window.AdminUI = {
    escapeHtml,
    toastSuccess: (message) => toast(message || "Action completed successfully", "success"),
    toastError: (message) => toast(message || "Something went wrong", "error"),
    toastInfo: (message) => toast(message || "", "info"),
    simpleConfirm,
    typedConfirm,
    confirmDelete,
    confirmMoveToTrash,
    withLoading
  };
})();
