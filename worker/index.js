/* The Cloudflare Worker for every /api/* request (email codes, sync, board, certificate ...).
   The logic is in server/core.mjs and server/mail.mjs. This file only connects them to Cloudflare.
   wrangler.jsonc sends only /api/* here; every other address is a static file.

     KV namespace binding   TYPELAB            (created by wrangler.jsonc)
     Secret                 TYPELAB_SALT       a long random value; hashes emails into player ids
     Secret                 TYPELAB_SIGN_KEY   a long random value; signs login tokens and certificates
     Variable               MAIL_PROVIDER      "brevo" or "resend"
     Secret                 MAIL_API_KEY       the email provider's API key
     Variable               MAIL_FROM          the sender, for example  TypeLab <login@example.com>
     Secret                 TYPELAB_ADMIN_KEY  the owner's key for the owner view (#/admin); leave it out to switch that off

   Without the two secrets the API answers "not-configured". Without the mail settings, login answers
   "mail-not-configured". In both cases the app still works as a guest. */
import { handle } from "../server/core.mjs";
import { createMailer } from "../server/mail.mjs";

const MAX_BODY = 4096;

const send = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // a static file that does not exist also ends up here
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    if (request.method !== "GET" && request.method !== "POST") return send({ error: "method-not-allowed" }, 405);
    const route = url.pathname.slice("/api/".length).split("/").filter(Boolean);
    if (!env.TYPELAB && route.join("/") !== "health") return send({ error: "not-configured" }, 503);

    let body = null;
    if (request.method === "POST") {
      const text = await request.text();
      if (text.length > MAX_BODY) return send({ error: "too-large" }, 413);
      try { body = text ? JSON.parse(text) : null; } catch (e) { return send({ error: "bad-json" }, 400); }
    }

    const store = env.TYPELAB
      ? {
        get: (k) => env.TYPELAB.get(k),
        // KV needs a time to live of at least 60 seconds
        put: (k, v, ttl) => env.TYPELAB.put(k, v, ttl ? { expirationTtl: Math.max(60, Math.ceil(ttl)) } : undefined),
      }
      : null;
    const secrets = { salt: env.TYPELAB_SALT, signKey: env.TYPELAB_SIGN_KEY, adminKey: env.TYPELAB_ADMIN_KEY };
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || null;
    const result = await handle(
      { method: request.method, route, query: url.searchParams, body, token },
      { store, secrets, mail: createMailer(env), ip: request.headers.get("CF-Connecting-IP") || undefined });
    return send(result.body, result.status);
  },
};
