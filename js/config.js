/* TypeLab settings you may want to change when the site is deployed. */
(function (root) {
  "use strict";

  const TL = (root.TL = root.TL || {});

  TL.config = {
    siteName: "TypeLab",
    // The public address of this site, for certificate links and share text, for example
    // "https://typelab.pages.dev/". Leave it empty to use whatever address the page was opened from.
    siteUrl: "https://typelab.mukeemkhan.workers.dev/",
    // Where the "back to portfolio" link goes.
    portfolioUrl: "https://mukeemkhan.pages.dev/",
    // The leaderboard and certificate server. Opened straight from disk (file://) there is none.
    api: "/api",
    // Show "Continue as guest" on the login screen. A guest has no rank and no certificate.
    allowGuest: true,
  };

  // The address of this site, always ending in a slash and never including a "#" part.
  TL.config.url = function () {
    if (TL.config.siteUrl) return TL.config.siteUrl.replace(/#.*$/, "").replace(/\/?$/, "/");
    return root.location.origin === "null" ? root.location.href.replace(/#.*$/, "") : root.location.origin + root.location.pathname;
  };
})(window);
