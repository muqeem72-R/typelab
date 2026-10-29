/* TypeLab page: log in or create an account.
     1. email      the address, and whether to stay logged in on this device
     2. code       the 6-digit code that was emailed, which proves the email is really yours
     3. account    only for somebody new: first name, last name (optional), photo (optional), country, state
     4. welcome    the new user ID (such as mukeem-001A)
   Somebody who already has an account goes from step 2 straight into the app. There is no password. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  const mask = (email) => email.replace(/^(.{2}).*(@.*)$/, "$1***$2");

  function mount(main) {
    const acct = TL.account;
    if (acct.loggedIn() && !acct.needsAccount()) { location.hash = "#/"; return () => {}; }

    const remembered = acct.remembered();
    // Somebody who verified an email (or logged in before accounts existed) only has the account step left.
    let step = acct.needsAccount() ? "account" : "email";
    let pending = { email: remembered ? remembered.email : acct.needsAccount() ? acct.current().email : "", remember: false };
    let created = null;
    let countdown = null;
    let alive = true;

    // Goes into the app and reloads, so every part of the page picks up the new profile's data.
    const enter = () => { location.hash = "#/"; location.reload(); };

    const card = h("div", { class: "card login-card" });
    const perk = (title, text) => h("li", null, h("strong", null, title), h("span", null, text));

    // ---- step 1: the email -----------------------------------------------------------------------
    function emailStep() {
      const email = h("input", { id: "l-email", type: "email", autocomplete: "email", placeholder: "you@example.com", value: pending.email, "aria-describedby": "l-email-err" });
      const emailErr = h("p", { class: "form-error", id: "l-email-err", role: "alert" });
      const status = h("p", { class: "muted", role: "status" });
      const keep = h("input", { id: "l-keep", type: "checkbox", checked: pending.remember ? "" : null });
      const submit = h("button", { class: "btn primary big", type: "submit" }, "Send me a code");

      async function onSubmit(e) {
        e.preventDefault();
        emailErr.textContent = "";
        email.removeAttribute("aria-invalid");
        const v = acct.validateEmail(email.value);
        if (v.error) { emailErr.textContent = v.error; email.setAttribute("aria-invalid", "true"); email.focus(); return; }
        submit.disabled = true;
        status.textContent = "Sending the code...";
        const r = await acct.requestCode(v.email);
        if (!r.ok) {
          submit.disabled = false;
          status.textContent = "";
          emailErr.textContent = r.error;
          if (r.field === "email") email.setAttribute("aria-invalid", "true");
          return;
        }
        pending = { email: v.email, resendIn: r.resendIn, remember: keep.checked };
        step = "code";
        draw();
      }

      card.textContent = "";
      card.append(h("form", { novalidate: "", onsubmit: onSubmit, "aria-label": "Log in or create an account" },
        h("h2", null, "Log in or create an account"),
        remembered ? h("p", { class: "banner warn" }, h("span", { class: "banner-i", "aria-hidden": "true" }, "!"),
          h("span", null, remembered.endedWithBrowser
            ? "You were logged out when the browser was closed. Log in again; your progress is still here. (Tick \"Keep me logged in\" to stay logged in next time.)"
            : "Your login ran out. Please log in again; your progress is still here.")) : null,
        h("div", { class: "field-stack" }, h("label", { for: "l-email" }, "Your email"), email, emailErr),
        h("label", { class: "check keep", for: "l-keep" }, keep, "Keep me logged in on this device",
          h("span", { class: "hint" }, "Leave this off on a shared computer: you are then logged out when you close the browser.")),
        submit, status,
        h("p", { class: "fine" },
          "We email you a 6-digit code to check that the address is yours. There is no password to remember. " +
          "If you are new, you will then set up your account: your name, where you are from and, if you like, a photo. " +
          "The server keeps only a scrambled (hashed) copy of your email, never the address itself. " +
          "Others on the leaderboard see just your first name and the first letter of your last name, like \"Mukeem K.\", your country and your speed. " +
          "TypeLab also saves your results, how long you spend on the site and how long you really type, and the owner of the site can see these numbers to learn how people use it. " +
          "You can hide yourself or delete your entry (and these numbers with it) any time in Settings."),
        TL.config.allowGuest
          ? h("p", { class: "guest" }, h("button", { class: "link-btn", type: "button", onclick: () => { acct.continueAsGuest(); enter(); } }, "Continue as a guest"), " (no rank, no certificate)")
          : null));
      email.focus();
    }

    // ---- step 2: the code ------------------------------------------------------------------------
    function codeStep() {
      const code = h("input", {
        id: "l-code", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "6", autocomplete: "one-time-code",
        placeholder: "123456", "aria-describedby": "l-code-err", class: "code-input",
      });
      const codeErr = h("p", { class: "form-error", id: "l-code-err", role: "alert" });
      const status = h("p", { class: "muted", role: "status" });
      const submit = h("button", { class: "btn primary big", type: "submit" }, "Verify and continue");
      const resend = h("button", { class: "btn", type: "button" });
      let left = pending.resendIn || 30;

      function tick() {
        if (left > 0) { resend.disabled = true; resend.textContent = `Send a new code in ${left} s`; left--; }
        else { resend.disabled = false; resend.textContent = "Send a new code"; clearInterval(countdown); }
      }
      clearInterval(countdown);
      countdown = setInterval(tick, 1000);
      tick();

      async function check() {
        codeErr.textContent = "";
        code.removeAttribute("aria-invalid");
        if (!/^\d{6}$/.test(code.value)) { codeErr.textContent = "Enter the 6 digits from the email."; code.setAttribute("aria-invalid", "true"); code.focus(); return; }
        submit.disabled = true;
        status.textContent = "Checking the code...";
        const r = await acct.verifyCode(pending.email, code.value, { remember: !!pending.remember });
        if (!r.ok) {
          submit.disabled = false;
          status.textContent = "";
          codeErr.textContent = r.error;
          code.setAttribute("aria-invalid", "true");
          code.value = "";
          code.focus();
          return;
        }
        clearInterval(countdown);
        if (r.hasAccount) {   // somebody who has been here before goes straight in
          status.textContent = "Welcome back, " + acct.firstName() + "!";
          setTimeout(enter, 250);
        } else { step = "account"; draw(); }
      }

      resend.addEventListener("click", async () => {
        resend.disabled = true;
        status.textContent = "Sending a new code...";
        const r = await acct.requestCode(pending.email);
        if (r.ok) { left = r.resendIn; status.textContent = "A new code is on its way."; countdown = setInterval(tick, 1000); tick(); }
        else { status.textContent = ""; codeErr.textContent = r.error; left = r.retryAfter ? Math.min(r.retryAfter, 3600) : 30; countdown = setInterval(tick, 1000); tick(); }
      });
      code.addEventListener("input", () => {
        code.value = code.value.replace(/\D/g, "").slice(0, 6);
        if (code.value.length === 6) check();
      });

      card.textContent = "";
      card.append(h("form", { novalidate: "", onsubmit: (e) => { e.preventDefault(); check(); }, "aria-label": "Enter your code" },
        h("h2", null, "Check your email"),
        h("p", null, "We sent a 6-digit code to ", h("strong", null, mask(pending.email)), ". It works for 10 minutes."),
        h("p", { class: "muted fine" }, "It can take a minute. If you cannot see it, look in your spam or junk folder."),
        h("div", { class: "field-stack" }, h("label", { for: "l-code" }, "Your 6-digit code"), code, codeErr),
        submit, status,
        h("div", { class: "row-actions tight" }, resend,
          h("button", { class: "link-btn", type: "button", onclick: () => { clearInterval(countdown); step = "email"; draw(); } }, "Use a different email"))));
      code.focus();
    }

    // ---- step 3: the account ------------------------------------------------------------------------
    function accountStep() {
      const legacy = !!acct.current().name && !(acct.current().account);   // logged in before accounts existed
      card.textContent = "";
      card.append(h("h2", null, "Checking your account..."), h("p", { class: "muted", role: "status" }, "One moment."));

      acct.fetchAccount().then((existing) => {   // it may already have been made, on another device
        if (!alive) return;
        if (existing) { created = existing; step = "welcome"; draw(); return; }
        const cur = acct.current();
        const words = (cur.name || "").split(" ").filter(Boolean);
        const initial = { first: words[0] || "", last: words.slice(1).join(" ").slice(0, 24), country: "", state: "", photo: "" };
        const form = TL.ui.accountForm.form({
          initial, submitLabel: "Create my account",
          note: h("p", { class: "muted fine" }, "Your email stays private: others never see it. Your first name and the first letter of your last name appear on the leaderboard with your country and your speed, and nothing else."),
          onSubmit: async (details) => {
            const r = await acct.createAccount(details);
            if (r.ok) { created = r.account; step = "welcome"; draw(); }
            return r;
          },
        });
        card.textContent = "";
        card.append(h("div", { class: "account-card" },
          h("h2", null, legacy ? "Complete your account" : "Create your account"),
          h("p", null, legacy
            ? "TypeLab now keeps a few details with every account. Your progress and rank are safe. This takes a moment."
            : "Your email is verified. Tell us a little about yourself."),
          form,
          h("p", { class: "guest" }, h("button", { class: "link-btn", type: "button", onclick: () => { acct.logout(); pending = { email: "", remember: false }; step = "email"; draw(); } }, "Log out / use a different email"))));
        form.focusFirst();
      });
    }

    // ---- step 4: the welcome, with the new user ID -------------------------------------------------------
    function welcomeStep() {
      card.textContent = "";
      card.append(h("div", { class: "welcome-card" },
        TL.ui.avatar(created, true),
        h("h2", null, "Welcome, " + created.first + "!"),
        h("p", null, "Your account is ready. Your user ID is"),
        h("p", { class: "uid-big", id: "new-uid" }, created.uid),
        h("p", { class: "muted fine" }, "It is yours for good and does not change, even if you change your name. It is the name shown at the top of every page."),
        h("button", { class: "btn primary big", type: "button", id: "l-start", onclick: enter }, "Start typing")));
      card.querySelector("#l-start").focus();
    }

    function draw() {
      if (step === "code") codeStep();
      else if (step === "account") accountStep();
      else if (step === "welcome") welcomeStep();
      else emailStep();
    }

    main.append(h("div", { class: "login" },
      h("section", { class: "login-intro" },
        h("h1", null, "Learn to touch type, and see how you rank."),
        h("p", { class: "lead" }, "Create a free account to keep your progress, climb the leaderboard and earn a certificate you can share."),
        h("p", { class: "muted" }, "TypeLab is a free touch typing trainer: endless practice that levels up as you type, a 24-lesson course from the home row to every programming symbol, speed tests, and certificates."),
        h("ul", { class: "perks" },
          perk("Practice that never stops", "Level up while you type. No pop-ups, no waiting."),
          perk("A real leaderboard", "See your rank among other typists, this week and all time."),
          perk("A shareable certificate", "Finish the course and show it on LinkedIn, WhatsApp or anywhere."),
          perk("Free, and your email stays private", "A code sent to your email proves it is you. Nobody else ever sees your address."))),
      card));
    draw();
    return () => { alive = false; clearInterval(countdown); };
  }

  TL.pages = TL.pages || {};
  // the first page anyone sees, so it is titled like the site, not like a form
  TL.pages.login = { title: "Log in", fullTitle: "TypeLab: free touch typing practice, course and certificate", mount };
})(window);
