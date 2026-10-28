/* TypeLab account: logging in with an email code, guest mode, and the talk with the leaderboard server.

   LOGIN. You give a name and an email. The server emails a 6-digit code, you type it back, and the
   server answers with a login token. That proves the email is really yours. The token is sent with
   every request that changes anything, and it lasts about 90 days (it is renewed while you use the
   app). There is no password.

   Saved in localStorage:  typeLab.profile = { name, email, key, token, exp, joined, board, removed, rank }
                           typeLab.guest   = "1" when the player chose to continue without logging in
   `key` names this profile's own data (see storage.js). If the token is lost or expires, the profile
   stays (so the login form can be filled in again) but the player counts as logged out. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const PROFILE_KEY = "typeLab.profile";
  const GUEST_KEY = "typeLab.guest";
  const NAME_RE = /^[\p{L}\p{N} ._'-]{2,24}$/u;
  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const MIN_SYNC_GAP_MS = 1700;   // the server refuses a second update from a player within 1.5 seconds

  let profile = null;
  let syncTimer = null;
  let syncChain = Promise.resolve();
  let lastSyncAt = 0;
  let lostHandler = null;

  const api = TL.apiClient.create({
    base: TL.config.api,
    fetchImpl: root.fetch ? root.fetch.bind(root) : null,
    enabled: root.location.protocol !== "file:",
    token: () => (profile && profile.token) || null,
  });

  const get = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const put = (key, value) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } };

  function readProfile() {
    try {
      const p = JSON.parse(get(PROFILE_KEY));
      if (p && typeof p.name === "string" && typeof p.email === "string" && /^[a-f0-9]{16}$/.test(p.key)) return p;
    } catch (e) { /* no saved profile */ }
    return null;
  }
  const writeProfile = () => put(PROFILE_KEY, profile ? JSON.stringify(profile) : null);

  const loggedIn = () => !!(profile && profile.token);

  // Called once at start-up, before anything reads saved data: points the store at this player's data.
  function init() {
    profile = readProfile();
    TL.store.use(loggedIn() ? profile.key : "");
  }

  const cleanName = (s) => String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();

  // Checks what the login form got. Returns { name, email } or { error, field }.
  function validate(name, email) {
    const n = cleanName(name);
    const e = String(email == null ? "" : email).trim();
    if (!NAME_RE.test(n)) return { field: "name", error: "Use 2 to 24 letters or numbers for your name (spaces, dots, hyphens and apostrophes are fine)." };
    if (!EMAIL_RE.test(e)) return { field: "email", error: "Please enter a valid email address, like name@example.com." };
    return { name: n, email: e };
  }

  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // A short key for this device's copy of the profile's data. It does not need to match the server's id.
  async function localKey(email) {
    const text = "typelab:local:" + email.toLowerCase().trim();
    if (root.crypto && root.crypto.subtle) return hex(await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).slice(0, 16);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 2654435761);
      h2 = Math.imul(h2 ^ text.charCodeAt(i), 1597334677);
    }
    return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 16);
  }

  // Turns a failed server answer into a sentence for the person using the app.
  function explain(r) {
    const d = r.data || {};
    switch (r.error) {
      case "wait": return { error: `Please wait ${d.retryAfter || 30} seconds before asking for another code.`, retryAfter: d.retryAfter };
      case "too-many": return { error: "Too many codes were asked for. Please try again later.", retryAfter: d.retryAfter };
      case "mail-not-configured": return { error: "Email login is not set up on this server yet. You can continue as a guest for now." };
      case "mail-failed": return { error: "The email could not be sent. Please check the address and try again." };
      case "bad-email": return { field: "email", error: "Please enter a valid email address, like name@example.com." };
      case "bad-code": return { field: "code", error: "Enter the 6 digits from the email." };
      case "wrong-code": return { field: "code", error: `That code is not right. ${d.triesLeft} ${d.triesLeft === 1 ? "try" : "tries"} left.` };
      case "code-expired": return { field: "code", error: "That code has expired, or no code was asked for. Ask for a new one.", expired: true };
      case "too-many-tries": return { field: "code", error: "Too many wrong codes. Ask for a new code.", expired: true };
      default: return { error: r.offline ? "Could not reach the server. Check your connection and try again." : "Something went wrong. Please try again." };
    }
  }

  // Step 1 of logging in: asks the server to email a code.
  async function requestCode(email) {
    const e = String(email == null ? "" : email).trim();
    if (!EMAIL_RE.test(e)) return { ok: false, field: "email", error: "Please enter a valid email address, like name@example.com." };
    const r = await api.otpSend(e);
    return r.ok ? { ok: true, resendIn: r.data.resendIn || 30, expiresIn: r.data.expiresIn || 600 } : { ok: false, ...explain(r) };
  }

  // Step 2: checks the code. On success the player is logged in. Progress made as a guest is copied
  // into a profile the first time it is used.
  async function verifyCode(name, email, code) {
    const v = validate(name, email);
    if (v.error) return { ok: false, field: v.field, error: v.error };
    const r = await api.otpVerify(v.email, String(code).trim());
    if (!r.ok) return { ok: false, ...explain(r) };

    const key = await localKey(v.email);
    const saved = readProfile();
    const known = saved && saved.key === key ? saved : null;
    const own = TL.store.dataKey(key);
    if (!get(own) && get(TL.store.KEY)) put(own, get(TL.store.KEY));

    profile = {
      name: v.name, email: v.email, key, token: r.data.token, exp: r.data.exp,
      joined: known ? known.joined : Date.now(), board: known ? known.board !== false : true, removed: known ? !!known.removed : false,
      rank: r.data.me ? { ...r.data.me, ts: Date.now() } : known ? known.rank : null,
    };
    writeProfile();
    put(GUEST_KEY, null);
    TL.store.use(key);
    return { ok: true };
  }

  function logout() {
    profile = null;
    writeProfile();
    put(GUEST_KEY, null);
    TL.store.use("");
  }

  function continueAsGuest() {
    put(GUEST_KEY, "1");
    TL.store.use("");
  }

  const isGuest = () => !profile && get(GUEST_KEY) === "1";
  // True when the visitor must see the login screen before anything else.
  const needsLogin = () => !loggedIn() && !(TL.config.allowGuest && get(GUEST_KEY) === "1");
  const current = () => {
    if (!profile) return null;
    const { token, ...rest } = profile;
    return { ...rest, verified: !!token };
  };
  // The name and email of a profile whose login ran out, so the form can be filled in again.
  const remembered = () => (profile && !profile.token ? { name: profile.name, email: profile.email } : null);
  const firstName = () => (profile ? profile.name.split(" ")[0] : "Guest");
  const initials = () => (profile ? profile.name.split(" ").filter(Boolean).slice(0, 2).map((p) => [...p][0].toUpperCase()).join("") : "?");

  // ---- server ----------------------------------------------------------------------------------

  // The token stopped working (it expired). The player stays where they are and is told, instead of being thrown out mid-run.
  function lostLogin() {
    if (!profile || !profile.token) return;
    profile.token = null;
    writeProfile();
    if (lostHandler) lostHandler();
  }

  async function runSync(force) {
    if (!loggedIn()) return { ok: false, skipped: true };
    if (profile.removed && !force) return { ok: false, skipped: true };
    const wait = lastSyncAt + MIN_SYNC_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSyncAt = Date.now();
    const r = await api.sync({
      name: profile.name, visible: profile.board !== false,
      stats: TL.rank.syncStats(TL.store.load(), Date.now()),
    });
    if (r.ok) {
      if (r.data.token) { profile.token = r.data.token; profile.exp = r.data.exp; }
      profile.rank = r.data.me ? { ...r.data.me, week: r.data.meWeek, ts: Date.now() } : null;
      writeProfile();
    } else if (r.status === 401) lostLogin();
    return r;
  }

  // Sends this player's numbers. Updates run one after another with a pause between them, so two
  // requests close together never trip the server's rate limit.
  // `force` sends even after the player removed themselves (a certificate needs a record on the
  // server; the record stays hidden because the player has switched the leaderboard off).
  function sync(force) {
    const run = () => runSync(force);
    syncChain = syncChain.then(run, run);
    return syncChain;
  }

  // Resolves once every update that is queued right now has been sent.
  const settled = () => syncChain.then(() => undefined, () => undefined);

  // Waits a moment so several finishes close together make one request.
  function syncSoon(ms = 1500) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, ms);
  }

  async function board(scope) {
    const r = await api.board(scope);
    if (!r.ok && r.status === 401) lostLogin();
    return r;
  }

  // Deletes the player's entry on the server and stops sending numbers until they switch the leaderboard on again.
  async function removeFromBoard() {
    if (!loggedIn()) return { ok: false, skipped: true };
    const r = await api.remove();
    if (r.ok) { profile.rank = null; profile.board = false; profile.removed = true; writeProfile(); }
    else if (r.status === 401) lostLogin();
    return r;
  }

  async function setBoardVisible(visible) {
    if (!profile) return;
    profile.board = !!visible;
    if (visible) profile.removed = false;
    writeProfile();
    await sync();
  }

  // The speed and accuracy printed on a certificate: the best ranked run, or the best lesson if there is none yet.
  function certificateFacts() {
    const st = TL.store.load();
    const s = TL.rank.syncStats(st, Date.now());
    const lessons = Object.values(st.course);
    return {
      wpm: Math.round(s.best || Math.max(0, ...lessons.map((c) => c.wpm))),
      acc: Math.round(s.acc || Math.max(0, ...lessons.map((c) => c.acc))),
    };
  }

  // Gets a certificate for a tier. The server signs it when it can; otherwise it is made on this
  // device and marked "not verified". Returns { ok, code, signed } or { ok: false, error }.
  async function issueCertificate(tier) {
    if (!loggedIn()) return { ok: false, error: "login" };
    const need = TL.certificate.TIERS[tier];
    const run = TL.rank.lessonRun(TL.store.load().course);
    if (!need || run < need.lessons) return { ok: false, error: "not-eligible" };
    const facts = certificateFacts();

    let signed = null;
    const s = await sync(true);
    if (s.ok) {
      const r = await api.certificate({ tier, name: profile.name, wpm: facts.wpm, acc: facts.acc });
      if (r.ok) signed = r.data.code;
    }
    let code = signed;
    if (!code) {
      const iso = new Date().toISOString().slice(0, 10);
      const serial = (tier === "core" ? profile.key.slice(0, 8) : profile.key.slice(8, 16)).toUpperCase();
      code = TL.certificate.localCode({ v: 1, n: profile.name, t: tier, w: facts.wpm, a: facts.acc, d: iso, i: `TL-${serial.slice(0, 4)}-${serial.slice(4, 8)}` });
    }
    const st = TL.store.load();
    st.certs[tier] = { code, ts: Date.now() };
    TL.store.save();
    return { ok: true, code, signed: !!signed };
  }

  root.addEventListener("online", () => syncSoon(500));

  TL.account = {
    api, init, validate, requestCode, verifyCode, logout, continueAsGuest, loggedIn, isGuest, needsLogin, current, remembered,
    firstName, initials, sync, syncSoon, settled, board, removeFromBoard, setBoardVisible, issueCertificate, certificateFacts,
    onLost: (fn) => { lostHandler = fn; },
  };
})(window);
