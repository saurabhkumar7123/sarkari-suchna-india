(function () {
  if (window.AdminUI) return;

  const STYLE_ID = "adminUiStyles";
  const TOAST_HOST_ID = "adminToastHost";
  const MODAL_HOST_ID = "adminConfirmModalHost";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${TOAST_HOST_ID}{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:4000}
.admin-toast{min-width:220px;max-width:360px;padding:10px 12px;border-radius:10px;color:#fff;font-size:13px;box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);transition:all .2s ease}
.admin-toast.show{opacity:1;transform:translateY(0)}
.admin-toast.success{background:#166534}
.admin-toast.error{background:#b91c1c}
.admin-toast.info{background:#1e3a8a}
#${MODAL_HOST_ID}{position:fixed;inset:0;background:rgba(2,6,23,.55);display:none;align-items:center;justify-content:center;padding:16px;z-index:4100}
#${MODAL_HOST_ID}.show{display:flex}
.admin-confirm-modal{background:#fff;color:#0f172a;border-radius:14px;max-width:460px;width:100%;padding:16px;border:1px solid #cbd5e1;box-shadow:0 16px 40px rgba(2,6,23,.35)}
.admin-confirm-modal h3{margin:0 0 8px;font-size:18px}
.admin-confirm-modal p{margin:0 0 8px;font-size:14px}
.admin-confirm-modal .warn{color:#b91c1c;font-weight:700}
.admin-confirm-modal input{width:100%;height:40px;border-radius:10px;border:1px solid #cbd5e1;padding:0 10px;margin-top:8px}
.admin-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
.admin-confirm-actions button{height:38px;border-radius:10px;border:1px solid #cbd5e1;padding:0 12px;cursor:pointer}
.admin-confirm-actions .confirm{background:#dc2626;border-color:#dc2626;color:#fff}
.admin-confirm-actions .confirm:disabled{opacity:.55;cursor:not-allowed}
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
    if (host) return host;
    host = document.createElement("div");
    host.id = MODAL_HOST_ID;
    document.body.appendChild(host);
    return host;
  }

  function closeModal() {
    const host = document.getElementById(MODAL_HOST_ID);
    if (!host) return;
    host.classList.remove("show");
    host.innerHTML = "";
  }

  function confirmModal(options = {}) {
    ensureStyles();
    const host = ensureModalHost();
    const title = String(options.title || "Confirm action");
    const details = String(options.details || "");
    const warnText = String(options.warnText || "");
    const requireText = String(options.requireText || "");
    const hasInput = Boolean(requireText);
    return new Promise((resolve) => {
      host.innerHTML = `
        <div class="admin-confirm-modal" role="dialog" aria-modal="true" aria-label="${title}">
          <h3>${title}</h3>
          ${warnText ? `<p class="warn">${warnText}</p>` : ""}
          ${details ? `<p>${details}</p>` : ""}
          ${hasInput ? `<input type="text" id="adminConfirmInput" placeholder="Type ${requireText}" autocomplete="off">` : ""}
          <div class="admin-confirm-actions">
            <button type="button" id="adminConfirmCancel">Cancel</button>
            <button type="button" class="confirm" id="adminConfirmOk" ${hasInput ? "disabled" : ""}>Confirm</button>
          </div>
        </div>
      `;
      host.classList.add("show");
      const input = document.getElementById("adminConfirmInput");
      const cancelBtn = document.getElementById("adminConfirmCancel");
      const okBtn = document.getElementById("adminConfirmOk");
      if (input) input.focus();
      const finish = (state) => {
        closeModal();
        resolve(state);
      };
      if (hasInput) {
        input?.addEventListener("input", () => {
          okBtn.disabled = String(input.value || "").trim() !== requireText;
        });
      }
      cancelBtn?.addEventListener("click", () => finish(false));
      okBtn?.addEventListener("click", () => finish(true));
      host.addEventListener("click", (e) => {
        if (e.target === host) finish(false);
      }, { once: true });
    });
  }

  function simpleConfirm(options = {}) {
    return confirmModal({
      title: String(options.title || "Confirm"),
      warnText: String(options.warnText || "This action cannot be undone"),
      details: String(options.details || "")
    });
  }

  function typedConfirm(options = {}) {
    return confirmModal({
      title: String(options.title || "Confirm action"),
      warnText: String(options.warnText || "This action cannot be undone"),
      details: String(options.details || ""),
      requireText: String(options.requireText || "DELETE")
    });
  }

  function confirmDelete(options = {}) {
    const count = Number(options.count) || 1;
    return typedConfirm({
      title: String(options.title || "Confirm delete"),
      warnText: "This action cannot be undone",
      details: count > 1
        ? `You are deleting ${count} items. Type DELETE to confirm`
        : "Type DELETE to confirm deletion",
      requireText: "DELETE"
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
    toastSuccess: (message) => toast(message || "Action completed successfully", "success"),
    toastError: (message) => toast(message || "Something went wrong", "error"),
    toastInfo: (message) => toast(message || "", "info"),
    simpleConfirm,
    typedConfirm,
    confirmDelete,
    withLoading
  };
})();
