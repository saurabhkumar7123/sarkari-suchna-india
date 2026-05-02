function setLoginError(message) {
  const box = document.getElementById("loginError");
  if (!box) return;
  box.textContent = String(message || "").trim();
}

function setLoginLoading(loading) {
  const btn = document.getElementById("loginBtn");
  const text = document.getElementById("loginBtnText");
  if (!btn || !text) return;
  btn.disabled = !!loading;
  text.textContent = loading ? "Signing in..." : "Login";
}

async function login() {
  const username = document.getElementById("u").value.trim();
  const password = document.getElementById("p").value.trim();

  setLoginError("");

  if (!username || !password) {
    setLoginError("Username & password required");
    return;
  }

  setLoginLoading(true);
  try {
    if (typeof window.getAdminCsrfToken === "function") {
      await window.getAdminCsrfToken({ forceRefresh: true });
    }
    console.log("[auth-debug] login submit", {
      origin: window.location.origin,
      endpoint: "/api/admin/login",
      credentialsMode: "include"
    });
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ username, password })
    };
    const res = typeof window.fetchAdminWithCsrf === "function"
      ? await window.fetchAdminWithCsrf("/api/admin/login", requestOptions)
      : await fetch("/api/admin/login", requestOptions);
    console.log("[auth-debug] login response", {
      status: res.status,
      ok: res.ok,
      responseType: res.type
    });
    if (res.status === 403) {
      setLoginError("Security check failed. Please refresh and try again.");
      if (typeof window.resetAdminCsrfToken === "function") {
        window.resetAdminCsrfToken();
      }
      return;
    }
    const data = await res.json();

    if (data.status === "success") {
      window.location.href = "/dashboard";
      return;
    }
    if (data.status === "blocked") {
      setLoginError("Too many attempts. Try later.");
      return;
    }
    setLoginError("Invalid username or password");
  } catch (err) {
    console.log("ERROR:", err);
    setLoginError("Server error. Please try again.");
  } finally {
    setLoginLoading(false);
  }
}

// button
document.getElementById("loginBtn").addEventListener("click", login);

// enter
document.addEventListener("keydown", function(e){
  if(e.key === "Enter"){
    login();
  }
});