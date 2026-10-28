# TypeLab

A free English touch-typing trainer: endless practice that levels up while you type, a course (with a programmer track), speed and code tests, a leaderboard, and shareable certificates.

It is a **separate website** with its own GitHub repository and its own Cloudflare project. The portfolio only links to it. Plain HTML, CSS and JavaScript on the page, no build step and no runtime dependencies; a small Cloudflare Worker (in `worker/`) powers the email login, leaderboard and certificate verification.

## What it does

- **Login with an emailed code**: you enter a name and an email, TypeLab emails a 6-digit code, and typing that code logs you in. That proves the address is yours. There is no password. A "Continue as a guest" option keeps the app usable without a rank or certificate.
- **Practice** (one page for everything you type outside the course):
  - **Adaptive** is an endless run. Text keeps arriving, you start with six letters, and every time all your letters reach the target speed a new one unlocks. The level-up appears as a short message over the text and a highlighted letter. Nothing stops, resets or asks for a click. The run ends when you press Finish or leave the page, and is saved as one session.
  - **Words come in batches.** The first batch is 20 ordinary words. After that every batch is 15 words, added before the last space of the previous batch is typed, so typing never waits. Once 20 words are typed, each new batch is built from the letters you mistyped in the last two batches: about a third of its words start with such a letter and about a third have one in the middle. The level box names those letters and marks them with a red dot. With no mistakes the words are ordinary again.
  - **Timed, Words, Sentences and Code** are the speed tests, now inside the same page. Optional punctuation, capitals and numbers.
  - Extras for the adaptive stream: capitals, punctuation, numbers and programming symbols.
  - **One screen on a desktop**: the words, the keyboard and the hands sit together on the left and never need scrolling; the streak, mode, level and letters sit in a column on the right. Key and text size follow the window's width and height. Only on a very short window does the right-hand column scroll by itself. Below 1000px wide the page stacks and scrolls normally.
