/* TypeLab account form: the details of an account (first name, last name, photo, country, state), used when an account
   is created and again in Settings to change it. Also the avatar, which shows the photo when there is one and the
   initials when there is not. Nothing here talks to the server: the page passes in what to do with the answer. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;
  const PART_RE = /^[\p{L}\p{M}\p{N} ._'-]{1,24}$/u;
  const PHOTO_SIDE = 160;
  const PHOTO_MAX_CHARS = 40000;      // the server accepts up to 45000
  const FILE_MAX_BYTES = 12 * 1024 * 1024;
  const OTHER = "__other__";

  const clean = (s) => String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();
  const initialsOf = (first, last) => [first, last].map((p) => clean(p)).filter(Boolean).map((p) => [...p][0].toUpperCase()).join("") || "?";

  // A round picture: the photo, or the initials on the accent colour. `account` is { first, last, photo } (or { initials }).
  function avatar(account, big) {
    const a = account || {};
    const el = h("span", { class: "avatar" + (big ? " big" : "") + (a.photo ? " has-photo" : ""), "aria-hidden": "true" });
    if (a.photo && /^data:image\/jpeg;base64,/.test(a.photo)) el.append(h("img", { src: a.photo, alt: "", width: big ? 52 : 30, height: big ? 52 : 30 }));
    else el.append(a.initials || initialsOf(a.first, a.last));
    return el;
  }

  // Turns a picture file into a small square JPEG (a data: address), centred and cropped. Rejects what is not a picture.
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("That file is not a picture."));
      if (file.size > FILE_MAX_BYTES) return reject(new Error("That picture is too big. Please choose one under 12 MB."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The picture could not be read."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That picture could not be opened. Try a JPG or PNG."));
        img.onload = () => {
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          if (!side) return reject(new Error("That picture is empty."));
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          for (const [size, quality] of [[PHOTO_SIDE, 0.86], [PHOTO_SIDE, 0.7], [128, 0.65], [96, 0.6]]) {
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";   // a transparent PNG becomes white, not black
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
            const url = canvas.toDataURL("image/jpeg", quality);
            if (url.length <= PHOTO_MAX_CHARS) return resolve(url);
          }
          reject(new Error("That picture could not be made small enough. Try another."));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // initial: { first, last, country, state, photo }. onSubmit(details) returns a promise of { ok, error, field }.
  // Returns the form element.
  function form({ initial = {}, submitLabel = "Save", onSubmit, onCancel = null, note = null }) {
    const state = { photo: initial.photo || "", country: initial.country || "", state: initial.state || "" };
    const places = TL.data.places;

    const first = h("input", { id: "af-first", type: "text", autocomplete: "given-name", maxlength: "24", value: initial.first || "", "aria-describedby": "af-first-err" });
    const last = h("input", { id: "af-last", type: "text", autocomplete: "family-name", maxlength: "24", value: initial.last || "", "aria-describedby": "af-last-err" });
    const country = h("select", { id: "af-country", autocomplete: "country-name", "aria-describedby": "af-country-err" },
      h("option", { value: "" }, "Choose your country"), ...places.COUNTRIES.map((c) => h("option", { value: c }, c)));
    country.value = state.country;
    const stateHolder = h("div", { class: "af-state" });
    const errors = {};
    const err = (key) => (errors[key] = h("p", { class: "form-error", id: `af-${key}-err`, role: "alert" }));
    const status = h("p", { class: "muted", role: "status" });
    const submit = h("button", { class: "btn primary big", type: "submit" }, submitLabel);

    // ---- the photo ----
    const preview = h("span", { class: "af-preview" });
    const fileInput = h("input", { id: "af-photo", type: "file", accept: "image/*", class: "sr-only" });
    const photoErr = h("p", { class: "form-error", id: "af-photo-err", role: "alert" });
    const removeBtn = h("button", { class: "btn small", type: "button", onclick: () => { state.photo = ""; fileInput.value = ""; drawPhoto(); } }, "Remove");
    function drawPhoto() {
      preview.textContent = "";
      preview.append(avatar({ first: first.value, last: last.value, photo: state.photo }, true));
      removeBtn.hidden = !state.photo;
    }
    fileInput.addEventListener("change", async () => {
      photoErr.textContent = "";
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try { state.photo = await readPhoto(file); } catch (e) { photoErr.textContent = e.message; fileInput.value = ""; }
      drawPhoto();
    });
    first.addEventListener("input", () => { if (!state.photo) drawPhoto(); });
    last.addEventListener("input", () => { if (!state.photo) drawPhoto(); });

    // ---- the state: a list when we have one for the country, a box otherwise ----
    let stateInput = null;
    let stateSelect = null;
    function drawState() {
      stateHolder.textContent = "";
      const list = places.statesOf(country.value);
      stateInput = null;
      stateSelect = null;
      if (!country.value) {
        stateHolder.append(h("input", { id: "af-state", type: "text", disabled: "", placeholder: "Choose a country first", "aria-describedby": "af-state-err" }));
        return;
      }
      if (list) {
        stateSelect = h("select", { id: "af-state", "aria-describedby": "af-state-err" },
          h("option", { value: "" }, "Choose your state or region"), ...list.map((s) => h("option", { value: s }, s)), h("option", { value: OTHER }, "Other (type it)"));
        const known = list.includes(state.state);
        stateSelect.value = known ? state.state : state.state ? OTHER : "";
        stateHolder.append(stateSelect);
        const showBox = () => {
          const other = stateSelect.value === OTHER;
          if (other && !stateInput) {
            stateInput = h("input", { id: "af-state-other", type: "text", maxlength: "60", placeholder: "Your state, province or region", value: known ? "" : state.state, "aria-label": "Your state, province or region" });
            stateHolder.append(stateInput);
          } else if (!other && stateInput) { stateInput.remove(); stateInput = null; }
        };
        stateSelect.addEventListener("change", showBox);
        showBox();
      } else {
        stateInput = h("input", { id: "af-state", type: "text", maxlength: "60", autocomplete: "address-level1", placeholder: "State, province or region", value: state.state, "aria-describedby": "af-state-err" });
        stateHolder.append(stateInput);
      }
    }
    country.addEventListener("change", () => { state.country = country.value; state.state = ""; drawState(); });
    const stateValue = () => clean(stateSelect && stateSelect.value !== OTHER ? stateSelect.value : stateInput ? stateInput.value : "");

    drawState();
    drawPhoto();

    function check() {
      for (const e of Object.values(errors)) e.textContent = "";
      const f = clean(first.value);
      const l = clean(last.value);
      const s = stateValue();
      let bad = null;
      const fail = (key, message, el) => { errors[key].textContent = message; if (!bad) bad = el; };
      if (!PART_RE.test(f)) fail("first", f ? "Use up to 24 letters or numbers (spaces, dots, hyphens and apostrophes are fine)." : "Please enter your first name.", first);
      if (l && !PART_RE.test(l)) fail("last", "Use up to 24 letters or numbers, or leave it empty.", last);
      if (!country.value) fail("country", "Please choose your country.", country);
      if (country.value && (s.length < 2 || !/^[\p{L}\p{M}\p{N} .,'()&-]{2,60}$/u.test(s))) fail("state", "Please choose or type your state or region.", stateSelect || stateInput);
      if (bad) { if (bad.focus) bad.focus(); return null; }
      return { first: f, last: l, country: country.value, state: s, photo: state.photo };
    }

    const el = h("form", { class: "account-form", novalidate: "", "aria-label": submitLabel },
      h("div", { class: "af-photo" }, preview,
        h("div", { class: "af-photo-side" },
          h("strong", null, "Photo ", h("span", { class: "muted" }, "(optional)")),
          h("p", { class: "muted fine" }, "Only you see it. It is made small and stored with your account."),
          h("div", { class: "row-actions tight" }, h("label", { class: "btn small", for: "af-photo" }, state.photo ? "Change photo" : "Choose a photo"), fileInput, removeBtn),
          photoErr)),
      h("div", { class: "af-row" },
        h("div", { class: "field-stack" }, h("label", { for: "af-first" }, "First name"), first, err("first")),
        h("div", { class: "field-stack" }, h("label", { for: "af-last" }, "Last name ", h("span", { class: "muted" }, "(optional)")), last, err("last"))),
      h("div", { class: "af-row" },
        h("div", { class: "field-stack" }, h("label", { for: "af-country" }, "Country"), country, err("country")),
        h("div", { class: "field-stack" }, h("label", { for: "af-state" }, "State or region"), stateHolder, err("state"))),
      note,
      h("div", { class: "row-actions" }, submit, onCancel ? h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel") : null),
      status);

    el.addEventListener("submit", async (e) => {
      e.preventDefault();
      const details = check();
      if (!details) return;
      submit.disabled = true;
      status.textContent = "Saving...";
      const r = await onSubmit(details);
      submit.disabled = false;
      status.textContent = "";
      if (r && !r.ok) {
        const key = { first: "first", last: "last", country: "country", state: "state", photo: "photo" }[r.field];
        if (key === "photo") photoErr.textContent = r.error;
        else if (key && errors[key]) errors[key].textContent = r.error;
        else status.textContent = r.error || "Something went wrong. Please try again.";
      } else if (r && r.message) status.textContent = r.message;
    });
    el.focusFirst = () => first.focus();
    return el;
  }

  TL.ui.avatar = avatar;
  TL.ui.initialsOf = initialsOf;
  TL.ui.accountForm = { form, readPhoto };
})(window);
