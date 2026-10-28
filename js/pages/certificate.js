/* TypeLab page: a certificate. The link #/certificate/<code> works for anyone, logged in or not:
   it shows the certificate, asks the server whether it is genuine, and invites the visitor to try
   TypeLab themselves. The owner can also download it, print it and share it. */
(function (root) {
  "use strict";

  const TL = root.TL;
  const { h } = TL.ui;
  const C = TL.certificate;

  // Draws the certificate picture onto a canvas twice as large as its size and returns a PNG.
  async function toPng(svgText) {
    const img = new Image();
    img.src = C.dataUrl(svgText);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1700;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
  }

  function mount(main, parts) {
    const decoded = C.decode(parts[0]);
    if (!decoded) {
      main.append(h("div", { class: "page-head" },
        h("h1", null, "This certificate link is not valid"),
        h("p", { class: "lead" }, "The link may have been cut short when it was copied. Ask for the link again, or start practising and earn your own."),
        h("p", null, h("a", { class: "btn primary", href: "#/" }, "Go to TypeLab"))));
      return () => {};
    }

    const { cert, signed } = decoded;
    const tier = C.TIERS[cert.t];
    const code = parts[0];
    const url = C.pageUrl(TL.config.url(), code);
    const svg = C.svg(cert, TL.config.url());
    const mine = TL.account.loggedIn() && TL.store.load().certs[cert.t] && TL.store.load().certs[cert.t].code === code;
    const status = h("p", { class: "muted", role: "status" });

    // The verification line: asks the server whether the signature is genuine.
    const verify = h("p", { class: "verify" }, signed ? "Checking with TypeLab..." : "Not verified: this certificate was made while offline.");
    if (!signed) verify.classList.add("warn");
    else {
      TL.account.api.verify(code).then((r) => {
        if (!verify.isConnected) return;
        verify.classList.remove("warn", "good", "bad");
        if (r.ok && r.data.valid) { verify.classList.add("good"); verify.textContent = "✓ Verified by TypeLab: this certificate is genuine."; }
        else if (r.ok) { verify.classList.add("bad"); verify.textContent = "✕ Not verified: this certificate could not be confirmed. It may have been changed."; }
        else { verify.classList.add("warn"); verify.textContent = "Could not check this certificate right now. It looks valid, but it is not verified."; }
      });
    }

    async function pngBlob() { return toPng(svg); }

    async function download() {
      try {
        const blob = await pngBlob();
        const objectUrl = URL.createObjectURL(blob);
        const a = h("a", { href: objectUrl, download: `typelab-certificate-${cert.i}.png` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        status.textContent = "Certificate image downloaded.";
      } catch (e) { status.textContent = "Sorry, the image could not be made in this browser. Try Print and save as PDF instead."; }
    }

    async function share() {
      const text = C.shareText(cert);
      try {
        const blob = await pngBlob();
        const file = new File([blob], `typelab-certificate-${cert.i}.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: `TypeLab: ${tier.title}`, text, url, files: [file] }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      if (navigator.share) { try { await navigator.share({ title: `TypeLab: ${tier.title}`, text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      status.textContent = "Sharing from the browser is not available here. Use one of the buttons below, or copy the link.";
    }

    const linkInput = h("input", { type: "text", readonly: "", value: url, "aria-label": "Link to this certificate", onfocus: (e) => e.target.select() });
    async function copy() {
      try { await navigator.clipboard.writeText(url); status.textContent = "Link copied."; }
      catch (e) { linkInput.focus(); linkInput.select(); status.textContent = "Press Ctrl+C to copy the link."; }
    }

    async function reissue() {
      status.textContent = "Getting a verified copy...";
      const r = await TL.account.issueCertificate(cert.t);
      if (r.ok && r.signed) location.hash = "#/certificate/" + r.code;
      else status.textContent = "The server could not verify it right now. Please try again when you are online.";
    }

    main.append(
      h("div", { class: "page-head" },
        h("h1", null, mine ? "Your certificate" : `${cert.n.split(" ")[0]}'s certificate`),
        h("p", { class: "lead" }, mine
          ? "Download it, print it, or share the link. Anyone who opens the link can see it and check that it is genuine."
          : `${cert.n} earned the TypeLab "${tier.title}" certificate. This page checks that it is genuine.`)),
      verify,
      h("figure", { class: "cert-figure" },
        h("img", { class: "cert-img", src: C.dataUrl(svg), alt: `${tier.title} certificate for ${cert.n}: ${cert.w} words per minute at ${cert.a} percent accuracy, issued ${C.longDate(cert.d)}, certificate ${cert.i}.` })),
      h("div", { class: "row-actions" },
        h("button", { class: "btn primary", type: "button", onclick: download }, "Download image"),
        navigator.share ? h("button", { class: "btn", type: "button", onclick: share }, "Share...") : null,
        h("button", { class: "btn", type: "button", onclick: () => root.print() }, "Print or save as PDF"),
        mine && !signed ? h("button", { class: "btn", type: "button", onclick: reissue }, "Get a verified copy") : null),
      status,
      h("section", { class: "card share-card" },
        h("h3", { class: "sub" }, "Share it"),
        h("div", { class: "copy-row" }, linkInput, h("button", { class: "btn", type: "button", onclick: copy }, "Copy link")),
        h("ul", { class: "share-links" }, ...C.shareLinks(url, cert).map((l) =>
          h("li", null, h("a", { class: "btn", href: l.href, target: "_blank", rel: "noopener noreferrer" }, l.name))))),
      mine ? null : h("section", { class: "card cta-card" },
        h("h3", null, "Want one with your name on it?"),
        h("p", null, "TypeLab is free. Practise with levels that unlock while you type, take the course from the home row to every programming symbol, and earn your own certificate."),
        h("div", { class: "cta" },
          h("a", { class: "btn primary big", href: "#/" }, TL.account.loggedIn() ? "Go to my practice" : "Start free"),
          h("a", { class: "btn big", href: "#/stats" }, "See the leaderboard"))));
    return () => {};
  }

  TL.pages = TL.pages || {};
  TL.pages.certificate = { title: "Certificate", mount };
})(window);