- **Streak**: a day counts only after **5 minutes of real typing**. The time adds up the gaps between keys (a gap of more than 2 seconds counts as 2), so opening a page, leaving a tab open, or typing two or three words does nothing. More than 5 minutes is fine but does not count extra. The Practice page shows today's typing time live and announces the moment the day is complete; the calendar in Progress marks streak days.
- **Strict typing**: a wrong key never moves on. The letter pulses red until the right key is typed.
- **Sounds**: a tick for a right key, a buzz for a wrong key, a harder double buzz when the same key is missed twice, a chime at the end, and a very soft rise for a level-up in the middle of a run.
- **Course** (unchanged): 24 lessons. 1 to 18 go from the home row to sentences; 19 to 24 are the programmer track (`@ # $ % ^ & *`, brackets, operators, `\ | ~ \``, camelCase / snake_case names, real code lines). Every printable key is taught by some lesson (a test checks this).
- **Progress**: your rank card (speed tier and position), the leaderboard (all time and this week), 18 achievements, certificates, speed and accuracy charts, forecast, practice calendar, keyboard heatmap, speed by letter and finger, common mistakes, slow letter pairs.
- **Certificates**: pass lessons 1 to 18 for "Touch Typing", all 24 for "Touch Typing for Programmers". Each is a designed certificate with your name, speed, accuracy and an ID, with a public link that anyone can open and check, a PNG download, print / PDF, and share buttons (WhatsApp, LinkedIn post, "Add to LinkedIn profile", X, Facebook, email, and the phone's own share sheet).
- **Guided tours**: each section (menu, Home, Practice, Course, a lesson, Progress, Settings) has its own short tour, shown once per player. Finishing or skipping it saves it, and it never comes back unless the player picks "Show the tours again" in Settings.
- **Look**: light / dark / auto, 12 background scenes (6 night, 6 day), a hands guide with five skin tones, a virtual keyboard with finger colours.
- Responsive from 320px, keyboard accessible, reduced-motion friendly.

## Run it locally

```
npm run serve        # http://127.0.0.1:5173/
```

The dev server sends the same headers as production (it reads them from `_headers`, so an inline script or style fails here first) and runs the real API (`server/core.mjs`) with a JSON file instead of Cloudflare KV. The data lives in `.devdata/` (ignored by git); the hashing and signing keys are created there on first run.

**Login codes while developing**: no email is sent. The dev server writes the message to `.devdata/outbox.json`, prints it in the terminal, and serves the latest one for an address at `http://127.0.0.1:5173/dev/outbox?to=you@example.com`. That route exists only in the dev server and only when `MAIL_PROVIDER`, `MAIL_API_KEY` and `MAIL_FROM` are not set; set them in the environment to send real email from the dev server.

`index.html` also opens straight from disk, but then there is no API: no rank and no verified certificates (certificates are marked "not verified"). Everything else works.

```
npm test             # Node's built-in test runner, no packages needed
```

## Deploy it as its own site

1. **GitHub**: put the contents of this folder in a new repository (the files in this folder are the repository root).
2. **Cloudflare**: Workers & Pages, Create, import the GitHub repository. Cloudflare creates a **Workers** project with the build command **(empty)** and the deploy command `npx wrangler deploy` (the default). Everything else comes from `wrangler.jsonc` in the repository:
   - the website is the repository root, served as static files; `.assetsignore` keeps `server/`, `worker/`, `tests/`, `tools/`, `node_modules` and the config files out of it (a dry run uploads exactly 56 files);
   - only `/api/*` runs the Worker (`worker/index.js`, which wraps `server/core.mjs`); every other address is a plain file;
   - `_headers` gives the site its security headers (Workers support it natively);
   - the `TYPELAB` KV namespace is declared there. With no `id` given, the first deploy creates the namespace itself. If a deploy ever complains about it, create a namespace in Workers & Pages, KV, and put its id in `wrangler.jsonc` as `{ "binding": "TYPELAB", "id": "<id>" }`.
   - The Worker's name in `wrangler.jsonc` (`typelab`) must match the name in the dashboard.
3. **Turn on the leaderboard**: without this the site works but has no rank.
   1. After the first deploy, open the Worker, Settings, Variables and Secrets, and add two **secrets**: `TYPELAB_SALT` and `TYPELAB_SIGN_KEY`. Make each a long random value, for example:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   2. Check `https://<your-site>/api/health`: it answers `{"ok":true,...}`. Until both secrets exist, the other API routes answer "not-configured".
   - Keep the two secrets safe. Changing `TYPELAB_SALT` gives every player a new id (everyone starts unranked). Changing `TYPELAB_SIGN_KEY` makes old certificate links show "not verified".
   - Optional: add a Cloudflare rate-limiting rule for `/api/*`.
4. **Turn on the login emails**: the login code is sent by an email service you choose. Without one, `otp/send` answers "mail-not-configured" and nobody can log in (guests still can use the app). Add three variables in the same Variables and Secrets page (`keep_vars` in `wrangler.jsonc` stops a later deploy from wiping them):
   - `MAIL_PROVIDER`: `brevo` (default choice) or `resend`.
   - `MAIL_API_KEY`: the provider's API key. Make it a **secret**.
   - `MAIL_FROM`: the sender, for example `TypeLab <login@your-domain.com>`.
   - **Brevo**: create an account, add and verify your sender address (Senders, Domains & Dedicated IPs), create an API key (SMTP & API), and use the verified address in `MAIL_FROM`. Brevo's rules about which sender addresses it accepts (for example free-mail addresses) change, so check their current documentation; a domain you own gives the most reliable delivery.
   - **Resend**: needs a domain you own and have verified with them; `MAIL_FROM` must be on that domain.
   - Check each provider's current free allowance before launch. Also set up SPF and DKIM for your sender if the provider asks, otherwise codes may land in spam.
   - Cloudflare's own email sending is not used. Redeploy after changing variables, then check `https://<your-site>/api/health`: it shows `"mail":true` when a provider is configured.
5. **Set the address** (optional): in `js/config.js` put the final address in `siteUrl` (for example `https://typelab.<your-account>.workers.dev/`). Left empty, certificate links use whatever address the page was opened from.
6. **Link it from the portfolio**: add a card or link in the portfolio's Projects section that points to the TypeLab address. Nothing else in the portfolio changes. The "Portfolio" link inside TypeLab comes from `portfolioUrl` in `js/config.js`.

## How the login and leaderboard work

- **Logging in**: the browser sends the email to `otp/send`. The server makes a 6-digit code, keeps only a **salted hash of the code** (with the email's salted hash as the key), and emails the code. The player types it, and `otp/verify` answers with a signed login token. The email itself is not stored and is never sent back.
  - A code works **once**, expires after **10 minutes**, and allows **5 wrong tries**. A new code can be asked for after 30 seconds, at most 5 an hour per email and 20 an hour per IP address.
  - The token is signed with `TYPELAB_SIGN_KEY` and lasts 90 days (renewed on use when under 30 days remain). Sync, delete and certificate requests need it; the leaderboard can be read without it.
  - The player id is a **salted SHA-256 hash of the lower-cased email**, so the same email gives the same id on every device and your rank follows you.
  - If the token is rejected (expired or the signing key changed), the app shows a banner asking the player to log in again; nothing is lost locally.
- The browser sends only summary numbers: ranking score, best speed, average accuracy, number of sessions and lessons passed, and this week's best. Sessions stay in the browser. Names are shown as "Mukeem K." (first name and the first letter of the last name).
- Players can hide themselves, or delete their entry, in Settings.
- **The ranking score** is the average of a player's best three qualifying runs: at least 20 seconds, 92% accuracy or better, on everyday text (the Timed, Words and Sentences tests, or adaptive practice once 18 or more letters are unlocked). Course lessons and code tests are not ranked. The speed tiers are Beginner, Learner, Typist, Skilled, Fast, Expert, Master and Legend.
- **Scores are reported by the browser**, so they are for fun. The server rejects impossible values (over 250 WPM, accuracy outside 0 to 100, updates faster than every 1.5 seconds) but cannot stop a determined cheat.

### The API (`/api/...`)

| Route | What it does |
|---|---|
| `POST otp/send` | email: emails a 6-digit login code |
| `POST otp/verify` | email + code: returns a login token and the player's current rank, if any |
| `POST sync` | (token) the player's summary numbers; returns rank (all time and this week) and a fresh token when the old one is getting old |
| `GET board?scope=all\|week` | top ten, the rows around the player (when a token is sent), and the player's rank |
| `POST delete` | (token) removes the player's entry |
| `POST certificate` | (token) signs a certificate if the player's synced lessons allow it |
| `GET verify?c=` | says whether a certificate code is genuine |
| `GET health` | `{ok, week, mail}`; works even before the KV binding exists |

Requests that need a token send it as `Authorization: Bearer <token>`.

The logic is in `server/core.mjs` and runs unchanged in the dev server and in `worker/index.js`. If the API is missing or not configured, the browser treats it as offline and carries on.

## Structure

```
index.html              app shell (no inline scripts or styles)
_headers                Cloudflare: security headers for the static files
wrangler.jsonc         Cloudflare Workers config: static assets, the /api/* Worker, the KV namespace
.assetsignore           what is in the repository but is not part of the website
robots.txt
css/                    style.css (tokens, layout), keyboard.css, scenes.css, social.css, practice.css (the one-screen Practice layout)
js/config.js            site address, portfolio link, API path, guest switch
js/theme.js             applies the saved theme and scene before first paint
js/core/                pure logic, also loaded by the Node tests
  metrics, layout, engine, keystats, textgen, lessons, storage
  rank.js               ranking score, tiers, achievements, leaderboard numbers
  certificate.js        certificate codes, the certificate picture, share links
  api.js, account.js    API client; login profile, guest mode, sync
js/data/                word list, sentences, code snippets (written for this project)
js/ui/                  DOM helpers, themes, sounds, hands, keyboard, charts, typing screen, results, tour
js/pages/               home, practice, course, stats (+ social.js), settings, learn, login, certificate
js/app.js               hash router, login gate, header pop-ups, tours
server/core.mjs         the API logic (login codes, tokens, leaderboard, certificates)
server/mail.mjs         sends the login email through Brevo or Resend
worker/index.js         the Cloudflare Worker around them (answers /api/* only)
assets/scenes/          the 12 background scenes (generated)
tests/                  unit tests
tools/serve.js          local server with the real API; tools/make-scenes.js draws the scenes
```

Scripts are plain `<script>` files (not ES modules) so the page also works from disk; the core files export themselves with `module.exports` for the tests.

## Privacy

- Saved in the browser: your sessions, letter statistics, settings, theme, tours seen, certificates, and (if you log in) your name, email and login token. Nothing is sent anywhere except the login email address (to send the code) and the summary numbers above.
- Saved on the server (Cloudflare KV): player id (hash), shortened display name, ranking numbers, lessons passed, and for a short time the hash of a pending login code. The email address is not stored. No sessions are stored. IP addresses are used only to count code requests, and only as a hash with a one-hour expiry.
- The email address does pass through the mail provider you pick, as any email does.

## Notes and limits

- Data is per browser. Logging in on another device brings your rank but not your sessions; use Settings, Download backup, then Restore backup to move those.
- The leaderboard is one record in KV that every update reads and rewrites, so two updates at the very same moment can lose one. It is fine for a small site; it is capped at 10,000 players (the lowest scores drop first).
- Names are not checked for rude words.
- The keyboard layout is US QWERTY (ANSI). Code snippets are single lines (no Enter, Tab or indentation yet).
- Mobile phones are not a target: touch typing needs a physical keyboard.
- The word list, sentences and code snippets are original to this project. The adaptive idea (frequency-ordered unlocking by per-key speed) is inspired by keybr.com, but no keybr code or data is used.
