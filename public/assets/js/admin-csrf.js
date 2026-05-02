/* Cookie-based CSRF token for /api/admin mutating requests (pairs with csurf on the server). */
(function () {
  let tokenPromise = null;
  let cachedToken = "";
  let tokenFetchedAt = 0;
  const TOKEN_TTL_MS = 2 * 60 * 1000;

  function resolveRequestUrl(inputUrl) {
    return new URL(String(inputUrl || ""), window.location.origin).toString();
  }

  window.resetAdminCsrfToken = function () {
    tokenPromise = null;
    cachedToken = "";
    tokenFetchedAt = 0;
  };

  window.getAdminCsrfToken = function (opts) {
    var options = opts || {};
    var forceRefresh = Boolean(options.forceRefresh);
    var isStale = Date.now() - tokenFetchedAt > TOKEN_TTL_MS;

    if (!forceRefresh && cachedToken && !isStale) {
      return Promise.resolve(cachedToken);
    }

    if (!tokenPromise) {
      tokenPromise = fetch(resolveRequestUrl("/api/admin/csrf-token"), {
        credentials: "include",
        cache: "no-store"
      })
        .then(function (r) {
          if (!r.ok) throw new Error("CSRF token request failed");
          return r.json();
        })
        .then(function (body) {
          var nextToken = body && body.csrfToken ? String(body.csrfToken) : "";
          cachedToken = nextToken;
          tokenFetchedAt = Date.now();
          return nextToken;
        })
        .finally(function () {
          tokenPromise = null;
        });
    }
    return tokenPromise;
  };

  window.fetchAdminWithCsrf = async function (url, options) {
    var opts = options || {};
    var headers = Object.assign({}, opts.headers || {});
    var method = String(opts.method || "GET").toUpperCase();
    var needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (needsCsrf) {
      headers["X-CSRF-Token"] = await window.getAdminCsrfToken({ forceRefresh: false });
    }
    var reqUrl = resolveRequestUrl(url);
    var response = await fetch(reqUrl, Object.assign({}, opts, {
      credentials: "include",
      headers: headers
    }));
    if (response.status === 403 && needsCsrf) {
      window.resetAdminCsrfToken();
      headers["X-CSRF-Token"] = await window.getAdminCsrfToken({ forceRefresh: true });
      response = await fetch(reqUrl, Object.assign({}, opts, {
        credentials: "include",
        headers: headers
      }));
    }
    return response;
  };
})();
