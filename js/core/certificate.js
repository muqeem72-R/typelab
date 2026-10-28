/* TypeLab certificates: what a certificate says, how its shareable code is written and read, the
   picture itself (one SVG, used on the page, for the PNG download and for printing) and the share links.

   A certificate code looks like  <payload>.<signature>.  The payload is the certificate's facts as
   base64url JSON. The server signs it, so the certificate page can ask the server whether the
   signature is genuine (see server/core.mjs). A certificate made offline ends in ".local" and is
   shown as "not verified". Pure functions, so the Node tests can run them. */
(function (root) {
  "use strict";

  const TIERS = {
    core: {
      id: "core", title: "Touch Typing", short: "Touch typist", lessons: 18, accent: "#4f46e5",
      lines: ["has completed all 18 lessons of the TypeLab touch-typing course,", "from the home row to full sentences."],
    },
    programmer: {
      id: "programmer", title: "Touch Typing for Programmers", short: "Programmer typist", lessons: 24, accent: "#0f766e",
      lines: ["has completed all 24 lessons of the TypeLab course, including", "every symbol, bracket and operator programmers use."],
    },
  };

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const b64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const unb64 = (text) => {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Which certificates the course progress allows. course is the saved { lessonId: { stars } } map.
  function status(course, lessonRun) {
    const run = lessonRun(course);
    return Object.values(TIERS).map((t) => ({ ...t, passed: Math.min(run, t.lessons), done: run >= t.lessons }));
  }

  // A certificate that was not signed by the server (the app was offline when it was made).
  function localCode(cert) {
    return b64(JSON.stringify(cert)) + ".local";
  }

  // Reads and checks a code. Returns { cert, signed } or null when it is not a certificate.
  function decode(code) {
    if (typeof code !== "string" || code.length > 2000) return null;
    const dot = code.lastIndexOf(".");
    if (dot < 1) return null;
    try {
      const cert = JSON.parse(unb64(code.slice(0, dot)));
      const ok = cert && cert.v === 1 && Object.prototype.hasOwnProperty.call(TIERS, cert.t) &&
        typeof cert.n === "string" && cert.n.length >= 2 && cert.n.length <= 24 &&
        Number.isFinite(cert.w) && cert.w >= 0 && cert.w <= 250 && Number.isFinite(cert.a) && cert.a >= 0 && cert.a <= 100 &&
        /^\d{4}-\d{2}-\d{2}$/.test(cert.d) && typeof cert.i === "string" && /^[A-Z0-9-]{3,16}$/.test(cert.i);
      return ok ? { cert, signature: code.slice(dot + 1), signed: code.slice(dot + 1) !== "local" } : null;
    } catch (e) {
      return null;
    }
  }

  const longDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

  // The certificate as an SVG document (1200 x 850). `site` is the address shown at the bottom.
  function svg(cert, site) {
    const tier = TIERS[cert.t];
    const a = tier.accent;
    const name = esc(cert.n);
    const host = esc(String(site || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""));
    const stat = (x, value, label) =>
      `<g transform="translate(${x} 612)"><rect x="-125" y="-52" width="250" height="104" rx="14" fill="#ffffff" stroke="${a}" stroke-opacity=".28" stroke-width="2"/>` +
      `<text x="0" y="12" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="#1b1f3a">${value}</text>` +
      `<text x="0" y="38" text-anchor="middle" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="15" letter-spacing="2" fill="#5b6280">${label}</text></g>`;
    const star = (cx, cy, r) => {
      let d = "";
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? r * 0.45 : r;
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        d += `${i ? "L" : "M"}${(cx + rad * Math.cos(ang)).toFixed(1)} ${(cy + rad * Math.sin(ang)).toFixed(1)}`;
      }
      return d + "Z";
    };
    const ray = (i) => {
      const ang = (Math.PI * 2 * i) / 24;
      return `L${(1040 + 66 * Math.cos(ang)).toFixed(1)} ${(715 + 66 * Math.sin(ang)).toFixed(1)}L${(1040 + 58 * Math.cos(ang + Math.PI / 24)).toFixed(1)} ${(715 + 58 * Math.sin(ang + Math.PI / 24)).toFixed(1)}`;
    };
    let burst = "M1106 715";
    for (let i = 0; i < 24; i++) burst += ray(i);
    burst += "Z";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850" role="img" aria-label="${esc(tier.title)} certificate for ${name}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#f3f1ff"/></linearGradient>
<linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#7c6cf0"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9c46a"/><stop offset="1" stop-color="#b8892b"/></linearGradient>
</defs>
<rect width="1200" height="850" fill="url(#bg)"/>
<rect x="24" y="24" width="1152" height="802" rx="18" fill="none" stroke="${a}" stroke-width="6"/>
<rect x="46" y="46" width="1108" height="758" rx="10" fill="none" stroke="url(#gold)" stroke-width="2"/>
<g fill="none" stroke="url(#gold)" stroke-width="2"><path d="M70 110V70H110M1130 110V70H1090M70 740V780H110M1130 740V780H1090"/></g>
<rect x="46" y="46" width="1108" height="14" rx="7" fill="url(#band)"/>
<g transform="translate(86 96)"><rect width="64" height="64" rx="15" fill="${a}"/><g fill="#fff"><rect x="9" y="17" width="10" height="10" rx="2.5"/><rect x="22" y="17" width="10" height="10" rx="2.5"/><rect x="35" y="17" width="10" height="10" rx="2.5"/><rect x="48" y="17" width="7" height="10" rx="2.5"/><rect x="9" y="30" width="7" height="10" rx="2.5"/><rect x="19" y="30" width="10" height="10" rx="2.5" fill="#fbbf24"/><rect x="32" y="30" width="10" height="10" rx="2.5"/><rect x="45" y="30" width="10" height="10" rx="2.5"/><rect x="14" y="43" width="36" height="9" rx="2.5"/></g></g>
<text x="166" y="132" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="34" font-weight="700" fill="#1b1f3a">TypeLab</text>
<text x="166" y="156" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="15" letter-spacing="2" fill="#5b6280">LEARN TO TOUCH TYPE</text>
<text x="600" y="222" text-anchor="middle" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="20" font-weight="600" letter-spacing="8" fill="${a}">CERTIFICATE OF ACHIEVEMENT</text>
<text x="600" y="292" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${tier.title.length > 20 ? 50 : 58}" font-weight="700" fill="#1b1f3a">${esc(tier.title)}</text>
<text x="600" y="345" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-style="italic" fill="#5b6280">This certifies that</text>
<text x="600" y="425" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${cert.n.length > 16 ? 62 : 76}" font-style="italic" font-weight="700" fill="${a}">${name}</text>
<path d="M280 450H920" stroke="url(#gold)" stroke-width="2"/>
<text x="600" y="492" text-anchor="middle" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="22" fill="#2b3150">${esc(tier.lines[0])}</text>
<text x="600" y="524" text-anchor="middle" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="22" fill="#2b3150">${esc(tier.lines[1])}</text>
${stat(330, cert.w + " WPM", "BEST SPEED")}${stat(600, cert.a + "%", "ACCURACY")}${stat(870, tier.lessons, "LESSONS PASSED")}
<text x="86" y="700" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="16" letter-spacing="2" fill="#5b6280">ISSUED</text>
<text x="86" y="728" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="#1b1f3a">${esc(longDate(cert.d))}</text>
<text x="360" y="700" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="16" letter-spacing="2" fill="#5b6280">CERTIFICATE ID</text>
<text x="360" y="728" font-family="ui-monospace, Consolas, monospace" font-size="26" fill="#1b1f3a">${esc(cert.i)}</text>
<text x="86" y="772" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="18" fill="#2b3150">Practise free at <tspan font-weight="700" fill="${a}">${host}</tspan></text>
<path d="${burst}" fill="url(#gold)"/>
<circle cx="1040" cy="715" r="52" fill="#fff8e1" stroke="#b8892b" stroke-width="3"/>
<path d="${star(1040, 712, 30)}" fill="url(#gold)"/>
<path d="M1002 760L1020 800L1040 780L1060 800L1078 760Z" fill="${a}" opacity=".9"/>
</svg>`;
  }

  const dataUrl = (svgText) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);

  const pageUrl = (base, code) => `${String(base).replace(/#.*$/, "")}#/certificate/${code}`;

  const shareText = (cert) =>
    `I just earned the TypeLab "${TIERS[cert.t].title}" certificate: ${cert.w} WPM at ${cert.a}% accuracy. Learn to touch type for free:`;

  function shareLinks(url, cert) {
    const enc = encodeURIComponent;
    const text = shareText(cert);
    const title = `TypeLab: ${TIERS[cert.t].title}`;
    return [
      { id: "whatsapp", name: "WhatsApp", href: `https://wa.me/?text=${enc(text + " " + url)}` },
      { id: "linkedin", name: "LinkedIn post", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
      {
        id: "linkedin-profile", name: "Add to LinkedIn profile",
        href: `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${enc(title)}&organizationName=${enc("TypeLab")}` +
          `&issueYear=${Number(cert.d.slice(0, 4))}&issueMonth=${Number(cert.d.slice(5, 7))}&certUrl=${enc(url)}&certId=${enc(cert.i)}`,
      },
      { id: "x", name: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
      { id: "facebook", name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
      { id: "email", name: "Email", href: `mailto:?subject=${enc(title)}&body=${enc(text + "\n\n" + url)}` },
    ];
  }

  const api = { TIERS, status, localCode, decode, svg, dataUrl, pageUrl, shareText, shareLinks, longDate };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).certificate = api;
})(typeof window !== "undefined" ? window : globalThis);
