/* TypeLab API client: small wrappers around fetch for the login, leaderboard and certificate server.
   Every call returns { ok, data } or { ok: false, offline, status, error, data } and never throws, so
   the app keeps working when the server is missing, slow or not configured.
   `token` is a function that returns the login token (or null); it is sent as "Authorization: Bearer ...". */
(function (root) {
  "use strict";

  function create({ base, fetchImpl, enabled = true, timeoutMs = 6000, token = () => null }) {
    async function call(method, path, body, authToken) {
      if (!enabled || typeof fetchImpl !== "function") return { ok: false, offline: true };
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const headers = {};
      if (body) headers["Content-Type"] = "application/json";
      const t = authToken || token();
      if (t) headers.Authorization = "Bearer " + t;
      try {
        const res = await fetchImpl(base + path, {
          method,
          headers: Object.keys(headers).length ? headers : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller ? controller.signal : undefined,
          cache: "no-store",
          keepalive: !!body,   // a last update sent as the page closes still gets through
        });
        let data = null;
        try { data = await res.json(); } catch (e) { /* not JSON: treat it as an empty answer */ }
        if (res.ok) return { ok: true, data };
        // 5xx and 404 mean there is no usable server; 4xx are answers about the request (wrong code, too many tries ...).
        return { ok: false, status: res.status, error: data && data.error, data, offline: res.status >= 500 || res.status === 404 };
      } catch (e) {
        return { ok: false, offline: true };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    return {
      health: () => call("GET", "/health"),
      otpSend: (email) => call("POST", "/otp/send", { email }),
      otpVerify: (email, code) => call("POST", "/otp/verify", { email, code }),
      sync: (payload) => call("POST", "/sync", payload),
      board: (scope) => call("GET", `/board?scope=${scope === "week" ? "week" : "all"}`),
      remove: () => call("POST", "/delete", {}),
      certificate: (payload) => call("POST", "/certificate", payload),
      verify: (code) => call("GET", `/verify?c=${encodeURIComponent(code)}`),
      // the owner's view of all players; `key` is the owner's key, sent instead of a player's login token
      adminPlayers: (key) => call("GET", "/admin/players", null, key),
    };
  }

  const api = { create };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).apiClient = api;
})(typeof window !== "undefined" ? window : globalThis);
