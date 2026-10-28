/* TypeLab email sending, for the login codes. A small adapter, so the provider can be changed
   without touching the login logic.

   Settings (the Worker -> Settings -> Variables and Secrets):
     MAIL_PROVIDER   "brevo" or "resend"
     MAIL_API_KEY    the provider's API key (a secret)
     MAIL_FROM       the sender, for example  TypeLab <login@example.com>
                     Brevo: the address must be a verified sender in your Brevo account.
                     Resend: the address must be on a domain you verified with Resend.

   createMailer() returns null when any of them is missing, and the login then says that email
   sign-in is not set up. send() throws if the provider refuses the message. */

const PROVIDERS = {
  brevo: (key, from, msg) => ({
    url: "https://api.brevo.com/v3/smtp/email",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: { sender: from.name ? { name: from.name, email: from.email } : { email: from.email }, to: [{ email: msg.to }], subject: msg.subject, htmlContent: msg.html, textContent: msg.text },
  }),
  resend: (key, from, msg) => ({
    url: "https://api.resend.com/emails",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: { from: from.name ? `${from.name} <${from.email}>` : from.email, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text },
  }),
};

// "TypeLab <login@example.com>" or "login@example.com" -> { name, email }
export function parseFrom(text) {
  const m = String(text || "").trim().match(/^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/) || String(text || "").trim().match(/^()([^<>\s]+@[^<>\s]+)$/);
  return m ? { name: (m[1] || "").trim(), email: m[2] } : null;
}

export function createMailer(env, fetchImpl = globalThis.fetch) {
  const provider = String(env.MAIL_PROVIDER || "").toLowerCase();
  const from = parseFrom(env.MAIL_FROM);
  if (!PROVIDERS[provider] || !env.MAIL_API_KEY || !from) return null;
  return async function send(msg) {
    const req = PROVIDERS[provider](env.MAIL_API_KEY, from, msg);
    const res = await fetchImpl(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body) });
    if (!res.ok) throw new Error(`mail-failed:${res.status}`);
  };
}

// The login email: the code in the subject, so it can be read from a notification without opening it.
export function otpMessage(code, minutes) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${code} is your TypeLab login code`,
    text: `Your TypeLab login code is ${code}.\n\nIt works for ${minutes} minutes. Enter it on the TypeLab login page.\n\nIf you did not ask for this code, you can ignore this email. Nobody can log in as you without it.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1b1f3a">` +
      `<h2 style="margin:0 0 12px;color:#4f46e5">TypeLab</h2><p style="margin:0 0 16px">Your login code is:</p>` +
      `<p style="font-size:34px;letter-spacing:6px;font-weight:700;margin:0 0 16px;background:#f3f1ff;padding:14px;border-radius:10px;text-align:center">${spaced}</p>` +
      `<p style="margin:0 0 8px">It works for ${minutes} minutes. Enter it on the TypeLab login page.</p>` +
      `<p style="margin:0;color:#5b6280;font-size:13px">If you did not ask for this code, you can ignore this email. Nobody can log in as you without it.</p></div>`,
  };
}
