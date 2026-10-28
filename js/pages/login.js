/* TypeLab page: login. Two steps. First a name and an email; then the 6-digit code that was emailed,
   which proves the email is really yours. There is no password. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;

  const mask = (email) => email.replace(/^(.{2}).*(@.*)$/, "$1***$2");

  function mount(main) {
    const acct = TL.account;
    if (acct.loggedIn()) { location.hash = "#/"; return () => {}; }

    const remembered = acct.remembered();
    let step = "details";
    let pending = { name: remembered ? remembered.name : "", email: remembered ? remembered.email : "" };
    let countdown = null;

    // Goes into the app and reloads, so every part of the page picks up the new profile's data.
    const enter = () => { location.hash = "#/"; location.reload(); };

    const card = h("div", { class: "card login-card" });

    const perk = (title, text) => h("li", null, h("strong", null, title), h("span", null, text));

    // ---- step 1: name and email -----------------------------------------------------------------
    function detailsStep() {
      const name = h("input", { id: "l-name", type: "text", autocomplete: "name", maxlength: "24", placeholder: "Your name", value: pending.name, "aria-describedby": "l-name-err" });
      const email = h("input", { id: "l-email", type: "email", autocomplete: "email", placeholder: "you@example.com", value: pending.email, "aria-describedby": "l-email-err" });
      const nameErr = h("p", { class: "form-error", id: "l-name-err", role: "alert" });
      const emailErr = h("p", { class: "form-error", id: "l-email-err", role: "alert" });
      const status = h("p", { class: "muted", role: "status" });
      const submit = h("button", { class: "btn primary big", type: "submit" }, "Send me a code");

      async function onSubmit(e) {
        e.preventDefault();
        for (const [input, out] of [[name, nameErr], [email, emailErr]]) { out.textContent = ""; input.removeAttribute("aria-invalid"); }
        const v = acct.validate(name.value, email.value);
        if (v.error) {
          const [input, out] = v.field === "name" ? [name, nameErr] : [email, emailErr];
          out.textContent = v.error;
          input.setAttribute("aria-invalid", "true");
          input.focus();
          return;
        }
        submit.disabled = true;
        status.textContent = "Sending the code...";
        const r = await acct.requestCode(v.email);
        if (!r.ok) {
          submit.disabled = false;
          status.textContent = "";
          (r.field === "email" ? emailErr : nameErr).textContent = r.error;
          if (r.field === "email") email.setAttribute("aria-invalid", "true");
          return;
        }
        pending = { name: v.name, email: v.email, resendIn: r.resendIn };
        step = "code";
        draw();
      }

      card.textContent = "";
      card.append(h("form", { novalidate: "", onsubmit: onSubmit, "aria-label": "Log in" },
        h("h2", null, "Log in"),
        remembered ? h("p", { class: "banner warn" }, h("span", { class: "banner-i", "aria-hidden": "true" }, "!"), h("span", null, "Your login ran out. Please log in again; your progress is still here.")) : null,
        h("div", { class: "field-stack" }, h("label", { for: "l-name" }, "Your name"), name, nameErr),
        h("div", { class: "field-stack" }, h("label", { for: "l-email" }, "Your email"), email, emailErr),
        submit, status,
        h("p", { class: "fine" },
          "We email you a 6-digit code to check that the address is yours. There is no password to remember. " +
          "The server keeps only a scrambled (hashed) copy of your email, never the address itself. " +
          "Others see just your first name and the first letter of your last name, like \"Mukeem K.\", and your speed. " +
          "TypeLab also saves your results, how long you spend on the site and how long you really type, and the owner of the site can see these numbers to learn how people use it. " +
          "You can hide yourself or delete your entry (and these numbers with it) any time in Settings."),
        TL.config.allowGuest
          ? h("p", { class: "guest" }, h("button", { class: "link-btn", type: "button", onclick: () => { acct.continueAsGuest(); enter(); } }, "Continue as a guest"), " (no rank, no certificate)")
          : null));
      (pending.name ? email : name).focus();
    }

    // ---- step 2: the code ------------------------------------------------------------------------
    function codeStep() {
      const code = h("input", {
        id: "l-code", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "6", autocomplete: "one-time-code",
        placeholder: "123456", "aria-describedby": "l-code-err", class: "code-input",
      });
      const codeErr = h("p", { class: "form-error", id: "l-code-err", role: "alert" });
      const status = h("p", { class: "muted", role: "status" });
      const submit = h("button", { class: "btn primary big", type: "submit" }, "Verify and log in");
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
        const r = await acct.verifyCode(pending.name, pending.email, code.value);
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
        status.textContent = "Welcome, " + pending.name.split(" ")[0] + "!";
        setTimeout(enter, 250);
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
          h("button", { class: "link-btn", type: "button", onclick: () => { clearInterval(countdown); step = "details"; draw(); } }, "Use a different email"))));
      code.focus();
    }

    function draw() {
      if (step === "code") codeStep();
      else detailsStep();
    }

    main.append(h("div", { class: "login" },
      h("section", { class: "login-intro" },
        h("h1", null, "Learn to touch type, and see how you rank."),
        h("p", { class: "lead" }, "Log in to keep your progress, climb the leaderboard and earn a certificate you can share."),
        h("ul", { class: "perks" },
          perk("Practice that never stops", "Level up while you type. No pop-ups, no waiting."),
          perk("A real leaderboard", "See your rank among other typists, this week and all time."),
          perk("A shareable certificate", "Finish the course and show it on LinkedIn, WhatsApp or anywhere."),
          perk("Free, and your email stays private", "A code sent to your email proves it is you. Nobody else ever sees your address."))),
      card));
    draw();
    return () => clearInterval(countdown);
  }

  TL.pages = TL.pages || {};
  TL.pages.login = { title: "Log in", mount };
})(window);
