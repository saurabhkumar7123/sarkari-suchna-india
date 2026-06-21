const LOGIN_REMEMBER_KEY = "adminLoginRememberUser";

function setLoginError(message) {
  const box = document.getElementById("loginError");
  if (!box) return;
  box.textContent = String(message || "").trim();
}

function setLoginLoading(loading) {
  const btn = document.getElementById("loginBtn");
  const text = document.getElementById("loginBtnText");
  const spinner = document.getElementById("loginSpinner");
  if (!btn || !text) return;
  btn.disabled = !!loading;
  text.textContent = loading ? "Signing in..." : "Sign in";
  spinner?.classList.toggle("is-hidden", !loading);
}

function restoreRememberedUsername() {
  const input = document.getElementById("u");
  const remember = document.getElementById("loginRemember");
  if (!input) return;
  try {
    const saved = localStorage.getItem(LOGIN_REMEMBER_KEY);
    if (saved) {
      input.value = saved;
      if (remember) remember.checked = true;
    }
  } catch {
    /* ignore */
  }
}

function persistRememberedUsername(username) {
  const remember = document.getElementById("loginRemember");
  try {
    if (remember && remember.checked) {
      localStorage.setItem(LOGIN_REMEMBER_KEY, username);
    } else {
      localStorage.removeItem(LOGIN_REMEMBER_KEY);
    }
  } catch {
    /* ignore */
  }
}

function wirePasswordToggle() {
  const input = document.getElementById("p");
  const btn = document.getElementById("loginPasswordToggle");
  if (!input || !btn) return;
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.setAttribute("aria-pressed", show ? "true" : "false");
  });
}

async function login() {
  const username = document.getElementById("u").value.trim();
  const password = document.getElementById("p").value.trim();

  setLoginError("");

  if (!username || !password) {
    setLoginError("Username and password are required.");
    return;
  }

  setLoginLoading(true);
  try {
    if (typeof window.getAdminCsrfToken === "function") {
      await window.getAdminCsrfToken({ forceRefresh: true });
    }
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    };
    const res = typeof window.fetchAdminWithCsrf === "function"
      ? await window.fetchAdminWithCsrf("/api/admin/login", requestOptions)
      : await fetch("/api/admin/login", requestOptions);

    if (res.status === 403) {
      setLoginError("Security check failed. Refresh the page and try again.");
      if (typeof window.resetAdminCsrfToken === "function") window.resetAdminCsrfToken();
      return;
    }

    const data = await res.json();

    if (data.status === "success") {
      persistRememberedUsername(username);
      try {
        sessionStorage.setItem("adminLoginWelcome", "1");
        sessionStorage.setItem("adminLoginWelcomeUser", username);
      } catch {
        /* ignore */
      }
      window.location.href = "/dashboard";
      return;
    }
    if (data.status === "blocked") {
      setLoginError("Too many attempts. Please try again later.");
      return;
    }
    setLoginError("Invalid username or password.");
  } catch (err) {
    console.error("Login error:", err);
    setLoginError("Server error. Please try again.");
  } finally {
    setLoginLoading(false);
  }
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login();
  });
} else {
  document.getElementById("loginBtn")?.addEventListener("click", login);
}

wirePasswordToggle();
restoreRememberedUsername();

document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("u");
  if (usernameInput && !usernameInput.value) {
    usernameInput.focus({ preventScroll: true });
  }
});
